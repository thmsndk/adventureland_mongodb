/**
 * AdventureLand monaco-vscode-api host (codingame 36).
 * Exposes window.monaco + window.ALVscodeApi (settings / keybindings / themes).
 */
import { initialize, StandaloneServices, LogLevel, ILoggerService } from "@codingame/monaco-vscode-api/services";
import getConfigurationServiceOverride, { updateUserConfiguration, getUserConfiguration, onUserConfigurationChange } from "@codingame/monaco-vscode-configuration-service-override";
import getKeybindingsServiceOverride, { updateUserKeybindings } from "@codingame/monaco-vscode-keybindings-service-override";
import getPreferencesServiceOverride from "@codingame/monaco-vscode-preferences-service-override";
import getViewsServiceOverride, { renderEditorPart, isEditorPartVisible } from "@codingame/monaco-vscode-views-service-override";
import getStatusBarServiceOverride from "@codingame/monaco-vscode-view-status-bar-service-override";
import { mountOutline, focusOutline, mountSidebar, focusExplorer, focusSearch } from "./alOutline.js";
import { invalidateHostedPartThemeVars, resyncHostedPartThemeVars, scheduleResyncHostedPartThemeVars } from "./alPartLayout.js";
import { IWorkbenchThemeService } from "@codingame/monaco-vscode-api/vscode/vs/workbench/services/themes/common/workbenchThemeService.service";
import { mountProblems, focusProblems, layoutProblems } from "./alProblems.js";
import { focusSpellView, listSpellIssues, syncSpellPanelBadge, refreshSpellDiagnostics } from "./alSpellView.js";
import { mountStatusBar } from "./alStatusBar.js";
import { registerCurrentCharacterDecorations, setCurrentCharacterSlot, refreshCurrentCharacterDecoration } from "./alCurrentCharacter.js";
import { registerRunningCodeDecorations, setRunningCodeSlot } from "./alRunningCode.js";
import { registerSlotNumberDecorations, refreshSlotNumberDecorations } from "./alSlotNumberDecorations.js";
import { registerStatusBarExtraCommands, refreshStatusBarExtras, noteFileSaved } from "./alStatusBarExtras.js";
import getLanguagesServiceOverride from "@codingame/monaco-vscode-languages-service-override";
import getTextMateServiceOverride from "@codingame/monaco-vscode-textmate-service-override";
import getThemeServiceOverride from "@codingame/monaco-vscode-theme-service-override";
import getStorageServiceOverride from "@codingame/monaco-vscode-storage-service-override";
import getNotificationServiceOverride from "@codingame/monaco-vscode-notifications-service-override";
import getDialogsServiceOverride from "@codingame/monaco-vscode-dialogs-service-override";
import getModelServiceOverride from "@codingame/monaco-vscode-model-service-override";
import getQuickAccessServiceOverride from "@codingame/monaco-vscode-quickaccess-service-override";
import getFilesServiceOverride from "@codingame/monaco-vscode-files-service-override";
import getExplorerServiceOverride from "@codingame/monaco-vscode-explorer-service-override";
import getOutlineServiceOverride from "@codingame/monaco-vscode-outline-service-override";
import getMarkersServiceOverride from "@codingame/monaco-vscode-markers-service-override";
import getSearchServiceOverride from "@codingame/monaco-vscode-search-service-override";
import getScmServiceOverride from "@codingame/monaco-vscode-scm-service-override";
// Required before registerExtension(...).getApi() (explorer Delete command).
import "vscode/localExtensionHost";
import { ICommandService } from "@codingame/monaco-vscode-api/vscode/vs/platform/commands/common/commands.service";
import { IConfigurationService } from "@codingame/monaco-vscode-api/vscode/vs/platform/configuration/common/configuration.service";
import { IEditorGroupsService } from "@codingame/monaco-vscode-api/vscode/vs/workbench/services/editor/common/editorGroupsService.service";
import { IPreferencesService } from "@codingame/monaco-vscode-api/vscode/vs/workbench/services/preferences/common/preferences.service";
import { IQuickInputService } from "@codingame/monaco-vscode-api/vscode/vs/platform/quickinput/common/quickInput.service";
import { registerExtension, ExtensionHostKind } from "@codingame/monaco-vscode-api/extensions";
import { registerALCodeQuickAccess } from "./alQuickAccess.js";
import { registerAdventureLandGameCommands, adventureLandKeybindingEntries } from "./alGameCommands.js";
import { isCancellationError } from "@codingame/monaco-vscode-api/vscode/vs/base/common/errors";
import {
	registerAdventureLandConfiguration,
	curateStockSettingsToc,
	prefsToConfigurationPartial,
	configurationToPrefsPartial,
	layoutFromConfiguration,
	stripLegacyAlFormatKeys,
	AL_SETTINGS_QUERY,
} from "./alConfiguration.js";
import { registerBuiltinToolExtensions } from "./extensions/registerBuiltinToolExtensions.js";
import {
	initSlotFiles,
	openSlotEditor as openSlotEditorImpl,
	ensureSlotFile,
	ensureTypeLibFile,
	typeLibUri,
	getActiveCodeEditor,
	getActiveSlot,
	slotUri,
	slotFromUri,
	closeSlotEditor,
	disableWorkbenchOwnsTabsDom,
	syncRosterFiles,
	openTypeLibEditor,
	ensureActiveEditorSlotSync,
	markSlotEditorClean,
} from "./alSlotFiles.js";
import { flattenCodeWorkspaceFolders } from "./alWorkspaceFolders.js";
import { registerCodeIdeIconTheme, ICON_THEME_ID } from "./themes/registerCodeIdeIconTheme.js";

import "@codingame/monaco-vscode-theme-defaults-default-extension";
import "@codingame/monaco-vscode-javascript-default-extension";
import "@codingame/monaco-vscode-typescript-basics-default-extension";
// Standalone TS/JS language service (javascriptDefaults / workers) — basics alone is TextMate only.
import * as monacoTypescript from "@codingame/monaco-vscode-standalone-typescript-language-features";

import * as monaco from "monaco-editor";
import pixelThemeJson from "./themes/adventureland-pixel.json";

var MONACO_BASE = "/js/monaco/vscode-api/";
var PIXEL_THEME_ID = "AdventureLand Pixel";

