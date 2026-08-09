/**
 * After render*Part + openView, codingame SplitViews can stay at height 0 until
 * Part.layout runs with the real host size.
 */
import { Parts } from "@codingame/monaco-vscode-views-service-override";
import { StandaloneServices } from "@codingame/monaco-vscode-api/services";
import { ILayoutService } from "@codingame/monaco-vscode-api/vscode/vs/platform/layout/browser/layoutService.service";

var CONTENT_SELECTORS = [
	".composite.viewlet",
	".monaco-pane-view",
	".monaco-split-view2",
	".split-view-container",
	".markers-panel-container",
	".search-view",
	// Do NOT include .pane-body — Explorer+Outline share a split; forcing every pane-body
	// to full host height stacks opaque panes and washes out the lower sidebar.
];

/** Hosts that already received --vscode-* copies (full sync is ~2k props — avoid per-layout). */
var themeSyncedHosts = typeof WeakSet !== "undefined" ? new WeakSet() : null;
var themeSyncedFallback = [];
/** @type {WeakMap<HTMLElement, number>|null} */
var themeRetryCounts = typeof WeakMap !== "undefined" ? new WeakMap() : null;

var HOST_IDS = ["code-ide-sidebar-body", "code-ide-problems-body", "al-vscode-problems"];

/**
 * @param {string} color
 * @returns {number|null} relative luminance 0–1, or null if unparseable
 */
function colorLuminance(color) {
	if (!color) return null;
	var s = String(color).trim().toLowerCase();
	var r;
	var g;
	var b;
	var m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s);
	if (m) {
		var hex = m[1];
		if (hex.length === 3) {
			r = parseInt(hex[0] + hex[0], 16);
			g = parseInt(hex[1] + hex[1], 16);
			b = parseInt(hex[2] + hex[2], 16);
		} else {
			r = parseInt(hex.slice(0, 2), 16);
			g = parseInt(hex.slice(2, 4), 16);
			b = parseInt(hex.slice(4, 6), 16);
		}
	} else {
		m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(s);
		if (!m) return null;
		r = parseFloat(m[1]);
		g = parseFloat(m[2]);
		b = parseFloat(m[3]);
	}
	return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function isLightColor(color) {
	var lum = colorLuminance(color);
	return lum != null && lum > 0.7;
}

function isDarkColor(color) {
	var lum = colorLuminance(color);
	return lum != null && lum < 0.35;
}

/**
 * @param {HTMLElement} wb
 */
function workbenchWantsDark(wb) {
	if (!wb) return false;
	if (wb.classList.contains("vs-dark") || wb.classList.contains("hc-black")) return true;
	var codeui = document.getElementById("codeui");
	if (codeui && codeui.classList.contains("theme-vs-dark")) return true;
	if (codeui && codeui.classList.contains("theme-pixel")) return true;
	if (codeui && codeui.classList.contains("theme-hc-black")) return true;
	return false;
}

/**
 * @param {HTMLElement} host
 */
function markThemeSynced(host) {
	if (themeSyncedHosts) themeSyncedHosts.add(host);
	else if (themeSyncedFallback.indexOf(host) === -1) themeSyncedFallback.push(host);
}

/**
 * @param {HTMLElement} host
 */
function isThemeSynced(host) {
	if (themeSyncedHosts && themeSyncedHosts.has(host)) return true;
	return themeSyncedFallback.indexOf(host) !== -1;
}

/**
 * @param {HTMLElement} host
 */
function scheduleThemeSyncRetry(host) {
	var count = themeRetryCounts && themeRetryCounts.get(host);
	if (typeof count !== "number") count = 0;
	if (count >= 12) return;
	if (themeRetryCounts) themeRetryCounts.set(host, count + 1);
	var delay = Math.min(250, 16 * Math.pow(2, Math.min(count, 4)));
	setTimeout(function () {
		syncWorkbenchThemeVars(host, { force: true });
	}, delay);
}

/**
 * HACK(monaco): AL hosts SIDEBAR/PANEL outside `.monaco-workbench`, so --vscode-* theme
 * vars (charts.blue, list.*, etc.) do not inherit and Explorer decorations stay gray.
 * Why: renderSidebarPart/renderPanelPart attach into #code-ide-* slots, not the editor workbench host
 * Purpose: file-decoration colors + themed chrome resolve in Explorer / Problems
 * Remove when: hosted parts live under the workbench root (or codingame applies theme vars to attachPart hosts)
 * @param {HTMLElement} host
 * @param {{force?: boolean}} [opts]
 */
