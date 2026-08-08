/**
 * AdventureLand monaco-vscode-api host (codingame 36).
 * Exposes window.monaco + window.ALVscodeApi (settings / keybindings).
 */
import { initialize, StandaloneServices } from "@codingame/monaco-vscode-api/services";
import getConfigurationServiceOverride, {
	updateUserConfiguration,
} from "@codingame/monaco-vscode-configuration-service-override";
import getKeybindingsServiceOverride, {
	updateUserKeybindings,
} from "@codingame/monaco-vscode-keybindings-service-override";
import getPreferencesServiceOverride from "@codingame/monaco-vscode-preferences-service-override";
import getViewsServiceOverride from "@codingame/monaco-vscode-views-service-override";
import getLanguagesServiceOverride from "@codingame/monaco-vscode-languages-service-override";
import getTextMateServiceOverride from "@codingame/monaco-vscode-textmate-service-override";
import getThemeServiceOverride from "@codingame/monaco-vscode-theme-service-override";
import getStorageServiceOverride from "@codingame/monaco-vscode-storage-service-override";
import getNotificationServiceOverride from "@codingame/monaco-vscode-notifications-service-override";
import getDialogsServiceOverride from "@codingame/monaco-vscode-dialogs-service-override";
import getModelServiceOverride from "@codingame/monaco-vscode-model-service-override";
import { ICommandService } from "@codingame/monaco-vscode-api/vscode/vs/platform/commands/common/commands.service";
import { IPreferencesService } from "@codingame/monaco-vscode-api/vscode/vs/workbench/services/preferences/common/preferences.service";

import "@codingame/monaco-vscode-theme-defaults-default-extension";
import "@codingame/monaco-vscode-javascript-default-extension";
import "@codingame/monaco-vscode-typescript-basics-default-extension";

import * as monaco from "monaco-editor";

var MONACO_BASE = "/js/monaco/vscode-api/";

self.MonacoEnvironment = {
	getWorkerUrl: function (_moduleId, label) {
		var base = (typeof location !== "undefined" && location.origin ? location.origin : "") + MONACO_BASE;
		if (label === "typescript" || label === "javascript") return base + "ts.worker.js";
		if (label === "TextMateWorker") return base + "textmate.worker.js";
		return base + "editor.worker.js";
	},
	getWorker: function (moduleId, label) {
		return new Worker(self.MonacoEnvironment.getWorkerUrl(moduleId, label));
	},
};

async function boot() {
	await initialize({
		...getConfigurationServiceOverride(),
		...getKeybindingsServiceOverride(),
		...getPreferencesServiceOverride(),
		...getViewsServiceOverride(),
		...getLanguagesServiceOverride(),
		...getTextMateServiceOverride(),
		...getThemeServiceOverride(),
		...getStorageServiceOverride(),
		...getNotificationServiceOverride(),
		...getDialogsServiceOverride(),
		...getModelServiceOverride(),
	});

	try {
		await updateUserConfiguration(
			JSON.stringify(
				{
					"editor.fontSize": 16,
					"editor.fontFamily": 'Consolas, "Cascadia Mono", Menlo, Monaco, monospace',
					"editor.minimap.enabled": false,
					"workbench.colorTheme": "Default Dark Modern",
				},
				null,
				2,
			),
		);
	} catch (e) {
		console.warn("[ALVscodeApi] updateUserConfiguration", e);
	}

	window.monaco = monaco;
	window.MONACO_VERSION = "vscode-api";
	window.ALVscodeApi = {
		ready: true,
		updateUserConfiguration: updateUserConfiguration,
		updateUserKeybindings: updateUserKeybindings,
		openSettings: function () {
			try {
				var prefs = StandaloneServices.get(IPreferencesService);
				if (prefs && typeof prefs.openSettings === "function") {
					return prefs.openSettings({ jsonEditor: false });
				}
			} catch (e) {
				console.warn("[ALVscodeApi] IPreferencesService", e);
			}
			try {
				return StandaloneServices.get(ICommandService).executeCommand("workbench.action.openSettings2");
			} catch (err) {
				console.warn("[ALVscodeApi] openSettings command failed", err);
				return Promise.resolve();
			}
		},
		openKeybindings: function () {
			try {
				return StandaloneServices.get(ICommandService).executeCommand("workbench.action.openGlobalKeybindings");
			} catch (err) {
				console.warn("[ALVscodeApi] openKeybindings failed", err);
				return Promise.resolve();
			}
		},
	};
	return window.ALVscodeApi;
}

window.ALVscodeApiReady = boot().catch(function (err) {
	console.error("[ALVscodeApi] boot failed", err);
	throw err;
});
