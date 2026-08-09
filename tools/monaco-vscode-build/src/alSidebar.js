/**
 * Host stock VS Code SIDEBAR_PART (Explorer + Outline + Search) in AL's sidebar slot.
 */
import { renderSidebarPart, setPartVisibility, Parts } from "@codingame/monaco-vscode-views-service-override";
import { StandaloneServices } from "@codingame/monaco-vscode-api/services";
import { IViewsService } from "@codingame/monaco-vscode-api/vscode/vs/workbench/services/views/common/viewsService.service";
import { layoutHostedPart, scheduleLayoutHostedPart } from "./alPartLayout.js";

var EXPLORER_CONTAINER_ID = "workbench.view.explorer";
var OUTLINE_VIEW_ID = "outline";
var SEARCH_VIEW_ID = "workbench.view.search";
var SEARCH_CONTAINER_ID = "workbench.view.search";

var mountDisposable = null;
var mountContainer = null;
var visibilityListener = null;
var searchWarmed = false;

function relayout() {
	scheduleLayoutHostedPart(Parts.SIDEBAR_PART, mountContainer);
}

/** Immediate layout (no rAF defer) — used when Search becomes visible so inputs paint this frame. */
function relayoutNow() {
	layoutHostedPart(Parts.SIDEBAR_PART, mountContainer);
}

function layoutActiveSearchView() {
	if (!mountContainer) return;
	try {
		var views = StandaloneServices.get(IViewsService);
		var view = views.getActiveViewWithId(SEARCH_VIEW_ID) || views.getViewWithId(SEARCH_VIEW_ID);
		if (!view) return;
		var w = mountContainer.clientWidth || mountContainer.offsetWidth || 0;
		var h = mountContainer.clientHeight || mountContainer.offsetHeight || 0;
		if (!w || !h) return;
		// ViewPane.layout(height, width) in stock VS Code.
		if (typeof view.layout === "function") {
			var titleEl = mountContainer.querySelector(".part > .title") || mountContainer.querySelector(".composite.header-or-footer") || mountContainer.querySelector(".composite.title");
			var reserve = titleEl ? Math.ceil(titleEl.getBoundingClientRect().height) : 35;
			view.layout(Math.max(1, h - Math.max(35, reserve)), w);
		}
		if (typeof view.focus === "function") {
			try {
				view.focus();
			} catch (eFocus) {}
		}
	} catch (e) {}
}

function ensureVisibilityLayoutHook() {
	if (visibilityListener) return;
	try {
		var views = StandaloneServices.get(IViewsService);
		visibilityListener = views.onDidChangeViewContainerVisibility(function (e) {
			if (!e || !e.visible || !mountContainer) return;
			// Activity-bar clicks open Search without going through focusSearch() —
			// layout immediately so Search/Replace inputs aren't stuck at 0 size.
			relayoutNow();
			if (e.id === SEARCH_CONTAINER_ID) {
				layoutActiveSearchView();
				if (typeof requestAnimationFrame === "function") {
					requestAnimationFrame(function () {
						relayoutNow();
						layoutActiveSearchView();
					});
				}
			} else {
				relayout();
			}
		});
	} catch (e) {
		console.warn("[ALSidebar] onDidChangeViewContainerVisibility", e);
	}
}

/**
 * Default: Explorer container with Outline expanded.
 * Do not open Search here — that swaps the active viewlet and leaves an empty Search shell.
 */
function openExplorerSidebar(focusId) {
	var views = StandaloneServices.get(IViewsService);
	return Promise.resolve(views.openViewContainer(EXPLORER_CONTAINER_ID, focusId === "explorer" || !focusId))
		.then(function () {
			return views.openView(OUTLINE_VIEW_ID, focusId === "outline");
		})
		.then(function (outlineView) {
			if (outlineView && typeof outlineView.setExpanded === "function") {
				outlineView.setExpanded(true);
			}
			if (focusId === "outline") return views.openView(OUTLINE_VIEW_ID, true);
			if (focusId === "explorer") return views.openViewContainer(EXPLORER_CONTAINER_ID, true);
			return null;
		})
		.then(function (result) {
			relayout();
			return result;
		});
}