function monacoWorkerUrl(label) {
	var base = (typeof location !== "undefined" && location.origin ? location.origin : "") + MONACO_BASE;
	if (label === "TextMateWorker") return base + "textmate.worker.js";
	// Classic monaco mode ids for the standalone TS language-features worker.
	if (label === "typescript" || label === "javascript") return base + "ts.worker.js";
	// TextEditorWorker / editorWorkerService / default → codingame editor worker (ESM)
	return base + "editor.worker.js";
}

/**
 * Standalone TS workers expect a `{ type: 'vscode-worker-ready' }` handshake
 * (see codingame workers.js whenESMWorkerReady). A bare Worker never posts it;
 * wrap ESM imports the same way getWorkerUrl's blob bootstrap does.
 *
 * Do not cache Workers across dispose — WorkerManager stops/recreates on
 * setCompilerOptions; a reused Worker has already fired ready and hangs forever.
 */
function createReadyEsmWorker(url, label) {
	var body = "await import(" + JSON.stringify(url) + ");\nglobalThis.postMessage({ type: 'vscode-worker-ready' });";
	var blobUrl = URL.createObjectURL(new Blob([body], { type: "application/javascript" }));
	var worker = new Worker(blobUrl, { type: "module", name: label || "monaco-worker" });
	setTimeout(function () {
		try {
			URL.revokeObjectURL(blobUrl);
		} catch (e) {}
	}, 60000);
	return worker;
}

self.MonacoEnvironment = {
	__AL_VSCODE_API__: true,
	getWorkerUrl: function (_moduleId, label) {
		return monacoWorkerUrl(label);
	},
	getWorker: function (_moduleId, label) {
		var url = monacoWorkerUrl(label);
		if (label === "typescript" || label === "javascript") {
			return createReadyEsmWorker(url, label);
		}
		return new Worker(url, { type: "module", name: label || "monaco-worker" });
	},
};

function whenDocumentBody() {
	return new Promise(function (resolve) {
		if (typeof document !== "undefined" && document.body) {
			resolve(document.body);
			return;
		}
		if (typeof document !== "undefined" && document.readyState === "loading") {
			document.addEventListener(
				"DOMContentLoaded",
				function () {
					resolve(document.body);
				},
				{ once: true },
			);
			return;
		}
		var tries = 0;
		var id = setInterval(function () {
			tries += 1;
			if (typeof document !== "undefined" && document.body) {
				clearInterval(id);
				resolve(document.body);
			} else if (tries > 500) {
				clearInterval(id);
				resolve(null);
			}
		}, 10);
	});
}

/**
 * Workbench host for settings/keybindings editor part.
 * Lives inside the CODE IDE editor slot (like a file tab), not a branded fullscreen shell.
 */
function ensureWorkbenchHost(body) {
	var existing = document.getElementById("al-vscode-workbench");
	if (existing) {
		var barRoot = existing.querySelector("#al-vscode-workbench-bar");
		if (barRoot) barRoot.remove();
		if (!existing.querySelector("#al-vscode-workbench-close")) {
			var btn = document.createElement("button");
			btn.type = "button";
			btn.id = "al-vscode-workbench-close";
			btn.title = "Close";
			btn.textContent = "✕";
			existing.insertBefore(btn, existing.firstChild);
		}
		existing.classList.add("al-workbench-host");
		existing.style.position = "";
		existing.style.inset = "";
		existing.style.zIndex = "";
		existing.style.background = "";
		return existing;
	}
	var host = document.createElement("div");
	host.id = "al-vscode-workbench";
	host.setAttribute("aria-hidden", "true");
	host.className = "al-workbench-host";
	host.style.cssText = "display:flex;visibility:hidden;pointer-events:none;width:1024px;height:768px;";
	host.innerHTML = '<button type="button" id="al-vscode-workbench-close" title="Close">✕</button>' + '<div id="al-vscode-editors"></div>';
	body.appendChild(host);
	host.addEventListener("click", function (e) {
		var t = e.target;
		if (t && t.id === "al-vscode-workbench-close") {
			e.preventDefault();
			if (window.SlotSession && typeof window.SlotSession.close_active_view_tab === "function" && window.SlotSession.close_active_view_tab()) {
				return;
			}
			hideWorkbenchHost();
		}
	});
	return host;
}

/** Prefer the CODE IDE editor slot so Settings opens like a file, not a fullscreen app. */
function mountWorkbenchInCodeIde() {
	var host = document.getElementById("al-vscode-workbench");
	if (!host) return null;
	var slot = document.getElementById("code-ide-editor-slot") || document.getElementById("code-ide-main");
	if (slot && host.parentElement !== slot) {
		slot.appendChild(host);
	}
	host.classList.add("al-workbench-in-ide");
	host.classList.remove("al-workbench-overlay-only");
	var monacoHost = slot && slot.querySelector(".monaco-editor-host.maincode, .monaco-editor-host");
	if (monacoHost) {
		monacoHost.dataset.alHiddenForWorkbench = "1";
		monacoHost.style.visibility = "hidden";
		monacoHost.style.pointerEvents = "none";
	}
	return host;
}

function unmountWorkbenchFromCodeIde() {
	var host = document.getElementById("al-vscode-workbench");
	if (!host) return;
	var slot = host.parentElement;
	if (slot) {
		var monacoHost = slot.querySelector('.monaco-editor-host[data-al-hidden-for-workbench="1"]');
		if (monacoHost) {
			delete monacoHost.dataset.alHiddenForWorkbench;
			monacoHost.style.visibility = "";
			monacoHost.style.pointerEvents = "";
		}
	}
	if (host.parentElement && host.parentElement.id !== "al-vscode-park" && document.body) {
		var park = document.getElementById("al-vscode-park");
		if (!park) {
			park = document.createElement("div");
			park.id = "al-vscode-park";
			// Keep a real layout box off-screen — 1×1 + display:none makes Settings/TOC
			// ListView probeDynamicHeight warn "Measured item node at 0px".
			park.style.cssText = "position:fixed;left:-10000px;top:0;width:1024px;height:768px;overflow:hidden;visibility:hidden;pointer-events:none;";
			document.body.appendChild(park);
		}
		park.appendChild(host);
	}
	host.classList.remove("al-workbench-in-ide");
	// Prefer visibility over display:none so ListViews keep a non-zero box while parked.
	host.style.display = "flex";
	host.style.visibility = "hidden";
	host.style.width = "1024px";
	host.style.height = "768px";
	host.setAttribute("aria-hidden", "true");
}