function syncWorkbenchThemeVars(host, opts) {
	if (!host || typeof getComputedStyle !== "function") return;
	opts = opts || {};
	var wb = document.querySelector(".al-workbench-host.monaco-workbench");
	if (!wb || wb === host || wb.contains(host)) return;

	var styles = getComputedStyle(wb);
	var wbEditorBg = String(styles.getPropertyValue("--vscode-editor-background") || "").trim();
	var hostEditorBg = String(host.style.getPropertyValue("--vscode-editor-background") || "").trim();
	var wantDark = workbenchWantsDark(wb);

	// Skip only when already synced AND tokens still match the live workbench.
	// Early boot often caches light tokens; later layouts must detect the mismatch.
	if (!opts.force && isThemeSynced(host) && hostEditorBg && wbEditorBg && hostEditorBg === wbEditorBg) {
		if (!(wantDark && isLightColor(hostEditorBg))) return;
	}

	var i;
	for (i = 0; i < styles.length; i++) {
		var prop = styles[i];
		if (prop.indexOf("--vscode-") !== 0) continue;
		var val = styles.getPropertyValue(prop);
		// Empty custom props make `color: var(--x)` invalid → black/invisible list hover text.
		if (!val || !String(val).trim()) continue;
		host.style.setProperty(prop, val);
	}

	var listFgDefaults = {
		"--vscode-list-hoverForeground": "#cccccc",
		"--vscode-list-focusForeground": "#ffffff",
		"--vscode-list-activeSelectionForeground": "#ffffff",
		"--vscode-list-inactiveSelectionForeground": "#cccccc",
		"--vscode-list-inactiveFocusForeground": "#cccccc",
	};
	var keys = Object.keys(listFgDefaults);
	for (i = 0; i < keys.length; i++) {
		var key = keys[i];
		if (wantDark) {
			host.style.setProperty(key, listFgDefaults[key]);
			continue;
		}
		var cur = host.style.getPropertyValue(key) || getComputedStyle(host).getPropertyValue(key);
		if (!cur || !String(cur).trim()) host.style.setProperty(key, listFgDefaults[key]);
	}

	// Early boot can copy light tokens before workbench.colorTheme settles; if the
	// workbench is vs-dark, keep hosted SIDEBAR/PANEL on dark list/chrome backgrounds.
	if (wantDark) {
		var darkBgDefaults = {
			"--vscode-sideBar-background": "transparent",
			"--vscode-sideBarSectionHeader-background": "transparent",
			"--vscode-panel-background": "transparent",
			"--vscode-list-activeSelectionBackground": "#094771",
			"--vscode-list-inactiveSelectionBackground": "#37373d",
			"--vscode-list-hoverBackground": "rgba(255, 255, 255, 0.08)",
			"--vscode-list-focusBackground": "#094771",
			"--vscode-list-activeSelectionForeground": "#ffffff",
			"--vscode-list-focusForeground": "#ffffff",
			"--vscode-foreground": "#cccccc",
			"--vscode-sideBar-foreground": "#cccccc",
			"--vscode-sideBarTitle-foreground": "#cccccc",
			"--vscode-sideBarSectionHeader-foreground": "#cccccc",
		};
		var darkKeys = Object.keys(darkBgDefaults);
		for (i = 0; i < darkKeys.length; i++) {
			host.style.setProperty(darkKeys[i], darkBgDefaults[darkKeys[i]]);
		}
		host.classList.add("vs-dark");
	}

	if (!host.classList.contains("vs-dark") && wb.classList.contains("vs-dark")) {
		host.classList.add("vs-dark");
	}
	if (!host.classList.contains("vs") && wb.classList.contains("vs")) {
		host.classList.add("vs");
	}

	hostEditorBg = String(host.style.getPropertyValue("--vscode-editor-background") || "").trim();
	var settled = true;
	if (wantDark && isLightColor(wbEditorBg)) settled = false;
	if (wantDark && isLightColor(hostEditorBg)) settled = false;

	if (settled) {
		markThemeSynced(host);
		if (themeRetryCounts) themeRetryCounts.delete(host);
	} else {
		if (themeSyncedHosts) themeSyncedHosts.delete(host);
		var idx = themeSyncedFallback.indexOf(host);
		if (idx !== -1) themeSyncedFallback.splice(idx, 1);
		scheduleThemeSyncRetry(host);
	}
}

