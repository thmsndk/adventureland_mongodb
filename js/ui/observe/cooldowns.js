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

	function resolveSkin(name) {
		var skin = skillSkin(name);
		if (!skin && /hp/i.test(name) && G && G.items && G.items.hpot0) skin = G.items.hpot0.skin;
		if (!skin && /mp/i.test(name) && G && G.items && G.items.mpot0) skin = G.items.mpot0.skin;
		if (!skin || !G || !G.positions || !G.positions[skin]) skin = "placeholder";
		if (!G.positions[skin]) return null;
		return skin;
	}

	function tileHtml(entry, rid) {
		var skin = resolveSkin(entry.name);
		if (!skin || !G.imagesets) return "";
		var pack = G.imagesets[G.positions[skin][0] || "pack_20"];
		if (!pack) return "";
		var ix = G.positions[skin][1];
		var iy = G.positions[skin][2];
		var isize = 36;
		var iscale = isize / pack.size;
		return (
			"<div class='ocdm-tile' data-until='" +
			entry.until +
			"' data-rid='" +
			rid +
			"' style='position:relative;display:inline-block;margin:0 2px;vertical-align:middle;overflow:hidden;width:" +
			isize +
			"px;height:" +
			isize +
			"px;background:transparent'>" +
			"<div style='overflow:hidden;width:" +
			isize +
			"px;height:" +
			isize +
			"px;background:transparent'>" +
			"<img style='width:" +
			pack.columns * pack.size * iscale +
			"px;height:" +
			pack.rows * pack.size * iscale +
			"px;margin-top:-" +
			iy * isize +
			"px;margin-left:-" +
			ix * isize +
			"px;' src='" +
			pack.file +
			"' draggable='false' />" +
			"</div>" +
			"<div class='skidloader" +
			rid +
			"' style='position:absolute;bottom:0;right:0;width:4px;height:0;background-color:yellow'></div>" +
			"</div>"
		);
	}

	function renderTiles(root, slice) {
		if (!root) return;
		var entries = (slice && slice.entries) || [];
		if (!entries.length) {
			root.innerHTML = "";
			root.removeAttribute("data-cd-struct");
			return;
		}
		var struct = "";
		for (var s = 0; s < entries.length; s++) struct += entries[s].name + "|";
		var existing = root.querySelectorAll(".ocdm-tile");
		// Same skill set — refresh tint durations without rebuilding icons.
		if (root.getAttribute("data-cd-struct") === struct && existing.length === entries.length) {
			for (var i = 0; i < entries.length; i++) {
				var e = entries[i];
				existing[i].setAttribute("data-until", String(e.until));
				var r = existing[i].getAttribute("data-rid") || "ocdm_" + String(e.name).replace(/[^a-zA-Z0-9_\-]/g, "_");
				if (typeof add_tint === "function") {
					add_tint(".skidloader" + r, { ms: e.ms, type: "skill", skid: r });
				}
			}
			return;
		}
		var html = "";
		for (var j = 0; j < entries.length; j++) {
			var ent = entries[j];
			var rid = "ocdm_" + String(ent.name).replace(/[^a-zA-Z0-9_\-]/g, "_");
			html += tileHtml(ent, rid);
		}
		root.innerHTML = html;
		root.setAttribute("data-cd-struct", struct);
		for (var k = 0; k < entries.length; k++) {
			var entry = entries[k];
			var sk = "ocdm_" + String(entry.name).replace(/[^a-zA-Z0-9_\-]/g, "_");
			if (typeof add_tint === "function") {
				add_tint(".skidloader" + sk, { ms: entry.ms, type: "skill", skid: sk });
			}
		}
	}

	global.apply_observing_cds = apply_observing_cds;

	/**
	 * Pin observe cooldowns just above the player frame so they track its layout.
	 */
	function placeCdsOnPlayer() {
		var cds = document.querySelector('[data-widget="observe-cooldowns"]');
		var player = document.querySelector('[data-widget="player-frame"]');
		if (!cds || !player) return;
		if (cds.parentNode !== player) {
			player.appendChild(cds);
		}
		cds.setAttribute("data-alui-docked", "player-frame");
		// Clear free-layout offsets; CSS docks to the player box.
		cds.style.position = "absolute";
		cds.style.left = "0";
		cds.style.right = "auto";
		cds.style.top = "auto";
		cds.style.bottom = "100%";
		cds.style.marginBottom = "6px";
		cds.style.transform = "";
	}

	if (global.ALUI && global.ALUI.config) {
		global.ALUI.config.registerDefaults({
			frames: {
				"observe-cooldowns": {
					enabled: true,
					layout: {
						// Fallback when undocked (HUD edit); normally docked above player.
						anchorX: "center",
						anchorY: "bottom",
						offsetX: -320,
						offsetY: 168,
						grow: "up",
						zIndex: 305,
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

	global.ALUI = global.ALUI || {};
	global.ALUI.placeObserveCdsOnPlayer = placeCdsOnPlayer;
	global.ALUI.onWidgetsMounted = global.ALUI.onWidgetsMounted || [];
	global.ALUI.onWidgetsMounted.push(placeCdsOnPlayer);
})(typeof window !== "undefined" ? window : global);
