/**
 * SlotSession sidebar — hosts stock Explorer + Outline + Search (SIDEBAR_PART).
 * AL chrome: EXPLORER header with New file / docs (see chrome.js).
 */
(function (global) {
	"use strict";

	var S = global.ALCodeSessionState;
	if (!S) throw new Error("ALCodeSessionState missing — load session/state.js first");

	function ss(name) {
		return function () {
			var fn = global.SlotSession && global.SlotSession[name];
			if (typeof fn !== "function") {
				console.warn("[SlotSession.sidebar] missing " + name);
				return;
			}
			return fn.apply(null, arguments);
		};
	}

	var layout_editor = ss("layout_editor");
	var mountPromise = null;

	function vscodeApi() {
		return global.ALVscodeApi;
	}

	function mount_stock_sidebar() {
		var body = document.getElementById("code-ide-sidebar-body");
		if (!body) return Promise.resolve(false);
		var api = vscodeApi();
		if (!api || typeof api.mountSidebar !== "function") {
			return Promise.resolve(false);
		}
		if (mountPromise) return mountPromise;
		mountPromise = Promise.resolve(api.mountSidebar(body))
			.catch(function (e) {
				console.warn("[SlotSession.sidebar] mountSidebar", e);
				return false;
			})
			.finally(function () {
				mountPromise = null;
			});
		return mountPromise;
	}

	function when_api_ready(fn) {
		var api = vscodeApi();
		if (api && api.ready && typeof api.mountSidebar === "function") {
			fn();
			return;
		}
		var ready = global.ALVscodeApiReady;
		if (ready && typeof ready.then === "function") {
			ready.then(fn).catch(function () {});
		}
	}

	function ensure_sidebar_host() {
		if (!$("#code-ide-sidebar").length) return;
		if (!$("#code-ide-sidebar-body").length) {
			$("#code-ide-sidebar").append('<div id="code-ide-sidebar-body" class="code-ide-sidebar-body"></div>');
		}
		// Remove legacy custom explorer / outline chrome if present from older markup.
		$("#code-slot-explorer").remove();
		$("#code-ide-outline").remove();
		when_api_ready(function () {
			mount_stock_sidebar();
		});
	}

	function schedule_refresh_outline() {
		ensure_sidebar_host();
		if ($("#code-ide-sidebar").hasClass("collapsed") || (global.$ && $("#codeui").hasClass("explorer-collapsed"))) {
			return;
		}
		// mountSidebar is idempotent (relayout only when already mounted) — safe while Search is active.
		mount_stock_sidebar();
		layout_editor();
	}

	var SlotSession = global.SlotSession || (global.SlotSession = {});
	SlotSession.ensure_outline_panel = ensure_sidebar_host;
	SlotSession.ensure_sidebar_host = ensure_sidebar_host;
	SlotSession.schedule_refresh_outline = schedule_refresh_outline;
	SlotSession.mount_stock_sidebar = mount_stock_sidebar;
})(typeof window !== "undefined" ? window : globalThis);
