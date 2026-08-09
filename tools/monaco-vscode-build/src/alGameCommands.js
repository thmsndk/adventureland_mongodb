/**
 * AdventureLand game/CODE commands for the workbench keybinding + command services.
 * chrome.js only capture-forwards when focus is outside the IDE (Phaser), or for
 * browser-stolen chords.
 */
import { CommandsRegistry } from "@codingame/monaco-vscode-api/vscode/vs/platform/commands/common/commands";

var wired = false;

function runGame(fn) {
	try {
		fn();
	} catch (e) {
		console.warn("[ALGameCommands]", e);
	}
}

export function registerAdventureLandGameCommands() {
	if (wired) return;
	wired = true;

	CommandsRegistry.registerCommand("adventureland.code.save", function () {
		runGame(function () {
			if (window.SlotSession && typeof window.SlotSession.save_current === "function") {
				window.SlotSession.save_current();
			}
		});
	});
	CommandsRegistry.registerCommand("adventureland.code.saveAs", function () {
		runGame(function () {
			if (window.SlotSession && typeof window.SlotSession.save_as === "function") {
				window.SlotSession.save_as();
			} else if (typeof window.api_call_l === "function") {
				window.api_call_l("list_codes", { purpose: "save" });
			}
		});
	});
	CommandsRegistry.registerCommand("adventureland.code.toggleRun", function () {
		runGame(function () {
			if (window.SlotSession && typeof window.SlotSession.toggle_play === "function") {
				window.SlotSession.toggle_play();
			} else if (typeof window.toggle_runner === "function") {
				window.toggle_runner();
			}
		});
	});
	CommandsRegistry.registerCommand("adventureland.code.newUntitled", function () {
		runGame(function () {
			if (window.SlotSession && typeof window.SlotSession.new_code_slot === "function") {
				window.SlotSession.new_code_slot(false);
			}
		});
	});
	CommandsRegistry.registerCommand("adventureland.code.openDocs", function () {
		runGame(function () {
			if (typeof window.open_guide === "function") {
				window.open_guide("8-code-slots-and-files", "/docs/guide/code/8-code-slots-and-files");
			} else if (typeof window.open === "function") {
				window.open("/docs/guide/code/8-code-slots-and-files", "_blank");
			}
		});
	});
	CommandsRegistry.registerCommand("adventureland.code.eslintFixAll", function () {
		runGame(function () {
			if (window.SlotSession && typeof window.SlotSession.fix_all_eslint === "function") {
				window.SlotSession.fix_all_eslint();
				return;
			}
			var api = window.ALVscodeApi;
			var ed = api && typeof api.getActiveCodeEditor === "function" ? api.getActiveCodeEditor() : null;
			var model = ed && ed.getModel && ed.getModel();
			if (window.ALEditor && typeof window.ALEditor.fixEslint === "function") {
				window.ALEditor.fixEslint(model);
			}
		});
	});
	function toggleAlProblemsPanel() {
		runGame(function () {
			if (window.SlotSession && typeof window.SlotSession.toggle_problems_panel === "function") {
				window.SlotSession.toggle_problems_panel();
				return;
			}
			var el = document.getElementById("code-ide-problems");
			if (!el) return;
			el.classList.toggle("collapsed");
			if (window.SlotSession && typeof window.SlotSession.layout_editor === "function") {
				window.SlotSession.layout_editor();
			}
		});
	}

	CommandsRegistry.registerCommand("adventureland.code.toggleProblems", toggleAlProblemsPanel);
	// Stock Markers status bar uses this id; unshift so AL expand/collapse wins over openView-only.
	CommandsRegistry.registerCommand("workbench.actions.view.toggleProblems", function () {
		toggleAlProblemsPanel();
		runGame(function () {
			var api = window.ALVscodeApi;
			if (api && typeof api.focusProblems === "function") api.focusProblems();
		});
	});
	CommandsRegistry.registerCommand("adventureland.code.toggleProblemsMaximize", function () {
		runGame(function () {
			if (window.SlotSession && typeof window.SlotSession.toggle_problems_maximize === "function") {
				window.SlotSession.toggle_problems_maximize();
			}
		});
	});
	CommandsRegistry.registerCommand("adventureland.code.hideProblems", function () {
		runGame(function () {
			if (window.SlotSession && typeof window.SlotSession.collapse_problems_panel === "function") {
				window.SlotSession.collapse_problems_panel();
			}
		});
	});
	CommandsRegistry.registerCommand("adventureland.code.cycleLayout", function () {
		runGame(function () {
			if (window.SlotSession && typeof window.SlotSession.cycle_layout_mode === "function") {
				window.SlotSession.cycle_layout_mode(1);
			}
		});
	});
	CommandsRegistry.registerCommand("adventureland.code.openLayoutMenu", function () {
		runGame(function () {
			if (window.SlotSession && typeof window.SlotSession.toggle_layout_menu === "function") {
				window.SlotSession.toggle_layout_menu();
			} else if (window.SlotSession && typeof window.SlotSession.open_layout_menu === "function") {
				window.SlotSession.open_layout_menu();
			}
		});
	});
	var LAYOUT_PRESET_IDS = ["overlay-third", "overlay-half", "overlay-full"];
	for (var pi = 0; pi < LAYOUT_PRESET_IDS.length; pi++) {
		(function (presetId, n) {
			CommandsRegistry.registerCommand("adventureland.code.layoutPreset" + n, function () {
				runGame(function () {
					if (window.SlotSession && typeof window.SlotSession.set_layout_mode === "function") {
						window.SlotSession.set_layout_mode(presetId);
					}
				});
			});
		})(LAYOUT_PRESET_IDS[pi], pi + 1);
	}
}

/** Keybinding entries for updateUserKeybindings (merged with tab chords in entry.js). */
export function adventureLandKeybindingEntries() {
	return [
		{ key: "ctrl+s", command: "adventureland.code.save" },
		{ key: "ctrl+shift+s", command: "adventureland.code.saveAs" },
		{ key: "ctrl+enter", command: "adventureland.code.toggleRun" },
		{ key: "f1", command: "workbench.action.showCommands" },
		{ key: "ctrl+shift+p", command: "workbench.action.showCommands" },
		{ key: "ctrl+p", command: "workbench.action.quickOpen" },
		{ key: "ctrl+shift+o", command: "editor.action.quickOutline" },
		{ key: "ctrl+shift+f", command: "workbench.action.findInFiles" },
		{ key: "f8", command: "editor.action.marker.next" },
		{ key: "shift+f8", command: "editor.action.marker.prev" },
		// Panel: match Cursor — Hide/Toggle (Ctrl+J), Maximize (F11)
		{ key: "ctrl+j", command: "adventureland.code.toggleProblems" },
		{ key: "f11", command: "adventureland.code.toggleProblemsMaximize" },
		{ key: "ctrl+j", command: "-workbench.action.togglePanel" },
		{ key: "f11", command: "-workbench.action.toggleMaximizedPanel" },
		{ key: "ctrl+alt+l", command: "adventureland.code.cycleLayout" },
		{ key: "ctrl+alt+1", command: "adventureland.code.layoutPreset1" },
		{ key: "ctrl+alt+2", command: "adventureland.code.layoutPreset2" },
		{ key: "ctrl+alt+3", command: "adventureland.code.layoutPreset3" },
	];
}
