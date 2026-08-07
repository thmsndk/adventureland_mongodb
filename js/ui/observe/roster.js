/**
 * observe-roster — party chips (left, horizontal).
 * observe-aggro — monsters on party (right).
 * Soft-select (xtarget) for paperdoll only — never steals observing.target frames.
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

	function vitals(entity) {
		return global.ALUI.buildTargetFrame(entity) || {};
	}

	function barPercent(value) {
		if (!value || value < 0) return 0;
		return value > 100 ? 100 : Math.round(value);
	}

	function selectedEntityId() {
		return global.observe_roster_sel || null;
	}

	function buildParties() {
		var entities = global.entities || {};
		var byParty = {};
		var solo = [];
		var selectedId = selectedEntityId();

		for (var id in entities) {
			if (!Object.prototype.hasOwnProperty.call(entities, id)) continue;
			var e = entities[id];
			if (!isCharacter(e)) continue;
			if (e.ctype === "merchant") continue;
			var frame = vitals(e);
			var row = {
				id: e.id,
				name: e.name || id,
				level: e.level || 0,
				ctype: e.ctype || e.type || "",
				healthPercent: barPercent(frame.healthPercent),
				manaPercent: barPercent(frame.manaPercent),
				rip: !!frame.dead,
				selected: String(e.id) === String(selectedId),
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
		return parties;
	}

	function buildEnemies(parties) {
		var entities = global.entities || {};
		var enemies = [];
		var focusNames = {};
		var selectedId = selectedEntityId();
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
				selected: String(mon.id) === String(selectedId),
			});
		}
		return enemies;
	}

	function buildRosterSlice() {
		return { parties: buildParties() };
	}

	function buildAggroSlice() {
		var enemies = buildEnemies(buildParties());
		if (!enemies.length) return null;
		return { enemies: enemies };
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
		return parts.join("\x1f");
	}

	function aggroSignature(payload) {
		if (!payload || !payload.enemies) return "\0";
		var parts = [];
		var enemies = payload.enemies;
		for (var k = 0; k < enemies.length; k++) {
			var en = enemies[k];
			parts.push([en.id, en.healthPercent, en.selected ? 1 : 0].join(":"));
		}
		return parts.join("\x1f");
	}

	function structureKey(rows) {
		var parts = [];
		for (var i = 0; i < rows.length; i++) parts.push(String(rows[i].id));
		return parts.join("|");
	}

	function partyStructureKey(parties) {
		var parts = [];
		for (var i = 0; i < parties.length; i++) {
			parts.push("p:" + (parties[i].id || ""));
			var members = parties[i].members || [];
			for (var j = 0; j < members.length; j++) parts.push(String(members[j].id));
		}
		return parts.join("|");
	}

	/** Paperdoll soft-select only — does not change observing.target frames. */
	function selectEntityId(id) {
		if (!id || !global.entities) return;
		var ent = global.entities[id];
		if (!ent) return;
		global.observe_roster_sel = ent.id;
		global.xtarget = ent;
		if (typeof reset_topleft === "function") reset_topleft();
		if (typeof global.ALUI.publishFor === "function") global.ALUI.publishFor("update_overlays");
	}

	function handleRowClick(event) {
		var row = event.target.closest && event.target.closest("[data-entity-id]");
		if (!row) return;
		if (typeof btc === "function") btc(event);
		selectEntityId(row.getAttribute("data-entity-id"));
	}

	function memberChipHtml(row) {
		var escapeHtml = global.ALUI.escapeHtml;
		var color = CLASS_COLORS[row.ctype] || "#888";
		var cls = "alui-observe-chip" + (row.selected ? " is-selected" : "") + (row.rip ? " is-rip" : "");
		return (
			'<div class="' +
			cls +
			'" data-entity-id="' +
			escapeHtml(row.id) +
			'">' +
			'<div class="alui-observe-chip-hp"><i style="width:' +
			row.healthPercent +
			"%;background:" +
			color +
			'"></i><span class="alui-observe-chip-label">' +
			escapeHtml(row.level) +
			" " +
			escapeHtml(row.name) +
			"</span></div>" +
			'<div class="alui-observe-chip-mp"><i style="width:' +
			row.manaPercent +
			'%"></i></div>' +
			"</div>"
		);
	}

	function enemyChipHtml(row) {
		var escapeHtml = global.ALUI.escapeHtml;
		var cls = "alui-observe-chip alui-observe-chip--enemy" + (row.selected ? " is-selected" : "");
		return (
			'<div class="' +
			cls +
			'" data-entity-id="' +
			escapeHtml(row.id) +
			'">' +
			'<div class="alui-observe-chip-hp"><i style="width:' +
			row.healthPercent +
			'%"></i><span class="alui-observe-chip-label">' +
			escapeHtml(row.name) +
			"</span></div>" +
			"</div>"
		);
	}

	function patchChip(el, row, isEnemy) {
		if (!el) return;
		el.classList.toggle("is-selected", !!row.selected);
		if (!isEnemy) el.classList.toggle("is-rip", !!row.rip);
		var label = el.querySelector(".alui-observe-chip-label");
		var nextLabel = isEnemy ? row.name : row.level + " " + row.name;
		if (label && label.textContent !== nextLabel) label.textContent = nextLabel;
		var hp = el.querySelector(".alui-observe-chip-hp i");
		if (hp) {
			hp.style.width = row.healthPercent + "%";
			if (!isEnemy) {
				var color = CLASS_COLORS[row.ctype] || "#888";
				if (hp.style.backgroundColor !== color && hp.style.background !== color) hp.style.background = color;
			}
		}
		if (!isEnemy) {
			var mp = el.querySelector(".alui-observe-chip-mp i");
			if (mp) mp.style.width = row.manaPercent + "%";
		}
	}

	function setPanelVisible(root, visible) {
		if (!root) return;
		if (visible) {
			root.classList.remove("alui-hidden-empty");
			root.style.display = "";
		} else {
			root.classList.add("alui-hidden-empty");
			root.style.display = "none";
		}
	}

	function renderRoster(root, slice) {
		if (!root) return;
		var parties = (slice && slice.parties) || [];
		if (!parties.length) {
			root.innerHTML = '<div class="alui-observe-empty">No parties in vision</div>';
			root.setAttribute("data-struct", "");
			setPanelVisible(root, true);
			return;
		}

		var struct = partyStructureKey(parties);
		if (root.getAttribute("data-struct") === struct) {
			var flat = [];
			for (var p = 0; p < parties.length; p++) {
				var members = parties[p].members || [];
				for (var m = 0; m < members.length; m++) flat.push(members[m]);
			}
			var nodes = root.querySelectorAll("[data-entity-id]");
			for (var i = 0; i < nodes.length && i < flat.length; i++) patchChip(nodes[i], flat[i], false);
			setPanelVisible(root, true);
			return;
		}

		var escapeHtml = global.ALUI.escapeHtml;
		var html = "";
		for (var i2 = 0; i2 < parties.length; i2++) {
			var party = parties[i2];
			html += '<div class="alui-observe-party">';
			html += '<div class="alui-observe-party-label">' + (party.id ? escapeHtml(party.id) : "(no party)") + "</div>";
			html += '<div class="alui-observe-party-chips">';
			var mem = party.members || [];
			for (var j = 0; j < mem.length; j++) html += memberChipHtml(mem[j]);
			html += "</div></div>";
		}
		root.innerHTML = html;
		root.setAttribute("data-struct", struct);
		setPanelVisible(root, true);
	}

	function renderAggro(root, slice) {
		if (!root) return;
		var enemies = (slice && slice.enemies) || [];
		if (!enemies.length) {
			root.innerHTML = "";
			root.setAttribute("data-struct", "");
			setPanelVisible(root, false);
			return;
		}
		var struct = structureKey(enemies);
		if (root.getAttribute("data-struct") === struct) {
			var nodes = root.querySelectorAll("[data-entity-id]");
			for (var i = 0; i < nodes.length && i < enemies.length; i++) patchChip(nodes[i], enemies[i], true);
			setPanelVisible(root, true);
			return;
		}
		var html = '<div class="alui-observe-party"><div class="alui-observe-party-label">Aggro</div>';
		html += '<div class="alui-observe-party-chips">';
		for (var k = 0; k < enemies.length; k++) html += enemyChipHtml(enemies[k]);
		html += "</div></div>";
		root.innerHTML = html;
		root.setAttribute("data-struct", struct);
		setPanelVisible(root, true);
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
						offsetY: 8,
						grow: "down",
						zIndex: 200,
					},
				},
				"observe-aggro": {
					enabled: true,
					layout: {
						anchorX: "right",
						anchorY: "top",
						offsetX: 8,
						offsetY: 8,
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
		global.ALUI.config.registerSetting({
			path: "frames.observe-aggro.enabled",
			label: "Enabled",
			type: "boolean",
			group: "Observe Aggro",
		});
		if (typeof global.ALUI.config.registerLayoutSettings === "function") {
			global.ALUI.config.registerLayoutSettings("observe-roster", "Observe Roster", {});
			global.ALUI.config.registerLayoutSettings("observe-aggro", "Observe Aggro", {});
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
				render: renderRoster,
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
		global.ALUI.defineWidget(
			"observe-aggro",
			global.ALUI.createPanelRenderer("observe-aggro", {
				createContainer: true,
				containerClass: "alui-observe-panel alui-observe-aggro enableclicks",
				insertAfter: "topmid",
				layoutConfigPath: "frames.observe-aggro.layout",
				onClick: handleRowClick,
				render: renderAggro,
			}),
			{
				edit: {
					label: "Observe Aggro",
					kind: "panel",
					layoutPath: "frames.observe-aggro.layout",
					draggable: true,
					order: 11,
				},
			},
		);
	}

	if (typeof global.ALUI.registerPublisher === "function") {
		global.ALUI.registerPublisher("observe-roster", buildRosterSlice, {
			on: ["update_overlays", "reset_topleft"],
			signature: rosterSignature,
		});
		global.ALUI.registerPublisher("observe-aggro", buildAggroSlice, {
			on: ["update_overlays", "reset_topleft"],
			signature: aggroSignature,
		});
	}
})(typeof window !== "undefined" ? window : global);
