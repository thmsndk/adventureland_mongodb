/**
 * Monaco diagnostics: workers + lint/spell/format + markers + code actions.
 */
(function (global) {
	"use strict";

	function load_prefs() {
		if (global.ALEditor && typeof ALEditor.load_prefs === "function") return ALEditor.load_prefs();
		return { theme: "vs-dark", fontSize: 16, linting: true, spellcheck: true, formatting: true, typecheck: true, spellLanguages: ["en"] };
	}
	function save_prefs(p) {
		if (global.ALEditor && typeof ALEditor.save_prefs === "function") return ALEditor.save_prefs(p);
	}
	function tsLanguageApi() {
		if (global.ALEditor && typeof ALEditor.tsLanguageApi === "function") return ALEditor.tsLanguageApi();
		var api = global.monaco && (monaco.typescript || (monaco.languages && monaco.languages.typescript));
		return api || null;
	}

	var lintWorker = null;
	var spellWorker = null;
	var formatWorker = null;
	var lintWorkerLoading = null;
	var spellWorkerLoading = null;
	var formatWorkerLoading = null;
	var diagTimers = typeof WeakMap !== "undefined" ? new WeakMap() : null;
	var SPELL_USER_KEY = "al_code_spell_user_words";
	var DIAG_DEBOUNCE_MS = 350;
	var AL_TYPE_SCHEME = "al-type";
	var formatProviderDisposable = null;
	var spellActionDisposable = null;
	var eslintActionDisposable = null;
	var spellCommandRegistered = false;
	var eslintCommandRegistered = false;
	/** ruleId|line|col -> { range:[start,end], text } from last lint pass */
	var eslintFixByKey = typeof Map !== "undefined" ? new Map() : null;

	function eslintRuleDocsUrl(ruleId) {
		var id = String(ruleId || "");
		if (!id || id.indexOf("/") !== -1) {
			// plugin rules — best-effort search
			return "https://eslint.org/docs/latest/rules/";
		}
		return "https://eslint.org/docs/latest/rules/" + encodeURIComponent(id);
	}

	function eslintFixKey(ruleId, line, col) {
		return String(ruleId || "") + "|" + line + "|" + col;
	}

	function offsetToPosition(model, offset) {
		var pos = model.getPositionAt(offset);
		return { lineNumber: pos.lineNumber, column: pos.column };
	}

	function applyEslintFixEdit(model, fix) {
		if (!model || !fix || !fix.range) return false;
		var start = offsetToPosition(model, fix.range[0]);
		var end = offsetToPosition(model, fix.range[1]);
		model.pushEditOperations(
			[],
			[
				{
					range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
					text: fix.text == null ? "" : String(fix.text),
				},
			],
			function () {
				return null;
			},
		);
		return true;
	}

	function insertEslintDisableNextLine(model, lineNumber, ruleId) {
		if (!model || !ruleId) return;
		var line = Math.max(1, lineNumber || 1);
		var indent = "";
		try {
			var content = model.getLineContent(line);
			var m = content.match(/^\s*/);
			indent = m ? m[0] : "";
		} catch (e) {}
		var text = indent + "/* eslint-disable-next-line " + ruleId + " */\n";
		model.pushEditOperations([], [{ range: new monaco.Range(line, 1, line, 1), text: text }], function () {
			return null;
		});
	}

	function fixAllEslintForModel(model) {
		if (!model || !global.monaco) return Promise.resolve(false);
		var prefs = load_prefs();
		if (!prefs.linting) return Promise.resolve(false);
		var version = model.getVersionId();
		var code = model.getValue();
		return ensureLintWorker()
			.then(function (worker) {
				return postWorkerJob(Promise.resolve(worker), {
					type: "fix",
					code: code,
					version: version,
					rules: prefs.eslintRules || {},
				});
			})
			.then(function (data) {
				if (!model || (model.isDisposed && model.isDisposed())) return false;
				if (model.getVersionId() !== version) return false;
				if (!data || !data.fixed || data.output == null || data.output === code) return false;
				model.pushEditOperations(
					[],
					[
						{
							range: model.getFullModelRange(),
							text: String(data.output),
						},
					],
					function () {
						return null;
					},
				);
				scheduleModelDiagnostics(model);
				return true;
			})
			.catch(function (err) {
				console.warn("[ALEditor] eslint fix failed", err);
				return false;
			});
	}

	function ensureEslintCodeActions() {
		if (!global.monaco) return;
		if (!eslintCommandRegistered && monaco.editor && typeof monaco.editor.registerCommand === "function") {
			eslintCommandRegistered = true;
			monaco.editor.registerCommand("al.eslint.applyFix", function (_accessor, modelUri, ruleId, line, col) {
				var model = monaco.editor.getModel(monaco.Uri.parse(String(modelUri)));
				if (!model || !eslintFixByKey) return;
				var fix = eslintFixByKey.get(eslintFixKey(ruleId, line, col));
				if (fix) applyEslintFixEdit(model, fix);
				scheduleModelDiagnostics(model);
			});
			monaco.editor.registerCommand("al.eslint.disableNextLine", function (_accessor, modelUri, ruleId, line) {
				var model = monaco.editor.getModel(monaco.Uri.parse(String(modelUri)));
				if (!model) return;
				insertEslintDisableNextLine(model, line, ruleId);
				scheduleModelDiagnostics(model);
			});
			monaco.editor.registerCommand("al.eslint.fixAll", function (_accessor, modelUri) {
				var model = monaco.editor.getModel(monaco.Uri.parse(String(modelUri)));
				if (!model) return;
				fixAllEslintForModel(model);
			});
			monaco.editor.registerCommand("al.eslint.openRuleDocs", function (_accessor, ruleId) {
				var url = eslintRuleDocsUrl(ruleId);
				try {
					if (global.open) global.open(url, "_blank");
				} catch (e) {}
			});
		}
		if (eslintActionDisposable) return;
		eslintActionDisposable = monaco.languages.registerCodeActionProvider("javascript", {
			provideCodeActions: function (model, range, context) {
				var actions = [];
				var markers = context && context.markers ? context.markers : [];
				var uri = String(model.uri);
				var sawFixable = false;
				for (var i = 0; i < markers.length; i++) {
					var mk = markers[i];
					if ((mk.source || "") !== "eslint") continue;
					var ruleId = "";
					if (mk.code != null) {
						ruleId = typeof mk.code === "object" && mk.code.value != null ? String(mk.code.value) : String(mk.code);
					}
					var key = eslintFixKey(ruleId, mk.startLineNumber, mk.startColumn);
					var hasFix = eslintFixByKey && eslintFixByKey.has(key);
					if (hasFix) {
						sawFixable = true;
						actions.push({
							title: "Fix this " + (ruleId ? ruleId + " " : "") + "problem",
							kind: "quickfix",
							diagnostics: [mk],
							isPreferred: true,
							command: {
								id: "al.eslint.applyFix",
								title: "Fix",
								arguments: [uri, ruleId, mk.startLineNumber, mk.startColumn],
							},
						});
					}
					if (ruleId) {
						actions.push({
							title: "Disable " + ruleId + " for this line",
							kind: "quickfix",
							diagnostics: [mk],
							command: {
								id: "al.eslint.disableNextLine",
								title: "Disable",
								arguments: [uri, ruleId, mk.startLineNumber],
							},
						});
						actions.push({
							title: "Open documentation for " + ruleId,
							kind: "quickfix",
							diagnostics: [mk],
							command: {
								id: "al.eslint.openRuleDocs",
								title: "Docs",
								arguments: [ruleId],
							},
						});
					}
				}
				if (
					sawFixable ||
					markers.some(function (m) {
						return (m.source || "") === "eslint";
					})
				) {
					actions.push({
						title: "Fix all auto-fixable ESLint problems",
						kind: "quickfix.source.fixAll",
						command: {
							id: "al.eslint.fixAll",
							title: "Fix all",
							arguments: [uri],
						},
					});
				}
				return { actions: actions, dispose: function () {} };
			},
		});
	}

	function ensureSpellCodeActions() {
		if (!global.monaco) return;
		if (!spellCommandRegistered && monaco.editor && typeof monaco.editor.registerCommand === "function") {
			spellCommandRegistered = true;
			monaco.editor.registerCommand("al.spell.addWord", function (_accessor, word) {
				saveUserSpellWord(word);
				refreshAllDiagnostics();
			});
		}
		if (spellActionDisposable) return;
		spellActionDisposable = monaco.languages.registerCodeActionProvider("javascript", {
			provideCodeActions: function (model, range, context) {
				var actions = [];
				var markers = context && context.markers ? context.markers : [];
				for (var i = 0; i < markers.length; i++) {
					var mk = markers[i];
					if ((mk.source || "") !== "cspell") continue;
					var word = "";
					var mm = String(mk.message || "").match(/^"([^"]+)"/);
					if (mm) word = mm[1];
					if (!word && model && mk.startLineNumber) {
						word = model.getValueInRange({
							startLineNumber: mk.startLineNumber,
							startColumn: mk.startColumn,
							endLineNumber: mk.endLineNumber,
							endColumn: mk.endColumn,
						});
					}
					if (!word) continue;
					actions.push({
						title: 'Add "' + word + '" to user dictionary',
						kind: "quickfix",
						diagnostics: [mk],
						isPreferred: true,
						command: {
							id: "al.spell.addWord",
							title: "Add word",
							arguments: [word],
						},
					});
				}
				return { actions: actions, dispose: function () {} };
			},
		});
	}

	function monacoBaseUrl() {
		var version = global.MONACO_VERSION || "0.56.0";
		var origin = "";
		try {
			origin = global.location && global.location.origin ? global.location.origin : "";
		} catch (e) {}
		return origin + "/js/monaco/";
	}

	var lastCheckJs = null;

	function applyCheckJsFromPrefs(prefs) {
		var ts = tsLanguageApi();
		if (!ts || !ts.javascriptDefaults) return;
		prefs = prefs || load_prefs();
		var checkJs = !!prefs.typeChecking;
		if (lastCheckJs === checkJs) return;
		lastCheckJs = checkJs;
		var lists = [ts.javascriptDefaults, ts.typescriptDefaults];
		for (var i = 0; i < lists.length; i++) {
			var cur = {};
			try {
				if (typeof lists[i].getCompilerOptions === "function") cur = lists[i].getCompilerOptions() || {};
			} catch (e) {}
			lists[i].setCompilerOptions(
				Object.assign({}, cur, {
					allowJs: true,
					allowNonTsExtensions: true,
					checkJs: checkJs,
					noEmit: true,
					noLib: false,
					lib: ["es2020", "dom"],
					strict: false,
					noImplicitAny: false,
					strictNullChecks: false,
				}),
			);
			lists[i].setDiagnosticsOptions({
				noSemanticValidation: !checkJs,
				noSyntaxValidation: false,
				diagnosticCodesToIgnore: [1108],
			});
		}
	}

	function clearOwnerMarkers(model, owner) {
		if (!global.monaco || !model) return;
		try {
			monaco.editor.setModelMarkers(model, owner, []);
		} catch (e) {}
	}

	function loadUserSpellWords() {
		try {
			var raw = localStorage.getItem(SPELL_USER_KEY);
			if (!raw) return [];
			var arr = JSON.parse(raw);
			return Array.isArray(arr) ? arr.map(String) : [];
		} catch (e) {
			return [];
		}
	}

	function setUserSpellWords(words) {
		var src = Array.isArray(words) ? words : [];
		var out = [];
		for (var i = 0; i < src.length; i++) {
			var w = String(src[i] || "")
				.toLowerCase()
				.trim();
			if (!w) continue;
			if (out.indexOf(w) === -1) out.push(w);
		}
		try {
			localStorage.setItem(SPELL_USER_KEY, JSON.stringify(out));
		} catch (e) {}
		return out;
	}

	function saveUserSpellWord(word) {
		var w = String(word || "")
			.toLowerCase()
			.trim();
		if (!w) return;
		var list = loadUserSpellWords();
		if (list.indexOf(w) === -1) list.push(w);
		setUserSpellWords(list);
		try {
			if (global.ALVscodeApi && typeof ALVscodeApi.mergeUserConfiguration === "function" && !global.__AL_SKIP_VSCODE_SYNC) {
				ALVscodeApi.mergeUserConfiguration({ "cSpell.userWords": list });
			}
		} catch (e) {}
	}

	function ensureLintWorker() {
		if (lintWorker) return Promise.resolve(lintWorker);
		if (lintWorkerLoading) return lintWorkerLoading;
		lintWorkerLoading = new Promise(function (resolve, reject) {
			try {
				var w = new Worker(monacoBaseUrl() + "lint/eslint-worker.js");
				w.onmessage = function () {};
				lintWorker = w;
				resolve(w);
			} catch (err) {
				lintWorkerLoading = null;
				reject(err);
			}
		});
		return lintWorkerLoading;
	}

	function ensureSpellWorker() {
		if (spellWorker) return Promise.resolve(spellWorker);
		if (spellWorkerLoading) return spellWorkerLoading;
		spellWorkerLoading = new Promise(function (resolve, reject) {
			try {
				var w = new Worker(monacoBaseUrl() + "spell/spell-worker.js");
				w.addEventListener("message", function (ev) {
					var data = ev.data || {};
					if (data.type === "spell-lang-error") {
						console.warn("[ALEditor] spell dictionary failed to load:", data.lang, data.message);
					}
				});
				spellWorker = w;
				resolve(w);
			} catch (err) {
				spellWorkerLoading = null;
				reject(err);
			}
		});
		return spellWorkerLoading;
	}

	function ensureFormatWorker() {
		if (formatWorker) return Promise.resolve(formatWorker);
		if (formatWorkerLoading) return formatWorkerLoading;
		formatWorkerLoading = new Promise(function (resolve, reject) {
			try {
				var w = new Worker(monacoBaseUrl() + "format/prettier-worker.js");
				w.onmessage = function () {};
				formatWorker = w;
				resolve(w);
			} catch (err) {
				formatWorkerLoading = null;
				reject(err);
			}
		});
		return formatWorkerLoading;
	}

	function postWorkerJob(workerPromise, payload, onResult) {
		return workerPromise.then(function (worker) {
			return new Promise(function (resolve, reject) {
				var reqId = String(Date.now()) + "-" + Math.random().toString(36).slice(2);
				function onMsg(ev) {
					var data = ev.data || {};
					if (data.id !== reqId) return;
					worker.removeEventListener("message", onMsg);
					if (typeof onResult === "function") onResult(data);
					if (data.error) reject(new Error(data.error));
					else resolve(data);
				}
				worker.addEventListener("message", onMsg);
				worker.postMessage(Object.assign({ id: reqId }, payload));
			});
		});
	}

	function runLintForModel(model) {
		if (!model || !global.monaco) return;
		var prefs = load_prefs();
		if (!prefs.linting) {
			clearOwnerMarkers(model, "eslint");
			return;
		}
		var version = model.getVersionId();
		var code = model.getValue();
		ensureLintWorker()
			.then(function (worker) {
				return postWorkerJob(Promise.resolve(worker), { type: "lint", code: code, version: version, rules: prefs.eslintRules || {} }, function (data) {
					var markers = (data && data.markers) || [];
					if (!model || (model.isDisposed && model.isDisposed())) return;
					if (model.getVersionId() !== version) return;
					if (eslintFixByKey) eslintFixByKey.clear();
					var mapped = markers.map(function (m) {
						var code = undefined;
						if (m.ruleId) {
							try {
								code = {
									value: m.ruleId,
									target: monaco.Uri.parse(eslintRuleDocsUrl(m.ruleId)),
								};
							} catch (e) {
								code = m.ruleId;
							}
						}
						if (m.fix && m.fix.range && eslintFixByKey) {
							eslintFixByKey.set(eslintFixKey(m.ruleId, m.startLineNumber, m.startColumn), m.fix);
						}
						return {
							severity: m.severity === 2 ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
							message: m.message,
							source: "eslint",
							code: code,
							startLineNumber: m.startLineNumber,
							startColumn: m.startColumn,
							endLineNumber: m.endLineNumber,
							endColumn: m.endColumn,
						};
					});
					monaco.editor.setModelMarkers(model, "eslint", mapped);
				});
			})
			.catch(function (err) {
				console.warn("[ALEditor] eslint worker failed", err);
			});
	}

	function runSpellForModel(model) {
		if (!model || !global.monaco) return;
		var prefs = load_prefs();
		if (!prefs.spellCheck) {
			clearOwnerMarkers(model, "cspell");
			return;
		}
		var version = model.getVersionId();
		var code = model.getValue();
		ensureSpellWorker()
			.then(function (worker) {
				return postWorkerJob(
					Promise.resolve(worker),
					{
						type: "spell",
						code: code,
						version: version,
						userWords: loadUserSpellWords(),
						languages: prefs.spellLanguages || ["en"],
					},
					function (data) {
						var markers = (data && data.markers) || [];
						if (!model || (model.isDisposed && model.isDisposed())) return;
						if (model.getVersionId() !== version) return;
						var mapped = markers.map(function (m) {
							return {
								// Info (not Hint): Hint uses short dotted underlines in Monaco;
								// cSpell/VS Code uses Information-level diagnostics for spelling.
								severity: monaco.MarkerSeverity.Info,
								message: m.message,
								source: "cspell",
								code: "unknownWord",
								startLineNumber: m.startLineNumber,
								startColumn: m.startColumn,
								endLineNumber: m.endLineNumber,
								endColumn: m.endColumn,
							};
						});
						monaco.editor.setModelMarkers(model, "cspell", mapped);
					},
				);
			})
			.catch(function (err) {
				console.warn("[ALEditor] spell worker failed", err);
			});
	}

	function formatCodeWithPrettier(code, options) {
		var prefs = load_prefs();
		if (!prefs.formatting) return Promise.resolve(code);
		return ensureFormatWorker().then(function (worker) {
			return postWorkerJob(Promise.resolve(worker), {
				type: "format",
				code: String(code || ""),
				options: Object.assign({}, prefs.prettier, options || {}),
			}).then(function (data) {
				return data.formatted != null ? data.formatted : code;
			});
		});
	}

	function formatModelWithPrettier(model) {
		if (!model || !global.monaco) return Promise.resolve(false);
		var prefs = load_prefs();
		if (!prefs.formatting) return Promise.resolve(false);
		var before = model.getValue();
		return formatCodeWithPrettier(before).then(function (formatted) {
			if (formatted == null || formatted === before) return false;
			model.pushEditOperations(
				[],
				[
					{
						range: model.getFullModelRange(),
						text: formatted,
					},
				],
				function () {
					return null;
				},
			);
			return true;
		});
	}

	function ensurePrettierFormattingProvider() {
		if (!global.monaco || formatProviderDisposable) return;
		formatProviderDisposable = monaco.languages.registerDocumentFormattingEditProvider("javascript", {
			displayName: "Prettier",
			provideDocumentFormattingEdits: function (model) {
				var prefs = load_prefs();
				if (!prefs.formatting) return Promise.resolve([]);
				var before = model.getValue();
				return formatCodeWithPrettier(before)
					.then(function (formatted) {
						if (formatted == null || formatted === before) return [];
						return [
							{
								range: model.getFullModelRange(),
								text: formatted,
							},
						];
					})
					.catch(function (err) {
						console.warn("[ALEditor] prettier format failed", err);
						return [];
					});
			},
		});
	}

	function scheduleModelDiagnostics(model) {
		if (!model) return;
		var delay = function () {
			runLintForModel(model);
			runSpellForModel(model);
		};
		if (!diagTimers) {
			delay();
			return;
		}
		var prev = diagTimers.get(model);
		if (prev) clearTimeout(prev);
		diagTimers.set(
			model,
			setTimeout(function () {
				diagTimers.delete(model);
				delay();
			}, DIAG_DEBOUNCE_MS),
		);
	}

	function attachModelDiagnostics(model) {
		if (!model || model.__alDiagAttached) return;
		model.__alDiagAttached = true;
		model.onDidChangeContent(function () {
			scheduleModelDiagnostics(model);
		});
		scheduleModelDiagnostics(model);
	}

	function refreshAllDiagnostics() {
		if (!global.monaco) return;
		var prefs = load_prefs();
		applyCheckJsFromPrefs(prefs);
		var models = monaco.editor.getModels();
		for (var i = 0; i < models.length; i++) {
			var m = models[i];
			var uri = String(m.uri);
			if (uri.indexOf("ts:adventureland/") === 0 || uri.indexOf(AL_TYPE_SCHEME + ":") === 0) continue;
			if (uri.indexOf("/adventureland/types/") !== -1) continue;
			if (m.getLanguageId && m.getLanguageId() !== "javascript" && m.getLanguageId() !== "typescript") continue;
			if (!prefs.linting) clearOwnerMarkers(m, "eslint");
			else runLintForModel(m);
			if (!prefs.spellCheck) clearOwnerMarkers(m, "cspell");
			else runSpellForModel(m);
		}
	}

	var ALEditor = global.ALEditor || (global.ALEditor = {});
	Object.assign(ALEditor, {
		attachModelDiagnostics: attachModelDiagnostics,
		scheduleModelDiagnostics: scheduleModelDiagnostics,
		refreshAllDiagnostics: refreshAllDiagnostics,
		addSpellWord: saveUserSpellWord,
		getUserSpellWords: loadUserSpellWords,
		setUserSpellWords: setUserSpellWords,
		fixEslint: fixAllEslintForModel,
		applyCheckJsFromPrefs: applyCheckJsFromPrefs,
		formatModel: formatModelWithPrettier,
		formatCode: formatCodeWithPrettier,
		ensurePrettierFormattingProvider: ensurePrettierFormattingProvider,
		ensureSpellCodeActions: ensureSpellCodeActions,
		ensureEslintCodeActions: ensureEslintCodeActions,
	});
})(typeof window !== "undefined" ? window : globalThis);
