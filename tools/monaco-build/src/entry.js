import * as monaco from "../node_modules/monaco-editor/esm/vs/editor/editor.main.js";

var MONACO_BASE = "/js/monaco/0.56.0/";

self.MonacoEnvironment = {
	getWorkerUrl: function (_moduleId, label) {
		var base = (typeof location !== "undefined" && location.origin ? location.origin : "") + MONACO_BASE;
		var file = label === "typescript" || label === "javascript" ? "ts.worker.js" : "editor.worker.js";
		var abs = base + file;
		var body = "try{importScripts(" + JSON.stringify(abs) + ");}catch(e){console.error('[Monaco] worker failed',e);}";
		return URL.createObjectURL(new Blob([body], { type: "application/javascript" }));
	},
};

window.monaco = monaco;
window.MONACO_VERSION = "0.56.0";
