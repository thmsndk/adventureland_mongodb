/**
 * AdventureLand CODE ESLint worker.
 * Loads eslint-linter-browserify and returns Monaco-friendly markers / fixes.
 */
/* global importScripts, self */
importScripts("eslint-linter.min.js");

var LinterCtor = self.eslint && self.eslint.Linter;
var linter = LinterCtor ? new LinterCtor() : null;

var AL_CONFIG = {
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "script",
		globals: {
			// Filled loosely — no-undef is off; types own undefined names.
		},
	},
	rules: {
		eqeqeq: ["warn", "smart"],
		"no-debugger": "warn",
		"no-eval": "warn",
		"no-implied-eval": "warn",
		"prefer-const": "warn",
		"no-var": "warn",
		"no-duplicate-case": "warn",
		"no-unreachable": "warn",
		"no-unused-vars": [
			"warn",
			{
				argsIgnorePattern: "^_",
				varsIgnorePattern: "^_",
				caughtErrorsIgnorePattern: "^_",
			},
		],
		"no-undef": "off",
		semi: "off",
		quotes: "off",
	},
};

function buildConfig(rulesOverride) {
	var rules = Object.assign({}, AL_CONFIG.rules, rulesOverride || {});
	return {
		flat: {
			languageOptions: AL_CONFIG.languageOptions,
			rules: rules,
		},
		legacy: {
			env: { es2022: true },
			parserOptions: { ecmaVersion: 2022, sourceType: "script" },
			rules: rules,
		},
		rules: rules,
	};
}

function runVerify(code, cfg) {
	try {
		return linter.verify(code, [cfg.flat], { filename: "slot.js" });
	} catch (flatErr) {
		return linter.verify(code, cfg.legacy);
	}
}

function runVerifyAndFix(code, cfg) {
	try {
		if (typeof linter.verifyAndFix === "function") {
			try {
				return linter.verifyAndFix(code, [cfg.flat], { filename: "slot.js" });
			} catch (flatErr) {
				return linter.verifyAndFix(code, cfg.legacy);
			}
		}
	} catch (err) {
		return { fixed: false, output: code, messages: [], error: String(err && err.message ? err.message : err) };
	}
	return { fixed: false, output: code, messages: [] };
}

function toMarkers(messages) {
	var markers = [];
	for (var i = 0; i < messages.length; i++) {
		var msg = messages[i];
		if (!msg || (msg.fatal === undefined && !msg.message)) continue;
		var marker = {
			severity: msg.severity === 2 ? 2 : 1,
			message: msg.message,
			ruleId: msg.ruleId || undefined,
			fixable: !!(msg.fix && msg.fix.range),
			startLineNumber: msg.line || 1,
			startColumn: msg.column || 1,
			endLineNumber: msg.endLine || msg.line || 1,
			endColumn: msg.endColumn || (msg.column ? msg.column + 1 : 2),
		};
		if (msg.fix && msg.fix.range) {
			marker.fix = {
				range: [msg.fix.range[0], msg.fix.range[1]],
				text: String(msg.fix.text == null ? "" : msg.fix.text),
			};
		}
		markers.push(marker);
	}
	return markers;
}

self.onmessage = function (ev) {
	var data = ev.data || {};
	var id = data.id;
	if (!linter) {
		self.postMessage({ id: id, markers: [], error: "eslint missing" });
		return;
	}
	var code = String(data.code || "");
	var cfg = buildConfig(data.rules);

	if (data.type === "fix") {
		var result = runVerifyAndFix(code, cfg);
		self.postMessage({
			id: id,
			fixed: !!result.fixed,
			output: result.output != null ? result.output : code,
			markers: toMarkers(result.messages || []),
			version: data.version,
			error: result.error,
		});
		return;
	}

	if (data.type !== "lint") {
		self.postMessage({ id: id, markers: [] });
		return;
	}

	var messages = [];
	try {
		messages = runVerify(code, cfg);
	} catch (err) {
		self.postMessage({ id: id, markers: [], error: String(err && err.message ? err.message : err) });
		return;
	}
	self.postMessage({ id: id, markers: toMarkers(messages), version: data.version });
};
