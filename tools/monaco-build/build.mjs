const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const OUT = path.resolve(__dirname, "../../js/monaco/0.56.0");
const VERSION = "0.56.0";

fs.mkdirSync(OUT, { recursive: true });

async function build() {
	await esbuild.build({
		entryPoints: [path.join(__dirname, "src/entry.js")],
		bundle: true,
		minify: true,
		format: "iife",
		outfile: path.join(OUT, "monaco.min.js"),
		loader: {
			".css": "css",
			".ttf": "file",
			".woff": "file",
			".woff2": "file",
		},
		assetNames: "assets/[name]-[hash]",
		define: {
			"process.env.NODE_ENV": '"production"',
		},
		logLevel: "info",
	});

	await esbuild.build({
		entryPoints: {
			"editor.worker": "monaco-editor/esm/vs/editor/editor.worker.js",
			"ts.worker": "monaco-editor/esm/vs/language/typescript/ts.worker.js",
		},
		bundle: true,
		minify: true,
		format: "iife",
		outdir: OUT,
		entryNames: "[name]",
		define: {
			"process.env.NODE_ENV": '"production"',
		},
		logLevel: "info",
	});

	fs.writeFileSync(path.join(OUT, "VERSION"), VERSION + "\n");
	console.log("Built Monaco", VERSION, "->", OUT);
}

build().catch((err) => {
	console.error(err);
	process.exit(1);
});
