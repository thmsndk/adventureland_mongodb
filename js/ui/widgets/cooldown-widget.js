/**
 * Centered cooldown strip — active next_skill entries as tinted tiles.
 */
function render_cooldown_widget() {
	try {
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

		if (window._cooldown_manager_timer) clearTimeout(window._cooldown_manager_timer);
		window._cooldown_manager_timer = setTimeout(render_cooldown_widget, 250);
	} catch (e) {
		// Fail silently to avoid breaking gameplay UI
	}
}