/** Call after setColorTheme so hosted parts pick up new tokens. */
export function invalidateHostedPartThemeVars() {
	themeSyncedHosts = typeof WeakSet !== "undefined" ? new WeakSet() : null;
	themeSyncedFallback = [];
	themeRetryCounts = typeof WeakMap !== "undefined" ? new WeakMap() : null;
}

/** Force re-copy theme tokens onto known CODE IDE part hosts (after theme settles). */
export function resyncHostedPartThemeVars() {
	invalidateHostedPartThemeVars();
	var i;
	for (i = 0; i < HOST_IDS.length; i++) {
		var el = document.getElementById(HOST_IDS[i]);
		if (el) syncWorkbenchThemeVars(el, { force: true });
	}
}

/**
 * Re-copy after a short delay (theme CSS vars often land a frame after setColorTheme).
 * @param {number} [ms]
 */
export function scheduleResyncHostedPartThemeVars(ms) {
	var delay = typeof ms === "number" ? ms : 50;
	setTimeout(function () {
		resyncHostedPartThemeVars();
		if (typeof requestAnimationFrame === "function") {
			requestAnimationFrame(function () {
				resyncHostedPartThemeVars();
			});
		}
	}, delay);
}

/**
 * Size SplitView chrome inside an attached part host.
 * @param {HTMLElement} host
 * @param {number} [titleReserve]
 */
function forceSplitViewGeometry(host, titleReserve) {
	if (!host) return;
	var titleEl = host.querySelector(".part > .title") || host.querySelector(".part > .header-or-footer") || host.querySelector(".composite.title") || host.querySelector(".composite.header-or-footer");
	var measured = titleEl ? Math.ceil(titleEl.getBoundingClientRect().height) : 0;
	var reserve = typeof titleReserve === "number" ? titleReserve : Math.max(35, measured || 35);
	var w = host.clientWidth || host.offsetWidth || 0;
	var h = host.clientHeight || host.offsetHeight || 0;
	if (!w || !h) return;
	var contentH = Math.max(1, h - reserve);
	var i;
	for (i = 0; i < CONTENT_SELECTORS.length; i++) {
		var nodes = host.querySelectorAll(CONTENT_SELECTORS[i]);
		var j;
		for (j = 0; j < nodes.length; j++) {
			var el = nodes[j];
			if (!el || !el.style) continue;
			el.style.width = w + "px";
			el.style.height = contentH + "px";
		}
	}
}

/**
 * @param {typeof Parts[keyof typeof Parts]} partId
 * @param {HTMLElement} host
 */
export function layoutHostedPart(partId, host) {
	if (!host || !host.isConnected) return;
	syncWorkbenchThemeVars(host);
	try {
		var layout = StandaloneServices.get(ILayoutService);
		var part = layout && typeof layout.getPart === "function" ? layout.getPart(partId) : null;
		if (part && typeof part.layout === "function") {
			var w = Math.max(part.minimumWidth || 0, host.clientWidth || host.offsetWidth || 0);
			var h = Math.max(part.minimumHeight || 0, host.clientHeight || host.offsetHeight || 0);
			if (w && h) {
				part.layout(w, h, host.offsetTop || 0, host.offsetLeft || 0);
			}
		}
	} catch (e) {
		console.warn("[ALParts] part.layout", partId, e);
	}
	// HACK(monaco): Part.layout alone leaves .split-view-container at height 0 in AL hosts
	// Why: openView races attachPart ResizeObserver; detached SIDEBAR/PANEL don't get SplitView geometry
	// Purpose: paint Explorer / Outline / Problems / Search instead of empty shell
	// Remove when: codingame layout reliably sizes split views after openView in render*Part hosts
	forceSplitViewGeometry(host);
}

/**
 * Run layout now and on the next frames (after openView paints).
 * @param {typeof Parts[keyof typeof Parts]} partId
 * @param {HTMLElement} host
 */
export function scheduleLayoutHostedPart(partId, host) {
	layoutHostedPart(partId, host);
	if (typeof requestAnimationFrame === "function") {
		requestAnimationFrame(function () {
			layoutHostedPart(partId, host);
			requestAnimationFrame(function () {
				layoutHostedPart(partId, host);
			});
		});
	} else {
		setTimeout(function () {
			layoutHostedPart(partId, host);
		}, 0);
	}
}

export { Parts };
