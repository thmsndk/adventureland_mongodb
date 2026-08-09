/**
 * Multi-root CODE workspace: characters / slots / types as top-level folders.
 * codingame MonacoWorkspaceEditingService.enterWorkspace is unsupported — use
 * reinitializeWorkspace after writing a .code-workspace into the VFS.
 */
import { reinitializeWorkspace } from "@codingame/monaco-vscode-configuration-service-override";
import { StandaloneServices } from "@codingame/monaco-vscode-api/services";
import { IFileService } from "@codingame/monaco-vscode-api/vscode/vs/platform/files/common/files.service";
import { VSBuffer } from "@codingame/monaco-vscode-api/vscode/vs/base/common/buffer";
import * as monaco from "monaco-editor";

var ROOT = "file:///adventureland/";
var WORKSPACE_URI = monaco.Uri.parse(ROOT + "CODE.code-workspace");
var WORKSPACE_ID = "code-ide";
var flattened = false;

var FOLDERS = [
	{ path: "characters", name: "characters" },
	{ path: "slots", name: "slots" },
	{ path: "types", name: "types" },
];

function workspaceJson() {
	return JSON.stringify({ folders: FOLDERS }, null, 2);
}

/**
 * Replace the single adventureland folder with three roots.
 * Safe to call more than once.
 */
export function flattenCodeWorkspaceFolders() {
	if (flattened) return Promise.resolve(true);
	try {
		var fileService = StandaloneServices.get(IFileService);
		if (!fileService) return Promise.resolve(false);

		var chain = Promise.resolve();
		var i;
		for (i = 0; i < FOLDERS.length; i++) {
			(function (folder) {
				chain = chain.then(function () {
					return Promise.resolve(fileService.createFolder(monaco.Uri.parse(ROOT + folder.path))).catch(function () {});
				});
			})(FOLDERS[i]);
		}

		return chain
			.then(function () {
				return fileService.writeFile(WORKSPACE_URI, VSBuffer.fromString(workspaceJson()));
			})
			.then(function () {
				return reinitializeWorkspace({ id: WORKSPACE_ID, configPath: WORKSPACE_URI });
			})
			.then(function () {
				flattened = true;
				return true;
			})
			.catch(function (e) {
				console.warn("[ALWorkspace] flattenCodeWorkspaceFolders", e);
				return false;
			});
	} catch (e) {
		console.warn("[ALWorkspace] flattenCodeWorkspaceFolders", e);
		return Promise.resolve(false);
	}
}
