/**
 * SlotSession IO: handle_code*, save*, quick-open.
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
	var clear_untitled = ss("clear_untitled");
	var clear_dirty = ss("clear_dirty");
	var refresh_chrome = ss("refresh_chrome");
	var ensure_tab = ss("ensure_tab");
	var ensure_model = ss("ensure_model");
	var set_active_model = ss("set_active_model");
	var slot_key = ss("slot_key");
	var get_slot = ss("get_slot");
	var is_type_tab = ss("is_type_tab");
	var is_untitled = ss("is_untitled");
	var is_dirty = ss("is_dirty");
	var is_character_slot = ss("is_character_slot");
	var is_empty_entry = ss("is_empty_entry");
	var monaco_api = ss("monaco_api");
	var open_slot = ss("open_slot");
	var slot_label = ss("slot_label");
	var mark_dirty = ss("mark_dirty");
	var ensure_chrome_dom = ss("ensure_chrome_dom");
	var update_badges = ss("update_badges");
	var toggle_settings_panel = ss("toggle_settings_panel");
	var open_slot_in_workbench = ss("open_slot_in_workbench");
	var needs_name_on_save = ss("needs_name_on_save");

	function handle_code(info) {
		info.code = "" + info.code;
		if (info.slot && "" + info.slot !== "0" && info.v) X.codes[info.slot] = [info.name, info.v];
		if (info.save) {
			if (global.is_electron && typeof electron_is_main === "function" && electron_is_main()) {
				file_op_queue[info.slot] = ["save", info.slot, info.code, info.v];
			}
			clear_untitled(info.slot);
			clear_dirty(info.slot);
			refresh_chrome();
			return;
		}
		var new_code_slot = info.slot;
		if (new_code_slot == null || new_code_slot === "" || "" + new_code_slot === "0") {
			new_code_slot = global.real_id;
		}
		new_code_slot = "" + (new_code_slot == null ? "" : new_code_slot);
		if ((!new_code_slot || new_code_slot === "undefined" || new_code_slot === "null") && global.real_id) {
			new_code_slot = "" + global.real_id;
		}
		ensure_tab(new_code_slot);
		clear_dirty(new_code_slot);
		S.server_loaded[slot_key(new_code_slot)] = true;
		// Workbench owns models asynchronously — push server body via open_slot_in_workbench so we
		// never race ensure_model(null) → empty VFS create and wipe USERCODE.
		var api = global.ALVscodeApi;
		if (api && api.ready && api.workbenchOwnsTabs && global.SlotSession && typeof SlotSession.open_slot_in_workbench === "function") {
			SlotSession.open_slot_in_workbench(new_code_slot, info.code, true);
		} else {
			var model = ensure_model(new_code_slot, info.code, true);
			if (info.reset && model) {
				/* history clear: recreate model content already set */
			}
			set_active_model(new_code_slot, model);
		}
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
		// Keep local placeholders for open untitled slots so the tree can resolve them.
		for (var u in S.untitled_slots) {
			if (!Object.prototype.hasOwnProperty.call(S.untitled_slots, u) || S.untitled_slots[u] == null) continue;
			if (is_empty_entry(X.codes[u])) X.codes[u] = ["Empty", (X.codes[u] && X.codes[u][1]) || 0];
		}
		refresh_chrome();
		if (info.purpose == "save" || info.purpose == "save-pick") show_save_as(info);
		else {
			ensure_chrome_dom();
			if (info.purpose == "load" && typeof hide_modal === "function") {
				try {
					hide_modal(true);
				} catch (e) {}
			}
		}
		S.list_fetched = true;
	}

	function sanitize_slot_name(name) {
		name = String(name == null ? "" : name).trim();
		if (!name) return null;
		if (name.toUpperCase() === "DELETE") {
			if (typeof global.add_log === "function") add_log("Pick a real name — use the explorer trash to delete a slot.", "#E06666");
			return null;
		}
		return name;
	}

	/** VS Code–like: type a name, Enter saves to the reserved slot. No browser prompt. */
	function show_save_name(slot, opts) {
		opts = opts || {};
		ensure_chrome_dom();
		toggle_settings_panel(true);
		close_save_as();
		var $main = $("#code-ide-main");
		if (!$main.length) return;
		var s = slot_key(slot);
		$main.append(
			'<div id="code-ide-save-as-panel" class="code-ide-quickpick code-ide-save-name">' +
				'<div class="code-ide-quickpick-title">Save as</div>' +
				'<input type="text" id="code-ide-save-name" placeholder="File name" autocomplete="off" spellcheck="false" />' +
				'<div class="code-ide-save-hint">Enter to save · Esc to cancel</div>' +
				(opts.allowOther ? '<button type="button" class="code-ide-save-other" id="code-ide-save-other">Save to another slot…</button>' : "") +
				"</div>",
		);
		var $input = $("#code-ide-save-name");
		$input.val("");
		$input.trigger("focus");

		function commit() {
			var name = sanitize_slot_name($input.val());
			if (name == null) {
				$input.addClass("invalid");
				$input.attr("placeholder", "Enter a name");
				$input.trigger("focus");
				return;
			}
			perform_save_as(s, name);
		}

		$input.on("input", function () {
			$input.removeClass("invalid");
		});
		$input.on("keydown", function (e) {
			if (e.keyCode === 27) {
				e.preventDefault();
				e.stopPropagation();
				close_save_as();
				if (S.editor && S.editor.focus) S.editor.focus();
				return;
			}
			if (e.keyCode === 13) {
				e.preventDefault();
				commit();
			}
		});
		$("#code-ide-save-other").on("mousedown", function (ev) {
			ev.preventDefault();
			close_save_as();
			if (typeof api_call_l === "function") api_call_l("list_codes", { purpose: "save-pick" });
			else api_call("list_codes", { purpose: "save-pick" });
		});
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
				if (next_empty == null) next_empty = "" + i;
				break;
			}
		}
		if (next_empty == null) next_empty = "1";

		var entries = [{ slot: next_empty, label: "New file…", detail: "", fresh: true }];
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
			var entry_name = (ui_list[sn] && ui_list[sn][0]) || "Empty";
			if (!is_character_slot(sn) && entry_name === "Empty") continue;
			entries.push({
				slot: slot_key(sn),
				label: slot_label(sn, ui_list[sn]),
				detail: is_character_slot(sn) ? "character" : "",
				name: entry_name,
			});
		}

		$main.append(
			'<div id="code-ide-save-as-panel" class="code-ide-quickpick">' +
				'<div class="code-ide-quickpick-title">Save to…</div>' +
				'<input type="text" id="code-ide-save-filter" placeholder="Filter…" autocomplete="off" spellcheck="false" />' +
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
				show_save_name(entry.slot, { allowOther: false });
				return;
			}
			var ok = window.confirm("Overwrite " + entry.label + "?");
			if (!ok) return;
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
				if (S.editor && S.editor.focus) S.editor.focus();
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
		var ed = S.editor || global.codemirror_render;
		if (!ed || slot == null || slot === "") return;
		var code = ed.getValue();
		var from = slot_key(get_slot());
		api_call("save_code", {
			code: code,
			slot: slot,
			name: name,
			log: 1,
		});
		close_save_as();
		if (from) clear_untitled(from);
		clear_untitled(slot);
		if (!global.X) global.X = {};
		if (!X.codes) X.codes = {};
		X.codes[slot] = [name, (X.codes[slot] && X.codes[slot][1]) || 0];
		ensure_tab(slot);
		clear_dirty(slot);
		// Prefer workbench open with the friendly label so tabs/URI remount once with content.
		if (global.ALVscodeApi && global.ALVscodeApi.ready && global.ALVscodeApi.workbenchOwnsTabs) {
			open_slot_in_workbench(slot, code, true);
		} else {
			var model = ensure_model(slot, code, true);
			set_active_model(slot, model);
		}
		refresh_chrome();
	}

	function close_save_as() {
		$("#code-ide-save-as-panel").remove();
	}

	function save_as() {
		var slot = get_slot();
		if (needs_name_on_save(slot)) {
			show_save_name(slot, { allowOther: true });
			return;
		}
		if (typeof api_call_l === "function") api_call_l("list_codes", { purpose: "save-pick" });
		else api_call("list_codes", { purpose: "save-pick" });
	}

	function save_current() {
		var slot = get_slot();
		var ed = S.editor || global.codemirror_render;
		if (!ed || slot == null || slot === "") return;
		if (is_type_tab(slot) || (global.SlotSession && typeof SlotSession.is_view_tab === "function" && SlotSession.is_view_tab(slot))) {
			if (typeof global.add_log === "function") {
				add_log(is_type_tab(slot) ? "Type definitions are read-only" : "Settings tabs cannot be saved as code", "gray");
			}
			return;
		}
		if (needs_name_on_save(slot)) {
			show_save_name(slot, { allowOther: true });
			return;
		}
		var name = (global.X && X.codes && X.codes[slot] && X.codes[slot][0]) || "";
		function do_save(code) {
			api_call("save_code", {
				code: code,
				slot: slot,
				name: name,
				log: 1,
			});
		}
		var prefs = ed.getPrefs ? ed.getPrefs() : global.ALEditor && ALEditor.getPrefs ? ALEditor.getPrefs() : {};
		var model = monaco_api() && monaco_api().getModel && monaco_api().getModel();
		if (prefs && prefs.formatOnSave && prefs.formatting !== false && global.ALEditor && typeof ALEditor.formatModel === "function" && model) {
			ALEditor.formatModel(model)
				.catch(function () {})
				.then(function () {
					do_save(ed.getValue());
				});
			return;
		}
		do_save(ed.getValue());
	}

	function delete_slot(slot) {
		var s = slot_key(slot);
		if (!s || is_character_slot(s)) {
			if (typeof global.add_log === "function") add_log("Character base code can't be deleted from here.", "gray");
			return;
		}
		var list = (global.X && X.codes) || {};
		var label = slot_label(s, list[s] || ["Empty", 0]);
		if (is_untitled(s)) {
			if (is_dirty(s) && !window.confirm("Discard " + label + "?")) return;
			clear_untitled(s);
			var idxU = S.open_tabs.indexOf(s);
			if (idxU !== -1) S.open_tabs.splice(idxU, 1);
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
			if (slot_key(get_slot()) === s) {
				var nextU = S.open_tabs[0] || (global.real_id != null ? slot_key(global.real_id) : "1");
				if (S.models[nextU]) set_active_model(nextU, S.models[nextU]);
				else open_slot(nextU);
			}
			refresh_chrome();
			return;
		}
		if (!window.confirm("Delete " + label + "?\nThis clears the slot on the server.")) return;
		clear_untitled(s);
		api_call("save_code", {
			code: "//",
			slot: s,
			name: "DELETE",
			log: 1,
		});
		var idx = S.open_tabs.indexOf(s);
		if (idx !== -1) S.open_tabs.splice(idx, 1);
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
		if (slot_key(get_slot()) === s) {
			var next = S.open_tabs[0] || (global.real_id != null ? slot_key(global.real_id) : "1");
			if (S.models[next]) set_active_model(next, S.models[next]);
			else open_slot(next);
		}
		refresh_chrome();
	}

	function quick_open() {
		var api = global.ALVscodeApi;
		if (api && api.ready && api.workbenchOwnsTabs && typeof api.quickOpen === "function") {
			api.quickOpen();
			return;
		}
		ensure_chrome_dom();
		var $main = $("#code-ide-main");
		if (!$main.length) return;
		$("#code-ide-quick-open").remove();
		$(document).off("mousedown.alquickopen keydown.alquickopen");

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
			if (is_empty_entry(list[n])) continue;
			entries.push({ slot: slot_key(n), label: slot_label(n, list[n]) });
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
				html += '<div class="code-ide-quick-item' + (j === selected ? " active" : "") + '" data-slot="' + filtered[j].slot + '">' + filtered[j].label + "</div>";
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
				if (S.editor && S.editor.focus) S.editor.focus();
			}, 1);
		}

		function close_quick_open() {
			$("#code-ide-quick-open").remove();
			$(document).off("mousedown.alquickopen keydown.alquickopen");
		}

		filter("");
		var $input = $("#code-ide-quick-input");
		$input.trigger("focus");
		$input.on("input", function () {
			filter($(this).val());
		});
		$input.on("keydown", function (e) {
			if (e.keyCode === 27 || e.key === "Escape") {
				e.preventDefault();
				e.stopPropagation();
				close_quick_open();
				if (S.editor && S.editor.focus) S.editor.focus();
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

		// Esc / click-outside even when the input is not the event target.
		setTimeout(function () {
			$(document).on("mousedown.alquickopen", function (e) {
				if ($(e.target).closest("#code-ide-quick-open").length) return;
				close_quick_open();
			});
			$(document).on("keydown.alquickopen", function (e) {
				if (!(e.keyCode === 27 || e.key === "Escape")) return;
				if (!$("#code-ide-quick-open").length) return;
				e.preventDefault();
				e.stopPropagation();
				close_quick_open();
				if (S.editor && S.editor.focus) S.editor.focus();
			});
		}, 0);
	}

	var SlotSession = global.SlotSession || (global.SlotSession = {});
	Object.assign(SlotSession, {
		handle_code: handle_code,
		handle_code_list: handle_code_list,
		save_as: save_as,
		save_current: save_current,
		delete_slot: delete_slot,
		quick_open: quick_open,
		show_save_name: show_save_name,
	});
})(typeof window !== "undefined" ? window : globalThis);
