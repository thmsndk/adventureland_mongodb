#!/usr/bin/env node
/**
 * Seed or merge secretsandconfig from docker/templates/<SECRETS_TEMPLATE>.
 * - Missing files: copy from template
 * - Existing files: fill missing top-level / nested keys (existing values win)
 * - SECRETS_FORCE_TEMPLATE=1: overwrite options.js + keys.js from template
 */
var fs = require("fs");
var path = require("path");
var util = require("util");

var secretsDir = process.env.SECRETS_DIR || "/app/secretsandconfig";
var templateName = process.env.SECRETS_TEMPLATE || "dev";
var templateDir = process.env.SECRETS_TEMPLATE_DIR || path.join("/app/docker/templates", templateName);
var force = process.env.SECRETS_FORCE_TEMPLATE === "1";

function loadModule(filePath) {
	var resolved = path.resolve(filePath);
	delete require.cache[resolved];
	return require(resolved);
}

function isPlainObject(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Add keys from src that are missing on dst. Returns number of keys added. */
function fillMissing(dst, src) {
	var added = 0;
	var keys = Object.keys(src);
	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		if (!(key in dst)) {
			dst[key] = src[key];
			added++;
		} else if (isPlainObject(dst[key]) && isPlainObject(src[key])) {
			added += fillMissing(dst[key], src[key]);
		}
	}
	return added;
}

function inspect(value) {
	return util.inspect(value, { depth: null, compact: false, breakLength: 100 });
}

function writeOptions(filePath, merged) {
	var body =
		"machines = " +
		inspect(merged.machines) +
		";\n\nservers = " +
		inspect(merged.servers) +
		";\n\nmodule.exports = " +
		inspect(merged) +
		";\n";
	fs.writeFileSync(filePath, body);
}

function writeKeys(filePath, merged) {
	fs.writeFileSync(filePath, "module.exports = " + inspect(merged) + ";\n");
}

function syncFile(name, writer) {
	var dest = path.join(secretsDir, name);
	var src = path.join(templateDir, name);
	if (!fs.existsSync(src)) {
		console.log("sync_secrets: no template " + src);
		return;
	}
	if (force || !fs.existsSync(dest)) {
		fs.copyFileSync(src, dest);
		console.log("sync_secrets: " + (force ? "forced template → " : "seeded ") + name);
		return;
	}
	var template = loadModule(src);
	var existing = loadModule(dest);
	var added = fillMissing(existing, template);
	if (added > 0) {
		writer(dest, existing);
		console.log("sync_secrets: merged " + added + " missing key(s) into " + name);
	} else {
		console.log("sync_secrets: " + name + " up to date");
	}
}

fs.mkdirSync(secretsDir, { recursive: true });
if (!fs.existsSync(templateDir)) {
	console.error("sync_secrets: template dir missing: " + templateDir);
	process.exit(1);
}
syncFile("options.js", writeOptions);
syncFile("keys.js", writeKeys);
