/**
 * Centered cooldown strip — active next_skill entries as tinted tiles.
 * Publishes on render_skillbar (init wrap); frame buff timers stay on unit-frame publishers.
 */
function render_cooldown_widget() {
	try {
		if (window.ALUI && window.ALUI.config && typeof window.ALUI.config.isEnabled === "function") {
			if (!window.ALUI.config.isEnabled("cooldown-widget")) {
				$("#cooldown-widget").html("").hide();
				$("#hudcooldowns").hide();
				if (window._cooldown_manager_timer) {
					clearTimeout(window._cooldown_manager_timer);
					window._cooldown_manager_timer = null;
				}
				return;
			}
			$("#hudcooldowns").show();
		}
		if (!window.next_skill) {
			$("#cooldown-widget").hide();
			return;
		}

		var entries = [];
		for (var name in next_skill) {
			if (!Object.prototype.hasOwnProperty.call(next_skill, name)) continue;
			var until = next_skill[name];
			var remaining = until ? -mssince(until) - (typeof DMS !== "undefined" ? DMS : 0) : 0;
			if (until && remaining > -300) {
				var skin = "";
				if (G && G.skills && G.skills[name] && G.skills[name].skin) {
					skin = G.skills[name].skin;
				} else if (G && G.items && G.items[name] && G.items[name].skin) {
					skin = G.items[name].skin;
				} else if (/hp/i.test(name) && G && G.items && G.items.hpot0) {
					skin = G.items.hpot0.skin;
				} else if (/mp/i.test(name) && G && G.items && G.items.mpot0) {
					skin = G.items.mpot0.skin;
				}
				entries.push({ name: name, skin: skin, ms: remaining });
			}
		}

		if (!entries.length) {
			$("#cooldown-widget").html("").hide();
			if (window._cooldown_manager_timer) {
				clearTimeout(window._cooldown_manager_timer);
				window._cooldown_manager_timer = null;
			}
			return;
		}

		entries.sort(function (a, b) {
			return b.ms - a.ms;
		});

		var $cm = $("#cooldown-widget").css("display", "inline-block");
		var alive = {};

		for (var i = 0; i < entries.length; i++) {
			var e = entries[i];
			var rid = "cdm_" + e.name.replace(/[^a-zA-Z0-9_\-]/g, "_");
			alive[rid] = e.name;

			var ns = next_skill && next_skill[e.name];
			var ms = ns ? -mssince(ns) - (typeof DMS !== "undefined" ? DMS : 0) : 1;
			if (ms < 1) ms = 1;
			var sel = ".skidloader" + rid;
			var tileEl = document.getElementById("cdm_tile_" + rid);
			var untilKey = ns ? String(ns.getTime()) : "";

			if (!tileEl) {
				var tileSkin = e.skin || "placeholder";
				if (!G.positions[tileSkin]) tileSkin = "placeholder";
				var ipack = G.imagesets[G.positions[tileSkin][0] || "pack_20"];
				var ix = G.positions[tileSkin][1];
				var iy = G.positions[tileSkin][2];
				var isize = 40;
				var iscale = isize / ipack.size;
				var tile = "";
				tile +=
					"<div id='cdm_tile_" +
					rid +
					"' class='cdm-tile' style='position: relative; display: inline-block; margin-right: 2px; overflow:hidden; width:" +
					isize +
					"px; height:" +
					isize +
					"px; background: transparent'>";
				tile += "<div style='overflow:hidden; width:" + isize + "px; height:" + isize + "px; background: transparent'>";
				tile +=
					"<img style='width:" +
					ipack.columns * ipack.size * iscale +
					"px; height:" +
					ipack.rows * ipack.size * iscale +
					"px; margin-top:-" +
					iy * isize +
					"px; margin-left:-" +
					ix * isize +
					"px;' src='" +
					ipack.file +
					"' draggable='false' />";
				tile += "</div>";
				tile += "<div class='skidloader" + rid + "' style='position: absolute; bottom: 0px; right: 0px; width: 4px; height: 0px; background-color: yellow'></div>";
				tile += "</div>";
				$cm.append(tile);
				tileEl = document.getElementById("cdm_tile_" + rid);
				if (tileEl && untilKey) tileEl.setAttribute("data-until", untilKey);
				add_tint(sel, { ms: ms, type: "skill", skid: rid });
			} else if (untilKey && tileEl.getAttribute("data-until") !== untilKey) {
				// CD was restarted (new next_skill Date) — retint once, not every 250ms poll.
				tileEl.setAttribute("data-until", untilKey);
				add_tint(sel, { ms: ms, type: "skill", skid: rid });
			}
		}

		$("#cooldown-widget .cdm-tile").each(function () {
			var id = this.id || "";
			var tileRid = id.replace("cdm_tile_", "");
			if (!alive[tileRid]) $(this).remove();
		});

		// Self-schedule: bus may skip notify when signature (until keys) is unchanged,
		// but tiles still need expiry cleanup / removal.
		if (window._cooldown_manager_timer) clearTimeout(window._cooldown_manager_timer);
		window._cooldown_manager_timer = setTimeout(render_cooldown_widget, 250);
	} catch (e) {
		// Fail silently to avoid breaking gameplay UI
	}
}

