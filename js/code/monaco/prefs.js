/**
 * Durable Monaco prefs / theme / AL keybinds (lint-spell-format). VS Code Settings UI via ALVscodeApi.
 */
(function (global) {
	"use strict";

	function formatModelWithPrettier(model) {
		if (global.ALEditor && typeof ALEditor.formatModel === "function") return ALEditor.formatModel(model);
	}

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

	function applyPrefs(prefs) {
		if (!prefs) prefs = load_prefs();
		save_prefs(prefs);
		if (prefs.theme) {
			if (prefs.theme === "pixel") ensureTheme();
			if (global.monaco) monaco.editor.setTheme(prefs.theme);
		}
		if (typeof ALEditor.applyCheckJsFromPrefs === "function") ALEditor.applyCheckJsFromPrefs(prefs);
		if (typeof ALEditor.refreshAllDiagnostics === "function") ALEditor.refreshAllDiagnostics();
		if (global.SlotSession) {
			if (typeof SlotSession.apply_chrome_theme === "function") SlotSession.apply_chrome_theme();
		}
	}

	var ALEditor = global.ALEditor || (global.ALEditor = {});
	Object.assign(ALEditor, {
		getPrefs: load_prefs,
		load_prefs: load_prefs,
		save_prefs: save_prefs,
		ensureTheme: ensureTheme,
		bindEditorShortcuts: bindEditorShortcuts,
		applyPrefs: applyPrefs,
		themes: THEMES,
		defaultFont: EDITOR_FONT,
	});
})(typeof window !== "undefined" ? window : globalThis);
