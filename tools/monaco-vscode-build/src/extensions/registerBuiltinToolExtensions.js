/**
 * Register built-in CODE tooling extensions (Prettier / ESLint / CSpell).
 */
import { registerPrettierExtension } from "./prettierExt.js";
import { registerEslintExtension } from "./eslintExt.js";
import { registerCspellExtension } from "./cspellExt.js";
import { registerExplorerSlotCommands } from "./registerExplorerSlotCommands.js";

export async function registerBuiltinToolExtensions() {
	await registerPrettierExtension();
	await registerEslintExtension();
	await registerCspellExtension();
	await registerExplorerSlotCommands();
}