function showWorkbenchHost() {
	var host = document.getElementById("al-vscode-workbench");
	if (!host) return;
	delete host.dataset.alOverlayOnly;
	host.classList.remove("al-workbench-overlay-only");
	try {
		if (!window.code && typeof window.toggle_code === "function") window.toggle_code();
	} catch (e) {}
	mountWorkbenchInCodeIde();
	host.style.display = "flex";
	host.style.visibility = "visible";
	host.style.pointerEvents = "auto";
	host.style.width = "";
	host.style.height = "";
	host.setAttribute("aria-hidden", "false");
	var eds = document.getElementById("al-vscode-editors");
	if (eds) {
		eds.style.visibility = "";
		eds.style.pointerEvents = "";
	}
	try {
		requestAnimationFrame(function () {
			window.dispatchEvent(new Event("resize"));
		});
	} catch (e2) {}
}

/** True when the editor host has a measurable box (not display:none / 0×0). */
function workbenchHasLayoutBox() {
	var eds = document.getElementById("al-vscode-editors");
	var host = document.getElementById("al-vscode-workbench");
	var el = eds || host;
	if (!el) return false;
	var codeui = document.getElementById("codeui");
	if (codeui) {
		var cs = window.getComputedStyle(codeui);
		if (cs.display === "none" || cs.visibility === "hidden") return false;
	}
	if (host) {
		var hs = window.getComputedStyle(host);
		if (hs.display === "none") return false;
	}
	return el.clientWidth > 8 && el.clientHeight > 8;
}

/**
 * Wait until the workbench has a non-zero box before opening Settings/Keybindings/editors
 * (avoids monaco ListView "display:none before measuring row height").
 */
function whenWorkbenchLaidOut(maxMs) {
	maxMs = typeof maxMs === "number" ? maxMs : 800;
	showWorkbenchHost();
	return new Promise(function (resolve) {
		var started = Date.now();
		function tick() {
			try {
				window.dispatchEvent(new Event("resize"));
			} catch (e) {}
			if (workbenchHasLayoutBox() || Date.now() - started >= maxMs) {
				resolve();
				return;
			}
			requestAnimationFrame(tick);
		}
		requestAnimationFrame(function () {
			requestAnimationFrame(tick);
		});
	});
}

function afterWorkbenchLayout(fn) {
	return whenWorkbenchLaidOut().then(function () {
		try {
			return fn();
		} catch (err) {
			return Promise.reject(err);
		}
	});
}

function hideWorkbenchHost(opts) {
	opts = opts || {};
	var host = document.getElementById("al-vscode-workbench");
	if (!host) return;
	if (host.dataset.alOverlayOnly === "1") {
		host.classList.add("al-workbench-overlay-only");
		host.style.display = "block";
		host.style.visibility = "hidden";
		host.style.pointerEvents = "none";
		host.setAttribute("aria-hidden", "true");
		return;
	}
	// Full workbench mode keeps the editor part visible while CODE is open
	// (slots + Settings share tabs). Only hard-hide when CODE closes or forced.
	var codeui = document.getElementById("codeui");
	var ownsTabs = codeui && codeui.classList.contains("al-workbench-owns-tabs");
	if (ownsTabs && !opts.hard && window.code) {
		return;
	}
	host.setAttribute("aria-hidden", "true");
	host.style.pointerEvents = "none";
	if (!opts.hard && host.classList.contains("al-workbench-in-ide") && host.parentElement && host.parentElement.id === "code-ide-editor-slot") {
		host.style.display = "flex";
		host.style.visibility = "hidden";
		var slot = host.parentElement;
		var monacoHost = slot.querySelector('.monaco-editor-host[data-al-hidden-for-workbench="1"]');
		if (monacoHost) {
			delete monacoHost.dataset.alHiddenForWorkbench;
			monacoHost.style.visibility = "";
			monacoHost.style.pointerEvents = "";
			monacoHost.style.display = "";
		}
		return;
	}
	// Park off-screen with a real box — never display:none (ListView row-height probes).
	unmountWorkbenchFromCodeIde();
	if (opts.hard) disableWorkbenchOwnsTabsDom();
}

function syncActiveSlotFromWorkbench(slot) {
	if (slot == null) return;
	try {
		if (window.SlotSession && typeof window.SlotSession.on_workbench_active_slot === "function") {
			window.SlotSession.on_workbench_active_slot(slot);
		}
	} catch (e) {}
}

function openSlotEditor(slot, content, opts) {
	return whenWorkbenchLaidOut().then(function () {
		return openSlotEditorImpl(slot, content, opts, function () {}, syncActiveSlotFromWorkbench);
	});
}

/** Quick Input is parented under #al-vscode-workbench — it cannot layout if host is display:none. */
function workbenchIsInCodeIde(host) {
	if (!host) return false;
	if (host.classList.contains("al-workbench-in-ide")) return true;
	var p = host.parentElement;
	return !!(p && (p.id === "code-ide-editor-slot" || p.id === "code-ide-main"));
}

