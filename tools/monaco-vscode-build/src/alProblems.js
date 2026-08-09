/**
 * Host the stock VS Code Problems (Markers) view inside AL's bottom panel slot.
 * getMarkersServiceOverride() registers the view; this mounts PANEL_PART and opens it.
 */
import { renderPanelPart, setPartVisibility, Parts } from "@codingame/monaco-vscode-views-service-override";
import { StandaloneServices } from "@codingame/monaco-vscode-api/services";
import { IViewsService } from "@codingame/monaco-vscode-api/vscode/vs/workbench/services/views/common/viewsService.service";
import { scheduleLayoutHostedPart } from "./alPartLayout.js";
import { syncSpellPanelBadge } from "./alSpellView.js";

var MARKERS_CONTAINER_ID = "workbench.panel.markers";
var MARKERS_VIEW_ID = "workbench.panel.markers.view";

var mountDisposable = null;
var mountContainer = null;

function relayout() {
	scheduleLayoutHostedPart(Parts.PANEL_PART, mountContainer);
}

function openProblemsView(focus) {
	var views = StandaloneServices.get(IViewsService);
	return Promise.resolve(views.openViewContainer(MARKERS_CONTAINER_ID, !!focus))
		.then(function () {
			return views.openView(MARKERS_VIEW_ID, !!focus);
		})
		.then(function (view) {
			if (view && typeof view.setExpanded === "function") {
				view.setExpanded(true);
			}
			relayout();
			return view;
		});
}

/**
 * Attach the workbench panel (Markers / Problems) into `container`.
 * Safe to call repeatedly; subsequent calls re-open Problems and re-layout.
 * @param {HTMLElement} container
 * @returns {Promise<boolean>}
 */
export function mountProblems(container) {
	if (!container) return Promise.resolve(false);

	try {
		setPartVisibility(Parts.PANEL_PART, true);
	} catch (eVis) {
		console.warn("[ALProblems] setPartVisibility", eVis);
	}

	if (mountContainer === container && container.dataset.alProblemsMounted === "1") {
		return openProblemsView(false)
			.then(function () {
				try {
					syncSpellPanelBadge();
				} catch (eSpell) {}
				return true;
			})
			.catch(function (e) {
				console.warn("[ALProblems] openView", e);
				relayout();
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
		container.classList.add("al-vscode-problems-host");
		mountDisposable = renderPanelPart(container);
		container.dataset.alProblemsMounted = "1";
		mountContainer = container;
	} catch (e) {
		console.warn("[ALProblems] renderPanelPart failed", e);
		return Promise.resolve(false);
	}

	return openProblemsView(false)
		.then(function () {
			relayout();
			try {
				// Panel composite bar exists — same moment Markers activity is visible.
				syncSpellPanelBadge();
			} catch (eSpell) {}
			return true;
		})
		.catch(function (e) {
			console.warn("[ALProblems] openView failed", e);
			relayout();
			return !!mountDisposable;
		});
}

/** Focus the stock Problems view. */
export function focusProblems() {
	try {
		return openProblemsView(true);
	} catch (e) {
		console.warn("[ALProblems] focusProblems", e);
		return Promise.resolve(null);
	}
}

/** Re-layout hosted PANEL after AL collapse/maximize height changes. */
export function layoutProblems() {
	relayout();
}
