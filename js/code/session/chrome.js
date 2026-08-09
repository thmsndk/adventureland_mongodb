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

	/**
	 * Editor-slot mousedown focuses the editor for game→CODE focus recovery.
	 * Skip when the target is a stock Monaco/VS Code floating UI — focusing the
	 * editor on lightbulb/action-widget mousedown dismisses quick-fix immediately
	 * (ActionWidgetService trackFocus onDidBlur → hide(true)).
	 */
	function should_focus_editor_from_mousedown(e) {
		var t = e && e.target;
		if (!t || !t.closest) return true;
		if (
			t.closest(
				[
					".contentWidgets",
					".overflowingContentWidgets",
					".lightBulbWidget",
					".context-view",
					".action-widget",
					".monaco-list.action-widget",
					".monaco-menu",
					".monaco-hover",
					".suggest-widget",
					".parameter-hints-widget",
					".quick-input-widget",
					".monaco-quick-input-widget",
				].join(", "),
			)
		) {
			return false;
		}
		// Gutter lightbulb uses ThemeIcon ids that change (gutter-lightbulb, *-sparkle,
		// *-auto-fix, …). Match by class token, not a brittle fixed list.
		var el = t;
		while (el && el.nodeType === 1) {
			var cls = el.className && String(el.className);
			if (cls && /(?:^|\s)codicon-(?:gutter-)?lightbulb\b|(?:^|\s)codicon-sparkle(?:-filled)?\b/.test(cls)) {
				return false;
			}
			if (el === e.currentTarget) break;
			el = el.parentElement;
		}
		return true;
	}
	var close_tab = ss("close_tab");
	var ensure_model = ss("ensure_model");
	var activate_open_slot = ss("activate_open_slot");
	var cycle_open_tab = ss("cycle_open_tab");
	var activate_open_tab_at = ss("activate_open_tab_at");
	var is_type_tab = ss("is_type_tab");
	var is_view_tab = ss("is_view_tab");
	var is_character_slot = ss("is_character_slot");

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

	function migrate_layout_mode(mode) {
		if (!mode || mode === "dock-half" || String(mode).indexOf("dock") === 0) return "overlay-half";
		var order = S.LAYOUT_MODE_ORDER || [];
		if (order.length && order.indexOf(mode) === -1) return "overlay-half";
		return mode;
	}

	function layout_mode_label(mode) {
		if (mode === "overlay-third") return "⅓ width";
		if (mode === "overlay-half") return "½ width";
		if (mode === "overlay-full") return "Full width";
		return mode || "Layout";
	}

	function normalize_layout_presets(raw) {
		var base = Object.assign({}, S.DEFAULT_LAYOUT_PRESETS || {});
		var srcAll = raw && typeof raw === "object" ? Object.assign({}, raw) : {};
		// Former dock slot → half overlay (solid by default).
		if (srcAll["dock-half"] && typeof srcAll["dock-half"] === "object" && !srcAll["overlay-half"]) {
			srcAll["overlay-half"] = srcAll["dock-half"];
		}
		delete srcAll["dock-half"];
		var modes = S.LAYOUT_MODE_ORDER || Object.keys(base);
		for (var i = 0; i < modes.length; i++) {
			var id = modes[i];
			var src = srcAll[id];
			if (!src || typeof src !== "object") continue;
			var w = Number(src.widthPercent);
			var o = Number(src.opacity);
			base[id] = {
				widthPercent: isFinite(w) ? Math.max(15, Math.min(100, Math.round(w))) : base[id].widthPercent,
				opacity: isFinite(o) ? Math.max(0.4, Math.min(1, o)) : base[id].opacity,
			};
		}
		return base;
	}

	function get_layout_preset(mode) {
		var presets = S.layout_presets || S.DEFAULT_LAYOUT_PRESETS || {};
		var p = presets[mode] || (S.DEFAULT_LAYOUT_PRESETS && S.DEFAULT_LAYOUT_PRESETS[mode]);
		if (!p) return { widthPercent: 50, opacity: 0.92 };
		return p;
	}

	function persist_layout_presets() {
		try {
			localStorage.setItem(S.PRESETS_KEY, JSON.stringify(S.layout_presets || {}));
		} catch (e) {}
	}

	function set_layout_presets(presets, opts) {
		opts = opts || {};
		S.layout_presets = normalize_layout_presets(presets);
		persist_layout_presets();
		if (opts.apply !== false) apply_layout();
		if (opts.sync !== false) sync_layout_to_vscode();
		refresh_layout_menu();
	}

	function update_active_preset_opacity(opacity, opts) {
		opts = opts || {};
		var mode = migrate_layout_mode(S.layout_mode);
		var o = Math.max(0.4, Math.min(1, Number(opacity) || 0.92));
		S.layout_presets = normalize_layout_presets(S.layout_presets);
		S.layout_presets[mode] = Object.assign({}, get_layout_preset(mode), { opacity: o });
		S.overlay_alpha = o;
		try {
			localStorage.setItem(S.ALPHA_KEY, String(o));
		} catch (e) {}
		persist_layout_presets();
		apply_layout();
		sync_layout_to_vscode();
		if (opts.refreshMenu) refresh_layout_menu();
		else sync_layout_menu_opacity_ui(o);
	}

	/** Update opacity label + active preset meta without rebuilding the menu (keeps range drag alive). */
	function sync_layout_menu_opacity_ui(opacity) {
		var $menu = $("#code-ide-layout-menu");
		if (!$menu.length || $menu.attr("hidden")) return;
		var pct = Math.round((opacity != null ? opacity : S.overlay_alpha || 0.92) * 100);
		var $range = $menu.find("#code-ide-layout-opacity");
		if ($range.length && String($range.val()) !== String(pct)) $range.val(pct);
		$menu.find(".code-ide-layout-opacity label").text("Opacity " + pct + "%");
		var mode = migrate_layout_mode(S.layout_mode);
		var preset = get_layout_preset(mode);
		$menu.find(".code-ide-layout-option.active .code-ide-layout-meta").text(preset.widthPercent + "% · " + pct + "%");
	}

	function toolbar_markup() {
		return (
			'<div id="code-ide-toolbar">' +
			'<div class="code-ide-toolbar-left">' +
			'<button type="button" class="code-ide-iconbtn" id="code-ide-toggle-sidebar" title="Toggle Sidebar">⧉</button>' +
			'<button type="button" class="code-ide-iconbtn" id="code-ide-settings" title="Settings">⚙</button>' +
			'<button type="button" class="code-ide-iconbtn" id="code-ide-layout-btn" title="Layout (Ctrl+Alt+L)" aria-label="Layout presets" aria-haspopup="true" aria-expanded="false">⊞</button>' +
			"</div>" +
			'<div class="code-ide-toolbar-spacer" aria-hidden="true"></div>' +
			'<div class="code-ide-toolbar-actions">' +
			'<div class="code-ide-run-split" id="code-ide-run-split" data-run-action="play">' +
			'<button type="button" class="code-ide-run idle" id="code-ide-run" title="Play / Pause (Ctrl+Enter)" aria-label="Play or pause script">' +
			run_btn_icon_html(false, "play") +
			"</button>" +
			'<button type="button" class="code-ide-run-caret" id="code-ide-run-menu-btn" title="Default Play action" aria-label="Default Play action" aria-haspopup="true" aria-expanded="false">▼</button>' +
			"</div>" +
			"</div>" +
			'<div class="code-ide-toolbar-close-gap" aria-hidden="true"></div>' +
			'<button type="button" class="code-ide-iconbtn code-ide-closebtn" id="code-ide-close" title="Close CODE" aria-label="Close CODE">×</button>' +
			'<div id="code-ide-run-menu" class="code-ide-run-menu" hidden role="menu"></div>' +
			'<div id="code-ide-layout-menu" class="code-ide-layout-menu" hidden role="menu"></div>' +
			"</div>"
		);
	}

	function ensure_settings_dom() {
		if (!$("#code-ide-settings").length) {
			var $left = $(".code-ide-toolbar-left").first();
			if ($left.length) {
				$left.append('<button type="button" class="code-ide-iconbtn" id="code-ide-settings" title="Settings">⚙</button>');
			} else {
				$("#code-ide-toggle-sidebar").after('<button type="button" class="code-ide-iconbtn" id="code-ide-settings" title="Settings">⚙</button>');
			}
			$("#code-ide-settings").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				open_vscode_settings(false);
			});
		}
		if ($("#code-ide-settings-panel").length) $("#code-ide-settings-panel").remove();
		if (!$("#code-ide-editor-slot").data("al-focus-bound")) {
			$("#code-ide-editor-slot")
				.data("al-focus-bound", 1)
				.on("mousedown", function (e) {
					// Do not steal focus when interacting with editor widgets — mousedown→focus
					// dismisses the stock quick-fix / action-widget (same as VS Code content widgets).
					if (!should_focus_editor_from_mousedown(e)) return;
					if (S.editor && S.editor.focus) S.editor.focus();
				});
		}
	}

	function close_layout_menu() {
		var $menu = $("#code-ide-layout-menu");
		var $btn = $("#code-ide-layout-btn");
		if ($menu.length) $menu.attr("hidden", true);
		if ($btn.length) $btn.attr("aria-expanded", "false");
	}

	function refresh_layout_menu() {
		var $menu = $("#code-ide-layout-menu");
		if (!$menu.length) return;
		var modes = S.LAYOUT_MODE_ORDER || ["overlay-third", "overlay-half", "overlay-full"];
		var active = migrate_layout_mode(S.layout_mode);
		var html = "";
		for (var i = 0; i < modes.length; i++) {
			var mode = modes[i];
			var preset = get_layout_preset(mode);
			var isActive = mode === active;
			html +=
				'<button type="button" class="code-ide-layout-option' +
				(isActive ? " active" : "") +
				'" role="menuitemradio" aria-checked="' +
				(isActive ? "true" : "false") +
				'" data-layout-mode="' +
				mode +
				'">' +
				"<span>" +
				layout_mode_label(mode) +
				"</span>" +
				'<span class="code-ide-layout-meta">' +
				preset.widthPercent +
				"% · " +
				Math.round(preset.opacity * 100) +
				"%</span>" +
				"</button>";
		}
		var op = Math.round((get_layout_preset(active).opacity || S.overlay_alpha || 0.92) * 100);
		html +=
			'<div class="code-ide-layout-opacity">' +
			'<label for="code-ide-layout-opacity">Opacity ' +
			op +
			"%</label>" +
			'<input type="range" id="code-ide-layout-opacity" min="40" max="100" value="' +
			op +
			'" />' +
			"</div>";
		$menu.html(html);
	}

	function open_layout_menu() {
		var $menu = $("#code-ide-layout-menu");
		var $btn = $("#code-ide-layout-btn");
		if (!$menu.length || !$btn.length) return;
		close_run_menu();
		refresh_layout_menu();
		$menu.removeAttr("hidden");
		$btn.attr("aria-expanded", "true");
	}

	function toggle_layout_menu(forceClose) {
		if (forceClose) {
			close_layout_menu();
			return;
		}
		var $menu = $("#code-ide-layout-menu");
		if ($menu.length && !$menu.attr("hidden")) close_layout_menu();
		else open_layout_menu();
	}

	function bind_layout_menu() {
		if ($("#code-ide-toolbar").data("al-layout-bound")) return;
		$("#code-ide-toolbar").data("al-layout-bound", 1);
		$("#code-ide-layout-btn").on("click", function (e) {
			if (e && e.stopPropagation) e.stopPropagation();
			toggle_layout_menu();
		});
		$("#code-ide-layout-menu").on("click", function (e) {
			if (e && e.stopPropagation) e.stopPropagation();
			var $opt = $(e.target).closest("[data-layout-mode]");
			if ($opt.length) {
				set_layout_mode($opt.attr("data-layout-mode"));
				refresh_layout_menu();
				return;
			}
		});
		$("#code-ide-layout-menu").on("input", "#code-ide-layout-opacity", function () {
			var v = parseInt($(this).val(), 10);
			if (!isFinite(v)) return;
			update_active_preset_opacity(v / 100);
		});
		$("#code-ide-layout-menu").on("change", "#code-ide-layout-opacity", function () {
			var v = parseInt($(this).val(), 10);
			if (!isFinite(v)) return;
			update_active_preset_opacity(v / 100, { refreshMenu: true });
		});
		$("#code-ide-layout-menu").on("wheel", ".code-ide-layout-opacity, #code-ide-layout-opacity", function (e) {
			var oe = e.originalEvent || e;
			if (!oe || oe.deltaY === 0) return;
			if (e.preventDefault) e.preventDefault();
			if (e.stopPropagation) e.stopPropagation();
			var $range = $("#code-ide-layout-opacity");
			if (!$range.length) return;
			var step = e.shiftKey ? 2 : 1;
			var cur = parseInt($range.val(), 10);
			if (!isFinite(cur)) cur = 92;
			var next = Math.max(40, Math.min(100, cur + (oe.deltaY < 0 ? step : -step)));
			if (next === cur) return;
			$range.val(next);
			update_active_preset_opacity(next / 100);
		});
		$(document)
			.off("mousedown.alLayoutMenu")
			.on("mousedown.alLayoutMenu", function (e) {
				if (!$(e.target).closest("#code-ide-layout-menu, #code-ide-layout-btn").length) {
					close_layout_menu();
				}
			});
	}

	function migrate_toolbar_dom() {
		$("#code-ide-save-as, #code-ide-split, #code-ide-status, #code-ide-layout, #code-ide-alpha").remove();
		$(".code-ide-autorun").remove();
		$(".code-ide-toolbar-right").children().appendTo("#code-ide-toolbar");
		$(".code-ide-toolbar-right").remove();
		if (!$(".code-ide-toolbar-left").length || !$("#code-ide-layout-btn").length || !$("#code-ide-run-split").length) {
			var $tb = $("#code-ide-toolbar");
			if (!$tb.length) return;
			var $run = $("#code-ide-run").detach();
			var $close = $("#code-ide-close").detach();
			var $settings = $("#code-ide-settings").detach();
			var $side = $("#code-ide-toggle-sidebar").detach();
			$tb.empty().append($(toolbar_markup()).children());
			if ($side.length) $("#code-ide-toggle-sidebar").replaceWith($side);
			if ($settings.length) $("#code-ide-settings").replaceWith($settings);
			if ($run.length && $("#code-ide-run").length) {
				$("#code-ide-run").replaceWith($run);
			}
			if ($close.length) $("#code-ide-close").replaceWith($close);
			$("#code-ide-toolbar").data("al-layout-bound", 0);
			$("#code-ide-toolbar").data("al-run-menu-bound", 0);
		}
		if ($("#code-ide-run").length && !$("#code-ide-run-split").length) {
			$("#code-ide-run").wrap('<div class="code-ide-run-split" id="code-ide-run-split" data-run-action="play"></div>');
			$("#code-ide-run-split").append(
				'<button type="button" class="code-ide-run-caret" id="code-ide-run-menu-btn" title="Default Play action" aria-label="Default Play action" aria-haspopup="true" aria-expanded="false">▼</button>',
			);
			$("#code-ide-toolbar").data("al-run-menu-bound", 0);
		}
		var $layoutBtn = $("#code-ide-layout-btn");
		var $leftBar = $(".code-ide-toolbar-left").first();
		if ($layoutBtn.length && $leftBar.length && !$layoutBtn.parent().is(".code-ide-toolbar-left")) {
			var $settings = $("#code-ide-settings");
			if ($settings.length) $settings.after($layoutBtn);
			else $leftBar.append($layoutBtn);
			$(".code-ide-toolbar-actions > .code-ide-toolbar-divider").remove();
		}
		if (!$("#code-ide-run-menu").length) {
			$("#code-ide-toolbar").append('<div id="code-ide-run-menu" class="code-ide-run-menu" hidden role="menu"></div>');
		}
		if (!$("#code-ide-layout-menu").length) {
			$("#code-ide-toolbar").append('<div id="code-ide-layout-menu" class="code-ide-layout-menu" hidden role="menu"></div>');
		}
		sync_default_run_action_ui();
	}

	function normalize_run_action(action) {
		return action === "playRerunOnSave" ? "playRerunOnSave" : "play";
	}

	/** Idle Play uses debug-start; Play·rerun-on-Save uses debug-rerun; running uses debug-pause. */
	function run_idle_icon_id(action) {
		return normalize_run_action(action) === "playRerunOnSave" ? "debug-rerun" : "debug-start";
	}

	function run_btn_icon_html(running, action) {
		var id = running ? "debug-pause" : run_idle_icon_id(action);
		return '<span class="codicon codicon-' + id + '" aria-hidden="true"></span>';
	}

	function sync_default_run_action_ui() {
		var action = normalize_run_action(S.default_run_action);
		S.auto_rerun = action === "playRerunOnSave";
		var $split = $("#code-ide-run-split");
		if ($split.length) $split.attr("data-run-action", action);
		var $btn = $("#code-ide-run");
		if ($btn.length && !$btn.hasClass("running")) {
			$btn.html(run_btn_icon_html(false, action));
		}
		refresh_run_menu();
	}

	function set_default_run_action(action, opts) {
		opts = opts || {};
		action = normalize_run_action(action);
		S.default_run_action = action;
		S.auto_rerun = action === "playRerunOnSave";
		try {
			localStorage.setItem(S.DEFAULT_RUN_ACTION_KEY, action);
			localStorage.setItem(S.AUTO_RERUN_KEY, S.auto_rerun ? "1" : "0");
		} catch (e) {}
		sync_default_run_action_ui();
		if (typeof set_running === "function") set_running(!!global.code_run);
		if (opts.sync === false || global.__AL_SKIP_VSCODE_SYNC) return;
		var api = global.ALVscodeApi;
		if (api && typeof api.mergeUserConfiguration === "function") {
			try {
				api.mergeUserConfiguration({ "adventureland.defaultRunAction": action });
			} catch (e2) {}
		}
	}

	function set_auto_rerun(on, opts) {
		set_default_run_action(on ? "playRerunOnSave" : "play", opts);
	}

	function close_run_menu() {
		var $menu = $("#code-ide-run-menu");
		var $btn = $("#code-ide-run-menu-btn");
		if ($menu.length) $menu.attr("hidden", true);
		if ($btn.length) $btn.attr("aria-expanded", "false");
	}

	function refresh_run_menu() {
		var $menu = $("#code-ide-run-menu");
		if (!$menu.length) return;
		var active = normalize_run_action(S.default_run_action);
		var items = [
			{
				id: "play",
				icon: "debug-start",
				title: "Play",
				sub: "Start from the open tab. Save does not restart the runner.",
			},
			{
				id: "playRerunOnSave",
				icon: "debug-rerun",
				title: "Play · rerun on Save",
				sub: "While running, Save restarts the runner with the editor.",
			},
		];
		var html = "";
		for (var i = 0; i < items.length; i++) {
			var it = items[i];
			var isActive = it.id === active;
			html +=
				'<button type="button" class="code-ide-run-option' +
				(isActive ? " active" : "") +
				'" role="menuitemradio" aria-checked="' +
				(isActive ? "true" : "false") +
				'" data-run-action="' +
				it.id +
				'">' +
				'<span class="code-ide-run-option-check" aria-hidden="true">' +
				(isActive ? "✓" : "") +
				"</span>" +
				'<span class="codicon codicon-' +
				it.icon +
				'" aria-hidden="true"></span>' +
				'<span class="code-ide-run-option-text">' +
				'<span class="code-ide-run-option-title">' +
				it.title +
				"</span>" +
				'<span class="code-ide-run-option-sub">' +
				it.sub +
				"</span>" +
				"</span>" +
				"</button>";
		}
		$menu.html(html);
	}

	function open_run_menu() {
		var $menu = $("#code-ide-run-menu");
		var $btn = $("#code-ide-run-menu-btn");
		if (!$menu.length || !$btn.length) return;
		close_layout_menu();
		refresh_run_menu();
		$menu.removeAttr("hidden");
		$btn.attr("aria-expanded", "true");
	}

	function toggle_run_menu(forceClose) {
		if (forceClose) {
			close_run_menu();
			return;
		}
		var $menu = $("#code-ide-run-menu");
		if ($menu.length && !$menu.attr("hidden")) close_run_menu();
		else open_run_menu();
	}

	function bind_run_menu() {
		if ($("#code-ide-toolbar").data("al-run-menu-bound")) {
			sync_default_run_action_ui();
			return;
		}
		if (!$("#code-ide-run-menu-btn").length) return;
		$("#code-ide-toolbar").data("al-run-menu-bound", 1);
		$("#code-ide-run-menu-btn").on("click", function (e) {
			if (e && e.stopPropagation) e.stopPropagation();
			toggle_run_menu();
		});
		$("#code-ide-run-menu").on("click", function (e) {
			if (e && e.stopPropagation) e.stopPropagation();
			var $opt = $(e.target).closest("[data-run-action]");
			if ($opt.length) {
				set_default_run_action($opt.attr("data-run-action"));
				close_run_menu();
			}
		});
		$(document)
			.off("mousedown.alRunMenu")
			.on("mousedown.alRunMenu", function (e) {
				if (!$(e.target).closest("#code-ide-run-menu, #code-ide-run-menu-btn, #code-ide-run-split").length) {
					close_run_menu();
				}
			});
		sync_default_run_action_ui();
	}

	function ensure_chrome_dom() {
		var $ui = $("#codeui");
		if (!$ui.length) return;
		$ui.addClass("code-ide");

		if (!$("#code-ide-shell").length) {
			$ui.prepend(
				'<div id="code-ide-shell">' +
					'<div id="code-ide-body">' +
					'<aside id="code-ide-sidebar">' +
					'<div id="code-ide-sidebar-body" class="code-ide-sidebar-body"></div>' +
					"</aside>" +
					'<section id="code-ide-main">' +
					toolbar_markup() +
					'<div id="code-ide-editor-slot"></div>' +
					problems_panel_markup() +
					"</section>" +
					"</div>" +
					statusbar_markup() +
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
			$("#code-ide-settings").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				open_vscode_settings(false);
			});
			$(document).off("keydown.alcodeclose");
			$("#code-ide-editor-slot").on("mousedown", function (e) {
				if (!should_focus_editor_from_mousedown(e)) return;
				if (S.editor && S.editor.focus) S.editor.focus();
			});
			bind_layout_menu();
			bind_run_menu();
			ensure_settings_dom();
		} else {
			migrate_toolbar_dom();
			ensure_settings_dom();
			bind_layout_menu();
			bind_run_menu();
		}

		// Drop legacy custom EXPLORER head / tab strip — stock sidebar title + workbench tabs.
		$(".code-ide-sidebar-head").remove();
		$("#code-ide-tabs").remove();
		$("#code-ide-docs, #code-ide-new-file").remove();
		$("#code-ide-save-as, #code-ide-split, #code-ide-status, select#code-ide-layout, #code-ide-alpha").remove();

		var $toggle = $("#code-ide-toggle-sidebar");
		if ($toggle.length && !$toggle.closest(".code-ide-toolbar-left").length) {
			var $left = $(".code-ide-toolbar-left").first();
			if ($left.length) $left.prepend($toggle);
			else $("#code-ide-toolbar").prepend($toggle);
		} else if (!$toggle.length) {
			$(".code-ide-toolbar-left").prepend('<button type="button" class="code-ide-iconbtn" id="code-ide-toggle-sidebar" title="Toggle Sidebar">⧉</button>');
			$("#code-ide-toggle-sidebar").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				S.explorer_collapsed = !S.explorer_collapsed;
				$ui.toggleClass("explorer-collapsed", S.explorer_collapsed);
				layout_editor();
			});
		}

		var $host = $ui.find(".monaco-editor-host.maincode").first();
		if ($host.length && !$host.parent().is("#code-ide-editor-slot")) {
			$("#code-ide-editor-slot").append($host);
		}
		$ui.addClass("has-explorer");
		$ui.toggleClass("explorer-collapsed", S.explorer_collapsed);
		ensure_shell_layout();
		ensure_global_shortcuts();
		ensure_problems_panel();
		if (global.SlotSession && typeof SlotSession.ensure_outline_panel === "function") {
			SlotSession.ensure_outline_panel();
			if (typeof SlotSession.schedule_refresh_outline === "function") SlotSession.schedule_refresh_outline();
		}
		apply_chrome_theme();
		ensure_settings_dom();
		ensure_statusbar_actions();
		ensure_close_button();
		bind_run_menu();
		refresh_layout_menu();
	}

	function ensure_close_button() {
		var $tb = $("#code-ide-toolbar").first();
		if (!$tb.length) return;
		var $close = $("#code-ide-close");
		if (!$close.length) {
			$tb.append('<button type="button" class="code-ide-iconbtn code-ide-closebtn" id="code-ide-close" title="Close CODE" aria-label="Close CODE">×</button>');
			$close = $("#code-ide-close");
		} else if (!$close.parent().is("#code-ide-toolbar")) {
			$tb.append($close);
		}
		$close.off("click.alcodeclose").on("click.alcodeclose", function (e) {
			if (e && e.stopPropagation) e.stopPropagation();
			if (typeof global.toggle_code === "function") global.toggle_code();
		});
	}

	function ensure_global_shortcuts() {
		var KEYS_VER = 2638;
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
			return !!t.closest("#codeui, #al-vscode-workbench, .quick-input-widget, .monaco-quick-input-widget, .monaco-hover, .context-view, .action-widget, .monaco-menu");
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

			// F11 — browser would fullscreen; own panel maximize whenever CODE is open.
			if (e.key === "F11" || e.keyCode === 122) {
				e.preventDefault();
				e.stopPropagation();
				if (e.stopImmediatePropagation) e.stopImmediatePropagation();
				runCmd("adventureland.code.toggleProblemsMaximize");
				return;
			}

			// Ctrl+Alt+L / Ctrl+Alt+1–3 — layout presets (also when IDE focused; avoid game steal).
			if (modEarly && e.altKey && !e.shiftKey) {
				var layoutDigit = -1;
				if (e.code && /^Digit[1-3]$/.test(e.code)) layoutDigit = parseInt(e.code.slice(5), 10);
				else if (e.key >= "1" && e.key <= "3") layoutDigit = parseInt(e.key, 10);
				else if (e.keyCode >= 49 && e.keyCode <= 51) layoutDigit = e.keyCode - 48;
				if (layoutDigit >= 1 && layoutDigit <= 3) {
					e.preventDefault();
					e.stopPropagation();
					if (e.stopImmediatePropagation) e.stopImmediatePropagation();
					runCmd("adventureland.code.layoutPreset" + layoutDigit);
					return;
				}
				if (e.key === "l" || e.key === "L" || e.keyCode === 76 || e.code === "KeyL") {
					e.preventDefault();
					e.stopPropagation();
					if (e.stopImmediatePropagation) e.stopImmediatePropagation();
					runCmd("adventureland.code.cycleLayout");
					return;
				}
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
			if (key === "j" && !e.shiftKey && !e.altKey) {
				e.preventDefault();
				e.stopPropagation();
				runCmd("adventureland.code.toggleProblems");
				return;
			}
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

	/** Migrate older shells: wrap sidebar+main, move status bar under full shell width. */
	function ensure_shell_layout() {
		var $shell = $("#code-ide-shell");
		if (!$shell.length) return;
		if (!$("#code-ide-body").length) {
			var $body = $('<div id="code-ide-body"></div>');
			$shell.children("#code-ide-sidebar, #code-ide-main").appendTo($body);
			$shell.prepend($body);
		}
		var $sb = $("#code-ide-statusbar");
		if ($sb.length && !$sb.parent().is("#code-ide-shell")) {
			$shell.append($sb);
		} else if (!$sb.length) {
			$shell.append(statusbar_markup());
		}
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
				"adventureland.layoutMode": migrate_layout_mode(S.layout_mode),
				"adventureland.overlayOpacity": typeof S.overlay_alpha === "number" ? S.overlay_alpha : 1,
				"adventureland.layoutPresets": normalize_layout_presets(S.layout_presets),
			});
		} catch (e) {}
	}

	function set_layout_mode(mode) {
		var next = migrate_layout_mode(mode);
		S.layout_mode = next;
		try {
			localStorage.setItem(S.LAYOUT_KEY, S.layout_mode);
		} catch (e) {}
		var preset = get_layout_preset(S.layout_mode);
		S.overlay_alpha = preset.opacity;
		try {
			localStorage.setItem(S.ALPHA_KEY, String(S.overlay_alpha));
		} catch (e2) {}
		apply_layout();
		sync_layout_to_vscode();
		refresh_layout_menu();
		$("#code-ide-layout-btn").attr("title", "Layout: " + layout_mode_label(S.layout_mode) + " (Ctrl+Alt+L)");
	}

	function cycle_layout_mode(delta) {
		var order = S.LAYOUT_MODE_ORDER || ["overlay-third", "overlay-half", "overlay-full"];
		var idx = order.indexOf(migrate_layout_mode(S.layout_mode));
		if (idx < 0) idx = 0;
		var step = delta < 0 ? -1 : 1;
		var next = order[(idx + step + order.length) % order.length];
		set_layout_mode(next);
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

		var mode = migrate_layout_mode(S.layout_mode);
		if (S.layout_mode !== mode) S.layout_mode = mode;
		var preset = get_layout_preset(mode);
		var pct = Math.max(15, Math.min(100, Number(preset.widthPercent) || 50));
		$ui[0].style.setProperty("--code-ide-panel-width", pct + "%");
		$ui.addClass("layout-" + mode).css("opacity", preset.opacity);
		S.overlay_alpha = preset.opacity;

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

	function describe_play_target() {
		var slot = get_slot();
		if (slot == null || is_type_tab(slot) || is_view_tab(slot)) return null;
		var list = (global.X && X.codes) || {};
		var label = "file";
		try {
			if (global.SlotSession && typeof SlotSession.slot_label === "function") {
				label = SlotSession.slot_label(slot, list[slot]);
			}
		} catch (e) {}
		var who = (global.character && character.name) || "this character";
		return { slot: slot, label: label, who: who };
	}

	function describe_running() {
		if (!global.code_run) return null;
		if (global.actual_code) {
			var slot = global.code_run_slot != null ? global.code_run_slot : global.code_slot;
			var list = (global.X && X.codes) || {};
			var label = String(slot || "code");
			try {
				if (global.SlotSession && typeof SlotSession.slot_label === "function") {
					label = SlotSession.slot_label(slot, list[slot]);
				}
			} catch (e) {}
			return { kind: "file", label: label, slot: slot };
		}
		return { kind: "snippet", label: "Travel / snippet" };
	}

	function editing_mismatch(run) {
		if (!run || run.kind !== "file" || run.slot == null) return null;
		var edit = describe_play_target();
		if (!edit || edit.slot == null) return null;
		try {
			if (String(slot_key(edit.slot)) === String(slot_key(run.slot))) return null;
		} catch (e) {
			return null;
		}
		return edit;
	}

	function confirm_play_other_character(target) {
		if (!target || !is_character_slot(target.slot)) return true;
		var rid = global.real_id != null ? String(slot_key(global.real_id)) : "";
		var sid = String(slot_key(target.slot));
		if (!rid || !sid || rid === sid) return true;
		var msg = "Run " + target.label + " as " + target.who + "?\n\nThis is another character's file. It will control " + target.who + " — it will not switch characters.";
		return window.confirm(msg);
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
			var target = describe_play_target();
			if (!confirm_play_other_character(target)) return;
			if (target && typeof global.add_log === "function") {
				add_log("Running " + target.label + " as " + target.who, "#85C76B");
			}
			if (typeof start_runner === "function") start_runner();
		}
	}

	function sync_running_decoration(run) {
		try {
			var api = global.ALVscodeApi;
			if (!api || typeof api.setRunningCodeSlot !== "function") return;
			if (!run || run.kind !== "file" || run.slot == null) {
				api.setRunningCodeSlot(null);
				return;
			}
			var isChar = false;
			try {
				isChar = !!(global.SlotSession && typeof SlotSession.is_character_slot === "function" && SlotSession.is_character_slot(run.slot));
			} catch (eChar) {}
			api.setRunningCodeSlot(run.slot, { character: isChar, label: run.label });
		} catch (eDeco) {}
	}

	function set_running(running) {
		var $btn = $("#code-ide-run");
		var run = running ? describe_running() : null;
		var mismatch = running ? editing_mismatch(run) : null;
		var action = normalize_run_action(S.default_run_action);
		var $split = $("#code-ide-run-split");
		if ($split.length) $split.attr("data-run-action", action);
		var policyHint = action === "playRerunOnSave" ? " · Save restarts runner" : " · Save does not restart";
		if ($btn.length) {
			if (running) {
				var pauseTitle;
				if (run && run.kind === "snippet") {
					pauseTitle = "Stop travel/snippet runner (Ctrl+Enter)";
				} else if (mismatch) {
					pauseTitle = "Stop runner — " + ((run && run.label) || "code") + " · editing " + mismatch.label + " (Ctrl+Enter)";
				} else {
					pauseTitle = "Stop runner — " + ((run && run.label) || "code") + " (Ctrl+Enter)";
				}
				$btn.removeClass("idle").addClass("running").html(run_btn_icon_html(true)).attr("title", pauseTitle);
				if (run && run.kind === "snippet") $btn.attr("data-run-kind", "snippet");
				else $btn.attr("data-run-kind", "file");
			} else {
				var target = describe_play_target();
				var playTitle = target ? "Run " + target.label + " as " + target.who + policyHint + " (Ctrl+Enter)" : "Run open tab" + policyHint + " (Ctrl+Enter)";
				$btn.removeClass("running").addClass("idle").html(run_btn_icon_html(false, action)).attr("title", playTitle).removeAttr("data-run-kind");
			}
		}
		sync_running_decoration(run);
		try {
			if (global.ALVscodeApi && typeof ALVscodeApi.refreshStatusBarExtras === "function") {
				ALVscodeApi.refreshStatusBarExtras();
			}
		} catch (eSb) {}
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
		cycle_layout_mode: cycle_layout_mode,
		set_layout_presets: set_layout_presets,
		open_layout_menu: open_layout_menu,
		toggle_layout_menu: toggle_layout_menu,
		set_auto_rerun: set_auto_rerun,
		set_default_run_action: set_default_run_action,
		get_value: get_value,
		set_value: set_value,
		apply_chrome_theme: apply_chrome_theme,
		layout_editor: layout_editor,
		ensure_chrome_dom: ensure_chrome_dom,
		update_statusbar: update_statusbar,
		ensure_statusbar_cursor: ensure_statusbar_cursor,
		apply_editor_prefs: apply_editor_prefs,
		statusbar_markup: statusbar_markup,
		note_file_saved: function (slot, whenMs) {
			try {
				if (global.ALVscodeApi && typeof ALVscodeApi.noteFileSaved === "function") {
					ALVscodeApi.noteFileSaved(slot, whenMs);
					return;
				}
			} catch (e) {}
		},
		toggle_settings_panel: toggle_settings_panel,
		ensure_settings_dom: ensure_settings_dom,
	});
})(typeof window !== "undefined" ? window : globalThis);
