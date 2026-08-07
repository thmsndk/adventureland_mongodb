/**
 * Prettier format worker for AdventureLand CODE.
 * Loads prettier standalone + babel/estree plugins via importScripts.
 */
/* global importScripts, self, prettier, prettierPlugins */
importScripts("prettier-standalone.js", "prettier-babel.js", "prettier-estree.js");

var DEFAULT_OPTIONS = {
	parser: "babel",
	semi: true,
	singleQuote: false,
	tabWidth: 4,
	useTabs: false,
	trailingComma: "es5",
	printWidth: 100,
	bracketSpacing: true,
	arrowParens: "always",
};

self.onmessage = function (ev) {
	var data = ev.data || {};
	var id = data.id;
	if (data.type !== "format") {
		self.postMessage({ id: id, error: "unknown type" });
		return;
	}
	if (typeof prettier === "undefined" || !prettier || typeof prettier.format !== "function") {
		self.postMessage({ id: id, error: "prettier missing" });
		return;
	}
	var plugins = [];
	if (typeof prettierPlugins !== "undefined" && prettierPlugins) {
		if (prettierPlugins.babel) plugins.push(prettierPlugins.babel);
		if (prettierPlugins.estree) plugins.push(prettierPlugins.estree);
	}
	var opts = Object.assign({}, DEFAULT_OPTIONS, data.options || {}, {
		parser: "babel",
		plugins: plugins,
	});
	// Strip non-prettier keys if any slipped in
	delete opts.plugins;
	opts.plugins = plugins;

	prettier
		.format(String(data.code || ""), opts)
		.then(function (formatted) {
			self.postMessage({ id: id, formatted: formatted, version: data.version });
		})
		.catch(function (err) {
			self.postMessage({
				id: id,
				error: String(err && err.message ? err.message : err),
				version: data.version,
			});
		});
};
