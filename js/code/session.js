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
	var layout_mode = "dock-half"; // dock-half | overlay-third | overlay-half | overlay-full
	var overlay_alpha = 0.92;

	try {
		layout_mode = localStorage.getItem(LAYOUT_KEY) || layout_mode;
		var a = parseFloat(localStorage.getItem(ALPHA_KEY));
		if (!isNaN(a) && a >= 0.3 && a <= 1) overlay_alpha = a;
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
		set_running(!!global.code_run);
	}

	function registerAdventureLandTypesSafe() {
		if (global.ALEditor && typeof global.create_editor === "function") {
			/* types registered inside create_editor when intellisense:true */
		}
		if (global.monaco && monaco.languages && monaco.languages.typescript && global.__AL_MONACO_TYPES__) {
			try {
				var ts = monaco.languages.typescript;
				var libs = global.__AL_MONACO_TYPES__;
				var names = Object.keys(libs);
				for (var i = 0; i < names.length; i++) {
					ts.javascriptDefaults.addExtraLib(libs[names[i]], "ts:adventureland/" + names[i]);
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
					'<button type="button" class="code-ide-iconbtn" id="code-ide-toggle-sidebar" title="Toggle Sidebar">⧉</button>' +
					"</div>" +
					'<div id="code-slot-explorer"></div>' +
					"</aside>" +
					'<section id="code-ide-main">' +
					'<div id="code-ide-toolbar">' +
					'<div id="code-ide-tabs"></div>' +
					'<div class="code-ide-toolbar-right">' +
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
		}

		$("#code-ide-layout").val(layout_mode);
		$("#code-ide-alpha").val(Math.round(overlay_alpha * 100));
		$("#code-ide-alpha").toggle(layout_mode.indexOf("overlay") === 0);

		var $host = $ui.find(".monaco-editor-host.maincode").first();
		if ($host.length && !$host.parent().is("#code-ide-editor-slot")) {
			$("#code-ide-editor-slot").append($host);
		}
		$ui.addClass("has-explorer");
		$ui.toggleClass("explorer-collapsed", explorer_collapsed);
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
		return name + "." + num + ".js";
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
			html +=
				'<div class="code-ide-tab' +
				(s === active ? " active" : "") +
				(is_dirty(s) ? " dirty" : "") +
				'" data-slot="' +
				s +
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
		html += '<div class="code-explorer-section">characters</div>';
		if (global.character) {
			var cid = global.real_id;
			html += item_html(cid, list[cid] || [character.name, 0], active === slot_key(cid));
		}
		for (var i = 0; i < chars.length; i++) {
			var cnum = chars[i];
			if (global.real_id && slot_key(cnum) === slot_key(global.real_id)) continue;
			html += item_html(cnum, list[cnum], active === slot_key(cnum));
		}
		html += '<div class="code-explorer-section">codes</div>';
		for (var j = 0; j < codes.length; j++) {
			html += item_html(codes[j], list[codes[j]], active === slot_key(codes[j]));
		}
		if (!codes.length) {
			for (var k = 1; k <= 5; k++) html += item_html(k, ["Empty", 0], active === "" + k);
		}
		$ex.html(html);
		$ex.find(".code-explorer-item").on("click", function () {
			open_slot($(this).attr("data-slot"));
		});
	}

	function item_html(slot, entry, active) {
		return (
			'<div class="code-explorer-item' +
			(active ? " active" : "") +
			(is_dirty(slot) ? " dirty" : "") +
			(open_tabs.indexOf(slot_key(slot)) !== -1 ? " open" : "") +
			'" data-slot="' +
			slot +
			'">' +
			slot_label(slot, entry) +
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
		var html = "<div style='width: 520px'>";
		var c_slot = get_slot(),
			c_name = "";
		if (c_slot) for (var num in info.list) if ("" + num === "" + c_slot) c_name = info.list[num][0];
		html += "<div style='box-sizing: border-box; width: 100%; text-align: center; margin-bottom: 8px;'>";
		html += "<input type='text' style='box-sizing: border-box; width: 15%;; float: left' placeholder='#' autocomplete='nope' id='alcodenumx' name='alcodenumx' class='csharp cinput'/>";
		html += "<input type='text' style='box-sizing: border-box; width: 63%;' placeholder='NAME' autocomplete='nope' id='alcodeinputx' name='alcodeinputx' class='codename cinput' />";
		html += "<div class='gamebutton' style='box-sizing: border-box; width: 20%; padding: 8px; float: right' onclick='SlotSession.save_as()'>SAVE</div>";
		html += "</div>";
		var ui_list = typeof clone === "function" ? clone(info.list) : info.list;
		if (!Object.keys(ui_list).length) ui_list = { 1: ["Empty", 0], 2: ["Empty", 0] };
		for (var i = 1; i <= 100; i++)
			if (!ui_list[i]) {
				ui_list[i] = ["Empty", 0];
				c_slot = "" + i;
				c_name = "Empty";
				break;
			}
		if (global.character && character.ctype != "merchant")
			for (var n in ui_list) {
				if (parseInt(n, 10) > 100 || ("" + n).indexOf("CH_") === 0) delete ui_list[n];
			}
		if (global.character && !ui_list[global.real_id]) ui_list[global.real_id] = [character.name, 0];
		ui_list["#"] = ["DELETE", 0];
		html +=
			'<div class="gamebutton block" style="display: block; margin-bottom: -4px" onclick="open_guide(\'8-code-slots-and-files\',\'/docs/guide/code/8-code-slots-and-files\')"><span style="color: #6FD23F">[Documentation]</span> Code Slots and Files</div>';
		for (var sn in ui_list) {
			var color = colors.code_pink;
			if (parseInt(sn, 10) > 100 || ("" + sn).indexOf("CH_") === 0) color = "#975CAD";
			else if (sn == "#") color = "gray";
			html +=
				"<div class='gamebutton block' style='margin-bottom: -4px' onclick='load_code_s(\"" +
				sn +
				"\")'><span style='color: " +
				color +
				"'>[" +
				((sn == global.real_id && "YOUR BASE CODE") || sn) +
				"]</span> " +
				ui_list[sn][0] +
				"</div>";
		}
		html += "</div>";
		show_modal(html, { keep_code: true, wrap: false });
		if (c_slot) $("#alcodenumx").val(c_slot);
		if (c_name) $("#alcodeinputx").val(c_name);
	}

	function save_as() {
		if (!$(".csharp").val()) return;
		var ed = editor || global.codemirror_render;
		api_call("save_code", {
			code: ed.getValue(),
			slot: $(".csharp").val(),
			name: $(".codename").val(),
			log: 1,
		});
	}

	function on_panel_open() {
		ensure_chrome_dom();
		apply_layout();
		if (!list_fetched) api_call("list_codes", { purpose: "sync" });
		else refresh_chrome();
		layout_editor();
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
