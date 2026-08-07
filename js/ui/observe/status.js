/**
 * observe-status — combat meters while observing (PDPS, coop share, coop boss HP).
 * Hidden when not observing; server/map live in the bottom chrome instead.
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
		var focus = typeof global.ALUI.observeFocusTarget === "function" ? global.ALUI.observeFocusTarget() : null;
		if (focus && isCooperativeMonster(focus)) {
			var fs = bossSlice(focus);
			if (fs) bosses.push(fs);
		}
		return bosses;
	}

	function buildStatusSlice() {
		var ent = global.observing || null;
		if (!ent) return null;
		var pdps = typeof ent.pdps === "number" ? ent.pdps : null;
		var coop = null;
		if (ent.s && ent.s.coop && typeof ent.s.coop.p === "number") coop = ent.s.coop.p;
		var bosses = pickCoopBosses();
		// Nothing useful yet — stay hidden.
		if (pdps == null && coop == null && !bosses.length) return null;
		return { pdps: pdps, coop: coop, bosses: bosses };
	}

	function statusSignature(payload) {
		if (!payload) return "\0";
		var parts = [payload.pdps, payload.coop];
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
			root.classList.add("alui-hidden-empty");
			root.style.display = "none";
			return;
		}
		root.classList.remove("alui-hidden-empty");
		root.style.display = "";
		var escapeHtml = global.ALUI.escapeHtml;
		var prettyNum = global.ALUI.prettyNum;
		var html = "";
		if (slice.pdps != null) {
			html += '<div class="alui-observe-meter"><div class="alui-observe-meter-label">PDPS<span>' + escapeHtml(prettyNum(slice.pdps)) + "</span></div></div>";
		}
		if (slice.coop != null) {
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
						anchorX: "left",
						anchorY: "bottom",
						offsetX: 8,
						offsetY: 80,
						grow: "up",
						zIndex: 200,
					},
				},
			},
		});
		global.ALUI.config.registerSetting({
			path: "frames.observe-status.enabled",
			label: "Enabled",
			type: "boolean",
			group: "Combat Meters",
		});
		if (typeof global.ALUI.config.registerLayoutSettings === "function") {
			global.ALUI.config.registerLayoutSettings("observe-status", "Combat Meters", {});
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
					label: "Combat Meters",
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
