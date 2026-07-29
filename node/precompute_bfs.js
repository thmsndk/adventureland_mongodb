var Place = "bfs";
var keys = require("../secretsandconfig/keys");
var options = require("../secretsandconfig/options");
var Dev = options.Dev;
var Local = options.Local;
var Prod = options.Prod;
var Staging = options.Staging;
var Engine = options.Engine;
var fs = require("fs");
const path = require("node:path");
const os = require("node:os");
const { Worker } = require("node:worker_threads");
var precomputed = null;
var precomputed_bfs = null;
var G = {};
var D = {};
var S = {};
var gameplay = "normal";
var is_pvp = false;
var mode = {};
var server_id = "precompute";
var server_auth = keys.SERVER_MASTER;

// MongoDB connection
MongoClient = require("mongodb").MongoClient;
client = new MongoClient(keys.mongodb_uri, keys.mongodb_config);

// Stub functions needed by models.js
function post_get_init_user() {}
function post_get_init_character() {}

eval("" + fs.readFileSync(path.resolve(__dirname, "../common/js/common_functions.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "../js/old_common_functions.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "../models.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "../common/mongodb_functions.js")));

async function run() {
	await client.connect();
	db = client.db(keys.mongodb_name);
	console.log("Connected to MongoDB: " + keys.mongodb_name);

	// Load server_functions and design files in same scope
	eval("" + fs.readFileSync(path.resolve(__dirname, "server_functions.js")));
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

	// Force full recompute unless PRECOMPUTE_USE_CACHE=1
	if (process.env.PRECOMPUTE_USE_CACHE !== "1") {
		precomputed_bfs = null;
	}

	// Load geometry from MongoDB
	var geometry = {};
	var rpc = {};
	for (var id in maps) {
		if (maps[id].ignore) continue;
		var key = maps[id].key;
		rpc[id] = get("MP_" + key);
	}
	for (var id in maps) {
		if (maps[id].ignore) continue;
		var map = await rpc[id];
		if (map) geometry[id] = map.info.data;
	}

	// Build G
	G = {
		version: Version,
		achievements: achievements,
		animations: animations,
		monsters: monsters,
		sprites: sprites,
		maps: maps,
		geometry: geometry,
		npcs: npcs,
		tilesets: tilesets,
		imagesets: imagesets,
		items: items,
		sets: sets,
		craft: craft,
		titles: titles,
		tokens: tokens,
		dismantle: dismantle,
		conditions: conditions,
		cosmetics: cosmetics,
		emotions: emotions,
		projectiles: projectiles,
		classes: classes,
		dimensions: dimensions,
		levels: levels,
		positions: positions,
		skills: skills,
		games: games,
		events: events,
		images: precomputed.images,
		multipliers: multipliers,
	};

	D = {
		upgrades: upgrades,
		drops: drops,
		compounds: compounds,
		monster_gold: monster_gold,
		odds: typeof odds !== "undefined" && odds,
	};

	// Process game data (links G.maps[name].data = G.geometry[name])
	sprocess_game_data();

	// Run BFS for all maps (sorted for stable timing tables / JSON merge order)
	var map_names = Object.keys(G.maps)
		.filter(function (mname) {
			return !G.maps[mname].ignore;
		})
		.sort();
	var timings = [];
	var start = new Date();

	var worker_count = parseInt(process.env.PRECOMPUTE_WORKERS || "", 10);
	if (!(worker_count > 0)) {
		worker_count = Math.max(1, (os.cpus() || []).length - 1);
	}
	// Cap for docker / small hosts; sequential when 1
	if (worker_count > map_names.length) worker_count = map_names.length;

	if (worker_count <= 1) {
		for (var mi = 0; mi < map_names.length; mi++) {
			var mname = map_names[mi];
			var cstart = new Date();
			server_bfs(mname);
			var ms = mssince(cstart);
			timings.push({ map: mname, ms: ms });
			console.log("Precomputed: " + mname + " in " + ms + "ms");
		}
	} else {
		console.log("Parallel precompute: " + worker_count + " workers for " + map_names.length + " maps");
		// Greedy balance by prior per-map ms (champion meta) when available,
		// else geometry line count. Spreads outliers like shellsisland.
		var known_ms = Object.create(null);
		try {
			var champ_meta_path =
				process.env.PRECOMPUTE_CHAMPION_META ||
				path.resolve(__dirname, "../agentic/precompute-dumps/champion.meta.json");
			if (fs.existsSync(champ_meta_path)) {
				var champ_meta = JSON.parse(fs.readFileSync(champ_meta_path, "utf8"));
				var ct = champ_meta.timings || [];
				for (var ci = 0; ci < ct.length; ci++) {
					known_ms[ct[ci].map] = ct[ci].ms;
				}
			}
		} catch (e) {
			/* ignore — fall back to line counts */
		}
		function map_cost(id) {
			if (known_ms[id] != null) return known_ms[id];
			var g = G.geometry[id] || {};
			return (g.x_lines || []).length + (g.y_lines || []).length;
		}
		var ranked = map_names.slice().sort(function (a, b) {
			return map_cost(b) - map_cost(a);
		});
		var batches = [];
		var loads = [];
		for (var b = 0; b < worker_count; b++) {
			batches.push([]);
			loads.push(0);
		}
		for (var ri = 0; ri < ranked.length; ri++) {
			var id = ranked[ri];
			var cost = map_cost(id);
			var best = 0;
			for (var wi = 1; wi < worker_count; wi++) {
				if (loads[wi] < loads[best]) best = wi;
			}
			batches[best].push(id);
			loads[best] += cost;
		}
		var node_path = process.env.NODE_PATH || path.resolve(__dirname, "node_modules");
		var worker_results = await Promise.all(
			batches.map(function (batch) {
				if (!batch.length) {
					return Promise.resolve({ amap_data: {}, smap_data: {}, timings: [] });
				}
				var maps_slice = {};
				var geometry_slice = {};
				for (var si = 0; si < batch.length; si++) {
					var mid = batch[si];
					maps_slice[mid] = G.maps[mid];
					geometry_slice[mid] = G.geometry[mid];
				}
				return new Promise(function (resolve, reject) {
					var worker = new Worker(path.resolve(__dirname, "precompute_bfs_worker.js"), {
						workerData: {
							map_names: batch,
							maps: maps_slice,
							geometry: geometry_slice,
							version: G.version,
							options: {
								Dev: Dev,
								Local: Local,
								Prod: Prod,
								Staging: Staging,
								Engine: Engine,
								fast_sdk: 0,
							},
						},
						env: Object.assign({}, process.env, { NODE_PATH: node_path }),
					});
					worker.on("message", resolve);
					worker.on("error", reject);
					worker.on("exit", function (code) {
						if (code !== 0) reject(new Error("precompute worker exited " + code));
					});
				});
			}),
		);
		amap_data = {};
		smap_data = {};
		for (var wj = 0; wj < worker_results.length; wj++) {
			var wr = worker_results[wj];
			for (var am in wr.amap_data) {
				amap_data[am] = wr.amap_data[am];
			}
			for (var sm in wr.smap_data) {
				smap_data[sm] = wr.smap_data[sm];
			}
			for (var ti = 0; ti < wr.timings.length; ti++) {
				timings.push(wr.timings[ti]);
				console.log("Precomputed: " + wr.timings[ti].map + " in " + wr.timings[ti].ms + "ms");
			}
		}
	}

	var total_ms = mssince(start);
	console.log("Done: " + total_ms + "ms");
	timings.sort(function (a, b) {
		return b.ms - a.ms;
	});
	console.table(timings);

	// Write BFS data to node/precomputed_map_data.js (design/precomputed_images.js has images)
	var result = {};
	result.version = G.version;
	result.amap_data = amap_data;
	result.smap_data = smap_data;
	fs.writeFileSync(
		path.resolve(__dirname, "precomputed_map_data.js"),
		"// " + new Date() + "\nvar precomputed_bfs=" + JSON.stringify(result) + ";",
	);
	console.log("Written to: " + path.resolve(__dirname, "precomputed_map_data.js"));

	var dump_dir = process.env.PRECOMPUTE_DUMP_DIR;
	if (dump_dir) {
		fs.mkdirSync(dump_dir, { recursive: true });
		var label = process.env.PRECOMPUTE_LABEL || "run";
		var dump = {
			label: label,
			version: G.version,
			total_ms: total_ms,
			timings: timings,
			amap_data: amap_data,
			smap_data: smap_data,
		};
		var dump_path = path.join(dump_dir, label + ".json");
		fs.writeFileSync(dump_path, JSON.stringify(dump));
		var meta_path = path.join(dump_dir, label + ".meta.json");
		fs.writeFileSync(
			meta_path,
			JSON.stringify(
				{
					label: label,
					version: G.version,
					total_ms: total_ms,
					timings: timings,
					map_count: map_names.length,
					finished_at: new Date().toISOString(),
				},
				null,
				2,
			),
		);
		console.log("Dumped: " + dump_path);
		console.log("Meta: " + meta_path);
	}

	await client.close();
	process.exit(0);
}

run().catch(function (e) {
	console.error("Error:", e);
	process.exit(1);
});
