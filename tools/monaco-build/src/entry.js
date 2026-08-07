import * as monaco from "../node_modules/monaco-editor/esm/vs/editor/editor.main.js";

var MONACO_BASE = "/js/monaco/0.56.0/";

self.MonacoEnvironment = {
	getWorkerUrl: function (_moduleId, label) {
		if (label === "typescript" || label === "javascript") {
			return MONACO_BASE + "ts.worker.js";
		}
		return MONACO_BASE + "editor.worker.js";
	},
};

window.monaco = monaco;
window.MONACO_VERSION = "0.56.0";
