/**
 * Host the stock VS Code status bar (Problems counts, language, selection, etc.).
 */
import { renderStatusBarPart } from "@codingame/monaco-vscode-views-service-override";
import { mountStatusBarExtras } from "./alStatusBarExtras.js";

var mountDisposable = null;
var mountContainer = null;

/**
 * @param {HTMLElement} container
 * @returns {boolean}
 */
export function mountStatusBar(container) {
	if (!container) return false;

	if (mountContainer === container && container.dataset.alStatusBarMounted === "1") {
		try {
			mountStatusBarExtras();
		} catch (eExtra) {}
		return true;
	}

	if (mountDisposable && typeof mountDisposable.dispose === "function") {
		try {
			mountDisposable.dispose();
		} catch (eDisp) {}
		mountDisposable = null;
	}

	try {
		container.innerHTML = "";
		container.classList.add("al-vscode-statusbar-host");
		mountDisposable = renderStatusBarPart(container);
		container.dataset.alStatusBarMounted = "1";
		mountContainer = container;
		try {
			mountStatusBarExtras();
		} catch (eExtras) {
			console.warn("[ALStatusBar] mountStatusBarExtras", eExtras);
		}
		return true;
	} catch (e) {
		console.warn("[ALStatusBar] renderStatusBarPart failed", e);
		return false;
	}
}