function prepareQuickInputHost() {
	var host = document.getElementById("al-vscode-workbench");
	if (!host) return;
	// When CODE already mounts the workbench, keep it in the editor slot.
	// Parking + hiding #al-vscode-editors leaves a black IDE shell (F1 / Ctrl+P).
	if (window.code && workbenchIsInCodeIde(host)) {
		delete host.dataset.alOverlayOnly;
		host.classList.remove("al-workbench-overlay-only");
		host.classList.add("al-workbench-in-ide");
		host.style.display = "flex";
		host.style.visibility = "visible";
		host.style.pointerEvents = "auto";
		host.setAttribute("aria-hidden", "false");
		var edsInIde = document.getElementById("al-vscode-editors");
		if (edsInIde) {
			edsInIde.style.visibility = "";
			edsInIde.style.pointerEvents = "";
		}
		return;
	}
	host.dataset.alOverlayOnly = "1";
	host.classList.add("al-workbench-overlay-only");
	host.classList.remove("al-workbench-in-ide");
	// Park on body for fixed Quick Input when CODE is closed / host not in IDE.
	if (document.body && host.parentElement !== document.body && !(host.parentElement && host.parentElement.id === "al-vscode-park")) {
		var park = document.getElementById("al-vscode-park");
		if (!park) {
			park = document.createElement("div");
			park.id = "al-vscode-park";
			park.style.cssText = "position:fixed;inset:0;z-index:100000;pointer-events:none;background:transparent;";
			document.body.appendChild(park);
		}
		park.appendChild(host);
	} else if (host.parentElement && host.parentElement.id === "code-ide-editor-slot") {
		unmountWorkbenchFromCodeIde();
		var park2 = document.getElementById("al-vscode-park");
		if (!park2) {
			park2 = document.createElement("div");
			park2.id = "al-vscode-park";
			park2.style.cssText = "position:fixed;inset:0;z-index:100000;pointer-events:none;background:transparent;";
			document.body.appendChild(park2);
		}
		park2.appendChild(host);
	}
	host.style.display = "block";
	host.style.visibility = "visible";
	host.style.pointerEvents = "none";
	host.setAttribute("aria-hidden", "false");
	var eds = document.getElementById("al-vscode-editors");
	if (eds) {
		eds.style.visibility = "hidden";
		eds.style.pointerEvents = "none";
	}
}

function restoreWorkbenchAfterQuickInput() {
	if (!window.code) return;
	try {
		showWorkbenchHost();
	} catch (e) {}
}

function toDataJsonUrl(obj) {
	var json = JSON.stringify(obj);
	// btoa needs binary string; handle unicode safely.
	var bin = unescape(encodeURIComponent(json));
	return "data:text/json;charset=utf-8;base64," + btoa(bin);
}

async function registerPixelTheme() {
	var ext = registerExtension(
		{
			name: "adventureland-pixel-theme",
			displayName: "AdventureLand Pixel Theme",
			publisher: "adventureland",
			version: "1.0.0",
			engines: { vscode: "*" },
			contributes: {
				themes: [
					{
						id: PIXEL_THEME_ID,
						label: PIXEL_THEME_ID,
						uiTheme: "vs-dark",
						path: "./themes/adventureland-pixel.json",
					},
				],
			},
		},
		ExtensionHostKind.LocalProcess,
	);
	ext.registerFileUrl("./themes/adventureland-pixel.json", toDataJsonUrl(pixelThemeJson));
	await ext.whenReady();
	return PIXEL_THEME_ID;
}

/** In-memory user settings.json — codingame updateUserConfiguration replaces the whole file. */
var userConfigState = null;

function defaultUserConfig() {
	return {
		"editor.fontSize": 16,
		"editor.fontFamily": 'Consolas, "Cascadia Mono", Menlo, Monaco, monospace',
		"editor.minimap.enabled": false,
		"editor.glyphMargin": true,
		"editor.lightbulb.enabled": "on",
		/* Keep quick-fix menu populated when stock lightbulb sits on an empty neighbor line. */
		"editor.codeActionWidget.includeNearbyQuickFixes": true,
		"editor.wordWrap": "on",
		"editor.mouseWheelZoom": true,
		"editor.tabSize": 4,
		"editor.insertSpaces": true,
		"editor.detectIndentation": false,
		// AdventureLand Prettier owns format-on-save (al_code_editor_prefs).
		"editor.formatOnSave": false,
		"editor.renderWhitespace": "selection",
		"editor.smoothScrolling": true,
		"editor.cursorBlinking": "smooth",
		"editor.linkedEditing": true,
		"editor.bracketPairColorization.enabled": true,
		"editor.guides.bracketPairs": true,
		"files.autoSave": "off",
		"workbench.colorTheme": "Default Dark Modern",
		"workbench.iconTheme": ICON_THEME_ID,
		"workbench.activityBar.location": "top",
		"workbench.sideBar.location": "left",
		/* App File/Edit menu is unusable in our host (broken flyout); Cursor-style switcher only. */
		"window.menuBarVisibility": "hidden",
		"workbench.tree.renderIndentGuides": "none",
		"workbench.tree.indent": 12,
		// codingame views override does not implement createModalEditorPart;
		// force Settings / Keybindings into the attached editor part.
		"workbench.editor.useModal": "off",
		"prettier.enable": true,
		"prettier.semi": true,
		"prettier.singleQuote": false,
		"prettier.tabWidth": 4,
		"prettier.useTabs": false,
		"prettier.printWidth": 100,
		"prettier.trailingComma": "es5",
		"prettier.bracketSpacing": true,
		"prettier.arrowParens": "always",
		"eslint.enable": true,
		"eslint.rules.eqeqeq": "warn",
		"eslint.rules.no-debugger": "warn",
		"eslint.rules.no-eval": "warn",
		"eslint.rules.no-implied-eval": "warn",
		"eslint.rules.prefer-const": "warn",
		"eslint.rules.no-var": "warn",
		"eslint.rules.no-duplicate-case": "warn",
		"eslint.rules.no-unreachable": "warn",
		"eslint.rules.no-unused-vars": "warn",
		"cSpell.enabled": true,
		"cSpell.language": "en",
		"cSpell.userWords": [],
		"workbench.quickOpen.closeOnFocusLost": true,
		"breadcrumbs.enabled": true,
		"breadcrumbs.filePath": "on",
		"breadcrumbs.symbolPath": "on",
		"breadcrumbs.symbolSortOrder": "position",
		// Current-character ◆ via IDecorationsService (Explorer + editor tabs).
		"workbench.editor.decorations.badges": true,
		"workbench.editor.decorations.colors": true,
		"explorer.decorations.badges": true,
		"explorer.decorations.colors": true,
	};
}

async function mergeUserConfiguration(partial) {
	if (!userConfigState) userConfigState = defaultUserConfig();
	stripLegacyAlFormatKeys(userConfigState);
	if (partial && typeof partial === "object") {
		var keys = Object.keys(partial);
		for (var i = 0; i < keys.length; i++) {
			userConfigState[keys[i]] = partial[keys[i]];
		}
	}
	stripLegacyAlFormatKeys(userConfigState);
	migrateLegacyIconTheme(userConfigState);
	try {
		await updateUserConfiguration(JSON.stringify(userConfigState, null, 2));
	} catch (e) {
		console.warn("[ALVscodeApi] mergeUserConfiguration", e);
	}
	return userConfigState;
}

