/**
 * observe-status — PDPS, coop contribution, bounded coop bosses, server/map.
 */
(function (global) {
	function isCooperativeMonster(e) {
		if (!e) return false;
		if (e.cooperative) return true;
		var mtype = e.mtype;
		if (mtype && typeof G !== "undefined" && G.monsters && G.monsters[mtype] && G.monsters[mtype].cooperative) {
			return true;
		}
		return false;
	}

	function bossSlice(e) {
		if (!e) return null;
		var frame = global.ALUI.buildTargetFrame(e);
		if (!frame) return null;
		return {
			id: frame.id,
			name: e.name || e.mtype || e.id,
			hp: frame.hp,
			maxHp: e.max_hp ? frame.maxHp : 0,
			healthPercent: e.max_hp ? frame.healthPercent : 0,
		};
	}

	/**
	 * Bounded coop boss selection:
	 * 1) observing.s.coop.id
	 * 2) else focused/ctarget if cooperative
	 * 3) else omit
	 */
	function pickCoopBosses() {
		var bosses = [];
		var observing = global.observing;
		if (observing && observing.s && observing.s.coop && observing.s.coop.id != null) {
			var fromCoop = global.ALUI.resolveEntity(observing.s.coop.id);
			if (fromCoop) {
				var s = bossSlice(fromCoop);
				if (s) bosses.push(s);
				return bosses;
			}
		}
		var focus = global.ctarget;
		if (focus && isCooperativeMonster(focus)) {
			var fs = bossSlice(focus);
			if (fs) bosses.push(fs);
		}
		return bosses;
	}

	function meterEntity() {
		return global.observing || null;
	}

	function buildStatusSlice() {
		var mapId = typeof current_map !== "undefined" ? current_map : "";
		var mapName = mapId;
		if (typeof G !== "undefined" && G.maps && G.maps[mapId] && G.maps[mapId].name) {
			mapName = G.maps[mapId].name;
		}
		var region = typeof server_region !== "undefined" ? server_region : "";
		var ident = typeof server_identifier !== "undefined" ? server_identifier : "";
		var ent = meterEntity();
		var pdps = ent && typeof ent.pdps === "number" ? ent.pdps : null;
		var coop = null;
		if (ent && ent.s && ent.s.coop && typeof ent.s.coop.p === "number") coop = ent.s.coop.p;
		return {
			server: (region + " " + ident).trim(),
			map: mapName || mapId || "—",
			mapId: mapId,
			pdps: pdps,
			coop: coop,
			stateC: !!ent,
			bosses: pickCoopBosses(),
		};
	}

	function statusSignature(payload) {
		if (!payload) return "\0";
		var parts = [payload.server, payload.map, payload.pdps, payload.coop, payload.stateC ? 1 : 0];
		var bosses = payload.bosses || [];
		for (var i = 0; i < bosses.length; i++) {
			parts.push(bosses[i].id + ":" + bosses[i].hp + ":" + bosses[i].maxHp);
		}
		return parts.join("\x1f");
	}

	function renderSlice(root, slice) {
		if (!root) return;
		if (!slice) {
			root.innerHTML = "";
			return;
		}
		var escapeHtml = global.ALUI.escapeHtml;
		var prettyNum = global.ALUI.prettyNum;
		var html = "";
		html += '<div class="alui-observe-meta">' + escapeHtml(slice.server || "—") + " · " + escapeHtml(slice.map || "—") + "</div>";
		if (!slice.stateC) {
			html += '<div class="alui-observe-empty">Select a character to observe</div>';
		} else {
			html += '<div class="alui-observe-meter"><div class="alui-observe-meter-label">PDPS<span>' + escapeHtml(prettyNum(slice.pdps)) + "</span></div></div>";
			html += '<div class="alui-observe-meter"><div class="alui-observe-meter-label">Coop<span>' + escapeHtml(prettyNum(slice.coop)) + "</span></div></div>";
		}
		var bosses = slice.bosses || [];
		for (var i = 0; i < bosses.length; i++) {
			var b = bosses[i];
			html +=
				'<div class="alui-observe-boss">' +
				'<div class="alui-observe-meter-label">' +
				escapeHtml(b.name) +
				"<span>" +
				escapeHtml(prettyNum(b.hp) + "/" + prettyNum(b.maxHp)) +
				"</span></div>" +
				'<div class="alui-observe-meter-track alui-observe-boss-hp"><i style="width:' +
				b.healthPercent +
				'%"></i></div>' +
				"</div>";
		}
		root.innerHTML = html;
	}

	function registerConfig() {
		if (!global.ALUI.config) return;
		global.ALUI.config.registerDefaults({
			frames: {
				"observe-status": {
					enabled: true,
					layout: {
						anchorX: "right",
						anchorY: "top",
						offsetX: 8,
						offsetY: 80,
						grow: "down",
						zIndex: 200,
					},
				},
			},
		});
		global.ALUI.config.registerSetting({
			path: "frames.observe-status.enabled",
			label: "Enabled",
			type: "boolean",
			group: "Observe Status",
		});
		if (typeof global.ALUI.config.registerLayoutSettings === "function") {
			global.ALUI.config.registerLayoutSettings("observe-status", "Observe Status", {});
		}
	}

	registerConfig();

	if (typeof global.ALUI.defineWidget === "function" && typeof global.ALUI.createPanelRenderer === "function") {
		global.ALUI.defineWidget(
			"observe-status",
			global.ALUI.createPanelRenderer("observe-status", {
				createContainer: true,
				containerClass: "alui-observe-panel alui-observe-status enableclicks",
				insertAfter: "topmid",
				layoutConfigPath: "frames.observe-status.layout",
				render: renderSlice,
			}),
			{
				edit: {
					label: "Observe Status",
					kind: "panel",
					layoutPath: "frames.observe-status.layout",
					draggable: true,
					order: 15,
				},
			},
		);
	}

	if (typeof global.ALUI.registerPublisher === "function") {
		global.ALUI.registerPublisher("observe-status", buildStatusSlice, {
			on: ["update_overlays", "reset_topleft"],
			signature: statusSignature,
		});
	}
})(typeof window !== "undefined" ? window : global);
