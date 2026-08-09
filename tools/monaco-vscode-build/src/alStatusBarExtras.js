/**
 * AL-specific status bar entries via IStatusbarService (stock host).
 * Prettier / indent toggles + spell shortcut — Problems counts come from Markers.
 */
import { StandaloneServices } from "@codingame/monaco-vscode-api/services";
import { IStatusbarService } from "@codingame/monaco-vscode-api/vscode/vs/workbench/services/statusbar/browser/statusbar.service";
import { StatusbarAlignment } from "@codingame/monaco-vscode-api/vscode/vs/workbench/services/statusbar/browser/statusbar";
import { CommandsRegistry } from "@codingame/monaco-vscode-api/vscode/vs/platform/commands/common/commands";

var CMD_PRETTIER = "al.status.togglePrettier";
var CMD_INDENT = "al.status.toggleIndent";
var CMD_SPELL = "al.status.openSpell";
var CMD_FIX_ALL = "al.status.eslintFixAll";

var accessors = [];
var wired = false;

function runGame(fn) {
	try {
		fn();
	} catch (e) {
		console.warn("[ALStatusBarExtras]", e);
	}
}

function registerCommandsOnce() {
	if (wired) return;
	wired = true;
	CommandsRegistry.registerCommand(CMD_PRETTIER, function () {
		runGame(function () {
			var ss = window.SlotSession;
			var prefs = readPrefs();
			if (ss && typeof ss.apply_editor_prefs === "function") {
				ss.apply_editor_prefs({ formatting: prefs.formatting === false });
			}
		});
	});
	CommandsRegistry.registerCommand(CMD_INDENT, function () {
		runGame(function () {
			var ss = window.SlotSession;
			var prefs = readPrefs();
			var tw = (prefs.prettier && prefs.prettier.tabWidth) === 2 ? 4 : 2;
			if (ss && typeof ss.apply_editor_prefs === "function") {
				ss.apply_editor_prefs({ prettier: { tabWidth: tw, useTabs: false } });
			}
		});
	});
	CommandsRegistry.registerCommand(CMD_SPELL, function () {
		runGame(function () {
			var ss = window.SlotSession;
			if (ss && typeof ss.expand_problems_panel === "function") ss.expand_problems_panel();
			var api = window.ALVscodeApi;
			if (api && typeof api.focusProblems === "function") api.focusProblems();
		});
	});
	CommandsRegistry.registerCommand(CMD_FIX_ALL, function () {
		runGame(function () {
			if (window.ALVscodeApi && typeof window.ALVscodeApi.executeCommand === "function") {
				window.ALVscodeApi.executeCommand("adventureland.code.eslintFixAll");
				return;
			}
			var ss = window.SlotSession;
			if (ss && typeof ss.fix_all_eslint === "function") ss.fix_all_eslint();
		});
	});
}

function readPrefs() {
	try {
		if (window.ALEditor) {
			if (typeof window.ALEditor.getPrefs === "function") return window.ALEditor.getPrefs();
			if (typeof window.ALEditor.load_prefs === "function") return window.ALEditor.load_prefs();
		}
	} catch (e) {}
	return { formatting: true, prettier: { tabWidth: 4 } };
}

function spellCount() {
	try {
		if (!window.monaco) return 0;
		var all = monaco.editor.getModelMarkers({}) || [];
		var n = 0;
		for (var i = 0; i < all.length; i++) {
			var mk = all[i];
			var src = (mk && (mk.source || mk.owner)) || "";
			if (src === "cspell") n++;
		}
		return n;
	} catch (e) {
		return 0;
	}
}

function buildEntries() {
	var prefs = readPrefs();
	var tw = (prefs.prettier && prefs.prettier.tabWidth) || 4;
	var tabs = prefs.prettier && prefs.prettier.useTabs;
	var formattingOn = prefs.formatting !== false;
	return [
		{
			id: "al.spell",
			alignment: StatusbarAlignment.LEFT,
			priority: 40,
			entry: {
				name: "Spell",
				text: "$(info) " + spellCount(),
				ariaLabel: "Spell Checker",
				tooltip: "Show spelling issues in Problems",
				command: CMD_SPELL,
			},
		},
		{
			id: "al.indent",
			alignment: StatusbarAlignment.RIGHT,
			priority: 100,
			entry: {
				name: "Indent",
				text: tabs ? "Tab Size: " + tw : "Spaces: " + tw,
				ariaLabel: "Toggle indent width",
				tooltip: "Toggle 2 / 4 spaces",
				command: CMD_INDENT,
			},
		},
		{
			id: "al.prettier",
			alignment: StatusbarAlignment.RIGHT,
			priority: 90,
			entry: {
				name: "Prettier",
				text: formattingOn ? "Prettier" : "Prettier off",
				ariaLabel: "Toggle Prettier",
				tooltip: formattingOn ? "Prettier formatting on" : "Formatting off",
				command: CMD_PRETTIER,
				kind: formattingOn ? "standard" : "warning",
			},
		},
		{
			id: "al.eslintFixAll",
			alignment: StatusbarAlignment.RIGHT,
			priority: 85,
			entry: {
				name: "ESLint Fix",
				text: "Fix all",
				ariaLabel: "ESLint fix all",
				tooltip: "Fix all auto-fixable ESLint problems",
				command: CMD_FIX_ALL,
			},
		},
	];
}

/**
 * Mount AL extras after renderStatusBarPart. Safe to call repeatedly.
 */
export function mountStatusBarExtras() {
	registerCommandsOnce();
	var specs = buildEntries();
	try {
		var sb = StandaloneServices.get(IStatusbarService);
		if (accessors.length === specs.length) {
			for (var u = 0; u < specs.length; u++) {
				accessors[u].update(specs[u].entry);
			}
			return;
		}
		for (var d = 0; d < accessors.length; d++) {
			try {
				accessors[d].dispose();
			} catch (eDisp) {}
		}
		accessors = [];
		for (var i = 0; i < specs.length; i++) {
			var spec = specs[i];
			// Stock signature: addEntry(entry, id, alignment, priority)
			accessors.push(sb.addEntry(spec.entry, spec.id, spec.alignment, spec.priority));
		}
	} catch (e) {
		console.warn("[ALStatusBarExtras] mount", e);
	}
}

export function refreshStatusBarExtras() {
	mountStatusBarExtras();
}

export function registerStatusBarExtraCommands() {
	registerCommandsOnce();
}