/** Old theme ids / stock vs-seti → agnostic CODE IDE icons (seti files + folder SVGs). */
function migrateLegacyIconTheme(cfg) {
	if (!cfg || typeof cfg !== "object") return;
	var cur = cfg["workbench.iconTheme"];
	if (cur === "adventureland-icons" || cur === "vs-seti" || cur == null || cur === "") {
		cfg["workbench.iconTheme"] = ICON_THEME_ID;
	}
	/* Compact menubar flyout is broken in our host — always hide. */
	cfg["window.menuBarVisibility"] = "hidden";
}

function resolveWorkbenchThemeFromAl(theme) {
	if (theme === "pixel") return PIXEL_THEME_ID;
	if (theme === "vs") return "Default Light Modern";
	if (theme === "hc-black") return "Default High Contrast";
	return "Default Dark Modern";
}

function readAlPrefsFromLocalStorage() {
	try {
		var raw = localStorage.getItem("al_code_editor_prefs");
		if (!raw) return null;
		return JSON.parse(raw);
	} catch (e) {
		return null;
	}
}

var applyingConfigToGame = false;
var applyConfigTimer = null;

function applyConfigurationToGame() {
	if (applyingConfigToGame || !userConfigState) return;
	if (applyConfigTimer) clearTimeout(applyConfigTimer);
	applyConfigTimer = setTimeout(function () {
		applyConfigTimer = null;
		applyConfigurationToGameNow();
	}, 50);
}

function applyConfigurationToGameNow() {
	if (applyingConfigToGame || !userConfigState) return;
	applyingConfigToGame = true;
	try {
		var cfg = userConfigState;
		if (window.ALEditor && typeof window.ALEditor.load_prefs === "function") {
			var next = configurationToPrefsPartial(cfg, window.ALEditor.load_prefs());
			window.__AL_SKIP_VSCODE_SYNC = true;
			try {
				if (typeof window.ALEditor.applyPrefs === "function") window.ALEditor.applyPrefs(next);
				else if (window.SlotSession && typeof window.SlotSession.apply_editor_prefs === "function") {
					window.SlotSession.apply_editor_prefs(next);
				}
				if (Array.isArray(next.spellUserWords) && typeof window.ALEditor.setUserSpellWords === "function") {
					window.ALEditor.setUserSpellWords(next.spellUserWords);
				}
			} finally {
				window.__AL_SKIP_VSCODE_SYNC = false;
			}
		}
		var lay = layoutFromConfiguration(cfg);
		window.__AL_SKIP_VSCODE_SYNC = true;
		try {
			var presets = lay.layoutPresets;
			var mode = lay.layoutMode || (window.ALCodeSessionState && window.ALCodeSessionState.layout_mode);
			if (lay.overlayOpacity != null && mode && String(mode).indexOf("overlay") === 0) {
				var basePresets = presets || (window.ALCodeSessionState && window.ALCodeSessionState.layout_presets) || {};
				presets = Object.assign({}, basePresets);
				presets[mode] = Object.assign({}, presets[mode] || {}, {
					opacity: Math.max(0.4, Math.min(1, lay.overlayOpacity)),
				});
			}
			if (presets && window.SlotSession && typeof window.SlotSession.set_layout_presets === "function") {
				window.SlotSession.set_layout_presets(presets, { sync: false, apply: !lay.layoutMode });
			}
			if (lay.layoutMode && window.SlotSession && typeof window.SlotSession.set_layout_mode === "function") {
				window.SlotSession.set_layout_mode(lay.layoutMode);
			} else if (lay.overlayOpacity != null && window.ALCodeSessionState) {
				window.ALCodeSessionState.overlay_alpha = Math.max(0.4, Math.min(1, lay.overlayOpacity));
				try {
					localStorage.setItem(window.ALCodeSessionState.ALPHA_KEY || "al_code_overlay_alpha", String(window.ALCodeSessionState.overlay_alpha));
				} catch (e2) {}
				if (window.SlotSession && typeof window.SlotSession.apply_layout === "function") window.SlotSession.apply_layout();
			}
			if (cfg["adventureland.defaultRunAction"] != null && window.SlotSession && typeof window.SlotSession.set_default_run_action === "function") {
				window.SlotSession.set_default_run_action(cfg["adventureland.defaultRunAction"], { sync: false });
			} else if (cfg["adventureland.autoRerun"] != null && window.SlotSession) {
				var legacyAction = cfg["adventureland.autoRerun"] ? "playRerunOnSave" : "play";
				if (typeof window.SlotSession.set_default_run_action === "function") {
					window.SlotSession.set_default_run_action(legacyAction, { sync: false });
				} else if (typeof window.SlotSession.set_auto_rerun === "function") {
					window.SlotSession.set_auto_rerun(!!cfg["adventureland.autoRerun"], { sync: false });
				}
			}
		} finally {
			window.__AL_SKIP_VSCODE_SYNC = false;
		}
		if (window.SlotSession && typeof window.SlotSession.update_statusbar === "function") window.SlotSession.update_statusbar();
	} finally {
		applyingConfigToGame = false;
	}
}

function syncFromAlPrefs(prefs) {
	if (typeof window !== "undefined" && window.__AL_SKIP_VSCODE_SYNC) return Promise.resolve(userConfigState);
	prefs = prefs || readAlPrefsFromLocalStorage() || {};
	var partial = prefsToConfigurationPartial(prefs);
	partial["workbench.colorTheme"] = resolveWorkbenchThemeFromAl(prefs.theme);
	try {
		if (window.ALEditor && typeof window.ALEditor.getUserSpellWords === "function") {
			partial["cSpell.userWords"] = window.ALEditor.getUserSpellWords();
		}
	} catch (eWords) {}
	try {
		if (window.ALCodeSessionState) {
			if (window.ALCodeSessionState.layout_mode) partial["adventureland.layoutMode"] = window.ALCodeSessionState.layout_mode;
			if (typeof window.ALCodeSessionState.overlay_alpha === "number") {
				partial["adventureland.overlayOpacity"] = window.ALCodeSessionState.overlay_alpha;
			}
			if (window.ALCodeSessionState.layout_presets && typeof window.ALCodeSessionState.layout_presets === "object") {
				partial["adventureland.layoutPresets"] = window.ALCodeSessionState.layout_presets;
			}
			if (window.ALCodeSessionState.default_run_action) {
				partial["adventureland.defaultRunAction"] = window.ALCodeSessionState.default_run_action;
			} else if (typeof window.ALCodeSessionState.auto_rerun === "boolean") {
				partial["adventureland.defaultRunAction"] = window.ALCodeSessionState.auto_rerun ? "playRerunOnSave" : "play";
			}
		}
	} catch (e) {}
	return mergeUserConfiguration(partial);
}

