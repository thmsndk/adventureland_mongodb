/**
 * AdventureLand code editor (Monaco). Replaces CodeMirror for live game pages.
 * Surface: getValue/setValue/focus/layout/on/dispose (+ clearHistory, getWrapperElement for migrate).
 */
(function (global) {
	"use strict";

	// Pixel theme colors from js/codemirror/pixel.css — widgets tuned for readable contrast.
	var PIXEL_THEME = {
		base: "vs-dark",
		inherit: false,
		rules: [
			{ token: "", foreground: "E9EDED", background: "000000" },
			{ token: "comment", foreground: "546E7A", fontStyle: "italic" },
			{ token: "keyword", foreground: "6C6B6D" },
			{ token: "number", foreground: "F77669" },
			{ token: "string", foreground: "C3E88D" },
			{ token: "regexp", foreground: "80CBC4" },
			{ token: "type", foreground: "DECB6B" },
			{ token: "class", foreground: "DECB6B" },
			{ token: "delimiter", foreground: "EDEDED" },
			{ token: "identifier", foreground: "7D7CAF" },
			{ token: "operator", foreground: "EDEDED" },
			{ token: "variable", foreground: "7D7CAF" },
			{ token: "variable.predefined", foreground: "DECB6B" },
			{ token: "constant", foreground: "F77669" },
			{ token: "tag", foreground: "FF5370" },
			{ token: "attribute.name", foreground: "FFCB6B" },
			{ token: "attribute.value", foreground: "C3E88D" },
			{ token: "meta", foreground: "80CBC4" },
		],
		colors: {
			"editor.background": "#000000",
			"editor.foreground": "#E9EDED",
			"editorLineNumber.foreground": "#E0E0D9",
			"editorLineNumber.activeForeground": "#FFFFFF",
			"editorGutter.background": "#303030",
			"editor.selectionBackground": "#FFFFFF40",
			"editor.inactiveSelectionBackground": "#FFFFFF26",
			"editor.lineHighlightBackground": "#00000000",
			"editor.lineHighlightBorder": "#00000000",
			"editorCursor.foreground": "#F8F8F0",
			"editorWhitespace.foreground": "#303030",
			"editorIndentGuide.background": "#1A1A1A",
			"editorIndentGuide.activeBackground": "#303030",
			"editorWidget.background": "#1A1A1A",
			"editorWidget.foreground": "#E9EDED",
			"editorWidget.border": "#555960",
			"editorHoverWidget.background": "#1A1A1A",
			"editorHoverWidget.foreground": "#E9EDED",
			"editorHoverWidget.border": "#67D74C",
			"editorSuggestWidget.background": "#1A1A1A",
			"editorSuggestWidget.foreground": "#E9EDED",
			"editorSuggestWidget.border": "#555960",
			"editorSuggestWidget.selectedBackground": "#303030",
			"editorSuggestWidget.highlightForeground": "#67D74C",
			"input.background": "#000000",
			"input.foreground": "#E9EDED",
			"input.border": "#555960",
			focusBorder: "#67D74C",
			"scrollbarSlider.background": "#55596080",
			"scrollbarSlider.hoverBackground": "#555960CC",
			"scrollbarSlider.activeBackground": "#67D74C99",
			"list.hoverBackground": "#303030",
			"list.activeSelectionBackground": "#303030",
		},
	};

	var themeDefined = false;
	var hostEditors = typeof WeakMap !== "undefined" ? new WeakMap() : null;
	var typesRegistered = false;
	var extraLibDisposables = [];
	var typeModelUris = [];
	var definitionOpenerRegistered = false;
	var linkOpenerRegistered = false;
	var typeCommandRegistered = false;
	var defOverlayEditor = null;
	var customHoverRegistered = false;
	var hoverSourceEditor = null;
	var AL_TYPE_SCHEME = "al-type";
	var OPEN_TYPE_CMD = "al.openType";
	// Built-in / DOM / TS primitives — never offer as type links.
	var HOVER_TYPE_SKIP = {
		any: 1,
		unknown: 1,
		never: 1,
		void: 1,
		null: 1,
		undefined: 1,
		object: 1,
		string: 1,
		number: 1,
		boolean: 1,
		symbol: 1,
		bigint: 1,
		Function: 1,
		Array: 1,
		Promise: 1,
		Record: 1,
		Partial: 1,
		Required: 1,
		Readonly: 1,
		Pick: 1,
		Omit: 1,
		Date: 1,
		Error: 1,
		RegExp: 1,
		Map: 1,
		Set: 1,
		WeakMap: 1,
		WeakSet: 1,
	};

	// Crisp mono for Monaco glyphs; Pixel stays on explorer/chrome.
	var EDITOR_FONT = 'Consolas, "Cascadia Mono", "Segoe UI Mono", "Liberation Mono", Menlo, Monaco, monospace';
	var PREFS_KEY = "al_code_editor_prefs";
	var THEMES = ["vs-dark", "vs", "hc-black", "pixel"];

	function ensureMonacoWorkers() {
		if (!global.monaco || global.__AL_MONACO_WORKERS_READY__) return;
		global.__AL_MONACO_WORKERS_READY__ = true;
		var version = global.MONACO_VERSION || "0.56.0";
		var origin = "";
		try {
			origin = global.location && global.location.origin ? global.location.origin : "";
		} catch (e) {}
		var base = origin + "/js/monaco/" + version + "/";

		function workerFile(label) {
			return label === "typescript" || label === "javascript" ? "ts.worker.js" : "editor.worker.js";
		}

		// Prefer getWorker + same-origin Worker URL. Blob/importScripts often leaves
		// hovers stuck on "Loading..." when the worker fails to handshake.
		global.MonacoEnvironment = {
			getWorker: function (_moduleId, label) {
				var url = base + workerFile(label);
				try {
					return new Worker(url);
				} catch (err) {
					console.warn("[ALEditor] Worker() failed, trying blob proxy", err);
					var body = "importScripts(" + JSON.stringify(url) + ");";
					return new Worker(URL.createObjectURL(new Blob([body], { type: "application/javascript" })));
				}
			},
			getWorkerUrl: function (_moduleId, label) {
				return base + workerFile(label);
			},
		};
	}

	function ensureTheme() {
		if (themeDefined || !global.monaco) return;
		global.monaco.editor.defineTheme("pixel", PIXEL_THEME);
		themeDefined = true;
	}

	function normalizeSpellLanguages(raw) {
		var allowed = { en: 1, nl: 1, de: 1, fr: 1 };
		var out = [];
		var src = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,\s]+/) : null;
		if (!src) src = detectDefaultSpellLanguages();
		for (var i = 0; i < src.length; i++) {
			var id = String(src[i] || "")
				.toLowerCase()
				.trim();
			if (!id || !allowed[id]) continue;
			if (out.indexOf(id) === -1) out.push(id);
		}
		return out.length ? out : ["en"];
	}

	/** Like cSpell: enable locale packs that we ship; English is the AL default. */
	function detectDefaultSpellLanguages() {
		var out = ["en"];
		var allowed = { nl: 1, de: 1, fr: 1 };
		try {
			var nav = (global.navigator && (navigator.languages || [navigator.language])) || [];
			for (var i = 0; i < nav.length; i++) {
				var primary = String(nav[i] || "")
					.toLowerCase()
					.split("-")[0];
				if (allowed[primary] && out.indexOf(primary) === -1) out.push(primary);
			}
		} catch (e) {}
		return out;
	}

	function load_prefs() {
		var defaults = {
			theme: "vs-dark",
			fontFamily: EDITOR_FONT,
			fontSize: 16,
			typeChecking: true,
			linting: true,
			spellCheck: true,
			spellLanguages: detectDefaultSpellLanguages(),
			formatting: true,
			formatOnSave: false,
			prettier: {
				semi: true,
				singleQuote: false,
				tabWidth: 4,
				useTabs: false,
				trailingComma: "es5",
				printWidth: 100,
				bracketSpacing: true,
				arrowParens: "always",
			},
			eslintRules: {},
		};
		try {
			var raw = localStorage.getItem(PREFS_KEY);
			if (!raw) return defaults;
			var p = JSON.parse(raw);
			var prettier = Object.assign({}, defaults.prettier);
			if (p.prettier && typeof p.prettier === "object") {
				var pk = Object.keys(defaults.prettier);
				for (var i = 0; i < pk.length; i++) {
					var k = pk[i];
					if (p.prettier[k] !== undefined) prettier[k] = p.prettier[k];
				}
			}
			var eslintRules = {};
			if (p.eslintRules && typeof p.eslintRules === "object" && !Array.isArray(p.eslintRules)) {
				eslintRules = p.eslintRules;
			}
			return {
				theme: THEMES.indexOf(p.theme) !== -1 ? p.theme : defaults.theme,
				fontFamily: typeof p.fontFamily === "string" && p.fontFamily.trim() ? p.fontFamily : defaults.fontFamily,
				fontSize: typeof p.fontSize === "number" && p.fontSize >= 10 && p.fontSize <= 32 ? p.fontSize : defaults.fontSize,
				typeChecking: p.typeChecking === false ? false : true,
				linting: p.linting === false ? false : true,
				spellCheck: p.spellCheck === false ? false : true,
				spellLanguages: p.spellLanguages != null ? normalizeSpellLanguages(p.spellLanguages) : defaults.spellLanguages,
				formatting: p.formatting === false ? false : true,
				formatOnSave: p.formatOnSave === true,
				prettier: prettier,
				eslintRules: eslintRules,
			};
		} catch (e) {
			return defaults;
		}
	}

	function save_prefs(prefs) {
		try {
			localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
		} catch (e) {}
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

	function applyCheckJsFromPrefs(prefs) {
		var ts = tsLanguageApi();
		if (!ts || !ts.javascriptDefaults) return;
		prefs = prefs || load_prefs();
		var checkJs = !!prefs.typeChecking;
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

	function saveUserSpellWord(word) {
		var w = String(word || "")
			.toLowerCase()
			.trim();
		if (!w) return;
		var list = loadUserSpellWords();
		if (list.indexOf(w) === -1) list.push(w);
		try {
			localStorage.setItem(SPELL_USER_KEY, JSON.stringify(list));
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
			if (m.getLanguageId && m.getLanguageId() !== "javascript" && m.getLanguageId() !== "typescript") continue;
			if (!prefs.linting) clearOwnerMarkers(m, "eslint");
			else runLintForModel(m);
			if (!prefs.spellCheck) clearOwnerMarkers(m, "cspell");
			else runSpellForModel(m);
		}
	}

	/**
	 * Monaco 0.56+: service lives on `monaco.typescript`.
	 * Older builds used `monaco.languages.typescript`.
	 */
	function tsLanguageApi() {
		if (!global.monaco) return null;
		if (monaco.typescript && monaco.typescript.javascriptDefaults) return monaco.typescript;
		if (monaco.languages && monaco.languages.typescript) return monaco.languages.typescript;
		return null;
	}

	/**
	 * Wrap ambient .d.ts as a module that augments `global`.
	 * Monaco/TS5 often treats CODE buffers as modules, so top-level `declare function`
	 * in extraLibs never merges — hover falls back to `any`.
	 */
	function asGlobalAugmentation(content) {
		var text = String(content || "").replace(/\r\n/g, "\n");
		if (/\bdeclare\s+global\b/.test(text)) return text;
		var body = text.replace(/^declare\s+(function|const|var|let|class|enum)\b/gm, "$1");
		return "export {};\ndeclare global {\n" + body + "\n}\n";
	}

	function registerAdventureLandTypes(force) {
		if (!global.monaco) return false;
		var ts = tsLanguageApi();
		if (!ts || !ts.javascriptDefaults) {
			console.warn("[ALEditor] monaco.typescript missing — JS language service not available");
			return false;
		}
		var libs = global.__AL_MONACO_TYPES__;
		if (!libs) {
			console.warn("[ALEditor] IntelliSense libs missing — load /js/monaco/types/bundle.js before editor.js");
			return false;
		}
		if (typesRegistered && !force) return true;

		var defaultsList = [ts.javascriptDefaults, ts.typescriptDefaults];

		for (var d = 0; d < extraLibDisposables.length; d++) {
			try {
				extraLibDisposables[d].dispose();
			} catch (e) {}
		}
		extraLibDisposables = [];

		// Stock ES + DOM libs from the Monaco ts.worker (CODE runs in Chromium /
		// Electron). AL APIs stay in extraLibs. Electron/Node is additive below.
		// allowJs + allowNonTsExtensions: CODE slots are .js models.
		var prefs = load_prefs();
		var compilerOptions = {
			allowNonTsExtensions: true,
			allowJs: true,
			checkJs: !!prefs.typeChecking,
			noEmit: true,
			noLib: false,
			lib: ["es2020", "dom"],
			allowUmdGlobalAccess: true,
			target: ts.ScriptTarget.ES2020,
			module: ts.ModuleKind.ESNext,
			// Keep JS checking non-strict — AdventureLand scripts are dynamic.
			strict: false,
			noImplicitAny: false,
			strictNullChecks: false,
		};
		if (ts.ModuleDetectionKind && ts.ModuleDetectionKind.Force != null) {
			// Force module mode so declare-global augmentations apply consistently.
			compilerOptions.moduleDetection = ts.ModuleDetectionKind.Force;
		}

		for (var i = 0; i < defaultsList.length; i++) {
			var defaults = defaultsList[i];
			defaults.setDiagnosticsOptions({
				noSemanticValidation: false,
				noSyntaxValidation: false,
				diagnosticCodesToIgnore: [1108], // top-level return in scripts
			});
			defaults.setCompilerOptions(compilerOptions);
			if (typeof defaults.setEagerModelSync === "function") {
				defaults.setEagerModelSync(true);
			}
			// Keep built-in hover off — we format JSDoc ourselves (see ensureCustomHover).
			if (typeof defaults.setModeConfiguration === "function") {
				var modeCfg = defaults.modeConfiguration || {};
				defaults.setModeConfiguration(Object.assign({}, modeCfg, { hovers: false }));
			}
		}

		var names = Object.keys(libs);
		var wantElectron = !!(global.is_electron || global.is_cli);
		typeModelUris = [];
		for (var n = 0; n < names.length; n++) {
			var name = names[n];
			// Electron/Node typings are additive — only when the client exposes them.
			if (name === "adventureland-electron.d.ts" && !wantElectron) continue;
			var content = asGlobalAugmentation(libs[name]);
			// Monaco playground convention: ts:filename/*.d.ts
			var uri = "ts:adventureland/" + name;
			for (var j = 0; j < defaultsList.length; j++) {
				extraLibDisposables.push(defaultsList[j].addExtraLib(content, uri));
			}
			// Models are required for Go to Definition / Peek — without them standalone Monaco
			// resolves the symbol then silently does nothing (no editor opener / no model).
			try {
				var parsed = monaco.Uri.parse(uri);
				typeModelUris.push(String(parsed));
				var existing = monaco.editor.getModel(parsed);
				if (existing) {
					if (existing.getValue() !== content) existing.setValue(content);
				} else {
					monaco.editor.createModel(content, "typescript", parsed);
				}
			} catch (e) {
				console.warn("[ALEditor] type model failed for", uri, e);
			}
		}

		ensureDefinitionOpener();
		ensureCustomHover();
		typesRegistered = true;
		return true;
	}

	function isAdventureLandTypeUri(resource) {
		var s = String(resource || "");
		return s.indexOf("ts:adventureland/") !== -1 || s.indexOf("/adventureland/types/") !== -1;
	}

	function closeDefinitionOverlay() {
		var panel = document.getElementById("code-ide-def-overlay");
		if (panel) panel.setAttribute("hidden", "hidden");
		$(document).off("keydown.aldefoverlay");
	}

	function showDefinitionOverlay(sourceEditor, model, selectionOrPosition) {
		var resolved = resolveDefinitionTarget(model, selectionOrPosition);
		model = (resolved && resolved.model) || model;
		var range = resolved && resolved.range;
		closeDefinitionOverlay();
		if (global.SlotSession && typeof SlotSession.open_type_definition === "function") {
			if (SlotSession.open_type_definition(model, range)) return;
		}
		showDefinitionOverlayFallback(sourceEditor, model, range);
	}

	function showDefinitionOverlayFallback(sourceEditor, model, range) {
		var host = document.getElementById("code-ide-main");
		if (!host) {
			try {
				host = sourceEditor.getContainerDomNode().parentElement;
			} catch (e) {
				host = document.body;
			}
		}
		var panel = document.getElementById("code-ide-def-overlay");
		if (!panel) {
			panel = document.createElement("div");
			panel.id = "code-ide-def-overlay";
			panel.innerHTML =
				'<div class="code-ide-def-head">' +
				'<span class="code-ide-def-title"></span>' +
				'<button type="button" class="code-ide-def-close" title="Close (Esc)" aria-label="Close">×</button>' +
				"</div>" +
				'<div class="code-ide-def-body"></div>';
			host.appendChild(panel);
			panel.querySelector(".code-ide-def-close").addEventListener("click", function (e) {
				e.preventDefault();
				closeDefinitionOverlay();
			});
		}
		var path = "";
		try {
			path = model.uri.path || model.uri.fsPath || String(model.uri);
		} catch (e) {
			path = String(model.uri);
		}
		if (path.charAt(0) === "/") path = path.slice(1);
		panel.querySelector(".code-ide-def-title").textContent = path || "AdventureLand types";
		panel.removeAttribute("hidden");

		var body = panel.querySelector(".code-ide-def-body");
		var prefs = load_prefs();
		if (!defOverlayEditor) {
			defOverlayEditor = monaco.editor.create(body, {
				model: model,
				readOnly: true,
				domReadOnly: true,
				minimap: { enabled: false },
				automaticLayout: true,
				scrollBeyondLastLine: false,
				fontFamily: prefs.fontFamily || EDITOR_FONT,
				fontSize: Math.max(12, (prefs.fontSize || 16) - 1),
				lineNumbers: "on",
				wordWrap: "on",
				renderLineHighlight: "none",
				folding: true,
				glyphMargin: false,
				padding: { top: 8, bottom: 8 },
				theme: prefs.theme || "vs-dark",
			});
		} else {
			defOverlayEditor.setModel(model);
			defOverlayEditor.updateOptions({
				fontFamily: prefs.fontFamily || EDITOR_FONT,
				fontSize: Math.max(12, (prefs.fontSize || 16) - 1),
			});
			if (prefs.theme) monaco.editor.setTheme(prefs.theme);
		}

		if (range) {
			defOverlayEditor.setSelection(range);
			defOverlayEditor.setPosition({
				lineNumber: range.startLineNumber,
				column: range.startColumn,
			});
			defOverlayEditor.revealLineNearTop(jsDocStartLine(model, range.startLineNumber));
		} else {
			defOverlayEditor.setPosition({ lineNumber: 1, column: 1 });
			defOverlayEditor.revealLine(1);
		}
		setTimeout(function () {
			defOverlayEditor.layout();
			defOverlayEditor.focus();
		}, 0);

		$(document)
			.off("keydown.aldefoverlay")
			.on("keydown.aldefoverlay", function (e) {
				if (e.key === "Escape") {
					closeDefinitionOverlay();
					try {
						sourceEditor.focus();
					} catch (err) {}
				}
			});
	}

	function normalizeSelectionRange(selectionOrPosition) {
		if (!selectionOrPosition) return null;
		if (typeof selectionOrPosition.startLineNumber === "number") return selectionOrPosition;
		if (typeof selectionOrPosition.lineNumber === "number") {
			return {
				startLineNumber: selectionOrPosition.lineNumber,
				startColumn: selectionOrPosition.column || 1,
				endLineNumber: selectionOrPosition.lineNumber,
				endColumn: (selectionOrPosition.column || 1) + 1,
			};
		}
		return null;
	}

	function isCommentishLine(model, lineNumber) {
		if (!model || lineNumber < 1) return false;
		var t = model.getLineContent(lineNumber).trim();
		if (!t) return true;
		if (t.indexOf("//") === 0) return true;
		if (t.indexOf("/*") === 0) return true;
		if (t.indexOf("*") === 0) return true;
		if (t.indexOf("*/") === 0) return true;
		return false;
	}

	/** Line where the contiguous JSDoc above `declLine` starts (or `declLine` if none). */
	function jsDocStartLine(model, declLine) {
		if (!model || !declLine || declLine < 2) return declLine || 1;
		var probe = declLine - 1;
		while (probe >= 1 && !model.getLineContent(probe).trim()) probe--;
		if (probe < 1) return declLine;
		if (model.getLineContent(probe).indexOf("*/") === -1) return declLine;
		while (probe >= 1) {
			var lt = model.getLineContent(probe).trim();
			if (lt.indexOf("/**") !== -1 || lt.indexOf("/*") === 0) return probe;
			if (lt.indexOf("*") === 0 || lt.indexOf("*/") !== -1) {
				probe--;
				continue;
			}
			break;
		}
		return declLine;
	}

	/**
	 * TS often returns a span inside `@example` / `{@link}` text for ambient d.ts.
	 * Prefer the real `function` / `interface` declaration when we can resolve the word.
	 */
	function resolveDefinitionTarget(model, selectionOrPosition) {
		var range = normalizeSelectionRange(selectionOrPosition);
		if (!model) return { model: model, range: range };
		var name = null;
		if (range) {
			var word = model.getWordAtPosition({
				lineNumber: range.startLineNumber,
				column: range.startColumn,
			});
			if (!word && range.endColumn) {
				word = model.getWordAtPosition({
					lineNumber: range.startLineNumber,
					column: Math.max(range.startColumn, Math.floor((range.startColumn + range.endColumn) / 2)),
				});
			}
			name = word && word.word;
		}
		if (name) {
			var hit = findSymbolInTypeModels(name);
			if (hit) {
				var landedInComment = range && isCommentishLine(model, range.startLineNumber);
				var differentDecl = !range || hit.model !== model || hit.range.startLineNumber !== range.startLineNumber || hit.range.startColumn !== range.startColumn;
				if (landedInComment || differentDecl) {
					return { model: hit.model, range: hit.range };
				}
			}
		}
		return { model: model, range: range };
	}

	function ensureDefinitionOpener() {
		if (definitionOpenerRegistered || !global.monaco || typeof monaco.editor.registerEditorOpener !== "function") return;
		definitionOpenerRegistered = true;
		monaco.editor.registerEditorOpener({
			openCodeEditor: function (source, resource, selectionOrPosition) {
				if (!isAdventureLandTypeUri(resource) && !(resource && resource.scheme === AL_TYPE_SCHEME)) return false;
				if (resource && resource.scheme === AL_TYPE_SCHEME) {
					return openAdventureLandSymbol(source, resource.path || resource.fsPath || resource.authority || "");
				}
				var model = monaco.editor.getModel(resource);
				if (!model) return false;
				showDefinitionOverlay(source, model, selectionOrPosition);
				return true;
			},
		});
	}

	function ensureTypeCommand() {
		if (typeCommandRegistered || !global.monaco || typeof monaco.editor.registerCommand !== "function") return;
		typeCommandRegistered = true;
		monaco.editor.registerCommand(OPEN_TYPE_CMD, function (_accessor, typeName) {
			openAdventureLandSymbol(hoverSourceEditor, typeName);
		});
	}

	function ensureLinkOpener() {
		ensureTypeCommand();
		if (linkOpenerRegistered || !global.monaco || typeof monaco.editor.registerLinkOpener !== "function") return;
		linkOpenerRegistered = true;
		monaco.editor.registerLinkOpener({
			open: function (resource) {
				if (!resource || resource.scheme !== AL_TYPE_SCHEME) return false;
				var name = resource.path || resource.fsPath || resource.authority || "";
				if (name.charAt(0) === "/") name = name.slice(1);
				return openAdventureLandSymbol(hoverSourceEditor, name);
			},
		});
	}

	function escapeRegExp(s) {
		return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}

	function findSymbolInTypeModels(symbolName) {
		if (!symbolName || !global.monaco) return null;
		var escaped = escapeRegExp(symbolName);
		var models = monaco.editor.getModels();
		// Declaration-only patterns — never match `@example get_nearest_monster(` in JSDoc.
		var patterns = [
			new RegExp("(?:^|\\n)\\s*(?:export\\s+)?interface\\s+" + escaped + "\\b"),
			new RegExp("(?:^|\\n)\\s*(?:export\\s+)?type\\s+" + escaped + "\\b"),
			new RegExp("(?:^|\\n)\\s*(?:export\\s+)?(?:declare\\s+)?(?:async\\s+)?(?:function|class|enum|const|var|let)\\s+" + escaped + "\\b"),
		];
		for (var i = 0; i < models.length; i++) {
			var model = models[i];
			var uri = String(model.uri);
			if (uri.indexOf("ts:adventureland/") === -1 && uri.indexOf("/adventureland/types/") === -1) continue;
			var text = model.getValue();
			for (var p = 0; p < patterns.length; p++) {
				var m = patterns[p].exec(text);
				if (!m) continue;
				var nameAt = m[0].indexOf(symbolName);
				var offset = m.index + (nameAt >= 0 ? nameAt : m[0].length - symbolName.length);
				var start = model.getPositionAt(Math.max(0, offset));
				if (isCommentishLine(model, start.lineNumber)) continue;
				var end = model.getPositionAt(Math.max(0, offset) + symbolName.length);
				return {
					model: model,
					range: {
						startLineNumber: start.lineNumber,
						startColumn: start.column,
						endLineNumber: end.lineNumber,
						endColumn: end.column,
					},
				};
			}
		}
		return null;
	}

	function openAdventureLandSymbol(sourceEditor, symbolName) {
		var name = String(symbolName || "")
			.replace(/^\//, "")
			.trim();
		if (!name) return false;
		var hit = findSymbolInTypeModels(name);
		if (!hit) {
			if (typeof global.add_log === "function") add_log("No declaration found for " + name, "#E06666");
			return true;
		}
		showDefinitionOverlay(sourceEditor, hit.model, hit.range);
		return true;
	}

	function displayPartsToText(parts) {
		if (!parts) return "";
		if (typeof parts === "string") return parts;
		var out = "";
		for (var i = 0; i < parts.length; i++) out += parts[i].text || "";
		return out;
	}

	/** Trusted command link — Monaco strips unknown schemes like al-type: in hover markdown. */
	function mdCommandLink(name, label) {
		var href = "command:" + OPEN_TYPE_CMD + "?" + encodeURIComponent(JSON.stringify([name]));
		return "[" + (label || name) + "](" + href + ")";
	}

	function mdTrusted(value) {
		return {
			value: value,
			isTrusted: { enabledCommands: [OPEN_TYPE_CMD] },
			supportThemeIcons: true,
		};
	}

	/** `{@link Foo}` / `{@link Foo|label}` → clickable command links. */
	function processInlineJsDoc(text) {
		return String(text || "").replace(/\{@link(?:code|plain)?\s+([^|}]+?)(?:\s*\|\s*([^}]+))?\}/g, function (_m, target, label) {
			var t = String(target || "")
				.trim()
				.split(/\s+/)[0]
				.replace(/[#.].*$/, "");
			var l = label ? String(label).trim() : t;
			if (!t) return l || "";
			if (HOVER_TYPE_SKIP[t]) return "`" + l + "`";
			if (!findSymbolInTypeModels(t)) return "`" + l + "`";
			return mdCommandLink(t, l);
		});
	}

	function collectLinkedTypeNames(signature, docs, tags) {
		var found = {};
		var order = [];
		function add(name) {
			if (!name || HOVER_TYPE_SKIP[name] || found[name]) return;
			if (!/^[A-Z][A-Za-z0-9_]*$/.test(name)) return;
			if (!findSymbolInTypeModels(name)) return;
			found[name] = 1;
			order.push(name);
		}
		var blob = signature + "\n" + docs;
		if (tags) {
			for (var i = 0; i < tags.length; i++) blob += "\n" + displayPartsToText(tags[i].text);
		}
		var re = /\b([A-Z][A-Za-z0-9_]*)\b/g;
		var m;
		while ((m = re.exec(blob))) add(m[1]);
		var linkRe = /\{@link(?:code|plain)?\s+([^\s|}]+)/g;
		while ((m = linkRe.exec(blob))) {
			add(
				String(m[1])
					.replace(/[#.].*$/, "")
					.trim(),
			);
		}
		return order;
	}

	/** Turn PascalCase types in a signature into command links (code fences aren't clickable). */
	function linkifySignature(signature, typeNames) {
		if (!signature) return "";
		var names = (typeNames || []).slice().sort(function (a, b) {
			return b.length - a.length;
		});
		var out = signature;
		for (var i = 0; i < names.length; i++) {
			var name = names[i];
			out = out.replace(new RegExp("\\b" + name + "\\b", "g"), mdCommandLink(name));
		}
		return out;
	}

	/**
	 * Format TS quick-info tags for Markdown hover.
	 * Fixes Monaco's tagToString which joins display parts with spaces and flattens @example.
	 */
	function formatJsDocTags(tags) {
		var params = [];
		var returns = "";
		var examples = [];
		var other = [];

		for (var i = 0; i < (tags || []).length; i++) {
			var tag = tags[i];
			if (!tag || !tag.name) continue;
			var name = tag.name;
			var parts = tag.text;
			var raw = processInlineJsDoc(displayPartsToText(parts));

			if (name === "param") {
				var paramName = "";
				var rest = "";
				if (Array.isArray(parts) && parts.length) {
					paramName = parts[0].text || "";
					rest = processInlineJsDoc(displayPartsToText(parts.slice(1)))
						.replace(/^\s*[—\-–:]\s*/, "")
						.replace(/^\s+/, "");
				} else {
					var pm = /^\s*(\S+)\s*(?:[—\-–:]\s*)?([\s\S]*)$/.exec(raw);
					if (pm) {
						paramName = pm[1];
						rest = pm[2];
					} else rest = raw;
				}
				rest = rest
					.replace(/\n\s*-\s+/g, "; ")
					.replace(/\n+/g, " ")
					.replace(/\s+/g, " ")
					.trim();
				// Avoid markdown list bullets — they mis-align next to inline code in Monaco hover.
				params.push("**" + paramName + "** — " + (rest || "_(no description)_"));
				continue;
			}

			if (name === "returns" || name === "return") {
				returns = raw.replace(/^\s+/, "");
				continue;
			}

			if (name === "example") {
				var code = raw.replace(/^\r?\n/, "").replace(/\s+$/, "");
				if (!code) continue;
				if (code.indexOf("```") !== -1) examples.push(code);
				else examples.push("```javascript\n" + code + "\n```");
				continue;
			}

			if (name === "deprecated") {
				other.push("> **Deprecated:** " + raw.replace(/^\s+/, ""));
				continue;
			}

			if (name === "see" || name === "seealso") {
				other.push("See also: " + raw.replace(/^\s+/, ""));
				continue;
			}

			other.push("**@" + name + "**" + (raw ? " — " + raw.replace(/^\s+/, "") : ""));
		}

		var sections = [];
		if (params.length) {
			sections.push("**Parameters**\n\n" + params.join("\n\n"));
		}
		if (returns) sections.push("**Returns** — " + returns);
		if (other.length) sections.push(other.join("\n\n"));
		if (examples.length) {
			sections.push("**Examples**\n\n" + examples.join("\n\n"));
		}
		return sections;
	}

	function buildHoverMarkdown(info) {
		var signature = displayPartsToText(info.displayParts);
		var rawDocs = displayPartsToText(info.documentation);
		var docs = processInlineJsDoc(rawDocs).replace(/^\s+|\s+$/g, "");
		var typeNames = collectLinkedTypeNames(signature, rawDocs, info.tags);

		var contents = [];
		if (signature) {
			// Linked signature (not a code fence) so type names are actually clickable.
			contents.push(mdTrusted(linkifySignature(signature, typeNames)));
		}
		if (docs) contents.push(mdTrusted(docs));

		var sections = formatJsDocTags(info.tags);
		for (var s = 0; s < sections.length; s++) {
			contents.push(mdTrusted(sections[s]));
		}
		return contents;
	}

	function textSpanToRange(model, span) {
		if (!span || typeof model.getPositionAt !== "function") return null;
		var p1 = model.getPositionAt(span.start);
		var p2 = model.getPositionAt(span.start + span.length);
		return {
			startLineNumber: p1.lineNumber,
			startColumn: p1.column,
			endLineNumber: p2.lineNumber,
			endColumn: p2.column,
		};
	}

	function ensureCustomHover() {
		if (customHoverRegistered || !global.monaco || !monaco.languages) return;
		var ts = tsLanguageApi();
		if (!ts || typeof ts.getJavaScriptWorker !== "function") return;
		customHoverRegistered = true;
		ensureTypeCommand();
		ensureLinkOpener();

		function provideHover(model, position) {
			try {
				var eds = monaco.editor.getEditors ? monaco.editor.getEditors() : [];
				for (var e = 0; e < (eds || []).length; e++) {
					if (eds[e].getModel && eds[e].getModel() === model) {
						hoverSourceEditor = eds[e];
						break;
					}
				}
			} catch (err) {}

			var getWorker = model.getLanguageId() === "typescript" && typeof ts.getTypeScriptWorker === "function" ? ts.getTypeScriptWorker : ts.getJavaScriptWorker;
			return getWorker()
				.then(function (workerGetter) {
					return workerGetter(model.uri);
				})
				.then(function (client) {
					var offset = model.getOffsetAt(position);
					return client.getQuickInfoAtPosition(model.uri.toString(), offset);
				})
				.then(function (info) {
					if (!info) return null;
					var contents = buildHoverMarkdown(info);
					if (!contents.length) return null;
					return {
						range: textSpanToRange(model, info.textSpan),
						contents: contents,
					};
				})
				.catch(function (err) {
					console.warn("[ALEditor] custom hover failed", err);
					return null;
				});
		}

		monaco.languages.registerHoverProvider("javascript", { provideHover: provideHover });
		monaco.languages.registerHoverProvider("typescript", { provideHover: provideHover });
	}

	/** Console helper: ALEditor.debugTypes() — paste results if hover still says `any`. */
	function debugTypes() {
		var ts = tsLanguageApi();
		var out = {
			hasMonaco: !!global.monaco,
			hasTs: !!(ts && ts.javascriptDefaults),
			tsApiPath: monaco.typescript ? "monaco.typescript" : monaco.languages && monaco.languages.typescript ? "monaco.languages.typescript" : null,
			bundleKeys: global.__AL_MONACO_TYPES__ ? Object.keys(global.__AL_MONACO_TYPES__) : [],
			typesRegistered: typesRegistered,
			models: [],
			extraLibs: null,
			compilerOptions: null,
			quickInfo: null,
			error: null,
		};
		if (!out.hasTs) {
			console.warn("[ALEditor.debugTypes]", out);
			return out;
		}
		try {
			var jsDefaults = ts.javascriptDefaults;
			out.compilerOptions = jsDefaults.getCompilerOptions ? jsDefaults.getCompilerOptions() : null;
			out.extraLibs = jsDefaults.getExtraLibs ? jsDefaults.getExtraLibs() : null;
			var models = monaco.editor.getModels();
			for (var i = 0; i < models.length; i++) {
				out.models.push({
					uri: String(models[i].uri),
					language: models[i].getLanguageId ? models[i].getLanguageId() : "",
					len: models[i].getValueLength ? models[i].getValueLength() : models[i].getValue().length,
				});
			}
		} catch (e) {
			out.error = String(e && e.message ? e.message : e);
		}

		var probe = "get_nearest_monster";
		var getWorker = ts.getJavaScriptWorker;
		if (typeof getWorker !== "function") {
			out.error = "getJavaScriptWorker missing on TS API";
			console.warn("[ALEditor.debugTypes]", out);
			return out;
		}
		return getWorker()
			.then(function (workerGetter) {
				var model = null;
				try {
					var editors = monaco.editor.getEditors ? monaco.editor.getEditors() : [];
					if (editors && editors.length && editors[0].getModel) model = editors[0].getModel();
				} catch (e) {}
				if (!model) {
					var allModels = monaco.editor.getModels();
					for (var m = 0; m < allModels.length; m++) {
						if (String(allModels[m].uri).indexOf("/slots/") !== -1) {
							model = allModels[m];
							break;
						}
					}
					if (!model && allModels.length) model = allModels[0];
				}
				if (!model) {
					out.error = "no model";
					console.warn("[ALEditor.debugTypes]", out);
					return out;
				}
				var text = model.getValue();
				var idx = text.indexOf(probe);
				if (idx < 0) {
					out.error = "string " + probe + " not found in active model — put the cursor on it or leave it in the file";
					console.warn("[ALEditor.debugTypes]", out);
					return out;
				}
				return workerGetter(model.uri).then(function (client) {
					return client.getQuickInfoAtPosition(model.uri.toString(), idx).then(function (info) {
						out.quickInfo = info;
						out.probeOffset = idx;
						out.modelUri = String(model.uri);
						console.log("[ALEditor.debugTypes]", out);
						return out;
					});
				});
			})
			.catch(function (err) {
				out.error = String(err && err.message ? err.message : err);
				console.warn("[ALEditor.debugTypes]", out);
				return out;
			});
	}

	function attachModelUri(editor) {
		// Give the buffer a path so JS language service treats it as a script with libs
		var model = editor.getModel();
		if (!model || !global.monaco) return;
		var want = global.monaco.Uri.parse("file:///adventureland/code.js");
		if (String(model.uri) === String(want)) return;
		var value = model.getValue();
		var next = global.monaco.editor.createModel(value, "javascript", want);
		editor.setModel(next);
		model.dispose();
	}

	function wordAtPosition(model, position) {
		var word = model.getWordAtPosition(position);
		if (!word) return "";
		return model.getValueInRange({
			startLineNumber: position.lineNumber,
			startColumn: word.startColumn,
			endLineNumber: position.lineNumber,
			endColumn: word.endColumn,
		});
	}

	function runBuiltin(ed, actionId) {
		var act = ed.getAction(actionId);
		if (act && act.isSupported()) act.run();
	}

	/**
	 * Essential IDE chords for in-game CODE. Standalone Monaco often lacks VS Code
	 * keybindings; bind those with addCommand (no extra Command Palette rows).
	 * Only AL-specific actions use addAction (palette + keybinding).
	 */
	function bindEditorShortcuts(editor) {
		var KeyMod = global.monaco.KeyMod;
		var KeyCode = global.monaco.KeyCode;

		function addAction(id, label, keys, run) {
			editor.addAction({
				id: id,
				label: label,
				keybindings: Array.isArray(keys) ? keys : [keys],
				run: run,
			});
		}

		function bindBuiltin(keys, actionId) {
			var list = Array.isArray(keys) ? keys : [keys];
			for (var i = 0; i < list.length; i++) {
				editor.addCommand(list[i], function () {
					runBuiltin(editor, actionId);
				});
			}
		}

		addAction("al-save-code", "Save Code Slot", KeyMod.CtrlCmd | KeyCode.KeyS, function () {
			if (global.SlotSession && typeof SlotSession.save_current === "function") {
				SlotSession.save_current();
				return;
			}
			if (typeof global.api_call === "function" && global.code_slot != null) {
				global.api_call("save_code", {
					code: editor.getValue(),
					slot: global.code_slot,
					name: (global.X && X.codes && X.codes[global.code_slot] && X.codes[global.code_slot][0]) || "",
					log: 1,
				});
			}
		});

		addAction("al-save-as", "Save Code As…", KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyS, function () {
			if (typeof global.api_call_l === "function") api_call_l("list_codes", { purpose: "save" });
			else if (typeof global.api_call === "function") api_call("list_codes", { purpose: "save" });
		});

		addAction("al-quick-open", "Go to Code Slot…", KeyMod.CtrlCmd | KeyCode.KeyP, function () {
			if (global.SlotSession && typeof SlotSession.quick_open === "function") SlotSession.quick_open();
		});

		addAction("al-toggle-run", "Play / Pause Script", KeyMod.CtrlCmd | KeyCode.Enter, function () {
			if (global.SlotSession && typeof SlotSession.toggle_play === "function") SlotSession.toggle_play();
			else if (typeof global.toggle_runner === "function") toggle_runner();
		});

		addAction("al-format-doc", "Format Document", KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyI, function (ed) {
			var model = ed.getModel && ed.getModel();
			if (!model) return;
			formatModelWithPrettier(model).catch(function (err) {
				console.warn("[ALEditor] format failed", err);
				runBuiltin(ed, "editor.action.formatDocument");
			});
		});

		// Builtins: keybindings only (Monaco already lists these in F1).
		bindBuiltin([KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyP, KeyCode.F1], "editor.action.quickCommand");
		bindBuiltin(KeyMod.CtrlCmd | KeyCode.KeyF, "actions.find");
		bindBuiltin(KeyMod.CtrlCmd | KeyCode.KeyH, "editor.action.startFindReplaceAction");
		bindBuiltin(KeyMod.CtrlCmd | KeyCode.KeyG, "editor.action.gotoLine");
		bindBuiltin(KeyMod.CtrlCmd | KeyCode.Slash, "editor.action.commentLine");
		bindBuiltin(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyA, "editor.action.blockComment");
		bindBuiltin(KeyMod.CtrlCmd | KeyCode.KeyD, "editor.action.addSelectionToNextFindMatch");
		bindBuiltin(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyL, "editor.action.selectHighlights");
		bindBuiltin(KeyMod.Alt | KeyCode.UpArrow, "editor.action.moveLinesUpAction");
		bindBuiltin(KeyMod.Alt | KeyCode.DownArrow, "editor.action.moveLinesDownAction");
		bindBuiltin(KeyMod.Alt | KeyMod.Shift | KeyCode.UpArrow, "editor.action.copyLinesUpAction");
		bindBuiltin(KeyMod.Alt | KeyMod.Shift | KeyCode.DownArrow, "editor.action.copyLinesDownAction");
		bindBuiltin(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyK, "editor.action.deleteLines");
		bindBuiltin(KeyMod.CtrlCmd | KeyCode.BracketRight, "editor.action.indentLines");
		bindBuiltin(KeyMod.CtrlCmd | KeyCode.BracketLeft, "editor.action.outdentLines");
	}

	/**
	 * @param {Function|HTMLElement} replaceOrHost - CM-style replaceFn(dom) or a host element
	 * @param {object} options
	 * @returns {object} ALEditor
	 */
	function create_editor(replaceOrHost, options) {
		options = options || {};
		if (!global.monaco) {
			throw new Error("monaco is not loaded");
		}
		ensureMonacoWorkers();
		if (options.intellisense !== false) registerAdventureLandTypes(true);
		ensurePrettierFormattingProvider();
		ensureSpellCodeActions();
		ensureEslintCodeActions();

		var host;
		if (typeof replaceOrHost === "function") {
			host = document.createElement("div");
			host.className = "monaco-editor-host al-editor";
			host.style.width = "100%";
			host.style.height = "100%";
			replaceOrHost(host);
		} else {
			host = replaceOrHost;
			if (hostEditors && hostEditors.get(host)) {
				hostEditors.get(host).dispose();
			}
		}

		var language = "javascript";
		if (options.language) language = options.language;
		else if (options.mode === "javascript" || !options.mode) language = "javascript";

		// Default to stock vs-dark until pixel theme is tuned; prefs / options.theme can override.
		var prefs = load_prefs();
		var themeName = options.theme || prefs.theme || "vs-dark";
		if (themeName === "pixel") ensureTheme();
		else ensureTheme(); // pixel available in settings even if not current

		var fontFamily = options.fontFamily || prefs.fontFamily || EDITOR_FONT;
		var fontSize = options.fontSize || prefs.fontSize || 16;

		var editor = global.monaco.editor.create(host, {
			value: options.value || "",
			language: language,
			theme: themeName,
			lineNumbers: options.lineNumbers === false ? "off" : "on",
			wordWrap: options.lineWrapping === false ? "off" : "on",
			tabSize: options.indentUnit || 4,
			insertSpaces: options.indentWithTabs === false,
			automaticLayout: options.automaticLayout !== false,
			minimap: { enabled: false },
			scrollBeyondLastLine: false,
			fontFamily: fontFamily,
			fontSize: fontSize,
			lineHeight: Math.max(18, Math.round(fontSize * 1.35)),
			letterSpacing: 0,
			fontLigatures: false,
			fontWeight: "400",
			padding: { top: 6, bottom: 6 },
			renderLineHighlight: "none",
			renderWhitespace: "none",
			guides: {
				indentation: false,
				bracketPairs: false,
			},
			overviewRulerLanes: 0,
			overviewRulerBorder: false,
			hideCursorInOverviewRuler: true,
			occurrencesHighlight: "off",
			selectionHighlight: false,
			matchBrackets: "near",
			cursorBlinking: "solid",
			cursorWidth: 2,
			smoothScrolling: false,
			mouseWheelZoom: true,
			fixedOverflowWidgets: true,
			scrollbar: {
				useShadows: false,
				verticalScrollbarSize: 10,
				horizontalScrollbarSize: 10,
				verticalHasArrows: false,
				horizontalHasArrows: false,
			},
			hover: {
				enabled: options.intellisense !== false,
				delay: 300,
				sticky: true,
			},
			quickSuggestions: options.intellisense !== false,
			suggestOnTriggerCharacters: options.intellisense !== false,
			parameterHints: { enabled: options.intellisense !== false },
			folding: false,
			glyphMargin: false,
			lineDecorationsWidth: 8,
			lineNumbersMinChars: 3,
			readOnly: false,
			domReadOnly: false,
			tabCompletion: "on",
			autoClosingBrackets: "languageDefined",
			autoIndent: "full",
			formatOnPaste: false,
			multiCursorModifier: "alt",
			wordBasedSuggestions: options.intellisense !== false ? "currentDocument" : "off",
			suggest: {
				showKeywords: true,
				showSnippets: true,
				showClasses: true,
				showFunctions: true,
				showVariables: true,
				showWords: true,
			},
		});

		if (typeof global.monaco.editor.setTabFocusMode === "function") {
			global.monaco.editor.setTabFocusMode(false);
		}

		bindEditorShortcuts(editor);

		editor.onDidChangeConfiguration(function () {
			var size = editor.getOption(global.monaco.editor.EditorOption.fontSize);
			var family = editor.getOption(global.monaco.editor.EditorOption.fontFamily);
			var cur = load_prefs();
			if (size === cur.fontSize && family === cur.fontFamily) return;
			cur.fontSize = size;
			cur.fontFamily = family;
			save_prefs(cur);
		});

		// SlotSession owns multi-slot models with stable URIs; skip one-shot attach here.
		// if (options.intellisense) attachModelUri(editor);

		var listeners = { change: [], cursorWord: [], cursorActivity: [] };
		var lastWord = "";

		editor.onDidChangeModelContent(function () {
			for (var i = 0; i < listeners.change.length; i++) listeners.change[i]();
		});

		function emitCursor() {
			var model = editor.getModel();
			var pos = editor.getPosition();
			var text = model && pos ? wordAtPosition(model, pos) : "";
			for (var i = 0; i < listeners.cursorActivity.length; i++) listeners.cursorActivity[i]();
			if (text !== lastWord) {
				lastWord = text;
				for (var j = 0; j < listeners.cursorWord.length; j++) listeners.cursorWord[j](text);
			}
		}
		editor.onDidChangeCursorPosition(emitCursor);
		editor.onDidChangeCursorSelection(emitCursor);

		var api = {
			_monaco: editor,
			_host: host,
			getValue: function () {
				return editor.getValue();
			},
			setValue: function (v) {
				editor.setValue(v == null ? "" : String(v));
			},
			focus: function () {
				editor.focus();
			},
			layout: function () {
				editor.layout();
			},
			refresh: function () {
				editor.layout();
			},
			clearHistory: function () {
				var model = editor.getModel();
				if (!model) return;
				var value = model.getValue();
				model.setValue("");
				model.setValue(value);
			},
			getWrapperElement: function () {
				return host;
			},
			dispose: function () {
				editor.dispose();
				if (hostEditors) hostEditors.delete(host);
			},
			on: function (event, handler) {
				if (event === "change") listeners.change.push(handler);
				else if (event === "cursorWord") listeners.cursorWord.push(handler);
				else if (event === "cursorActivity") listeners.cursorActivity.push(handler);
			},
			getCursor: function () {
				var p = editor.getPosition();
				return { line: p.lineNumber - 1, ch: p.column - 1 };
			},
			findWordAt: function (cursor) {
				var model = editor.getModel();
				var pos = { lineNumber: cursor.line + 1, column: cursor.ch + 1 };
				var word = model.getWordAtPosition(pos);
				if (!word) {
					return { anchor: cursor, head: cursor };
				}
				return {
					anchor: { line: cursor.line, ch: word.startColumn - 1 },
					head: { line: cursor.line, ch: word.endColumn - 1 },
				};
			},
			getRange: function (from, to) {
				var model = editor.getModel();
				return model.getValueInRange({
					startLineNumber: from.line + 1,
					startColumn: from.ch + 1,
					endLineNumber: to.line + 1,
					endColumn: to.ch + 1,
				});
			},
			getPrefs: function () {
				return load_prefs();
			},
			applyPrefs: function (partial) {
				var next = load_prefs();
				if (partial.theme && THEMES.indexOf(partial.theme) !== -1) next.theme = partial.theme;
				if (typeof partial.fontFamily === "string" && partial.fontFamily.trim()) next.fontFamily = partial.fontFamily.trim();
				if (typeof partial.fontSize === "number" && partial.fontSize >= 10 && partial.fontSize <= 32) next.fontSize = partial.fontSize;
				if (typeof partial.typeChecking === "boolean") next.typeChecking = partial.typeChecking;
				if (typeof partial.linting === "boolean") next.linting = partial.linting;
				if (typeof partial.spellCheck === "boolean") next.spellCheck = partial.spellCheck;
				if (partial.spellLanguages != null) next.spellLanguages = normalizeSpellLanguages(partial.spellLanguages);
				if (typeof partial.formatting === "boolean") next.formatting = partial.formatting;
				if (typeof partial.formatOnSave === "boolean") next.formatOnSave = partial.formatOnSave;
				if (partial.prettier && typeof partial.prettier === "object") {
					next.prettier = Object.assign({}, next.prettier, partial.prettier);
				}
				if (partial.eslintRules && typeof partial.eslintRules === "object" && !Array.isArray(partial.eslintRules)) {
					next.eslintRules = partial.eslintRules;
				}
				save_prefs(next);
				if (next.theme === "pixel") ensureTheme();
				global.monaco.editor.setTheme(next.theme);
				editor.updateOptions({
					fontFamily: next.fontFamily,
					fontSize: next.fontSize,
					lineHeight: Math.max(18, Math.round(next.fontSize * 1.35)),
					detectIndentation: false,
					tabSize: next.prettier && next.prettier.useTabs ? 4 : (next.prettier && next.prettier.tabWidth) || 4,
					insertSpaces: !(next.prettier && next.prettier.useTabs),
				});
				applyCheckJsFromPrefs(next);
				refreshAllDiagnostics();
				editor.layout();
				return next;
			},
			fixEslint: fixAllEslintForModel,
			attachModelDiagnostics: attachModelDiagnostics,
			scheduleModelDiagnostics: scheduleModelDiagnostics,
			refreshAllDiagnostics: refreshAllDiagnostics,
			addSpellWord: saveUserSpellWord,
			formatModel: formatModelWithPrettier,
			formatCode: formatCodeWithPrettier,
			themes: THEMES.slice(),
			defaultFont: EDITOR_FONT,
		};

		host.ALEditor = api;
		host.CodeMirror = api;
		if (hostEditors) hostEditors.set(host, api);
		return api;
	}

	function create_editor_fake(replaceOrHost, options) {
		options = options || {};
		var value = options.value || "";
		var api = {
			getValue: function () {
				return value;
			},
			setValue: function (v) {
				value = v == null ? "" : String(v);
			},
			focus: function () {},
			layout: function () {},
			refresh: function () {},
			clearHistory: function () {},
			getWrapperElement: function () {
				return document.createElement("div");
			},
			dispose: function () {},
			on: function () {},
			getCursor: function () {
				return { line: 0, ch: 0 };
			},
			findWordAt: function (c) {
				return { anchor: c, head: c };
			},
			getRange: function () {
				return "";
			},
		};
		if (typeof replaceOrHost === "function") {
			var host = document.createElement("div");
			host.ALEditor = api;
			host.CodeMirror = api;
			replaceOrHost(host);
		}
		return api;
	}

	global.create_editor = global.monaco ? create_editor : create_editor_fake;
	global.ALEditor = {
		create: global.create_editor,
		create_fake: create_editor_fake,
		registerTypes: registerAdventureLandTypes,
		debugTypes: debugTypes,
		attachModelDiagnostics: attachModelDiagnostics,
		scheduleModelDiagnostics: scheduleModelDiagnostics,
		refreshAllDiagnostics: refreshAllDiagnostics,
		addSpellWord: saveUserSpellWord,
		fixEslint: fixAllEslintForModel,
		applyCheckJsFromPrefs: applyCheckJsFromPrefs,
		formatModel: formatModelWithPrettier,
		formatCode: formatCodeWithPrettier,
		getPrefs: load_prefs,
	};

	if (global.monaco) {
		ensureMonacoWorkers();
		ensurePrettierFormattingProvider();
		// Register as early as possible so the first model sync already has ambient APIs.
		try {
			registerAdventureLandTypes();
			applyCheckJsFromPrefs(load_prefs());
		} catch (e) {
			console.warn("[ALEditor] early type registration failed", e);
		}
		try {
			ensureCustomHover();
			ensureSpellCodeActions();
			ensureEslintCodeActions();
		} catch (e) {
			console.warn("[ALEditor] custom hover setup failed", e);
		}
	} else {
		global.create_editor = create_editor_fake;
	}
})(typeof window !== "undefined" ? window : this);
