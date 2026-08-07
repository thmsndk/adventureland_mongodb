/**
 * SlotSession — multi-slot Monaco models, IDE chrome, layout modes, play/pause.
 */
(function (global) {
	"use strict";

	var editor = null;
	var list_fetched = false;
	var explorer_collapsed = false;
	var models = {}; // slot -> ITextModel
	var open_tabs = []; // slot ids as strings
	var dirty_slots = {}; // slot -> bool
	var model_listeners = {}; // slot -> disposable
	var applying_model = false;

	var LAYOUT_KEY = "al_code_layout";
	var ALPHA_KEY = "al_code_alpha";
	var TREE_KEY = "al_code_tree_folders";
	var layout_mode = "dock-half"; // dock-half | overlay-third | overlay-half | overlay-full
	var overlay_alpha = 0.92;
	var tree_folders = { characters: true, slots: true };

	try {
		layout_mode = localStorage.getItem(LAYOUT_KEY) || layout_mode;
		var a = parseFloat(localStorage.getItem(ALPHA_KEY));
		if (!isNaN(a) && a >= 0.3 && a <= 1) overlay_alpha = a;
		var tf = localStorage.getItem(TREE_KEY);
		if (tf) {
			var parsed = JSON.parse(tf);
			if (parsed && typeof parsed === "object") tree_folders = parsed;
		}
	} catch (e) {}

	function get_slot() {
		return global.code_slot;
	}

	function set_slot(slot) {
		global.code_slot = slot;
	}

	function slot_key(slot) {
		return "" + slot;
	}

	function monaco_api() {
		return editor && editor._monaco;
	}

	function mark_dirty() {
		var s = slot_key(get_slot());
		if (s) dirty_slots[s] = true;
		global.code_change = true;
		refresh_chrome();
	}

	function clear_dirty(slot) {
		var s = slot_key(slot != null ? slot : get_slot());
		if (s) delete dirty_slots[s];
		global.code_change = !!dirty_slots[slot_key(get_slot())];
		refresh_chrome();
	}

	function is_dirty(slot) {
		return !!dirty_slots[slot_key(slot)];
	}

	function bind_editor(ed) {
		editor = ed;
		ensure_chrome_dom();
		registerAdventureLandTypesSafe();
		var initial = ed.getValue() || "";
		var slot = get_slot() || (global.real_id != null ? global.real_id : "0");
		set_slot(slot);
		ensure_tab(slot);
		var model = ensure_model(slot, initial, true);
		set_active_model(slot, model);
		apply_layout();
		refresh_chrome();
		apply_chrome_theme();
		set_running(!!global.code_run);
	}

	function registerAdventureLandTypesSafe() {
		if (global.ALEditor && typeof ALEditor.registerTypes === "function") {
			ALEditor.registerTypes();
			return;
		}
		if (global.monaco && monaco.languages && monaco.languages.typescript && global.__AL_MONACO_TYPES__) {
			try {
				if (typeof global.create_editor === "function") {
					/* fallback: mirror editor.js registration path via force if exposed later */
				}
				var ts = monaco.languages.typescript;
				var libs = global.__AL_MONACO_TYPES__;
				var names = Object.keys(libs);
				for (var i = 0; i < names.length; i++) {
					var uri = "file:///adventureland/types/" + names[i];
					ts.javascriptDefaults.addExtraLib(libs[names[i]], uri);
					ts.typescriptDefaults.addExtraLib(libs[names[i]], uri);
				}
				if (typeof ts.javascriptDefaults.setEagerModelSync === "function") {
					ts.javascriptDefaults.setEagerModelSync(true);
					ts.typescriptDefaults.setEagerModelSync(true);
				}
			} catch (e) {}
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
					'<button type="button" class="code-ide-iconbtn code-ide-docsbtn" id="code-ide-docs" title="Code Slots and Files documentation">?</button>' +
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
					'<div id="code-ide-settings-panel" hidden>' +
					'<div class="code-ide-settings-title">Editor settings</div>' +
					'<label class="code-ide-settings-row">Theme' +
					'<select id="code-ide-theme">' +
					'<option value="vs-dark">Dark</option>' +
					'<option value="vs">Light</option>' +
					'<option value="hc-black">High Contrast</option>' +
					'<option value="pixel">Pixel</option>' +
					"</select></label>" +
					'<label class="code-ide-settings-row">Font' +
					'<select id="code-ide-font">' +
					'<option value="Consolas, &quot;Cascadia Mono&quot;, &quot;Segoe UI Mono&quot;, Menlo, Monaco, monospace">Consolas / Cascadia</option>' +
					'<option value="&quot;Cascadia Code&quot;, Consolas, monospace">Cascadia Code</option>' +
					'<option value="&quot;Fira Code&quot;, Consolas, monospace">Fira Code</option>' +
					'<option value="&quot;JetBrains Mono&quot;, Consolas, monospace">JetBrains Mono</option>' +
					'<option value="Menlo, Monaco, &quot;Courier New&quot;, monospace">Menlo / Monaco</option>' +
					'<option value="&quot;Courier New&quot;, Courier, monospace">Courier New</option>' +
					'<option value="custom">Custom…</option>' +
					"</select></label>" +
					'<label class="code-ide-settings-row code-ide-font-custom" hidden>Custom font' +
					'<input type="text" id="code-ide-font-custom" placeholder="e.g. Cascadia Mono, monospace" />' +
					"</label>" +
					'<label class="code-ide-settings-row">Font size' +
					'<input type="range" id="code-ide-fontsize" min="11" max="28" value="16" />' +
					'<span id="code-ide-fontsize-val">16</span>' +
					"</label>" +
					'<div class="code-ide-settings-hint">Ctrl/Cmd + scroll zooms font size</div>' +
					"</div>" +
					"</section>" +
					"</div>",
			);

			$("#code-ide-toggle-sidebar").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				explorer_collapsed = !explorer_collapsed;
				$ui.toggleClass("explorer-collapsed", explorer_collapsed);
				layout_editor();
			});
			$("#code-ide-run").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				toggle_play();
			});
			$("#code-ide-save-as").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				api_call_l("list_codes", { purpose: "save" }, { disable: $(this) });
			});
			$("#code-ide-docs").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				open_code_slots_docs();
			});
			$("#code-ide-settings").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				toggle_settings_panel();
			});
			$("#code-ide-theme").on("change", function () {
				apply_editor_prefs({ theme: $(this).val() });
			});
			$("#code-ide-font").on("change", function () {
				var v = $(this).val();
				$(".code-ide-font-custom").toggle(v === "custom");
				if (v === "custom") {
					$("#code-ide-font-custom").focus();
					return;
				}
				apply_editor_prefs({ fontFamily: v });
			});
			$("#code-ide-font-custom").on("change blur", function () {
				var v = ($(this).val() || "").trim();
				if (v) apply_editor_prefs({ fontFamily: v });
			});
			$("#code-ide-fontsize").on("input change", function () {
				var n = parseInt($(this).val(), 10);
				$("#code-ide-fontsize-val").text(String(n));
				apply_editor_prefs({ fontSize: n });
			});
			$("#code-ide-layout").on("change", function () {
				set_layout_mode($(this).val());
			});
			$("#code-ide-alpha").on("input change", function () {
				overlay_alpha = Math.max(0.4, Math.min(1, parseInt($(this).val(), 10) / 100));
				try {
					localStorage.setItem(ALPHA_KEY, String(overlay_alpha));
				} catch (err) {}
				apply_layout();
			});
			$("#code-ide-editor-slot").on("mousedown", function () {
				if (editor && editor.focus) editor.focus();
			});
		} else {
			ensure_settings_dom();
		}

		$("#code-ide-layout").val(layout_mode);
		$("#code-ide-alpha").val(Math.round(overlay_alpha * 100));
		$("#code-ide-alpha").toggle(layout_mode.indexOf("overlay") === 0);

		// Migrate: keep sidebar toggle on the toolbar (visible when explorer is collapsed)
		var $toggle = $("#code-ide-toggle-sidebar");
		if ($toggle.length && !$toggle.parent().is("#code-ide-toolbar")) {
			$("#code-ide-tabs").before($toggle);
		} else if (!$toggle.length) {
			$("#code-ide-tabs").before(
				'<button type="button" class="code-ide-iconbtn" id="code-ide-toggle-sidebar" title="Toggle Sidebar">⧉</button>',
			);
			$("#code-ide-toggle-sidebar").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				explorer_collapsed = !explorer_collapsed;
				$ui.toggleClass("explorer-collapsed", explorer_collapsed);
				layout_editor();
			});
		}
		if (!$("#code-ide-save-as").length) {
			$("#code-ide-run").before(
				'<button type="button" class="code-ide-textbtn" id="code-ide-save-as" title="Save As">Save As</button>',
			);
			$("#code-ide-save-as").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				api_call_l("list_codes", { purpose: "save" }, { disable: $(this) });
			});
		}
		if (!$("#code-ide-docs").length) {
			$(".code-ide-sidebar-head").append(
				'<button type="button" class="code-ide-iconbtn code-ide-docsbtn" id="code-ide-docs" title="Code Slots and Files documentation">?</button>',
			);
			$("#code-ide-docs").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				open_code_slots_docs();
			});
		}
		ensure_settings_dom();
		sync_settings_ui();

		var $host = $ui.find(".monaco-editor-host.maincode").first();
		if ($host.length && !$host.parent().is("#code-ide-editor-slot")) {
			$("#code-ide-editor-slot").append($host);
		}
		$ui.addClass("has-explorer");
		$ui.toggleClass("explorer-collapsed", explorer_collapsed);
		ensure_global_shortcuts();
		apply_chrome_theme();
	}

	function ensure_global_shortcuts() {
		if ($(document).data("al-code-keys")) return;
		$(document).data("al-code-keys", 1);
		$(document).on("keydown.alcodekeys", function (e) {
			if (!global.code) return;
			var mod = e.ctrlKey || e.metaKey;
			if (!mod) return;
			// Let inputs in quick-open / settings / modals handle themselves except Esc paths
			var $t = $(e.target);
			if ($t.is("input, textarea, select") && !$t.closest("#codeui").length) return;

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
				if (typeof api_call_l === "function") api_call_l("list_codes", { purpose: "save" });
				else api_call("list_codes", { purpose: "save" });
				return;
			}
			if (key === "enter" && !e.shiftKey) {
				e.preventDefault();
				toggle_play();
			}
		});
	}

	function ensure_settings_dom() {
		if (!$("#code-ide-settings").length) {
			$("#code-ide-save-as").after(
				'<button type="button" class="code-ide-iconbtn" id="code-ide-settings" title="Editor settings">⚙</button>',
			);
			$("#code-ide-settings").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				toggle_settings_panel();
			});
		}
		if (!$("#code-ide-settings-panel").length) {
			$("#code-ide-main").append(
				'<div id="code-ide-settings-panel" hidden>' +
					'<div class="code-ide-settings-title">Editor settings</div>' +
					'<label class="code-ide-settings-row">Theme<select id="code-ide-theme">' +
					'<option value="vs-dark">Dark</option><option value="vs">Light</option>' +
					'<option value="hc-black">High Contrast</option><option value="pixel">Pixel</option>' +
					"</select></label>" +
					'<label class="code-ide-settings-row">Font<select id="code-ide-font">' +
					'<option value="Consolas, &quot;Cascadia Mono&quot;, &quot;Segoe UI Mono&quot;, Menlo, Monaco, monospace">Consolas / Cascadia</option>' +
					'<option value="&quot;Cascadia Code&quot;, Consolas, monospace">Cascadia Code</option>' +
					'<option value="&quot;Fira Code&quot;, Consolas, monospace">Fira Code</option>' +
					'<option value="&quot;JetBrains Mono&quot;, Consolas, monospace">JetBrains Mono</option>' +
					'<option value="Menlo, Monaco, &quot;Courier New&quot;, monospace">Menlo / Monaco</option>' +
					'<option value="&quot;Courier New&quot;, Courier, monospace">Courier New</option>' +
					'<option value="custom">Custom…</option>' +
					"</select></label>" +
					'<label class="code-ide-settings-row code-ide-font-custom" hidden>Custom font' +
					'<input type="text" id="code-ide-font-custom" placeholder="e.g. Cascadia Mono, monospace" /></label>' +
					'<label class="code-ide-settings-row">Font size' +
					'<input type="range" id="code-ide-fontsize" min="11" max="28" value="16" />' +
					'<span id="code-ide-fontsize-val">16</span></label>' +
					'<div class="code-ide-settings-hint">Ctrl/Cmd + scroll zooms font size</div>' +
					"</div>",
			);
			$("#code-ide-theme").on("change", function () {
				apply_editor_prefs({ theme: $(this).val() });
			});
			$("#code-ide-font").on("change", function () {
				var v = $(this).val();
				$(".code-ide-font-custom").toggle(v === "custom");
				if (v === "custom") {
					$("#code-ide-font-custom").focus();
					return;
				}
				apply_editor_prefs({ fontFamily: v });
			});
			$("#code-ide-font-custom").on("change blur", function () {
				var v = ($(this).val() || "").trim();
				if (v) apply_editor_prefs({ fontFamily: v });
			});
			$("#code-ide-fontsize").on("input change", function () {
				var n = parseInt($(this).val(), 10);
				$("#code-ide-fontsize-val").text(String(n));
				apply_editor_prefs({ fontSize: n });
			});
		}
		if (!$("#code-ide-editor-slot").data("al-focus-bound")) {
			$("#code-ide-editor-slot").data("al-focus-bound", 1).on("mousedown", function () {
				if (editor && editor.focus) editor.focus();
				toggle_settings_panel(true);
				close_save_as();
			});
		}
		if (!$(document).data("al-code-settings-doc")) {
			$(document).data("al-code-settings-doc", 1).on("mousedown.codeidesettings", function (e) {
				var $t = $(e.target);
				if ($t.closest("#code-ide-settings-panel, #code-ide-settings, #code-ide-save-as-panel, #code-ide-save-as").length) return;
				toggle_settings_panel(true);
				close_save_as();
			});
		}
	}

	function open_code_slots_docs() {
		if (typeof global.open_guide === "function") {
			open_guide("8-code-slots-and-files", "/docs/guide/code/8-code-slots-and-files");
		} else if (typeof global.open === "function") {
			global.open("/docs/guide/code/8-code-slots-and-files", "_blank");
		}
	}

	function toggle_settings_panel(forceClose) {
		var $p = $("#code-ide-settings-panel");
		if (!$p.length) return;
		if (forceClose) {
			$p.prop("hidden", true);
			return;
		}
		var open = $p.prop("hidden");
		$p.prop("hidden", !open);
		if (open) sync_settings_ui();
	}

	function sync_settings_ui() {
		var prefs = editor && editor.getPrefs ? editor.getPrefs() : { theme: "vs-dark", fontFamily: "", fontSize: 16 };
		$("#code-ide-theme").val(prefs.theme || "vs-dark");
		var $font = $("#code-ide-font");
		var match = false;
		$font.find("option").each(function () {
			if (this.value !== "custom" && this.value === prefs.fontFamily) {
				match = true;
				return false;
			}
		});
		if (match) {
			$font.val(prefs.fontFamily);
			$(".code-ide-font-custom").hide();
		} else {
			$font.val("custom");
			$(".code-ide-font-custom").show();
			$("#code-ide-font-custom").val(prefs.fontFamily || "");
		}
		$("#code-ide-fontsize").val(prefs.fontSize || 16);
		$("#code-ide-fontsize-val").text(String(prefs.fontSize || 16));
	}

	function apply_chrome_theme(theme) {
		var t = theme;
		if (!t) {
			try {
				if (editor && editor.getPrefs) t = editor.getPrefs().theme;
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
		if (editor && editor.applyPrefs) next = editor.applyPrefs(partial);
		else if (global.codemirror_render && codemirror_render.applyPrefs) next = codemirror_render.applyPrefs(partial);
		apply_chrome_theme((next && next.theme) || (partial && partial.theme));
	}

	function layout_editor() {
		if (editor && editor.layout) editor.layout();
	}

	function set_layout_mode(mode) {
		layout_mode = mode || "dock-half";
		try {
			localStorage.setItem(LAYOUT_KEY, layout_mode);
		} catch (e) {}
		$("#code-ide-alpha").toggle(layout_mode.indexOf("overlay") === 0);
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

		if (layout_mode === "dock-half") {
			$ui.addClass("layout-dock-half").css("opacity", 1);
			document.body.classList.add("code-docked");
			global.code_dock_inset = Math.floor($(window).width() / 2);
		} else {
			$ui.addClass("layout-" + layout_mode).css("opacity", overlay_alpha);
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

	function ensure_tab(slot) {
		var s = slot_key(slot);
		if (open_tabs.indexOf(s) === -1) open_tabs.push(s);
	}

	function ensure_model(slot, value, forceValue) {
		var s = slot_key(slot);
		if (!global.monaco) return null;
		registerAdventureLandTypesSafe();
		if (models[s]) {
			if (forceValue && value != null) {
				applying_model = true;
				models[s].setValue(String(value));
				applying_model = false;
			}
			return models[s];
		}
		var uri = monaco.Uri.parse("file:///adventureland/slots/" + encodeURIComponent(s) + ".js");
		var existing = monaco.editor.getModel(uri);
		if (existing) {
			models[s] = existing;
		} else {
			models[s] = monaco.editor.createModel(value != null ? String(value) : "", "javascript", uri);
		}
		if (forceValue && value != null && models[s].getValue() !== String(value)) {
			applying_model = true;
			models[s].setValue(String(value));
			applying_model = false;
		}
		model_listeners[s] = models[s].onDidChangeContent(function () {
			if (applying_model) return;
			dirty_slots[s] = true;
			if (slot_key(get_slot()) === s) global.code_change = true;
			refresh_tabs();
			refresh_explorer();
		});
		return models[s];
	}

	function set_active_model(slot, model) {
		var mapi = monaco_api();
		if (!mapi || !model) return;
		applying_model = true;
		mapi.setModel(model);
		applying_model = false;
		set_slot(slot);
		global.code_change = is_dirty(slot);
		ensure_tab(slot);
		refresh_chrome();
		layout_editor();
	}

	function slot_label(num, entry) {
		var name = (entry && entry[0]) || "Empty";
		if (is_character_slot(num)) {
			if (global.character && global.real_id && slot_key(num) === slot_key(global.real_id)) {
				name = character.name || name;
			}
			return name + ".js";
		}
		return name + "." + num + ".js";
	}

	function slot_title(num, entry) {
		var label = slot_label(num, entry);
		if (is_character_slot(num)) return label + " (" + slot_key(num) + ")";
		return label;
	}

	function is_character_slot(num) {
		var n = "" + num;
		return parseInt(num, 10) > 100 || n.indexOf("CH_") === 0 || (global.real_id && n === "" + global.real_id);
	}

	function refresh_chrome() {
		refresh_explorer();
		refresh_tabs();
	}

	function refresh_tabs() {
		var $tabs = $("#code-ide-tabs");
		if (!$tabs.length) return;
		var active = slot_key(get_slot());
		var list = (global.X && X.codes) || {};
		var html = "";
		for (var i = 0; i < open_tabs.length; i++) {
			var s = open_tabs[i];
			var label = slot_label(s, list[s] || [(global.character && character.name) || "code", 0]);
			var title = slot_title(s, list[s] || [(global.character && character.name) || "code", 0]);
			html +=
				'<div class="code-ide-tab' +
				(s === active ? " active" : "") +
				(is_dirty(s) ? " dirty" : "") +
				'" data-slot="' +
				s +
				'" title="' +
				title.replace(/"/g, "&quot;") +
				'">' +
				'<span class="code-ide-tab-name">' +
				label +
				"</span>" +
				'<span class="code-ide-tab-dirty"></span>' +
				'<button type="button" class="code-ide-tab-close" data-close="' +
				s +
				'" title="Close">×</button>' +
				"</div>";
		}
		$tabs.html(html);
		$tabs.find(".code-ide-tab").on("click", function (e) {
			if ($(e.target).hasClass("code-ide-tab-close")) return;
			activate_open_slot($(this).attr("data-slot"));
		});
		$tabs.find(".code-ide-tab-close").on("click", function (e) {
			e.stopPropagation();
			close_tab($(this).attr("data-close"));
		});
	}

	function refresh_explorer() {
		var $ex = $("#code-slot-explorer");
		if (!$ex.length) return;
		var list = (global.X && X.codes) || {};
		var active = slot_key(get_slot());
		var chars = [];
		var codes = [];
		for (var num in list) {
			if (!Object.prototype.hasOwnProperty.call(list, num)) continue;
			if (is_character_slot(num)) chars.push(num);
			else codes.push(num);
		}
		chars.sort();
		codes.sort(function (a, b) {
			return parseInt(a, 10) - parseInt(b, 10);
		});

		var html = "";
		html += folder_html("characters", "characters", tree_folders.characters !== false);
		if (global.character) {
			var cid = global.real_id;
			html += item_html(cid, list[cid] || [character.name, 0], active === slot_key(cid));
		}
		for (var i = 0; i < chars.length; i++) {
			var cnum = chars[i];
			if (global.real_id && slot_key(cnum) === slot_key(global.real_id)) continue;
			html += item_html(cnum, list[cnum], active === slot_key(cnum));
		}
		html += "</div></div>"; // close characters children + folder

		html += folder_html("slots", "slots", tree_folders.slots !== false);
		if (!codes.length) {
			for (var k = 1; k <= 5; k++) html += item_html(k, ["Empty", 0], active === "" + k);
		} else {
			for (var j = 0; j < codes.length; j++) {
				html += item_html(codes[j], list[codes[j]], active === slot_key(codes[j]));
			}
		}
		html += "</div></div>"; // close slots children + folder

		$ex.html(html);
		$ex.find(".code-tree-row.folder").on("click", function (e) {
			e.preventDefault();
			var $folder = $(this).closest(".code-tree-folder");
			var id = $folder.attr("data-folder");
			var open = $folder.hasClass("collapsed");
			$folder.toggleClass("collapsed", !open);
			tree_folders[id] = open;
			try {
				localStorage.setItem(TREE_KEY, JSON.stringify(tree_folders));
			} catch (err) {}
		});
		$ex.find(".code-tree-row.file").on("click", function (e) {
			if ($(e.target).closest(".code-tree-delete").length) return;
			open_slot($(this).attr("data-slot"));
		});
		$ex.find(".code-tree-delete").on("click", function (e) {
			e.preventDefault();
			e.stopPropagation();
			delete_slot($(this).attr("data-slot"));
		});
	}

	function folder_html(id, label, open) {
		return (
			'<div class="code-tree-folder' +
			(open ? "" : " collapsed") +
			'" data-folder="' +
			id +
			'">' +
			'<div class="code-tree-row folder">' +
			'<span class="code-tree-twistie"></span>' +
			'<span class="code-tree-icon folder"></span>' +
			'<span class="code-tree-label">' +
			label +
			"</span>" +
			"</div>" +
			'<div class="code-tree-children">'
		);
	}

	function item_html(slot, entry, active) {
		var title = slot_title(slot, entry).replace(/"/g, "&quot;");
		var can_delete = !is_character_slot(slot);
		return (
			'<div class="code-tree-row file' +
			(active ? " active" : "") +
			(is_dirty(slot) ? " dirty" : "") +
			(open_tabs.indexOf(slot_key(slot)) !== -1 ? " open" : "") +
			'" data-slot="' +
			slot +
			'" title="' +
			title +
			'">' +
			'<span class="code-tree-twistie spacer"></span>' +
			'<span class="code-tree-icon file"></span>' +
			'<span class="code-tree-label">' +
			slot_label(slot, entry) +
			"</span>" +
			(can_delete
				? '<button type="button" class="code-tree-delete" data-slot="' +
					slot +
					'" title="Delete slot">×</button>'
				: "") +
			"</div>"
		);
	}

	function activate_open_slot(slot) {
		var s = slot_key(slot);
		if (models[s]) {
			set_active_model(s, models[s]);
			return;
		}
		open_slot(s);
	}

	function open_slot(num) {
		var s = slot_key(num);
		if (models[s]) {
			ensure_tab(s);
			set_active_model(s, models[s]);
			return;
		}
		if (typeof global.load_code === "function") global.load_code(num, 1);
		else api_call("load_code", { name: num, run: "", log: 1 });
	}

	function close_tab(slot) {
		var s = slot_key(slot);
		var idx = open_tabs.indexOf(s);
		if (idx === -1) return;
		open_tabs.splice(idx, 1);
		if (slot_key(get_slot()) === s) {
			var next = open_tabs[idx] || open_tabs[idx - 1] || open_tabs[0];
			if (next) activate_open_slot(next);
		}
		refresh_chrome();
	}

	function update_badges() {
		var slot = get_slot();
		if (parseInt(slot, 10) <= 100) $(".codeslottype").html("" + slot);
		else $(".codeslottype").html("Character");
		$(".codeslotname").html("" + ((X.codes[slot] && X.codes[slot][0]) || "Default Code"));
		refresh_chrome();
	}

	function handle_code(info) {
		info.code = "" + info.code;
		if (info.slot && "" + info.slot !== "0" && info.v) X.codes[info.slot] = [info.name, info.v];
		if (info.save) {
			if (global.is_electron && typeof electron_is_main === "function" && electron_is_main()) {
				file_op_queue[info.slot] = ["save", info.slot, info.code, info.v];
			}
			clear_dirty(info.slot);
			return;
		}
		var new_code_slot = (!info.slot && global.real_id) || info.slot;
		ensure_tab(new_code_slot);
		var model = ensure_model(new_code_slot, info.code, true);
		clear_dirty(new_code_slot);
		if (info.reset && model) {
			/* history clear: recreate model content already set */
		}
		set_active_model(new_code_slot, model);
		if (info.run) {
			if (global.code_run) (toggle_runner(), toggle_runner());
			else toggle_runner();
		} else if (info.code.indexOf("autorerun") != -1) {
			if (global.code_run) (toggle_runner(), toggle_runner());
		}
		update_badges();
	}

	function handle_code_list(info) {
		X.codes = info.list;
		refresh_chrome();
		if (info.purpose == "save") show_save_as(info);
		else {
			ensure_chrome_dom();
			refresh_chrome();
			if (info.purpose == "load" && typeof hide_modal === "function") {
				try {
					hide_modal(true);
				} catch (e) {}
			}
		}
		list_fetched = true;
	}

	function show_save_as(info) {
		ensure_chrome_dom();
		toggle_settings_panel(true);
		close_save_as();
		var $main = $("#code-ide-main");
		if (!$main.length) return;

		var ui_list = typeof clone === "function" ? clone(info.list) : Object.assign({}, info.list || {});
		if (global.character && character.ctype != "merchant")
			for (var n in ui_list) {
				if (parseInt(n, 10) > 100 || ("" + n).indexOf("CH_") === 0) delete ui_list[n];
			}
		if (global.character && !ui_list[global.real_id]) ui_list[global.real_id] = [character.name, 0];

		var next_empty = null;
		for (var i = 1; i <= 100; i++) {
			if (!ui_list[i] || ui_list[i][0] === "Empty") {
				if (!ui_list[i]) ui_list[i] = ["Empty", 0];
				if (next_empty == null) next_empty = "" + i;
			}
		}
		if (next_empty == null) next_empty = "1";

		var entries = [{ slot: "__new__", label: "Create new slot…", detail: "slot " + next_empty, fresh: true }];
		var keys = Object.keys(ui_list);
		keys.sort(function (a, b) {
			var ac = is_character_slot(a) ? 0 : 1;
			var bc = is_character_slot(b) ? 0 : 1;
			if (ac !== bc) return ac - bc;
			var an = parseInt(a, 10),
				bn = parseInt(b, 10);
			if (!isNaN(an) && !isNaN(bn)) return an - bn;
			return String(a).localeCompare(String(b));
		});
		for (var k = 0; k < keys.length; k++) {
			var sn = keys[k];
			entries.push({
				slot: slot_key(sn),
				label: slot_label(sn, ui_list[sn]),
				detail: is_character_slot(sn) ? "character code" : "slot " + sn,
				name: (ui_list[sn] && ui_list[sn][0]) || "Empty",
				empty: !ui_list[sn] || ui_list[sn][0] === "Empty",
			});
		}

		$main.append(
			'<div id="code-ide-save-as-panel" class="code-ide-quickpick">' +
				'<input type="text" id="code-ide-save-filter" placeholder="Save current code to…" autocomplete="off" spellcheck="false" />' +
				'<div id="code-ide-save-results" class="code-ide-quickpick-results"></div>' +
				"</div>",
		);

		var selected = 0;
		var filtered = entries.slice();

		function render() {
			var html = "";
			for (var j = 0; j < filtered.length; j++) {
				var e = filtered[j];
				html +=
					'<div class="code-ide-quickpick-item' +
					(j === selected ? " active" : "") +
					(e.fresh ? " fresh" : "") +
					'" data-idx="' +
					j +
					'">' +
					'<span class="code-ide-quickpick-label">' +
					e.label +
					"</span>" +
					'<span class="code-ide-quickpick-detail">' +
					(e.detail || "") +
					"</span>" +
					"</div>";
			}
			if (!filtered.length) html = '<div class="code-ide-quick-empty">No matching slots</div>';
			$("#code-ide-save-results").html(html);
			$("#code-ide-save-results .code-ide-quickpick-item").on("mousedown", function (ev) {
				ev.preventDefault();
				choose(filtered[parseInt($(this).attr("data-idx"), 10)]);
			});
		}

		function filter(q) {
			q = (q || "").toLowerCase().trim();
			filtered = [];
			for (var j = 0; j < entries.length; j++) {
				var e = entries[j];
				if (!q || e.label.toLowerCase().indexOf(q) !== -1 || String(e.slot).toLowerCase().indexOf(q) !== -1 || (e.detail && e.detail.toLowerCase().indexOf(q) !== -1)) {
					filtered.push(e);
				}
			}
			selected = 0;
			render();
		}

		function choose(entry) {
			if (!entry) return;
			if (entry.fresh) {
				var name = window.prompt("Name for the new code slot:", "My Code");
				if (name == null) return;
				name = String(name).trim() || "My Code";
				if (name.toUpperCase() === "DELETE") {
					if (typeof global.add_log === "function") add_log("Pick a real name — use the explorer trash to delete a slot.", "#E06666");
					return;
				}
				perform_save_as(next_empty, name);
				return;
			}
			if (!entry.empty) {
				var ok = window.confirm("Overwrite " + entry.label + "?");
				if (!ok) return;
			}
			perform_save_as(entry.slot, entry.name || "Empty");
		}

		filter("");
		var $input = $("#code-ide-save-filter");
		$input.trigger("focus");
		$input.on("input", function () {
			filter($(this).val());
		});
		$input.on("keydown", function (e) {
			if (e.keyCode === 27) {
				e.preventDefault();
				e.stopPropagation();
				close_save_as();
				if (editor && editor.focus) editor.focus();
				return;
			}
			if (e.keyCode === 40) {
				e.preventDefault();
				if (filtered.length) selected = Math.min(filtered.length - 1, selected + 1);
				render();
				return;
			}
			if (e.keyCode === 38) {
				e.preventDefault();
				selected = Math.max(0, selected - 1);
				render();
				return;
			}
			if (e.keyCode === 13) {
				e.preventDefault();
				choose(filtered[selected]);
			}
		});
	}

	function perform_save_as(slot, name) {
		var ed = editor || global.codemirror_render;
		if (!ed || slot == null || slot === "") return;
		api_call("save_code", {
			code: ed.getValue(),
			slot: slot,
			name: name,
			log: 1,
		});
		close_save_as();
		ensure_tab(slot);
		set_slot(slot);
		refresh_chrome();
	}

	function close_save_as() {
		$("#code-ide-save-as-panel").remove();
	}

	function save_as() {
		// Kept for SlotSession.save_as callers; opens picker via list_codes.
		if (typeof api_call_l === "function") api_call_l("list_codes", { purpose: "save" });
		else api_call("list_codes", { purpose: "save" });
	}

	function delete_slot(slot) {
		var s = slot_key(slot);
		if (!s || is_character_slot(s)) {
			if (typeof global.add_log === "function") add_log("Character base code can't be deleted from here.", "gray");
			return;
		}
		var list = (global.X && X.codes) || {};
		var label = slot_label(s, list[s] || ["Empty", 0]);
		if (!window.confirm("Delete " + label + "?\nThis clears the slot on the server.")) return;
		api_call("save_code", {
			code: "//",
			slot: s,
			name: "DELETE",
			log: 1,
		});
		var idx = open_tabs.indexOf(s);
		if (idx !== -1) open_tabs.splice(idx, 1);
		if (models[s]) {
			try {
				if (model_listeners[s]) model_listeners[s].dispose();
			} catch (e) {}
			try {
				models[s].dispose();
			} catch (e2) {}
			delete models[s];
			delete model_listeners[s];
			delete dirty_slots[s];
		}
		if (slot_key(get_slot()) === s) {
			var next = open_tabs[0] || (global.real_id != null ? slot_key(global.real_id) : "1");
			if (models[next]) set_active_model(next, models[next]);
			else open_slot(next);
		}
		refresh_chrome();
	}

	function save_current() {
		var slot = get_slot();
		var ed = editor || global.codemirror_render;
		if (!ed || slot == null || slot === "") return;
		var name = (global.X && X.codes && X.codes[slot] && X.codes[slot][0]) || "";
		api_call("save_code", {
			code: ed.getValue(),
			slot: slot,
			name: name,
			log: 1,
		});
	}

	function quick_open() {
		ensure_chrome_dom();
		var $main = $("#code-ide-main");
		if (!$main.length) return;
		$("#code-ide-quick-open").remove();

		var list = (global.X && X.codes) || {};
		var entries = [];
		if (global.character && global.real_id) {
			entries.push({
				slot: slot_key(global.real_id),
				label: slot_label(global.real_id, list[global.real_id] || [character.name, 0]),
			});
		}
		var nums = Object.keys(list);
		for (var i = 0; i < nums.length; i++) {
			var n = nums[i];
			if (global.real_id && slot_key(n) === slot_key(global.real_id)) continue;
			entries.push({ slot: slot_key(n), label: slot_label(n, list[n]) });
		}
		if (!entries.length) {
			for (var k = 1; k <= 5; k++) entries.push({ slot: "" + k, label: slot_label(k, ["Empty", 0]) });
		}

		$main.append(
			'<div id="code-ide-quick-open">' +
				'<input type="text" id="code-ide-quick-input" placeholder="Go to code slot…" autocomplete="off" spellcheck="false" />' +
				'<div id="code-ide-quick-results"></div>' +
				"</div>",
		);

		var selected = 0;
		var filtered = entries.slice();

		function render() {
			var html = "";
			for (var j = 0; j < filtered.length; j++) {
				html +=
					'<div class="code-ide-quick-item' +
					(j === selected ? " active" : "") +
					'" data-slot="' +
					filtered[j].slot +
					'">' +
					filtered[j].label +
					"</div>";
			}
			if (!filtered.length) html = '<div class="code-ide-quick-empty">No matches</div>';
			$("#code-ide-quick-results").html(html);
			$("#code-ide-quick-results .code-ide-quick-item").on("mousedown", function (e) {
				e.preventDefault();
				choose($(this).attr("data-slot"));
			});
		}

		function filter(q) {
			q = (q || "").toLowerCase().trim();
			filtered = [];
			for (var j = 0; j < entries.length; j++) {
				if (!q || entries[j].label.toLowerCase().indexOf(q) !== -1 || entries[j].slot.toLowerCase().indexOf(q) !== -1) {
					filtered.push(entries[j]);
				}
			}
			selected = 0;
			render();
		}

		function choose(slot) {
			close_quick_open();
			if (slot != null) open_slot(slot);
			setTimeout(function () {
				if (editor && editor.focus) editor.focus();
			}, 1);
		}

		function close_quick_open() {
			$("#code-ide-quick-open").remove();
		}

		filter("");
		var $input = $("#code-ide-quick-input");
		$input.trigger("focus");
		$input.on("input", function () {
			filter($(this).val());
		});
		$input.on("keydown", function (e) {
			if (e.keyCode === 27) {
				e.preventDefault();
				e.stopPropagation();
				close_quick_open();
				if (editor && editor.focus) editor.focus();
				return;
			}
			if (e.keyCode === 40) {
				e.preventDefault();
				if (filtered.length) selected = Math.min(filtered.length - 1, selected + 1);
				render();
				return;
			}
			if (e.keyCode === 38) {
				e.preventDefault();
				selected = Math.max(0, selected - 1);
				render();
				return;
			}
			if (e.keyCode === 13) {
				e.preventDefault();
				if (filtered[selected]) choose(filtered[selected].slot);
			}
		});
	}

	function on_panel_open() {
		ensure_chrome_dom();
		apply_layout();
		if (!list_fetched) api_call("list_codes", { purpose: "sync" });
		else refresh_chrome();
		layout_editor();
		setTimeout(function () {
			if (editor && editor.focus) editor.focus();
		}, 1);
	}

	function on_panel_close() {
		clear_layout();
	}

	function get_value() {
		var ed = editor || global.codemirror_render;
		return ed ? ed.getValue() : "";
	}

	function set_value(v) {
		var ed = editor || global.codemirror_render;
		if (ed) ed.setValue(v);
	}

	global.SlotSession = {
		bind_editor: bind_editor,
		mark_dirty: mark_dirty,
		clear_dirty: clear_dirty,
		handle_code: handle_code,
		handle_code_list: handle_code_list,
		open_slot: open_slot,
		save_as: save_as,
		save_current: save_current,
		delete_slot: delete_slot,
		quick_open: quick_open,
		toggle_play: toggle_play,
		on_panel_open: on_panel_open,
		on_panel_close: on_panel_close,
		refresh_explorer: refresh_chrome,
		refresh_chrome: refresh_chrome,
		set_running: set_running,
		apply_layout: apply_layout,
		set_layout_mode: set_layout_mode,
		get_value: get_value,
		set_value: set_value,
		update_badges: update_badges,
	};
})(typeof window !== "undefined" ? window : this);
