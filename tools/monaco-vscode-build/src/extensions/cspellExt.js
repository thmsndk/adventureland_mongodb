/**
 * Built-in Code Spell Checker *settings* extension (codingame registerExtension).
 * Runtime spell-check: js/monaco/spell/spell-worker.js
 * (intentional hybrid — Marketplace cspell is not loaded in this host).
 */
import { registerExtension, ExtensionHostKind } from "@codingame/monaco-vscode-api/extensions";
import { BUILT_IN_TOOL_DESCRIPTION, CSPELL_CONFIGURATION } from "./toolSchemas.js";

export async function registerCspellExtension() {
	var ext = registerExtension(
		{
			name: "cspell",
			displayName: "Code Spell Checker",
			description: BUILT_IN_TOOL_DESCRIPTION,
			publisher: "CODE",
			version: "1.0.0",
			engines: { vscode: "*" },
			categories: ["Linters", "Other"],
			contributes: {
				configuration: CSPELL_CONFIGURATION,
			},
		},
		ExtensionHostKind.LocalProcess,
	);
	await ext.whenReady();
	return ext;
}
