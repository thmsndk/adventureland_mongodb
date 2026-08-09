/**
 * AdventureLand CODE settings bridge + AL-only configuration.
 *
 * Prettier / ESLint / Code Spell Checker are real codingame registerExtension
 * packages (see src/extensions/). This module only registers adventureland.*
 * and maps settings ↔ ALEditor prefs for our in-process workers.
 *
 * Keep in sync with vault: AdventureLand/Clients/CODE IDE settings roadmap
 */
import { configurationRegistry } from "@codingame/monaco-vscode-configuration-service-override";
import { tocData as stockSettingsTocData } from "@codingame/monaco-vscode-api/vscode/vs/workbench/contrib/preferences/browser/settingsLayout";
import { ESLINT_RULE_IDS } from "./extensions/toolSchemas.js";

export { ESLINT_RULE_IDS };

export var AL_SETTINGS_TAG = "adventureland";
/** Optional filter if callers want AL-only; gear opens Settings unfiltered. */
export var AL_SETTINGS_QUERY = "";

var alConfigRegistered = false;

/** Truly AdventureLand-specific — no stock extension equivalent. */
var AL_CONFIG_NODE = {
	id: "adventureland",
	order: 1,
	title: "AdventureLand",
	type: "object",
	properties: {
		"adventureland.typeChecking": {
			type: "boolean",
			default: true,
			title: "Type Checking",
			description: "Enable TypeScript checkJs against AdventureLand API typings.",
			tags: [AL_SETTINGS_TAG],
		},
		"adventureland.layoutMode": {
			type: "string",
			enum: ["dock-half", "overlay-third", "overlay-half", "overlay-full"],
			default: "dock-half",
			title: "Layout Mode",
			description: "How the CODE panel sits over the game.",
			tags: [AL_SETTINGS_TAG],
		},
		"adventureland.overlayOpacity": {
			type: "number",
			default: 1,
			minimum: 0.4,
			maximum: 1,
			title: "Overlay Opacity",
			description: "CODE panel opacity for overlay layouts (0.4–1).",
			tags: [AL_SETTINGS_TAG],
		},
	},
};

var LEGACY_AL_FORMAT_KEYS = [
	"adventureland.theme",
	"adventureland.formatting",
	"adventureland.formatOnSave",
	"adventureland.prettier.semi",
	"adventureland.prettier.singleQuote",
	"adventureland.prettier.tabWidth",
	"adventureland.prettier.useTabs",
	"adventureland.linting",
	"adventureland.spellCheck",
];

export function registerAdventureLandConfiguration() {
	if (alConfigRegistered) return;
	alConfigRegistered = true;
	configurationRegistry.registerConfiguration(AL_CONFIG_NODE);
}

/**
 * Soft-curate Settings TOC: AdventureLand only (core leftover keys).
 * Built-in tooling extensions land under Extensions via registerExtension.
 */
export function curateStockSettingsToc() {
	try {
		var layout = stockSettingsTocData;
		if (!layout || !Array.isArray(layout.children)) return;
		ensureTocChild(
			layout,
			{
				id: "adventureland",
				label: "AdventureLand",
				settings: ["adventureland.*"],
			},
			0,
		);
	} catch (e) {
		console.warn("[ALConfiguration] curateStockSettingsToc", e);
	}
}

function ensureTocChild(layout, node, preferIndex) {
	var kids = layout.children;
	for (var i = 0; i < kids.length; i++) {
		if (kids[i] && kids[i].id === node.id) {
			if (!kids[i].settings) kids[i].settings = node.settings;
			return;
		}
	}
	var idx = typeof preferIndex === "number" ? preferIndex : kids.length;
	if (idx < 0) idx = 0;
	if (idx > kids.length) idx = kids.length;
	kids.splice(idx, 0, node);
}

/** Drop superseded adventureland.* keys; migrate lint/spell toggles to extension keys. */
export function stripLegacyAlFormatKeys(state) {
	if (!state || typeof state !== "object") return state;
	if (state["adventureland.linting"] != null && state["eslint.enable"] == null) {
		state["eslint.enable"] = !!state["adventureland.linting"];
	}
	if (state["adventureland.spellCheck"] != null && state["cSpell.enabled"] == null) {
		state["cSpell.enabled"] = !!state["adventureland.spellCheck"];
	}
	for (var i = 0; i < LEGACY_AL_FORMAT_KEYS.length; i++) {
		delete state[LEGACY_AL_FORMAT_KEYS[i]];
	}
	return state;
}

function clampTabWidth(n) {
	var v = Number(n);
	if (!isFinite(v)) return 4;
	v = Math.round(v);
	if (v < 1) return 1;
	if (v > 8) return 8;
	return v;
}

