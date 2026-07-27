#!/usr/bin/env node
/**
 * Import JSON map geometry from design/maps/*.json into MongoDB as MP_<name> docs.
 * Used by community seed so forked design trees (e.g. bee dungeon) are playable.
 */
var fs = require("fs");
var path = require("path");
var { MongoClient } = require("mongodb");
var keys = require("../secretsandconfig/keys");
var design_loader = require("../design_loader");

function maps_dir() {
	return path.join(design_loader.design_root(), "maps");
}

async function run() {
	var dir = maps_dir();
	if (!fs.existsSync(dir)) {
		console.log("[import_design_maps] no maps dir at", dir);
		return;
	}

	var files = fs.readdirSync(dir).filter(function (f) {
		return f.endsWith(".json");
	});
	if (!files.length) {
		console.log("[import_design_maps] no JSON maps in", dir);
		return;
	}

	var client = new MongoClient(keys.mongodb_uri, keys.mongodb_config);
	await client.connect();
	var db = client.db(keys.mongodb_name);

	for (var i = 0; i < files.length; i++) {
		var name = files[i].replace(/\.json$/, "");
		var data = JSON.parse(fs.readFileSync(path.join(dir, files[i]), "utf8"));
		var map = {
			_id: "MP_" + name,
			name: name,
			created: new Date(),
			updated: new Date(),
			player: false,
			info: { data: data },
			blobs: ["info"],
		};
		await db.collection("map").replaceOne({ _id: map._id }, map, { upsert: true });
		console.log("[import_design_maps] upserted", map._id);
	}

	await client.close();
}

run().catch(function (e) {
	console.error(e);
	process.exit(1);
});
