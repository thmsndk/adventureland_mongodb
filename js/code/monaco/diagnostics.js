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
	/** model -> decoration ids for full-word spell underlines (Hint markers are clamped to 2 cols). */
	var spellUnderlineIds = typeof WeakMap !== "undefined" ? new WeakMap() : null;
	var SPELL_USER_KEY = "al_code_spell_user_words";
	var DIAG_DEBOUNCE_MS = 350;
	var AL_TYPE_SCHEME = "al-type";

	/** Skip lint/spell for ambient type libs (player CODE only). */
	function isTypeLibUri(uri) {
		var s = String(uri || "");
		return (
			s.indexOf("ts:adventureland/") === 0 ||
			s.indexOf("ts:al-types-augment/") === 0 ||
			s.indexOf(AL_TYPE_SCHEME + ":") === 0 ||
			s.indexOf("/adventureland/types/") !== -1 ||
			s.indexOf("/adventureland/types-augment/") !== -1 ||
			/\.d\.ts(?:$|\?)/i.test(s)
		);
	}

	/**
	 * Player slot / character scripts only.
	 * Excludes type libs and the synthetic `file:///adventureland/_standalone_host.js`
	 * model used by ALEditor.create for non-CODE hosts (snippets/docs/etc.).
	 */
	function isPlayerCodeModel(model) {
		if (!model) return false;
		if (isTypeLibUri(model.uri)) return false;
		var s = String(model.uri || "");
		if (s.indexOf("_standalone_host") !== -1) return false;
		if (s.indexOf("/adventureland/slots/") === -1 && s.indexOf("/adventureland/characters/") === -1) return false;
		var lang = model.getLanguageId ? model.getLanguageId() : "";
		return lang === "javascript";
	}
	var formatProviderDisposable = null;
	var spellActionDisposable = null;
	var spellHoverDisposable = null;
	var eslintActionDisposable = null;
	var spellCommandRegistered = false;
	var eslintCommandRegistered = false;
	/** model uri string -> last cspell marker fingerprint (skip no-op setModelMarkers). */
	var spellMarkerFp = typeof Map !== "undefined" ? new Map() : null;
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
		eslintActionDisposable = monaco.languages.registerCodeActionProvider(
			"javascript",
			{
				provideCodeActions: function (model, range, context) {
					var actions = [];
					var markers = markersForCodeActions(model, range, context, "eslint");
					var uri = String(model.uri);
					var sawFixable = false;
					for (var i = 0; i < markers.length; i++) {
						var mk = markers[i];
						if (!markerSourceIs(mk, "eslint")) continue;
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
							return markerSourceIs(m, "eslint");
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
			},
			{ providedCodeActionKinds: ["quickfix", "quickfix.source.fixAll"] },
		);
	}

	function spellWordFromMarker(model, mk) {
		var word = "";
		var mm = String((mk && mk.message) || "").match(/^"([^"]+)"/);
		if (mm) word = mm[1];
		if (!word && model && mk && mk.startLineNumber) {
			try {
				word = model.getValueInRange({
					startLineNumber: mk.startLineNumber,
					startColumn: mk.startColumn,
					endLineNumber: mk.endLineNumber,
					endColumn: mk.endColumn,
				});
			} catch (e) {
				word = "";
			}
		}
		return String(word || "").trim();
	}

	/** Marker belongs to lint/spell owner (setModelMarkers owner and/or IMarkerData.source). */
	function markerSourceIs(mk, source) {
		if (!mk) return false;
		var src = String(mk.source || "");
		var owner = String(mk.owner || "");
		return src === source || owner === source;
	}

	/**
	 * Monaco standalone injects context.markers for intersecting diagnostics only.
	 * Stock lightbulb may sit on the next empty line; includeNearbyQuickFixes + same-line /
	 * adjacent-line fallback keeps Add-to-dictionary available when the selection moves.
	 */
	function markersForCodeActions(model, range, context, source) {
		var out = [];
		var seen = Object.create(null);
		function push(mk) {
			if (!markerSourceIs(mk, source)) return;
			var key = [mk.startLineNumber, mk.startColumn, mk.endLineNumber, mk.endColumn, mk.message || ""].join(":");
			if (seen[key]) return;
			seen[key] = 1;
			out.push(mk);
		}
		var fromCtx = context && context.markers ? context.markers : [];
		for (var i = 0; i < fromCtx.length; i++) push(fromCtx[i]);
		if (!model || !monaco.editor.getModelMarkers) return out;
		var all = monaco.editor.getModelMarkers({ resource: model.uri }) || [];
		var selStart = range && range.startLineNumber != null ? range.startLineNumber : 0;
		var selEnd = range && range.endLineNumber != null ? range.endLineNumber : selStart;
		var selStartCol = range && range.startColumn != null ? range.startColumn : 1;
		var selEndCol = range && range.endColumn != null ? range.endColumn : selStartCol;
		var lineEmpty = false;
		try {
			lineEmpty = selStart > 0 && /^\s*$/.test(model.getLineContent(selStart));
		} catch (e0) {
			lineEmpty = false;
		}
		for (var j = 0; j < all.length; j++) {
			var mk = all[j];
			if (!markerSourceIs(mk, source)) continue;
			var mkEndLine = mk.endLineNumber || mk.startLineNumber;
			var overlapsLine = mk.startLineNumber <= selEnd && mkEndLine >= selStart;
			var overlapsCol = overlapsLine && !(mkEndLine === selStart && mk.endColumn < selStartCol) && !(mk.startLineNumber === selEnd && mk.startColumn > selEndCol);
			var adjacentForEmpty = lineEmpty && (mk.startLineNumber === selStart - 1 || mkEndLine === selStart - 1 || mk.startLineNumber === selStart + 1);
			if (overlapsCol || overlapsLine || adjacentForEmpty) push(mk);
		}
		return out;
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
		if (!spellActionDisposable) {
			spellActionDisposable = monaco.languages.registerCodeActionProvider(
				"javascript",
				{
					provideCodeActions: function (model, range, context) {
						var actions = [];
						var markers = markersForCodeActions(model, range, context, "cspell");
						for (var i = 0; i < markers.length; i++) {
							var mk = markers[i];
							var word = spellWordFromMarker(model, mk);
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
				},
				{ providedCodeActionKinds: ["quickfix"] },
			);
		}
		if (!spellHoverDisposable && monaco.languages && typeof monaco.languages.registerHoverProvider === "function") {
			spellHoverDisposable = monaco.languages.registerHoverProvider("javascript", {
				provideHover: function (model, position) {
					if (!model || !position || !monaco.editor.getModelMarkers) return null;
					var markers = monaco.editor.getModelMarkers({ resource: model.uri, owner: "cspell" }) || [];
					var hit = null;
					for (var i = 0; i < markers.length; i++) {
						var mk = markers[i];
						if (!mk) continue;
						if (position.lineNumber < mk.startLineNumber || position.lineNumber > mk.endLineNumber) continue;
						if (position.lineNumber === mk.startLineNumber && position.column < mk.startColumn) continue;
						if (position.lineNumber === mk.endLineNumber && position.column > mk.endColumn) continue;
						hit = mk;
						break;
					}
					if (!hit) return null;
					var word = spellWordFromMarker(model, hit);
					if (!word) return null;
					return {
						range: {
							startLineNumber: hit.startLineNumber,
							startColumn: hit.startColumn,
							endLineNumber: hit.endLineNumber,
							endColumn: hit.endColumn,
						},
						contents: [{ value: "**Spelling:** `" + word + "`" }, { value: "Unknown word. Use **Quick Fix** (lightbulb / `Shift+Alt+.`): *Add to user dictionary*." }],
					};
				},
			});
		}
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
				diagnosticCodesToIgnore: [1108, 7006, 7016, 7043, 7044, 80001, 2300, 2451],
			});
		}
	}

	function clearOwnerMarkers(model, owner) {
		if (!global.monaco || !model) return;
		try {
			monaco.editor.setModelMarkers(model, owner, []);
		} catch (e) {}
		if (owner === "cspell") {
			clearSpellUnderlines(model);
			try {
				if (spellMarkerFp) spellMarkerFp.delete(String(model.uri));
			} catch (e2) {}
			notifySpellPanelBadge();
		}
	}

	/** Keep Spell Checker trees + tab badge in sync (Markers ActivityUpdater equivalent). */
	function notifySpellPanelBadge() {
		try {
			var api = global.ALVscodeApi;
			if (api && typeof api.refreshSpellDiagnostics === "function") {
				api.refreshSpellDiagnostics();
				return;
			}
			if (api && typeof api.syncSpellPanelBadge === "function") api.syncSpellPanelBadge();
		} catch (e) {}
	}

	function installModelCreateHook() {
		if (!global.monaco || !monaco.editor || typeof monaco.editor.onDidCreateModel !== "function") return;
		if (monaco.editor.__alDiagCreateHook) return;
		monaco.editor.__alDiagCreateHook = true;
		monaco.editor.onDidCreateModel(function (model) {
			attachModelDiagnostics(model);
		});
		var models = monaco.editor.getModels();
		for (var i = 0; i < models.length; i++) attachModelDiagnostics(models[i]);
	}

	function fingerprintSpellMarkers(markers) {
		var parts = [];
		for (var i = 0; i < markers.length; i++) {
			var m = markers[i];
			if (!m) continue;
			parts.push([m.startLineNumber, m.startColumn, m.endLineNumber, m.endColumn, m.message || ""].join(":"));
		}
		parts.sort();
		return parts.join("|");
	}

	/**
	 * Monaco clamps MarkerSeverity.Hint decorations to startColumn+2, so Hint squiggles
	 * never cover the whole word. Keep Hint markers for Spell Checker / Problems exclusion,
	 * and paint full-range underlines with deltaDecorations.
	 */
	function clearSpellUnderlines(model) {
		if (!model || !spellUnderlineIds) return;
		var prev = spellUnderlineIds.get(model) || [];
		try {
			spellUnderlineIds.set(model, model.deltaDecorations(prev, []));
		} catch (e) {}
	}

	function setSpellUnderlines(model, ranges) {
		if (!model || !global.monaco) return;
		var OverviewRulerLane = monaco.editor.OverviewRulerLane;
		var next = [];
		for (var i = 0; i < ranges.length; i++) {
			var m = ranges[i];
			if (!m) continue;
			var opts = {
				description: "al-cspell-underline",
				// Match streetsidesoftware cSpell custom decorations: inline text-decoration
				// (Hint marker squiggles stay clamped to 2 cols; we blank their paint via CSS).
				inlineClassName: "al-spell-squiggle",
				inlineClassNameAffectsLetterSpacing: false,
				stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
				// Above current-line / selection chrome so underlines do not vanish under the caret.
				zIndex: 10,
			};
			if (OverviewRulerLane != null) {
				opts.overviewRuler = {
					color: "rgba(55, 148, 255, 0.5)",
					position: OverviewRulerLane.Right,
				};
			}
			next.push({
				range: new monaco.Range(m.startLineNumber, m.startColumn, m.endLineNumber || m.startLineNumber, m.endColumn),
				options: opts,
			});
		}
		if (!spellUnderlineIds) {
			try {
				model.deltaDecorations([], next);
			} catch (e0) {}
			return;
		}
		var prev = spellUnderlineIds.get(model) || [];
		try {
			spellUnderlineIds.set(model, model.deltaDecorations(prev, next));
		} catch (e1) {}
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
		if (!isPlayerCodeModel(model)) {
			clearOwnerMarkers(model, "eslint");
			return;
		}
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
		if (!isPlayerCodeModel(model)) {
			clearOwnerMarkers(model, "cspell");
			return;
		}
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
								// Hint: excluded from Problems panel + status counts (Error/Warning/Info only).
								// Squiggles still show; status bar "Spell" entry tracks these separately.
								severity: monaco.MarkerSeverity.Hint,
								message: m.message,
								source: "cspell",
								code: "unknownWord",
								startLineNumber: m.startLineNumber,
								startColumn: m.startColumn,
								endLineNumber: m.endLineNumber,
								endColumn: m.endColumn,
							};
						});
						var fp = fingerprintSpellMarkers(mapped);
						var uriKey = String(model.uri);
						if (spellMarkerFp && spellMarkerFp.get(uriKey) === fp) {
							// Markers unchanged — re-assert underlines (caret moves can leave stale ids)
							// and refresh tab badge (panel may have mounted after first set).
							setSpellUnderlines(model, mapped);
							notifySpellPanelBadge();
							return;
						}
						if (spellMarkerFp) spellMarkerFp.set(uriKey, fp);
						monaco.editor.setModelMarkers(model, "cspell", mapped);
						// Hint decorations are clamped to 2 columns — paint full-word underlines separately.
						setSpellUnderlines(model, mapped);
						notifySpellPanelBadge();
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
		if (!isPlayerCodeModel(model)) return;
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
			if (!isPlayerCodeModel(m)) {
				clearOwnerMarkers(m, "eslint");
				clearOwnerMarkers(m, "cspell");
				continue;
			}
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
	installModelCreateHook();
})(typeof window !== "undefined" ? window : globalThis);
