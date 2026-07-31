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

	function buildPlayerFrame(character) {
		if (!character) return null;
		var effects = buildEntityEffects(character);
		var dead = isEntityDead(character);
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
		return {
			name: target.name || "Unknown",
			level: target.level,
			healthPercent: dead ? 0 : Math.round((target.hp / maxHp) * 100),
			manaPercent: Math.round((target.mp / maxMp) * 100),
			hp: dead ? 0 : target.hp,
			maxHp: maxHp,
			mp: target.mp || 0,
			maxMp: maxMp,
			dead: dead,
			diff: difficulty ? difficulty.diff : null,
			diffLabel: difficulty ? difficulty.diffLabel : "",
			diffColor: difficulty ? difficulty.diffColor : "",
			effects: effects,
			effectsKey: effectsKey(effects),
		};
	}

	/**
	 * Click/focus target (xtarget). Hidden when empty or the same entity as combat ctarget.
	 * Uses bare globals (same as game UI). Does not require .visible — topleft also ignores it.
	 */
	function getFocusEntity() {
		if (typeof xtarget === "undefined" || !xtarget) return null;
		if (typeof ctarget !== "undefined" && ctarget && (xtarget === ctarget || (xtarget.id != null && xtarget.id === ctarget.id))) {
			return null;
		}
		return xtarget;
	}

	function buildFocusFrame() {
		return buildTargetFrame(getFocusEntity());
	}

	global.ALUI = global.ALUI || {};
	global.ALUI.buildPlayerFrame = buildPlayerFrame;
	global.ALUI.buildTargetFrame = buildTargetFrame;
	global.ALUI.buildFocusFrame = buildFocusFrame;
	global.ALUI.getFocusEntity = getFocusEntity;
	global.ALUI.buildEntityEffects = buildEntityEffects;
})(typeof window !== "undefined" ? window : global);
