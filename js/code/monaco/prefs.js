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

	// Crisp mono for Monaco glyphs; Pixel stays on explorer/chrome.
	var EDITOR_FONT = 'Consolas, "Cascadia Mono", "Segoe UI Mono", "Liberation Mono", Menlo, Monaco, monospace';
	var PREFS_KEY = "al_code_editor_prefs";
	var THEMES = ["vs-dark", "vs", "hc-black", "pixel"];

	function isVscodeApiHost() {
		return global.MONACO_VERSION === "vscode-api" || (global.MonacoEnvironment && global.MonacoEnvironment.__AL_VSCODE_API__);
	}

	/** Map AL prefs theme ids → vscode-api / workbench theme ids. */
	function resolveThemeName(name) {
		var id = name || "vs-dark";
		if (!isVscodeApiHost()) return id;
		if (id === "pixel") {
			return (global.ALVscodeApi && ALVscodeApi.pixelThemeId) || "Default Dark Modern";
		}
		if (id === "vs") return "Default Light Modern";
		if (id === "hc-black") return "Default High Contrast";
		if (id === "vs-dark") return "Default Dark Modern";
		return id;
	}

	function ensureTheme() {
		if (themeDefined || !global.monaco) return;
		// monaco-vscode-api: pixel is registered as a VS Code theme extension in entry.js.
		if (isVscodeApiHost()) {
			themeDefined = true;
			return;
		}
		try {
			global.monaco.editor.defineTheme("pixel", PIXEL_THEME);
		} catch (e) {
			console.warn("[ALEditor] defineTheme failed; using stock themes", e);
		}
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
			wordWrap: true,
			minimap: false,
			mouseWheelZoom: true,
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
			if (typeof prettier.tabWidth === "number") {
				prettier.tabWidth = Math.max(1, Math.min(8, Math.round(prettier.tabWidth)));
			} else prettier.tabWidth = 4;
			if (prettier.arrowParens !== "avoid") prettier.arrowParens = "always";
			var eslintRules = {};
			if (p.eslintRules && typeof p.eslintRules === "object" && !Array.isArray(p.eslintRules)) {
				eslintRules = p.eslintRules;
			}
			return {
				theme: THEMES.indexOf(p.theme) !== -1 ? p.theme : defaults.theme,
				fontFamily: typeof p.fontFamily === "string" && p.fontFamily.trim() ? p.fontFamily : defaults.fontFamily,
				fontSize: typeof p.fontSize === "number" && p.fontSize >= 10 && p.fontSize <= 32 ? p.fontSize : defaults.fontSize,
				wordWrap: p.wordWrap === false ? false : true,
				minimap: p.minimap === true,
				mouseWheelZoom: p.mouseWheelZoom === false ? false : true,
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
			var opts = {
				id: id,
				label: label,
				run: run,
			};
			if (keys != null && keys !== 0) {
				opts.keybindings = Array.isArray(keys) ? keys : [keys];
			}
			editor.addAction(opts);
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

		addAction("al-quick-open", "Go to Code Slot…", 0, function () {
			// No default keybinding — Ctrl+P is VS Code Quick Open via ALVscodeApi.
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

		function showCommandPalette() {
			var api = global.ALVscodeApi;
			if (api && typeof api.showCommands === "function") {
				api.showCommands();
				return;
			}
			runBuiltin(editor, "editor.action.quickCommand");
		}

		function showQuickOpen() {
			var api = global.ALVscodeApi;
			if (api && typeof api.quickOpen === "function") {
				api.quickOpen();
				return;
			}
			if (global.SlotSession && typeof SlotSession.quick_open === "function") SlotSession.quick_open();
		}

		// vscode-api: F1 / Ctrl+Shift+P → Command Palette; Ctrl+P → Quick Open.
		addAction("al-show-commands", "Show All Commands", KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyP, showCommandPalette);
		editor.addCommand(KeyCode.F1, showCommandPalette);
		editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyP, showQuickOpen);

		// Builtins: keybindings only (listed in the workbench / editor command palette).
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

	function sync_vscode_from_prefs(prefs) {
		if (!prefs || !isVscodeApiHost() || !global.ALVscodeApi) return;
		if (global.__AL_SKIP_VSCODE_SYNC) return;
		var api = global.ALVscodeApi;
		try {
			if (typeof api.syncFromAlPrefs === "function") {
				api.syncFromAlPrefs(prefs);
				return;
			}
			if (typeof api.mergeUserConfiguration === "function") {
				var themeName = typeof resolveThemeName === "function" ? resolveThemeName(prefs.theme) : prefs.theme;
				var prettier = prefs.prettier || {};
				var tabWidth = typeof prettier.tabWidth === "number" ? Math.max(1, Math.min(8, Math.round(prettier.tabWidth))) : 4;
				api.mergeUserConfiguration({
					"editor.fontSize": prefs.fontSize,
					"editor.fontFamily": prefs.fontFamily,
					"editor.minimap.enabled": !!prefs.minimap,
					"editor.wordWrap": prefs.wordWrap === false ? "off" : "on",
					"editor.mouseWheelZoom": prefs.mouseWheelZoom !== false,
					"editor.tabSize": tabWidth,
					"editor.insertSpaces": !prettier.useTabs,
					"editor.formatOnSave": !!prefs.formatOnSave,
					"prettier.enable": prefs.formatting !== false,
					"prettier.semi": prettier.semi !== false,
					"prettier.singleQuote": !!prettier.singleQuote,
					"prettier.tabWidth": tabWidth,
					"prettier.useTabs": !!prettier.useTabs,
					"prettier.printWidth": typeof prettier.printWidth === "number" ? prettier.printWidth : 100,
					"prettier.trailingComma": prettier.trailingComma || "es5",
					"prettier.bracketSpacing": prettier.bracketSpacing !== false,
					"prettier.arrowParens": prettier.arrowParens === "avoid" ? "avoid" : "always",
					"eslint.enable": prefs.linting !== false,
					"cSpell.enabled": prefs.spellCheck !== false,
					"cSpell.language": (prefs.spellLanguages || ["en"]).join(","),
					"workbench.colorTheme": themeName,
				});
			}
		} catch (e) {}
	}

	function applyPrefs(prefs) {
		if (!prefs) prefs = load_prefs();
		save_prefs(prefs);
		if (prefs.theme && global.monaco) {
			if (prefs.theme === "pixel") ensureTheme();
			var themeName = resolveThemeName(prefs.theme);
			try {
				monaco.editor.setTheme(themeName);
			} catch (e) {
				try {
					monaco.editor.setTheme("vs-dark");
				} catch (err) {}
			}
			// Avoid merge→config→applyPrefs loops (and TS worker respawns).
			if (!global.__AL_SKIP_VSCODE_SYNC && isVscodeApiHost() && global.ALVscodeApi) {
				try {
					if (typeof ALVscodeApi.setColorTheme === "function") {
						ALVscodeApi.setColorTheme(themeName);
					}
				} catch (e) {}
			}
		}
		sync_vscode_from_prefs(prefs);
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
		resolveThemeName: resolveThemeName,
		bindEditorShortcuts: bindEditorShortcuts,
		applyPrefs: applyPrefs,
		sync_vscode_from_prefs: sync_vscode_from_prefs,
		themes: THEMES,
		defaultFont: EDITOR_FONT,
	});
})(typeof window !== "undefined" ? window : globalThis);
