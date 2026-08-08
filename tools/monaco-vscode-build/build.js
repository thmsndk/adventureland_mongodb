const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const OUT = path.resolve(__dirname, "../../js/monaco/vscode-api");
const VERSION = "36.0.0";

fs.mkdirSync(OUT, { recursive: true });

const nodeStubPlugin = {
	name: "node-stub",
	setup(build) {
		build.onResolve({ filter: /^node:/ }, (args) => ({
			path: args.path,
			namespace: "node-stub",
		}));
		build.onLoad({ filter: /.*/, namespace: "node-stub" }, () => ({
			contents:
				"export default {}; export const readFile = async () => ''; export const writeFile = async () => {};",
			loader: "js",
		}));
	},
};

async function build() {
	await esbuild.build({
		entryPoints: [path.join(__dirname, "src/entry.js")],
		bundle: true,
		minify: true,
		format: "iife",
		outfile: path.join(OUT, "monaco-vscode.min.js"),
		platform: "browser",
		plugins: [nodeStubPlugin],
		loader: {
			".css": "text",
			".ttf": "file",
			".woff": "file",
			".woff2": "file",
			".wasm": "file",
			".json": "json",
			".html": "text",
		},
		assetNames: "assets/[name]-[hash]",
		define: {
			"process.env.NODE_ENV": '"production"',
			"process.browser": "true",
			global: "globalThis",
		},
		mainFields: ["browser", "module", "main"],
		conditions: ["import", "browser", "default"],
		logLevel: "info",
	});

	const stock = path.resolve(__dirname, "../../js/monaco/0.56.0");
	for (const name of ["editor.worker.js", "ts.worker.js"]) {
		const src = path.join(stock, name);
		if (fs.existsSync(src)) {
			fs.copyFileSync(src, path.join(OUT, name));
		}
	}

	const tmOut = path.join(OUT, "textmate.worker.js");
	if (!fs.existsSync(tmOut)) {
		fs.writeFileSync(
			tmOut,
			"/* TextMate worker placeholder */\n" +
				'importScripts((self.location && self.location.origin ? self.location.origin : "") + "/js/monaco/vscode-api/editor.worker.js");\n',
		);
	}

	const cssStock = path.join(stock, "monaco.css");
	if (fs.existsSync(cssStock)) {
		fs.copyFileSync(cssStock, path.join(OUT, "monaco.css"));
	}

	fs.writeFileSync(path.join(OUT, "VERSION"), VERSION + "\n");
	console.log("Built monaco-vscode-api", VERSION, "->", OUT);
}

build().catch((err) => {
	console.error(err);
	process.exit(1);
});
