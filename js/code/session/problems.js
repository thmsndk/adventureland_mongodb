/**
 * SlotSession problems panel (reads Monaco markers).
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
	var monaco_api = ss("monaco_api");
	var slot_key = ss("slot_key");
	var open_slot = ss("open_slot");
	var update_statusbar = ss("update_statusbar");
	var get_slot = ss("get_slot");
	var activate_open_slot = ss("activate_open_slot");

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
				S.problems_collapsed_files[key] = !S.problems_collapsed_files[key];
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
				S.problems_filter = String($(this).val() || "");
				refresh_problems_panel();
			});
			$("#code-ide-problems-filter-btn").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				var $m = $("#code-ide-problems-filter-menu");
				$m.prop("hidden", !$m.prop("hidden"));
			});
			$("#code-ide-problems-show-errors").on("change", function () {
				S.problems_show_errors = $(this).is(":checked");
				refresh_problems_panel();
			});
			$("#code-ide-problems-show-warnings").on("change", function () {
				S.problems_show_warnings = $(this).is(":checked");
				refresh_problems_panel();
			});
			$("#code-ide-problems-show-infos").on("change", function () {
				S.problems_show_infos = $(this).is(":checked");
				refresh_problems_panel();
			});
			$("#code-ide-problems-active-only").on("change", function () {
				S.problems_active_only = $(this).is(":checked");
				refresh_problems_panel();
			});
			$("#code-ide-problems-view").on("click", function (e) {
				if (e && e.stopPropagation) e.stopPropagation();
				S.problems_view = S.problems_view === "tree" ? "table" : "tree";
				$("#code-ide-problems").toggleClass("view-tree", S.problems_view === "tree");
				$("#code-ide-problems").toggleClass("view-table", S.problems_view === "table");
				$(this).attr("title", S.problems_view === "tree" ? "View as table" : "View as tree");
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
					if (Object.prototype.hasOwnProperty.call(seen, fk)) S.problems_collapsed_files[fk] = true;
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
		S.problems_panel_tab = tab === "spell" ? "spell" : "problems";
		$("#code-ide-problems").toggleClass("tab-problems", S.problems_panel_tab === "problems");
		$("#code-ide-problems").toggleClass("tab-spell", S.problems_panel_tab === "spell");
		$(".code-ide-problems-tab").each(function () {
			var on = $(this).attr("data-tab") === S.problems_panel_tab;
			$(this).toggleClass("active", on);
			$(this).attr("aria-selected", on ? "true" : "false");
		});
		$("#code-ide-problems-fix-all").toggle(S.problems_panel_tab === "problems");
		refresh_problems_panel();
	}

	function is_spell_marker(mk) {
		var src = (mk && (mk.source || mk.owner)) || "";
		return src === "cspell";
	}

	function collect_code_markers(tab) {
		if (!global.monaco) return [];
		tab = tab || S.problems_panel_tab;
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
			if (S.problems_active_only && activeUri && uri !== activeUri) continue;
			var rank = severity_rank(mk.severity);
			if (tab !== "spell") {
				if (rank >= 3 && !S.problems_show_errors) continue;
				if (rank === 2 && !S.problems_show_warnings) continue;
				if (rank <= 1 && !S.problems_show_infos) continue;
			}
			if (S.problems_filter) {
				var hay = ((mk.message || "") + " " + (mk.source || "") + " " + (mk.code || "") + " " + slot_label_for_uri(uri)).toLowerCase();
				if (typeof mk.code === "object" && mk.code.value != null) {
					hay += " " + String(mk.code.value).toLowerCase();
				}
				if (hay.indexOf(S.problems_filter.toLowerCase()) === -1) continue;
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
		var markers = S.problems_panel_tab === "spell" ? spellMarkers : codeMarkers;
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
		$("#code-ide-problems").toggleClass("view-tree", S.problems_view === "tree");
		$("#code-ide-problems").toggleClass("view-table", S.problems_view === "table");
		$("#code-ide-problems").toggleClass("tab-problems", S.problems_panel_tab === "problems");
		$("#code-ide-problems").toggleClass("tab-spell", S.problems_panel_tab === "spell");
		$("#code-ide-problems-fix-all").toggle(S.problems_panel_tab === "problems");

		var emptyMsg = S.problems_panel_tab === "spell" ? "No spelling issues in open editors." : "No problems in open editors.";
		var html = "";
		if (!markers.length) {
			html = '<div class="code-ide-problems-empty">' + emptyMsg + "</div>";
			$list.html(html);
			update_statusbar();
			return;
		}

		if (S.problems_view === "table") {
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
				var collapsed = !!S.problems_collapsed_files[gkey2];
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
		for (var s in S.models) {
			if (!Object.prototype.hasOwnProperty.call(S.models, s)) continue;
			if (!S.models[s]) continue;
			var mu = model_uri_string(S.models[s].uri);
			if (mu === u) return s;
			try {
				if (path && S.models[s].uri && S.models[s].uri.path && String(S.models[s].uri.path) === path) return s;
			} catch (err) {}
		}
		for (var t in S.type_tab_models) {
			if (!Object.prototype.hasOwnProperty.call(S.type_tab_models, t)) continue;
			if (!S.type_tab_models[t]) continue;
			if (model_uri_string(S.type_tab_models[t].uri) === u) return t;
		}
		// Recover slot id from URI when S.models map missed the match.
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

	var SlotSession = global.SlotSession || (global.SlotSession = {});
	Object.assign(SlotSession, {
		ensure_problems_panel: ensure_problems_panel,
		refresh_problems_panel: refresh_problems_panel,
		goto_next_problem: goto_next_problem,
	});
})(typeof window !== "undefined" ? window : globalThis);
