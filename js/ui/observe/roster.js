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

	function isCharacter(e) {
		return e && e.type === "character" && !e.npc;
	}

	function isMonster(e) {
		return e && (e.type === "monster" || e.mtype);
	}

	function partyKey(e) {
		return e && e.party ? String(e.party) : "";
	}

	/** Vitals come from the shared unit-frame selector so bar math lives in one place. */
	function vitals(entity) {
		return global.ALUI.buildTargetFrame(entity) || {};
	}

	/** Bars only ever paint 0–100%; entities can sync without max_hp/max_mp. */
	function barPercent(value) {
		if (!value || value < 0) return 0;
		return value > 100 ? 100 : Math.round(value);
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
			var frame = vitals(e);
			var row = {
				id: e.id,
				name: e.name || id,
				level: e.level || 0,
				ctype: e.ctype || e.type || "",
				healthPercent: barPercent(frame.healthPercent),
				manaPercent: barPercent(frame.manaPercent),
				rip: !!frame.dead,
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
			if (!focusNames[tgt]) continue;
			enemies.push({
				id: mon.id,
				name: mon.name || mon.mtype || mid,
				mtype: mon.mtype || "",
				healthPercent: barPercent(vitals(mon).healthPercent),
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
				parts.push([r.id, r.healthPercent, r.manaPercent, r.rip ? 1 : 0, r.selected ? 1 : 0].join(":"));
			}
		}
		var enemies = payload.enemies || [];
		for (var k = 0; k < enemies.length; k++) {
			var en = enemies[k];
			parts.push(["e", en.id, en.healthPercent, en.selected ? 1 : 0].join(":"));
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

	function handleRowClick(event) {
		var row = event.target.closest && event.target.closest("[data-entity-id]");
		if (!row) return;
		if (typeof btc === "function") btc(event);
		selectEntityId(row.getAttribute("data-entity-id"));
	}

	function renderMemberRow(row) {
		var escapeHtml = global.ALUI.escapeHtml;
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
			row.healthPercent +
			'%"></i></span>' +
			'<span class="alui-observe-bar alui-observe-mp"><i style="width:' +
			row.manaPercent +
			'%"></i></span>' +
			"</div>"
		);
	}

	function renderEnemyRow(row) {
		var escapeHtml = global.ALUI.escapeHtml;
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
			row.healthPercent +
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
		var escapeHtml = global.ALUI.escapeHtml;
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

	function registerConfig() {
		if (!global.ALUI.config) return;
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

	registerConfig();

	if (typeof global.ALUI.defineWidget === "function" && typeof global.ALUI.createPanelRenderer === "function") {
		global.ALUI.defineWidget(
			"observe-roster",
			global.ALUI.createPanelRenderer("observe-roster", {
				createContainer: true,
				containerClass: "alui-observe-panel alui-observe-roster enableclicks",
				insertAfter: "topmid",
				layoutConfigPath: "frames.observe-roster.layout",
				onClick: handleRowClick,
				render: renderSlice,
			}),
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
