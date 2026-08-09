/**
 * SlotSession Outline panel — hosts the stock VS Code Outline view (IOutlineService).
 * AL chrome (header / collapse) stays; tree + sync come from monaco-vscode OutlinePane.
 */
(function (global) {
	"use strict";

	var S = global.ALCodeSessionState;
	if (!S) throw new Error("ALCodeSessionState missing — load session/state.js first");

	function ss(name) {
		return function () {
			var fn = global.SlotSession && global.SlotSession[name];
			if (typeof fn !== "function") {
				console.warn("[SlotSession.outline] missing " + name);
				return;
			}
			return fn.apply(null, arguments);
		};
	}

	var layout_editor = ss("layout_editor");
	var mountPromise = null;

	function outline_panel_markup() {
		return (
			'<div id="code-ide-outline">' +
			'<div class="code-ide-outline-head">' +
			'<button type="button" class="code-ide-outline-toggle" id="code-ide-outline-toggle" title="Toggle Outline">' +
			'<span class="code-ide-outline-chevron" aria-hidden="true">▾</span>' +
			'<span class="code-ide-sidebar-title">Outline</span>' +
			"</button>" +
			"</div>" +
			'<div class="code-ide-outline-body" id="code-ide-outline-body"></div>' +
			"</div>"
		);
	}

	function vscodeApi() {
		return global.ALVscodeApi;
	}

	function mount_stock_outline() {
		var body = document.getElementById("code-ide-outline-body");
		if (!body) return Promise.resolve(false);
		var api = vscodeApi();
		if (!api || typeof api.mountOutline !== "function") {
			return Promise.resolve(false);
		}
		if (mountPromise) return mountPromise;
		mountPromise = Promise.resolve(api.mountOutline(body))
			.catch(function (e) {
				console.warn("[SlotSession.outline] mountOutline", e);
				return false;
			})
			.finally(function () {
				mountPromise = null;
			});
		return mountPromise;
	}

	function ensure_outline_panel() {
		if (!$("#code-ide-sidebar").length) return;
		if (!$("#code-ide-outline").length) {
			$("#code-slot-explorer").after(outline_panel_markup());
		}
		if (!$("#code-ide-outline").data("al-bound")) {
			$("#code-ide-outline").data("al-bound", 1);
			$("#code-ide-outline-toggle").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				$("#code-ide-outline").toggleClass("collapsed");
				layout_editor();
				if (!$("#code-ide-outline").hasClass("collapsed")) {
					schedule_refresh_outline();
				}
			});
		}
		when_api_ready(function () {
			mount_stock_outline();
		});
	}

	function when_api_ready(fn) {
		var api = vscodeApi();
		if (api && api.ready && typeof api.mountOutline === "function") {
			fn();
			return;
		}
		var ready = global.ALVscodeApiReady;
		if (ready && typeof ready.then === "function") {
			ready
				.then(function () {
					fn();
				})
				.catch(function () {});
			return;
		}
		setTimeout(function () {
			when_api_ready(fn);
		}, 50);
	}

	function refresh_outline() {
		ensure_outline_panel();
		if ($("#code-ide-outline").hasClass("collapsed")) return;
		mount_stock_outline();
	}

	var refreshTimer = null;
	function schedule_refresh_outline() {
		if (refreshTimer) clearTimeout(refreshTimer);
		refreshTimer = setTimeout(function () {
			refreshTimer = null;
			refresh_outline();
		}, 80);
	}

	function show_quick_outline() {
		var api = vscodeApi();
		if (api && typeof api.executeCommand === "function") {
			Promise.resolve(api.executeCommand("editor.action.quickOutline")).catch(function () {});
			return;
		}
		var editor = null;
		if (api && typeof api.getActiveCodeEditor === "function") {
			try {
				editor = api.getActiveCodeEditor();
			} catch (e) {}
		}
		if (!editor && S.editor && S.editor._editor) editor = S.editor._editor;
		if (!editor || typeof editor.getAction !== "function") return;
		var action = editor.getAction("editor.action.quickOutline");
		if (action) action.run();
	}

	global.SlotSession = global.SlotSession || {};
	SlotSession.refresh_outline = refresh_outline;
	SlotSession.schedule_refresh_outline = schedule_refresh_outline;
	SlotSession.ensure_outline_panel = ensure_outline_panel;
	SlotSession.show_quick_outline = show_quick_outline;
})(typeof window !== "undefined" ? window : globalThis);
