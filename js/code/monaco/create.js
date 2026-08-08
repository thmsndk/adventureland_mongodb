/**
 * Monaco editor factory (+fake) and boot init.
 */
(function (global) {
	"use strict";

	var ALEditor = global.ALEditor || (global.ALEditor = {});

	var hostEditors = typeof WeakMap !== "undefined" ? new WeakMap() : null;

	function ensureMonacoWorkers() {
		if (!global.monaco || global.__AL_MONACO_WORKERS_READY__) return;
		global.__AL_MONACO_WORKERS_READY__ = true;
		var version = global.MONACO_VERSION || "vscode-api";
		var origin = "";
		try {
			origin = global.location && global.location.origin ? global.location.origin : "";
		} catch (e) {}
		var base = origin + "/js/monaco/vscode-api/";
		if (String(version).indexOf("0.") === 0) {
			base = origin + "/js/monaco/" + version + "/";
		}

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

	function create_editor(replaceOrHost, options) {
		options = options || {};
		if (!global.monaco) {
			throw new Error("monaco is not loaded");
		}
		ensureMonacoWorkers();
		if (options.intellisense !== false) ALEditor.registerTypes(true);
		ALEditor.ensurePrettierFormattingProvider();
		ALEditor.ensureSpellCodeActions();
		ALEditor.ensureEslintCodeActions();

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
		var prefs = ALEditor.load_prefs();
		var themeName = options.theme || prefs.theme || "vs-dark";
		if (themeName === "pixel") ALEditor.ensureTheme();
		else ALEditor.ensureTheme(); // pixel available in settings even if not current

		var fontFamily = options.fontFamily || prefs.fontFamily || ALEditor.defaultFont;
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

		ALEditor.bindEditorShortcuts(editor);

		editor.onDidChangeConfiguration(function () {
			var size = editor.getOption(global.monaco.editor.EditorOption.fontSize);
			var family = editor.getOption(global.monaco.editor.EditorOption.fontFamily);
			var cur = ALEditor.load_prefs();
			if (size === cur.fontSize && family === cur.fontFamily) return;
			cur.fontSize = size;
			cur.fontFamily = family;
			ALEditor.save_prefs(cur);
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
				return ALEditor.load_prefs();
			},
			applyPrefs: function (partial) {
				var next = ALEditor.load_prefs();
				if (partial.theme && ALEditor.themes.indexOf(partial.theme) !== -1) next.theme = partial.theme;
				if (typeof partial.fontFamily === "string" && partial.fontFamily.trim()) next.fontFamily = partial.fontFamily.trim();
				if (typeof partial.fontSize === "number" && partial.fontSize >= 10 && partial.fontSize <= 32) next.fontSize = partial.fontSize;
				if (typeof partial.typeChecking === "boolean") next.typeChecking = partial.typeChecking;
				if (typeof partial.linting === "boolean") next.linting = partial.linting;
				if (typeof partial.spellCheck === "boolean") next.spellCheck = partial.spellCheck;
				if (partial.spellLanguages != null && typeof ALEditor.load_prefs === "function") {
					var prefsTmp = ALEditor.load_prefs();
					// normalize via re-save through applyPrefs path in settings.temp
					next.spellLanguages = Array.isArray(partial.spellLanguages) ? partial.spellLanguages : prefsTmp.spellLanguages;
				}
				if (typeof partial.formatting === "boolean") next.formatting = partial.formatting;
				if (typeof partial.formatOnSave === "boolean") next.formatOnSave = partial.formatOnSave;
				if (partial.prettier && typeof partial.prettier === "object") {
					next.prettier = Object.assign({}, next.prettier, partial.prettier);
				}
				if (partial.eslintRules && typeof partial.eslintRules === "object" && !Array.isArray(partial.eslintRules)) {
					next.eslintRules = partial.eslintRules;
				}
				ALEditor.save_prefs(next);
				if (next.theme === "pixel") ALEditor.ensureTheme();
				global.monaco.editor.setTheme(next.theme);
				editor.updateOptions({
					fontFamily: next.fontFamily,
					fontSize: next.fontSize,
					lineHeight: Math.max(18, Math.round(next.fontSize * 1.35)),
					detectIndentation: false,
					tabSize: next.prettier && next.prettier.useTabs ? 4 : (next.prettier && next.prettier.tabWidth) || 4,
					insertSpaces: !(next.prettier && next.prettier.useTabs),
				});
				ALEditor.applyCheckJsFromPrefs(next);
				ALEditor.refreshAllDiagnostics();
				editor.layout();
				return next;
			},
			fixEslint: function (model) {
				return ALEditor.fixEslint(model);
			},
			attachModelDiagnostics: function (model) {
				return ALEditor.attachModelDiagnostics(model);
			},
			scheduleModelDiagnostics: function (model) {
				return ALEditor.scheduleModelDiagnostics(model);
			},
			refreshAllDiagnostics: function () {
				return ALEditor.refreshAllDiagnostics();
			},
			addSpellWord: function (word) {
				return ALEditor.addSpellWord(word);
			},
			formatModel: function (model) {
				return ALEditor.formatModel(model);
			},
			formatCode: function (code, opts) {
				return ALEditor.formatCode(code, opts);
			},
			themes: (ALEditor.themes || ["vs-dark", "vs", "hc-black", "pixel"]).slice(),
			defaultFont: ALEditor.defaultFont,
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
	Object.assign(ALEditor, {
		create: global.create_editor,
		create_fake: create_editor_fake,
	});

	if (global.monaco) {
		bootAlEditor();
	} else if (global.ALVscodeApiReady && typeof global.ALVscodeApiReady.then === "function") {
		global.ALVscodeApiReady.then(function () {
			bootAlEditor();
		}).catch(function () {
			global.create_editor = create_editor_fake;
			ALEditor.create = create_editor_fake;
		});
	} else {
		global.create_editor = create_editor_fake;
		ALEditor.create = create_editor_fake;
	}

	function bootAlEditor() {
		try {
			ensureMonacoWorkers();
		} catch (e) {}
		try {
			if (ALEditor.ensurePrettierFormattingProvider) ALEditor.ensurePrettierFormattingProvider();
		} catch (e) {}
		try {
			if (ALEditor.registerTypes) ALEditor.registerTypes();
		} catch (e) {}
		try {
			if (ALEditor.applyCheckJsFromPrefs && ALEditor.load_prefs) ALEditor.applyCheckJsFromPrefs(ALEditor.load_prefs());
		} catch (e) {}
		try {
			if (ALEditor.ensureCustomHover) ALEditor.ensureCustomHover();
		} catch (e) {}
		try {
			if (ALEditor.ensureSpellCodeActions) ALEditor.ensureSpellCodeActions();
		} catch (e) {}
		try {
			if (ALEditor.ensureEslintCodeActions) ALEditor.ensureEslintCodeActions();
		} catch (e) {}
		global.create_editor = create_editor;
		ALEditor.create = create_editor;
	}
})(typeof window !== "undefined" ? window : globalThis);
