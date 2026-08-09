/**
 * SlotSession workspace: models, dirty, tabs, open_type_definition.
 * Explorer tree UI lives in session/explorer.js.
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
	var ensure_chrome_dom = ss("ensure_chrome_dom");
	var apply_chrome_theme = ss("apply_chrome_theme");
	var set_running = ss("set_running");
	var delete_slot = ss("delete_slot");

	function get_slot() {
		return global.code_slot;
	}

	function set_slot(slot) {
		global.code_slot = slot;
	}

	function slot_key(slot) {
		return "" + slot;
	}

	/** Map empty / missing slot ids to the current character real_id when known. */
	function canonical_slot(slot) {
		var s = slot_key(slot);
		if (!s || s === "undefined" || s === "null" || s === "0") {
			return global.real_id != null && global.real_id !== "" ? slot_key(global.real_id) : s;
		}
		return s;
	}

	function slots_equal(a, b) {
		return canonical_slot(a) === canonical_slot(b);
	}

	/**
	 * Early CODE inject can arrive before real_id is set, so the character buffer
	 * was keyed as "". Re-key it once real_id exists so explorer clicks match.
	 */
	function migrate_empty_character_slot() {
		var rid = global.real_id != null && global.real_id !== "" ? slot_key(global.real_id) : "";
		if (!rid || !S.models[""]) return;
		if (!S.models[rid]) {
			S.models[rid] = S.models[""];
			if (S.model_listeners[""]) {
				S.model_listeners[rid] = S.model_listeners[""];
				delete S.model_listeners[""];
			}
			if (S.dirty_slots[""]) {
				S.dirty_slots[rid] = true;
				delete S.dirty_slots[""];
			}
		} else {
			try {
				if (S.model_listeners[""]) S.model_listeners[""].dispose();
			} catch (e) {}
			try {
				S.models[""].dispose();
			} catch (e2) {}
			delete S.model_listeners[""];
			delete S.dirty_slots[""];
		}
		delete S.models[""];
		for (var i = 0; i < S.open_tabs.length; i++) {
			if (S.open_tabs[i] === "") S.open_tabs[i] = rid;
		}
		// Dedupe tabs after rewrite.
		var seen = Object.create(null);
		var next = [];
		for (var t = 0; t < S.open_tabs.length; t++) {
			var k = S.open_tabs[t];
			if (seen[k]) continue;
			seen[k] = 1;
			next.push(k);
		}
		S.open_tabs = next;
		if (slot_key(get_slot()) === "") set_slot(rid);
	}

	function find_model_slot(slot) {
		migrate_empty_character_slot();
		var s = canonical_slot(slot);
		if (S.models[s]) return s;
		if (s && S.models[""] && slots_equal(s, global.real_id)) return "";
		return s;
	}

	function is_type_tab(slot) {
		return String(slot || "").indexOf(S.TYPE_TAB_PREFIX) === 0;
	}

	function is_view_tab(slot) {
		return String(slot || "").indexOf(S.VIEW_TAB_PREFIX) === 0;
	}

	function view_tab_label(slot) {
		var id = String(slot || "").slice(S.VIEW_TAB_PREFIX.length);
		if (id === "keybindings") return "Keyboard Shortcuts";
		if (id === "settings") return "Settings";
		return id || "View";
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
		if (!s || is_type_tab(s) || is_view_tab(s) || is_character_slot(s)) return false;
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
		var api = global.ALVscodeApi;
		if (api && typeof api.getActiveCodeEditor === "function") {
			var active = api.getActiveCodeEditor();
			if (active) return active;
		}
		return S.editor && S.editor._monaco;
	}

	function workbench_owns_tabs() {
		var api = global.ALVscodeApi;
		return !!(api && api.ready && api.workbenchOwnsTabs && typeof api.openSlotEditor === "function");
	}

	function mark_dirty() {
		var s = slot_key(get_slot());
		if (!s || is_type_tab(s) || is_view_tab(s)) return;
		S.dirty_slots[s] = true;
		global.code_change = true;
		refresh_chrome();
		sync_workbench_current_character_tabs_soon();
	}

	function clear_dirty(slot) {
		var s = slot_key(slot != null ? slot : get_slot());
		if (s) delete S.dirty_slots[s];
		global.code_change = !!S.dirty_slots[slot_key(get_slot())];
		refresh_chrome();
		sync_workbench_current_character_tabs_soon();
	}

	function is_dirty(slot) {
		return !!S.dirty_slots[slot_key(slot)];
	}

	function bind_editor(ed) {
		S.editor = ed;
		ensure_chrome_dom();
		registerAdventureLandTypesSafe();
		migrate_empty_character_slot();
		var initial = ed.getValue() || "";
		var slot = canonical_slot(get_slot() || (global.real_id != null ? global.real_id : "0"));
		if (!slot || slot === "0") slot = canonical_slot(global.real_id) || slot;
		set_slot(slot);
		ensure_tab(slot);
		if (workbench_owns_tabs()) {
			var list = (global.X && X.codes) || {};
			// Saved slots / characters → load_code; unsaved character opens with default starter.
			if (slot && slot !== "0" && (list[slot] || is_character_slot(slot))) {
				open_slot(slot);
			} else {
				open_slot_in_workbench(slot, initial, true);
			}
			apply_layout();
			refresh_chrome();
			apply_chrome_theme();
			set_running(!!global.code_run);
			ensure_character_label_sync();
			return;
		}
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
		migrate_empty_character_slot();
		var s = canonical_slot(slot);
		if (!s) return;
		if (S.open_tabs.indexOf(s) === -1) S.open_tabs.push(s);
	}

	function ensure_model(slot, value, forceValue) {
		migrate_empty_character_slot();
		var s = canonical_slot(slot);
		if (!s || !global.monaco) return null;
		registerAdventureLandTypesSafe();
		if (workbench_owns_tabs()) {
			// Models are owned by the workbench textfile service — do not createModel
			// (same URI would steal openEditor into the standalone host).
			var api = global.ALVscodeApi;
			var uri = api.slotUri
				? api.slotUri(s, {
						label: slot_label(s, ((global.X && X.codes) || {})[s]),
						character: is_character_slot(s),
					})
				: monaco.Uri.parse("file:///adventureland/slots/" + encodeURIComponent(s) + ".js");
			var existingWb = monaco.editor.getModel(uri);
			if (existingWb) {
				if (forceValue && value != null && existingWb.getValue() !== String(value)) {
					S.applying_model = true;
					existingWb.setValue(String(value));
					S.applying_model = false;
				}
				S.models[s] = existingWb;
				return existingWb;
			}
			// Do not fire-and-forget ensureSlotFile here — that raced openSlotEditor and
			// FileNotFound. Creation/open goes through open_slot_in_workbench only.
			return S.models[s] || null;
		}
		if (S.models[s]) {
			if (forceValue && value != null) {
				S.applying_model = true;
				S.models[s].setValue(String(value));
				S.applying_model = false;
			}
			return S.models[s];
		}
		var uri2 = monaco.Uri.parse("file:///adventureland/slots/" + encodeURIComponent(s) + ".js");
		var existing = monaco.editor.getModel(uri2);
		if (existing) {
			S.models[s] = existing;
		} else {
			S.models[s] = monaco.editor.createModel(value != null ? String(value) : "", "javascript", uri2);
		}
		if (forceValue && value != null && S.models[s].getValue() !== String(value)) {
			S.applying_model = true;
			S.models[s].setValue(String(value));
			S.applying_model = false;
		}
		S.model_listeners[s] = S.models[s].onDidChangeContent(function () {
			if (S.applying_model) return;
			S.dirty_slots[s] = true;
			if (slots_equal(get_slot(), s)) global.code_change = true;
			refresh_tabs();
			call_refresh_explorer();
		});
		if (global.ALEditor && typeof ALEditor.attachModelDiagnostics === "function") {
			ALEditor.attachModelDiagnostics(S.models[s]);
		}
		return S.models[s];
	}

	function attach_model_dirty(slot, model) {
		var s = slot_key(slot);
		if (!model || S.model_listeners[s]) return;
		S.model_listeners[s] = model.onDidChangeContent(function () {
			if (S.applying_model) return;
			S.dirty_slots[s] = true;
			if (slots_equal(get_slot(), s)) global.code_change = true;
			refresh_tabs();
			call_refresh_explorer();
		});
		if (global.ALEditor && typeof ALEditor.attachModelDiagnostics === "function") {
			ALEditor.attachModelDiagnostics(model);
		}
	}

	function open_slot_in_workbench(slot, value, forceValue) {
		var s = canonical_slot(slot);
		if (!s || s === "undefined" || s === "null" || s === "0") return Promise.resolve(null);
		var api = global.ALVscodeApi;
		if (!api || typeof api.openSlotEditor !== "function") return Promise.resolve(null);
		ensure_tab(s);
		set_slot(s);
		var content = value;
		if (content == null && S.models[s]) content = S.models[s].getValue();
		// Characters with no body yet get the classic default starter — never call openSlotEditor with null
		// (that skipped VFS create and spammed "no VFS body" from label-sync remounts).
		var force = !!forceValue;
		if (content == null && is_character_slot(s)) {
			content = default_code_seed();
			// forceValue false keeps an existing VFS body; true only when caller asked to replace.
			if (forceValue) force = true;
		}
		if (content == null && !force) return Promise.resolve(null);
		var list = (global.X && X.codes) || {};
		var fallbackName = character_roster_name(s) || character_display_name() || "code";
		var label = slot_label(s, list[s] || [fallbackName, 0]);
		// Prefer live/roster names so tabs never stick as CH_….js / code.js
		if (is_character_slot(s)) {
			var cname = slots_equal(s, global.real_id) ? character_display_name() : character_roster_name(s);
			if (cname) label = cname + ".js";
		}
		return api
			.openSlotEditor(s, content, {
				forceValue: force,
				label: label,
				character: is_character_slot(s),
			})
			.then(function (model) {
				if (model) {
					S.models[s] = model;
					attach_model_dirty(s, model);
				}
				global.code_change = is_dirty(s);
				refresh_chrome();
				layout_editor();
				ensure_statusbar_cursor();
				if (S.problems_active_only) refresh_problems_panel();
				else update_statusbar();
				if (S.editor && S.editor.focus) S.editor.focus();
				sync_workbench_current_character_tabs_soon();
				return model;
			});
	}

	/** If the tab was opened as code.js before the name was known, remount with the friendly name. */
	var _char_label_timer = null;
	function ensure_character_label_sync() {
		if (_char_label_timer || !workbench_owns_tabs()) return;
		var tries = 0;
		var remounting = false;
		_char_label_timer = setInterval(function () {
			tries += 1;
			var rid = global.real_id;
			var name = character_display_name();
			if (rid && name) {
				var uri = null;
				var ed = null;
				try {
					ed = global.ALVscodeApi && ALVscodeApi.getActiveCodeEditor && ALVscodeApi.getActiveCodeEditor();
					uri = ed && ed.getModel && ed.getModel() ? String(ed.getModel().uri) : null;
				} catch (e) {}
				var provisional = !uri || /\/characters\/(?:code|character)\.js/i.test(uri) || /\/CH_/i.test(uri || "");
				if (provisional && (slots_equal(get_slot(), rid) || S.open_tabs.indexOf(slot_key(rid)) !== -1)) {
					if (remounting) return;
					var live = null;
					try {
						var model = ed && ed.getModel && ed.getModel();
						if (model) live = model.getValue();
					} catch (e2) {}
					if (live == null && S.models[slot_key(rid)]) {
						try {
							live = S.models[slot_key(rid)].getValue();
						} catch (e3) {}
					}
					remounting = true;
					Promise.resolve(open_slot_in_workbench(rid, live, false)).then(
						function () {
							remounting = false;
						},
						function () {
							remounting = false;
						},
					);
				} else if (!provisional) {
					clearInterval(_char_label_timer);
					_char_label_timer = null;
					refresh_chrome();
					return;
				}
			}
			if (tries > 60) {
				clearInterval(_char_label_timer);
				_char_label_timer = null;
			}
		}, 500);
	}

	function on_workbench_active_slot(slot) {
		if (slot == null || is_view_tab(slot)) return;
		var s = canonical_slot(slot);
		if (!s || slots_equal(get_slot(), s)) {
			call_refresh_explorer();
			sync_workbench_current_character_tabs_soon();
			return;
		}
		ensure_tab(s);
		set_slot(s);
		global.code_change = is_dirty(s);
		refresh_chrome();
		update_statusbar();
	}

	function set_active_model(slot, model) {
		if (workbench_owns_tabs()) {
			return open_slot_in_workbench(slot, model ? model.getValue() : null, false);
		}
		var mapi = monaco_api();
		if (!mapi || !model) return;
		migrate_empty_character_slot();
		var s = canonical_slot(slot);
		S.applying_model = true;
		mapi.setModel(model);
		mapi.updateOptions({ readOnly: false, domReadOnly: false });
		S.applying_model = false;
		set_slot(s);
		global.code_change = is_dirty(s);
		ensure_tab(s);
		refresh_chrome();
		layout_editor();
		ensure_statusbar_cursor();
		if (S.problems_active_only) refresh_problems_panel();
		else update_statusbar();
	}

	/**
	 * Open an ambient type model as a CODE type-tab (preferred definition UX).
	 *
	 * HACK(monaco): AL type tab instead of stock peekDefinition / go-to-definition alone.
	 * Why: ambient al-type / extraLib URIs and standalone↔workbench model swaps do not
	 *   reliably peek in this embed; we already resolved the target model+range.
	 * Purpose: show the type in a read-only CODE tab (workbench or legacy host).
	 * Remove when: peek/reveal works for these URIs end-to-end.
	 */
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

	/** Prefer live character.name; fall back to /character/{name}/… URL before connection. */
	function character_roster_name(num) {
		var id = slot_key(num);
		var roster = (global.X && X.characters) || [];
		for (var i = 0; i < roster.length; i++) {
			var c = roster[i];
			if (!c) continue;
			if (slot_key(c.id) === id || (c.name && String(c.name) === String(num))) return String(c.name);
		}
		return null;
	}

	function character_display_name() {
		if (global.character && character.name) return String(character.name);
		try {
			var m = String((global.location && location.pathname) || "").match(/\/character\/([^/]+)\//i);
			if (m && m[1]) return decodeURIComponent(m[1]);
		} catch (e) {}
		return null;
	}

	function slot_label(num, entry) {
		if (is_view_tab(num)) return view_tab_label(num);
		if (is_untitled(num)) return "Untitled-" + S.untitled_slots[slot_key(num)] + ".js";
		var name = (entry && entry[0]) || "Empty";
		if (is_character_slot(num)) {
			if (global.real_id && slot_key(num) === slot_key(global.real_id)) {
				name = character_display_name() || name;
			} else {
				name = character_roster_name(num) || name;
			}
		}
		if (!name || name === "Empty" || name === "code" || name === "character") {
			if (is_character_slot(num)) name = character_display_name() || character_roster_name(num) || name || "character";
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
		if (is_type_tab(num) || is_view_tab(num) || is_untitled(num)) return false;
		// Character / multi-char CODE keys are anything outside numbered slots 1–100.
		if (is_numbered_slot(num)) return false;
		var n = slot_key(num);
		if (!n || n === "0") return false;
		return true;
	}

	/** Classic AL starter from #dcode (default_code.js), used when a character has no saved USERCODE. */
	function default_code_seed() {
		try {
			var v = ($("#dcode").val && $("#dcode").val()) || "";
			if (v) return v;
		} catch (e) {}
		try {
			if (S.editor && S.editor.getValue) {
				var live = S.editor.getValue();
				if (live) return live;
			}
		} catch (e2) {}
		return "var attack_mode=false\n";
	}

	function call_refresh_explorer() {
		var ss = global.SlotSession;
		if (ss && typeof ss.refresh_explorer === "function") ss.refresh_explorer();
		if (ss && typeof ss.schedule_refresh_outline === "function") ss.schedule_refresh_outline();
	}

	function refresh_chrome() {
		call_refresh_explorer();
		refresh_tabs();
	}

	function refresh_tabs() {
		var $tabs = $("#code-ide-tabs");
		if (!$tabs.length) return;
		// Workbench editor group owns the tab strip (code + Settings).
		if (workbench_owns_tabs()) {
			$tabs.empty().attr("hidden", "hidden");
			sync_workbench_current_character_tabs_soon();
			return;
		}
		$tabs.removeAttr("hidden");
		migrate_empty_character_slot();
		var active = canonical_slot(get_slot());
		var list = (global.X && X.codes) || {};
		var html = "";
		for (var i = 0; i < S.open_tabs.length; i++) {
			var s = S.open_tabs[i];
			var label, title;
			if (is_view_tab(s)) {
				label = view_tab_label(s);
				title = label;
			} else if (is_type_tab(s)) {
				label = type_tab_label(s);
				title = s.slice(S.TYPE_TAB_PREFIX.length) + " (read-only)";
			} else {
				label = slot_label(s, list[s] || [(global.character && character.name) || "code", 0]);
				title = slot_title(s, list[s] || [(global.character && character.name) || "code", 0]);
			}
			var badge = is_type_tab(s) || is_view_tab(s) ? "" : slot_badge(s);
			var isCurrentChar = !is_type_tab(s) && !is_view_tab(s) && is_character_slot(s) && global.real_id && slots_equal(s, global.real_id);
			html +=
				'<div class="code-ide-tab' +
				(slots_equal(s, active) ? " active" : "") +
				(is_dirty(s) ? " dirty" : "") +
				(is_type_tab(s) ? " type-tab" : "") +
				(is_view_tab(s) ? " view-tab" : "") +
				(isCurrentChar ? " current-character" : "") +
				'" data-slot="' +
				s +
				'" title="' +
				title.replace(/"/g, "&quot;") +
				(isCurrentChar ? " — current character" : "") +
				'">' +
				'<span class="code-ide-tab-name">' +
				label +
				"</span>" +
				(isCurrentChar
					? '<span class="code-current-char-mark" title="Current character" aria-label="Current character">' +
						'<svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">' +
						'<path fill="currentColor" d="M8 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-5.5 7c0-2.5 2.5-4 5.5-4s5.5 1.5 5.5 4v1h-11v-1z"/>' +
						"</svg></span>"
					: "") +
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

	/**
	 * HACK(monaco): scrape workbench tab DOM for AL chrome (current-character mark, dirty, middle-click).
	 * Why: no stock API to decorate editor tabs with game "current character" / AL dirty / slot id.
	 * Purpose: AL product cues on the workbench tab strip without replacing the strip.
	 * Remove when: tab affordances exist via workbench APIs or we drop these cues.
	 */
	function sync_workbench_tab_chrome() {
		if (!workbench_owns_tabs()) return;
		var name = character_display_name();
		var want = name ? name.replace(/\.js$/i, "") + ".js" : "";
		var rid = global.real_id != null ? slot_key(global.real_id) : "";
		var uriHint = "";
		try {
			if (rid && global.ALVscodeApi && typeof ALVscodeApi.slotUri === "function") {
				uriHint = String(
					ALVscodeApi.slotUri(rid, {
						character: true,
						label: want || "character.js",
					}),
				);
			}
		} catch (e) {}
		var tabs = document.querySelectorAll("#al-vscode-workbench .tabs-and-actions-container .tab");
		for (var i = 0; i < tabs.length; i++) {
			var tab = tabs[i];
			var labelEl = tab.querySelector(".label-name");
			var labelText = labelEl ? String(labelEl.textContent || "").trim() : "";
			var aria = String(tab.getAttribute("aria-label") || tab.getAttribute("title") || "");
			var match = false;
			if (want) {
				match = labelText === want || labelText.indexOf(want) === 0 || aria.indexOf(want) !== -1;
			}
			if (!match && uriHint) {
				match = aria.indexOf(uriHint) !== -1 || String(tab.title || "").indexOf(uriHint) !== -1;
			}
			tab.classList.toggle("al-current-character", match);
			var mark = tab.querySelector(".al-current-char-mark");
			if (match) {
				if (!mark) {
					mark = document.createElement("span");
					mark.className = "al-current-char-mark code-current-char-mark";
					mark.title = "Current character";
					mark.setAttribute("aria-label", "Current character");
					mark.innerHTML =
						'<svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">' +
						'<path fill="currentColor" d="M8 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-5.5 7c0-2.5 2.5-4 5.5-4s5.5 1.5 5.5 4v1h-11v-1z"/>' +
						"</svg>";
					var labelHost = tab.querySelector(".monaco-icon-label-container") || labelEl || tab;
					if (labelEl && labelEl.parentNode) labelEl.parentNode.insertBefore(mark, labelEl.nextSibling);
					else labelHost.appendChild(mark);
				}
				if (want && !/\bcurrent character\b/i.test(aria)) {
					tab.setAttribute("title", (aria || want) + " — current character");
				}
			} else if (mark) {
				mark.parentNode.removeChild(mark);
			}

			var slotForTab = null;
			try {
				if (global.ALVscodeApi && typeof ALVscodeApi.slotFromUri === "function") {
					var resourceAttr = tab.getAttribute("data-resource") || tab.getAttribute("data-href") || "";
					if (resourceAttr) slotForTab = ALVscodeApi.slotFromUri(resourceAttr);
				}
			} catch (e2) {}
			if (slotForTab == null && labelText) {
				for (var ti = 0; ti < S.open_tabs.length; ti++) {
					var ts = S.open_tabs[ti];
					if (is_view_tab(ts) || is_type_tab(ts)) continue;
					var tl = slot_label(ts, ((global.X && X.codes) || {})[ts]);
					if (tl === labelText || tl === labelText.replace(/\.js$/i, "") + ".js") {
						slotForTab = ts;
						break;
					}
				}
			}
			var dirty = !!(slotForTab && is_dirty(slotForTab));
			tab.classList.toggle("al-dirty", dirty);
			tab.classList.toggle("dirty", dirty);
			if (slotForTab) tab.setAttribute("data-al-slot", slot_key(slotForTab));
			else tab.removeAttribute("data-al-slot");
		}
		wire_workbench_tab_gestures();
	}

	var _wb_tab_gestures = false;
	function wire_workbench_tab_gestures() {
		if (_wb_tab_gestures || !workbench_owns_tabs()) return;
		var host = document.querySelector("#al-vscode-workbench .tabs-and-actions-container");
		if (!host) return;
		_wb_tab_gestures = true;
		host.addEventListener("auxclick", function (e) {
			if (e.button !== 1) return;
			var tab = e.target && e.target.closest ? e.target.closest(".tab") : null;
			if (!tab) return;
			e.preventDefault();
			e.stopPropagation();
			var slot = tab.getAttribute("data-al-slot");
			if (slot) close_tab(slot);
		});
	}

	function sync_workbench_current_character_tabs() {
		sync_workbench_tab_chrome();
	}

	function sync_workbench_current_character_tabs_soon() {
		sync_workbench_tab_chrome();
		if (typeof requestAnimationFrame === "function") {
			requestAnimationFrame(function () {
				sync_workbench_tab_chrome();
				setTimeout(sync_workbench_tab_chrome, 60);
			});
		} else {
			setTimeout(sync_workbench_tab_chrome, 60);
		}
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
		ensure_tab(s);
		set_slot(s);
		function focusSoon() {
			setTimeout(function () {
				if (S.editor && S.editor.focus) S.editor.focus();
				else {
					var mapi = monaco_api();
					if (mapi && mapi.focus) mapi.focus();
				}
			}, 0);
		}
		// Workbench path must open with a real body ("" + force) — ensure_model is async/no-op
		// and set_active_model(null) used to bail before openSlotEditor (no tab, slow tree-only update).
		if (workbench_owns_tabs()) {
			return open_slot_in_workbench(s, "", true).then(function (model) {
				focusSoon();
				return model;
			});
		}
		var model = ensure_model(s, "", true);
		set_active_model(s, model);
		refresh_chrome();
		focusSoon();
		return Promise.resolve(model);
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
		var html = '<div id="code-ide-new-slot-panel" class="code-ide-quickpick">' + '<div class="code-ide-quickpick-title">New Untitled file</div>' + '<div class="code-ide-quickpick-results">';
		for (var i = 0; i < empties.length; i++) {
			var sn = empties[i];
			html +=
				'<div class="code-ide-quickpick-item' +
				(i === 0 ? " active" : "") +
				'" data-slot="' +
				sn +
				'">' +
				'<span class="code-ide-quickpick-label">Untitled file</span>' +
				'<span class="code-ide-quickpick-detail">#' +
				sn +
				"</span></div>";
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

	function activate_view_tab(slot) {
		var s = slot_key(slot);
		ensure_tab(s);
		set_slot(s);
		global.code_change = false;
		refresh_chrome();
		var api = global.ALVscodeApi;
		var ready = global.ALVscodeApiReady;
		function go() {
			api = global.ALVscodeApi;
			if (!api) {
				console.warn("[SlotSession] ALVscodeApi not ready for view tab");
				return;
			}
			var opts = { fromTab: true };
			if (s === S.VIEW_KEYBINDINGS) {
				if (typeof api.openKeybindings === "function") return api.openKeybindings(opts);
			} else if (typeof api.openSettings === "function") {
				return api.openSettings(opts);
			}
		}
		if (ready && typeof ready.then === "function") ready.then(go).catch(go);
		else go();
	}

	function hide_workbench_if_needed(hard) {
		var api = global.ALVscodeApi;
		if (api && typeof api.hideWorkbench === "function") api.hideWorkbench(hard ? { hard: true } : undefined);
	}

	function open_settings_tab() {
		var api = global.ALVscodeApi;
		var ready = global.ALVscodeApiReady;
		function go() {
			api = global.ALVscodeApi;
			if (api && typeof api.openSettings === "function") return api.openSettings();
		}
		if (ready && typeof ready.then === "function") ready.then(go).catch(go);
		else go();
	}

	function open_keybindings_tab() {
		var api = global.ALVscodeApi;
		var ready = global.ALVscodeApiReady;
		function go() {
			api = global.ALVscodeApi;
			if (api && typeof api.openKeybindings === "function") return api.openKeybindings();
		}
		if (ready && typeof ready.then === "function") ready.then(go).catch(go);
		else go();
	}

	/** Close the active Settings/Keybindings IDE tab (used by workbench ✕). */
	function close_active_view_tab() {
		if (workbench_owns_tabs()) {
			// Native workbench tab close handles Settings; AL view tabs unused.
			return false;
		}
		var s = slot_key(get_slot());
		if (!is_view_tab(s)) return false;
		close_tab(s);
		return true;
	}

	/** Code tabs only (skips Settings / Keybindings view tabs), left-to-right open order. */
	function code_open_tabs() {
		var all = S.open_tabs || [];
		var tabs = [];
		for (var i = 0; i < all.length; i++) {
			if (!is_view_tab(all[i])) tabs.push(all[i]);
		}
		return tabs;
	}

	/**
	 * Cycle CODE open tabs (legacy AL session strip).
	 * Prefer cycle_code_tab / workbench nextEditor when workbenchOwnsTabs — this path is for
	 * the non-workbench tab list and skips Settings/Keybindings view tabs.
	 * @param {number} delta +1 next / -1 previous
	 */
	function cycle_open_tab(delta) {
		var tabs = code_open_tabs();
		if (!tabs.length) return Promise.resolve(null);
		var cur = slot_key(get_slot());
		var idx = -1;
		for (var j = 0; j < tabs.length; j++) {
			if (slots_equal(tabs[j], cur)) {
				idx = j;
				break;
			}
		}
		if (idx < 0) idx = 0;
		var n = tabs.length;
		var step = delta < 0 ? -1 : 1;
		var nextIdx = (((idx + step) % n) + n) % n;
		return Promise.resolve(activate_open_slot(tabs[nextIdx]));
	}

	/**
	 * Jump to the Nth open code tab (0-based). StackBlitz / VS Code Ctrl+1…7 pattern.
	 * No-op if index is out of range.
	 * @param {number} index
	 */
	function activate_open_tab_at(index) {
		var tabs = code_open_tabs();
		var i = typeof index === "number" ? index : parseInt(index, 10);
		if (!(i >= 0) || i >= tabs.length) return Promise.resolve(null);
		return Promise.resolve(activate_open_slot(tabs[i]));
	}

	function activate_open_slot(slot) {
		migrate_empty_character_slot();
		var s = canonical_slot(slot);
		if (is_view_tab(s)) {
			activate_view_tab(s);
			return Promise.resolve(null);
		}
		if (is_type_tab(s)) {
			if (workbench_owns_tabs()) {
				// Type defs still use standalone model swap when possible.
				var tmWb = S.type_tab_models[s];
				var mapiWb = monaco_api();
				if (!tmWb || !mapiWb) return Promise.resolve(null);
				S.applying_model = true;
				mapiWb.setModel(tmWb);
				mapiWb.updateOptions({ readOnly: true, domReadOnly: true });
				S.applying_model = false;
				set_slot(s);
				global.code_change = false;
				refresh_chrome();
				layout_editor();
				return Promise.resolve(tmWb);
			}
			var tm = S.type_tab_models[s];
			var mapi = monaco_api();
			if (!tm || !mapi) return Promise.resolve(null);
			S.applying_model = true;
			mapi.setModel(tm);
			mapi.updateOptions({ readOnly: true, domReadOnly: true });
			S.applying_model = false;
			set_slot(s);
			global.code_change = false;
			refresh_chrome();
			layout_editor();
			if (S.editor && S.editor.focus) S.editor.focus();
			return Promise.resolve(tm);
		}
		if (workbench_owns_tabs()) {
			var modelKeyWb = find_model_slot(s);
			var existing = S.models[modelKeyWb];
			if (existing) {
				return open_slot_in_workbench(s, existing.getValue(), false);
			}
			open_slot(s);
			return Promise.resolve(null);
		}
		var modelKey = find_model_slot(s);
		if (S.models[modelKey]) {
			ensure_tab(s);
			set_active_model(s, S.models[modelKey]);
			if (S.editor && S.editor.focus) S.editor.focus();
			return Promise.resolve(S.models[modelKey]);
		}
		open_slot(s);
		return Promise.resolve(null);
	}

	function open_slot(num) {
		migrate_empty_character_slot();
		var s = canonical_slot(num);
		if (!s || s === "undefined" || s === "null") return;
		if (is_view_tab(s)) {
			activate_open_slot(s);
			return;
		}
		if (is_type_tab(s)) {
			activate_open_slot(s);
			return;
		}
		// Already in memory — reuse unless we never applied a USERCODE body for a listed slot
		// (starter/#dcode can otherwise stick forever and skip load_code).
		var modelKey = find_model_slot(s);
		var listEarly = (global.X && X.codes) || {};
		// Untitled buffers are local-only — never wait on load_code (that felt multi-second slow).
		if (is_untitled(s)) {
			var localBody = S.models[modelKey] ? S.models[modelKey].getValue() : "";
			ensure_tab(s);
			if (workbench_owns_tabs()) {
				open_slot_in_workbench(s, localBody, !S.models[modelKey]);
			} else {
				var um = ensure_model(s, localBody, !S.models[modelKey]);
				if (um) set_active_model(s, um);
			}
			if (S.editor && S.editor.focus) S.editor.focus();
			return;
		}
		if (S.models[modelKey] && !(listEarly[s] && !S.server_loaded[s] && !is_dirty(s))) {
			ensure_tab(s);
			set_active_model(s, S.models[modelKey]);
			if (S.editor && S.editor.focus) S.editor.focus();
			return;
		}

		var list = (global.X && X.codes) || {};
		var hasSaved = !!(list[s] || list[slot_key(s)]);

		// Character CODE: saved USERCODE loads from the server; otherwise show the default
		// starter (#dcode) — same as classic AL for any character that never saved script.
		if (is_character_slot(s)) {
			if (hasSaved) {
				if (workbench_owns_tabs() && !S.models[s]) {
					open_slot_in_workbench(s, "", true);
				} else if (!workbench_owns_tabs() && !S.models[s]) {
					var blank = ensure_model(s, "", true);
					if (blank) {
						ensure_tab(s);
						set_active_model(s, blank);
						if (S.editor && S.editor.focus) S.editor.focus();
					}
				}
				if (typeof global.load_code === "function") global.load_code(s, 1);
				else api_call("load_code", { name: s, run: "", log: 1 });
				return;
			}
			var seed = default_code_seed();
			if (workbench_owns_tabs()) {
				open_slot_in_workbench(s, seed, true);
				return;
			}
			var model = ensure_model(s, seed, true);
			if (model) {
				ensure_tab(s);
				set_active_model(s, model);
				if (S.editor && S.editor.focus) S.editor.focus();
			}
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
		var wasActive = slot_key(get_slot()) === s;
		var closingView = is_view_tab(s);
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
		if (wasActive) {
			var next = S.open_tabs[idx] || S.open_tabs[idx - 1] || S.open_tabs[0];
			if (next) activate_open_slot(next);
			else if (closingView) hide_workbench_if_needed(true);
		} else if (closingView) {
			// Closed a background settings tab — leave the active editor alone.
			var stillView = false;
			for (var vi = 0; vi < S.open_tabs.length; vi++) {
				if (is_view_tab(S.open_tabs[vi])) {
					stillView = true;
					break;
				}
			}
			if (!stillView) hide_workbench_if_needed(true);
		}
		refresh_chrome();
	}

	function update_badges() {
		// Slot label lives in IDE chrome / workbench tabs now (legacy codeslot* strip removed).
		refresh_chrome();
	}

	var SlotSession = global.SlotSession || (global.SlotSession = {});
	Object.assign(SlotSession, {
		bind_editor: bind_editor,
		mark_dirty: mark_dirty,
		clear_dirty: clear_dirty,
		open_slot: open_slot,
		open_type_definition: open_type_definition,
		refresh_chrome: refresh_chrome,
		update_badges: update_badges,
		new_code_slot: new_code_slot,
		open_fresh_slot: open_fresh_slot,
		ensure_model: ensure_model,
		set_active_model: set_active_model,
		ensure_tab: ensure_tab,
		refresh_tabs: refresh_tabs,
		sync_workbench_current_character_tabs: sync_workbench_current_character_tabs,
		close_tab: close_tab,
		activate_open_slot: activate_open_slot,
		cycle_open_tab: cycle_open_tab,
		activate_open_tab_at: activate_open_tab_at,
		open_settings_tab: open_settings_tab,
		open_keybindings_tab: open_keybindings_tab,
		close_active_view_tab: close_active_view_tab,
		on_workbench_active_slot: on_workbench_active_slot,
		open_slot_in_workbench: open_slot_in_workbench,
		migrate_empty_character_slot: migrate_empty_character_slot,
		character_display_name: character_display_name,
		character_roster_name: character_roster_name,
		get_slot: get_slot,
		set_slot: set_slot,
		slot_key: slot_key,
		canonical_slot: canonical_slot,
		slots_equal: slots_equal,
		monaco_api: monaco_api,
		is_dirty: is_dirty,
		is_untitled: is_untitled,
		is_type_tab: is_type_tab,
		is_view_tab: is_view_tab,
		is_character_slot: is_character_slot,
		is_empty_entry: is_empty_entry,
		clear_untitled: clear_untitled,
		slot_label: slot_label,
		slot_title: slot_title,
		slot_badge: slot_badge,
		needs_name_on_save: needs_name_on_save,
	});

	// Editor may have been created before session scripts loaded — attach now.
	try {
		if (global.codemirror_render && global.codemirror_render._monaco && (!S.editor || !Object.keys(S.models).length)) {
			bind_editor(global.codemirror_render);
		}
	} catch (e) {}
})(typeof window !== "undefined" ? window : globalThis);
