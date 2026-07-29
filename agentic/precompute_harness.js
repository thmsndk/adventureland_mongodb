/**
 * Agentic BFS precompute harness.
 *
 * Usage:
 *   node agentic/precompute_harness.js --label baseline --runs 2
 *   node agentic/precompute_harness.js --label L0 --runs 2 --compare baseline
 *
 * Env:
 *   PRECOMPUTE_DUMP_DIR (default: agentic/precompute-dumps)
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const dump_dir = process.env.PRECOMPUTE_DUMP_DIR || path.join(__dirname, "precompute-dumps");
const log_path = path.join(__dirname, "precompute-perf-log.md");

function parse_args(argv) {
	const out = { label: "run", runs: 2, compare: null };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--label") out.label = argv[++i];
		else if (a === "--runs") out.runs = parseInt(argv[++i], 10);
		else if (a === "--compare") out.compare = argv[++i];
	}
	return out;
}

function median(nums) {
	const s = nums.slice().sort((a, b) => a - b);
	const mid = Math.floor(s.length / 2);
	if (s.length % 2) return s[mid];
	return (s[mid - 1] + s[mid]) / 2;
}

function deep_equal(a, b) {
	if (a === b) return true;
	if (typeof a !== typeof b) return false;
	if (a === null || b === null) return a === b;
	if (typeof a !== "object") return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	const ak = Object.keys(a);
	const bk = Object.keys(b);
	if (ak.length !== bk.length) return false;
	for (let i = 0; i < ak.length; i++) {
		const k = ak[i];
		if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
		if (!deep_equal(a[k], b[k])) return false;
	}
	return true;
}

function first_diff(a, b, prefix) {
	if (a === b) return null;
	if (typeof a !== typeof b) return prefix + ": type " + typeof a + " vs " + typeof b;
	if (a === null || b === null) return prefix + ": " + a + " vs " + b;
	if (typeof a !== "object") return prefix + ": " + a + " vs " + b;
	if (Array.isArray(a) !== Array.isArray(b)) return prefix + ": array mismatch";
	const keys = Object.keys(a);
	for (let i = 0; i < keys.length; i++) {
		const k = keys[i];
		if (!Object.prototype.hasOwnProperty.call(b, k)) return prefix + "." + k + ": missing in b";
		const d = first_diff(a[k], b[k], prefix + "." + k);
		if (d) return d;
	}
	const bkeys = Object.keys(b);
	for (let i = 0; i < bkeys.length; i++) {
		const k = bkeys[i];
		if (!Object.prototype.hasOwnProperty.call(a, k)) return prefix + "." + k + ": missing in a";
	}
	return null;
}

function append_log(text) {
	if (!fs.existsSync(log_path)) {
		fs.writeFileSync(log_path, "# Precompute BFS performance log\n\nMeasured stack for faster BFS precompute.\n\n");
	}
	fs.appendFileSync(log_path, text);
}

function main() {
	const args = parse_args(process.argv.slice(2));
	fs.mkdirSync(dump_dir, { recursive: true });

	const totals = [];
	let last_meta = null;
	let last_dump_path = null;

	for (let r = 1; r <= args.runs; r++) {
		const run_label = args.runs === 1 ? args.label : args.label + "-r" + r;
		console.log("\n=== Harness run " + r + "/" + args.runs + " label=" + run_label + " ===\n");
		const env = Object.assign({}, process.env, {
			PRECOMPUTE_DUMP_DIR: dump_dir,
			PRECOMPUTE_LABEL: run_label,
			PRECOMPUTE_USE_CACHE: "0",
		});
		const res = spawnSync(process.execPath, [path.join(root, "node", "precompute_bfs.js")], {
			cwd: root,
			env: env,
			stdio: "inherit",
		});
		if (res.status !== 0) {
			console.error("precompute_bfs failed with status " + res.status);
			process.exit(res.status || 1);
		}
		const meta = JSON.parse(fs.readFileSync(path.join(dump_dir, run_label + ".meta.json"), "utf8"));
		totals.push(meta.total_ms);
		last_meta = meta;
		last_dump_path = path.join(dump_dir, run_label + ".json");
	}

	const med = median(totals);
	const champion_path = path.join(dump_dir, args.label + ".json");
	// Keep the last run dump as the labeled champion dump for equality compares
	fs.copyFileSync(last_dump_path, champion_path);
	fs.writeFileSync(
		path.join(dump_dir, args.label + ".meta.json"),
		JSON.stringify(
			{
				label: args.label,
				version: last_meta.version,
				runs_ms: totals,
				median_ms: med,
				timings: last_meta.timings,
				map_count: last_meta.map_count,
				finished_at: new Date().toISOString(),
			},
			null,
			2,
		),
	);

	let equality = "n/a";
	let delta_line = "";
	if (args.compare) {
		const prev = JSON.parse(fs.readFileSync(path.join(dump_dir, args.compare + ".json"), "utf8"));
		const cur = JSON.parse(fs.readFileSync(champion_path, "utf8"));
		const ok = deep_equal(prev.amap_data, cur.amap_data) && deep_equal(prev.smap_data, cur.smap_data);
		equality = ok ? "PASS" : "FAIL";
		if (!ok) {
			const da = first_diff(prev.amap_data, cur.amap_data, "amap");
			const ds = first_diff(prev.smap_data, cur.smap_data, "smap");
			console.error("Equality FAILED:", da || ds);
		}
		const prev_meta = JSON.parse(fs.readFileSync(path.join(dump_dir, args.compare + ".meta.json"), "utf8"));
		const prev_med = prev_meta.median_ms != null ? prev_meta.median_ms : prev_meta.total_ms;
		const pct = (((prev_med - med) / prev_med) * 100).toFixed(1);
		delta_line = "- vs `" + args.compare + "`: " + prev_med + "ms → " + med + "ms (" + (prev_med >= med ? "-" : "+") + Math.abs(pct) + "%)\n";
	}

	const top = (last_meta.timings || []).slice(0, 5);
	const report =
		"\n## " +
		args.label +
		"\n\n" +
		"- Runs ms: " +
		JSON.stringify(totals) +
		"\n" +
		"- Median wall-clock: **" +
		med +
		"ms**\n" +
		delta_line +
		"- Equality vs compare: **" +
		equality +
		"**\n" +
		"- Top slowest maps: " +
		top.map((t) => t.map + " " + t.ms + "ms").join(", ") +
		"\n" +
		"- Finished: " +
		new Date().toISOString() +
		"\n";

	append_log(report);
	console.log(report);
	if (equality === "FAIL") process.exit(2);
}

main();
