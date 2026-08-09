/**
 * SlotSession Problems — stock Markers PANEL_PART host + collapse/maximize/sash.
 * Fix-all via stock view/title + status bar (adventureland.code.eslintFixAll).
 * Hotkeys: Ctrl+J toggle, F11 maximize (see alGameCommands + chrome capture).
 * Sash: drag to resize; double-click → ~⅔ of editor column (Cursor-like).
 */
(function (global) {
	"use strict";

	var S = global.ALCodeSessionState;
	if (!S) throw new Error("ALCodeSessionState missing — load session/state.js first");

	var MIN_HEIGHT = 100;
	var DEFAULT_HEIGHT = 220;
	var COLLAPSED_HEIGHT = 35;

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
	var titleActionsBound = false;
	var sashBound = false;

	function problems_panel_markup() {
		return (
			'<div id="code-ide-problems" class="collapsed">' +
			'<div class="code-ide-problems-sash" id="code-ide-problems-sash" role="separator" aria-orientation="horizontal" title="Drag to resize · Double-click for ⅔ height" aria-label="Resize Problems panel"></div>' +
			'<button type="button" class="code-ide-problems-toggle" id="code-ide-problems-toggle" title="Problems (Ctrl+J)" aria-label="Toggle Problems panel (Ctrl+J)">' +
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

	function problems_el() {
		return document.getElementById("code-ide-problems");
	}

	function is_collapsed() {
		var el = problems_el();
		return !!(el && el.classList.contains("collapsed"));
	}

	/** Available height for editor + problems inside #code-ide-main (below toolbar). */
	function main_work_height() {
		var main = document.getElementById("code-ide-main");
		var toolbar = document.getElementById("code-ide-toolbar");
		if (!main) return Math.floor(window.innerHeight * 0.55);
		var h = main.clientHeight - (toolbar ? toolbar.offsetHeight : 0);
		return h > 80 ? h : Math.floor(window.innerHeight * 0.55);
	}

	function two_thirds_height() {
		return Math.max(MIN_HEIGHT, Math.round(main_work_height() * (2 / 3)));
	}

	function clamp_problems_height(px) {
		var max = Math.max(MIN_HEIGHT, Math.floor(main_work_height() * 0.85));
		var n = Math.round(Number(px) || DEFAULT_HEIGHT);
		if (n < MIN_HEIGHT) n = MIN_HEIGHT;
		if (n > max) n = max;
		return n;
	}

	function persist_problems_height(px) {
		S.problems_height = px;
		try {
			localStorage.setItem(S.PROBLEMS_HEIGHT_KEY, String(px));
		} catch (e) {}
	}

	/**
	 * Apply a pixel height to the Problems panel (clears CSS “maximized” flex tricks).
	 * @param {number} px
	 * @param {{ expand?: boolean, persist?: boolean }} [opts]
	 */
	function apply_problems_height(px, opts) {
		opts = opts || {};
		var el = problems_el();
		if (!el) return;
		var h = clamp_problems_height(px);
		if (opts.expand !== false && el.classList.contains("collapsed")) {
			el.classList.remove("collapsed");
		}
		el.classList.remove("maximized");
		el.style.height = h + "px";
		el.style.maxHeight = h + "px";
		el.style.flex = "0 0 " + h + "px";
		if (opts.persist !== false) persist_problems_height(h);
		layout_editor();
		relayout_stock();
	}

	function restore_problems_height() {
		var h = S.problems_height || DEFAULT_HEIGHT;
		try {
			var stored = parseInt(localStorage.getItem(S.PROBLEMS_HEIGHT_KEY) || "", 10);
			if (isFinite(stored) && stored >= MIN_HEIGHT) h = stored;
		} catch (e) {}
		apply_problems_height(h, { expand: false, persist: false });
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
			.then(function (ok) {
				bind_title_actions(body);
				return ok;
			})
			.catch(function (e) {
				console.warn("[SlotSession.problems] mountProblems", e);
				return false;
			})
			.finally(function () {
				mountPromise = null;
			});
		return mountPromise;
	}

	function relayout_stock() {
		var api = vscodeApi();
		if (api && typeof api.layoutProblems === "function") {
			api.layoutProblems();
		}
	}

	/**
	 * Stock panel close/maximize aria labels when PANEL is detached from workbench.
	 * @param {EventTarget|null} target
	 * @returns {"close"|"maximize"|null}
	 */
	function title_action_kind(target) {
		if (!target || !target.closest) return null;
		var node = target.closest("[aria-label], [title], .action-label, .codicon");
		if (!node) return null;
		var label = ((node.getAttribute && (node.getAttribute("aria-label") || node.getAttribute("title"))) || "") + " " + (node.className || "");
		if (/Hide Panel|Close Panel|closePanel|panel-close|codicon-panel-close|\bcodicon-close\b/i.test(label)) return "close";
		if (/Maximize Panel|Restore Panel|toggleMaximized|panel-maximize|codicon-chevron-up|codicon-chevron-down/i.test(label)) return "maximize";
		return null;
	}

	function bind_title_actions(body) {
		if (!body || titleActionsBound) return;
		titleActionsBound = true;
		body.addEventListener(
			"click",
			function (e) {
				var kind = title_action_kind(e.target);
				if (kind === "close") {
					e.preventDefault();
					e.stopPropagation();
					collapse_problems_panel();
					return;
				}
				if (kind === "maximize") {
					e.preventDefault();
					e.stopPropagation();
					toggle_problems_maximize();
					return;
				}
				if (e.target && e.target.closest && e.target.closest(".title-actions, .global-actions")) return;
				if (!(e.target && e.target.closest && e.target.closest(".composite.title"))) return;

				if (is_collapsed()) {
					// Expand host; let stock composite-bar still select the clicked tab.
					expand_problems_panel();
					return;
				}

				// Expanded: click the already-active tab header to minimize (Cursor-like).
				// Clicks on other tabs keep switching views.
				var tab = e.target.closest(".composite-bar .action-item, .composite-bar-container .action-item");
				if (!tab) {
					// Bare title chrome (not a tab) — still toggle closed.
					e.preventDefault();
					e.stopPropagation();
					collapse_problems_panel();
					return;
				}
				if (tab.classList.contains("checked") || tab.getAttribute("aria-selected") === "true") {
					e.preventDefault();
					e.stopPropagation();
					collapse_problems_panel();
				}
			},
			true,
		);
	}

	function bind_problems_sash() {
		var sash = document.getElementById("code-ide-problems-sash");
		if (!sash || sashBound) return;
		sashBound = true;
		var dragging = false;
		var didDrag = false;
		var startY = 0;
		var startH = 0;
		var DRAG_THRESHOLD_PX = 4;

		sash.addEventListener("mousedown", function (e) {
			if (e.button !== 0) return;
			// Single click must not expand/jump — only drag past threshold or dblclick.
			e.preventDefault();
			e.stopPropagation();
			var el = problems_el();
			if (!el) return;
			dragging = true;
			didDrag = false;
			startY = e.clientY;
			startH = el.classList.contains("collapsed") ? COLLAPSED_HEIGHT : Math.round(el.getBoundingClientRect().height);
			el.classList.add("resizing");
			function onMove(ev) {
				if (!dragging) return;
				var dy = startY - ev.clientY;
				if (!didDrag && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
				if (!didDrag) {
					didDrag = true;
					var panel = problems_el();
					if (panel && panel.classList.contains("collapsed")) {
						panel.classList.remove("collapsed");
						// Start from collapsed strip height so drag feels continuous.
						startH = COLLAPSED_HEIGHT;
						mount_stock_problems();
					}
				}
				apply_problems_height(startH + dy, { persist: false });
			}
			function onUp() {
				if (!dragging) return;
				dragging = false;
				var panel = problems_el();
				if (panel) panel.classList.remove("resizing");
				document.removeEventListener("mousemove", onMove, true);
				document.removeEventListener("mouseup", onUp, true);
				if (!didDrag) return;
				var h = panel ? Math.round(panel.getBoundingClientRect().height) : startH;
				if (h <= COLLAPSED_HEIGHT + 8) {
					collapse_problems_panel();
					return;
				}
				persist_problems_height(clamp_problems_height(h));
				relayout_stock();
			}
			document.addEventListener("mousemove", onMove, true);
			document.addEventListener("mouseup", onUp, true);
		});

		sash.addEventListener("dblclick", function (e) {
			e.preventDefault();
			e.stopPropagation();
			var el = problems_el();
			if (!el) return;
			var target = two_thirds_height();
			var cur = el.classList.contains("collapsed") ? COLLAPSED_HEIGHT : Math.round(el.getBoundingClientRect().height);
			if (!el.classList.contains("collapsed") && Math.abs(cur - target) < 28) {
				var prev = DEFAULT_HEIGHT;
				try {
					var storedPrev = parseInt(localStorage.getItem(S.PROBLEMS_HEIGHT_PREV_KEY) || "", 10);
					if (isFinite(storedPrev) && storedPrev >= MIN_HEIGHT) prev = storedPrev;
					else if (S.problems_height && Math.abs(S.problems_height - target) >= 28) prev = S.problems_height;
				} catch (err) {}
				el.classList.remove("maximized");
				apply_problems_height(prev);
				return;
			}
			try {
				localStorage.setItem(S.PROBLEMS_HEIGHT_PREV_KEY, String(cur > COLLAPSED_HEIGHT ? cur : S.problems_height || DEFAULT_HEIGHT));
			} catch (err2) {}
			if (el.classList.contains("collapsed")) {
				el.classList.remove("collapsed");
				mount_stock_problems();
			}
			apply_problems_height(target);
			el.classList.add("maximized");
		});
	}

	function expand_problems_panel() {
		var el = problems_el();
		if (!el) return;
		el.classList.remove("collapsed");
		restore_problems_height();
		layout_editor();
		mount_stock_problems().then(function () {
			var api = vscodeApi();
			if (api && typeof api.focusProblems === "function") {
				api.focusProblems();
			}
			relayout_stock();
		});
	}

	function collapse_problems_panel() {
		var el = problems_el();
		if (!el) return;
		el.classList.add("collapsed");
		el.classList.remove("maximized");
		layout_editor();
		relayout_stock();
	}

	function toggle_problems_panel() {
		if (is_collapsed()) expand_problems_panel();
		else collapse_problems_panel();
	}

	function toggle_problems_maximize() {
		var el = problems_el();
		if (!el) return;
		var target = two_thirds_height();
		if (el.classList.contains("collapsed")) {
			el.classList.remove("collapsed");
			mount_stock_problems();
			apply_problems_height(target);
			el.classList.add("maximized");
			return;
		}
		var cur = Math.round(el.getBoundingClientRect().height);
		if (el.classList.contains("maximized") || Math.abs(cur - target) < 28) {
			el.classList.remove("maximized");
			var prev = DEFAULT_HEIGHT;
			try {
				var storedPrev = parseInt(localStorage.getItem(S.PROBLEMS_HEIGHT_PREV_KEY) || "", 10);
				if (isFinite(storedPrev) && storedPrev >= MIN_HEIGHT) prev = storedPrev;
			} catch (e) {}
			apply_problems_height(prev);
			return;
		}
		try {
			localStorage.setItem(S.PROBLEMS_HEIGHT_PREV_KEY, String(cur));
		} catch (e2) {}
		apply_problems_height(target);
		el.classList.add("maximized");
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
			titleActionsBound = false;
			sashBound = false;
		} else if (!$("#code-ide-problems-body").length) {
			$("#code-ide-problems").replaceWith(problems_panel_markup());
			$("#code-ide-problems").data("al-bound", 0);
			titleActionsBound = false;
			sashBound = false;
		} else if (!$("#code-ide-problems-sash").length) {
			$("#code-ide-problems").prepend(
				'<div class="code-ide-problems-sash" id="code-ide-problems-sash" role="separator" aria-orientation="horizontal" title="Drag to resize · Double-click for ⅔ height" aria-label="Resize Problems panel"></div>',
			);
			sashBound = false;
		}
		$(".code-ide-problems-bar, #code-ide-problems-fix-all, #code-ide-problems-badge").remove();
		var $shell = $("#code-ide-shell");
		if (!$("#code-ide-statusbar").length) {
			if ($shell.length) $shell.append(statusbar_markup());
			else $("#code-ide-problems").after(statusbar_markup());
		} else if ($shell.length && !$("#code-ide-statusbar").parent().is("#code-ide-shell")) {
			$shell.append($("#code-ide-statusbar"));
		}
		update_statusbar();
		bind_problems_sash();
		if (!$("#code-ide-problems").hasClass("collapsed")) {
			restore_problems_height();
		}
		if (!$("#code-ide-problems").data("al-bound")) {
			$("#code-ide-problems").data("al-bound", 1);
			$("#code-ide-problems-toggle").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				toggle_problems_panel();
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
			// Always mount so collapsed state still shows stock title + badge.
			mount_stock_problems();
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
		collapse_problems_panel: collapse_problems_panel,
		toggle_problems_panel: toggle_problems_panel,
		toggle_problems_maximize: toggle_problems_maximize,
		apply_problems_height: apply_problems_height,
		fix_all_eslint: run_fix_all,
	});
})(typeof window !== "undefined" ? window : globalThis);
