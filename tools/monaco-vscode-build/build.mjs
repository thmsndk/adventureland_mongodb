import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../../js/monaco/vscode-api");
const VERSION = "36.0.0";
const PUBLIC_PATH = "/js/monaco/vscode-api/";

fs.mkdirSync(OUT, { recursive: true });

/**
 * Rewrites `new URL('rel', import.meta.url)` to a public absolute URL string
 * and copies the resolved file into OUT/assets. Classic IIFE/ESM-safe.
 */
function createImportMetaUrlAssetPlugin(publicPath, assetsOutDir) {
	fs.mkdirSync(assetsOutDir, { recursive: true });
	const emitted = new Map(); // absPath -> publicUrl

	function emitAsset(absPath) {
		const normalized = path.normalize(absPath);
		if (emitted.has(normalized)) return emitted.get(normalized);
		const buf = fs.readFileSync(normalized);
		const hash = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 8);
		const ext = path.extname(normalized);
		const base = path.basename(normalized, ext).replace(/[^a-zA-Z0-9._-]/g, "_");
		const outName = `${base}-${hash}${ext}`;
		const outPath = path.join(assetsOutDir, outName);
		fs.writeFileSync(outPath, buf);
		const url = `${publicPath}assets/${outName}`;
		emitted.set(normalized, url);
		return url;
	}

	function resolveRel(relWithQuery, importerPath) {
		const rel = relWithQuery.split("?")[0].split("#")[0];
		if (!rel || rel.includes("${")) return null;
		const candidate = path.resolve(path.dirname(importerPath), rel);
		if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
		return null;
	}

	// Nested wasm-bindgen: new URL(new URL('x', import.meta.url).href)
	const nestedRe = /\bnew\s+URL\s*\(\s*new\s+URL\s*\(\s*(['"`])([^'"`]+)\1\s*,\s*import\.meta\.url\s*(?:,\s*)?\)\s*\.href\s*\)/g;
	// new URL('x', import.meta.url).href  OR  new URL('x', import.meta.url)
	const plainRe = /\bnew\s+URL\s*\(\s*(['"`])([^'"`]+)\1\s*,\s*import\.meta\.url\s*(?:,\s*)?\)(\s*\.href)?/g;

	function urlExpr(publicUrl, asHref) {
		if (asHref) return JSON.stringify(publicUrl);
		// Prefer a real URL object when callers pass it to Worker/fetch APIs that accept either.
		return `(typeof location!=="undefined"?new URL(${JSON.stringify(publicUrl)},location.href):${JSON.stringify(publicUrl)})`;
	}

	return {
		name: "al-import-meta-url-assets",
		setup(build) {
			build.onLoad({ filter: /\.[cm]?js$/, namespace: "file" }, async (args) => {
				let code;
				try {
					code = await fs.promises.readFile(args.path, "utf8");
				} catch {
					return null;
				}
				if (!code.includes("import.meta.url")) return null;

				let changed = false;
				code = code.replace(nestedRe, (full, _q, rel) => {
					const abs = resolveRel(rel, args.path);
					if (!abs) return full;
					changed = true;
					return urlExpr(emitAsset(abs), true);
				});
				code = code.replace(plainRe, (full, _q, rel, hrefSuffix) => {
					const abs = resolveRel(rel, args.path);
					if (!abs) return full;
					changed = true;
					return urlExpr(emitAsset(abs), Boolean(hrefSuffix));
				});
				if (!changed) return null;
				return { contents: code, loader: "js" };
			});
		},
	};
}

const nodeStubPlugin = {
	name: "node-stub",
	setup(build) {
		build.onResolve({ filter: /^node:/ }, (args) => ({
			path: args.path,
			namespace: "node-stub",
		}));
		build.onLoad({ filter: /.*/, namespace: "node-stub" }, () => ({
			contents: "export default {}; export const readFile = async () => ''; export const writeFile = async () => {};",
			loader: "js",
		}));
	},
};

async function buildOne(entry, outfile, format) {
	await esbuild.build({
		entryPoints: [entry],
		bundle: true,
		minify: true,
		format: format,
		outfile: outfile,
		platform: "browser",
		plugins: [createImportMetaUrlAssetPlugin(PUBLIC_PATH, path.join(OUT, "assets")), nodeStubPlugin],
		loader: {
			".css": "text",
			".ttf": "file",
			".woff": "file",
			".woff2": "file",
			".wasm": "file",
			".json": "json",
			".html": "file",
			".svg": "file",
			".png": "file",
		},
		assetNames: "assets/[name]-[hash]",
		publicPath: PUBLIC_PATH,
		define: {
			"process.env.NODE_ENV": '"production"',
			"process.browser": "true",
			global: "globalThis",
		},
		mainFields: ["browser", "module", "main"],
		conditions: ["import", "browser", "default"],
		logLevel: "info",
	});
}

async function build() {
	const assetsDir = path.join(OUT, "assets");
	if (fs.existsSync(assetsDir)) {
		fs.rmSync(assetsDir, { recursive: true, force: true });
	}

	await buildOne(path.join(__dirname, "src/entry.js"), path.join(OUT, "monaco-vscode.min.js"), "iife");

	const nm = path.join(__dirname, "node_modules");
	await buildOne(path.join(nm, "@codingame/monaco-vscode-api/workers/editor.worker.js"), path.join(OUT, "editor.worker.js"), "esm");
	await buildOne(path.join(nm, "@codingame/monaco-vscode-textmate-service-override/worker.js"), path.join(OUT, "textmate.worker.js"), "esm");

	// Standalone TS/JS language-features worker (javascriptDefaults / IntelliSense).
	await buildOne(path.join(nm, "@codingame/monaco-vscode-standalone-typescript-language-features/language/typescript/ts.worker.js"), path.join(OUT, "ts.worker.js"), "esm");

	const stock = path.resolve(__dirname, "../../js/monaco/0.56.0");
	const cssStock = path.join(stock, "monaco.css");
	if (fs.existsSync(cssStock)) {
		fs.copyFileSync(cssStock, path.join(OUT, "monaco.css"));
	}

	const vscodeSrc = path.join(nm, "@codingame/monaco-vscode-api/vscode/src/vs");
	/** CSS-as-text embeds relative url("./…"); copy + rewrite to absolute public paths. */
	const relativeCssMedia = [
		{
			src: path.join(vscodeSrc, "base/browser/ui/codicons/codicon/codicon.ttf"),
			dest: "codicon.ttf",
		},
		{
			src: path.join(vscodeSrc, "workbench/browser/parts/editor/media/letterpress-dark.svg"),
			dest: "letterpress-dark.svg",
		},
		{
			src: path.join(vscodeSrc, "workbench/browser/parts/editor/media/letterpress-light.svg"),
			dest: "letterpress-light.svg",
		},
		{
			src: path.join(vscodeSrc, "workbench/browser/parts/editor/media/letterpress-hcDark.svg"),
			dest: "letterpress-hcDark.svg",
		},
		{
			src: path.join(vscodeSrc, "workbench/browser/parts/editor/media/letterpress-hcLight.svg"),
			dest: "letterpress-hcLight.svg",
		},
		{
			src: path.join(vscodeSrc, "editor/standalone/browser/iPadShowKeyboard/keyboard-dark.svg"),
			dest: "keyboard-dark.svg",
		},
		{
			src: path.join(vscodeSrc, "editor/standalone/browser/iPadShowKeyboard/keyboard-light.svg"),
			dest: "keyboard-light.svg",
		},
		{
			src: path.join(vscodeSrc, "editor/contrib/colorPicker/browser/images/opacity-background.png"),
			dest: "images/opacity-background.png",
		},
	];
	for (const item of relativeCssMedia) {
		if (!fs.existsSync(item.src)) {
			console.warn("Missing CSS media asset:", item.src);
			continue;
		}
		const destPath = path.join(OUT, item.dest);
		fs.mkdirSync(path.dirname(destPath), { recursive: true });
		fs.copyFileSync(item.src, destPath);
	}

	fs.writeFileSync(path.join(OUT, "VERSION"), VERSION + "\n");

	const assets = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];
	console.log("Built monaco-vscode-api", VERSION, "->", OUT);
	console.log("Emitted assets:", assets.length ? assets.join(", ") : "(none)");

	const bundlePath = path.join(OUT, "monaco-vscode.min.js");
	let bundle = fs.readFileSync(bundlePath, "utf8");
	// Rewrite relative CSS urls so they don't resolve under /character/.../
	bundle = bundle.replace(/url\(\s*(['"]?)\.\/([^'")]+)\1\s*\)/g, 'url("/js/monaco/vscode-api/$2")');
	fs.writeFileSync(bundlePath, bundle);

	const leftover = (bundle.match(/new URL\([^)]*import\.meta\.url/g) || []).length;
	const metaCount = (bundle.match(/import\.meta/g) || []).length;
	console.log("Remaining new URL(..., import.meta.url):", leftover);
	console.log("Remaining import.meta mentions:", metaCount);
}

build().catch((err) => {
	console.error(err);
	process.exit(1);
});
