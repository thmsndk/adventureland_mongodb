/**
 * Observe cooldown strip — state C only.
 * Publisher + panel widget; tiles via item_container; map is observing_next_skill.
 */
(function (global) {
	var OBSERVE_CD_VISIBLE_MS = -300;
	var POTION_SKINS = { use_hp: "hpot0", use_mp: "mpot0" };

	/**
	 * @param {Object.<string, number>} cds remaining ms by skill name
	 */
	function apply_observing_cds(cds) {
		var map = {};
		if (cds) {
			for (var name in cds) {
				if (!Object.prototype.hasOwnProperty.call(cds, name)) continue;
				var ms = cds[name];
				if (typeof ms !== "number" || ms <= 0) continue;
				map[name] = typeof future_ms === "function" ? future_ms(ms) : new Date(Date.now() + ms);
			}
		}
		global.observing_next_skill = map;
		if (typeof global.ALUI.publishFor === "function") {
			global.ALUI.publishFor("update_overlays");
		}
	}

	function skillSkin(name) {
		if (POTION_SKINS[name] && typeof G !== "undefined" && G.items && G.items[POTION_SKINS[name]]) {
			return G.items[POTION_SKINS[name]].skin;
		}
		if (typeof G === "undefined") return "";
		if (G.skills && G.skills[name] && G.skills[name].skin) return G.skills[name].skin;
		if (G.items && G.items[name] && G.items[name].skin) return G.items[name].skin;
		return "";
	}

	function buildObserveCooldowns() {
		var entries = [];
		var keyParts = [];
		if (!global.observing || !global.observing_next_skill) {
			return { key: "", entries: entries };
		}
		var ns = global.observing_next_skill;
		var dms = typeof DMS !== "undefined" ? DMS : 0;
		for (var name in ns) {
			if (!Object.prototype.hasOwnProperty.call(ns, name)) continue;
			var until = ns[name];
			var remaining = until ? -mssince(until) - dms : 0;
			if (!(until && remaining > OBSERVE_CD_VISIBLE_MS)) continue;
			var untilMs = until && until.getTime ? until.getTime() : 0;
			keyParts.push(name + ":" + untilMs);
			entries.push({ name: name, skin: skillSkin(name), ms: remaining < 1 ? 1 : remaining, until: untilMs });
		}
		keyParts.sort();
		entries.sort(function (a, b) {
			return b.ms - a.ms;
		});
		return { key: keyParts.join("|"), entries: entries };
	}

	function cooldownSignature(payload) {
		if (!payload) return "\0";
		return payload.key || "";
	}

	function renderTiles(root, slice) {
		if (!root) return;
		var entries = (slice && slice.entries) || [];
		if (!entries.length) {
			root.innerHTML = "";
			return;
		}
		var html = "";
		for (var i = 0; i < entries.length; i++) {
			var e = entries[i];
			var rid = "ocdm_" + String(e.name).replace(/[^a-zA-Z0-9_\-]/g, "_");
			if (typeof item_container === "function") {
				html +=
					"<div class='ocdm-tile' data-until='" +
					e.until +
					"' style='display:inline-block;margin:0 2px;vertical-align:middle'>" +
					item_container({ skin: e.skin || "placeholder", size: 36, skid: rid, noBackground: true }) +
					"</div>";
			}
		}
		root.innerHTML = html;
		for (var j = 0; j < entries.length; j++) {
			var ent = entries[j];
			var r = "ocdm_" + String(ent.name).replace(/[^a-zA-Z0-9_\-]/g, "_");
			if (typeof add_tint === "function") {
				add_tint(".skidloader" + r, { ms: ent.ms, type: "skill", skid: r });
			}
		}
	}

	global.apply_observing_cds = apply_observing_cds;

	if (global.ALUI && global.ALUI.config) {
		global.ALUI.config.registerDefaults({
			frames: {
				"observe-cooldowns": {
					enabled: true,
					layout: {
						anchorX: "center",
						anchorY: "bottom",
						offsetX: 0,
						offsetY: 120,
						grow: "up",
						zIndex: 210,
					},
				},
			},
		});
		global.ALUI.config.registerSetting({
			path: "frames.observe-cooldowns.enabled",
			label: "Enabled",
			type: "boolean",
			group: "Observe Cooldowns",
		});
		if (typeof global.ALUI.config.registerLayoutSettings === "function") {
			global.ALUI.config.registerLayoutSettings("observe-cooldowns", "Observe Cooldowns", {});
		}
	}

	if (typeof global.ALUI.createPanelRenderer === "function" && typeof global.ALUI.defineWidget === "function") {
		global.ALUI.defineWidget(
			"observe-cooldowns",
			global.ALUI.createPanelRenderer("observe-cooldowns", {
				createContainer: true,
				containerClass: "alui-observe-cooldowns enableclicks",
				insertAfter: "topmid",
				layoutConfigPath: "frames.observe-cooldowns.layout",
				render: renderTiles,
			}),
			{
				edit: {
					label: "Observe Cooldowns",
					kind: "panel",
					layoutPath: "frames.observe-cooldowns.layout",
					draggable: true,
					order: 25,
				},
			},
		);
	}

	if (typeof global.ALUI.registerPublisher === "function") {
		global.ALUI.registerPublisher("observe-cooldowns", buildObserveCooldowns, {
			on: ["update_overlays"],
			signature: cooldownSignature,
		});
	}
})(typeof window !== "undefined" ? window : global);
