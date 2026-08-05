/**
 * observe-roster — all parties from entities (+ aggroed enemies when compact).
 */
(function (global) {
	var CLASS_COLORS = {
		warrior: "#f07f2f",
		paladin: "#a3b4b9",
		mage: "#3e6eed",
		priest: "#eb4d82",
		rogue: "#44b75c",
		ranger: "#8a512b",
		merchant: "#7f7f7f",
	};

	function escapeHtml(s) {
		return String(s == null ? "" : s)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}

	function hpPct(e) {
		if (!e || !e.max_hp) return 0;
		if (e.rip || e.dead || e.hp <= 0) return 0;
		return Math.round((e.hp / e.max_hp) * 100);
	}

	function mpPct(e) {
		if (!e || !e.max_mp) return 0;
		return Math.round((e.mp / e.max_mp) * 100);
	}

	function isCharacter(e) {
		return e && e.type === "character" && !e.npc;
	}

	function isMonster(e) {
		return e && (e.type === "monster" || e.mtype);
	}

	function partyKey(e) {
		return e && e.party ? String(e.party) : "";
	}

	function buildRosterSlice() {
		var entities = global.entities || {};
		var byParty = {};
		var solo = [];
		var selectedId = global.ctarget && global.ctarget.id;

		for (var id in entities) {
			if (!Object.prototype.hasOwnProperty.call(entities, id)) continue;
			var e = entities[id];
			if (!isCharacter(e)) continue;
			var row = {
				id: e.id,
				name: e.name || id,
				level: e.level || 0,
				ctype: e.ctype || e.type || "",
				skin: e.skin || "",
				hpPct: hpPct(e),
				mpPct: mpPct(e),
				rip: !!(e.rip || e.dead),
				selected: e.id === selectedId,
			};
			var pk = partyKey(e);
			if (!pk) {
				solo.push(row);
				continue;
			}
			if (!byParty[pk]) byParty[pk] = [];
			byParty[pk].push(row);
		}

		var parties = [];
		var keys = Object.keys(byParty);
		keys.sort();
		for (var i = 0; i < keys.length; i++) {
			parties.push({ id: keys[i], members: byParty[keys[i]] });
		}
		if (solo.length) parties.push({ id: "", members: solo });

		var enemies = [];
		var focusNames = {};
		if (global.observing && global.observing.name) focusNames[global.observing.name] = 1;
		if (global.observing && global.observing.id) focusNames[global.observing.id] = 1;
		for (var j = 0; j < parties.length; j++) {
			var members = parties[j].members;
			for (var m = 0; m < members.length; m++) {
				focusNames[members[m].id] = 1;
				focusNames[members[m].name] = 1;
			}
		}

		for (var mid in entities) {
			if (!Object.prototype.hasOwnProperty.call(entities, mid)) continue;
			var mon = entities[mid];
			if (!isMonster(mon) || mon.dead) continue;
			var tgt = mon.target;
			if (tgt == null || tgt === "") continue;
			if (!focusNames[tgt] && !(global.observing && (tgt === global.observing.id || tgt === global.observing.name))) continue;
			enemies.push({
				id: mon.id,
				name: mon.name || mon.mtype || mid,
				mtype: mon.mtype || "",
				hpPct: hpPct(mon),
				selected: mon.id === selectedId,
			});
		}

		return { parties: parties, enemies: enemies };
	}

	function rosterSignature(payload) {
		if (!payload) return "\0";
		var parts = [];
		var parties = payload.parties || [];
		for (var i = 0; i < parties.length; i++) {
			parts.push("p:" + (parties[i].id || ""));
			var members = parties[i].members || [];
			for (var j = 0; j < members.length; j++) {
				var r = members[j];
				parts.push([r.id, r.hpPct, r.mpPct, r.rip ? 1 : 0, r.selected ? 1 : 0].join(":"));
			}
		}
		var enemies = payload.enemies || [];
		for (var k = 0; k < enemies.length; k++) {
			var en = enemies[k];
			parts.push(["e", en.id, en.hpPct, en.selected ? 1 : 0].join(":"));
		}
		return parts.join("\x1f");
	}

	function selectEntityId(id) {
		if (!id || !global.entities) return;
		var ent = global.entities[id];
		if (!ent) return;
		global.ctarget = ent;
		if (typeof reset_topleft === "function") reset_topleft();
		if (typeof global.ALUI.publishFor === "function") global.ALUI.publishFor("update_overlays");
	}

	function renderMemberRow(row) {
		var color = CLASS_COLORS[row.ctype] || "#ccc";
		var cls = "alui-observe-row" + (row.selected ? " is-selected" : "") + (row.rip ? " is-rip" : "");
		return (
			'<div class="' +
			cls +
			'" data-entity-id="' +
			escapeHtml(row.id) +
			'">' +
			'<span class="alui-observe-name" style="color:' +
			color +
			'">' +
			escapeHtml(row.name) +
			"</span>" +
			'<span class="alui-observe-lvl">L' +
			escapeHtml(row.level) +
			"</span>" +
			'<span class="alui-observe-bar alui-observe-hp"><i style="width:' +
			row.hpPct +
			'%"></i></span>' +
			'<span class="alui-observe-bar alui-observe-mp"><i style="width:' +
			row.mpPct +
			'%"></i></span>' +
			"</div>"
		);
	}

	function renderEnemyRow(row) {
		var cls = "alui-observe-row alui-observe-enemy" + (row.selected ? " is-selected" : "");
		return (
			'<div class="' +
			cls +
			'" data-entity-id="' +
			escapeHtml(row.id) +
			'">' +
			'<span class="alui-observe-name">' +
			escapeHtml(row.name) +
			"</span>" +
			'<span class="alui-observe-bar alui-observe-hp"><i style="width:' +
			row.hpPct +
			'%"></i></span>' +
			"</div>"
		);
	}

	function renderSlice(root, slice) {
		if (!root) return;
		if (!slice || ((!slice.parties || !slice.parties.length) && (!slice.enemies || !slice.enemies.length))) {
			root.innerHTML = '<div class="alui-observe-empty">No parties in vision</div>';
			return;
		}
		var html = "";
		var parties = slice.parties || [];
		for (var i = 0; i < parties.length; i++) {
			var p = parties[i];
			html += '<div class="alui-observe-party">';
			html += '<div class="alui-observe-party-label">' + (p.id ? escapeHtml(p.id) : "Solo") + "</div>";
			var members = p.members || [];
			for (var j = 0; j < members.length; j++) html += renderMemberRow(members[j]);
			html += "</div>";
		}
		var enemies = slice.enemies || [];
		if (enemies.length) {
			html += '<div class="alui-observe-party"><div class="alui-observe-party-label">Aggro</div>';
			for (var k = 0; k < enemies.length; k++) html += renderEnemyRow(enemies[k]);
			html += "</div>";
		}
		root.innerHTML = html;
	}

	function createRosterWidget() {
		var root;
		var unsub;
		return {
			init: function (target, initialSlice) {
				root = target;
				if (!root) {
					root = document.createElement("div");
					root.setAttribute("data-widget", "observe-roster");
					root.className = "alui-observe-panel alui-observe-roster enableclicks";
					var after = document.getElementById("topmid");
					if (after && after.parentNode) after.parentNode.insertBefore(root, after.nextSibling);
					else document.body.appendChild(root);
				}
				root.setAttribute("data-alui-layout-path", "frames.observe-roster.layout");
				if (global.ALUI && global.ALUI.layout) {
					global.ALUI.layout.applyPathToElement(root, "frames.observe-roster.layout");
				}
				root.addEventListener("click", function (event) {
					var row = event.target.closest && event.target.closest("[data-entity-id]");
					if (!row) return;
					if (typeof btc === "function") btc(event);
					selectEntityId(row.getAttribute("data-entity-id"));
				});
				renderSlice(root, initialSlice);
				if (typeof global.ALUI.subscribe === "function") {
					unsub = global.ALUI.subscribe("observe-roster", function (slice) {
						renderSlice(root, slice);
					});
				}
			},
			dispose: function () {
				if (unsub) unsub();
			},
		};
	}

	if (global.ALUI && global.ALUI.config) {
		global.ALUI.config.registerDefaults({
			frames: {
				"observe-roster": {
					enabled: true,
					layout: {
						anchorX: "left",
						anchorY: "top",
						offsetX: 8,
						offsetY: 120,
						grow: "down",
						zIndex: 200,
					},
				},
			},
		});
		global.ALUI.config.registerSetting({
			path: "frames.observe-roster.enabled",
			label: "Enabled",
			type: "boolean",
			group: "Observe Roster",
		});
		if (typeof global.ALUI.config.registerLayoutSettings === "function") {
			global.ALUI.config.registerLayoutSettings("observe-roster", "Observe Roster", {});
		}
	}

	if (typeof global.ALUI.defineWidget === "function") {
		global.ALUI.defineWidget(
			"observe-roster",
			createRosterWidget,
			{
				edit: {
					label: "Observe Roster",
					kind: "panel",
					layoutPath: "frames.observe-roster.layout",
					draggable: true,
					order: 10,
				},
			},
		);
	}

	if (typeof global.ALUI.registerPublisher === "function") {
		global.ALUI.registerPublisher("observe-roster", buildRosterSlice, {
			on: ["update_overlays", "reset_topleft"],
			signature: rosterSignature,
		});
	}
})(typeof window !== "undefined" ? window : global);
