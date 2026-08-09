/**
 * Host the stock VS Code Outline view (IOutlineService / OutlinePane) inside AL's sidebar slot.
 * getOutlineServiceOverride() registers the service + view; this mounts SIDEBAR_PART and opens `outline`.
 */
import { renderSidebarPart, setPartVisibility, Parts } from "@codingame/monaco-vscode-views-service-override";
import { StandaloneServices } from "@codingame/monaco-vscode-api/services";
import { IViewsService } from "@codingame/monaco-vscode-api/vscode/vs/workbench/services/views/common/viewsService.service";

var OUTLINE_VIEW_ID = "outline";
var EXPLORER_CONTAINER_ID = "workbench.view.explorer";

var mountDisposable = null;
var mountContainer = null;

function openOutlineView() {
	var views = StandaloneServices.get(IViewsService);
	return Promise.resolve(views.openViewContainer(EXPLORER_CONTAINER_ID, false))
		.then(function () {
			return views.openView(OUTLINE_VIEW_ID, false);
		})
		.then(function (view) {
			if (view && typeof view.setExpanded === "function") {
				view.setExpanded(true);
			}
			return view;
		});
}

/**
 * Attach the workbench sidebar (Explorer container → Outline pane) into `container`.
 * Safe to call repeatedly; subsequent calls re-open / expand Outline and re-layout.
 * @param {HTMLElement} container
 * @returns {Promise<boolean>}
 */
export function mountOutline(container) {
	if (!container) return Promise.resolve(false);

	try {
		setPartVisibility(Parts.SIDEBAR_PART, true);
	} catch (eVis) {
		console.warn("[ALOutline] setPartVisibility", eVis);
	}

	if (mountContainer === container && container.dataset.alOutlineMounted === "1") {
		return openOutlineView()
			.then(function () {
				return true;
			})
			.catch(function (e) {
				console.warn("[ALOutline] openView", e);
				return true;
			});
	}

	if (mountDisposable && typeof mountDisposable.dispose === "function") {
		try {
			mountDisposable.dispose();
		} catch (eDisp) {}
		mountDisposable = null;
	}

	try {
		container.innerHTML = "";
		container.classList.add("al-vscode-outline-host");
		mountDisposable = renderSidebarPart(container);
		container.dataset.alOutlineMounted = "1";
		mountContainer = container;
	} catch (e) {
		console.warn("[ALOutline] renderSidebarPart failed", e);
		return Promise.resolve(false);
	}

	return openOutlineView()
		.then(function () {
			return true;
		})
		.catch(function (e) {
			console.warn("[ALOutline] openView failed", e);
			return !!mountDisposable;
		});
}

/** Focus the stock Outline view (command `outline.focus`). */
export function focusOutline() {
	try {
		var views = StandaloneServices.get(IViewsService);
		return Promise.resolve(views.openView(OUTLINE_VIEW_ID, true));
	} catch (e) {
		console.warn("[ALOutline] focusOutline", e);
		return Promise.resolve(null);
	}
}
