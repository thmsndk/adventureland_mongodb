/**
 * Selectors: game state → widget slices.
 */
(function (global) {
	/**
	 * Visible buff/debuff entries for a unit's status map (character.s / monster.s).
	 * @param {object} entity
	 * @returns {Array<{id:string,skin:string,debuff:boolean,type:string,ms?:number}>}
	 */
	function buildEntityEffects(entity) {
		var effects = [];
		if (!entity || !entity.s || typeof G === "undefined") return effects;

		for (var condition in entity.s) {
			if (!Object.prototype.hasOwnProperty.call(entity.s, condition)) continue;

			if (G.skills && G.skills[condition] && G.skills[condition].ui) {
				effects.push({
					id: condition,
					type: "skill",
					skin: G.skills[condition].skin,
					debuff: false,
					ms: entity.s[condition] && entity.s[condition].ms,
				});
				continue;
			}

			var prop = G.conditions && G.conditions[condition];
			var actual = entity.s[condition];
			if (!actual) continue;
			if (!actual.skin && (!prop || (!prop.ui && (!actual.s || actual.s < 20)))) continue;

			effects.push({
				id: condition,
				type: "condition",
				skin: actual.skin || (prop && prop.skin),
				debuff: !!(prop && prop.debuff),
				ms: actual.ms,
			});
		}

		return effects;
	}

	function effectsKey(effects) {
		if (!effects || !effects.length) return "";
		var ids = [];
		for (var i = 0; i < effects.length; i++) ids.push(effects[i].id);
		ids.sort();
		return ids.join("|");
	}

	function isEntityDead(entity) {
		if (!entity) return false;
		if (entity.rip) return true;
		if (entity.dead) return true;
		if (typeof entity.hp === "number" && entity.hp <= 0) return true;
		return false;
	}

	/**
	 * Monster difficulty label from calculate_difficulty (Easy / Challenging / Hard).
	 * @param {object} target
	 * @returns {{diff:number,diffLabel:string,diffColor:string}|null}
	 */
	function buildTargetDiff(target) {
		if (!target || target.type !== "monster") return null;
		if (typeof calculate_difficulty !== "function") return null;
		var diff = calculate_difficulty(target);
		if (diff >= 2) return { diff: 2, diffLabel: "Hard", diffColor: "#FF6B6B" };
		if (diff) return { diff: 1, diffLabel: "Challenging", diffColor: "#FFB347" };
		return { diff: 0, diffLabel: "Easy", diffColor: "#B8FF6A" };
	}

	function entityAppearance(entity) {
		if (!entity) return { skin: "", cx: {}, mtype: "", kind: "" };
		var kind = entity.type || "";
		var mtype = entity.mtype || "";
		if (!mtype && kind && typeof G !== "undefined" && G.monsters && G.monsters[kind]) {
			mtype = kind;
			kind = "monster";
		}
		var skin = typeof entity.skin === "string" ? entity.skin : "";
		if (mtype && typeof G !== "undefined" && G.monsters && G.monsters[mtype]) {
			if (!skin) skin = G.monsters[mtype].skin || mtype;
		}
		if (!skin && mtype) skin = mtype;
		// Character cosmetics only — monster HTML sprites break if character cx leaks in.
		var cx = {};
		if (kind === "character" && entity.cx && typeof entity.cx === "object" && !Array.isArray(entity.cx)) {
			cx = entity.cx;
		}
		return { skin: skin, cx: cx, mtype: mtype, kind: kind };
	}

	function buildPlayerFrame(character) {
		if (!character) return null;
		var effects = buildEntityEffects(character);
		var dead = isEntityDead(character);
		var look = entityAppearance(character);
		return {
			name: character.name || "Unknown",
			level: character.level,
			healthPercent: dead ? 0 : Math.round((character.hp / character.max_hp) * 100),
			manaPercent: Math.round((character.mp / character.max_mp) * 100),
			hp: dead ? 0 : character.hp,
			maxHp: character.max_hp,
			mp: character.mp,
			maxMp: character.max_mp,
			dead: dead,
			skin: look.skin,
			cx: look.cx,
			mtype: look.mtype,
			entityType: look.kind,
			effects: effects,
			effectsKey: effectsKey(effects),
		};
	}

	function buildTargetFrame(target) {
		if (!target) return null;
		var maxHp = target.max_hp || 1;
		var maxMp = target.max_mp || 1;
		var effects = buildEntityEffects(target);
		var dead = isEntityDead(target);
		var difficulty = buildTargetDiff(target);
		var look = entityAppearance(target);
		return {
			id: target.id,
			name: target.name || "Unknown",
			level: target.level,
			healthPercent: dead ? 0 : Math.round((target.hp / maxHp) * 100),
			manaPercent: Math.round((target.mp / maxMp) * 100),
			hp: dead ? 0 : target.hp,
			maxHp: maxHp,
			mp: target.mp || 0,
			maxMp: maxMp,
			dead: dead,
			skin: look.skin,
			cx: look.cx,
			mtype: look.mtype,
			entityType: look.kind,
			diff: difficulty ? difficulty.diff : null,
			diffLabel: difficulty ? difficulty.diffLabel : "",
			diffColor: difficulty ? difficulty.diffColor : "",
			effects: effects,
			effectsKey: effectsKey(effects),
		};
	}

	/**
	 * Soft hover target (window.mtarget) for the hover-frame.
	 * Read from the game global object (same pattern as init reading global.ctarget).
	 * Hidden when empty, self, dead, or removed from entities (mouseout often skips on death).
	 */
	function getHoverEntity() {
		var hover = global.mtarget;
		if (!hover) return null;

		var stale = !!hover.dead;
		if (!stale && hover.id != null && hover !== global.character && global.entities && !global.entities[hover.id]) {
			stale = true;
		}
		if (stale) {
			if (global.mtarget === hover) global.mtarget = null;
			return null;
		}

		var me = global.character;
		if (me && (hover === me || hover.me === true || (hover.id != null && me.id != null && String(hover.id) === String(me.id)))) {
			return null;
		}
		return hover;
	}

	function buildHoverFrame() {
		return buildTargetFrame(getHoverEntity());
	}

	/**
	 * Resolve who an entity is attacking (parent-side; mirrors code get_target_of).
	 */
	function resolveTargetOf(entity) {
		if (!entity || entity.target == null || entity.target === "") return null;
		var me = global.character;
		if (me && (me.id == entity.target || me.name == entity.target)) return me;
		if (!global.entities) return null;
		if (global.entities[entity.target]) return global.entities[entity.target];
		for (var id in global.entities) {
			if (!Object.prototype.hasOwnProperty.call(global.entities, id)) continue;
			var e = global.entities[id];
			if (e && (e.id == entity.target || e.name == entity.target)) return e;
		}
		return null;
	}

	function buildTotFrame() {
		var target = global.ctarget || null;
		if (!target) return null;
		return buildTargetFrame(resolveTargetOf(target));
	}

	function registerUnitFrameConfig() {
		if (!global.ALUI.config) return;
		global.ALUI.config.registerDefaults({
			frames: {
				"player-frame": { enabled: true, size: "full", label: "Player", source: "character" },
				"target-frame": { enabled: true, size: "full", label: "Target", source: "ctarget" },
				"hover-frame": { enabled: true, size: "compact", label: "Hover", source: "mtarget", anchor: "cursor" },
				"tot-frame": {
					enabled: true,
					size: "compact",
					label: "Target’s Target",
					source: "ctarget.target",
					parent: "target-frame",
					anchor: "parent",
				},
			},
		});
		global.ALUI.config.registerSetting({ path: "frames.player-frame.enabled", label: "Player", type: "boolean" });
		global.ALUI.config.registerSetting({ path: "frames.target-frame.enabled", label: "Target", type: "boolean" });
		global.ALUI.config.registerSetting({ path: "frames.hover-frame.enabled", label: "Hover", type: "boolean" });
		global.ALUI.config.registerSetting({ path: "frames.tot-frame.enabled", label: "Target’s Target", type: "boolean" });
	}

	/**
	 * Stable bus signature for unit-frame slices: ignore volatile effect.ms so
	 * ticking buffs don't redraw HP/MP; widget refreshes tints via effectsKey.
	 */
	function unitFrameSignature(payload) {
		if (payload === null || payload === undefined) return "\0";
		var cx = "";
		try {
			cx = JSON.stringify(payload.cx || {});
		} catch (e) {
			cx = "";
		}
		return [
			payload.id,
			payload.name,
			payload.level,
			payload.hp,
			payload.maxHp,
			payload.mp,
			payload.maxMp,
			payload.healthPercent,
			payload.manaPercent,
			payload.dead ? "1" : "0",
			payload.skin || "",
			payload.mtype || "",
			cx,
			payload.diff,
			payload.diffLabel,
			payload.effectsKey,
		].join("\x1f");
	}

	function registerUnitFramePublishers() {
		if (typeof global.ALUI.registerPublisher !== "function") return;
		var overlayOpts = { on: ["update_overlays"], signature: unitFrameSignature };
		var targetOpts = { on: ["update_overlays", "reset_topleft"], signature: unitFrameSignature };
		global.ALUI.registerPublisher(
			"player-frame",
			function () {
				return buildPlayerFrame(global.character);
			},
			overlayOpts,
		);
		global.ALUI.registerPublisher(
			"target-frame",
			function () {
				return buildTargetFrame(global.ctarget || null);
			},
			targetOpts,
		);
		global.ALUI.registerPublisher(
			"hover-frame",
			function () {
				return buildHoverFrame();
			},
			targetOpts,
		);
		global.ALUI.registerPublisher(
			"tot-frame",
			function () {
				return buildTotFrame();
			},
			targetOpts,
		);
	}

	registerUnitFrameConfig();
	registerUnitFramePublishers();

	global.ALUI = global.ALUI || {};
	global.ALUI.buildPlayerFrame = buildPlayerFrame;
	global.ALUI.buildTargetFrame = buildTargetFrame;
	global.ALUI.buildHoverFrame = buildHoverFrame;
	global.ALUI.buildTotFrame = buildTotFrame;
	global.ALUI.getHoverEntity = getHoverEntity;
	global.ALUI.buildEntityEffects = buildEntityEffects;
})(typeof window !== "undefined" ? window : global);
