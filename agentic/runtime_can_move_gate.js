/**
 * Runtime can_move agreement + microbench gate for Layer 3.
 *
 * Usage:
 *   NODE_PATH=node/node_modules node agentic/runtime_can_move_gate.js
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
process.chdir(root);

var Place = "bfs";
var keys = require("../secretsandconfig/keys");
var options = require("../secretsandconfig/options");
var Dev = options.Dev;
var Local = options.Local;
var Prod = options.Prod;
var Staging = options.Staging;
var Engine = options.Engine;
var precomputed = null;
var precomputed_bfs = null;
var G = {};
var D = {};
var S = {};
var gameplay = "normal";
var is_pvp = false;
var mode = {};
var server_id = "can-move-gate";
var server_auth = keys.SERVER_MASTER;
var perfc = { roam_ops: 0 };

MongoClient = require("mongodb").MongoClient;
client = new MongoClient(keys.mongodb_uri, keys.mongodb_config);

function post_get_init_user() {}
function post_get_init_character() {}

eval("" + fs.readFileSync(path.resolve(__dirname, "../common/js/common_functions.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "../js/old_common_functions.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "../models.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "../common/mongodb_functions.js")));

function sample_entity(map, with_base) {
	var geo = G.geometry[map] || {};
	var xs = (geo.x_lines || []).map(function (l) {
		return l[0];
	});
	var ys = (geo.y_lines || []).map(function (l) {
		return l[0];
	});
	var minx = xs.length ? Math.min.apply(null, xs) : -100;
	var maxx = xs.length ? Math.max.apply(null, xs) : 100;
	var miny = ys.length ? Math.min.apply(null, ys) : -100;
	var maxy = ys.length ? Math.max.apply(null, ys) : 100;
	var x = minx + Math.random() * (maxx - minx);
	var y = miny + Math.random() * (maxy - miny);
	var dx = (Math.random() - 0.5) * 80;
	var dy = (Math.random() - 0.5) * 80;
	var ent = { map: map, x: x, y: y, going_x: x + dx, going_y: y + dy };
	if (with_base) ent.base = { h: 9, v: 9, vn: 2 };
	return ent;
}

async function main() {
	await client.connect();
	db = client.db(keys.mongodb_name);
	eval("" + fs.readFileSync(path.resolve(__dirname, "../node/server_functions.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/projectiles.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/animations.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/achievements.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/game_design.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/games.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/conditions.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/sprites.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/dimensions.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/monsters.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/maps.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/npcs.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/multipliers.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/items.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/classes.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/levels.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/upgrades.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/drops.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/skills.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/events.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/recipes.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/titles.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/tokens.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/cosmetics.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/emotions.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../design/precomputed_images.js")));
	eval("" + fs.readFileSync(path.resolve(__dirname, "../version.js")));

	var geometry = {};
	var rpc = {};
	for (var id in maps) {
		if (maps[id].ignore) continue;
		rpc[id] = get("MP_" + maps[id].key);
	}
	for (var id in maps) {
		if (maps[id].ignore) continue;
		var mapdoc = await rpc[id];
		if (mapdoc) geometry[id] = mapdoc.info.data;
	}
	G = {
		version: Version,
		maps: maps,
		geometry: geometry,
		items: items,
		monsters: monsters,
		npcs: npcs,
		sprites: sprites,
		images: precomputed.images,
	};
	for (var mname in G.maps) {
		if (G.geometry[mname]) G.maps[mname].data = G.geometry[mname];
	}

	var maps_to_test = ["main", "winterland", "desertland"].filter(function (m) {
		return G.geometry[m];
	});
	var samples = 5000;
	var disagree = 0;
	var checked = 0;
	for (var mi = 0; mi < maps_to_test.length; mi++) {
		var map = maps_to_test[mi];
		bfs_ensure_geo_index(map);
		for (var i = 0; i < samples; i++) {
			var ent = sample_entity(map, i % 2 === 0);
			var classic = !!can_move(ent);
			var fast = !!server_can_move(ent);
			checked++;
			if (classic !== fast) disagree++;
		}
	}
	var agree_pct = (((checked - disagree) / checked) * 100).toFixed(4);

	var bench_map = maps_to_test[0];
	var ents = [];
	for (var j = 0; j < 2000; j++) ents.push(sample_entity(bench_map, true));
	var t0 = Date.now();
	for (var a = 0; a < ents.length; a++) can_move(ents[a]);
	var classic_ms = Date.now() - t0;
	t0 = Date.now();
	for (var b = 0; b < ents.length; b++) server_can_move(ents[b]);
	var fast_ms = Date.now() - t0;

	var report =
		"\n## L3 runtime server_can_move\n\n" +
		"- Agreement samples: " +
		checked +
		", disagreements: " +
		disagree +
		" (" +
		agree_pct +
		"% agree)\n" +
		"- Microbench " +
		ents.length +
		" rect moves on `" +
		bench_map +
		"`: classic " +
		classic_ms +
		"ms → fast " +
		fast_ms +
		"ms\n" +
		"- Gate: " +
		(disagree === 0 ? "PASS (exact boolean match on samples)" : "REVIEW (disagreements found)") +
		"\n" +
		"- Takeaway: boolean roam/NPC paths use server_can_move; calculate_move keeps classic can_move.\n";

	fs.appendFileSync(path.join(__dirname, "precompute-perf-log.md"), report);
	console.log(report);
	await client.close();
	process.exit(disagree === 0 ? 0 : 3);
}

main().catch(function (e) {
	console.error(e);
	process.exit(1);
});
