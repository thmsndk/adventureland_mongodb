/**
 * SlotSession workspace: models, dirty, tabs, explorer, open_type_definition.
 */
(function (global) {
	"use strict";

	var S = global.ALCodeSessionState;
	if (!S) throw new Error("ALCodeSessionState missing — load session/state.js first");
	var ALEditor = global.ALEditor || (global.ALEditor = {});

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
	var apply_layout = ss("apply_layout");
	var layout_editor = ss("layout_editor");
	var update_statusbar = ss("update_statusbar");
	var refresh_problems_panel = ss("refresh_problems_panel");
	var ensure_statusbar_cursor = ss("ensure_statusbar_cursor");

	function get_slot() {
		return global.code_slot;
	}

	function set_slot(slot) {
		global.code_slot = slot;
	}

	function slot_key(slot) {
		return "" + slot;
	}

	function is_type_tab(slot) {
		return String(slot || "").indexOf(S.TYPE_TAB_PREFIX) === 0;
	}

	function is_untitled(slot) {
		return S.untitled_slots[slot_key(slot)] != null;
	}

	function mark_untitled(slot) {
		var s = slot_key(slot);
		if (S.untitled_slots[s] == null) {
			S.untitled_seq += 1;
			S.untitled_slots[s] = S.untitled_seq;
		}
	}

	function clear_untitled(slot) {
		delete S.untitled_slots[slot_key(slot)];
	}

	/** Untitled / Empty numeric slots need a name before a real save (VS Code–like). */
	function needs_name_on_save(slot) {
		var s = slot_key(slot);
		if (!s || is_type_tab(s) || is_character_slot(s)) return false;
		if (is_untitled(s)) return true;
		var name = global.X && X.codes && X.codes[s] && X.codes[s][0];
		return !name || name === "Empty";
	}

	function type_tab_label(key) {
		var path = String(key || "").slice(S.TYPE_TAB_PREFIX.length);
		var parts = path.split("/");
		return parts[parts.length - 1] || path || "types";
	}

	function monaco_api() {
		return S.editor && S.editor._monaco;
	}

	function mark_dirty() {
		var s = slot_key(get_slot());
		if (!s || is_type_tab(s)) return;
		S.dirty_slots[s] = true;
		global.code_change = true;
		refresh_chrome();
	}

	function clear_dirty(slot) {
		var s = slot_key(slot != null ? slot : get_slot());
		if (s) delete S.dirty_slots[s];
		global.code_change = !!S.dirty_slots[slot_key(get_slot())];
		refresh_chrome();
	}

	function is_dirty(slot) {
		return !!S.dirty_slots[slot_key(slot)];
	}

	function bind_editor(ed) {
		S.editor = ed;
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
		// Only register via ALEditor — avoids duplicate extraLib URIs that hang hover on "Loading...".
		if (global.ALEditor && typeof ALEditor.registerTypes === "function") {
			ALEditor.registerTypes();
		}
	}

	function ensure_tab(slot) {
		var s = slot_key(slot);
		if (S.open_tabs.indexOf(s) === -1) S.open_tabs.push(s);
	}

	function ensure_model(slot, value, forceValue) {
		var s = slot_key(slot);
		if (!global.monaco) return null;
		registerAdventureLandTypesSafe();
		if (S.models[s]) {
			if (forceValue && value != null) {
				S.applying_model = true;
				S.models[s].setValue(String(value));
				S.applying_model = false;
			}
			return S.models[s];
		}
		var uri = monaco.Uri.parse("file:///adventureland/slots/" + encodeURIComponent(s) + ".js");
		var existing = monaco.editor.getModel(uri);
		if (existing) {
			S.models[s] = existing;
		} else {
			S.models[s] = monaco.editor.createModel(value != null ? String(value) : "", "javascript", uri);
		}
		if (forceValue && value != null && S.models[s].getValue() !== String(value)) {
			S.applying_model = true;
			S.models[s].setValue(String(value));
			S.applying_model = false;
		}
		S.model_listeners[s] = S.models[s].onDidChangeContent(function () {
			if (S.applying_model) return;
			S.dirty_slots[s] = true;
			if (slot_key(get_slot()) === s) global.code_change = true;
			refresh_tabs();
			refresh_explorer();
		});
		if (global.ALEditor && typeof ALEditor.attachModelDiagnostics === "function") {
			ALEditor.attachModelDiagnostics(S.models[s]);
		}
		return S.models[s];
	}

	function set_active_model(slot, model) {
		var mapi = monaco_api();
		if (!mapi || !model) return;
		S.applying_model = true;
		mapi.setModel(model);
		mapi.updateOptions({ readOnly: false, domReadOnly: false });
		S.applying_model = false;
		set_slot(slot);
		global.code_change = is_dirty(slot);
		ensure_tab(slot);
		refresh_chrome();
		layout_editor();
		ensure_statusbar_cursor();
		if (S.problems_active_only) refresh_problems_panel();
		else update_statusbar();
	}

	function open_type_definition(model, selectionOrPosition) {
		var mapi = monaco_api();
		if (!mapi || !model) return false;
		var path = "";
		try {
			path = model.uri.path || model.uri.fsPath || String(model.uri);
		} catch (e) {
			path = String(model.uri);
		}
		if (path.charAt(0) === "/") path = path.slice(1);
		if (!path) path = "adventureland/types.d.ts";
		var key = S.TYPE_TAB_PREFIX + path;
		S.type_tab_models[key] = model;
		ensure_tab(key);
		S.applying_model = true;
		mapi.setModel(model);
		mapi.updateOptions({ readOnly: true, domReadOnly: true });
		S.applying_model = false;
		set_slot(key);
		global.code_change = false;
		refresh_chrome();
		layout_editor();

		var range = null;
		if (selectionOrPosition) {
			if (typeof selectionOrPosition.startLineNumber === "number") range = selectionOrPosition;
			else if (typeof selectionOrPosition.lineNumber === "number") {
				range = {
					startLineNumber: selectionOrPosition.lineNumber,
					startColumn: selectionOrPosition.column || 1,
					endLineNumber: selectionOrPosition.lineNumber,
					endColumn: (selectionOrPosition.column || 1) + 1,
				};
			}
		}
		if (range) {
			mapi.setSelection(range);
			mapi.setPosition({ lineNumber: range.startLineNumber, column: range.startColumn });
			mapi.revealLineNearTop(ALEditor.jsDocStartLine(model, range.startLineNumber));
		} else {
			mapi.setPosition({ lineNumber: 1, column: 1 });
			mapi.revealLine(1);
		}
		setTimeout(function () {
			try {
				mapi.focus();
			} catch (err) {}
		}, 0);
		return true;
	}

	function slot_label(num, entry) {
		if (is_untitled(num)) return "Untitled-" + S.untitled_slots[slot_key(num)] + ".js";
		var name = (entry && entry[0]) || "Empty";
		if (is_character_slot(num)) {
			if (global.character && global.real_id && slot_key(num) === slot_key(global.real_id)) {
				name = character.name || name;
			}
		}
		return name + ".js";
	}

	/** Numbered CODE slots are 1–100. Character base CODE is not a slot. */
	function is_numbered_slot(num) {
		var s = String(num == null ? "" : num).trim();
		if (!s) return false;
		var n = parseInt(s, 10);
		return !isNaN(n) && String(n) === s && n >= 1 && n <= 100;
	}

	/** Secondary label for tree/tabs — only for numbered slots 1–100. */
	function slot_badge(num) {
		if (is_untitled(num) || !is_numbered_slot(num)) return "";
		return "#" + slot_key(num);
	}

	function slot_title(num, entry) {
		var label = slot_label(num, entry);
		if (is_untitled(num)) return label + " (unsaved)";
		if (is_character_slot(num)) return label + " (character code)";
		if (is_numbered_slot(num)) return label + " — slot #" + slot_key(num);
		return label;
	}

	function is_character_slot(num) {
		if (is_type_tab(num) || is_untitled(num)) return false;
		// Character / multi-char CODE keys are anything outside numbered slots 1–100.
		if (is_numbered_slot(num)) return false;
		var n = slot_key(num);
		if (!n || n === "0") return false;
		return true;
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
		for (var i = 0; i < S.open_tabs.length; i++) {
			var s = S.open_tabs[i];
			var label, title;
			if (is_type_tab(s)) {
				label = type_tab_label(s);
				title = s.slice(S.TYPE_TAB_PREFIX.length) + " (read-only)";
			} else {
				label = slot_label(s, list[s] || [(global.character && character.name) || "code", 0]);
				title = slot_title(s, list[s] || [(global.character && character.name) || "code", 0]);
			}
			var badge = is_type_tab(s) ? "" : slot_badge(s);
			html +=
				'<div class="code-ide-tab' +
				(s === active ? " active" : "") +
				(is_dirty(s) ? " dirty" : "") +
				(is_type_tab(s) ? " type-tab" : "") +
				'" data-slot="' +
				s +
				'" title="' +
				title.replace(/"/g, "&quot;") +
				'">' +
				'<span class="code-ide-tab-name">' +
				label +
				"</span>" +
				(badge ? '<span class="code-ide-tab-slot">' + badge + "</span>" : "") +
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

	function is_empty_entry(entry) {
		return !entry || !entry[0] || entry[0] === "Empty";
	}

	function find_next_empty_slot() {
		var list = (global.X && X.codes) || {};
		for (var i = 1; i <= 100; i++) {
			if (is_empty_entry(list[i])) return "" + i;
		}
		return null;
	}

	function list_empty_slots() {
		var list = (global.X && X.codes) || {};
		var out = [];
		for (var i = 1; i <= 100; i++) {
			if (is_empty_entry(list[i])) out.push("" + i);
		}
		return out;
	}

	/**
	 * Open an empty slot immediately as Untitled-N (VS Code–like).
	 * Naming is deferred until Save / Save As.
	 */
	function open_fresh_slot(slot) {
		var s = slot_key(slot);
		if (!global.X) global.X = {};
		if (!X.codes) X.codes = {};
		if (is_empty_entry(X.codes[s])) {
			X.codes[s] = ["Empty", (X.codes[s] && X.codes[s][1]) || 0];
		}
		mark_untitled(s);
		var model = ensure_model(s, S.models[s] ? S.models[s].getValue() : "", false);
		ensure_tab(s);
		set_active_model(s, model);
		setTimeout(function () {
			if (S.editor && S.editor.focus) S.editor.focus();
			else {
				var mapi = monaco_api();
				if (mapi && mapi.focus) mapi.focus();
			}
		}, 0);
	}

	/** Open next empty slot, or Shift/Alt+click path: pick which empty slot. */
	function new_code_slot(pick) {
		if (pick) {
			show_empty_slot_picker();
			return;
		}
		var slot = find_next_empty_slot();
		if (!slot) {
			if (typeof global.add_log === "function") add_log("No empty code slots left", "#E06666");
			return;
		}
		open_fresh_slot(slot);
	}

	function show_empty_slot_picker() {
		ensure_chrome_dom();
		var $main = $("#code-ide-main");
		if (!$main.length) return;
		$("#code-ide-new-slot-panel").remove();
		var empties = list_empty_slots();
		if (!empties.length) {
			if (typeof global.add_log === "function") add_log("No empty code slots left", "#E06666");
			return;
		}
		var html = '<div id="code-ide-new-slot-panel" class="code-ide-quickpick">' + '<div class="code-ide-quickpick-title">New untitled slot</div>' + '<div class="code-ide-quickpick-results">';
		for (var i = 0; i < empties.length; i++) {
			var sn = empties[i];
			html +=
				'<div class="code-ide-quickpick-item' +
				(i === 0 ? " active" : "") +
				'" data-slot="' +
				sn +
				'">' +
				'<span class="code-ide-quickpick-label">Untitled</span>' +
				'<span class="code-ide-quickpick-detail"></span></div>';
		}
		html += "</div></div>";
		$main.append(html);
		$("#code-ide-new-slot-panel .code-ide-quickpick-item").on("mousedown", function (ev) {
			ev.preventDefault();
			var slot = $(this).attr("data-slot");
			$("#code-ide-new-slot-panel").remove();
			open_fresh_slot(slot);
		});
		$(document)
			.off("keydown.alnewslot")
			.on("keydown.alnewslot", function (e) {
				if (e.key === "Escape") {
					$("#code-ide-new-slot-panel").remove();
					$(document).off("keydown.alnewslot");
				}
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
			else if (!is_empty_entry(list[num]) || slot_key(num) === active || is_untitled(num)) codes.push(num);
		}
		chars.sort();
		codes.sort(function (a, b) {
			return parseInt(a, 10) - parseInt(b, 10);
		});

		var html = "";
		html += folder_html("characters", "characters", S.tree_folders.characters !== false);
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

		html += folder_html("slots", "slots", S.tree_folders.slots !== false);
		// Untitled buffers may not exist in the server list — always surface them.
		for (var u in S.untitled_slots) {
			if (!Object.prototype.hasOwnProperty.call(S.untitled_slots, u) || S.untitled_slots[u] == null) continue;
			if (codes.indexOf(u) === -1) codes.push(u);
		}
		codes.sort(function (a, b) {
			return parseInt(a, 10) - parseInt(b, 10);
		});
		for (var j = 0; j < codes.length; j++) {
			html += item_html(codes[j], list[codes[j]] || ["Empty", 0], active === slot_key(codes[j]));
		}
		html +=
			'<div class="code-tree-row action code-tree-new-slot" title="New untitled slot (Shift+click to pick)">' +
			'<span class="code-tree-twistie spacer" aria-hidden="true"></span>' +
			'<span class="code-tree-icon action" aria-hidden="true">' +
			'<svg width="16" height="16" viewBox="0 0 16 16"><path fill="currentColor" d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z"/></svg>' +
			"</span>" +
			'<span class="code-tree-label">New Untitled file</span>' +
			"</div>";
		html += "</div></div>"; // close slots children + folder

		$ex.html(html);
		$ex.find(".code-tree-row.folder").on("click", function (e) {
			e.preventDefault();
			var $folder = $(this).closest(".code-tree-folder");
			var id = $folder.attr("data-folder");
			var open = $folder.hasClass("collapsed");
			$folder.toggleClass("collapsed", !open);
			S.tree_folders[id] = open;
			try {
				localStorage.setItem(S.TREE_KEY, JSON.stringify(S.tree_folders));
			} catch (err) {}
		});
		$ex.find(".code-tree-row.file").on("click", function (e) {
			if ($(e.target).closest(".code-tree-delete").length) return;
			e.preventDefault();
			var slot = $(this).attr("data-slot");
			// Prefer in-memory activate so an already-open tab is selected immediately.
			if (S.models[slot_key(slot)] || S.open_tabs.indexOf(slot_key(slot)) !== -1 || is_type_tab(slot)) {
				activate_open_slot(slot);
			} else {
				open_slot(slot);
			}
		});
		$ex.find(".code-tree-new-slot").on("click", function (e) {
			e.preventDefault();
			new_code_slot(!!(e && (e.shiftKey || e.altKey)));
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
			'<span class="code-tree-twistie" aria-hidden="true">' +
			'<svg width="16" height="16" viewBox="0 0 16 16"><path fill="currentColor" d="M6 4l4 4-4 4V4z"/></svg>' +
			"</span>" +
			'<span class="code-tree-icon folder" aria-hidden="true">' +
			'<svg width="16" height="16" viewBox="0 0 16 16"><path fill="currentColor" d="M1.5 2.5A1.5 1.5 0 0 1 3 1h3.6c.5 0 1 .3 1.3.7L8.6 3H13a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 13 14H3a1.5 1.5 0 0 1-1.5-1.5v-10z"/></svg>' +
			"</span>" +
			'<span class="code-tree-label">' +
			label +
			"</span>" +
			"</div>" +
			'<div class="code-tree-children">'
		);
	}

	function item_html(slot, entry, active) {
		var title = slot_title(slot, entry).replace(/"/g, "&quot;");
		var can_delete = !is_character_slot(slot) && (!is_empty_entry(entry) || is_untitled(slot));
		var badge = slot_badge(slot);
		return (
			'<div class="code-tree-row file' +
			(active ? " active" : "") +
			(is_dirty(slot) ? " dirty" : "") +
			(is_untitled(slot) ? " untitled" : "") +
			(S.open_tabs.indexOf(slot_key(slot)) !== -1 ? " open" : "") +
			'" data-slot="' +
			slot +
			'" title="' +
			title +
			'">' +
			'<span class="code-tree-twistie spacer"></span>' +
			'<span class="code-tree-icon file" aria-hidden="true">JS</span>' +
			'<span class="code-tree-label">' +
			slot_label(slot, entry) +
			"</span>" +
			(badge ? '<span class="code-tree-slot">' + badge + "</span>" : "") +
			(can_delete
				? '<button type="button" class="code-tree-delete" data-slot="' +
					slot +
					'" title="Delete slot" aria-label="Delete slot">' +
					'<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">' +
					'<path fill="currentColor" d="M6 2h4a1 1 0 0 1 1 1v1h3v1h-1v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5H2V4h3V3a1 1 0 0 1 1-1zm1 1v1h2V3H7zm-3 3v7a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V6H4zm2 1h1v5H6V7zm3 0h1v5H9V7z"/>' +
					"</svg></button>"
				: "") +
			"</div>"
		);
	}

	function activate_open_slot(slot) {
		var s = slot_key(slot);
		if (is_type_tab(s)) {
			var tm = S.type_tab_models[s];
			var mapi = monaco_api();
			if (!tm || !mapi) return;
			S.applying_model = true;
			mapi.setModel(tm);
			mapi.updateOptions({ readOnly: true, domReadOnly: true });
			S.applying_model = false;
			set_slot(s);
			global.code_change = false;
			refresh_chrome();
			layout_editor();
			if (S.editor && S.editor.focus) S.editor.focus();
			return;
		}
		if (S.models[s]) {
			ensure_tab(s);
			set_active_model(s, S.models[s]);
			if (S.editor && S.editor.focus) S.editor.focus();
			return;
		}
		open_slot(s);
	}

	function open_slot(num) {
		var s = slot_key(num);
		if (!s || s === "undefined" || s === "null") return;
		if (is_type_tab(s)) {
			activate_open_slot(s);
			return;
		}
		// Already in memory (open tab or previously loaded) — switch without a server round-trip.
		if (S.models[s]) {
			ensure_tab(s);
			set_active_model(s, S.models[s]);
			if (S.editor && S.editor.focus) S.editor.focus();
			return;
		}
		if (typeof global.load_code === "function") global.load_code(num, 1);
		else api_call("load_code", { name: num, run: "", log: 1 });
	}

	function close_tab(slot) {
		var s = slot_key(slot);
		var idx = S.open_tabs.indexOf(s);
		if (idx === -1) return;
		if (is_untitled(s) && is_dirty(s)) {
			if (!window.confirm("Discard " + slot_label(s) + "?")) return;
		}
		S.open_tabs.splice(idx, 1);
		if (is_type_tab(s)) delete S.type_tab_models[s];
		if (is_untitled(s)) {
			clear_untitled(s);
			if (S.models[s]) {
				try {
					if (S.model_listeners[s]) S.model_listeners[s].dispose();
				} catch (e) {}
				try {
					S.models[s].dispose();
				} catch (e2) {}
				delete S.models[s];
				delete S.model_listeners[s];
				delete S.dirty_slots[s];
			}
		}
		if (slot_key(get_slot()) === s) {
			var next = S.open_tabs[idx] || S.open_tabs[idx - 1] || S.open_tabs[0];
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

	var SlotSession = global.SlotSession || (global.SlotSession = {});
	Object.assign(SlotSession, {
		bind_editor: bind_editor,
		mark_dirty: mark_dirty,
		clear_dirty: clear_dirty,
		open_slot: open_slot,
		open_type_definition: open_type_definition,
		refresh_explorer: refresh_explorer,
		refresh_chrome: refresh_chrome,
		update_badges: update_badges,
		new_code_slot: new_code_slot,
		open_fresh_slot: open_fresh_slot,
		ensure_model: ensure_model,
		set_active_model: set_active_model,
		ensure_tab: ensure_tab,
		refresh_tabs: refresh_tabs,
		close_tab: close_tab,
		activate_open_slot: activate_open_slot,
		get_slot: get_slot,
		set_slot: set_slot,
		slot_key: slot_key,
		monaco_api: monaco_api,
		is_dirty: is_dirty,
		is_untitled: is_untitled,
		is_type_tab: is_type_tab,
		clear_untitled: clear_untitled,
		slot_label: slot_label,
	});
})(typeof window !== "undefined" ? window : globalThis);
