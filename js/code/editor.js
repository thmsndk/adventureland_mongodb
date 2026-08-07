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
	var PREFS_KEY = "al_code_editor_prefs";
	var THEMES = ["vs-dark", "vs", "hc-black", "pixel"];

	function ensureTheme() {
		if (themeDefined || !global.monaco) return;
		global.monaco.editor.defineTheme("pixel", PIXEL_THEME);
		themeDefined = true;
	}

	function load_prefs() {
		var defaults = { theme: "vs-dark", fontFamily: EDITOR_FONT, fontSize: 16 };
		try {
			var raw = localStorage.getItem(PREFS_KEY);
			if (!raw) return defaults;
			var p = JSON.parse(raw);
			return {
				theme: THEMES.indexOf(p.theme) !== -1 ? p.theme : defaults.theme,
				fontFamily: typeof p.fontFamily === "string" && p.fontFamily.trim() ? p.fontFamily : defaults.fontFamily,
				fontSize: typeof p.fontSize === "number" && p.fontSize >= 10 && p.fontSize <= 32 ? p.fontSize : defaults.fontSize,
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

	function registerAdventureLandTypes() {
		if (typesRegistered || !global.monaco) return;
		if (!monaco.languages || !monaco.languages.typescript) {
			console.warn("[ALEditor] monaco.languages.typescript missing — ts.worker not available");
			return;
		}
		var ts = monaco.languages.typescript;
		var libs = global.__AL_MONACO_TYPES__;
		if (!libs) {
			console.warn("[ALEditor] IntelliSense libs missing — load /js/monaco/types/bundle.js before editor.js");
			return;
		}
		typesRegistered = true;
		ts.javascriptDefaults.setDiagnosticsOptions({
			noSemanticValidation: false,
			noSyntaxValidation: false,
			diagnosticCodesToIgnore: [1108], // top-level return in scripts
		});
		ts.javascriptDefaults.setCompilerOptions({
			allowNonTsExtensions: true,
			allowJs: true,
			checkJs: true,
			noLib: false,
			target: ts.ScriptTarget.ESNext,
			module: ts.ModuleKind.ESNext,
			lib: ["es2020", "dom"],
		});
		var names = Object.keys(libs);
		for (var i = 0; i < names.length; i++) {
			var name = names[i];
			// Stable in-memory URI so the TS worker keeps libs attached
			ts.javascriptDefaults.addExtraLib(libs[name], "ts:adventureland/" + name);
		}
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
	 * Essential IDE chords for in-game CODE. Standalone Monaco is not VS Code —
	 * many chords are missing unless we bind them. Ctrl/Cmd+P opens slot picker.
	 */
	function bindEditorShortcuts(editor) {
		var KeyMod = global.monaco.KeyMod;
		var KeyCode = global.monaco.KeyCode;

		function add(id, label, keys, run) {
			editor.addAction({
				id: id,
				label: label,
				keybindings: Array.isArray(keys) ? keys : [keys],
				run: run,
			});
		}

		add("al-save-code", "Save Code Slot", KeyMod.CtrlCmd | KeyCode.KeyS, function () {
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

		add("al-save-as", "Save Code As…", KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyS, function () {
			if (typeof global.api_call_l === "function") api_call_l("list_codes", { purpose: "save" });
			else if (typeof global.api_call === "function") api_call("list_codes", { purpose: "save" });
		});

		add("al-quick-open", "Go to Code Slot…", KeyMod.CtrlCmd | KeyCode.KeyP, function () {
			if (global.SlotSession && typeof SlotSession.quick_open === "function") SlotSession.quick_open();
		});

		add("al-command-palette", "Command Palette", [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyP, KeyCode.F1], function (ed) {
			runBuiltin(ed, "editor.action.quickCommand");
		});

		add("al-find", "Find", KeyMod.CtrlCmd | KeyCode.KeyF, function (ed) {
			runBuiltin(ed, "actions.find");
		});

		add("al-replace", "Replace", KeyMod.CtrlCmd | KeyCode.KeyH, function (ed) {
			runBuiltin(ed, "editor.action.startFindReplaceAction");
		});

		add("al-goto-line", "Go to Line/Column…", KeyMod.CtrlCmd | KeyCode.KeyG, function (ed) {
			runBuiltin(ed, "editor.action.gotoLine");
		});

		add("al-comment-line", "Toggle Line Comment", KeyMod.CtrlCmd | KeyCode.Slash, function (ed) {
			runBuiltin(ed, "editor.action.commentLine");
		});

		add("al-block-comment", "Toggle Block Comment", KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyA, function (ed) {
			runBuiltin(ed, "editor.action.blockComment");
		});

		add("al-add-next", "Add Selection To Next Find Match", KeyMod.CtrlCmd | KeyCode.KeyD, function (ed) {
			runBuiltin(ed, "editor.action.addSelectionToNextFindMatch");
		});

		add("al-select-all-matches", "Select All Occurrences", KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyL, function (ed) {
			runBuiltin(ed, "editor.action.selectHighlights");
		});

		add("al-move-line-up", "Move Line Up", KeyMod.Alt | KeyCode.UpArrow, function (ed) {
			runBuiltin(ed, "editor.action.moveLinesUpAction");
		});

		add("al-move-line-down", "Move Line Down", KeyMod.Alt | KeyCode.DownArrow, function (ed) {
			runBuiltin(ed, "editor.action.moveLinesDownAction");
		});

		add("al-copy-line-up", "Copy Line Up", KeyMod.Alt | KeyMod.Shift | KeyCode.UpArrow, function (ed) {
			runBuiltin(ed, "editor.action.copyLinesUpAction");
		});

		add("al-copy-line-down", "Copy Line Down", KeyMod.Alt | KeyMod.Shift | KeyCode.DownArrow, function (ed) {
			runBuiltin(ed, "editor.action.copyLinesDownAction");
		});

		add("al-delete-line", "Delete Line", KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyK, function (ed) {
			runBuiltin(ed, "editor.action.deleteLines");
		});

		add("al-indent", "Indent Line", KeyMod.CtrlCmd | KeyCode.BracketRight, function (ed) {
			runBuiltin(ed, "editor.action.indentLines");
		});

		add("al-outdent", "Outdent Line", KeyMod.CtrlCmd | KeyCode.BracketLeft, function (ed) {
			runBuiltin(ed, "editor.action.outdentLines");
		});

		add("al-format-doc", "Format Document", KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyI, function (ed) {
			runBuiltin(ed, "editor.action.formatDocument");
		});

		add("al-toggle-run", "Play / Pause Script", KeyMod.CtrlCmd | KeyCode.Enter, function () {
			if (global.SlotSession && typeof SlotSession.toggle_play === "function") SlotSession.toggle_play();
			else if (typeof global.toggle_runner === "function") toggle_runner();
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
			readOnly: false,
			domReadOnly: false,
			tabCompletion: "on",
			autoClosingBrackets: "languageDefined",
			autoIndent: "full",
			formatOnPaste: false,
			multiCursorModifier: "alt",
			wordBasedSuggestions: options.intellisense ? "currentDocument" : "off",
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
				save_prefs(next);
				if (next.theme === "pixel") ensureTheme();
				global.monaco.editor.setTheme(next.theme);
				editor.updateOptions({
					fontFamily: next.fontFamily,
					fontSize: next.fontSize,
					lineHeight: Math.max(18, Math.round(next.fontSize * 1.35)),
				});
				editor.layout();
				return next;
			},
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
	global.ALEditor = { create: global.create_editor, create_fake: create_editor_fake };

	if (!global.monaco) {
		global.create_editor = create_editor_fake;
	}
})(typeof window !== "undefined" ? window : this);
