/**
 * SlotSession — single active CODE buffer + IDE chrome (explorer + tab + status).
 * Owns code / code_list handling; explorer replaces the Load modal.
 */
(function (global) {
	"use strict";

	var editor = null;
	var list_fetched = false;
	var explorer_collapsed = false;

	function get_slot() {
		return global.code_slot;
	}

	function set_slot(slot) {
		global.code_slot = slot;
	}

	function mark_dirty() {
		global.code_change = true;
		refresh_chrome();
	}

	function clear_dirty() {
		global.code_change = false;
		refresh_chrome();
	}

	function bind_editor(ed) {
		editor = ed;
		ensure_chrome_dom();
		refresh_chrome();
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
					'<div id="code-ide-tabbar">' +
					'<div id="code-ide-tab" class="code-ide-tab active"><span class="code-ide-tab-name">code.js</span><span class="code-ide-tab-dirty"></span></div>' +
					'<div id="code-ide-status" class="code-ide-status idle">Idle</div>' +
					"</div>" +
					'<div id="code-ide-editor-slot"></div>' +
					"</section>" +
					"</div>",
			);
			$("#code-ide-toggle-sidebar").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				explorer_collapsed = !explorer_collapsed;
				$ui.toggleClass("explorer-collapsed", explorer_collapsed);
				if (editor && editor.layout) editor.layout();
			});
		}

		var $host = $ui.find(".monaco-editor-host.maincode").first();
		if ($host.length && !$host.parent().is("#code-ide-editor-slot")) {
			$("#code-ide-editor-slot").append($host);
		}
		$ui.addClass("has-explorer");
		$ui.toggleClass("explorer-collapsed", explorer_collapsed);
		set_running(!!global.code_run);
	}

	function slot_label(num, entry) {
		var name = (entry && entry[0]) || "Empty";
		return name + "." + num + ".js";
	}

	function is_character_slot(num) {
		var n = "" + num;
		return parseInt(num, 10) > 100 || n.indexOf("CH_") === 0 || (global.real_id && n === "" + global.real_id);
	}

	function active_tab_label() {
		var slot = get_slot();
		var list = (global.X && X.codes) || {};
		if (slot == null || slot === "") return "code.js";
		return slot_label(slot, list[slot] || [(global.character && character.name) || "code", 0]);
	}

	function refresh_chrome() {
		refresh_explorer();
		refresh_tab();
	}

	function refresh_tab() {
		var $tab = $("#code-ide-tab");
		if (!$tab.length) return;
		$tab.find(".code-ide-tab-name").text(active_tab_label());
		$tab.toggleClass("dirty", !!global.code_change);
	}

	function refresh_explorer() {
		var $ex = $("#code-slot-explorer");
		if (!$ex.length) return;
		var list = (global.X && X.codes) || {};
		var active = get_slot();
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
			var centry = list[cid] || [character.name, 0];
			var cactive = "" + active === "" + cid;
			html += item_html(cid, centry, cactive);
		}
		for (var i = 0; i < chars.length; i++) {
			var cnum = chars[i];
			if (global.real_id && "" + cnum === "" + global.real_id) continue;
			html += item_html(cnum, list[cnum], "" + active === "" + cnum);
		}
		html += '<div class="code-explorer-section">codes</div>';
		for (var j = 0; j < codes.length; j++) {
			var snum = codes[j];
			html += item_html(snum, list[snum], "" + active === "" + snum);
		}
		if (!codes.length) {
			for (var k = 1; k <= 5; k++) {
				html += item_html(k, ["Empty", 0], "" + active === "" + k);
			}
		}
		$ex.html(html);
		$ex.find(".code-explorer-item").on("click", function () {
			open_slot($(this).attr("data-slot"));
		});
		refresh_tab();
	}

	function item_html(slot, entry, active) {
		return (
			'<div class="code-explorer-item' +
			(active ? " active" : "") +
			(active && global.code_change ? " dirty" : "") +
			'" data-slot="' +
			slot +
			'">' +
			slot_label(slot, entry) +
			"</div>"
		);
	}

	function open_slot(num) {
		if (global.code_change && "" + num !== "" + get_slot()) {
			if (!confirm("You have unsaved changes. Open anyway? (Engage autosave may still save the previous slot.)")) return;
		}
		if (typeof global.load_code === "function") global.load_code(num, 1);
		else api_call("load_code", { name: num, run: "", log: 1 });
	}

	function update_badges() {
		var slot = get_slot();
		if (parseInt(slot, 10) <= 100) $(".codeslottype").html("" + slot);
		else $(".codeslottype").html("Character");
		$(".codeslotname").html("" + ((X.codes[slot] && X.codes[slot][0]) || "Default Code"));
		refresh_chrome();
	}

	function set_running(running) {
		var $st = $("#code-ide-status");
		if (!$st.length) return;
		if (running) {
			$st.removeClass("idle").addClass("running").text("Running");
		} else {
			$st.removeClass("running").addClass("idle").text("Idle");
		}
	}

	function handle_code(info) {
		info.code = "" + info.code;
		if (info.slot && "" + info.slot !== "0" && info.v) X.codes[info.slot] = [info.name, info.v];
		if (info.save) {
			if (global.is_electron && typeof electron_is_main === "function" && electron_is_main()) {
				file_op_queue[info.slot] = ["save", info.slot, info.code, info.v];
			}
			return;
		}
		var ed = editor || global.codemirror_render;
		if (ed) {
			ed.setValue(info.code);
			clear_dirty();
			var new_code_slot = (!info.slot && global.real_id) || info.slot;
			if (info.reset || new_code_slot != get_slot()) {
				if (ed.clearHistory) ed.clearHistory();
			}
			set_slot(new_code_slot);
			if (info.run) {
				if (global.code_run) (toggle_runner(), toggle_runner());
				else toggle_runner();
			} else if (info.code.indexOf("autorerun") != -1) {
				if (global.code_run) (toggle_runner(), toggle_runner());
			}
			update_badges();
		}
	}

	function handle_code_list(info) {
		X.codes = info.list;
		refresh_chrome();
		if (info.purpose == "save") {
			show_save_as(info);
		} else if (info.purpose == "load") {
			ensure_chrome_dom();
			refresh_chrome();
			if (typeof hide_modal === "function") {
				try {
					hide_modal(true);
				} catch (e) {}
			}
		} else {
			ensure_chrome_dom();
			refresh_chrome();
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
		if (!list_fetched) api_call("list_codes", { purpose: "sync" });
		else refresh_chrome();
		if (editor && editor.layout) editor.layout();
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
		refresh_explorer: refresh_chrome,
		refresh_chrome: refresh_chrome,
		set_running: set_running,
		get_value: get_value,
		set_value: set_value,
		update_badges: update_badges,
	};
})(typeof window !== "undefined" ? window : this);
