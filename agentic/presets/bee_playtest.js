/**
 * ACCESS gameserver snippet body for bee dungeon playtests.
 * Also seeded via js/dev_presets.js → saved_access_snippets when Dev/admin.
 *
 * Requires: online character; stack bee content for beekey. Wanderers armor works without bee.
 *
 * Important: client gear UI reads player.cslots (not slots). Always set both.
 */
module.exports = {
	name: "bee_playtest",
	description: "Level 25, wanderers +7 armor, class weapon +7, potions, beekey if present",
	code: [
		"// bee_playtest — lvl 25 + wanderers ~+7 + potions (+ beekey if present)",
		"// Character must be online (ACCESS binds player to your socket).",
		"if (!player) {",
		'\toutput = "No player — enter the game first";',
		"} else {",
		"\tplayer.level = 25;",
		"\tplayer.xp = 0;",
		"\tif (!player.slots) player.slots = {};",
		"\tif (!player.cslots) player.cslots = {};",
		"\tfunction _equip(slot, name, level) {",
		"\t\tif (!G.items[name]) return;",
		"\t\tvar item = create_new_item(name);",
		'\t\tif (typeof level === "number") item.level = level;',
		"\t\tplayer.slots[slot] = item;",
		"\t\tplayer.cslots[slot] = cache_item(item);",
		"\t}",
		"\tvar armor_lvl = 7;",
		'\t_equip("helmet", "wcap", armor_lvl);',
		'\t_equip("chest", "wattire", armor_lvl);',
		'\t_equip("pants", "wbreeches", armor_lvl);',
		'\t_equip("gloves", "wgloves", armor_lvl);',
		'\t_equip("shoes", "wshoes", armor_lvl);',
		"\tvar ctype = player.ctype || player.type;",
		'\tvar main = { warrior: "blade", paladin: "blade", mage: "staff", priest: "staff", ranger: "bow", rogue: "dagger", merchant: "staff" };',
		'\t_equip("mainhand", main[ctype] || "blade", 7);',
		"\tfunction _give(name, q) {",
		"\t\tif (!G.items[name]) return;",
		"\t\tvar it = create_new_item(name, q || 1);",
		"\t\tif (q && G.items[name].s) it.q = q;",
		"\t\tadd_item(player, it, { announce: false });",
		"\t}",
		'\t_give("hpot1", 200);',
		'\t_give("mpot1", 200);',
		'\t_give("beekey", 1);',
		"\tcalculate_player_stats(player);",
		'\toutput = "bee_playtest applied to " + player.name + " (" + ctype + " lvl " + player.level + ")";',
		"}",
		"",
	].join("\n"),
};
