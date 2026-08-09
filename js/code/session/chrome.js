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
	var TAB_SHORTCUT_TITLE = "Jump: Alt+1…7 · Next/prev: Ctrl+Alt+→/← · Ctrl+Shift+PageDown/Up · Ctrl+Shift+]/[";

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
					'<div class="code-ide-sidebar-head">' +
					'<span class="code-ide-sidebar-title">EXPLORER</span>' +
					'<div class="code-ide-sidebar-actions">' +
					'<button type="button" class="code-ide-iconbtn code-ide-newfilebtn" id="code-ide-new-file" title="New Untitled file (Shift+click to pick)">' +
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
					'<div id="code-ide-tabs" title="' +
					TAB_SHORTCUT_TITLE +
					'"></div>' +
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
					'<button type="button" class="code-ide-iconbtn code-ide-newfilebtn" id="code-ide-new-file" title="New Untitled file (Shift+click to pick)">' +
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
				'<button type="button" class="code-ide-iconbtn code-ide-newfilebtn" id="code-ide-new-file" title="New Untitled file (Shift+click to pick)">' +
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
		if (global.SlotSession && typeof SlotSession.ensure_outline_panel === "function") {
			SlotSession.ensure_outline_panel();
			if (typeof SlotSession.schedule_refresh_outline === "function") SlotSession.schedule_refresh_outline();
		}
		apply_chrome_theme();
		ensure_settings_dom();
		ensure_statusbar_actions();
		if ($("#code-ide-tabs").length && !$("#code-ide-tabs").attr("title")) {
			$("#code-ide-tabs").attr("title", TAB_SHORTCUT_TITLE);
		}
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
		var KEYS_VER = 2601;
		if ($(document).data("al-code-keys") === KEYS_VER) return;
		var prev = $(document).data("al-code-keys-handler");
		if (prev) {
			try {
				document.removeEventListener("keydown", prev, true);
			} catch (eRem) {}
		}
		$(document).data("al-code-keys", KEYS_VER);
		/*
		 * HACK(monaco): capture F1 / Ctrl+P / Ctrl+Shift+P / Ctrl+W while CODE is open.
		 * Why: Phaser/game key handlers and browser defaults (Ctrl+W closes the tab) run
		 *   before workbench keybindings when the editor does not have focus.
		 * Purpose: route to stock showCommands / quickOpen / close_tab.
		 * Same family as tab-cycle capture below; Remove when: workbench chords win under the game shell.
		 */
		// Capture phase so F1 / Ctrl+P / Ctrl+W win over the game keyboard when CODE is open.
		function onCodeKeydown(e) {
			if (!global.code) return;
			var $t = $(e.target);
			if ($t.is("input, textarea, select") && !$t.closest("#codeui, #al-vscode-workbench, .quick-input-widget, .monaco-quick-input-widget").length) return;

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

			var modEarly = e.ctrlKey || e.metaKey;
			// Ctrl/Cmd+W — close CODE tab (capture + stopImmediate so the browser does not close the page).
			if (modEarly && !e.altKey && !e.shiftKey && (e.key === "w" || e.key === "W" || e.keyCode === 87 || e.code === "KeyW")) {
				e.preventDefault();
				e.stopPropagation();
				if (e.stopImmediatePropagation) e.stopImmediatePropagation();
				var closeSlot = get_slot();
				if (closeSlot != null) close_tab(closeSlot);
				return;
			}

			/*
			 * Alt+1…7 — legacy AL open_tabs only (see jump_code_tab_digit).
			 * workbenchOwnsTabs: entry.js openEditorAtIndex bindings own these keys.
			 * Do not steal Ctrl+1…3 — focusNthEditorGroup (unbound in entry.js for single-group).
			 */
			if (jump_code_tab_digit(e)) {
				e.preventDefault();
				e.stopPropagation();
				if (e.stopImmediatePropagation) e.stopImmediatePropagation();
				return;
			}

			/*
			 * HACK(monaco): capture-phase tab cycling while CODE is open.
			 * Why: (1) Phaser/game key handlers steal focus before workbench keybindings;
			 *   (2) Chrome never delivers Ctrl+Tab / Ctrl+Page* to the page (browser tabs).
			 * Purpose: reach stock next/previousEditor (or legacy cycle_open_tab) via cycle_code_tab.
			 * entry.js still registers the same chords for the workbench keybinding service when
			 * events arrive there; while CODE is open this capture path is the effective owner.
			 * Remove when: workbench keybindings reliably receive these under the game shell.
			 *
			 * Prefer Chrome-safe chords: Ctrl+Alt+←/→ and Ctrl+Shift+PageUp/Down.
			 */
			if (modEarly && !e.altKey && (e.key === "Tab" || e.code === "Tab" || e.keyCode === 9)) {
				e.preventDefault();
				e.stopPropagation();
				if (e.stopImmediatePropagation) e.stopImmediatePropagation();
				cycle_code_tab(e.shiftKey ? -1 : 1);
				return;
			}

			// Ctrl+Shift+PageDown / PageUp — Chrome-safe (plain Ctrl+Page* is reserved)
			if (modEarly && e.shiftKey && !e.altKey && (e.code === "PageDown" || e.code === "PageUp" || e.key === "PageDown" || e.key === "PageUp" || e.keyCode === 34 || e.keyCode === 33)) {
				e.preventDefault();
				e.stopPropagation();
				if (e.stopImmediatePropagation) e.stopImmediatePropagation();
				cycle_code_tab(e.code === "PageUp" || e.key === "PageUp" || e.keyCode === 33 ? -1 : 1);
				return;
			}

			// Ctrl+Alt+← / → — confirmed working in Chrome (primary dogfood shortcut)
			if (modEarly && e.altKey && !e.shiftKey && (e.code === "ArrowRight" || e.code === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Right" || e.key === "Left")) {
				e.preventDefault();
				e.stopPropagation();
				if (e.stopImmediatePropagation) e.stopImmediatePropagation();
				cycle_code_tab(e.code === "ArrowRight" || e.key === "ArrowRight" || e.key === "Right" ? 1 : -1);
				return;
			}

			// Ctrl+Shift+O — Go to Symbol in Editor (quick outline)
			if (modEarly && e.shiftKey && !e.altKey && (e.key === "o" || e.key === "O" || e.keyCode === 79 || e.code === "KeyO")) {
				e.preventDefault();
				e.stopPropagation();
				if (e.stopImmediatePropagation) e.stopImmediatePropagation();
				if (global.SlotSession && typeof SlotSession.show_quick_outline === "function") {
					SlotSession.show_quick_outline();
				} else {
					withApi(function (api) {
						if (typeof api.executeCommand === "function") api.executeCommand("editor.action.quickOutline");
					});
				}
				return;
			}

			// F1 → Command Palette (VS Code). Must work even when Monaco does not have focus.
			if (e.key === "F1" || e.keyCode === 112) {
				e.preventDefault();
				e.stopPropagation();
				withApi(function (api) {
					if (typeof api.showCommands === "function") api.showCommands();
				});
				return;
			}

			// F8 / Shift+F8 — next / previous problem (Monaco marker actions)
			if (e.key === "F8" || e.keyCode === 119) {
				e.preventDefault();
				goto_next_problem(!!e.shiftKey);
				return;
			}

			// Esc — close save-name / slot pickers when they are open
			if (e.key === "Escape" || e.keyCode === 27) {
				var $save = $("#code-ide-save-as-panel, #code-ide-quick-open, #code-ide-new-slot-panel");
				if ($save.length) {
					e.preventDefault();
					e.stopPropagation();
					$save.remove();
					if (S.editor && S.editor.focus) S.editor.focus();
					return;
				}
			}

			var mod = e.ctrlKey || e.metaKey;
			if (!mod) return;

			var key = (e.key || "").toLowerCase();
			var code = e.code || "";
			// Ctrl+Shift+P → Command Palette
			if (key === "p" && e.shiftKey) {
				e.preventDefault();
				e.stopPropagation();
				withApi(function (api) {
					if (typeof api.showCommands === "function") api.showCommands();
				});
				return;
			}
			// Ctrl+P → VS Code Quick Open (not the old AL-only slot popup)
			if (key === "p" && !e.shiftKey) {
				e.preventDefault();
				e.stopPropagation();
				withApi(function (api) {
					if (typeof api.quickOpen === "function") api.quickOpen();
					else if (typeof quick_open === "function") quick_open();
				});
				return;
			}
			// Same HACK(monaco) capture ownership as Tab/Page block above (Firefox / Keyboard Lock).
			if (!e.shiftKey && !e.altKey && (key === "pagedown" || code === "PageDown")) {
				e.preventDefault();
				e.stopPropagation();
				if (e.stopImmediatePropagation) e.stopImmediatePropagation();
				cycle_code_tab(1);
				return;
			}
			if (!e.shiftKey && !e.altKey && (key === "pageup" || code === "PageUp")) {
				e.preventDefault();
				e.stopPropagation();
				if (e.stopImmediatePropagation) e.stopImmediatePropagation();
				cycle_code_tab(-1);
				return;
			}
			// Ctrl+Shift+] / [ — same capture owner; mirrors entry.js workbench bindings.
			if (e.shiftKey && !e.altKey && (code === "BracketRight" || code === "BracketLeft" || key === "]" || key === "[" || key === "}" || key === "{")) {
				e.preventDefault();
				e.stopPropagation();
				if (e.stopImmediatePropagation) e.stopImmediatePropagation();
				cycle_code_tab(code === "BracketRight" || key === "]" || key === "}" ? 1 : -1);
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
		return (
			'<div id="code-ide-statusbar">' +
			'<button type="button" class="code-ide-sb-item code-ide-sb-problems" id="code-ide-sb-problems" title="Problems">' +
			'<span class="code-ide-sb-err" id="code-ide-sb-err">0</span>' +
			'<span class="code-ide-sb-warn" id="code-ide-sb-warn">0</span>' +
			"</button>" +
			'<button type="button" class="code-ide-sb-item code-ide-sb-spell" id="code-ide-sb-spell" title="Spell Checker">' +
			'<span class="code-ide-sb-info code-ide-sb-spell-count" id="code-ide-sb-spell-count" title="Spelling issues">0</span>' +
			"</button>" +
			'<span class="code-ide-sb-item" id="code-ide-sb-pos">Ln 1, Col 1</span>' +
			'<button type="button" class="code-ide-sb-item code-ide-sb-click" id="code-ide-sb-indent" title="Click to toggle 2 / 4 spaces">Spaces: 4</button>' +
			'<span class="code-ide-sb-item" id="code-ide-sb-lang">JavaScript</span>' +
			'<button type="button" class="code-ide-sb-item code-ide-sb-click" id="code-ide-sb-prettier" title="Toggle Prettier formatting">Prettier</button>' +
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

	function ensure_statusbar_actions() {
		if ($("#code-ide-statusbar").data("al-sb-actions")) return;
		if (!$("#code-ide-sb-prettier").length) return;
		$("#code-ide-statusbar").data("al-sb-actions", 1);
		$("#code-ide-sb-prettier").on("click", function (e) {
			if (e && e.stopPropagation) e.stopPropagation();
			var prefs = S.editor && S.editor.getPrefs ? S.editor.getPrefs() : global.ALEditor && typeof ALEditor.load_prefs === "function" ? ALEditor.load_prefs() : { formatting: true };
			apply_editor_prefs({ formatting: prefs.formatting === false });
		});
		$("#code-ide-sb-indent").on("click", function (e) {
			if (e && e.stopPropagation) e.stopPropagation();
			var prefs = S.editor && S.editor.getPrefs ? S.editor.getPrefs() : global.ALEditor && typeof ALEditor.load_prefs === "function" ? ALEditor.load_prefs() : { prettier: { tabWidth: 4 } };
			var tw = (prefs.prettier && prefs.prettier.tabWidth) === 2 ? 4 : 2;
			apply_editor_prefs({ prettier: { tabWidth: tw, useTabs: false } });
			$("#code-ide-prettier-tabwidth").val(String(tw));
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
		var slot = get_slot();
		var lang = "JavaScript";
		if (is_view_tab(slot)) lang = (global.SlotSession && SlotSession.slot_label && SlotSession.slot_label(slot)) || "Settings";
		else if (is_type_tab(slot)) lang = "TypeScript";
		$("#code-ide-sb-lang").text(lang);
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
