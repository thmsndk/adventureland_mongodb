/**
 * no_html / bot stub — same ALEditor surface without Monaco.
 */
(function (global) {
	"use strict";
	function create_editor_fake(replaceOrHost, options) {
		options = options || {};
		var value = (options && options.value) || "";
		var api = {
			getValue: function () {
				return value;
			},
			setValue: function (x) {
				value = x == null ? "" : String(x);
			},
			focus: function () {},
			layout: function () {},
			refresh: function () {},
			clearHistory: function () {},
			getWrapperElement: function () {
				return { ALEditor: api, CodeMirror: api };
			},
			dispose: function () {},
			on: function () {},
			getCursor: function () {
				return { line: 0, ch: 0 };
			},
			findWordAt: function (c) {
				return { anchor: c || { line: 0, ch: 0 }, head: c || { line: 0, ch: 0 } };
			},
			getRange: function () {
				return "";
			},
		};
		if (typeof replaceOrHost === "function") {
			var host = document.createElement("div");
			host.ALEditor = api;
			host.CodeMirror = api;
			replaceOrHost(host);
		}
		return api;
	}
	global.create_editor = create_editor_fake;
	global.ALEditor = { create: create_editor_fake, create_fake: create_editor_fake };
	global.monaco = global.monaco || null;
})(typeof window !== "undefined" ? window : this);
