#!/usr/bin/env node
/**
 * Lightweight HTTP smoke for community prod / smoke stacks (B1 surface checks).
 * Usage: node scripts/smoke_community_prod.js [baseUrl]
 */
var base = process.argv[2] || process.env.COMMUNITY_BASE_URL || "http://localhost:18090";

function get(path) {
	return new Promise(function (resolve, reject) {
		var lib = base.indexOf("https") === 0 ? require("https") : require("http");
		var url = base.replace(/\/$/, "") + path;
		lib
			.get(url, function (res) {
				var body = "";
				res.on("data", function (c) {
					body += c;
				});
				res.on("end", function () {
					resolve({ status: res.statusCode, body: body });
				});
			})
			.on("error", reject);
	});
}

async function run() {
	var failed = 0;
	var checks = [
		[
			"GET /",
			"/",
			function (r) {
				return r.status === 200;
			},
		],
		[
			"GET /ladder/community",
			"/ladder/community",
			function (r) {
				return r.status === 200 && r.body.indexOf("Level") !== -1;
			},
		],
		[
			"GET /ladder (default)",
			"/ladder",
			function (r) {
				return r.status === 200;
			},
		],
		[
			"GET /community blurb",
			"/community",
			function (r) {
				return r.status === 200 && r.body.indexOf("adventure.land") !== -1;
			},
		],
		[
			"GET /shells disabled",
			"/shells",
			function (r) {
				return r.status === 200 && r.body.indexOf("disabled") !== -1;
			},
		],
		[
			"GET /terms (community)",
			"/terms",
			function (r) {
				return r.status === 200 && (r.body.indexOf("Community") !== -1 || r.body.indexOf("adventure.land") !== -1);
			},
		],
		[
			"GET /privacy (community)",
			"/privacy",
			function (r) {
				return r.status === 200;
			},
		],
		[
			"GET / selection banner",
			"/",
			function (r) {
				return r.status === 200 && r.body.indexOf("Community host") !== -1;
			},
		],
	];

	console.log("[smoke] base:", base);
	for (var i = 0; i < checks.length; i++) {
		var label = checks[i][0];
		var path = checks[i][1];
		var ok = checks[i][2];
		try {
			var res = await get(path);
			if (ok(res)) console.log("  ok", label, res.status);
			else {
				console.error(" FAIL", label, res.status);
				failed++;
			}
		} catch (e) {
			console.error(" FAIL", label, e.message);
			failed++;
		}
	}

	if (failed) {
		console.error("[smoke]", failed, "check(s) failed");
		process.exit(1);
	}
	console.log("[smoke] all checks passed");
}

run();
