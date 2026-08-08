/**
 * Shared configuration schemas for built-in CODE tooling extensions.
 * Keys match what js/monaco format/lint/spell workers honor.
 */
export var BUILT_IN_TOOL_DESCRIPTION = "Built-in for AdventureLand CODE — not the VS Code Marketplace extension. Options match what our in-process workers honor.";

export var ESLINT_RULE_IDS = ["eqeqeq", "no-debugger", "no-eval", "no-implied-eval", "prefer-const", "no-var", "no-duplicate-case", "no-unreachable", "no-unused-vars"];

var ESLINT_RULE_DESCRIPTIONS = {
	eqeqeq: "Require === and !== (smart mode).",
	"no-debugger": "Disallow debugger statements.",
	"no-eval": "Disallow eval().",
	"no-implied-eval": "Disallow implied eval() via setTimeout/setInterval strings.",
	"prefer-const": "Suggest const when a binding is never reassigned.",
	"no-var": "Prefer let/const over var.",
	"no-duplicate-case": "Disallow duplicate case labels.",
	"no-unreachable": "Disallow unreachable code after return/throw/break/continue.",
	"no-unused-vars": "Disallow unused variables (names starting with _ are ignored).",
};

var SEVERITY_ENUM = ["off", "warn", "error"];

export var PRETTIER_CONFIGURATION = {
	title: "Prettier",
	order: 2,
	properties: {
		"prettier.enable": {
			type: "boolean",
			default: true,
			description: "Enable Prettier as the CODE formatter.",
			markdownDescription: "Enable Prettier as the CODE formatter.\n\n" + BUILT_IN_TOOL_DESCRIPTION,
			order: 1,
		},
		"prettier.semi": {
			type: "boolean",
			default: true,
			description: "Print semicolons at the ends of statements.",
			order: 2,
		},
		"prettier.singleQuote": {
			type: "boolean",
			default: false,
			description: "Use single quotes instead of double quotes.",
			order: 3,
		},
		"prettier.tabWidth": {
			type: "number",
			default: 4,
			minimum: 1,
			maximum: 8,
			description: "Number of spaces per indentation level.",
			order: 4,
		},
		"prettier.useTabs": {
			type: "boolean",
			default: false,
			description: "Indent with tabs instead of spaces.",
			order: 5,
		},
		"prettier.printWidth": {
			type: "number",
			default: 100,
			minimum: 40,
			maximum: 200,
			description: "Fit code within this line length.",
			order: 6,
		},
		"prettier.trailingComma": {
			type: "string",
			enum: ["none", "es5", "all"],
			default: "es5",
			description: "Where to add trailing commas.",
			order: 7,
		},
		"prettier.bracketSpacing": {
			type: "boolean",
			default: true,
			description: "Print spaces between brackets in object literals.",
			order: 8,
		},
		"prettier.arrowParens": {
			type: "string",
			enum: ["always", "avoid"],
			default: "always",
			description: "Include parentheses around a sole arrow function parameter.",
			order: 9,
		},
	},
};

function buildEslintProperties() {
	var props = {
		"eslint.enable": {
			type: "boolean",
			default: true,
			description: "Run ESLint diagnostics on CODE slots.",
			markdownDescription: "Run ESLint diagnostics on CODE slots.\n\n" + BUILT_IN_TOOL_DESCRIPTION,
			order: 1,
		},
	};
	for (var i = 0; i < ESLINT_RULE_IDS.length; i++) {
		var id = ESLINT_RULE_IDS[i];
		props["eslint.rules." + id] = {
			type: "string",
			enum: SEVERITY_ENUM,
			default: "warn",
			description: ESLINT_RULE_DESCRIPTIONS[id] || id,
			order: 10 + i,
		};
	}
	return props;
}

export var ESLINT_CONFIGURATION = {
	title: "ESLint",
	order: 3,
	properties: buildEslintProperties(),
};

export var CSPELL_CONFIGURATION = {
	title: "Code Spell Checker",
	order: 4,
	properties: {
		"cSpell.enabled": {
			type: "boolean",
			default: true,
			description: "Spell-check comments and strings in CODE.",
			markdownDescription: "Spell-check comments and strings in CODE.\n\n" + BUILT_IN_TOOL_DESCRIPTION,
			order: 1,
		},
		"cSpell.language": {
			type: "string",
			default: "en",
			description: "Dictionary languages to enable (comma-separated). Supported: en, nl, de, fr.",
			order: 2,
		},
		"cSpell.userWords": {
			type: "array",
			items: { type: "string" },
			default: [],
			description: "Words to always accept (added via Quick Fix or edited here).",
			order: 3,
		},
	},
};