function openSearchSidebar() {
	var views = StandaloneServices.get(IViewsService);
	return Promise.resolve(views.openViewContainer(SEARCH_CONTAINER_ID, true))
		.then(function () {
			return views.openView(SEARCH_VIEW_ID, true);
		})
		.then(function (result) {
			relayoutNow();
			layoutActiveSearchView();
			relayout();
			return result;
		});
}

/**
 * Construct SearchView once in the background so the first activity-bar click
 * does not pay the cold create-widget cost (blank shell until inputs appear).
 */
function warmSearchView() {
	if (searchWarmed || !mountContainer) return;
	searchWarmed = true;
	var run = function () {
		if (!mountContainer || !mountContainer.isConnected) return;
		var views = StandaloneServices.get(IViewsService);
		Promise.resolve(views.openViewContainer(SEARCH_CONTAINER_ID, false))
			.then(function () {
				return views.openView(SEARCH_VIEW_ID, false);
			})
			.then(function () {
				relayoutNow();
				layoutActiveSearchView();
				return views.openViewContainer(EXPLORER_CONTAINER_ID, false);
			})
			.then(function () {
				return views.openView(OUTLINE_VIEW_ID, false);
			})
			.then(function () {
				relayout();
			})
			.catch(function (e) {
				console.warn("[ALSidebar] warmSearchView", e);
				searchWarmed = false;
			});
	};
	if (typeof requestIdleCallback === "function") {
		requestIdleCallback(run, { timeout: 1200 });
	} else {
		setTimeout(run, 0);
	}
}

/**
 * @param {HTMLElement} container
 * @returns {Promise<boolean>}
 */
export function mountSidebar(container) {
	if (!container) return Promise.resolve(false);

	try {
		setPartVisibility(Parts.SIDEBAR_PART, true);
	} catch (eVis) {
		console.warn("[ALSidebar] setPartVisibility", eVis);
	}

	// Already mounted — only remeasure. Never force Explorer here: refresh_explorer /
	// schedule_refresh_outline call mountSidebar often and were yanking Search → Explorer.
	if (mountContainer === container && container.dataset.alSidebarMounted === "1") {
		relayout();
		return Promise.resolve(true);
	}

	if (mountDisposable && typeof mountDisposable.dispose === "function") {
		try {
			mountDisposable.dispose();
		} catch (eDisp) {}
		mountDisposable = null;
	}
	if (visibilityListener && typeof visibilityListener.dispose === "function") {
		try {
			visibilityListener.dispose();
		} catch (eVisL) {}
		visibilityListener = null;
	}
	searchWarmed = false;

	try {
		container.innerHTML = "";
		container.classList.add("al-vscode-sidebar-host");
		mountDisposable = renderSidebarPart(container);
		container.dataset.alSidebarMounted = "1";
		mountContainer = container;
	} catch (e) {
		console.warn("[ALSidebar] renderSidebarPart failed", e);
		return Promise.resolve(false);
	}

	ensureVisibilityLayoutHook();

	return openExplorerSidebar(null)
		.then(function () {
			relayout();
			warmSearchView();
			return true;
		})
		.catch(function (e) {
			console.warn("[ALSidebar] openViews failed", e);
			relayout();
			return !!mountDisposable;
		});
}

/** @deprecated use mountSidebar — kept for ALVscodeApi.mountOutline callers */
export function mountOutline(container) {
	return mountSidebar(container);
}

export function focusOutline() {
	try {
		return openExplorerSidebar("outline");
	} catch (e) {
		console.warn("[ALSidebar] focusOutline", e);
		return Promise.resolve(null);
	}
}

export function focusExplorer() {
	try {
		return openExplorerSidebar("explorer");
	} catch (e) {
		console.warn("[ALSidebar] focusExplorer", e);
		return Promise.resolve(null);
	}
}

export function focusSearch() {
	try {
		return openSearchSidebar();
	} catch (e) {
		console.warn("[ALSidebar] focusSearch", e);
		return Promise.resolve(null);
	}
}
