/**
 * Worker thread: run server_bfs for a batch of maps.
 * Expects workerData: { map_names, maps, geometry, options }
 */
const { parentPort, workerData } = require("worker_threads");
const fs = require("fs");
const path = require("path");

var Place = "bfs";
var options = workerData.options || {};
var Dev = !!options.Dev;
var Local = !!options.Local;
var Prod = !!options.Prod;
var Staging = !!options.Staging;
var Engine = options.Engine || "mongodb";
var precomputed = { images: {} };
var precomputed_bfs = null;
var gameplay = "normal";
var is_pvp = false;
var mode = {};
var server = { shutdown: true };
var server_id = "precompute-worker";
var keys = { SERVER_MASTER: "worker" };
function post_get_init_user() {}
function post_get_init_character() {}

eval("" + fs.readFileSync(path.resolve(__dirname, "../common/js/common_functions.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "../js/old_common_functions.js")));
eval("" + fs.readFileSync(path.resolve(__dirname, "server_functions.js")));

// common_functions.js resets `var G = {}` — assign after evals
G = {
	version: workerData.version,
	maps: workerData.maps,
	geometry: workerData.geometry,
};

// Link map.data like sprocess_game_data does for geometry consumers
for (var mname in G.maps) {
	if (G.geometry[mname]) {
		G.maps[mname].data = G.geometry[mname];
	}
}

var timings = [];
var map_names = workerData.map_names || [];
for (var i = 0; i < map_names.length; i++) {
	var name = map_names[i];
	var cstart = new Date();
	server_bfs(name);
	var ms = mssince(cstart);
	timings.push({ map: name, ms: ms });
}

parentPort.postMessage({
	amap_data: amap_data,
	smap_data: smap_data,
	timings: timings,
});
process.exit(0);
