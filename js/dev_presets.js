/**
 * Dev/admin ACCESS presets. Seeded into saved_access_snippets when missing.
 * Keep content-agnostic of feature/bee_dungeon shipping — stack this branch locally for playtests.
 */
(function (global) {
	var bee_playtest =
		"// bee_playtest — lvl 25 + wanderers ~+7 + potions (+ beekey if present)\n" +
		"// Character must be online (ACCESS binds player to your socket).\n" +
		"if (!player) {\n" +
		'\toutput = "No player — enter the game first";\n' +
		"} else {\n" +
		"\tplayer.level = 25;\n" +
		"\tplayer.xp = 0;\n" +
		"\tif (!player.slots) player.slots = {};\n" +
		"\tif (!player.cslots) player.cslots = {};\n" +
		"\tfunction _equip(slot, name, level) {\n" +
		"\t\tif (!G.items[name]) return;\n" +
		"\t\tvar item = create_new_item(name);\n" +
		'\t\tif (typeof level === "number") item.level = level;\n' +
		"\t\tplayer.slots[slot] = item;\n" +
		"\t\tplayer.cslots[slot] = cache_item(item);\n" +
		"\t}\n" +
		"\tvar armor_lvl = 7;\n" +
		'\t_equip("helmet", "wcap", armor_lvl);\n' +
		'\t_equip("chest", "wattire", armor_lvl);\n' +
		'\t_equip("pants", "wbreeches", armor_lvl);\n' +
		'\t_equip("gloves", "wgloves", armor_lvl);\n' +
		'\t_equip("shoes", "wshoes", armor_lvl);\n' +
		"\tvar ctype = player.ctype || player.type;\n" +
		'\tvar main = { warrior: "blade", paladin: "blade", mage: "staff", priest: "staff", ranger: "bow", rogue: "dagger", merchant: "staff" };\n' +
		'\t_equip("mainhand", main[ctype] || "blade", 7);\n' +
		"\tfunction _give(name, q) {\n" +
		"\t\tif (!G.items[name]) return;\n" +
		"\t\tvar it = create_new_item(name, q || 1);\n" +
		"\t\tif (q && G.items[name].s) it.q = q;\n" +
		"\t\tadd_item(player, it, { announce: false });\n" +
		"\t}\n" +
		'\t_give("hpot1", 200);\n' +
		'\t_give("mpot1", 200);\n' +
		'\t_give("beekey", 1);\n' +
		"\tcalculate_player_stats(player);\n" +
		'\toutput = "bee_playtest applied to " + player.name + " (" + ctype + " lvl " + player.level + ")";\n' +
		"}\n";

	global.DEV_ACCESS_PRESETS = [
		{
			name: "bee_playtest",
			code: bee_playtest,
		},
	];
})(typeof window !== "undefined" ? window : globalThis);
