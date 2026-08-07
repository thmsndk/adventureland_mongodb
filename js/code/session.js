/**
 * SlotSession — multi-slot Monaco models, IDE chrome, layout modes, play/pause.
 */
(function (global) {
	"use strict";

	var editor = null;
	var list_fetched = false;
	var explorer_collapsed = false;
	var models = {}; // slot -> ITextModel
	var open_tabs = []; // slot ids as strings (or TYPE_TAB_PREFIX + path)
	var dirty_slots = {}; // slot -> bool
	var model_listeners = {}; // slot -> disposable
	var type_tab_models = {}; // type-tab key -> shared readonly ITextModel
	var untitled_slots = {}; // slot -> untitled sequence number (local buffer, name deferred)
	var untitled_seq = 0;
	var applying_model = false;
	var TYPE_TAB_PREFIX = "type:";
	var problems_view = "tree"; // tree | table
	var problems_panel_tab = "problems"; // problems | spell
	var problems_filter = "";
	var problems_show_errors = true;
	var problems_show_warnings = true;
	var problems_show_infos = true;
	var problems_active_only = false;
	var problems_collapsed_files = {}; // fileKey -> true when collapsed
	var statusbar_cursor_bound = false;

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

	function is_type_tab(slot) {
		return String(slot || "").indexOf(TYPE_TAB_PREFIX) === 0;
	}

	function is_untitled(slot) {
		return untitled_slots[slot_key(slot)] != null;
	}

	function mark_untitled(slot) {
		var s = slot_key(slot);
		if (untitled_slots[s] == null) {
			untitled_seq += 1;
			untitled_slots[s] = untitled_seq;
		}
	}

	function clear_untitled(slot) {
		delete untitled_slots[slot_key(slot)];
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
		var path = String(key || "").slice(TYPE_TAB_PREFIX.length);
		var parts = path.split("/");
		return parts[parts.length - 1] || path || "types";
	}

	function monaco_api() {
		return editor && editor._monaco;
	}

	function mark_dirty() {
		var s = slot_key(get_slot());
		if (!s || is_type_tab(s)) return;
		dirty_slots[s] = true;
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
		// Only register via ALEditor — avoids duplicate extraLib URIs that hang hover on "Loading...".
		if (global.ALEditor && typeof ALEditor.registerTypes === "function") {
			ALEditor.registerTypes();
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
					'<button type="button" class="code-ide-iconbtn code-ide-newfilebtn" id="code-ide-new-file" title="New untitled slot (Shift+click to pick)">' +
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
					problems_panel_markup() +
					statusbar_markup() +
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
					'<label class="code-ide-settings-row code-ide-settings-check"><input type="checkbox" id="code-ide-typecheck" checked /> Type checking</label>' +
					'<label class="code-ide-settings-row code-ide-settings-check"><input type="checkbox" id="code-ide-linting" checked /> Linting (ESLint)</label>' +
					'<label class="code-ide-settings-row code-ide-settings-check"><input type="checkbox" id="code-ide-spellcheck" checked /> Spell check</label>' +
					'<div class="code-ide-settings-row code-ide-spell-langs" id="code-ide-spell-langs">' +
					'<span class="code-ide-settings-label">Spell languages <span style="opacity:0.7">(loads only when checked)</span></span>' +
					'<label class="code-ide-settings-check"><input type="checkbox" data-lang="en" checked /> English</label>' +
					'<label class="code-ide-settings-check"><input type="checkbox" data-lang="nl" /> Dutch</label>' +
					'<label class="code-ide-settings-check"><input type="checkbox" data-lang="de" /> German</label>' +
					'<label class="code-ide-settings-check"><input type="checkbox" data-lang="fr" /> French</label>' +
					"</div>" +
					'<label class="code-ide-settings-row code-ide-settings-check"><input type="checkbox" id="code-ide-formatting" checked /> Formatting (Prettier)</label>' +
					'<label class="code-ide-settings-row code-ide-settings-check"><input type="checkbox" id="code-ide-format-onsave" /> Format on save</label>' +
					'<label class="code-ide-settings-row">Semicolons<select id="code-ide-prettier-semi">' +
					'<option value="true">Always</option><option value="false">Avoid</option></select></label>' +
					'<label class="code-ide-settings-row">Quotes<select id="code-ide-prettier-quotes">' +
					'<option value="false">Double</option><option value="true">Single</option></select></label>' +
					'<label class="code-ide-settings-row">Tab width<select id="code-ide-prettier-tabwidth">' +
					'<option value="2">2</option><option value="4">4</option></select></label>' +
					'<details class="code-ide-settings-advanced">' +
					"<summary>Advanced lint / format JSON</summary>" +
					'<label class="code-ide-settings-row">Prettier options<textarea id="code-ide-prettier-json" rows="5" spellcheck="false"></textarea></label>' +
					'<label class="code-ide-settings-row">ESLint rule overrides<textarea id="code-ide-eslint-json" rows="5" spellcheck="false" placeholder=\'e.g. { "eqeqeq": "off", "no-var": "error" }\'></textarea></label>' +
					'<button type="button" class="code-ide-textbtn" id="code-ide-diag-reset">Reset lint/format defaults</button>' +
					"</details>" +
					'<div class="code-ide-settings-hint">Ctrl/Cmd+Shift+I formats · F8 next problem</div>' +
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
				save_as();
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
				toggle_settings_panel();
			});
			bind_settings_controls();
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
			$("#code-ide-tabs").before('<button type="button" class="code-ide-iconbtn" id="code-ide-toggle-sidebar" title="Toggle Sidebar">⧉</button>');
			$("#code-ide-toggle-sidebar").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				explorer_collapsed = !explorer_collapsed;
				$ui.toggleClass("explorer-collapsed", explorer_collapsed);
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
					'<button type="button" class="code-ide-iconbtn code-ide-newfilebtn" id="code-ide-new-file" title="New untitled slot (Shift+click to pick)">' +
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
				'<button type="button" class="code-ide-iconbtn code-ide-newfilebtn" id="code-ide-new-file" title="New untitled slot (Shift+click to pick)">' +
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
		ensure_settings_dom();
		sync_settings_ui();

		var $host = $ui.find(".monaco-editor-host.maincode").first();
		if ($host.length && !$host.parent().is("#code-ide-editor-slot")) {
			$("#code-ide-editor-slot").append($host);
		}
		$ui.addClass("has-explorer");
		$ui.toggleClass("explorer-collapsed", explorer_collapsed);
		ensure_global_shortcuts();
		ensure_problems_panel();
		apply_chrome_theme();
	}

	function ensure_global_shortcuts() {
		if ($(document).data("al-code-keys")) return;
		$(document).data("al-code-keys", 1);
		$(document).on("keydown.alcodekeys", function (e) {
			if (!global.code) return;
			var $t = $(e.target);
			if ($t.is("input, textarea, select") && !$t.closest("#codeui").length) return;

			// F8 / Shift+F8 — next / previous problem (Monaco marker actions)
			if (e.key === "F8" || e.keyCode === 119) {
				e.preventDefault();
				goto_next_problem(!!e.shiftKey);
				return;
			}

			var mod = e.ctrlKey || e.metaKey;
			if (!mod) return;

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
				save_as();
				return;
			}
			if (key === "enter" && !e.shiftKey) {
				e.preventDefault();
				toggle_play();
			}
		});
	}

	function ensure_diag_settings_controls() {
		var $panel = $("#code-ide-settings-panel");
		if (!$panel.length) return;
		if (!$("#code-ide-typecheck").length) {
			$panel
				.find(".code-ide-settings-hint")
				.before(
					'<label class="code-ide-settings-row code-ide-settings-check"><input type="checkbox" id="code-ide-typecheck" checked /> Type checking</label>' +
						'<label class="code-ide-settings-row code-ide-settings-check"><input type="checkbox" id="code-ide-linting" checked /> Linting (ESLint)</label>' +
						'<label class="code-ide-settings-row code-ide-settings-check"><input type="checkbox" id="code-ide-spellcheck" checked /> Spell check</label>' +
						'<div class="code-ide-settings-row code-ide-spell-langs" id="code-ide-spell-langs">' +
						'<span class="code-ide-settings-label">Spell languages <span style="opacity:0.7">(loads only when checked)</span></span>' +
						'<label class="code-ide-settings-check"><input type="checkbox" data-lang="en" checked /> English</label>' +
						'<label class="code-ide-settings-check"><input type="checkbox" data-lang="nl" /> Dutch</label>' +
						'<label class="code-ide-settings-check"><input type="checkbox" data-lang="de" /> German</label>' +
						'<label class="code-ide-settings-check"><input type="checkbox" data-lang="fr" /> French</label>' +
						"</div>",
				);
		}
		if (!$("#code-ide-spell-langs").length && $("#code-ide-spellcheck").length) {
			$("#code-ide-spellcheck")
				.closest("label")
				.after(
					'<div class="code-ide-settings-row code-ide-spell-langs" id="code-ide-spell-langs">' +
						'<span class="code-ide-settings-label">Spell languages <span style="opacity:0.7">(loads only when checked)</span></span>' +
						'<label class="code-ide-settings-check"><input type="checkbox" data-lang="en" checked /> English</label>' +
						'<label class="code-ide-settings-check"><input type="checkbox" data-lang="nl" /> Dutch</label>' +
						'<label class="code-ide-settings-check"><input type="checkbox" data-lang="de" /> German</label>' +
						'<label class="code-ide-settings-check"><input type="checkbox" data-lang="fr" /> French</label>' +
						"</div>",
				);
		}
		if (!$("#code-ide-formatting").length) {
			var $anchor = $("#code-ide-spell-langs").length
				? $("#code-ide-spell-langs")
				: $("#code-ide-spellcheck").length
					? $("#code-ide-spellcheck").closest("label")
					: $panel.find(".code-ide-settings-hint");
			$anchor.after(
				'<label class="code-ide-settings-row code-ide-settings-check"><input type="checkbox" id="code-ide-formatting" checked /> Formatting (Prettier)</label>' +
					'<label class="code-ide-settings-row code-ide-settings-check"><input type="checkbox" id="code-ide-format-onsave" /> Format on save</label>' +
					'<label class="code-ide-settings-row">Semicolons<select id="code-ide-prettier-semi">' +
					'<option value="true">Always</option><option value="false">Avoid</option></select></label>' +
					'<label class="code-ide-settings-row">Quotes<select id="code-ide-prettier-quotes">' +
					'<option value="false">Double</option><option value="true">Single</option></select></label>' +
					'<label class="code-ide-settings-row">Tab width<select id="code-ide-prettier-tabwidth">' +
					'<option value="2">2</option><option value="4">4</option></select></label>' +
					'<details class="code-ide-settings-advanced">' +
					"<summary>Advanced lint / format JSON</summary>" +
					'<label class="code-ide-settings-row">Prettier options<textarea id="code-ide-prettier-json" rows="5" spellcheck="false"></textarea></label>' +
					'<label class="code-ide-settings-row">ESLint rule overrides<textarea id="code-ide-eslint-json" rows="5" spellcheck="false"></textarea></label>' +
					'<button type="button" class="code-ide-textbtn" id="code-ide-diag-reset">Reset lint/format defaults</button>' +
					"</details>",
			);
		}
	}

	function bind_diag_toggles() {
		$("#code-ide-typecheck")
			.off("change.aldiag")
			.on("change.aldiag", function () {
				apply_editor_prefs({ typeChecking: $(this).is(":checked") });
			});
		$("#code-ide-linting")
			.off("change.aldiag")
			.on("change.aldiag", function () {
				apply_editor_prefs({ linting: $(this).is(":checked") });
			});
		$("#code-ide-spellcheck")
			.off("change.aldiag")
			.on("change.aldiag", function () {
				apply_editor_prefs({ spellCheck: $(this).is(":checked") });
			});
		$("#code-ide-spell-langs")
			.off("change.aldiag")
			.on("change.aldiag", "input[data-lang]", function () {
				var langs = [];
				$("#code-ide-spell-langs input[data-lang]").each(function () {
					if ($(this).is(":checked")) langs.push($(this).attr("data-lang"));
				});
				if (!langs.length) {
					langs = ["en"];
					$('#code-ide-spell-langs input[data-lang="en"]').prop("checked", true);
				}
				apply_editor_prefs({ spellLanguages: langs });
			});
		$("#code-ide-formatting")
			.off("change.aldiag")
			.on("change.aldiag", function () {
				apply_editor_prefs({ formatting: $(this).is(":checked") });
			});
		$("#code-ide-format-onsave")
			.off("change.aldiag")
			.on("change.aldiag", function () {
				apply_editor_prefs({ formatOnSave: $(this).is(":checked") });
			});
		$("#code-ide-prettier-semi")
			.off("change.aldiag")
			.on("change.aldiag", function () {
				apply_editor_prefs({ prettier: { semi: $(this).val() === "true" } });
			});
		$("#code-ide-prettier-quotes")
			.off("change.aldiag")
			.on("change.aldiag", function () {
				apply_editor_prefs({ prettier: { singleQuote: $(this).val() === "true" } });
			});
		$("#code-ide-prettier-tabwidth")
			.off("change.aldiag")
			.on("change.aldiag", function () {
				apply_editor_prefs({ prettier: { tabWidth: parseInt($(this).val(), 10) || 4 } });
			});
		$("#code-ide-prettier-json")
			.off("change.aldiag blur.aldiag")
			.on("change.aldiag blur.aldiag", function () {
				try {
					var obj = JSON.parse($(this).val() || "{}");
					if (obj && typeof obj === "object" && !Array.isArray(obj)) apply_editor_prefs({ prettier: obj });
					else if (typeof global.add_log === "function") add_log("Prettier JSON must be an object", "#E69635");
				} catch (e) {
					if (typeof global.add_log === "function") add_log("Invalid Prettier JSON", "#E69635");
				}
			});
		$("#code-ide-eslint-json")
			.off("change.aldiag blur.aldiag")
			.on("change.aldiag blur.aldiag", function () {
				try {
					var obj = JSON.parse($(this).val() || "{}");
					if (obj && typeof obj === "object" && !Array.isArray(obj)) apply_editor_prefs({ eslintRules: obj });
					else if (typeof global.add_log === "function") add_log("ESLint JSON must be an object", "#E69635");
				} catch (e) {
					if (typeof global.add_log === "function") add_log("Invalid ESLint rules JSON", "#E69635");
				}
			});
		$("#code-ide-diag-reset")
			.off("click.aldiag")
			.on("click.aldiag", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				apply_editor_prefs({
					prettier: {
						semi: true,
						singleQuote: false,
						tabWidth: 4,
						useTabs: false,
						trailingComma: "es5",
						printWidth: 100,
						bracketSpacing: true,
						arrowParens: "always",
					},
					eslintRules: {},
					formatting: true,
					formatOnSave: false,
				});
				sync_settings_ui();
			});
	}

	function bind_settings_controls() {
		bind_diag_toggles();
		if ($("#code-ide-settings-panel").data("al-bound")) return;
		$("#code-ide-settings-panel").data("al-bound", 1);
		$("#code-ide-theme")
			.off("change.aldiag")
			.on("change.aldiag", function () {
				apply_editor_prefs({ theme: $(this).val() });
			});
		$("#code-ide-font")
			.off("change.aldiag")
			.on("change.aldiag", function () {
				var v = $(this).val();
				$(".code-ide-font-custom").toggle(v === "custom");
				if (v === "custom") {
					$("#code-ide-font-custom").focus();
					return;
				}
				apply_editor_prefs({ fontFamily: v });
			});
		$("#code-ide-font-custom")
			.off("change.aldiag blur.aldiag")
			.on("change.aldiag blur.aldiag", function () {
				var v = ($(this).val() || "").trim();
				if (v) apply_editor_prefs({ fontFamily: v });
			});
		$("#code-ide-fontsize")
			.off("input.aldiag change.aldiag")
			.on("input.aldiag change.aldiag", function () {
				var n = parseInt($(this).val(), 10);
				$("#code-ide-fontsize-val").text(String(n));
				apply_editor_prefs({ fontSize: n });
			});
	}

	function problems_panel_markup() {
		return (
			'<div id="code-ide-problems" class="collapsed view-tree tab-problems">' +
			'<div class="code-ide-problems-bar">' +
			'<button type="button" class="code-ide-problems-header" id="code-ide-problems-toggle" title="Toggle panel">' +
			'<span class="code-ide-problems-chevron" aria-hidden="true">▾</span>' +
			"</button>" +
			'<div class="code-ide-problems-tabs" role="tablist">' +
			'<button type="button" class="code-ide-problems-tab active" data-tab="problems" role="tab" aria-selected="true">' +
			'Problems <span class="code-ide-problems-tab-badge" id="code-ide-problems-badge">0</span>' +
			"</button>" +
			'<button type="button" class="code-ide-problems-tab" data-tab="spell" role="tab" aria-selected="false">' +
			'Spell Checker <span class="code-ide-problems-tab-badge" id="code-ide-spell-badge">0</span>' +
			"</button>" +
			"</div>" +
			'<div class="code-ide-problems-tools">' +
			'<button type="button" class="code-ide-textbtn" id="code-ide-problems-fix-all" title="Fix all auto-fixable ESLint problems">Fix all</button>' +
			'<input type="search" id="code-ide-problems-filter" placeholder="Filter…" autocomplete="off" spellcheck="false" />' +
			'<div class="code-ide-problems-filter-wrap">' +
			'<button type="button" class="code-ide-iconbtn" id="code-ide-problems-filter-btn" title="Filter options">▽</button>' +
			'<div id="code-ide-problems-filter-menu" class="code-ide-problems-menu" hidden>' +
			'<label class="code-ide-problems-menu-row"><input type="checkbox" id="code-ide-problems-show-errors" checked /> Show Errors</label>' +
			'<label class="code-ide-problems-menu-row"><input type="checkbox" id="code-ide-problems-show-warnings" checked /> Show Warnings</label>' +
			'<label class="code-ide-problems-menu-row"><input type="checkbox" id="code-ide-problems-show-infos" checked /> Show Infos</label>' +
			'<div class="code-ide-problems-menu-sep"></div>' +
			'<label class="code-ide-problems-menu-row"><input type="checkbox" id="code-ide-problems-active-only" /> Show Active File Only</label>' +
			"</div>" +
			"</div>" +
			'<button type="button" class="code-ide-iconbtn" id="code-ide-problems-view" title="View as table">☰</button>' +
			'<button type="button" class="code-ide-iconbtn" id="code-ide-problems-collapse-all" title="Collapse All">⊟</button>' +
			"</div>" +
			"</div>" +
			'<div class="code-ide-problems-body">' +
			'<div class="code-ide-problems-list" id="code-ide-problems-list"></div>' +
			"</div>" +
			"</div>"
		);
	}

	function statusbar_markup() {
		return (
			'<div id="code-ide-statusbar">' +
			'<button type="button" class="code-ide-sb-item code-ide-sb-problems" id="code-ide-sb-problems" title="Problems">' +
			'<span class="code-ide-sb-err" id="code-ide-sb-err">0</span>' +
			'<span class="code-ide-sb-warn" id="code-ide-sb-warn">0</span>' +
			"</button>" +
			'<button type="button" class="code-ide-sb-item code-ide-sb-spell" id="code-ide-sb-spell" title="Spell Checker">' +
			'<span class="code-ide-sb-info" id="code-ide-sb-info">0</span>' +
			"</button>" +
			'<span class="code-ide-sb-item" id="code-ide-sb-pos">Ln 1, Col 1</span>' +
			'<span class="code-ide-sb-item" id="code-ide-sb-indent">Spaces: 4</span>' +
			'<span class="code-ide-sb-item" id="code-ide-sb-lang">JavaScript</span>' +
			'<span class="code-ide-sb-item" id="code-ide-sb-prettier" title="Formatting">Prettier</span>' +
			"</div>"
		);
	}

	function ensure_problems_panel() {
		if (!$("#code-ide-main").length) return;
		if (!$("#code-ide-problems").length) {
			$("#code-ide-editor-slot").after(problems_panel_markup());
		} else if (!$("#code-ide-problems-filter").length || !$(".code-ide-problems-tabs").length) {
			$("#code-ide-problems").replaceWith(problems_panel_markup());
			$("#code-ide-problems").data("al-bound", 0);
		}
		if (!$("#code-ide-statusbar").length) {
			$("#code-ide-problems").after(statusbar_markup());
		}
		if (!$("#code-ide-problems").data("al-bound")) {
			$("#code-ide-problems").data("al-bound", 1);
			$("#code-ide-problems-toggle").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				$("#code-ide-problems").toggleClass("collapsed");
				layout_editor();
			});
			$("#code-ide-problems-list").on("click", ".code-ide-problem-row", function () {
				goto_problem_row($(this));
			});
			$("#code-ide-problems-list").on("click", ".code-ide-problem-code-link", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				if (e && e.preventDefault) e.preventDefault();
				var href = $(this).attr("data-href");
				if (href) {
					try {
						if (global.open) global.open(href, "_blank");
					} catch (err) {}
				}
			});
			$("#code-ide-problems-list").on("click", ".code-ide-problem-file", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				var key = $(this).attr("data-file");
				if (!key) return;
				problems_collapsed_files[key] = !problems_collapsed_files[key];
				refresh_problems_panel();
			});
			$(".code-ide-problems-tabs").on("click", ".code-ide-problems-tab", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				var tab = $(this).attr("data-tab") || "problems";
				set_problems_panel_tab(tab);
			});
			$("#code-ide-problems-fix-all").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				var mapi = monaco_api();
				var model = mapi && mapi.getModel && mapi.getModel();
				if (!model) return;
				if (global.ALEditor && typeof ALEditor.fixEslint === "function") {
					ALEditor.fixEslint(model);
				}
			});
			$("#code-ide-problems-filter").on("input", function () {
				problems_filter = String($(this).val() || "");
				refresh_problems_panel();
			});
			$("#code-ide-problems-filter-btn").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				var $m = $("#code-ide-problems-filter-menu");
				$m.prop("hidden", !$m.prop("hidden"));
			});
			$("#code-ide-problems-show-errors").on("change", function () {
				problems_show_errors = $(this).is(":checked");
				refresh_problems_panel();
			});
			$("#code-ide-problems-show-warnings").on("change", function () {
				problems_show_warnings = $(this).is(":checked");
				refresh_problems_panel();
			});
			$("#code-ide-problems-show-infos").on("change", function () {
				problems_show_infos = $(this).is(":checked");
				refresh_problems_panel();
			});
			$("#code-ide-problems-active-only").on("change", function () {
				problems_active_only = $(this).is(":checked");
				refresh_problems_panel();
			});
			$("#code-ide-problems-view").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				problems_view = problems_view === "tree" ? "table" : "tree";
				$("#code-ide-problems").toggleClass("view-tree", problems_view === "tree");
				$("#code-ide-problems").toggleClass("view-table", problems_view === "table");
				$(this).attr("title", problems_view === "tree" ? "View as table" : "View as tree");
				refresh_problems_panel();
			});
			$("#code-ide-problems-collapse-all").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				var markers = collect_code_markers();
				var seen = {};
				for (var i = 0; i < markers.length; i++) {
					var k = problems_group_key(markers[i].resource);
					seen[k] = true;
				}
				for (var fk in seen) {
					if (Object.prototype.hasOwnProperty.call(seen, fk)) problems_collapsed_files[fk] = true;
				}
				refresh_problems_panel();
			});
			$("#code-ide-sb-problems").on("click", function () {
				set_problems_panel_tab("problems");
				$("#code-ide-problems").removeClass("collapsed");
				layout_editor();
			});
			$("#code-ide-sb-spell").on("click", function () {
				set_problems_panel_tab("spell");
				$("#code-ide-problems").removeClass("collapsed");
				layout_editor();
			});
			$(document)
				.off("mousedown.alproblemsmenu")
				.on("mousedown.alproblemsmenu", function (e) {
					if ($(e.target).closest("#code-ide-problems-filter-menu, #code-ide-problems-filter-btn").length) return;
					$("#code-ide-problems-filter-menu").prop("hidden", true);
				});
			if (global.monaco && typeof monaco.editor.onDidChangeMarkers === "function") {
				monaco.editor.onDidChangeMarkers(function () {
					refresh_problems_panel();
				});
			}
			refresh_problems_panel();
			update_statusbar();
		}
		ensure_statusbar_cursor();
	}

	function ensure_statusbar_cursor() {
		var mapi = monaco_api();
		if (!mapi || statusbar_cursor_bound) return;
		statusbar_cursor_bound = true;
		mapi.onDidChangeCursorPosition(function () {
			update_statusbar();
		});
		mapi.onDidChangeCursorSelection(function () {
			update_statusbar();
		});
	}

	function update_statusbar() {
		var mapi = monaco_api();
		var prefs = editor && editor.getPrefs ? editor.getPrefs() : global.ALEditor && ALEditor.getPrefs ? ALEditor.getPrefs() : {};
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
		$("#code-ide-sb-lang").text(is_type_tab(get_slot()) ? "TypeScript" : "JavaScript");
		$("#code-ide-sb-prettier").toggleClass("off", prefs.formatting === false);
		$("#code-ide-sb-prettier").attr("title", prefs.formatting === false ? "Formatting off" : "Prettier formatting on");
	}

	function model_uri_string(uri) {
		if (!uri) return "";
		if (typeof uri === "string") return uri;
		try {
			if (typeof uri.toString === "function") return uri.toString();
		} catch (e) {}
		return String(uri);
	}

	function slot_label_for_uri(uri) {
		var slot = find_slot_for_uri(uri);
		if (slot != null) {
			var entry = global.X && X.codes ? X.codes[slot_key(slot)] : null;
			return slot_label(slot, entry);
		}
		var u = model_uri_string(uri);
		var path = "";
		try {
			if (uri && typeof uri === "object" && uri.path) path = String(uri.path);
		} catch (e) {}
		var hay = path || u;
		var m = hay.match(/\/slots\/([^/]*)\.js$/i);
		if (m) {
			var raw = m[1] || "";
			if (!raw) return "Untitled.js";
			try {
				return decodeURIComponent(raw) + ".js";
			} catch (err) {
				return raw + ".js";
			}
		}
		if (u.indexOf("ts:adventureland/") === 0) return u.replace(/^ts:adventureland\//, "");
		var leaf = hay.split("/").pop() || u.split("/").pop() || u;
		return leaf || "unknown";
	}

	function problems_group_key(uri) {
		return model_uri_string(uri) || slot_label_for_uri(uri);
	}

	function set_problems_panel_tab(tab) {
		problems_panel_tab = tab === "spell" ? "spell" : "problems";
		$("#code-ide-problems").toggleClass("tab-problems", problems_panel_tab === "problems");
		$("#code-ide-problems").toggleClass("tab-spell", problems_panel_tab === "spell");
		$(".code-ide-problems-tab").each(function () {
			var on = $(this).attr("data-tab") === problems_panel_tab;
			$(this).toggleClass("active", on);
			$(this).attr("aria-selected", on ? "true" : "false");
		});
		$("#code-ide-problems-fix-all").toggle(problems_panel_tab === "problems");
		refresh_problems_panel();
	}

	function is_spell_marker(mk) {
		var src = (mk && (mk.source || mk.owner)) || "";
		return src === "cspell";
	}

	function collect_code_markers(tab) {
		if (!global.monaco) return [];
		tab = tab || problems_panel_tab;
		var all = monaco.editor.getModelMarkers({}) || [];
		var out = [];
		var activeUri = "";
		var mapi = monaco_api();
		if (mapi && mapi.getModel && mapi.getModel()) activeUri = String(mapi.getModel().uri);
		for (var i = 0; i < all.length; i++) {
			var mk = all[i];
			var uri = mk.resource ? String(mk.resource) : "";
			if (uri.indexOf("ts:adventureland/") === 0) continue;
			if (uri.indexOf("al-type:") === 0) continue;
			var spell = is_spell_marker(mk);
			if (tab === "spell") {
				if (!spell) continue;
			} else if (spell) {
				continue;
			}
			if (problems_active_only && activeUri && uri !== activeUri) continue;
			var rank = severity_rank(mk.severity);
			if (tab !== "spell") {
				if (rank >= 3 && !problems_show_errors) continue;
				if (rank === 2 && !problems_show_warnings) continue;
				if (rank <= 1 && !problems_show_infos) continue;
			}
			if (problems_filter) {
				var hay = ((mk.message || "") + " " + (mk.source || "") + " " + (mk.code || "") + " " + slot_label_for_uri(uri)).toLowerCase();
				if (typeof mk.code === "object" && mk.code.value != null) {
					hay += " " + String(mk.code.value).toLowerCase();
				}
				if (hay.indexOf(problems_filter.toLowerCase()) === -1) continue;
			}
			out.push(mk);
		}
		out.sort(function (a, b) {
			var ua = String(a.resource);
			var ub = String(b.resource);
			if (ua !== ub) return ua < ub ? -1 : 1;
			if (a.startLineNumber !== b.startLineNumber) return a.startLineNumber - b.startLineNumber;
			return a.startColumn - b.startColumn;
		});
		return out;
	}

	function severity_rank(sev) {
		if (!global.monaco) return 0;
		if (sev === monaco.MarkerSeverity.Error) return 3;
		if (sev === monaco.MarkerSeverity.Warning) return 2;
		if (sev === monaco.MarkerSeverity.Info) return 1;
		return 0;
	}

	function severity_class(sev) {
		var r = severity_rank(sev);
		if (r >= 3) return "error";
		if (r === 2) return "warning";
		return "info";
	}

	function marker_code(m) {
		if (m.code == null || m.code === "") return "";
		if (typeof m.code === "object" && m.code.value != null) return String(m.code.value);
		return String(m.code);
	}

	function marker_code_html(m) {
		var code = marker_code(m);
		if (!code) return "";
		var src = m.source || m.owner || "";
		var safe = $("<div/>").text(code).html();
		if (src === "eslint" && code.indexOf("/") === -1) {
			var href = "https://eslint.org/docs/latest/rules/" + encodeURIComponent(code);
			return (
				'<span class="code-ide-problem-code code-ide-problem-code-link" role="link" tabindex="0" data-href="' + $("<div/>").text(href).html() + '" title="Open ESLint rule docs">' + safe + "</span>"
			);
		}
		return '<span class="code-ide-problem-code">' + safe + "</span>";
	}

	function problem_row_attrs(m) {
		return (
			' data-uri="' +
			$("<div/>").text(String(m.resource)).html() +
			'" data-line="' +
			m.startLineNumber +
			'" data-col="' +
			m.startColumn +
			'" data-eline="' +
			m.endLineNumber +
			'" data-ecol="' +
			m.endColumn +
			'"'
		);
	}

	function refresh_problems_panel() {
		var $list = $("#code-ide-problems-list");
		if (!$list.length) return;
		var codeMarkers = collect_code_markers("problems");
		var spellMarkers = collect_code_markers("spell");
		var markers = problems_panel_tab === "spell" ? spellMarkers : codeMarkers;
		var errors = 0;
		var warnings = 0;
		for (var i = 0; i < codeMarkers.length; i++) {
			var r = severity_rank(codeMarkers[i].severity);
			if (r >= 3) errors++;
			else if (r === 2) warnings++;
		}
		$("#code-ide-problems-badge").text(String(codeMarkers.length));
		$("#code-ide-spell-badge").text(String(spellMarkers.length));
		$("#code-ide-sb-err").text(String(errors));
		$("#code-ide-sb-warn").text(String(warnings));
		$("#code-ide-sb-info").text(String(spellMarkers.length));
		$("#code-ide-problems").toggleClass("view-tree", problems_view === "tree");
		$("#code-ide-problems").toggleClass("view-table", problems_view === "table");
		$("#code-ide-problems").toggleClass("tab-problems", problems_panel_tab === "problems");
		$("#code-ide-problems").toggleClass("tab-spell", problems_panel_tab === "spell");
		$("#code-ide-problems-fix-all").toggle(problems_panel_tab === "problems");

		var emptyMsg = problems_panel_tab === "spell" ? "No spelling issues in open editors." : "No problems in open editors.";
		var html = "";
		if (!markers.length) {
			html = '<div class="code-ide-problems-empty">' + emptyMsg + "</div>";
			$list.html(html);
			update_statusbar();
			return;
		}

		if (problems_view === "table") {
			html +=
				'<div class="code-ide-problems-table-head">' +
				'<span class="col-code">Code</span><span class="col-msg">Message</span><span class="col-file">File</span><span class="col-src">Source</span><span class="col-pos">Location</span>' +
				"</div>";
			for (var t = 0; t < markers.length; t++) {
				var tm = markers[t];
				var tsrc = tm.source || tm.owner || "";
				var tfile = slot_label_for_uri(tm.resource);
				html +=
					'<button type="button" class="code-ide-problem-row table-row sev-' +
					severity_class(tm.severity) +
					'"' +
					problem_row_attrs(tm) +
					">" +
					'<span class="code-ide-problem-sev"></span>' +
					'<span class="col-code">' +
					(marker_code_html(tm) || "—") +
					"</span>" +
					'<span class="col-msg">' +
					$("<div/>")
						.text(tm.message || "")
						.html() +
					"</span>" +
					'<span class="col-file">' +
					$("<div/>").text(tfile).html() +
					"</span>" +
					'<span class="col-src">' +
					$("<div/>").text(tsrc).html() +
					"</span>" +
					'<span class="col-pos">[Ln ' +
					tm.startLineNumber +
					", Col " +
					tm.startColumn +
					"]</span>" +
					"</button>";
			}
		} else {
			var groups = {};
			var order = [];
			var labels = {};
			for (var j = 0; j < markers.length; j++) {
				var m = markers[j];
				var gkey = problems_group_key(m.resource);
				if (!groups[gkey]) {
					groups[gkey] = [];
					order.push(gkey);
					labels[gkey] = slot_label_for_uri(m.resource);
				}
				groups[gkey].push(m);
			}
			for (var g = 0; g < order.length; g++) {
				var gkey2 = order[g];
				var items = groups[gkey2];
				var fname = labels[gkey2] || gkey2;
				var collapsed = !!problems_collapsed_files[gkey2];
				html +=
					'<button type="button" class="code-ide-problem-file' +
					(collapsed ? " collapsed" : "") +
					'" data-file="' +
					$("<div/>").text(gkey2).html() +
					'">' +
					'<span class="code-ide-problem-file-chevron">' +
					(collapsed ? "▸" : "▾") +
					"</span>" +
					'<span class="code-ide-problem-file-name">' +
					$("<div/>").text(fname).html() +
					"</span>" +
					'<span class="code-ide-problem-file-count">' +
					items.length +
					"</span>" +
					"</button>";
				if (collapsed) continue;
				for (var k = 0; k < items.length; k++) {
					var im = items[k];
					var isrc = im.source || im.owner || "";
					html +=
						'<button type="button" class="code-ide-problem-row tree-row sev-' +
						severity_class(im.severity) +
						'"' +
						problem_row_attrs(im) +
						">" +
						'<span class="code-ide-problem-sev"></span>' +
						'<span class="code-ide-problem-msg">' +
						$("<div/>")
							.text(im.message || "")
							.html() +
						"</span>" +
						marker_code_html(im) +
						(isrc ? '<span class="code-ide-problem-src">' + $("<div/>").text(isrc).html() + "</span>" : "") +
						'<span class="code-ide-problem-pos">[Ln ' +
						im.startLineNumber +
						", Col " +
						im.startColumn +
						"]</span>" +
						"</button>";
				}
			}
		}
		$list.html(html);
		update_statusbar();
	}

	function find_slot_for_uri(uri) {
		var u = model_uri_string(uri);
		var path = "";
		try {
			if (uri && typeof uri === "object" && uri.path) path = String(uri.path);
		} catch (e) {}
		for (var s in models) {
			if (!Object.prototype.hasOwnProperty.call(models, s)) continue;
			if (!models[s]) continue;
			var mu = model_uri_string(models[s].uri);
			if (mu === u) return s;
			try {
				if (path && models[s].uri && models[s].uri.path && String(models[s].uri.path) === path) return s;
			} catch (err) {}
		}
		for (var t in type_tab_models) {
			if (!Object.prototype.hasOwnProperty.call(type_tab_models, t)) continue;
			if (!type_tab_models[t]) continue;
			if (model_uri_string(type_tab_models[t].uri) === u) return t;
		}
		// Recover slot id from URI when models map missed the match.
		var hay = path || u;
		var m = hay.match(/\/slots\/([^/]+)\.js$/i);
		if (m && m[1]) {
			try {
				return decodeURIComponent(m[1]);
			} catch (e2) {
				return m[1];
			}
		}
		return null;
	}

	function goto_problem_row($row) {
		if (!$row || !$row.length || !global.monaco) return;
		var uri = $row.attr("data-uri");
		var line = parseInt($row.attr("data-line"), 10) || 1;
		var col = parseInt($row.attr("data-col"), 10) || 1;
		var eline = parseInt($row.attr("data-eline"), 10) || line;
		var ecol = parseInt($row.attr("data-ecol"), 10) || col + 1;
		var slot = find_slot_for_uri(uri);
		if (slot != null) {
			activate_open_slot(slot);
		}
		var mapi = monaco_api();
		if (!mapi) return;
		mapi.setSelection(new monaco.Range(line, col, eline, ecol));
		mapi.revealLineInCenter(line);
		if (mapi.focus) mapi.focus();
		update_statusbar();
	}

	function goto_next_problem(prev) {
		var mapi = monaco_api();
		if (mapi && typeof mapi.trigger === "function") {
			mapi.trigger("keyboard", prev ? "editor.action.marker.prev" : "editor.action.marker.next", null);
			return;
		}
		var markers = collect_code_markers();
		if (!markers.length) return;
		var idx = prev ? markers.length - 1 : 0;
		var m = markers[idx];
		var $fake = $(
			'<button data-uri="' +
				String(m.resource) +
				'" data-line="' +
				m.startLineNumber +
				'" data-col="' +
				m.startColumn +
				'" data-eline="' +
				m.endLineNumber +
				'" data-ecol="' +
				m.endColumn +
				'"></button>',
		);
		goto_problem_row($fake);
	}

	function ensure_settings_dom() {
		if (!$("#code-ide-settings").length) {
			$("#code-ide-save-as").after('<button type="button" class="code-ide-iconbtn" id="code-ide-settings" title="Editor settings">⚙</button>');
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
					'<label class="code-ide-settings-row code-ide-settings-check"><input type="checkbox" id="code-ide-typecheck" checked /> Type checking</label>' +
					'<label class="code-ide-settings-row code-ide-settings-check"><input type="checkbox" id="code-ide-linting" checked /> Linting (ESLint)</label>' +
					'<label class="code-ide-settings-row code-ide-settings-check"><input type="checkbox" id="code-ide-spellcheck" checked /> Spell check</label>' +
					'<div class="code-ide-settings-row code-ide-spell-langs" id="code-ide-spell-langs">' +
					'<span class="code-ide-settings-label">Spell languages <span style="opacity:0.7">(loads only when checked)</span></span>' +
					'<label class="code-ide-settings-check"><input type="checkbox" data-lang="en" checked /> English</label>' +
					'<label class="code-ide-settings-check"><input type="checkbox" data-lang="nl" /> Dutch</label>' +
					'<label class="code-ide-settings-check"><input type="checkbox" data-lang="de" /> German</label>' +
					'<label class="code-ide-settings-check"><input type="checkbox" data-lang="fr" /> French</label>' +
					"</div>" +
					'<label class="code-ide-settings-row code-ide-settings-check"><input type="checkbox" id="code-ide-formatting" checked /> Formatting (Prettier)</label>' +
					'<label class="code-ide-settings-row code-ide-settings-check"><input type="checkbox" id="code-ide-format-onsave" /> Format on save</label>' +
					'<label class="code-ide-settings-row">Semicolons<select id="code-ide-prettier-semi">' +
					'<option value="true">Always</option><option value="false">Avoid</option></select></label>' +
					'<label class="code-ide-settings-row">Quotes<select id="code-ide-prettier-quotes">' +
					'<option value="false">Double</option><option value="true">Single</option></select></label>' +
					'<label class="code-ide-settings-row">Tab width<select id="code-ide-prettier-tabwidth">' +
					'<option value="2">2</option><option value="4">4</option></select></label>' +
					'<details class="code-ide-settings-advanced">' +
					"<summary>Advanced lint / format JSON</summary>" +
					'<label class="code-ide-settings-row">Prettier options<textarea id="code-ide-prettier-json" rows="5" spellcheck="false"></textarea></label>' +
					'<label class="code-ide-settings-row">ESLint rule overrides<textarea id="code-ide-eslint-json" rows="5" spellcheck="false"></textarea></label>' +
					'<button type="button" class="code-ide-textbtn" id="code-ide-diag-reset">Reset lint/format defaults</button>' +
					"</details>" +
					'<div class="code-ide-settings-hint">Ctrl/Cmd+Shift+I formats · F8 next problem</div>' +
					"</div>",
			);
			bind_settings_controls();
		} else {
			ensure_diag_settings_controls();
			bind_settings_controls();
		}
		ensure_problems_panel();
		if (!$("#code-ide-editor-slot").data("al-focus-bound")) {
			$("#code-ide-editor-slot")
				.data("al-focus-bound", 1)
				.on("mousedown", function () {
					if (editor && editor.focus) editor.focus();
					toggle_settings_panel(true);
					close_save_as();
					$("#code-ide-new-slot-panel").remove();
				});
		}
		if (!$(document).data("al-code-settings-doc")) {
			$(document)
				.data("al-code-settings-doc", 1)
				.on("mousedown.codeidesettings", function (e) {
					var $t = $(e.target);
					if ($t.closest("#code-ide-settings-panel, #code-ide-settings, #code-ide-save-as-panel, #code-ide-save-as, #code-ide-new-slot-panel, #code-ide-new-file").length) return;
					toggle_settings_panel(true);
					close_save_as();
					$("#code-ide-new-slot-panel").remove();
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
		$("#code-ide-typecheck").prop("checked", prefs.typeChecking !== false);
		$("#code-ide-linting").prop("checked", prefs.linting !== false);
		$("#code-ide-spellcheck").prop("checked", prefs.spellCheck !== false);
		var spellLangs = prefs.spellLanguages || ["en"];
		$("#code-ide-spell-langs input[data-lang]").each(function () {
			var id = $(this).attr("data-lang");
			$(this).prop("checked", spellLangs.indexOf(id) !== -1);
		});
		$("#code-ide-formatting").prop("checked", prefs.formatting !== false);
		$("#code-ide-format-onsave").prop("checked", !!prefs.formatOnSave);
		var pr = prefs.prettier || {};
		$("#code-ide-prettier-semi").val(pr.semi === false ? "false" : "true");
		$("#code-ide-prettier-quotes").val(pr.singleQuote ? "true" : "false");
		$("#code-ide-prettier-tabwidth").val(String(pr.tabWidth === 2 ? 2 : 4));
		try {
			$("#code-ide-prettier-json").val(JSON.stringify(pr, null, 2));
		} catch (e1) {}
		try {
			$("#code-ide-eslint-json").val(JSON.stringify(prefs.eslintRules || {}, null, 2));
		} catch (e2) {}
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
		update_statusbar();
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
		if (is_type_tab(get_slot())) {
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
		if (global.ALEditor && typeof ALEditor.attachModelDiagnostics === "function") {
			ALEditor.attachModelDiagnostics(models[s]);
		}
		return models[s];
	}

	function set_active_model(slot, model) {
		var mapi = monaco_api();
		if (!mapi || !model) return;
		applying_model = true;
		mapi.setModel(model);
		mapi.updateOptions({ readOnly: false, domReadOnly: false });
		applying_model = false;
		set_slot(slot);
		global.code_change = is_dirty(slot);
		ensure_tab(slot);
		refresh_chrome();
		layout_editor();
		ensure_statusbar_cursor();
		if (problems_active_only) refresh_problems_panel();
		else update_statusbar();
	}

	function jsDocStartLine(model, declLine) {
		if (!model || !declLine || declLine < 2) return declLine || 1;
		var probe = declLine - 1;
		while (probe >= 1 && !model.getLineContent(probe).trim()) probe--;
		if (probe < 1) return declLine;
		if (model.getLineContent(probe).indexOf("*/") === -1) return declLine;
		while (probe >= 1) {
			var lt = model.getLineContent(probe).trim();
			if (lt.indexOf("/**") !== -1 || lt.indexOf("/*") === 0) return probe;
			if (lt.indexOf("*") === 0 || lt.indexOf("*/") !== -1) {
				probe--;
				continue;
			}
			break;
		}
		return declLine;
	}

	/**
	 * Open an AdventureLand ambient .d.ts model as a readonly editor tab (VS Code–like Go to Definition).
	 * @returns {boolean}
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
		var key = TYPE_TAB_PREFIX + path;
		type_tab_models[key] = model;
		ensure_tab(key);
		applying_model = true;
		mapi.setModel(model);
		mapi.updateOptions({ readOnly: true, domReadOnly: true });
		applying_model = false;
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
			mapi.revealLineNearTop(jsDocStartLine(model, range.startLineNumber));
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
		if (is_untitled(num)) return "Untitled-" + untitled_slots[slot_key(num)] + ".js";
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
		for (var i = 0; i < open_tabs.length; i++) {
			var s = open_tabs[i];
			var label, title;
			if (is_type_tab(s)) {
				label = type_tab_label(s);
				title = s.slice(TYPE_TAB_PREFIX.length) + " (read-only)";
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
		var model = ensure_model(s, models[s] ? models[s].getValue() : "", false);
		ensure_tab(s);
		set_active_model(s, model);
		setTimeout(function () {
			if (editor && editor.focus) editor.focus();
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
		// Untitled buffers may not exist in the server list — always surface them.
		for (var u in untitled_slots) {
			if (!Object.prototype.hasOwnProperty.call(untitled_slots, u) || untitled_slots[u] == null) continue;
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
			tree_folders[id] = open;
			try {
				localStorage.setItem(TREE_KEY, JSON.stringify(tree_folders));
			} catch (err) {}
		});
		$ex.find(".code-tree-row.file").on("click", function (e) {
			if ($(e.target).closest(".code-tree-delete").length) return;
			e.preventDefault();
			var slot = $(this).attr("data-slot");
			// Prefer in-memory activate so an already-open tab is selected immediately.
			if (models[slot_key(slot)] || open_tabs.indexOf(slot_key(slot)) !== -1 || is_type_tab(slot)) {
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
			(open_tabs.indexOf(slot_key(slot)) !== -1 ? " open" : "") +
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
			var tm = type_tab_models[s];
			var mapi = monaco_api();
			if (!tm || !mapi) return;
			applying_model = true;
			mapi.setModel(tm);
			mapi.updateOptions({ readOnly: true, domReadOnly: true });
			applying_model = false;
			set_slot(s);
			global.code_change = false;
			refresh_chrome();
			layout_editor();
			if (editor && editor.focus) editor.focus();
			return;
		}
		if (models[s]) {
			ensure_tab(s);
			set_active_model(s, models[s]);
			if (editor && editor.focus) editor.focus();
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
		if (models[s]) {
			ensure_tab(s);
			set_active_model(s, models[s]);
			if (editor && editor.focus) editor.focus();
			return;
		}
		if (typeof global.load_code === "function") global.load_code(num, 1);
		else api_call("load_code", { name: num, run: "", log: 1 });
	}

	function close_tab(slot) {
		var s = slot_key(slot);
		var idx = open_tabs.indexOf(s);
		if (idx === -1) return;
		if (is_untitled(s) && is_dirty(s)) {
			if (!window.confirm("Discard " + slot_label(s) + "?")) return;
		}
		open_tabs.splice(idx, 1);
		if (is_type_tab(s)) delete type_tab_models[s];
		if (is_untitled(s)) {
			clear_untitled(s);
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
		}
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
			clear_untitled(info.slot);
			clear_dirty(info.slot);
			refresh_chrome();
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
		// Keep local placeholders for open untitled slots so the tree can resolve them.
		for (var u in untitled_slots) {
			if (!Object.prototype.hasOwnProperty.call(untitled_slots, u) || untitled_slots[u] == null) continue;
			if (is_empty_entry(X.codes[u])) X.codes[u] = ["Empty", (X.codes[u] && X.codes[u][1]) || 0];
		}
		refresh_chrome();
		if (info.purpose == "save" || info.purpose == "save-pick") show_save_as(info);
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
				if (editor && editor.focus) editor.focus();
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
		var model = ensure_model(slot, code, true);
		ensure_tab(slot);
		set_active_model(slot, model);
		clear_dirty(slot);
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
		var ed = editor || global.codemirror_render;
		if (!ed || slot == null || slot === "") return;
		if (is_type_tab(slot)) {
			if (typeof global.add_log === "function") add_log("Type definitions are read-only", "gray");
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
			var idxU = open_tabs.indexOf(s);
			if (idxU !== -1) open_tabs.splice(idxU, 1);
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
				var nextU = open_tabs[0] || (global.real_id != null ? slot_key(global.real_id) : "1");
				if (models[nextU]) set_active_model(nextU, models[nextU]);
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
		open_type_definition: open_type_definition,
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
