/**
 * SlotSession explorer tree (characters / slots).
 * Loaded after workspace.js — keeps workspace under the 1k-line health line.
 */
(function (global) {
	"use strict";

	var S = global.ALCodeSessionState;
	if (!S) throw new Error("ALCodeSessionState missing — load session/state.js first");

	function ss(name) {
		return function () {
			var fn = global.SlotSession && global.SlotSession[name];
			if (typeof fn !== "function") {
				console.warn("[SlotSession.explorer] missing " + name);
				return;
			}
			return fn.apply(null, arguments);
		};
	}

	var migrate_empty_character_slot = ss("migrate_empty_character_slot");
	var canonical_slot = ss("canonical_slot");
	var get_slot = ss("get_slot");
	var is_character_slot = ss("is_character_slot");
	var is_view_tab = ss("is_view_tab");
	var is_type_tab = ss("is_type_tab");
	var is_empty_entry = ss("is_empty_entry");
	var is_untitled = ss("is_untitled");
	var slots_equal = ss("slots_equal");
	var slot_key = ss("slot_key");
	var character_display_name = ss("character_display_name");
	var slot_title = ss("slot_title");
	var slot_badge = ss("slot_badge");
	var slot_label = ss("slot_label");
	var is_dirty = ss("is_dirty");
	var open_slot = ss("open_slot");
	var new_code_slot = ss("new_code_slot");
	var delete_slot = ss("delete_slot");

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

	function current_character_mark_html() {
		return (
			'<span class="code-current-char-mark" title="Current character" aria-label="Current character">' +
			'<svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">' +
			'<path fill="currentColor" d="M8 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-5.5 7c0-2.5 2.5-4 5.5-4s5.5 1.5 5.5 4v1h-11v-1z"/>' +
			"</svg></span>"
		);
	}

	function item_html(slot, entry, active) {
		var title = slot_title(slot, entry).replace(/"/g, "&quot;");
		var can_delete = !is_character_slot(slot) && (!is_empty_entry(entry) || is_untitled(slot));
		var badge = slot_badge(slot);
		var key = canonical_slot(slot);
		var isCurrentChar = is_character_slot(slot) && global.real_id && slots_equal(slot, global.real_id);
		var isOpen = false;
		for (var i = 0; i < S.open_tabs.length; i++) {
			if (slots_equal(S.open_tabs[i], key)) {
				isOpen = true;
				break;
			}
		}
		return (
			'<div class="code-tree-row file' +
			(active ? " active" : "") +
			(is_dirty(slot) ? " dirty" : "") +
			(is_untitled(slot) ? " untitled" : "") +
			(isOpen ? " open" : "") +
			(isCurrentChar ? " current-character" : "") +
			'" data-slot="' +
			slot +
			'" title="' +
			title +
			(isCurrentChar ? " — current character" : "") +
			(can_delete ? " — double-click to rename" : "") +
			'">' +
			'<span class="code-tree-twistie spacer"></span>' +
			'<span class="code-tree-icon file" aria-hidden="true">JS</span>' +
			'<span class="code-tree-label">' +
			slot_label(slot, entry) +
			"</span>" +
			(isCurrentChar ? current_character_mark_html() : "") +
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

	function refresh_explorer() {
		var $ex = $("#code-slot-explorer");
		if (!$ex.length) return;
		migrate_empty_character_slot();
		var list = (global.X && X.codes) || {};
		var active = canonical_slot(get_slot());
		// Keep the folder with the active file expanded so selection is visible.
		if (active && is_character_slot(active)) S.tree_folders.characters = true;
		else if (active && !is_view_tab(active) && !is_type_tab(active)) S.tree_folders.slots = true;
		var chars = [];
		var codes = [];
		for (var num in list) {
			if (!Object.prototype.hasOwnProperty.call(list, num)) continue;
			if (is_character_slot(num)) chars.push(num);
			else if (!is_empty_entry(list[num]) || slots_equal(num, active) || is_untitled(num)) codes.push(num);
		}
		chars.sort();
		codes.sort(function (a, b) {
			return parseInt(a, 10) - parseInt(b, 10);
		});

		var html = "";
		html += folder_html("characters", "characters", S.tree_folders.characters !== false);
		var shownChars = {};
		// Current in-game character file as soon as real_id is known (even before character{} connects).
		if (global.real_id) {
			var cid = global.real_id;
			shownChars[slot_key(cid)] = true;
			var cname = character_display_name() || "character";
			html += item_html(cid, list[cid] || [cname, 0], slots_equal(cid, active));
		}
		// Full account roster (X.characters) — other chars' CODE even if never opened this session.
		var roster = (global.X && X.characters) || [];
		for (var ri = 0; ri < roster.length; ri++) {
			var ch = roster[ri];
			if (!ch || ch.id == null) continue;
			var rid = slot_key(ch.id);
			if (shownChars[rid]) continue;
			shownChars[rid] = true;
			html += item_html(ch.id, list[ch.id] || [ch.name || "character", 0], slots_equal(ch.id, active));
		}
		for (var i = 0; i < chars.length; i++) {
			var cnum = chars[i];
			var ckey = slot_key(cnum);
			if (shownChars[ckey]) continue;
			shownChars[ckey] = true;
			html += item_html(cnum, list[cnum], slots_equal(cnum, active));
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
			html += item_html(codes[j], list[codes[j]] || ["Empty", 0], slots_equal(codes[j], active));
		}
		html +=
			'<div class="code-tree-row action code-tree-new-slot" title="New Untitled file (Shift+click to pick)">' +
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
			open_slot(slot);
		});
		$ex.find(".code-tree-row.file").on("dblclick", function (e) {
			if ($(e.target).closest(".code-tree-delete").length) return;
			e.preventDefault();
			e.stopPropagation();
			var slot = $(this).attr("data-slot");
			if (is_character_slot(slot)) return;
			var ss = global.SlotSession;
			if (ss && typeof ss.show_save_name === "function") ss.show_save_name(slot, { allowOther: !is_untitled(slot) });
			else if (ss && typeof ss.save_as === "function") ss.save_as();
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

	var SlotSession = global.SlotSession || (global.SlotSession = {});
	Object.assign(SlotSession, {
		refresh_explorer: refresh_explorer,
	});
})(typeof window !== "undefined" ? window : globalThis);
