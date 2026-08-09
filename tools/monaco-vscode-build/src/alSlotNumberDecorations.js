/**
 * CODE slot number cue via stock IDecorationsService (Explorer + editor tabs).
 * Shows "#N" beside numbered slots 1–100 — not part of the filename.
 */
import { Emitter } from "@codingame/monaco-vscode-api/vscode/vs/base/common/event";
import { StandaloneServices } from "@codingame/monaco-vscode-api/services";
import { IDecorationsService } from "@codingame/monaco-vscode-api/vscode/vs/workbench/services/decorations/common/decorations.service";
import { slotFromUri, listSlotUris } from "./alSlotFiles.js";

var onDidChangeEmitter = new Emitter();
var registered = false;

function numberedSlotKey(slot) {
	var s = String(slot == null ? "" : slot).trim();
	if (!s) return null;
	var n = parseInt(s, 10);
	if (isNaN(n) || String(n) !== s || n < 1 || n > 100) return null;
	return s;
}

function provider() {
	return {
		label: "AdventureLand CODE Slot Number",
		onDidChange: onDidChangeEmitter.event,
		provideDecorations: function (uri) {
			var slot = null;
			try {
				slot = slotFromUri(uri);
			} catch (e) {
				return undefined;
			}
			var key = numberedSlotKey(slot);
			if (!key) return undefined;
			// Omit color so explorer.decorations.colors does not grey the whole filename.
			return {
				weight: 9000,
				letter: "#" + key,
				tooltip: "CODE slot #" + key,
				bubble: false,
			};
		},
	};
}

export function registerSlotNumberDecorations() {
	if (registered) return;
	try {
		StandaloneServices.get(IDecorationsService).registerDecorationsProvider(provider());
		registered = true;
	} catch (e) {
		console.warn("[ALDecorations] registerSlotNumberDecorations", e);
	}
}

/** Fire after roster sync / URI remaps so Explorer badges refresh. */
export function refreshSlotNumberDecorations() {
	if (!registered) return;
	try {
		var uris = listSlotUris();
		if (uris.length) onDidChangeEmitter.fire(uris);
	} catch (e) {}
}
