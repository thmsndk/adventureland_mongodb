/**
 * Code-aware spell worker: comments + string literals only.
 * Dictionaries: AL game terms + selected natural-language packs (en/nl/de/fr).
 */
/* global importScripts, self, AL_SPELL_DICTIONARY, AL_SPELL_LANG */
importScripts("al-dictionary.js");

var alDict = Object.create(null);
if (typeof AL_SPELL_DICTIONARY !== "undefined" && AL_SPELL_DICTIONARY) {
	for (var ai = 0; ai < AL_SPELL_DICTIONARY.length; ai++) {
		alDict[AL_SPELL_DICTIONARY[ai]] = 1;
	}
}

var langCache = Object.create(null); // langId -> {word:1}
var loadedLangs = Object.create(null);

function ensureLang(langId) {
	var id = String(langId || "")
		.toLowerCase()
		.trim();
	if (!id) return null;
	if (langCache[id]) return langCache[id];
	if (!loadedLangs[id]) {
		try {
			importScripts("dicts/" + id + ".js");
			loadedLangs[id] = 1;
		} catch (err) {
			loadedLangs[id] = -1;
			self.postMessage({ type: "spell-lang-error", lang: id, message: String(err && err.message ? err.message : err) });
			return null;
		}
	}
	if (loadedLangs[id] < 0) return null;
	var list = (self.AL_SPELL_LANG && self.AL_SPELL_LANG[id]) || [];
	var map = Object.create(null);
	for (var i = 0; i < list.length; i++) map[list[i]] = 1;
	langCache[id] = map;
	return map;
}

function buildDict(userWords, languages) {
	var dict = Object.create(alDict);
	var langs = languages && languages.length ? languages : ["en"];
	for (var i = 0; i < langs.length; i++) {
		var pack = ensureLang(langs[i]);
		if (!pack) continue;
		for (var w in pack) {
			if (Object.prototype.hasOwnProperty.call(pack, w)) dict[w] = 1;
		}
	}
	var list = userWords || [];
	for (var u = 0; u < list.length; u++) {
		var uw = String(list[u] || "")
			.toLowerCase()
			.trim();
		if (uw) dict[uw] = 1;
	}
	return dict;
}

function isUrlish(text) {
	return /https?:\/\/|www\.|[a-z0-9-]+\.(com|org|net|io|land|edu|gov|dev|app)\b/i.test(text);
}

