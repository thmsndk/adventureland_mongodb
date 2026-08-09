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
	var problems_panel_markup = ss("problems_panel_markup");
	var quick_open = ss("quick_open");
	var save_current = ss("save_current");
	var save_as = ss("save_as");
	var show_save_name = ss("show_save_name");
	var needs_name_on_save = ss("needs_name_on_save");
	var refresh_explorer = ss("refresh_explorer");
	var refresh_tabs = ss("refresh_tabs");
	var refresh_chrome = ss("refresh_chrome");
	var mark_dirty = ss("mark_dirty");
	var open_slot = ss("open_slot");
	var get_slot = ss("get_slot");
	var slot_key = ss("slot_key");
	var monaco_api = ss("monaco_api");
	var set_active_model = ss("set_active_model");
	var close_tab = ss("close_tab");
	var ensure_model = ss("ensure_model");
	var activate_open_slot = ss("activate_open_slot");
	var cycle_open_tab = ss("cycle_open_tab");
	var activate_open_tab_at = ss("activate_open_tab_at");
	var is_type_tab = ss("is_type_tab");
	var is_view_tab = ss("is_view_tab");

	// VS Code uses Alt+1…9 for openEditorAtIndex; Ctrl+1…3 focuses editor groups (we leave those alone / unbound).

	/**
	 * Cycle CODE tabs.
	 * workbenchOwnsTabs: stock next/previousEditor (entry.js onDidActive → on_workbench_active_slot).
	 * Legacy AL strip: cycle_open_tab.
	 */
	function cycle_code_tab(delta) {
		var api = global.ALVscodeApi;
		if (api && api.ready && api.workbenchOwnsTabs && typeof api.executeCommand === "function") {
			return api.executeCommand(delta < 0 ? "workbench.action.previousEditor" : "workbench.action.nextEditor");
		}
		if (typeof cycle_open_tab === "function") {
			return cycle_open_tab(delta);
		}
		if (api && typeof api.executeCommand === "function") {
			return api.executeCommand(delta < 0 ? "workbench.action.previousEditor" : "workbench.action.nextEditor");
		}
	}

	/**
	 * Alt+1…7 → Nth open CODE tab.
	 * When workbenchOwnsTabs, entry.js binds workbench.action.openEditorAtIndex* — do not
	 * capture here (let the stock keybinding run). Legacy AL tab strip only.
	 */
	function jump_code_tab_digit(e) {
		if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return false;
		var api = global.ALVscodeApi;
		if (api && api.ready && api.workbenchOwnsTabs) return false;
		var digit = -1;
		if (e.code && /^Digit[1-7]$/.test(e.code)) digit = parseInt(e.code.slice(5), 10);
		else if (e.code && /^Numpad[1-7]$/.test(e.code)) digit = parseInt(e.code.slice(6), 10);
		else if (e.key >= "1" && e.key <= "7") digit = parseInt(e.key, 10);
		else if (e.keyCode >= 49 && e.keyCode <= 55) digit = e.keyCode - 48;
		if (digit < 1 || digit > 7) return false;
		if (typeof activate_open_tab_at === "function") activate_open_tab_at(digit - 1);
		return true;
	}

	/**
	 * Chrome reserves Ctrl+Tab unless the page is fullscreen + Keyboard Lock.
	 * Request Tab lock while CODE is open in fullscreen so Ctrl+Tab reaches us.
	 */
	function sync_code_keyboard_lock() {
		var kb = typeof navigator !== "undefined" && navigator.keyboard;
		if (!kb || typeof kb.lock !== "function") return;
		if (!global.code || !document.fullscreenElement) {
			try {
				if (typeof kb.unlock === "function") kb.unlock();
			} catch (eUnlock) {}
			return;
		}
		kb.lock(["Tab"]).catch(function () {});
	}

	function open_vscode_settings(keybindings) {
		var ready = global.ALVscodeApiReady;
		function go() {
			var api = global.ALVscodeApi;
			if (!api) {
				console.warn("[SlotSession] ALVscodeApi not ready");
				return;
			}
			if (keybindings && typeof api.openKeybindings === "function") return api.openKeybindings();
			if (typeof api.openSettings === "function") {
				return api.openSettings();
			}
		}
		if (ready && typeof ready.then === "function") ready.then(go).catch(go);
		else go();
	}

	/** @deprecated popover removed — opens VS Code Settings (AdventureLand tagged). */
	function toggle_settings_panel(forceClose) {
		if (forceClose) return;
		open_vscode_settings(false);
	}

	function ensure_settings_dom() {
		if (!$("#code-ide-settings").length) {
			$("#code-ide-save-as").after('<button type="button" class="code-ide-iconbtn" id="code-ide-settings" title="Settings">⚙</button>');
			$("#code-ide-settings").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				open_vscode_settings(false);
			});
		}
		if ($("#code-ide-settings-panel").length) $("#code-ide-settings-panel").remove();
		if (!$("#code-ide-editor-slot").data("al-focus-bound")) {
			$("#code-ide-editor-slot")
				.data("al-focus-bound", 1)
				.on("mousedown", function () {
					if (S.editor && S.editor.focus) S.editor.focus();
				});
		}
	}

	function ensure_chrome_dom() {
		var $ui = $("#codeui");
		if (!$ui.length) return;
		$ui.addClass("code-ide");

		if (!$("#code-ide-shell").length) {
			$ui.prepend(
				'<div id="code-ide-shell">' +
					'<aside id="code-ide-sidebar">' +
					'<div id="code-ide-sidebar-body" class="code-ide-sidebar-body"></div>' +
					"</aside>" +
					'<section id="code-ide-main">' +
					'<div id="code-ide-toolbar">' +
					'<button type="button" class="code-ide-iconbtn" id="code-ide-toggle-sidebar" title="Toggle Sidebar">⧉</button>' +
					'<div class="code-ide-toolbar-spacer" aria-hidden="true"></div>' +
					'<div class="code-ide-toolbar-right">' +
					'<button type="button" class="code-ide-textbtn" id="code-ide-save-as" title="Save As">Save As</button>' +
					'<button type="button" class="code-ide-iconbtn" id="code-ide-split" title="Split editor right">▥</button>' +
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
					'<button type="button" class="code-ide-iconbtn code-ide-closebtn" id="code-ide-close" title="Close CODE" aria-label="Close CODE">×</button>' +
					"</div>" +
					"</div>" +
					'<div id="code-ide-editor-slot"></div>' +
					problems_panel_markup() +
					statusbar_markup() +
					"</section>" +
					"</div>",
			);

			// Rescue a main editor that was mounted before the shell existed.
			var $orphan = $ui.children(".monaco-editor-host.maincode, .maincode.monaco-editor-host");
			if ($orphan.length && $("#code-ide-editor-slot").length) {
				$("#code-ide-editor-slot").append($orphan);
			}

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
			$("#code-ide-split").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				if (global.ALVscodeApi && typeof ALVscodeApi.executeCommand === "function") {
					ALVscodeApi.executeCommand("workbench.action.splitEditorRight");
				}
			});
			$("#code-ide-split").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				if (global.ALVscodeApi && typeof ALVscodeApi.executeCommand === "function") {
					ALVscodeApi.executeCommand("workbench.action.splitEditorRight");
				}
			});
			$("#code-ide-settings").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				open_vscode_settings(false);
			});
			$(document).off("keydown.alcodeclose");
			$("#code-ide-layout").on("change", function () {
				set_layout_mode($(this).val());
			});
			$("#code-ide-alpha").on("input change", function () {
				S.overlay_alpha = Math.max(0.4, Math.min(1, parseInt($(this).val(), 10) / 100));
				try {
					localStorage.setItem(S.ALPHA_KEY, String(S.overlay_alpha));
				} catch (err) {}
				apply_layout();
				sync_layout_to_vscode();
			});
			$("#code-ide-editor-slot").on("mousedown", function () {
				if (S.editor && S.editor.focus) S.editor.focus();
			});
			ensure_settings_dom();
		} else {
			ensure_settings_dom();
		}

		$("#code-ide-layout").val(S.layout_mode);
		$("#code-ide-alpha").val(Math.round(S.overlay_alpha * 100));
		$("#code-ide-alpha").toggle(S.layout_mode.indexOf("overlay") === 0);

		// Drop legacy custom EXPLORER head / tab strip — stock sidebar title + workbench tabs.
		$(".code-ide-sidebar-head").remove();
		$("#code-ide-tabs").remove();
		$("#code-ide-docs, #code-ide-new-file").remove();

		var $toggle = $("#code-ide-toggle-sidebar");
		if ($toggle.length && !$toggle.parent().is("#code-ide-toolbar")) {
			$(".code-ide-toolbar-right").before($toggle);
		} else if (!$toggle.length) {
			$("#code-ide-toolbar").prepend('<button type="button" class="code-ide-iconbtn" id="code-ide-toggle-sidebar" title="Toggle Sidebar">⧉</button>');
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

		var $host = $ui.find(".monaco-editor-host.maincode").first();
		if ($host.length && !$host.parent().is("#code-ide-editor-slot")) {
			$("#code-ide-editor-slot").append($host);
		}
		$ui.addClass("has-explorer");
		$ui.toggleClass("explorer-collapsed", S.explorer_collapsed);
		ensure_global_shortcuts();
		ensure_problems_panel();
		if (global.SlotSession && typeof SlotSession.ensure_outline_panel === "function") {
			SlotSession.ensure_outline_panel();
			if (typeof SlotSession.schedule_refresh_outline === "function") SlotSession.schedule_refresh_outline();
		}
		apply_chrome_theme();
		ensure_settings_dom();
		ensure_statusbar_actions();
		if ($("#code-ide-save-as").length && !$("#code-ide-split").length) {
			$("#code-ide-save-as").after('<button type="button" class="code-ide-iconbtn" id="code-ide-split" title="Split editor right">▥</button>');
			$("#code-ide-split").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				if (global.ALVscodeApi && typeof ALVscodeApi.executeCommand === "function") {
					ALVscodeApi.executeCommand("workbench.action.splitEditorRight");
				}
			});
		}
		ensure_close_button();
	}

	function ensure_close_button() {
		var $right = $(".code-ide-toolbar-right").first();
		if (!$right.length) return;
		var $close = $("#code-ide-close");
		if (!$close.length) {
			$right.append('<button type="button" class="code-ide-iconbtn code-ide-closebtn" id="code-ide-close" title="Close CODE" aria-label="Close CODE">×</button>');
			$close = $("#code-ide-close");
		}
		$close.off("click.alcodeclose").on("click.alcodeclose", function (e) {
			if (e && e.stopPropagation) e.stopPropagation();
			if (typeof global.toggle_code === "function") global.toggle_code();
		});
	}

	function ensure_global_shortcuts() {
		var KEYS_VER = 2605;
		if ($(document).data("al-code-keys") === KEYS_VER) return;
		var prev = $(document).data("al-code-keys-handler");
		if (prev) {
			try {
				document.removeEventListener("keydown", prev, true);
			} catch (eRem) {}
		}
		$(document).data("al-code-keys", KEYS_VER);
		/*
		 * HACK(monaco): capture-phase only for (1) browser-stolen chords and (2) IDE chords
		 *   when focus is outside #codeui (Phaser/game stole focus while CODE is open).
		 * Why: Chrome steals Ctrl+Tab, Ctrl+PageUp/Down, Ctrl+W; Phaser eats keys when canvas focused.
		 * Purpose: tab cycle + close-tab always; F1 / Ctrl+P / save / etc only when not in IDE.
		 * When focus is in the workbench, entry.js updateUserKeybindings owns those chords.
		 * Remove when: game shell no longer competes for keyboard with CODE.
		 */
		function focusInIde(e) {
			var t = e.target;
			if (!t || !t.closest) return false;
			return !!t.closest("#codeui, #al-vscode-workbench, .quick-input-widget, .monaco-quick-input-widget, .monaco-hover, .context-view, .monaco-menu");
		}

		function withApi(fn) {
			var api = global.ALVscodeApi;
			var ready = global.ALVscodeApiReady;
			function go() {
				api = global.ALVscodeApi;
				if (!api) return;
				fn(api);
			}
			if (ready && typeof ready.then === "function") ready.then(go).catch(go);
			else go();
		}

		function runCmd(id) {
			withApi(function (api) {
				if (typeof api.executeCommand === "function") api.executeCommand(id);
			});
		}

		function onCodeKeydown(e) {
			if (!global.code) return;
			var $t = $(e.target);
			if ($t.is("input, textarea, select") && !$t.closest("#codeui, #al-vscode-workbench, .quick-input-widget, .monaco-quick-input-widget").length) return;

			var modEarly = e.ctrlKey || e.metaKey;
			var inIde = focusInIde(e);

			// Esc — close AL save/new pickers (game-domain UI)
			if (e.key === "Escape" || e.keyCode === 27) {
				var $save = $("#code-ide-save-as-panel, #code-ide-new-slot-panel");
				if ($save.length) {
					e.preventDefault();
					e.stopPropagation();
					$save.remove();
					if (S.editor && S.editor.focus) S.editor.focus();
					return;
				}
			}

			// Ctrl/Cmd+W — browser would close the page
			if (modEarly && !e.altKey && !e.shiftKey && (e.key === "w" || e.key === "W" || e.keyCode === 87 || e.code === "KeyW")) {
				e.preventDefault();
				e.stopPropagation();
				if (e.stopImmediatePropagation) e.stopImmediatePropagation();
				var closeSlot = get_slot();
				if (closeSlot != null) close_tab(closeSlot);
				return;
			}

			// Alt+1…7 — only when workbench does not own tabs
			if (jump_code_tab_digit(e)) {
				e.preventDefault();
				e.stopPropagation();
				if (e.stopImmediatePropagation) e.stopImmediatePropagation();
				return;
			}

			// Browser-stolen / Chrome-safe tab cycling — always capture
			if (modEarly && !e.altKey && (e.key === "Tab" || e.code === "Tab" || e.keyCode === 9)) {
				e.preventDefault();
				e.stopPropagation();
				if (e.stopImmediatePropagation) e.stopImmediatePropagation();
				cycle_code_tab(e.shiftKey ? -1 : 1);
				return;
			}
			if (modEarly && e.shiftKey && !e.altKey && (e.code === "PageDown" || e.code === "PageUp" || e.key === "PageDown" || e.key === "PageUp" || e.keyCode === 34 || e.keyCode === 33)) {
				e.preventDefault();
				e.stopPropagation();
				if (e.stopImmediatePropagation) e.stopImmediatePropagation();
				cycle_code_tab(e.code === "PageUp" || e.key === "PageUp" || e.keyCode === 33 ? -1 : 1);
				return;
			}
			if (modEarly && e.altKey && !e.shiftKey && (e.code === "ArrowRight" || e.code === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Right" || e.key === "Left")) {
				e.preventDefault();
				e.stopPropagation();
				if (e.stopImmediatePropagation) e.stopImmediatePropagation();
				cycle_code_tab(e.code === "ArrowRight" || e.key === "ArrowRight" || e.key === "Right" ? 1 : -1);
				return;
			}
			if (modEarly && !e.shiftKey && !e.altKey && (e.code === "PageDown" || e.key === "PageDown" || e.keyCode === 34)) {
				e.preventDefault();
				e.stopPropagation();
				if (e.stopImmediatePropagation) e.stopImmediatePropagation();
				cycle_code_tab(1);
				return;
			}
			if (modEarly && !e.shiftKey && !e.altKey && (e.code === "PageUp" || e.key === "PageUp" || e.keyCode === 33)) {
				e.preventDefault();
				e.stopPropagation();
				if (e.stopImmediatePropagation) e.stopImmediatePropagation();
				cycle_code_tab(-1);
				return;
			}
			if (modEarly && e.shiftKey && !e.altKey && (e.code === "BracketRight" || e.code === "BracketLeft" || e.key === "]" || e.key === "[" || e.key === "}" || e.key === "{")) {
				e.preventDefault();
				e.stopPropagation();
				if (e.stopImmediatePropagation) e.stopImmediatePropagation();
				cycle_code_tab(e.code === "BracketRight" || e.key === "]" || e.key === "}" ? 1 : -1);
				return;
			}

			// Workbench owns the rest when focus is in the IDE.
			if (inIde) return;

			// Outside IDE (Phaser focused) — forward CODE chords to workbench commands.
			if (e.key === "F1" || e.keyCode === 112) {
				e.preventDefault();
				e.stopPropagation();
				withApi(function (api) {
					if (typeof api.showCommands === "function") api.showCommands();
					else runCmd("workbench.action.showCommands");
				});
				return;
			}
			if (e.key === "F8" || e.keyCode === 119) {
				e.preventDefault();
				e.stopPropagation();
				runCmd(e.shiftKey ? "editor.action.marker.prev" : "editor.action.marker.next");
				return;
			}
			if (!modEarly) return;
			var key = (e.key || "").toLowerCase();
			if (key === "p" && e.shiftKey) {
				e.preventDefault();
				e.stopPropagation();
				withApi(function (api) {
					if (typeof api.showCommands === "function") api.showCommands();
				});
				return;
			}
			if (key === "p" && !e.shiftKey) {
				e.preventDefault();
				e.stopPropagation();
				withApi(function (api) {
					if (typeof api.quickOpen === "function") api.quickOpen();
				});
				return;
			}
			if (key === "o" && e.shiftKey && !e.altKey) {
				e.preventDefault();
				e.stopPropagation();
				runCmd("editor.action.quickOutline");
				return;
			}
			if (key === "f" && e.shiftKey && !e.altKey) {
				e.preventDefault();
				e.stopPropagation();
				$ui.removeClass("explorer-collapsed");
				S.explorer_collapsed = false;
				withApi(function (api) {
					if (typeof api.focusSearch === "function") api.focusSearch();
					else runCmd("workbench.action.findInFiles");
				});
				layout_editor();
				return;
			}
			if (key === "s" && !e.shiftKey) {
				e.preventDefault();
				e.stopPropagation();
				runCmd("adventureland.code.save");
				return;
			}
			if (key === "s" && e.shiftKey) {
				e.preventDefault();
				e.stopPropagation();
				runCmd("adventureland.code.saveAs");
				return;
			}
			if (key === "enter" && !e.shiftKey) {
				e.preventDefault();
				e.stopPropagation();
				runCmd("adventureland.code.toggleRun");
			}
		}
		$(document).data("al-code-keys-handler", onCodeKeydown);
		document.addEventListener("keydown", onCodeKeydown, true);
		if (!$(document).data("al-code-fs-lock")) {
			$(document).data("al-code-fs-lock", 1);
			document.addEventListener("fullscreenchange", sync_code_keyboard_lock);
			document.addEventListener("webkitfullscreenchange", sync_code_keyboard_lock);
		}
		sync_code_keyboard_lock();
	}

	function statusbar_markup() {
		return '<div id="code-ide-statusbar"><div id="code-ide-statusbar-body" class="code-ide-statusbar-body"></div></div>';
	}

	function mount_stock_statusbar() {
		var body = document.getElementById("code-ide-statusbar-body");
		var api = global.ALVscodeApi;
		if (!body || !api || typeof api.mountStatusBar !== "function") return;
		api.mountStatusBar(body);
	}

	function ensure_statusbar_cursor() {
		/* stock status bar tracks selection; no AL cursor chrome */
	}

	function ensure_statusbar_actions() {
		mount_stock_statusbar();
	}

	function update_statusbar() {
		var api = global.ALVscodeApi;
		if (api && typeof api.refreshStatusBarExtras === "function") {
			api.refreshStatusBarExtras();
			return;
		}
		mount_stock_statusbar();
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

	function sync_layout_to_vscode() {
		if (global.__AL_SKIP_VSCODE_SYNC) return;
		var api = global.ALVscodeApi;
		if (!api || typeof api.mergeUserConfiguration !== "function") return;
		try {
			api.mergeUserConfiguration({
				"adventureland.layoutMode": S.layout_mode || "dock-half",
				"adventureland.overlayOpacity": typeof S.overlay_alpha === "number" ? S.overlay_alpha : 1,
			});
		} catch (e) {}
	}

	function set_layout_mode(mode) {
		S.layout_mode = mode || "dock-half";
		try {
			localStorage.setItem(S.LAYOUT_KEY, S.layout_mode);
		} catch (e) {}
		$("#code-ide-layout").val(S.layout_mode);
		$("#code-ide-alpha").toggle(S.layout_mode.indexOf("overlay") === 0);
		apply_layout();
		sync_layout_to_vscode();
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
		if (is_type_tab(get_slot()) || is_view_tab(get_slot())) {
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
		// Editor can be created before SlotSession bind (early monaco boot) — attach now.
		if (global.codemirror_render && typeof SlotSession.bind_editor === "function") {
			var empty = !S.models || !Object.keys(S.models).length;
			if (!S.editor || empty) SlotSession.bind_editor(global.codemirror_render);
		}
		apply_layout();
		if (!S.list_fetched) api_call("list_codes", { purpose: "sync" });
		else refresh_chrome();
		layout_editor();
		setTimeout(function () {
			if (S.editor && S.editor.focus) S.editor.focus();
		}, 1);
		sync_code_keyboard_lock();
	}

	function on_panel_close() {
		clear_layout();
		sync_code_keyboard_lock();
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
		statusbar_markup: statusbar_markup,
		toggle_settings_panel: toggle_settings_panel,
		ensure_settings_dom: ensure_settings_dom,
	});
})(typeof window !== "undefined" ? window : globalThis);
