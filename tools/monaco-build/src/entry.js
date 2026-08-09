import * as monaco from "../node_modules/monaco-editor/esm/vs/editor/editor.main.js";

var MONACO_BASE = "/js/monaco/0.56.0/";

self.MonacoEnvironment = {
	getWorker: function (_moduleId, label) {
		var base = (typeof location !== "undefined" && location.origin ? location.origin : "") + MONACO_BASE;
		var file = label === "typescript" || label === "javascript" ? "ts.worker.js" : "editor.worker.js";
		return new Worker(base + file);
	},
	getWorkerUrl: function (_moduleId, label) {
		var base = (typeof location !== "undefined" && location.origin ? location.origin : "") + MONACO_BASE;
		var file = label === "typescript" || label === "javascript" ? "ts.worker.js" : "editor.worker.js";
		return base + file;
	},
};

// Monaco 0.56 exports the TS/JS language service as `monaco.typescript`.
// Older docs/code expect `monaco.languages.typescript` — alias for compatibility.
if (monaco.typescript && monaco.languages && !monaco.languages.typescript) {
	monaco.languages.typescript = monaco.typescript;
}

// Disable built-in TS/JS hovers before any model activates the language.
// ALEditor registers a custom hover that formats JSDoc (links, @example) properly.
function disableBuiltinTsHovers() {
	var api = monaco.typescript || (monaco.languages && monaco.languages.typescript);
	if (!api) return;
	var list = [api.javascriptDefaults, api.typescriptDefaults];
	for (var i = 0; i < list.length; i++) {
		var defaults = list[i];
		if (!defaults || typeof defaults.setModeConfiguration !== "function") continue;
		var cur = defaults.modeConfiguration || {};
		defaults.setModeConfiguration(Object.assign({}, cur, { hovers: false }));
	}
}
disableBuiltinTsHovers();

window.monaco = monaco;
window.MONACO_VERSION = "0.56.0";
