/**
 * SlotSession Problems — stock Markers PANEL_PART host + collapse affordance.
 * Fix-all via stock view/title + status bar (adventureland.code.eslintFixAll).
 */
(function (global) {
	"use strict";

	var S = global.ALCodeSessionState;
	if (!S) throw new Error("ALCodeSessionState missing — load session/state.js first");

	function ss(name) {
		return function () {
			var fn = global.SlotSession && global.SlotSession[name];
			if (typeof fn !== "function") {
				console.warn("[SlotSession.problems] missing " + name);
				return;
			}
			return fn.apply(null, arguments);
		};
	}

	var monaco_api = ss("monaco_api");
	var update_statusbar = ss("update_statusbar");
	var statusbar_markup = ss("statusbar_markup");
	var layout_editor = ss("layout_editor");
	var mountPromise = null;

	function problems_panel_markup() {
		return (
			'<div id="code-ide-problems" class="collapsed">' +
			'<button type="button" class="code-ide-problems-toggle" id="code-ide-problems-toggle" title="Toggle Problems panel" aria-label="Toggle Problems panel">' +
			'<span class="code-ide-problems-chevron" aria-hidden="true">▾</span>' +
			'<span class="code-ide-problems-toggle-label">Problems</span>' +
			"</button>" +
			'<div class="code-ide-problems-body" id="code-ide-problems-body"></div>' +
			"</div>"
		);
	}

	function vscodeApi() {
		return global.ALVscodeApi;
	}

	function mount_stock_problems() {
		var body = document.getElementById("code-ide-problems-body");
		if (!body) return Promise.resolve(false);
		var api = vscodeApi();
		if (!api || typeof api.mountProblems !== "function") {
			return Promise.resolve(false);
		}
		if (mountPromise) return mountPromise;
		mountPromise = Promise.resolve(api.mountProblems(body))
			.catch(function (e) {
				console.warn("[SlotSession.problems] mountProblems", e);
				return false;
			})
			.finally(function () {
				mountPromise = null;
			});
		return mountPromise;
	}

	function expand_problems_panel() {
		$("#code-ide-problems").removeClass("collapsed");
		layout_editor();
		mount_stock_problems().then(function () {
			var api = vscodeApi();
			if (api && typeof api.focusProblems === "function") {
				api.focusProblems();
			}
		});
	}

	function when_api_ready(fn) {
		var api = vscodeApi();
		if (api && api.ready && typeof api.mountProblems === "function") {
			fn();
			return;
		}
		var ready = global.ALVscodeApiReady;
		if (ready && typeof ready.then === "function") {
			ready.then(fn).catch(function () {});
			return;
		}
	}

	function run_fix_all() {
		var mapi = monaco_api();
		var model = mapi && mapi.getModel && mapi.getModel();
		if (global.ALEditor && typeof ALEditor.fixEslint === "function") {
			ALEditor.fixEslint(model);
		}
	}

	function ensure_problems_panel() {
		if (!$("#code-ide-editor-slot").length) return;
		if (!$("#code-ide-problems").length) {
			$("#code-ide-editor-slot").after(problems_panel_markup());
		} else if (!$("#code-ide-problems-body").length) {
			$("#code-ide-problems").replaceWith(problems_panel_markup());
			$("#code-ide-problems").data("al-bound", 0);
		}
		$(".code-ide-problems-bar, #code-ide-problems-fix-all, #code-ide-problems-badge").remove();
		if (!$("#code-ide-statusbar").length) {
			$("#code-ide-problems").after(statusbar_markup());
		}
		update_statusbar();
		if (!$("#code-ide-problems").data("al-bound")) {
			$("#code-ide-problems").data("al-bound", 1);
			$("#code-ide-problems-toggle").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				$("#code-ide-problems").toggleClass("collapsed");
				layout_editor();
				if (!$("#code-ide-problems").hasClass("collapsed")) {
					mount_stock_problems();
				}
			});
			if (global.monaco && typeof monaco.editor.onDidChangeMarkers === "function") {
				monaco.editor.onDidChangeMarkers(function () {
					refresh_problems_panel();
				});
			}
			refresh_problems_panel();
		}
		when_api_ready(function () {
			update_statusbar();
			if (!$("#code-ide-problems").hasClass("collapsed")) {
				mount_stock_problems();
			}
		});
	}

	function refresh_problems_panel() {
		update_statusbar();
	}

	function goto_next_problem(prev) {
		var mapi = monaco_api();
		if (mapi && typeof mapi.trigger === "function") {
			mapi.trigger("keyboard", prev ? "editor.action.marker.prev" : "editor.action.marker.next", null);
		}
	}

	var SlotSession = global.SlotSession || (global.SlotSession = {});
	Object.assign(SlotSession, {
		ensure_problems_panel: ensure_problems_panel,
		refresh_problems_panel: refresh_problems_panel,
		goto_next_problem: goto_next_problem,
		problems_panel_markup: problems_panel_markup,
		expand_problems_panel: expand_problems_panel,
		fix_all_eslint: run_fix_all,
	});
})(typeof window !== "undefined" ? window : globalThis);
