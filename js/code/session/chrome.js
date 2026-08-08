/**
 * SlotSession chrome: shell, layout, statusbar, run. Settings via ALVscodeApi.
 */
(function (global) {
	"use strict";

	var S = global.ALCodeSessionState;
	if (!S) throw new Error("ALCodeSessionState missing — load session/state.js first");
	var ALEditor = global.ALEditor || (global.ALEditor = {});

	/** Cross-module SlotSession calls (other files assign these before chrome runs at runtime). */
	function ss(name) {
		return function () {
			var fn = global.SlotSession && global.SlotSession[name];
			if (typeof fn !== "function") {
				console.warn("[SlotSession] missing " + name);
				return;
			}
			return fn.apply(null, arguments);
		};
	}
	var new_code_slot = ss("new_code_slot");
	var ensure_problems_panel = ss("ensure_problems_panel");
	var refresh_problems_panel = ss("refresh_problems_panel");
	var goto_next_problem = ss("goto_next_problem");
	var quick_open = ss("quick_open");
	var save_current = ss("save_current");
	var save_as = ss("save_as");
	var refresh_explorer = ss("refresh_explorer");
	var refresh_tabs = ss("refresh_tabs");
	var refresh_chrome = ss("refresh_chrome");
	var mark_dirty = ss("mark_dirty");
	var open_slot = ss("open_slot");
	var get_slot = ss("get_slot");
	var slot_key = ss("slot_key");
	var monaco_api = ss("monaco_api");
	var set_active_model = ss("set_active_model");
	var ensure_model = ss("ensure_model");
	var activate_open_slot = ss("activate_open_slot");

	function open_vscode_settings(keybindings) {
		var api = global.ALVscodeApi;
		var ready = global.ALVscodeApiReady;
		function go() {
			api = global.ALVscodeApi;
			if (!api) {
				console.warn("[SlotSession] ALVscodeApi not ready");
				return;
			}
			if (keybindings && typeof api.openKeybindings === "function") return api.openKeybindings();
			if (typeof api.openSettings === "function") return api.openSettings();
		}
		if (ready && typeof ready.then === "function") ready.then(go).catch(go);
		else go();
	}

	function ensure_chrome_dom() {
		var $ui = $("#codeui");
		if (!$ui.length) return;
		$ui.addClass("code-ide");

		if (!$("#code-ide-shell").length) {
			$ui.prepend(
				'<div id="code-ide-shell">' +
					'<aside id="code-ide-sidebar">' +
					'<div class="code-ide-sidebar-head">' +
					'<span class="code-ide-sidebar-title">EXPLORER</span>' +
					'<div class="code-ide-sidebar-actions">' +
					'<button type="button" class="code-ide-iconbtn code-ide-newfilebtn" id="code-ide-new-file" title="New untitled slot (Shift+click to pick)">' +
					'<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">' +
					'<path fill="currentColor" d="M9.5 1.1H4.2A1.2 1.2 0 0 0 3 2.3v11.4A1.2 1.2 0 0 0 4.2 15h7.6a1.2 1.2 0 0 0 1.2-1.3V5.6L9.5 1.1zm.2 1.5 2.9 2.9H9.7V2.6zM4.2 13.8V2.3h4.3v3.5c0 .4.3.7.7.7h3.5v7.3H4.2z"/>' +
					'<path fill="currentColor" d="M8 7.2v1.8H6.2v1.2H8v1.8h1.2V10.2h1.8V9H9.2V7.2H8z"/>' +
					"</svg></button>" +
					'<button type="button" class="code-ide-iconbtn code-ide-docsbtn" id="code-ide-docs" title="Code Slots and Files documentation">?</button>' +
					"</div>" +
					"</div>" +
					'<div id="code-slot-explorer"></div>' +
					"</aside>" +
					'<section id="code-ide-main">' +
					'<div id="code-ide-toolbar">' +
					'<button type="button" class="code-ide-iconbtn" id="code-ide-toggle-sidebar" title="Toggle Sidebar">⧉</button>' +
					'<div id="code-ide-tabs"></div>' +
					'<div class="code-ide-toolbar-right">' +
					'<button type="button" class="code-ide-textbtn" id="code-ide-save-as" title="Save As">Save As</button>' +
					'<button type="button" class="code-ide-iconbtn" id="code-ide-settings" title="Editor settings">⚙</button>' +
					'<button type="button" class="code-ide-run idle" id="code-ide-run" title="Play / Pause script">▶</button>' +
					'<select id="code-ide-layout" title="Editor layout">' +
					'<option value="dock-half">Split 50%</option>' +
					'<option value="overlay-third">Overlay ⅓</option>' +
					'<option value="overlay-half">Overlay ½</option>' +
					'<option value="overlay-full">Overlay full</option>' +
					"</select>" +
					'<input type="range" id="code-ide-alpha" min="40" max="100" value="92" title="Overlay opacity" />' +
					'<span id="code-ide-status" class="code-ide-status idle">Idle</span>' +
					"</div>" +
					"</div>" +
					'<div id="code-ide-editor-slot"></div>' +
					problems_panel_markup() +
					statusbar_markup() +
					"</section>" +
					"</div>",
			);

			$("#code-ide-toggle-sidebar").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				S.explorer_collapsed = !S.explorer_collapsed;
				$ui.toggleClass("explorer-collapsed", S.explorer_collapsed);
				layout_editor();
			});
			$("#code-ide-run").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				toggle_play();
			});
			$("#code-ide-save-as").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				save_as();
			});
			$("#code-ide-docs").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				open_code_slots_docs();
			});
			$("#code-ide-new-file").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				new_code_slot(!!(e && (e.shiftKey || e.altKey)));
			});
			$("#code-ide-settings").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				open_vscode_settings(!!(e && e.shiftKey));
			});
			$("#code-ide-layout").on("change", function () {
				set_layout_mode($(this).val());
			});
			$("#code-ide-alpha").on("input change", function () {
				S.overlay_alpha = Math.max(0.4, Math.min(1, parseInt($(this).val(), 10) / 100));
				try {
					localStorage.setItem(S.ALPHA_KEY, String(S.overlay_alpha));
				} catch (err) {}
				apply_layout();
			});
			$("#code-ide-editor-slot").on("mousedown", function () {
				if (S.editor && S.editor.focus) S.editor.focus();
			});
		} else {
			/* settings panel retired — vscode-api Settings UI */
		}

		$("#code-ide-layout").val(S.layout_mode);
		$("#code-ide-alpha").val(Math.round(S.overlay_alpha * 100));
		$("#code-ide-alpha").toggle(S.layout_mode.indexOf("overlay") === 0);

		// Migrate: keep sidebar toggle on the toolbar (visible when explorer is collapsed)
		var $toggle = $("#code-ide-toggle-sidebar");
		if ($toggle.length && !$toggle.parent().is("#code-ide-toolbar")) {
			$("#code-ide-tabs").before($toggle);
		} else if (!$toggle.length) {
			$("#code-ide-tabs").before('<button type="button" class="code-ide-iconbtn" id="code-ide-toggle-sidebar" title="Toggle Sidebar">⧉</button>');
			$("#code-ide-toggle-sidebar").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				S.explorer_collapsed = !S.explorer_collapsed;
				$ui.toggleClass("explorer-collapsed", S.explorer_collapsed);
				layout_editor();
			});
		}
		if (!$("#code-ide-save-as").length) {
			$("#code-ide-run").before('<button type="button" class="code-ide-textbtn" id="code-ide-save-as" title="Save As">Save As</button>');
			$("#code-ide-save-as").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				save_as();
			});
		}
		if (!$("#code-ide-docs").length) {
			$(".code-ide-sidebar-head").append(
				'<div class="code-ide-sidebar-actions">' +
					'<button type="button" class="code-ide-iconbtn code-ide-newfilebtn" id="code-ide-new-file" title="New untitled slot (Shift+click to pick)">' +
					'<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">' +
					'<path fill="currentColor" d="M9.5 1.1H4.2A1.2 1.2 0 0 0 3 2.3v11.4A1.2 1.2 0 0 0 4.2 15h7.6a1.2 1.2 0 0 0 1.2-1.3V5.6L9.5 1.1zm.2 1.5 2.9 2.9H9.7V2.6zM4.2 13.8V2.3h4.3v3.5c0 .4.3.7.7.7h3.5v7.3H4.2z"/>' +
					'<path fill="currentColor" d="M8 7.2v1.8H6.2v1.2H8v1.8h1.2V10.2h1.8V9H9.2V7.2H8z"/>' +
					"</svg></button>" +
					'<button type="button" class="code-ide-iconbtn code-ide-docsbtn" id="code-ide-docs" title="Code Slots and Files documentation">?</button>' +
					"</div>",
			);
			$("#code-ide-docs").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				open_code_slots_docs();
			});
			$("#code-ide-new-file").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				new_code_slot(!!(e && (e.shiftKey || e.altKey)));
			});
		} else if (!$("#code-ide-new-file").length) {
			$("#code-ide-docs").before(
				'<button type="button" class="code-ide-iconbtn code-ide-newfilebtn" id="code-ide-new-file" title="New untitled slot (Shift+click to pick)">' +
					'<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">' +
					'<path fill="currentColor" d="M9.5 1.1H4.2A1.2 1.2 0 0 0 3 2.3v11.4A1.2 1.2 0 0 0 4.2 15h7.6a1.2 1.2 0 0 0 1.2-1.3V5.6L9.5 1.1zm.2 1.5 2.9 2.9H9.7V2.6zM4.2 13.8V2.3h4.3v3.5c0 .4.3.7.7.7h3.5v7.3H4.2z"/>' +
					'<path fill="currentColor" d="M8 7.2v1.8H6.2v1.2H8v1.8h1.2V10.2h1.8V9H9.2V7.2H8z"/>' +
					"</svg></button>",
			);
			$("#code-ide-new-file").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				new_code_slot(!!(e && (e.shiftKey || e.altKey)));
			});
		}

		var $host = $ui.find(".monaco-editor-host.maincode").first();
		if ($host.length && !$host.parent().is("#code-ide-editor-slot")) {
			$("#code-ide-editor-slot").append($host);
		}
		$ui.addClass("has-explorer");
		$ui.toggleClass("explorer-collapsed", S.explorer_collapsed);
		ensure_global_shortcuts();
		ensure_problems_panel();
		apply_chrome_theme();
		if ($("#code-ide-settings").length && !$("#code-ide-settings").data("al-vscode-bound")) {
			$("#code-ide-settings").data("al-vscode-bound", 1);
			$("#code-ide-settings").attr("title", "Editor settings (Shift+click: Keyboard Shortcuts)");
			$("#code-ide-settings").on("click.alvscode", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				open_vscode_settings(!!(e && e.shiftKey));
			});
		}
	}

	function ensure_global_shortcuts() {
		if ($(document).data("al-code-keys")) return;
		$(document).data("al-code-keys", 1);
		$(document).on("keydown.alcodekeys", function (e) {
			if (!global.code) return;
			var $t = $(e.target);
			if ($t.is("input, textarea, select") && !$t.closest("#codeui").length) return;

			// F8 / Shift+F8 — next / previous problem (Monaco marker actions)
			if (e.key === "F8" || e.keyCode === 119) {
				e.preventDefault();
				goto_next_problem(!!e.shiftKey);
				return;
			}

			var mod = e.ctrlKey || e.metaKey;
			if (!mod) return;

			var key = (e.key || "").toLowerCase();
			if (key === "p" && !e.shiftKey) {
				e.preventDefault();
				quick_open();
				return;
			}
			if (key === "s" && !e.shiftKey) {
				e.preventDefault();
				save_current();
				return;
			}
			if (key === "s" && e.shiftKey) {
				e.preventDefault();
				save_as();
				return;
			}
			if (key === "enter" && !e.shiftKey) {
				e.preventDefault();
				toggle_play();
			}
		});
	}

	function statusbar_markup() {
		return (
			'<div id="code-ide-statusbar">' +
			'<button type="button" class="code-ide-sb-item code-ide-sb-problems" id="code-ide-sb-problems" title="Problems">' +
			'<span class="code-ide-sb-err" id="code-ide-sb-err">0</span>' +
			'<span class="code-ide-sb-warn" id="code-ide-sb-warn">0</span>' +
			"</button>" +
			'<button type="button" class="code-ide-sb-item code-ide-sb-spell" id="code-ide-sb-spell" title="Spell Checker">' +
			'<span class="code-ide-sb-info" id="code-ide-sb-info">0</span>' +
			"</button>" +
			'<span class="code-ide-sb-item" id="code-ide-sb-pos">Ln 1, Col 1</span>' +
			'<span class="code-ide-sb-item" id="code-ide-sb-indent">Spaces: 4</span>' +
			'<span class="code-ide-sb-item" id="code-ide-sb-lang">JavaScript</span>' +
			'<span class="code-ide-sb-item" id="code-ide-sb-prettier" title="Formatting">Prettier</span>' +
			"</div>"
		);
	}

	function ensure_statusbar_cursor() {
		var mapi = monaco_api();
		if (!mapi || S.statusbar_cursor_bound) return;
		S.statusbar_cursor_bound = true;
		mapi.onDidChangeCursorPosition(function () {
			update_statusbar();
		});
		mapi.onDidChangeCursorSelection(function () {
			update_statusbar();
		});
	}

	function update_statusbar() {
		var mapi = monaco_api();
		var prefs = S.editor && S.editor.getPrefs ? S.editor.getPrefs() : global.ALEditor && ALEditor.getPrefs ? ALEditor.getPrefs() : {};
		var pos = mapi && mapi.getPosition ? mapi.getPosition() : { lineNumber: 1, column: 1 };
		var sel = mapi && mapi.getSelection ? mapi.getSelection() : null;
		var selText = "";
		if (sel && !sel.isEmpty() && mapi.getModel) {
			var len = mapi.getModel().getValueLengthInRange(sel);
			if (len) selText = " (" + len + " selected)";
		}
		$("#code-ide-sb-pos").text("Ln " + pos.lineNumber + ", Col " + pos.column + selText);
		var tw = (prefs.prettier && prefs.prettier.tabWidth) || 4;
		var tabs = prefs.prettier && prefs.prettier.useTabs;
		$("#code-ide-sb-indent").text(tabs ? "Tab Size: " + tw : "Spaces: " + tw);
		$("#code-ide-sb-lang").text(is_type_tab(get_slot()) ? "TypeScript" : "JavaScript");
		$("#code-ide-sb-prettier").toggleClass("off", prefs.formatting === false);
		$("#code-ide-sb-prettier").attr("title", prefs.formatting === false ? "Formatting off" : "Prettier formatting on");
	}

	function open_code_slots_docs() {
		if (typeof global.open_guide === "function") {
			open_guide("8-code-slots-and-files", "/docs/guide/code/8-code-slots-and-files");
		} else if (typeof global.open === "function") {
			global.open("/docs/guide/code/8-code-slots-and-files", "_blank");
		}
	}

	function apply_chrome_theme(theme) {
		var t = theme;
		if (!t) {
			try {
				if (S.editor && S.editor.getPrefs) t = S.editor.getPrefs().theme;
				else if (global.codemirror_render && codemirror_render.getPrefs) t = codemirror_render.getPrefs().theme;
			} catch (e) {}
		}
		if (!t) {
			try {
				var raw = localStorage.getItem("al_code_editor_prefs");
				if (raw) t = JSON.parse(raw).theme;
			} catch (e2) {}
		}
		t = t || "vs-dark";
		var $ui = $("#codeui");
		$ui.removeClass("theme-vs-dark theme-vs theme-hc-black theme-pixel");
		$ui.addClass("theme-" + t);
	}

	function apply_editor_prefs(partial) {
		var next = null;
		if (S.editor && S.editor.applyPrefs) next = S.editor.applyPrefs(partial);
		else if (global.codemirror_render && codemirror_render.applyPrefs) next = codemirror_render.applyPrefs(partial);
		apply_chrome_theme((next && next.theme) || (partial && partial.theme));
		update_statusbar();
	}

	function layout_editor() {
		if (S.editor && S.editor.layout) S.editor.layout();
	}

	function set_layout_mode(mode) {
		S.layout_mode = mode || "dock-half";
		try {
			localStorage.setItem(S.LAYOUT_KEY, S.layout_mode);
		} catch (e) {}
		$("#code-ide-alpha").toggle(S.layout_mode.indexOf("overlay") === 0);
		apply_layout();
	}

	function apply_layout() {
		var $ui = $("#codeui");
		if (!$ui.length) return;
		$ui.removeClass("layout-dock-half layout-overlay-third layout-overlay-half layout-overlay-full");
		document.body.classList.remove("code-docked");
		global.code_dock_inset = 0;

		if (!global.code) {
			$("canvas").css({ left: "0px", width: "" });
			if (typeof resize === "function") resize();
			return;
		}

		if (S.layout_mode === "dock-half") {
			$ui.addClass("layout-dock-half").css("opacity", 1);
			document.body.classList.add("code-docked");
			global.code_dock_inset = Math.floor($(window).width() / 2);
		} else {
			$ui.addClass("layout-" + S.layout_mode).css("opacity", S.overlay_alpha);
		}

		if (typeof resize === "function") resize();
		layout_editor();
	}

	function clear_layout() {
		$("#codeui").removeClass("layout-dock-half layout-overlay-third layout-overlay-half layout-overlay-full").css("opacity", "");
		document.body.classList.remove("code-docked");
		global.code_dock_inset = 0;
		$("canvas").css({ left: "0px", width: "" });
		if (typeof resize === "function") resize();
	}

	function toggle_play() {
		if (is_type_tab(get_slot())) {
			if (typeof global.add_log === "function") add_log("Switch back to a code slot to run", "gray");
			return;
		}
		if (needs_name_on_save(get_slot())) {
			if (typeof global.add_log === "function") add_log("Save and name this file before running", "#64B5F6");
			show_save_name(get_slot(), { allowOther: true });
			return;
		}
		if (global.code_run) {
			if (typeof stop_runner === "function") stop_runner();
		} else {
			if (typeof start_runner === "function") start_runner();
		}
	}

	function set_running(running) {
		var $btn = $("#code-ide-run");
		var $st = $("#code-ide-status");
		if ($btn.length) {
			if (running) {
				$btn.removeClass("idle").addClass("running").text("⏸").attr("title", "Pause script (Disengage)");
			} else {
				$btn.removeClass("running").addClass("idle").text("▶").attr("title", "Play script (Engage)");
			}
		}
		if ($st.length) {
			if (running) $st.removeClass("idle").addClass("running").text("Running");
			else $st.removeClass("running").addClass("idle").text("Idle");
		}
	}

	function on_panel_open() {
		ensure_chrome_dom();
		apply_layout();
		if (!S.list_fetched) api_call("list_codes", { purpose: "sync" });
		else refresh_chrome();
		layout_editor();
		setTimeout(function () {
			if (S.editor && S.editor.focus) S.editor.focus();
		}, 1);
	}

	function on_panel_close() {
		clear_layout();
	}

	function get_value() {
		var ed = S.editor || global.codemirror_render;
		return ed ? ed.getValue() : "";
	}

	function set_value(v) {
		var ed = S.editor || global.codemirror_render;
		if (ed) ed.setValue(v);
	}

	var SlotSession = global.SlotSession || (global.SlotSession = {});
	Object.assign(SlotSession, {
		toggle_play: toggle_play,
		on_panel_open: on_panel_open,
		on_panel_close: on_panel_close,
		set_running: set_running,
		apply_layout: apply_layout,
		set_layout_mode: set_layout_mode,
		get_value: get_value,
		set_value: set_value,
		apply_chrome_theme: apply_chrome_theme,
		layout_editor: layout_editor,
		ensure_chrome_dom: ensure_chrome_dom,
		update_statusbar: update_statusbar,
		ensure_statusbar_cursor: ensure_statusbar_cursor,
		apply_editor_prefs: apply_editor_prefs,
	});
})(typeof window !== "undefined" ? window : globalThis);
