#!/usr/bin/env node
/**
 * Grant a withdraw-only claim bank tab to a user (season migration / ops).
 *
 * Usage:
 *   node scripts/grant_claim_pack.js <email> [realm] [items-json]
 *
 * Examples:
 *   node scripts/grant_claim_pack.js you@example.com
 *   node scripts/grant_claim_pack.js you@example.com community '[{"name":"hpot0","q":50}]'
 *
 * Env: MONGO_URI / MONGO_DB, or secretsandconfig/keys.js (same as make_admin.js).
 */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

async function main() {
	var email = process.argv[2];
	var realm = process.argv[3] || "community";
	var itemsJson = process.argv[4] || "[]";
	if (!email) {
		console.error("Usage: node scripts/grant_claim_pack.js <email> [realm] [items-json]");
		process.exit(1);
	}

	var items = [];
	try {
		items = JSON.parse(itemsJson);
		if (!Array.isArray(items)) throw new Error("items must be an array");
	} catch (e) {
		console.error("Invalid items JSON:", e.message);
		process.exit(1);
	}

	var uri = process.env.MONGO_URI;
	var dbName = process.env.MONGO_DB || "adventureland";
	if (!uri) {
		try {
			var keys = require(path.resolve(__dirname, "../secretsandconfig/keys"));
			uri = keys.mongodb_uri;
			dbName = keys.mongodb_name || dbName;
		} catch (e) {
			console.error("Set MONGO_URI or provide secretsandconfig/keys.js");
			process.exit(1);
		}
	}

	try {
		global.options = require(path.resolve(__dirname, "../secretsandconfig/options"));
	} catch (e) {
		global.options = { default_league: "community", leagues: { community: {} } };
	}

	eval("" + fs.readFileSync(path.resolve(__dirname, "../adventure_functions.js"), "utf8"));

	var client = new MongoClient(uri);
	await client.connect();
	global.db = client.db(dbName);

	try {
		var marker = await db.collection("mark").findOne({ type: "email", phrase: email });
		if (!marker || !marker.owner) {
			console.error("No user found for email:", email);
			process.exit(1);
		}
		var user = await db.collection("user").findOne({ _id: marker.owner });
		if (!user) {
			console.error("No user doc for owner:", marker.owner);
			process.exit(1);
		}

		var pack = grant_withdraw_only_tabs(user, realm, items);
		if (!pack) {
			console.error("No free bank pack slot for claim tab on league:", realm);
			process.exit(1);
		}

		await db.collection("user").updateOne({ _id: user._id }, { $set: { info: user.info, updated: new Date() } });
		console.log("Granted withdraw-only claim tab", pack, "to", marker.owner, "league", realm, "items", items.length);
	} finally {
		await client.close();
	}
}

main().catch(function (e) {
	console.error(e);
	process.exit(1);
});
