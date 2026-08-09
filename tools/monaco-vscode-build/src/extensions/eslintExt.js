/**
 * Built-in ESLint *settings* extension (codingame registerExtension).
 * Runtime lint: js/code/monaco/diagnostics.js + eslint-worker
 * (intentional hybrid — Marketplace ESLint is not loaded in this host).
 */
import { registerExtension, ExtensionHostKind } from "@codingame/monaco-vscode-api/extensions";
import { BUILT_IN_TOOL_DESCRIPTION, ESLINT_CONFIGURATION } from "./toolSchemas.js";

export async function registerEslintExtension() {
	var ext = registerExtension(
		{
			name: "eslint",
			displayName: "ESLint",
			description: BUILT_IN_TOOL_DESCRIPTION,
			publisher: "CODE",
			version: "1.0.0",
			engines: { vscode: "*" },
			categories: ["Linters"],
			contributes: {
				configuration: ESLINT_CONFIGURATION,
			},
		},
		ExtensionHostKind.LocalProcess,
	);
	await ext.whenReady();
	return ext;
}