/** Extract words from line/block comments and quoted strings. */
function extractSpellTargets(code) {
	var out = [];
	var line = 1;
	var col = 1;
	var i = 0;
	var n = code.length;

	function advanceChar(ch) {
		if (ch === "\n") {
			line++;
			col = 1;
		} else {
			col++;
		}
	}

	function pushWords(text, startLine, startCol) {
		if (!text) return;
		if (isUrlish(text) && text.trim().indexOf(" ") === -1) return;
		// Match on the original text so columns stay aligned (do not strip first).
		var urls = [];
		var urlRe = /https?:\/\/[^\s"'`]+|\bwww\.[^\s"'`]+/gi;
		var um;
		while ((um = urlRe.exec(text))) {
			urls.push([um.index, um.index + um[0].length]);
		}
		function inUrl(idx) {
			for (var u = 0; u < urls.length; u++) {
				if (idx >= urls[u][0] && idx < urls[u][1]) return true;
			}
			return false;
		}
		var re = /[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ']{1,}/g;
		var m;
		while ((m = re.exec(text))) {
			if (inUrl(m.index)) continue;
			var word = m[0];
			if (/^[A-Z0-9_]+$/.test(word) && word === word.toUpperCase() && word.length <= 4) continue;
			if (/^(https?|www|com|org|net|http)$/i.test(word)) continue;
			var local = m.index;
			var l = startLine;
			var c = startCol;
			for (var k = 0; k < local; k++) {
				if (text.charAt(k) === "\n") {
					l++;
					c = 1;
				} else {
					c++;
				}
			}
			out.push({
				word: word,
				startLineNumber: l,
				startColumn: c,
				endLineNumber: l,
				endColumn: c + word.length,
			});
		}
	}

	while (i < n) {
		var ch = code.charAt(i);
		var next = i + 1 < n ? code.charAt(i + 1) : "";

		if (ch === "/" && next === "/") {
			var ls = i + 2;
			var le = ls;
			while (le < n && code.charAt(le) !== "\n") le++;
			pushWords(code.slice(ls, le), line, col + 2);
			for (var a = i; a < le; a++) advanceChar(code.charAt(a));
			i = le;
			continue;
		}

		if (ch === "/" && next === "*") {
			var bsLine = line;
			var bsCol = col;
			var bi = i + 2;
			while (bi + 1 < n && !(code.charAt(bi) === "*" && code.charAt(bi + 1) === "/")) {
				bi++;
			}
			var be = Math.min(n, bi + 2);
			pushWords(code.slice(i + 2, bi), bsLine, bsCol + 2);
			for (var b = i; b < be; b++) advanceChar(code.charAt(b));
			i = be;
			continue;
		}

		if (ch === "'" || ch === '"' || ch === "`") {
			var quote = ch;
			var ssLine = line;
			var ssCol = col;
			var si = i + 1;
			while (si < n) {
				var c2 = code.charAt(si);
				if (c2 === "\\") {
					si += 2;
					continue;
				}
				if (quote === "`" && c2 === "$" && code.charAt(si + 1) === "{") {
					si += 2;
					var depth = 1;
					while (si < n && depth > 0) {
						if (code.charAt(si) === "{") depth++;
						else if (code.charAt(si) === "}") depth--;
						si++;
					}
					continue;
				}
				if (c2 === quote) break;
				si++;
			}
			pushWords(code.slice(i + 1, si), ssLine, ssCol + 1);
			var end = Math.min(n, si + 1);
			for (var s = i; s < end; s++) advanceChar(code.charAt(s));
			i = end;
			continue;
		}

		advanceChar(ch);
		i++;
	}
	return out;
}

function wordKnown(dict, word) {
	var key = word.toLowerCase();
	if (dict[key]) return true;
	var variants = [key];
	if (key.length > 5 && key.slice(-3) === "ing") {
		variants.push(key.slice(0, -3));
		variants.push(key.slice(0, -3) + "e");
	}
	if (key.length > 4 && key.slice(-2) === "ed") {
		variants.push(key.slice(0, -2));
		variants.push(key.slice(0, -1));
	}
	if (key.length > 4 && key.slice(-2) === "ly") variants.push(key.slice(0, -2));
	if (key.length > 3 && key.slice(-1) === "s" && key.slice(-2) !== "ss") variants.push(key.slice(0, -1));
	if (key.length > 4 && key.slice(-2) === "es") variants.push(key.slice(0, -2));
	for (var v = 0; v < variants.length; v++) {
		if (dict[variants[v]]) return true;
	}
	var parts = word.split(/(?=[A-Z])/);
	if (parts.length > 1) {
		var allOk = true;
		for (var p = 0; p < parts.length; p++) {
			var pk = parts[p].toLowerCase();
			if (pk.length >= 2 && !dict[pk]) {
				allOk = false;
				break;
			}
		}
		if (allOk) return true;
	}
	return false;
}

self.onmessage = function (ev) {
	var data = ev.data || {};
	var id = data.id;
	if (data.type !== "spell") {
		self.postMessage({ id: id, markers: [] });
		return;
	}
	var dict = buildDict(data.userWords, data.languages);
	var targets = extractSpellTargets(String(data.code || ""));
	var markers = [];
	for (var t = 0; t < targets.length; t++) {
		var item = targets[t];
		if (wordKnown(dict, item.word)) continue;
		markers.push({
			message: '"' + item.word + '": Unknown word.',
			startLineNumber: item.startLineNumber,
			startColumn: item.startColumn,
			endLineNumber: item.endLineNumber,
			endColumn: item.endColumn,
		});
	}
	self.postMessage({ id: id, markers: markers, version: data.version });
};
