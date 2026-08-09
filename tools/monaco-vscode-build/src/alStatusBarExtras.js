/**
 * AL-specific status bar entries via IStatusbarService (stock host).
 * Prettier / spell / last-saved — Problems counts come from Markers.
 */
import { StandaloneServices } from "@codingame/monaco-vscode-api/services";
import { IStatusbarService } from "@codingame/monaco-vscode-api/vscode/vs/workbench/services/statusbar/browser/statusbar.service";
import { StatusbarAlignment } from "@codingame/monaco-vscode-api/vscode/vs/workbench/services/statusbar/browser/statusbar";
import { CommandsRegistry } from "@codingame/monaco-vscode-api/vscode/vs/platform/commands/common/commands";

var CMD_PRETTIER = "al.status.togglePrettier";
var CMD_INDENT = "al.status.toggleIndent";
var CMD_SPELL = "al.status.openSpell";
var CMD_FIX_ALL = "al.status.eslintFixAll";
var CMD_SAVED = "al.status.showSaved";

var accessors = [];
var wired = false;
var tickTimer = null;
/** @type {Record<string, number>} */
var lastSavedBySlot = Object.create(null);

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
			var api = window.ALVscodeApi;
			if (api && typeof api.focusSpellView === "function") {
				api.focusSpellView(true);
				return;
			}
			var ss = window.SlotSession;
			if (ss && typeof ss.expand_problems_panel === "function") ss.expand_problems_panel();
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
	CommandsRegistry.registerCommand(CMD_SAVED, function () {
		runGame(function () {
			var ts = activeSlotLastSaved();
			var ver = activeSlotVersion();
			var bits = [];
			if (ts) bits.push("Last saved " + new Date(ts).toLocaleString());
			else bits.push("No save timestamp yet");
			if (ver > 0) bits.push("v" + ver);
			if (typeof window.add_log === "function") add_log(bits.join(" · "), ts ? "#85C76B" : "gray");
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

function activeSlotKey() {
	try {
		var ss = window.SlotSession;
		if (ss && typeof ss.get_slot === "function") {
			var slot = ss.get_slot();
			if (slot != null && slot !== "") return String(slot);
		}
	} catch (e) {}
	try {
		if (window.code_slot != null && window.code_slot !== "") return String(window.code_slot);
	} catch (e2) {}
	return "";
}

function activeSlotLastSaved() {
	var key = activeSlotKey();
	if (key && lastSavedBySlot[key]) return lastSavedBySlot[key];
	return 0;
}

function activeSlotVersion() {
	try {
		var key = activeSlotKey();
		if (!key || !window.X || !X.codes || !X.codes[key]) return 0;
		var v = parseInt(X.codes[key][1], 10);
		return isFinite(v) && v > 0 ? v : 0;
	} catch (e) {
		return 0;
	}
}

/**
 * @param {number} ts
 * @returns {string}
 */
function formatSavedRelative(ts) {
	if (!ts) return "Not saved yet";
	var ms = Date.now() - ts;
	if (ms < 0) ms = 0;
	var sec = Math.floor(ms / 1000);
	if (sec < 45) return "Saved just now";
	var min = Math.floor(sec / 60);
	if (min < 2) return "Saved 1 minute ago";
	if (min < 60) return "Saved " + min + " minutes ago";
	var hr = Math.floor(min / 60);
	if (hr < 2) return "Saved 1 hour ago";
	if (hr < 24) return "Saved " + hr + " hours ago";
	var day = Math.floor(hr / 24);
	if (day < 2) return "Saved yesterday";
	return "Saved " + day + " days ago";
}

/**
 * @param {number} ts
 * @param {number} version
 * @returns {string}
 */
function formatSavedLabel(ts, version) {
	var rel = formatSavedRelative(ts);
	if (!ts && version > 0) return "v" + version;
	if (version > 0) return rel + " · v" + version;
	return rel;
}

function savedTooltip(ts, version) {
	var bits = [];
	if (ts) bits.push("Last saved " + new Date(ts).toLocaleString());
	else bits.push("No USERCODE timestamp yet (save once to record)");
	if (version > 0) bits.push("version " + version);
	return bits.join(" · ");
}

/**
 * Record last-saved for status-bar “Saved … ago” (USERCODE.created / session save).
 * @param {string|number} [slot]
 * @param {number} [whenMs] epoch ms from server; omit for Date.now() on local save
 */
export function noteFileSaved(slot, whenMs) {
	var key = slot != null && slot !== "" ? String(slot) : activeSlotKey();
	if (!key) key = "_";
	var ts = whenMs != null && whenMs !== "" ? Number(whenMs) : Date.now();
	if (!isFinite(ts) || ts <= 0) ts = Date.now();
	var prev = lastSavedBySlot[key] || 0;
	// Keep a newer in-session save over an older load_code seed.
	if (whenMs != null && prev > ts) {
		refreshStatusBarExtras();
		return;
	}
	lastSavedBySlot[key] = ts;
	refreshStatusBarExtras();
}

function describeRunnerStatus() {
	try {
		if (!window.code_run) return null;
		if (window.actual_code) {
			var slot = window.code_run_slot != null ? window.code_run_slot : window.code_slot;
			var label = String(slot || "code");
			if (window.SlotSession && typeof SlotSession.slot_label === "function") {
				label = SlotSession.slot_label(slot, ((window.X && X.codes) || {})[slot]);
			}
			var editSlot = window.code_slot;
			var editLabel = null;
			if (editSlot != null && String(editSlot) !== String(slot)) {
				editLabel = String(editSlot);
				if (window.SlotSession && typeof SlotSession.slot_label === "function") {
					editLabel = SlotSession.slot_label(editSlot, ((window.X && X.codes) || {})[editSlot]);
				}
			}
			if (editLabel) {
				return {
					text: "$(play) " + label + " · edit " + editLabel,
					tooltip: "Running " + label + " as you · editing " + editLabel + ". Pause then Play to run the open tab.",
					kind: "warning",
				};
			}
			return {
				text: "$(play) " + label,
				tooltip: "Runner snapshot: " + label + " (as you). Pause then Play to reload edits.",
				kind: "prominent",
			};
		}
		return {
			text: "$(zap) Travel",
			tooltip: "Temporary travel/snippet runner — not your open file. Stop (⏸), then Play your tab.",
			kind: "warning",
		};
	} catch (e) {
		return null;
	}
}

function buildEntries() {
	var prefs = readPrefs();
	var formattingOn = prefs.formatting !== false;
	var savedAt = activeSlotLastSaved();
	var version = activeSlotVersion();
	var savedLabel = formatSavedLabel(savedAt, version);
	var entries = [];
	var run = describeRunnerStatus();
	if (run) {
		entries.push({
			id: "al.runner",
			alignment: StatusbarAlignment.LEFT,
			priority: 100,
			entry: {
				name: "CODE runner",
				text: run.text,
				ariaLabel: run.tooltip,
				tooltip: run.tooltip,
				command: "adventureland.code.toggleRun",
				kind: run.kind || "standard",
			},
		});
	}
	entries.push(
		{
			id: "al.spell",
			alignment: StatusbarAlignment.LEFT,
			priority: 40,
			entry: {
				name: "Spell",
				text: "$(info) " + spellCount(),
				ariaLabel: "Spell Checker",
				tooltip: "Open Spell Checker panel",
				command: CMD_SPELL,
			},
		},
		{
			id: "al.saved",
			alignment: StatusbarAlignment.RIGHT,
			priority: 115,
			entry: {
				name: "Last saved",
				text: "$(history) " + savedLabel,
				ariaLabel: savedLabel,
				tooltip: savedTooltip(savedAt, version),
				command: CMD_SAVED,
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
	);
	return entries;
}

function ensureTick() {
	if (tickTimer != null) return;
	tickTimer = setInterval(function () {
		refreshStatusBarExtras();
	}, 30000);
}

/**
 * Mount AL extras after renderStatusBarPart. Safe to call repeatedly.
 */
export function mountStatusBarExtras() {
	registerCommandsOnce();
	ensureTick();
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
