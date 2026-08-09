/**
 * Current-character cue via stock IDecorationsService (Explorer + editor tabs).
 * Replaces DOM scrape of .al-current-character marks.
 */
import { Emitter } from "@codingame/monaco-vscode-api/vscode/vs/base/common/event";
import { ThemeIcon } from "@codingame/monaco-vscode-api/vscode/vs/base/common/themables";
import { StandaloneServices } from "@codingame/monaco-vscode-api/services";
import { IDecorationsService } from "@codingame/monaco-vscode-api/vscode/vs/workbench/services/decorations/common/decorations.service";
import { slotUri, slotFromUri } from "./alSlotFiles.js";

var currentUri = null;
var currentSlot = null;
var onDidChangeEmitter = new Emitter();
var registered = false;
var CURRENT_CHAR_ICON = ThemeIcon.fromId("robot");

function urisEqual(a, b) {
	if (!a && !b) return true;
	if (!a || !b) return false;
	return String(a) === String(b);
}

function isCurrentUri(uri) {
	if (!uri || currentSlot == null) return false;
	if (currentUri && String(uri) === String(currentUri)) return true;
	try {
		var slot = slotFromUri(uri);
		return slot != null && String(slot) === String(currentSlot);
	} catch (e) {
		return false;
	}
}

function provider() {
	return {
		label: "AdventureLand Current Character",
		onDidChange: onDidChangeEmitter.event,
		provideDecorations: function (uri) {
			if (!isCurrentUri(uri)) return undefined;
			return {
				weight: 10000,
				letter: CURRENT_CHAR_ICON,
				color: "charts.blue",
				tooltip: "Current character (you are logged in as this)",
				bubble: false,
			};
		},
	};
}

export function registerCurrentCharacterDecorations() {
	if (registered) return;
	try {
		StandaloneServices.get(IDecorationsService).registerDecorationsProvider(provider());
		registered = true;
	} catch (e) {
		console.warn("[ALDecorations] registerCurrentCharacterDecorations", e);
	}
}

/**
 * Mark the open character slot as current (URI from VFS). Pass null to clear.
 * @param {string|number|null|undefined} slot
 * @param {{label?: string}|null} [opts]
 */
export function setCurrentCharacterSlot(slot, opts) {
	opts = opts || {};
	var next = null;
	var nextSlot = null;
	if (slot != null && slot !== "") {
		nextSlot = String(slot);
		try {
			next = slotUri(slot, {
				character: true,
				label: opts.label || undefined,
			});
		} catch (e) {
			next = null;
		}
	}
	if (urisEqual(currentUri, next) && String(currentSlot || "") === String(nextSlot || "")) return;
	var prev = currentUri;
	currentUri = next;
	currentSlot = nextSlot;
	var changed = [];
	if (prev) changed.push(prev);
	if (next) changed.push(next);
	if (changed.length) onDidChangeEmitter.fire(changed);
}

export function getCurrentCharacterUri() {
	return currentUri;
}

/** Refresh decoration if the current slot's URI remapped (relabel). */
export function refreshCurrentCharacterDecoration(slot, opts) {
	if (slot == null) {
		setCurrentCharacterSlot(null);
		return;
	}
	var prev = currentUri;
	currentUri = null;
	currentSlot = null;
	setCurrentCharacterSlot(slot, opts);
	if (prev && currentUri && String(prev) !== String(currentUri)) {
		onDidChangeEmitter.fire([prev, currentUri]);
	}
}

export function isCurrentCharacterUri(uri) {
	return isCurrentUri(uri);
}