(function (global) {
	/**
	 * Slice of active skill CDs. Signature uses until timestamps so ticking ms
	 * does not thrash; DOM tints are driven by add_tint (same idea as frame effects).
	 */
	function buildCooldownWidget() {
		var entries = [];
		var keyParts = [];
		if (!global.next_skill) return { key: "", entries: entries };
		for (var name in global.next_skill) {
			if (!Object.prototype.hasOwnProperty.call(global.next_skill, name)) continue;
			var until = global.next_skill[name];
			var remaining = until ? -mssince(until) - (typeof DMS !== "undefined" ? DMS : 0) : 0;
			if (!(until && remaining > -300)) continue;
			var untilMs = until && until.getTime ? until.getTime() : 0;
			keyParts.push(name + ":" + untilMs);
			entries.push({ name: name, until: untilMs, ms: remaining });
		}
		keyParts.sort();
		return { key: keyParts.join("|"), entries: entries };
	}

	function cooldownSignature(payload) {
		if (!payload) return "\0";
		return payload.key || "";
	}

	global.ALUI = global.ALUI || {};
	if (global.ALUI.config) {
		global.ALUI.config.registerDefaults({
			frames: {
				"cooldown-widget": { enabled: true, label: "Cooldowns" },
			},
		});
		global.ALUI.config.registerSetting({
			path: "frames.cooldown-widget.enabled",
			label: "Cooldowns",
			type: "boolean",
		});
		global.ALUI.config.onChange(function () {
			if (typeof global.render_cooldown_widget === "function") {
				global.render_cooldown_widget();
			}
		});
	}

	if (typeof global.ALUI.registerPublisher === "function") {
		global.ALUI.registerPublisher("cooldown-widget", buildCooldownWidget, {
			on: ["render_skillbar"],
			signature: cooldownSignature,
		});
	}

	if (typeof global.ALUI.subscribe === "function") {
		global.ALUI.subscribe("cooldown-widget", function () {
			if (typeof global.render_cooldown_widget === "function") {
				global.render_cooldown_widget();
			}
		});
	}

	global.ALUI.buildCooldownWidget = buildCooldownWidget;
	global.ALUI.onWidgetsMounted = global.ALUI.onWidgetsMounted || [];
	global.ALUI.onWidgetsMounted.push(function () {
		var host = document.getElementById("hudcooldowns");
		if (host && !host.getAttribute("data-widget")) {
			host.setAttribute("data-widget", "cooldown-widget");
		}
		if (typeof global.ALUI.publishFor === "function") {
			global.ALUI.publishFor("render_skillbar");
		} else if (typeof global.render_cooldown_widget === "function") {
			global.render_cooldown_widget();
		}
	});
})(typeof window !== "undefined" ? window : global);