function normalizeSpellLanguageList(raw) {
	var allowed = { en: 1, nl: 1, de: 1, fr: 1 };
	var src = [];
	if (Array.isArray(raw)) src = raw;
	else if (typeof raw === "string") src = raw.split(/[,\s]+/);
	var out = [];
	for (var i = 0; i < src.length; i++) {
		var id = String(src[i] || "")
			.toLowerCase()
			.trim();
		if (!id || !allowed[id]) continue;
		if (out.indexOf(id) === -1) out.push(id);
	}
	return out.length ? out : ["en"];
}

function normalizeUserWords(raw) {
	var src = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,\s]+/) : [];
	var out = [];
	for (var i = 0; i < src.length; i++) {
		var w = String(src[i] || "")
			.toLowerCase()
			.trim();
		if (!w) continue;
		if (out.indexOf(w) === -1) out.push(w);
	}
	return out;
}

function severityFromRuleValue(val) {
	if (val === "off" || val === 0) return "off";
	if (val === "error" || val === 2) return "error";
	if (Array.isArray(val) && val.length) return severityFromRuleValue(val[0]);
	return "warn";
}

/** Build worker rule override object from eslint.rules.* settings. */
export function eslintRulesFromConfiguration(cfg) {
	cfg = cfg || {};
	var rules = {};
	for (var i = 0; i < ESLINT_RULE_IDS.length; i++) {
		var id = ESLINT_RULE_IDS[i];
		var key = "eslint.rules." + id;
		if (cfg[key] == null) continue;
		var sev = severityFromRuleValue(cfg[key]);
		if (sev === "off") {
			rules[id] = "off";
			continue;
		}
		if (id === "eqeqeq") rules[id] = [sev, "smart"];
		else if (id === "no-unused-vars") {
			rules[id] = [
				sev,
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			];
		} else rules[id] = sev;
	}
	return rules;
}

function eslintRulesToConfigurationPartial(eslintRules) {
	eslintRules = eslintRules || {};
	var out = {};
	for (var i = 0; i < ESLINT_RULE_IDS.length; i++) {
		var id = ESLINT_RULE_IDS[i];
		out["eslint.rules." + id] = severityFromRuleValue(eslintRules[id] != null ? eslintRules[id] : "warn");
	}
	return out;
}

/** Map ALEditor localStorage prefs → settings.json keys. */
export function prefsToConfigurationPartial(prefs) {
	prefs = prefs || {};
	var prettier = prefs.prettier || {};
	var tabWidth = clampTabWidth(prettier.tabWidth);
	var spellLangs = normalizeSpellLanguageList(prefs.spellLanguages);
	var partial = {
		"adventureland.typeChecking": prefs.typeChecking !== false,
		"adventureland.layoutMode": prefs.layoutMode || "dock-half",
		"adventureland.overlayOpacity": typeof prefs.overlayOpacity === "number" ? prefs.overlayOpacity : 1,
		"eslint.enable": prefs.linting !== false,
		"cSpell.enabled": prefs.spellCheck !== false,
		"cSpell.language": spellLangs.join(","),
		"prettier.enable": prefs.formatting !== false,
		"prettier.semi": prettier.semi !== false,
		"prettier.singleQuote": !!prettier.singleQuote,
		"prettier.tabWidth": tabWidth,
		"prettier.useTabs": !!prettier.useTabs,
		"prettier.printWidth": typeof prettier.printWidth === "number" ? prettier.printWidth : 100,
		"prettier.trailingComma": prettier.trailingComma || "es5",
		"prettier.bracketSpacing": prettier.bracketSpacing !== false,
		"prettier.arrowParens": prettier.arrowParens === "avoid" ? "avoid" : "always",
		"editor.fontSize": prefs.fontSize || 16,
		"editor.fontFamily": prefs.fontFamily || 'Consolas, "Cascadia Mono", Menlo, Monaco, monospace',
		"editor.minimap.enabled": !!prefs.minimap,
		"editor.wordWrap": prefs.wordWrap === false ? "off" : "on",
		"editor.mouseWheelZoom": prefs.mouseWheelZoom !== false,
		"editor.folding": prefs.folding !== false,
		"editor.tabSize": tabWidth,
		"editor.insertSpaces": !prettier.useTabs,
		"editor.formatOnSave": !!prefs.formatOnSave,
	};
	Object.assign(partial, eslintRulesToConfigurationPartial(prefs.eslintRules));
	if (Array.isArray(prefs.spellUserWords)) {
		partial["cSpell.userWords"] = normalizeUserWords(prefs.spellUserWords);
	}
	return partial;
}

/** Map workbench theme id → AL localStorage theme id. */
export function alThemeFromWorkbenchTheme(themeId) {
	if (!themeId) return "vs-dark";
	var s = String(themeId);
	if (/pixel/i.test(s)) return "pixel";
	if (/Light/i.test(s) || s === "vs") return "vs";
	if (/High Contrast/i.test(s) || s === "hc-black") return "hc-black";
	return "vs-dark";
}

