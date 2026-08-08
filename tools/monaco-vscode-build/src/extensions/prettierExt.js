/**
 * Built-in Prettier settings extension (codingame registerExtension).
 * Runtime formatting still uses js/monaco/format/prettier-worker.js.
 */
import { registerExtension, ExtensionHostKind } from "@codingame/monaco-vscode-api/extensions";
import { BUILT_IN_TOOL_DESCRIPTION, PRETTIER_CONFIGURATION } from "./toolSchemas.js";

export async function registerPrettierExtension() {
	var ext = registerExtension(
		{
			name: "prettier",
			displayName: "Prettier",
			description: BUILT_IN_TOOL_DESCRIPTION,
			publisher: "CODE",
			version: "1.0.0",
			engines: { vscode: "*" },
			categories: ["Formatters"],
			contributes: {
				configuration: PRETTIER_CONFIGURATION,
			},
		},
		ExtensionHostKind.LocalProcess,
	);
	await ext.whenReady();
	return ext;
}
