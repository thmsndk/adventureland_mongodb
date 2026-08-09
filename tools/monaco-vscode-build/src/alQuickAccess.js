/**
 * AdventureLand Quick Access — prefixed provider (does not replace stock file Quick Open).
 * Ctrl+P → stock workbench.action.quickOpen (VFS files).
 * Type "al " in Quick Open / use help entry for AL actions + slot shortcuts.
 */
import { PickerQuickAccessProvider } from "@codingame/monaco-vscode-api/vscode/vs/platform/quickinput/browser/pickerQuickAccess";
import { Registry } from "@codingame/monaco-vscode-api/vscode/vs/platform/registry/common/platform";
import { Extensions } from "@codingame/monaco-vscode-api/vscode/vs/platform/quickinput/common/quickAccess";

var PREFIX = "al ";

function slotKey(slot) {
	return "" + slot;
}

function isEmptyEntry(entry) {
	return !entry || !entry[0] || entry[0] === "Empty";
}

function collectSlotPicks(filter) {
	var q = (filter || "").trim().toLowerCase();
	var picks = [];
	var list = (typeof window !== "undefined" && window.X && window.X.codes) || {};
	var seen = Object.create(null);

	function openSlot(key) {
		try {
			var ss = window.SlotSession;
			if (!ss) return;
			if (typeof ss.open_slot_in_workbench === "function" && window.ALVscodeApi && ALVscodeApi.workbenchOwnsTabs) {
				ss.open_slot_in_workbench(key, null, false);
			} else if (typeof ss.open_slot === "function") {
				ss.open_slot(key);
			}
		} catch (e) {
			console.warn("[ALQuickAccess] open_slot failed", e);
		}
	}

	function pushSlot(slot, label, detail) {
		var key = slotKey(slot);
		if (seen[key]) return;
		seen[key] = 1;
		var lab = label || key;
		var hay = (lab + " " + key + " " + (detail || "")).toLowerCase();
		if (q && hay.indexOf(q) === -1) return;
		picks.push({
			label: lab,
			description: detail || "",
			detail: "slot " + key,
			accept: function () {
				openSlot(key);
			},
		});
	}

	if (typeof window !== "undefined" && window.character && window.real_id != null && window.real_id !== "") {
		var chName = (window.character && window.character.name) || "character";
		var entry = list[window.real_id] || [chName, 0];
		pushSlot(window.real_id, (entry[0] || chName) + ".js", "character code");
	}

	var keys = Object.keys(list);
	for (var i = 0; i < keys.length; i++) {
		var n = keys[i];
		if (window.real_id != null && slotKey(n) === slotKey(window.real_id)) continue;
		if (isEmptyEntry(list[n])) continue;
		var name = list[n][0] || n;
		var isNum = /^\d+$/.test(slotKey(n));
		pushSlot(n, name.indexOf(".") >= 0 ? name : name + ".js", isNum ? "#" + n : "code");
	}

	return picks;
}

function actionPicks(filter) {
	var q = (filter || "").trim().toLowerCase();
	var actions = [
		{
			label: "New Untitled file",
			description: "Create empty code slot",
			run: function () {
				if (window.ALVscodeApi && typeof window.ALVscodeApi.executeCommand === "function") {
					return window.ALVscodeApi.executeCommand("adventureland.code.newUntitled");
				}
			},
			keys: "new untitled file slot",
		},
		{
			label: "Go to Symbol in Editor",
			description: "Quick Outline (Ctrl+Shift+O)",
			run: function () {
				if (window.ALVscodeApi && typeof window.ALVscodeApi.executeCommand === "function") {
					return window.ALVscodeApi.executeCommand("editor.action.quickOutline");
				}
			},
			keys: "outline symbol goto",
		},
		{
			label: "Preferences: Open Settings",
			description: "AdventureLand CODE settings",
			run: function () {
				if (window.ALVscodeApi && typeof window.ALVscodeApi.openSettings === "function") {
					return window.ALVscodeApi.openSettings();
				}
			},
			keys: "settings preferences adventureland",
		},
		{
			label: "Preferences: Open Keyboard Shortcuts",
			description: "Keybindings",
			run: function () {
				if (window.ALVscodeApi && typeof window.ALVscodeApi.openKeybindings === "function") {
					return window.ALVscodeApi.openKeybindings();
				}
			},
			keys: "keyboard shortcuts keybindings",
		},
		{
			label: "Show All Commands",
			description: "Command Palette",
			run: function () {
				if (window.ALVscodeApi && typeof window.ALVscodeApi.showCommands === "function") {
					return window.ALVscodeApi.showCommands();
				}
			},
			keys: "command palette f1",
		},
	];
	var out = [];
	for (var i = 0; i < actions.length; i++) {
		var a = actions[i];
		var hay = (a.label + " " + a.description + " " + a.keys).toLowerCase();
		if (q && hay.indexOf(q) === -1) continue;
		out.push({
			label: a.label,
			description: a.description,
			accept: a.run,
		});
	}
	return out;
}

export class ALCodeQuickAccessProvider extends PickerQuickAccessProvider {
	static PREFIX = PREFIX;

	constructor() {
		super(ALCodeQuickAccessProvider.PREFIX, {
			canAcceptInBackground: false,
			noResultsPick: {
				label: "No matching AdventureLand slots or actions",
			},
		});
	}

	_getPicks(filter) {
		var actions = actionPicks(filter);
		var slots = collectSlotPicks(filter);
		var picks = [];
		if (actions.length) {
			picks.push({ type: "separator", label: "actions" });
			for (var i = 0; i < actions.length; i++) picks.push(actions[i]);
		}
		if (slots.length) {
			picks.push({ type: "separator", label: "code slots" });
			for (var j = 0; j < slots.length; j++) picks.push(slots[j]);
		}
		return picks;
	}
}

export function registerALCodeQuickAccess() {
	var quickAccessRegistry = Registry.as(Extensions.Quickaccess);
	quickAccessRegistry.registerQuickAccessProvider({
		ctor: ALCodeQuickAccessProvider,
		prefix: ALCodeQuickAccessProvider.PREFIX,
		placeholder: "AdventureLand slots and actions (prefix: al )",
		helpEntries: [
			{
				description: "AdventureLand code slots & actions",
				prefix: PREFIX,
			},
		],
	});
}
