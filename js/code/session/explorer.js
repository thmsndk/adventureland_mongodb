/**
 * SlotSession explorer — sync game roster into VFS for stock Explorer (no custom tree UI).
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

	var slot_key = ss("slot_key");
	var is_character_slot = ss("is_character_slot");
	var character_display_name = ss("character_display_name");
	var slot_label = ss("slot_label");
	var get_slot = ss("get_slot");

	function refresh_explorer() {
		if (global.SlotSession && typeof SlotSession.ensure_sidebar_host === "function") {
			SlotSession.ensure_sidebar_host();
		}

		var api = global.ALVscodeApi;
		if (!api || typeof api.syncRosterFiles !== "function") return;

		var list = (global.X && X.codes) || {};
		var items = [];
		var seen = Object.create(null);

		var roster = (global.X && X.characters) || [];
		for (var ri = 0; ri < roster.length; ri++) {
			var ch = roster[ri];
			if (!ch || ch.id == null) continue;
			var rid = slot_key(ch.id);
			if (seen[rid]) continue;
			seen[rid] = true;
			items.push({
				slot: ch.id,
				label: ch.name || "character",
				character: true,
			});
		}

		var active = get_slot();
		if (active != null && is_character_slot(active) && !seen[slot_key(active)]) {
			seen[slot_key(active)] = true;
			items.push({
				slot: active,
				label: character_display_name() || "character",
				character: true,
			});
		}

		var codes = [];
		for (var id in list) {
			if (!Object.prototype.hasOwnProperty.call(list, id)) continue;
			if (is_character_slot(id)) continue;
			codes.push(id);
		}
		for (var u in S.untitled_slots) {
			if (!Object.prototype.hasOwnProperty.call(S.untitled_slots, u) || S.untitled_slots[u] == null) continue;
			if (codes.indexOf(u) === -1) codes.push(u);
		}
		codes.sort(function (a, b) {
			return parseInt(a, 10) - parseInt(b, 10);
		});
		for (var j = 0; j < codes.length; j++) {
			var sid = codes[j];
			var entry = list[sid] || S.untitled_slots[sid] || ["Empty", 0];
			items.push({
				slot: sid,
				label: slot_label(sid, entry),
				character: false,
			});
		}

		Promise.resolve(api.syncRosterFiles(items)).then(function () {
			if (typeof api.refreshSlotNumberDecorations === "function") api.refreshSlotNumberDecorations();
		});
	}

	var SlotSession = global.SlotSession || (global.SlotSession = {});
	SlotSession.refresh_explorer = refresh_explorer;
})(typeof window !== "undefined" ? window : globalThis);
