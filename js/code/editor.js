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
			"focusBorder": "#67D74C",
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

	// Crisp mono for Monaco glyphs; Pixel stays on explorer/chrome.
	var EDITOR_FONT = 'Consolas, "Cascadia Mono", "Segoe UI Mono", "Liberation Mono", Menlo, Monaco, monospace';

	function ensureTheme() {
		if (themeDefined || !global.monaco) return;
		global.monaco.editor.defineTheme("pixel", PIXEL_THEME);
		themeDefined = true;
	}

	function registerAdventureLandTypes() {
		if (typesRegistered || !global.monaco || !monaco.languages || !monaco.languages.typescript) return;
		typesRegistered = true;
		var ts = monaco.languages.typescript;
		ts.javascriptDefaults.setDiagnosticsOptions({
			noSemanticValidation: false,
			noSyntaxValidation: false,
		});
		ts.javascriptDefaults.setCompilerOptions({
			allowNonTsExtensions: true,
			checkJs: true,
			target: ts.ScriptTarget.ESNext,
		});
		var files = ["/js/monaco/types/adventureland.d.ts", "/js/monaco/types/g-catalog.d.ts"];
		for (var i = 0; i < files.length; i++) {
			(function (url) {
				fetch(url)
					.then(function (r) {
						return r.ok ? r.text() : "";
					})
					.then(function (src) {
						if (!src) return;
						ts.javascriptDefaults.addExtraLib(src, "file://" + url);
					})
					.catch(function () {});
			})(files[i]);
		}
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
		ensureTheme();
		if (options.intellisense) registerAdventureLandTypes();

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

		var editor = global.monaco.editor.create(host, {
			value: options.value || "",
			language: language,
			theme: options.theme === "pixel" || !options.theme ? "pixel" : options.theme,
			lineNumbers: options.lineNumbers === false ? "off" : "on",
			wordWrap: options.lineWrapping === false ? "off" : "on",
			tabSize: options.indentUnit || 4,
			insertSpaces: options.indentWithTabs === false,
			automaticLayout: options.automaticLayout !== false,
			minimap: { enabled: false },
			scrollBeyondLastLine: false,
			fontFamily: EDITOR_FONT,
			fontSize: 16,
			lineHeight: 22,
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
			mouseWheelZoom: false,
			fixedOverflowWidgets: true,
			scrollbar: {
				useShadows: false,
				verticalScrollbarSize: 10,
				horizontalScrollbarSize: 10,
				verticalHasArrows: false,
				horizontalHasArrows: false,
			},
			hover: {
				enabled: !!options.intellisense,
				delay: 400,
			},
			quickSuggestions: !!options.intellisense,
			suggestOnTriggerCharacters: !!options.intellisense,
			parameterHints: { enabled: !!options.intellisense },
			folding: false,
			glyphMargin: false,
			lineDecorationsWidth: 8,
			lineNumbersMinChars: 3,
		});

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
	global.ALEditor = { create: global.create_editor, create_fake: create_editor_fake };

	if (!global.monaco) {
		global.create_editor = create_editor_fake;
	}
})(typeof window !== "undefined" ? window : this);
