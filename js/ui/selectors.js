/**
 * Selectors: game state → widget slices.
 */
(function (global) {
	function buildPlayerFrame(character) {
		if (!character) return null;
		return {
			name: character.name || "Unknown",
			level: character.level,
			healthPercent: Math.round((character.hp / character.max_hp) * 100),
			manaPercent: Math.round((character.mp / character.max_mp) * 100),
			hp: character.hp,
			maxHp: character.max_hp,
			mp: character.mp,
			maxMp: character.max_mp,
		};
	}

	function buildTargetFrame(target) {
		if (!target) return null;
		var maxHp = target.max_hp || 1;
		var maxMp = target.max_mp || 1;
		return {
			name: target.name || "Unknown",
			level: target.level,
			healthPercent: Math.round((target.hp / maxHp) * 100),
			manaPercent: Math.round((target.mp / maxMp) * 100),
			hp: target.hp,
			maxHp: maxHp,
			mp: target.mp || 0,
			maxMp: maxMp,
		};
	}

	global.ALUI = global.ALUI || {};
	global.ALUI.buildPlayerFrame = buildPlayerFrame;
	global.ALUI.buildTargetFrame = buildTargetFrame;
})(typeof window !== "undefined" ? window : global);