function wireConfigurationBridge() {
	try {
		onUserConfigurationChange(function () {
			getUserConfiguration()
				.then(function (json) {
					var parsed = {};
					try {
						parsed = JSON.parse(json || "{}") || {};
					} catch (e) {
						return;
					}
					userConfigState = Object.assign(userConfigState || defaultUserConfig(), parsed);
					applyConfigurationToGame();
				})
				.catch(function () {});
		});
	} catch (e) {
		console.warn("[ALVscodeApi] wireConfigurationBridge", e);
	}
	try {
		var cfgSvc = StandaloneServices.get(IConfigurationService);
		if (cfgSvc && cfgSvc.onDidChangeConfiguration) {
			cfgSvc.onDidChangeConfiguration(function () {
				getUserConfiguration()
					.then(function (json) {
						try {
							userConfigState = Object.assign(userConfigState || defaultUserConfig(), JSON.parse(json || "{}"));
						} catch (err) {}
						applyConfigurationToGame();
					})
					.catch(function () {});
			});
		}
	} catch (e2) {}
}

async function setColorTheme(themeId) {
	if (typeof window !== "undefined" && window.__AL_SKIP_VSCODE_SYNC) {
		try {
			if (monaco.editor && typeof monaco.editor.setTheme === "function") monaco.editor.setTheme(themeId);
		} catch (eSkip) {}
		return;
	}
	var cur = userConfigState && userConfigState["workbench.colorTheme"];
	if (cur === themeId) {
		try {
			if (monaco.editor && typeof monaco.editor.setTheme === "function") monaco.editor.setTheme(themeId);
		} catch (eSame) {}
		try {
			scheduleResyncHostedPartThemeVars(0);
		} catch (eSameSync) {}
		return;
	}
	await mergeUserConfiguration({ "workbench.colorTheme": themeId });
	try {
		invalidateHostedPartThemeVars();
		scheduleResyncHostedPartThemeVars(0);
	} catch (eInv) {}
	try {
		if (monaco.editor && typeof monaco.editor.setTheme === "function") {
			monaco.editor.setTheme(themeId);
		}
	} catch (e2) {}
}