/** Read stock + adventureland keys into ALEditor prefs shape. */
export function configurationToPrefsPartial(cfg, base) {
	base = base ? Object.assign({}, base) : {};
	cfg = cfg || {};
	if (cfg["workbench.colorTheme"] != null) base.theme = alThemeFromWorkbenchTheme(cfg["workbench.colorTheme"]);
	else if (cfg["adventureland.theme"] != null) base.theme = cfg["adventureland.theme"];
	if (cfg["adventureland.typeChecking"] != null) base.typeChecking = !!cfg["adventureland.typeChecking"];
	if (cfg["eslint.enable"] != null) base.linting = !!cfg["eslint.enable"];
	else if (cfg["adventureland.linting"] != null) base.linting = !!cfg["adventureland.linting"];
	if (cfg["cSpell.enabled"] != null) base.spellCheck = !!cfg["cSpell.enabled"];
	else if (cfg["adventureland.spellCheck"] != null) base.spellCheck = !!cfg["adventureland.spellCheck"];
	if (cfg["cSpell.language"] != null) base.spellLanguages = normalizeSpellLanguageList(cfg["cSpell.language"]);
	if (cfg["cSpell.userWords"] != null) base.spellUserWords = normalizeUserWords(cfg["cSpell.userWords"]);
	if (cfg["prettier.enable"] != null) base.formatting = !!cfg["prettier.enable"];
	else if (cfg["adventureland.formatting"] != null) base.formatting = !!cfg["adventureland.formatting"];
	if (cfg["editor.formatOnSave"] != null) base.formatOnSave = !!cfg["editor.formatOnSave"];
	else if (cfg["adventureland.formatOnSave"] != null) base.formatOnSave = !!cfg["adventureland.formatOnSave"];
	base.prettier = Object.assign({}, base.prettier || {});
	if (cfg["prettier.semi"] != null) base.prettier.semi = !!cfg["prettier.semi"];
	else if (cfg["adventureland.prettier.semi"] != null) base.prettier.semi = !!cfg["adventureland.prettier.semi"];
	if (cfg["prettier.singleQuote"] != null) base.prettier.singleQuote = !!cfg["prettier.singleQuote"];
	else if (cfg["adventureland.prettier.singleQuote"] != null) base.prettier.singleQuote = !!cfg["adventureland.prettier.singleQuote"];
	if (cfg["prettier.tabWidth"] != null) base.prettier.tabWidth = clampTabWidth(cfg["prettier.tabWidth"]);
	else if (cfg["adventureland.prettier.tabWidth"] != null) base.prettier.tabWidth = clampTabWidth(cfg["adventureland.prettier.tabWidth"]);
	else if (cfg["editor.tabSize"] != null) base.prettier.tabWidth = clampTabWidth(cfg["editor.tabSize"]);
	if (cfg["prettier.useTabs"] != null) base.prettier.useTabs = !!cfg["prettier.useTabs"];
	else if (cfg["adventureland.prettier.useTabs"] != null) base.prettier.useTabs = !!cfg["adventureland.prettier.useTabs"];
	else if (cfg["editor.insertSpaces"] != null) base.prettier.useTabs = !cfg["editor.insertSpaces"];
	if (cfg["prettier.printWidth"] != null) base.prettier.printWidth = Number(cfg["prettier.printWidth"]) || 100;
	if (cfg["prettier.trailingComma"] != null) base.prettier.trailingComma = cfg["prettier.trailingComma"];
	if (cfg["prettier.bracketSpacing"] != null) base.prettier.bracketSpacing = !!cfg["prettier.bracketSpacing"];
	if (cfg["prettier.arrowParens"] != null) base.prettier.arrowParens = cfg["prettier.arrowParens"] === "avoid" ? "avoid" : "always";
	var ruleOverrides = eslintRulesFromConfiguration(cfg);
	if (Object.keys(ruleOverrides).length) {
		base.eslintRules = Object.assign({}, base.eslintRules || {}, ruleOverrides);
	}
	if (cfg["editor.fontSize"] != null) base.fontSize = cfg["editor.fontSize"];
	if (cfg["editor.fontFamily"] != null) base.fontFamily = cfg["editor.fontFamily"];
	if (cfg["editor.minimap.enabled"] != null) base.minimap = !!cfg["editor.minimap.enabled"];
	if (cfg["editor.wordWrap"] != null) base.wordWrap = cfg["editor.wordWrap"] !== "off";
	if (cfg["editor.mouseWheelZoom"] != null) base.mouseWheelZoom = !!cfg["editor.mouseWheelZoom"];
	if (cfg["editor.folding"] != null) base.folding = !!cfg["editor.folding"];
	return base;
}

export function layoutFromConfiguration(cfg) {
	cfg = cfg || {};
	return {
		layoutMode: cfg["adventureland.layoutMode"] || null,
		overlayOpacity: typeof cfg["adventureland.overlayOpacity"] === "number" ? cfg["adventureland.overlayOpacity"] : null,
	};
}
