/**
 * Shared saved-snippet + execute-history helpers for the code snippet modal and ACCESS.
 * Storage is localStorage-only; keys are passed in so surfaces stay isolated.
 */
(function (global) {
	var SNIPPET_HISTORY_MAX = 20;

	function create_snippet_store(historyKey, savedKey) {
		function get_history() {
			try {
				var raw = window.localStorage.getItem(historyKey);
				return raw ? JSON.parse(raw) : [];
			} catch (e) {
				return [];
			}
		}

		function save_history(history) {
			window.localStorage.setItem(historyKey, JSON.stringify(history));
		}

		function add_to_history(snippet) {
			if (!snippet || !String(snippet).trim()) return;
			var history = get_history().filter(function (s) {
				return s !== snippet;
			});
			history.unshift(snippet);
			if (history.length > SNIPPET_HISTORY_MAX) history = history.slice(0, SNIPPET_HISTORY_MAX);
			save_history(history);
		}

		function get_saved() {
			try {
				var raw = window.localStorage.getItem(savedKey);
				return raw ? JSON.parse(raw) : [];
			} catch (e) {
				return [];
			}
		}

		function save_saved(snippets) {
			window.localStorage.setItem(savedKey, JSON.stringify(snippets));
		}

		function add_saved(name, code) {
			if (!name || !code || !String(code).trim()) return;
			var snippets = get_saved();
			var idx = -1;
			for (var i = 0; i < snippets.length; i++) {
				if (snippets[i].name === name) {
					idx = i;
					break;
				}
			}
			if (idx !== -1) snippets[idx].code = code;
			else snippets.unshift({ name: name, code: code });
			save_saved(snippets);
		}

		function delete_saved(name) {
			var snippets = get_saved().filter(function (s) {
				return s.name !== name;
			});
			save_saved(snippets);
		}

		function rename_saved(oldName, newName) {
			var snippets = get_saved();
			for (var i = 0; i < snippets.length; i++) {
				if (snippets[i].name === oldName) {
					snippets[i].name = newName;
					break;
				}
			}
			save_saved(snippets);
		}

		/**
		 * Seed named defaults. By default skips existing names.
		 * Pass { overwrite: true } to refresh code for matching names (Dev presets).
		 * @param {{name:string,code:string}[]} defaults
		 * @param {{overwrite?:boolean}} [opts]
		 */
		function seed_defaults(defaults, opts) {
			if (!defaults || !defaults.length) return;
			opts = opts || {};
			var snippets = get_saved();
			var changed = false;
			for (var j = 0; j < defaults.length; j++) {
				var d = defaults[j];
				if (!d || !d.name || !d.code) continue;
				var idx = -1;
				for (var i = 0; i < snippets.length; i++) {
					if (snippets[i].name === d.name) {
						idx = i;
						break;
					}
				}
				if (idx === -1) {
					snippets.push({ name: d.name, code: d.code });
					changed = true;
				} else if (opts.overwrite && snippets[idx].code !== d.code) {
					snippets[idx].code = d.code;
					changed = true;
				}
			}
			if (changed) save_saved(snippets);
		}

		return {
			historyKey: historyKey,
			savedKey: savedKey,
			get_history: get_history,
			add_to_history: add_to_history,
			get_saved: get_saved,
			add_saved: add_saved,
			delete_saved: delete_saved,
			rename_saved: rename_saved,
			seed_defaults: seed_defaults,
		};
	}

	function esc_text(s) {
		return $("<div/>").text(s == null ? "" : String(s)).html();
	}

	/**
	 * Wire Snippets ▼ / Save / Alt+Up/Down onto an open modal toolbar + CodeMirror.
	 * @param {{ cm: object, store: object, $toolbar: JQuery }} opts
	 */
	function wire_snippet_toolbar(opts) {
		var cm = opts.cm;
		var store = opts.store;
		var $toolbar = opts.$toolbar;
		if (!cm || !store || !$toolbar || !$toolbar.length) return;

		cm._snippetHistory = { index: -1, lastValue: "" };
		cm.on("keydown", function (cmInst, e) {
			if (!(e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown"))) return;
			var history = store.get_history();
			if (!history.length) return;
			if (cm._snippetHistory.index === -1) cm._snippetHistory.lastValue = cm.getValue();
			if (e.key === "ArrowUp") {
				cm._snippetHistory.index = Math.min(history.length - 1, cm._snippetHistory.index + 1);
			} else {
				cm._snippetHistory.index = Math.max(-1, cm._snippetHistory.index - 1);
			}
			if (cm._snippetHistory.index === -1) cm.setValue(cm._snippetHistory.lastValue);
			else cm.setValue(history[cm._snippetHistory.index]);
			e.preventDefault();
		});

		var $historyBtn = $toolbar.find(".snippet-history-btn");
		var $saveBtn = $toolbar.find(".snippet-save-btn");
		var dropdown = null;

		$saveBtn.on("click", function (e) {
			e.stopPropagation();
			var code = cm.getValue();
			if (!String(code).trim()) {
				alert("No code to save!");
				return;
			}
			var name = prompt("Name for this snippet?");
			if (name) {
				store.add_saved(name, code);
				alert("Snippet saved!");
			}
		});

		$historyBtn.on("click", function (e) {
			e.stopPropagation();
			if (dropdown) {
				dropdown.remove();
				dropdown = null;
				return;
			}
			dropdown = $(
				'<div class="snippet-history-dropdown" style="position:absolute;bottom:40px;right:0;z-index:100;background:black;border:1px solid white;max-height:320px;overflow-y:auto;width:380px;"></div>',
			);

			dropdown.append(
				'<div style="color:white;padding:4px 8px 2px 8px;font-family:Pixel;font-size:15px;border-bottom:1px solid #333;">Saved Snippets</div>',
			);
			var saved = store.get_saved();
			if (!saved.length) {
				dropdown.append('<div style="color:gray;padding:8px;font-family:Pixel;">No saved snippets</div>');
			} else {
				for (var si = 0; si < saved.length; si++) {
					(function (snippet) {
						var item = $(
							'<div style="padding:6px 8px;border-bottom:1px solid #222;cursor:pointer;font-family:Pixel;font-size:15px;white-space:pre;overflow-x:auto;max-height:60px;display:flex;align-items:center;justify-content:space-between;"></div>',
						);
						var nameSpan = $(
							'<span style="color:white;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
								esc_text(snippet.name) +
								"</span>",
						);
						var preview =
							snippet.code.length > 60 ? snippet.code.slice(0, 60) + "..." : snippet.code;
						var codeSpan = $(
							'<span style="color:#aaa;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-left:8px;">' +
								esc_text(preview) +
								"</span>",
						);
						var actions = $("<span></span>");
						var loadBtn = $('<span style="color:#4FA91D;cursor:pointer;margin-left:8px;">Load</span>');
						loadBtn.on("mousedown", function (ev) {
							ev.stopPropagation();
							cm.focus();
							cm.setValue(snippet.code);
							dropdown.remove();
							dropdown = null;
						});
						var renameBtn = $('<span style="color:#FD9610;cursor:pointer;margin-left:8px;">Rename</span>');
						renameBtn.on("mousedown", function (ev) {
							ev.stopPropagation();
							var newName = prompt("Rename snippet:", snippet.name);
							if (newName && newName !== snippet.name) {
								store.rename_saved(snippet.name, newName);
								dropdown.remove();
								dropdown = null;
							}
						});
						var delBtn = $('<span style="color:#993D42;cursor:pointer;margin-left:8px;">Delete</span>');
						delBtn.on("mousedown", function (ev) {
							ev.stopPropagation();
							if (confirm('Delete snippet "' + snippet.name + '"?')) {
								store.delete_saved(snippet.name);
								dropdown.remove();
								dropdown = null;
							}
						});
						actions.append(loadBtn, renameBtn, delBtn);
						item.append(nameSpan, codeSpan, actions);
						dropdown.append(item);
					})(saved[si]);
				}
			}

			dropdown.append(
				'<div style="color:white;padding:4px 8px 2px 8px;font-family:Pixel;font-size:15px;border-bottom:1px solid #333;margin-top:8px;">Execute History (Alt+Up/Down)</div>',
			);
			var history = store.get_history();
			if (!history.length) {
				dropdown.append('<div style="color:gray;padding:8px;font-family:Pixel;">No history</div>');
			} else {
				for (var hi = 0; hi < history.length; hi++) {
					(function (snippet) {
						var item = $(
							'<div style="padding:6px 8px;border-bottom:1px solid #222;cursor:pointer;font-family:Pixel;font-size:15px;white-space:pre;overflow-x:auto;max-height:60px;display:flex;align-items:center;justify-content:space-between;"></div>',
						);
						var preview = snippet.length > 100 ? snippet.slice(0, 100) + "..." : snippet;
						var codeSpan = $(
							'<span style="color:#aaa;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
								esc_text(preview) +
								"</span>",
						);
						var actions = $("<span></span>");
						var loadBtn = $('<span style="color:#4FA91D;cursor:pointer;margin-left:8px;">Load</span>');
						loadBtn.on("mousedown", function (ev) {
							ev.stopPropagation();
							cm.focus();
							cm.setValue(snippet);
							dropdown.remove();
							dropdown = null;
						});
						var promoteBtn = $('<span style="color:#FD9610;cursor:pointer;margin-left:8px;">Save</span>');
						promoteBtn.on("mousedown", function (ev) {
							ev.stopPropagation();
							var name = prompt("Name for this snippet?");
							if (name) {
								store.add_saved(name, snippet);
								dropdown.remove();
								dropdown = null;
								alert("Snippet saved!");
							}
						});
						actions.append(loadBtn, promoteBtn);
						item.append(codeSpan, actions);
						dropdown.append(item);
					})(history[hi]);
				}
			}

			$toolbar.append(dropdown);
			setTimeout(function () {
				$(document).one("mousedown", function () {
					if (dropdown) {
						dropdown.remove();
						dropdown = null;
					}
				});
			}, 0);
		});
	}

	function snippet_toolbar_html(executeOnclick, executeBorder, toolbarClass) {
		var border = executeBorder ? " border-color: " + executeBorder + ";" : "";
		var extra = toolbarClass ? " " + toolbarClass : "";
		return (
			'<div class="snippet-toolbar' +
			extra +
			'" style="position: absolute; bottom: -68px; right: -5px; display: flex; align-items: center; gap: 8px;">' +
			'<div class="gamebutton snippet-history-btn" style="background:black;color:white;padding:4px 12px;font-size:16px;font-family:Pixel;cursor:pointer;">Snippets ▼</div>' +
			'<div class="gamebutton snippet-save-btn" style="background:black;color:white;padding:4px 12px;font-size:16px;font-family:Pixel;cursor:pointer;">Save as Snippet</div>' +
			'<div class="gamebutton" style="padding:4px 12px;' +
			border +
			'" onclick='' +
			executeOnclick +
			"'>EXECUTE</div>" +
			"</div>"
		);
	}

	global.create_snippet_store = create_snippet_store;
	global.wire_snippet_toolbar = wire_snippet_toolbar;
	global.snippet_toolbar_html = snippet_toolbar_html;
	global.code_snippet_store = create_snippet_store("code_snippet_history", "saved_code_snippets");
	global.access_snippet_store = create_snippet_store("access_snippet_history", "saved_access_snippets");
})(typeof window !== "undefined" ? window : globalThis);