async function boot() {
	/*
	 * VS Code cancels in-flight work by rejecting with CancellationError when tokens dispose.
	 * That is normal; silence it before the game page logger treats it as an exception.
	 */
	if (!window.__AL_VSCODE_CANCEL_SILENCE__) {
		window.__AL_VSCODE_CANCEL_SILENCE__ = 1;
		window.addEventListener(
			"unhandledrejection",
			function (ev) {
				if (isCancellationError(ev.reason)) {
					ev.preventDefault();
					ev.stopImmediatePropagation();
				}
			},
			true,
		);
	}

	var body = await whenDocumentBody();
	if (!body) {
		throw new Error("[ALVscodeApi] document.body unavailable; cannot initialize vscode-api");
	}
	try {
		registerAdventureLandConfiguration();
	} catch (eReg) {
		console.warn("[ALVscodeApi] registerAdventureLandConfiguration", eReg);
	}
	var host = ensureWorkbenchHost(body);
	await initialize(
		{
			...getConfigurationServiceOverride(),
			...getPreferencesServiceOverride(),
			// StatusbarPart must be registered or renderStatusBarPart throws "Part not found".
			...getStatusBarServiceOverride(),
			// Slot files live in a memory VFS; restoring last-session editor URIs races that and FileNotFound-spams.
			...getViewsServiceOverride(undefined, undefined, false),
			...getLanguagesServiceOverride(),
			...getTextMateServiceOverride(),
			...getThemeServiceOverride(),
			...getStorageServiceOverride(),
			...getNotificationServiceOverride(),
			...getDialogsServiceOverride(),
			...getModelServiceOverride(),
			...getFilesServiceOverride(),
			...getExplorerServiceOverride(),
			...getOutlineServiceOverride(),
			...getMarkersServiceOverride(),
			...getSearchServiceOverride(),
			...getScmServiceOverride(),
			// Re-apply keybindings AFTER views so CODE-open keeps global chords alive even if
			// the editor part is soft-hidden (visibility:hidden still fails isEditorPartVisible).
			...getKeybindingsServiceOverride({
				shouldUseGlobalKeybindings: function () {
					try {
						if (typeof window !== "undefined" && window.code) return true;
					} catch (e) {}
					try {
						return isEditorPartVisible();
					} catch (e2) {
						return false;
					}
				},
			}),
			// Standalone CODE editors still need the workbench command palette (F1).
			...getQuickAccessServiceOverride({
				shouldUseGlobalPicker: function () {
					try {
						if (typeof window !== "undefined" && window.code) return true;
					} catch (e) {}
					try {
						return isEditorPartVisible();
					} catch (e2) {
						return true;
					}
				},
			}),
		},
		host,
		{
			// Keep marketplace disabled; empty service URLs avoid gallery probes.
			productConfiguration: {
				nameShort: "CODE",
				nameLong: "AdventureLand CODE",
				applicationName: "adventureland-code",
				dataFolderName: ".adventureland-code",
				extensionsGallery: {
					serviceUrl: "",
					controlUrl: "",
					extensionUrlTemplate: "",
					resourceUrlTemplate: "",
					nlsBaseUrl: "",
				},
			},
			workspaceProvider: {
				workspace: { folderUri: monaco.Uri.parse("file:///adventureland/") },
				trusted: true,
				open: function () {
					return Promise.resolve(false);
				},
			},
		},
	);

	try {
		StandaloneServices.get(ILoggerService).setLogLevel(LogLevel.Warning);
	} catch (e) {}

	try {
		var editors = document.getElementById("al-vscode-editors");
		if (editors) renderEditorPart(editors);
	} catch (e) {
		console.warn("[ALVscodeApi] renderEditorPart failed", e);
	}

	try {
		initSlotFiles();
		ensureActiveEditorSlotSync(syncActiveSlotFromWorkbench);
	} catch (e) {
		console.warn("[ALVscodeApi] initSlotFiles failed", e);
	}

	try {
		await registerCodeIdeIconTheme();
	} catch (eIcons) {
		console.warn("[ALVscodeApi] registerCodeIdeIconTheme", eIcons);
	}

	try {
		await flattenCodeWorkspaceFolders();
	} catch (eFlat) {
		console.warn("[ALVscodeApi] flattenCodeWorkspaceFolders", eFlat);
	}

	try {
		registerCurrentCharacterDecorations();
		registerRunningCodeDecorations();
		registerSlotNumberDecorations();
		registerStatusBarExtraCommands();
		registerAdventureLandGameCommands();
	} catch (eDeco) {
		console.warn("[ALVscodeApi] decorations / status extras / game commands register failed", eDeco);
	}

	try {
		registerALCodeQuickAccess();
	} catch (e) {
		console.warn("[ALVscodeApi] registerALCodeQuickAccess failed", e);
	}

	var pixelReady = false;
	try {
		await registerPixelTheme();
		pixelReady = true;
	} catch (e) {
		console.warn("[ALVscodeApi] pixel theme registration failed", e);
	}

	try {
		await registerBuiltinToolExtensions();
	} catch (eTools) {
		console.warn("[ALVscodeApi] builtin tool extensions failed", eTools);
	}

	userConfigState = defaultUserConfig();
	try {
		curateStockSettingsToc();
	} catch (eCurate) {
		console.warn("[ALVscodeApi] curateStockSettingsToc", eCurate);
	}
	var storedPrefs = readAlPrefsFromLocalStorage();
	if (storedPrefs) {
		await syncFromAlPrefs(storedPrefs);
	} else {
		await mergeUserConfiguration(prefsToConfigurationPartial({}));
	}
	try {
		resyncHostedPartThemeVars();
		scheduleResyncHostedPartThemeVars(0);
		scheduleResyncHostedPartThemeVars(120);
		scheduleResyncHostedPartThemeVars(400);
	} catch (eResync) {}
	try {
		var themeSvc = StandaloneServices.get(IWorkbenchThemeService);
		if (themeSvc && themeSvc.onDidColorThemeChange) {
			themeSvc.onDidColorThemeChange(function () {
				scheduleResyncHostedPartThemeVars(0);
			});
		}
	} catch (eThemeListen) {
		console.warn("[ALVscodeApi] onDidColorThemeChange", eThemeListen);
	}
	try {
		if (typeof mountSidebar === "function") {
			var sb = document.getElementById("code-ide-sidebar-body");
			if (sb && sb.dataset.alSidebarMounted === "1") mountSidebar(sb);
		}
	} catch (eMount) {}
	wireConfigurationBridge();

	try {
		// Tab cycle: chrome.js capture is primary for browser-stolen chords (Ctrl+Tab/Page*).
		// AL save/run/palette chords: workbench keybindings (primary when IDE focused).
		await updateUserKeybindings(
			JSON.stringify(
				[
					{ key: "ctrl+alt+right", command: "workbench.action.nextEditor" },
					{ key: "ctrl+alt+left", command: "workbench.action.previousEditor" },
					{ key: "ctrl+shift+pagedown", command: "workbench.action.nextEditor" },
					{ key: "ctrl+shift+pageup", command: "workbench.action.previousEditor" },
					{ key: "ctrl+shift+]", command: "workbench.action.nextEditor" },
					{ key: "ctrl+shift+[", command: "workbench.action.previousEditor" },
					{ key: "ctrl+pagedown", command: "workbench.action.nextEditor" },
					{ key: "ctrl+pageup", command: "workbench.action.previousEditor" },
					{ key: "ctrl+tab", command: "workbench.action.nextEditor" },
					{ key: "ctrl+shift+tab", command: "workbench.action.previousEditor" },
					{ key: "ctrl+1", command: "-workbench.action.focusFirstEditorGroup" },
					{ key: "ctrl+2", command: "-workbench.action.focusSecondEditorGroup" },
					{ key: "ctrl+3", command: "-workbench.action.focusThirdEditorGroup" },
					{ key: "cmd+1", command: "-workbench.action.focusFirstEditorGroup" },
					{ key: "cmd+2", command: "-workbench.action.focusSecondEditorGroup" },
					{ key: "cmd+3", command: "-workbench.action.focusThirdEditorGroup" },
					{ key: "alt+1", command: "workbench.action.openEditorAtIndex1" },
					{ key: "alt+2", command: "workbench.action.openEditorAtIndex2" },
					{ key: "alt+3", command: "workbench.action.openEditorAtIndex3" },
					{ key: "alt+4", command: "workbench.action.openEditorAtIndex4" },
					{ key: "alt+5", command: "workbench.action.openEditorAtIndex5" },
					{ key: "alt+6", command: "workbench.action.openEditorAtIndex6" },
					{ key: "alt+7", command: "workbench.action.openEditorAtIndex7" },
				].concat(adventureLandKeybindingEntries()),
				null,
				2,
			),
		);
	} catch (e) {
		console.warn("[ALVscodeApi] updateUserKeybindings", e);
	}

	window.monaco = monaco;
	window.MONACO_VERSION = "vscode-api";
	// Always keep a fallback — esbuild can rewrite `monaco.languages.typescript = …`
	// onto the languages import binding, which is not always the same object as
	// window.monaco.languages at runtime.
	window.__AL_MONACO_TYPESCRIPT__ = monacoTypescript;
	try {
		window.monaco.languages.typescript = monacoTypescript;
	} catch (e) {
		console.warn("[ALVscodeApi] failed to attach typescript language API", e);
	}
	function runCommand(id, ...args) {
		try {
			return StandaloneServices.get(ICommandService).executeCommand(id, ...args);
		} catch (err) {
			console.warn("[ALVscodeApi] command failed", id, err);
			return Promise.resolve();
		}
	}

	window.ALVscodeApi = {
		ready: true,
		build: 2693,
		pixelThemeId: pixelReady ? PIXEL_THEME_ID : null,
		workbenchOwnsTabs: true,
		settingsQuery: AL_SETTINGS_QUERY,
		updateUserConfiguration: updateUserConfiguration,
		mergeUserConfiguration: mergeUserConfiguration,
		syncFromAlPrefs: syncFromAlPrefs,
		getUserConfigurationState: function () {
			return userConfigState ? Object.assign({}, userConfigState) : defaultUserConfig();
		},
		updateUserKeybindings: updateUserKeybindings,
		setColorTheme: setColorTheme,
		showWorkbench: showWorkbenchHost,
		hideWorkbench: hideWorkbenchHost,
		ensureSlotFile: ensureSlotFile,
		ensureTypeLibFile: ensureTypeLibFile,
		typeLibUri: typeLibUri,
		openSlotEditor: openSlotEditor,
		closeSlotEditor: closeSlotEditor,
		markSlotEditorClean: markSlotEditorClean,
		getActiveCodeEditor: getActiveCodeEditor,
		getActiveSlot: getActiveSlot,
		slotUri: slotUri,
		slotFromUri: slotFromUri,
		syncRosterFiles: syncRosterFiles,
		openTypeLibEditor: openTypeLibEditor,
		setCurrentCharacterSlot: setCurrentCharacterSlot,
		refreshCurrentCharacterDecoration: refreshCurrentCharacterDecoration,
		setRunningCodeSlot: setRunningCodeSlot,
		refreshSlotNumberDecorations: refreshSlotNumberDecorations,
		mountOutline: mountOutline,
		mountSidebar: mountSidebar,
		focusOutline: focusOutline,
		focusExplorer: focusExplorer,
		focusSearch: focusSearch,
		mountProblems: mountProblems,
		focusProblems: focusProblems,
		layoutProblems: layoutProblems,
		focusSpellView: focusSpellView,
		listSpellIssues: listSpellIssues,
		syncSpellPanelBadge: syncSpellPanelBadge,
		refreshSpellDiagnostics: refreshSpellDiagnostics,
		mountStatusBar: mountStatusBar,
		refreshStatusBarExtras: refreshStatusBarExtras,
		noteFileSaved: noteFileSaved,
		executeCommand: runCommand,
		showCommands: function () {
			prepareQuickInputHost();
			return Promise.resolve(runCommand("workbench.action.showCommands")).finally(function () {
				restoreWorkbenchAfterQuickInput();
			});
		},
		/** VS Code Quick Open (Ctrl+P) — slots + actions via workbench quick-input. */
		quickOpen: function () {
			prepareQuickInputHost();
			var opened;
			try {
				var qi = StandaloneServices.get(IQuickInputService);
				if (qi && qi.quickAccess && typeof qi.quickAccess.show === "function") {
					opened = Promise.resolve(qi.quickAccess.show(""));
				}
			} catch (e) {
				console.warn("[ALVscodeApi] quickAccess.show", e);
			}
			if (!opened) opened = Promise.resolve(runCommand("workbench.action.quickOpen"));
			return opened.finally(function () {
				restoreWorkbenchAfterQuickInput();
			});
		},
		openSettings: function (opts) {
			opts = opts || {};
			// Settings opens as a real workbench editor tab (same strip as code files).
			// Pass query to filter (e.g. "@tag:adventureland"); default is unfiltered VS Code Settings.
			return afterWorkbenchLayout(function () {
				return mergeUserConfiguration({ "workbench.editor.useModal": "off" }).then(function () {
					function activeGroupId() {
						try {
							var groups = StandaloneServices.get(IEditorGroupsService);
							if (groups && groups.activeGroup) return groups.activeGroup.id;
						} catch (e) {}
						return undefined;
					}
					function tryOpen(query) {
						try {
							var prefs = StandaloneServices.get(IPreferencesService);
							if (prefs && typeof prefs.openSettings === "function") {
								var openOpts = { jsonEditor: !!opts.jsonEditor };
								var gid = activeGroupId();
								if (gid !== undefined) openOpts.groupId = gid;
								if (query) openOpts.query = String(query);
								return Promise.resolve(prefs.openSettings(openOpts));
							}
						} catch (e) {
							console.warn("[ALVscodeApi] IPreferencesService", e);
						}
						return Promise.resolve(runCommand("workbench.action.openSettings2"));
					}
					var q = opts.query;
					if (q === undefined) q = "";
					return tryOpen(q).catch(function (err) {
						console.warn("[ALVscodeApi] openSettings", err);
						if (q) return tryOpen("").catch(function () {});
					});
				});
			});
		},
		openKeybindings: function (opts) {
			opts = opts || {};
			return afterWorkbenchLayout(function () {
				return mergeUserConfiguration({ "workbench.editor.useModal": "off" }).then(function () {
					try {
						var prefs = StandaloneServices.get(IPreferencesService);
						if (prefs && typeof prefs.openGlobalKeybindingSettings === "function") {
							var kbOpts = {};
							try {
								var groups = StandaloneServices.get(IEditorGroupsService);
								if (groups && groups.activeGroup) kbOpts.groupId = groups.activeGroup.id;
							} catch (eG) {}
							return Promise.resolve(prefs.openGlobalKeybindingSettings(false, kbOpts)).catch(function (err) {
								console.warn("[ALVscodeApi] openKeybindings UI", err);
								return prefs.openGlobalKeybindingSettings(true, kbOpts);
							});
						}
					} catch (e) {
						console.warn("[ALVscodeApi] IPreferencesService keybindings", e);
					}
					return runCommand("workbench.action.openGlobalKeybindings");
				});
			});
		},
	};
	try {
		// Re-register AL .d.ts into the workbench VFS now that FileService exists.
		if (typeof window !== "undefined" && window.ALEditor && typeof window.ALEditor.registerTypes === "function") {
			window.ALEditor.registerTypes(true);
		}
	} catch (eReg) {
		console.warn("[ALVscodeApi] registerTypes after boot", eReg);
	}
	return window.ALVscodeApi;
}

window.ALVscodeApiReady = boot().catch(function (err) {
	console.error("[ALVscodeApi] boot failed", err);
	throw err;
});
