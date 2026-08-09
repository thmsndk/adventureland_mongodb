/**
 * Running CODE slot cue via stock IDecorationsService (Explorer + editor tabs).
 * Marks the file whose snapshot is in the runner — distinct from current-character ◆.
 */
import { Emitter } from "@codingame/monaco-vscode-api/vscode/vs/base/common/event";
import { StandaloneServices } from "@codingame/monaco-vscode-api/services";
import { IDecorationsService } from "@codingame/monaco-vscode-api/vscode/vs/workbench/services/decorations/common/decorations.service";
import { slotUri, slotFromUri } from "./alSlotFiles.js";

var runningUri = null;
var runningSlot = null;
var runningLabel = "";
var onDidChangeEmitter = new Emitter();
var registered = false;

function urisEqual(a, b) {
	if (!a && !b) return true;
	if (!a || !b) return false;
	return String(a) === String(b);
}

function isRunningUri(uri) {
	if (!uri || runningSlot == null) return false;
	if (runningUri && String(uri) === String(runningUri)) return true;
	try {
		var slot = slotFromUri(uri);
		return slot != null && String(slot) === String(runningSlot);
	} catch (e) {
		return false;
	}
}

function provider() {
	return {
		label: "AdventureLand Running Code",
		onDidChange: onDidChangeEmitter.event,
		provideDecorations: function (uri) {
			if (!isRunningUri(uri)) return undefined;
			var tip = runningLabel ? "Running in CODE: " + runningLabel : "Running in CODE";
			return {
				weight: 11000,
				letter: "▶",
				color: "charts.green",
				tooltip: tip,
				bubble: false,
			};
		},
	};
}

export function registerRunningCodeDecorations() {
	if (registered) return;
	try {
		StandaloneServices.get(IDecorationsService).registerDecorationsProvider(provider());
		registered = true;
	} catch (e) {
		console.warn("[ALDecorations] registerRunningCodeDecorations", e);
	}
}

/**
 * Mark the slot whose snapshot is in the runner. Pass null to clear (stopped / snippet).
 * @param {string|number|null|undefined} slot
 * @param {{label?: string, character?: boolean}|null} [opts]
 */
export function setRunningCodeSlot(slot, opts) {
	opts = opts || {};
	var next = null;
	var nextSlot = null;
	var nextLabel = "";
	if (slot != null && slot !== "") {
		nextSlot = String(slot);
		nextLabel = opts.label ? String(opts.label) : nextSlot;
		try {
			next = slotUri(slot, {
				character: !!opts.character,
				label: opts.label || undefined,
			});
		} catch (e) {
			next = null;
		}
	}
	if (urisEqual(runningUri, next) && String(runningSlot || "") === String(nextSlot || "") && runningLabel === nextLabel) {
		return;
	}
	var prev = runningUri;
	runningUri = next;
	runningSlot = nextSlot;
	runningLabel = nextLabel;
	var changed = [];
	if (prev) changed.push(prev);
	if (next) changed.push(next);
	if (changed.length) onDidChangeEmitter.fire(changed);
}

export function getRunningCodeSlot() {
	return runningSlot;
}
