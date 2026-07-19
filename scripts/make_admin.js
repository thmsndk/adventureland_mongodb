#!/usr/bin/env node
/**
 * Promote a user to admin by email (private servers; HTTP make-admin is disabled in common).
 *
 * Usage:
 *   node scripts/make_admin.js user@example.com
 *   MONGO_URI=mongodb://... MONGO_DB=adventureland node scripts/make_admin.js user@example.com
 */
const path = require("path");
const { MongoClient } = require("mongodb");
const { promote_admin_by_email } = require("./promote_admin_by_email");

async function main() {
	const email = process.argv[2];
	if (!email) {
		console.error("Usage: node scripts/make_admin.js <email>");
		process.exit(1);
	}

	let uri = process.env.MONGO_URI;
	let dbName = process.env.MONGO_DB || "adventureland";
	if (!uri) {
		try {
			const keys = require(path.resolve(__dirname, "../secretsandconfig/keys"));
			uri = keys.mongodb_uri;
			dbName = keys.mongodb_name || dbName;
		} catch (e) {
			console.error("Set MONGO_URI or provide secretsandconfig/keys.js");
			process.exit(1);
		}
	}

	const client = new MongoClient(uri);
	await client.connect();
	const db = client.db(dbName);
	const result = await promote_admin_by_email(db, email);
	if (!result.ok) {
		console.error(result.reason === "no_user" ? `No user found for email: ${email}` : result.reason);
		await client.close();
		process.exit(1);
	}
	console.log("Updated", result.owner, "matched", result.matchedCount, "modified", result.modifiedCount);
	await client.close();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
