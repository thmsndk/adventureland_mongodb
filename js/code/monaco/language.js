/**
 * Monaco language: types + hover + definition. Sole jsDocStartLine owner.
 */
(function (global) {
	"use strict";

	function load_prefs() {
		if (global.ALEditor && typeof ALEditor.load_prefs === "function") return ALEditor.load_prefs();
		return { theme: "vs-dark", fontSize: 16, fontFamily: "Consolas, monospace" };
	}
	var EDITOR_FONT = (global.ALEditor && ALEditor.defaultFont) || 'Consolas, "Cascadia Mono", Menlo, Monaco, monospace';

	var typesRegistered = false;
	var extraLibDisposables = [];
	var typeModelUris = [];
	var definitionOpenerRegistered = false;
	var linkOpenerRegistered = false;
	var typeCommandRegistered = false;
	var defOverlayEditor = null;
	var customHoverRegistered = false;
	var hoverSourceEditor = null;
	var AL_TYPE_SCHEME = "al-type";
	var OPEN_TYPE_CMD = "al.openType";
	// Built-in / DOM / TS primitives — never offer as type links.
	var HOVER_TYPE_SKIP = {
		any: 1,
		unknown: 1,
		never: 1,
		void: 1,
		null: 1,
		undefined: 1,
		object: 1,
		string: 1,
		number: 1,
		boolean: 1,
		symbol: 1,
		bigint: 1,
		Function: 1,
		Array: 1,
		Promise: 1,
		Record: 1,
		Partial: 1,
		Required: 1,
		Readonly: 1,
		Pick: 1,
		Omit: 1,
		Date: 1,
		Error: 1,
		RegExp: 1,
		Map: 1,
		Set: 1,
		WeakMap: 1,
		WeakSet: 1,
	};

	function tsLanguageApi() {
		if (!global.monaco) return null;
		if (monaco.typescript && monaco.typescript.javascriptDefaults) return monaco.typescript;
		if (monaco.languages && monaco.languages.typescript && monaco.languages.typescript.javascriptDefaults) {
			return monaco.languages.typescript;
		}
		if (global.__AL_MONACO_TYPESCRIPT__ && global.__AL_MONACO_TYPESCRIPT__.javascriptDefaults) {
			return global.__AL_MONACO_TYPESCRIPT__;
		}
		return null;
	}

	/**
	 * HACK(monaco): wrap ambient .d.ts as `export {}; declare global { … }` for extraLibs only.
	 * Why: Monaco/TS5 often treats CODE buffers as modules, so top-level
	 *   `declare function` in extraLibs never merges — hover falls back to `any`.
	 * Purpose: AL IntelliSense / hover on CODE slot models.
	 * Display / Go to Definition use the raw lib text on file:///adventureland/types/…
	 *   while augmentation is registered under ts:al-types-augment/… (non-file scheme so
	 *   Problems cannot open a missing types-augment path).
	 * Remove when: CODE models are script-scoped or extraLibs merge without augmentation.
	 */
	function asGlobalAugmentation(content) {
		var text = String(content || "").replace(/\r\n/g, "\n");
		if (/\bdeclare\s+global\b/.test(text)) return text;
		var body = text.replace(/^declare\s+(function|const|var|let|class|enum)\b/gm, "$1");
		return "export {};\ndeclare global {\n" + body + "\n}\n";
	}

	function registerAdventureLandTypes(force) {
		if (!global.monaco) return false;
		var ts = tsLanguageApi();
		if (!ts || !ts.javascriptDefaults) {
			console.warn("[ALEditor] monaco.typescript missing — JS language service not available");
			return false;
		}
		var libs = global.__AL_MONACO_TYPES__;
		if (!libs) {
			console.warn("[ALEditor] IntelliSense libs missing — load /js/monaco/types/bundle.js before editor.js");
			return false;
		}
		if (typesRegistered && !force) return true;

		var defaultsList = [ts.javascriptDefaults, ts.typescriptDefaults];

		for (var d = 0; d < extraLibDisposables.length; d++) {
			try {
				extraLibDisposables[d].dispose();
			} catch (e) {}
		}
		extraLibDisposables = [];

		// Stock ES + DOM libs from the Monaco ts.worker (CODE runs in Chromium /
		// Electron). AL APIs stay in extraLibs. Electron/Node is additive below.
		// allowJs + allowNonTsExtensions: CODE slots are .js models.
		var prefs = load_prefs();
		var compilerOptions = {
			allowNonTsExtensions: true,
			allowJs: true,
			checkJs: !!prefs.typeChecking,
			noEmit: true,
			noLib: false,
			lib: ["es2020", "dom"],
			allowUmdGlobalAccess: true,
			target: ts.ScriptTarget.ES2020,
			module: ts.ModuleKind.ESNext,
			// Keep JS checking non-strict — AdventureLand scripts are dynamic.
			strict: false,
			noImplicitAny: false,
			strictNullChecks: false,
		};
		if (ts.ModuleDetectionKind && ts.ModuleDetectionKind.Force != null) {
			// Force module mode so declare-global augmentations apply consistently.
			compilerOptions.moduleDetection = ts.ModuleDetectionKind.Force;
		}

		for (var i = 0; i < defaultsList.length; i++) {
			var defaults = defaultsList[i];
			defaults.setDiagnosticsOptions({
				noSemanticValidation: false,
				noSyntaxValidation: false,
				diagnosticCodesToIgnore: [
					1108, // top-level return in scripts
					7006, // parameter implicitly has an 'any' type (checkJs noise)
					7016, // could not find a declaration file for module
					7043, // variable implicitly has type 'any'
					7044, // parameter of lambda implicitly has an 'any' type
					80001, // file is a CommonJS module; may be converted
					2300, // duplicate identifier — type libs via extraLib, not double models
					2451, // cannot redeclare block-scoped variable (same root cause)
				],
			});
			defaults.setCompilerOptions(compilerOptions);
			if (typeof defaults.setEagerModelSync === "function") {
				defaults.setEagerModelSync(true);
			}
			// Keep built-in hover off — we format JSDoc ourselves (see ensureCustomHover).
			if (typeof defaults.setModeConfiguration === "function") {
				var modeCfg = defaults.modeConfiguration || {};
				defaults.setModeConfiguration(Object.assign({}, modeCfg, { hovers: false }));
			}
		}

		var names = Object.keys(libs);
		var wantElectron = !!(global.is_electron || global.is_cli);
		typeModelUris = [];
		for (var n = 0; n < names.length; n++) {
			var name = names[n];
			// Electron/Node typings are additive — only when the client exposes them.
			if (name === "adventureland-electron.d.ts" && !wantElectron) continue;
			var raw = String(libs[name] || "");
			var augmented = asGlobalAugmentation(raw);
			// Prefer file:///adventureland/types/… so monaco-vscode-api FileService can
			// resolve createModelReference (ts:… throws "Unable to resolve resource").
			var uri = "file:///adventureland/types/" + name;
			var api = global.ALVscodeApi;
			if (api && typeof api.ensureTypeLibFile === "function") {
				try {
					var fileUri = api.ensureTypeLibFile(name, raw);
					if (fileUri) uri = String(fileUri);
				} catch (eEnsure) {
					console.warn("[ALEditor] ensureTypeLibFile failed", name, eEnsure);
				}
			}
			var augmentUri = "ts:al-types-augment/" + name;
			for (var j = 0; j < defaultsList.length; j++) {
				extraLibDisposables.push(defaultsList[j].addExtraLib(augmented, augmentUri));
			}
			// VFS only for Explorer / Go to Definition — do NOT createModel here.
			// Eager typescript models + declare-global extraLibs → TS2300 duplicate identifier
			// flood in Problems (and broken clicks on types-augment URIs).
			typeModelUris.push(uri);
			try {
				var legacy = monaco.editor.getModel(monaco.Uri.parse("ts:adventureland/" + name));
				if (legacy) legacy.dispose();
			} catch (eLegacy) {}
			try {
				var staleAugment = monaco.editor.getModel(monaco.Uri.parse("file:///adventureland/types-augment/" + name));
				if (staleAugment) staleAugment.dispose();
			} catch (eAug) {}
			// Drop any previously eager-synced type model; FileService still serves VFS text.
			try {
				var parsed = monaco.Uri.parse(uri);
				var existing = monaco.editor.getModel(parsed);
				if (existing && !existing.__alTypeLibOpened) {
					existing.dispose();
				}
			} catch (eDrop) {}
		}

		ensureDefinitionOpener();
		ensureCustomHover();
		typesRegistered = true;
		return true;
	}

	function isAdventureLandTypeUri(resource) {
		var s = String(resource || "");
		return (
			s.indexOf("ts:adventureland/") !== -1 ||
			s.indexOf("ts:al-types-augment/") !== -1 ||
			s.indexOf("/adventureland/types/") !== -1 ||
			s.indexOf("/adventureland/types-augment/") !== -1 ||
			s.indexOf("file:///adventureland/types/") === 0 ||
			s.indexOf("file:///adventureland/types-augment/") === 0
		);
	}

	function closeDefinitionOverlay() {
		// Legacy overlay removed — workbench type-lib editor is the only host.
		$(document).off("keydown.aldefoverlay");
		if (defOverlayEditor) {
			try {
				defOverlayEditor.dispose();
			} catch (e2) {}
			defOverlayEditor = null;
		}
		var panel = document.getElementById("code-ide-def-overlay");
		if (panel && panel.parentNode) {
			try {
				panel.parentNode.removeChild(panel);
			} catch (e) {}
		}
	}

	function showDefinitionOverlay(sourceEditor, model, selectionOrPosition) {
		var resolved = resolveDefinitionTarget(model, selectionOrPosition);
		model = (resolved && resolved.model) || model;
		var range = resolved && resolved.range;
		closeDefinitionOverlay();
		if (global.SlotSession && typeof SlotSession.open_type_definition === "function") {
			if (SlotSession.open_type_definition(model, range)) return;
		}
		var api = global.ALVscodeApi;
		if (api && typeof api.openTypeLibEditor === "function") {
			var path = "";
			try {
				path = model.uri.path || String(model.uri);
			} catch (ePath) {
				path = "types.d.ts";
			}
			var file = String(path).replace(/^.*\//, "") || "types.d.ts";
			var body = "";
			try {
				body = model.getValue();
			} catch (eBody) {}
			api.openTypeLibEditor(file, body, range);
			return;
		}
		console.warn("[ALEditor] open definition: no workbench type host");
	}

	function normalizeSelectionRange(selectionOrPosition) {
		if (!selectionOrPosition) return null;
		if (typeof selectionOrPosition.startLineNumber === "number") return selectionOrPosition;
		if (typeof selectionOrPosition.lineNumber === "number") {
			return {
				startLineNumber: selectionOrPosition.lineNumber,
				startColumn: selectionOrPosition.column || 1,
				endLineNumber: selectionOrPosition.lineNumber,
				endColumn: (selectionOrPosition.column || 1) + 1,
			};
		}
		return null;
	}

	function isCommentishLine(model, lineNumber) {
		if (!model || lineNumber < 1) return false;
		var t = model.getLineContent(lineNumber).trim();
		if (!t) return true;
		if (t.indexOf("//") === 0) return true;
		if (t.indexOf("/*") === 0) return true;
		if (t.indexOf("*") === 0) return true;
		if (t.indexOf("*/") === 0) return true;
		return false;
	}

	/** Line where the contiguous JSDoc above `declLine` starts (or `declLine` if none). */
	function jsDocStartLine(model, declLine) {
		if (!model || !declLine || declLine < 2) return declLine || 1;
		var probe = declLine - 1;
		while (probe >= 1 && !model.getLineContent(probe).trim()) probe--;
		if (probe < 1) return declLine;
		if (model.getLineContent(probe).indexOf("*/") === -1) return declLine;
		while (probe >= 1) {
			var lt = model.getLineContent(probe).trim();
			if (lt.indexOf("/**") !== -1 || lt.indexOf("/*") === 0) return probe;
			if (lt.indexOf("*") === 0 || lt.indexOf("*/") !== -1) {
				probe--;
				continue;
			}
			break;
		}
		return declLine;
	}

	/**
	 * TS often returns a span inside `@example` / `{@link}` text for ambient d.ts.
	 * Prefer the real `function` / `interface` declaration when we can resolve the word.
	 */
	function resolveDefinitionTarget(model, selectionOrPosition) {
		var range = normalizeSelectionRange(selectionOrPosition);
		if (!model) return { model: model, range: range };
		var name = null;
		if (range) {
			var word = model.getWordAtPosition({
				lineNumber: range.startLineNumber,
				column: range.startColumn,
			});
			if (!word && range.endColumn) {
				word = model.getWordAtPosition({
					lineNumber: range.startLineNumber,
					column: Math.max(range.startColumn, Math.floor((range.startColumn + range.endColumn) / 2)),
				});
			}
			name = word && word.word;
		}
		if (name) {
			var hit = findSymbolInTypeModels(name);
			if (hit) {
				var landedInComment = range && isCommentishLine(model, range.startLineNumber);
				var differentDecl = !range || hit.model !== model || hit.range.startLineNumber !== range.startLineNumber || hit.range.startColumn !== range.startColumn;
				if (landedInComment || differentDecl) {
					return { model: hit.model, range: hit.range };
				}
			}
		}
		return { model: model, range: range };
	}

	function ensureDefinitionOpener() {
		if (definitionOpenerRegistered || !global.monaco || typeof monaco.editor.registerEditorOpener !== "function") return;
		definitionOpenerRegistered = true;
		monaco.editor.registerEditorOpener({
			openCodeEditor: function (source, resource, selectionOrPosition) {
				if (!isAdventureLandTypeUri(resource) && !(resource && resource.scheme === AL_TYPE_SCHEME)) return false;
				if (resource && resource.scheme === AL_TYPE_SCHEME) {
					return openAdventureLandSymbol(source, resource.path || resource.fsPath || resource.authority || "");
				}
				var model = monaco.editor.getModel(resource);
				if (!model) return false;
				showDefinitionOverlay(source, model, selectionOrPosition);
				return true;
			},
		});
	}

	function ensureTypeCommand() {
		if (typeCommandRegistered || !global.monaco || typeof monaco.editor.registerCommand !== "function") return;
		typeCommandRegistered = true;
		monaco.editor.registerCommand(OPEN_TYPE_CMD, function (_accessor, typeName) {
			openAdventureLandSymbol(hoverSourceEditor, typeName);
		});
	}

	function ensureLinkOpener() {
		ensureTypeCommand();
		if (linkOpenerRegistered || !global.monaco || typeof monaco.editor.registerLinkOpener !== "function") return;
		linkOpenerRegistered = true;
		monaco.editor.registerLinkOpener({
			open: function (resource) {
				if (!resource || resource.scheme !== AL_TYPE_SCHEME) return false;
				var name = resource.path || resource.fsPath || resource.authority || "";
				if (name.charAt(0) === "/") name = name.slice(1);
				return openAdventureLandSymbol(hoverSourceEditor, name);
			},
		});
	}

	function escapeRegExp(s) {
		return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}

	function findSymbolInTypeModels(symbolName) {
		if (!symbolName || !global.monaco) return null;
		var escaped = escapeRegExp(symbolName);
		var models = monaco.editor.getModels();
		// Declaration-only patterns — never match `@example get_nearest_monster(` in JSDoc.
		var patterns = [
			new RegExp("(?:^|\\n)\\s*(?:export\\s+)?interface\\s+" + escaped + "\\b"),
			new RegExp("(?:^|\\n)\\s*(?:export\\s+)?type\\s+" + escaped + "\\b"),
			new RegExp("(?:^|\\n)\\s*(?:export\\s+)?(?:declare\\s+)?(?:async\\s+)?(?:function|class|enum|const|var|let)\\s+" + escaped + "\\b"),
		];
		for (var i = 0; i < models.length; i++) {
			var model = models[i];
			var uri = String(model.uri);
			if (uri.indexOf("ts:adventureland/") === -1 && uri.indexOf("/adventureland/types/") === -1) continue;
			var text = model.getValue();
			for (var p = 0; p < patterns.length; p++) {
				var m = patterns[p].exec(text);
				if (!m) continue;
				var nameAt = m[0].indexOf(symbolName);
				var offset = m.index + (nameAt >= 0 ? nameAt : m[0].length - symbolName.length);
				var start = model.getPositionAt(Math.max(0, offset));
				if (isCommentishLine(model, start.lineNumber)) continue;
				var end = model.getPositionAt(Math.max(0, offset) + symbolName.length);
				return {
					model: model,
					range: {
						startLineNumber: start.lineNumber,
						startColumn: start.column,
						endLineNumber: end.lineNumber,
						endColumn: end.column,
					},
				};
			}
		}
		return null;
	}

	function openAdventureLandSymbol(sourceEditor, symbolName) {
		var name = String(symbolName || "")
			.replace(/^\//, "")
			.trim();
		if (!name) return false;
		var hit = findSymbolInTypeModels(name);
		if (!hit) {
			if (typeof global.add_log === "function") add_log("No declaration found for " + name, "#E06666");
			return true;
		}
		showDefinitionOverlay(sourceEditor, hit.model, hit.range);
		return true;
	}

	function displayPartsToText(parts) {
		if (!parts) return "";
		if (typeof parts === "string") return parts;
		// Some TS versions nest documentation as string[] — flatten safely.
		if (Array.isArray(parts) && parts.length && typeof parts[0] === "string") return parts.join("");
		var out = "";
		for (var i = 0; i < parts.length; i++) {
			var p = parts[i];
			if (!p) continue;
			if (typeof p === "string") out += p;
			else out += p.text || "";
		}
		return out;
	}

	/** Trusted command link — Monaco strips unknown schemes like al-type: in hover markdown. */
	function mdCommandLink(name, label) {
		var href = "command:" + OPEN_TYPE_CMD + "?" + encodeURIComponent(JSON.stringify([name]));
		return "[" + (label || name) + "](" + href + ")";
	}

	function mdTrusted(value) {
		return {
			value: value,
			isTrusted: { enabledCommands: [OPEN_TYPE_CMD] },
			supportThemeIcons: true,
		};
	}

	/** PascalCase AL types mentioned in hover content (for in-signature / prose linkify). */
	function collectLinkedTypeNames(signature, docs, tags) {
		var found = {};
		var order = [];
		function add(name) {
			if (!name || HOVER_TYPE_SKIP[name] || found[name]) return;
			if (!/^[A-Z][A-Za-z0-9_]*$/.test(name)) return;
			if (!findSymbolInTypeModels(name)) return;
			found[name] = 1;
			order.push(name);
		}
		var blob = String(signature || "") + "\n" + String(docs || "");
		if (tags) {
			for (var i = 0; i < tags.length; i++) blob += "\n" + displayPartsToText(tags[i].text);
		}
		var re = /\b([A-Z][A-Za-z0-9_]*)\b/g;
		var m;
		while ((m = re.exec(blob))) add(m[1]);
		var linkRe = /\{@link(?:code|plain)?\s+([^\s|}]+)/g;
		while ((m = linkRe.exec(blob))) {
			add(
				String(m[1])
					.replace(/[#.].*$/, "")
					.trim(),
			);
		}
		return order;
	}

	/**
	 * Signature as a typescript fence (themed tokens) + separate Types row with
	 * stock markdown command: links (no DOM scrape / MutationObserver).
	 */
	function signatureMarkdown(signature) {
		var sig = String(signature || "")
			.replace(/^\s+|\s+$/g, "")
			.replace(/```+/g, "'''");
		if (!sig) return "";
		return "```typescript\n" + sig + "\n```";
	}

	function typesLinksMarkdown(typeNames) {
		if (!typeNames || !typeNames.length) return "";
		var parts = [];
		for (var i = 0; i < typeNames.length; i++) {
			parts.push(mdCommandLink(typeNames[i]));
		}
		return "**Types** — " + parts.join(" · ");
	}

	/** `{@link Foo}` / `{@link Foo|label}` → clickable command links. */
	function processInlineJsDoc(text) {
		return String(text || "").replace(/\{@link(?:code|plain)?\s+([^|}]+?)(?:\s*\|\s*([^}]+))?\}/g, function (_m, target, label) {
			var t = String(target || "")
				.trim()
				.split(/\s+/)[0]
				.replace(/[#.].*$/, "");
			var l = label ? String(label).trim() : t;
			if (!t) return l || "";
			if (HOVER_TYPE_SKIP[t]) return "`" + l + "`";
			if (!findSymbolInTypeModels(t)) return "`" + l + "`";
			return mdCommandLink(t, l);
		});
	}

	/** Link PascalCase AL types in freeform hover prose; leave existing markdown links alone. */
	function linkifyTypeNamesInText(text, typeNames) {
		var out = String(text || "");
		if (!out || !typeNames || !typeNames.length) return out;
		var protectedLinks = [];
		out = out.replace(/\[[^\]]*\]\([^)]+\)/g, function (m) {
			protectedLinks.push(m);
			return "\0L" + (protectedLinks.length - 1) + "\0";
		});
		var names = typeNames.slice().sort(function (a, b) {
			return b.length - a.length;
		});
		for (var i = 0; i < names.length; i++) {
			var name = names[i];
			var re = new RegExp("\\b" + escapeRegExp(name) + "\\b", "g");
			out = out.replace(re, mdCommandLink(name));
		}
		out = out.replace(/\0L(\d+)\0/g, function (_m, idx) {
			return protectedLinks[Number(idx)] || "";
		});
		return out;
	}

	/**
	 * Format TS quick-info tags for Markdown hover.
	 * Fixes Monaco's tagToString which joins display parts with spaces and flattens @example.
	 */
	function formatJsDocTags(tags) {
		var params = [];
		var returns = "";
		var examples = [];
		var other = [];

		for (var i = 0; i < (tags || []).length; i++) {
			var tag = tags[i];
			if (!tag || !tag.name) continue;
			var name = tag.name;
			var parts = tag.text;
			var raw = processInlineJsDoc(displayPartsToText(parts));

			if (name === "param") {
				var paramName = "";
				var rest = "";
				if (Array.isArray(parts) && parts.length) {
					paramName = parts[0].text || "";
					rest = processInlineJsDoc(displayPartsToText(parts.slice(1)))
						.replace(/^\s*[—\-–:]\s*/, "")
						.replace(/^\s+/, "");
				} else {
					var pm = /^\s*(\S+)\s*(?:[—\-–:]\s*)?([\s\S]*)$/.exec(raw);
					if (pm) {
						paramName = pm[1];
						rest = pm[2];
					} else rest = raw;
				}
				rest = rest
					.replace(/\n\s*-\s+/g, "; ")
					.replace(/\n+/g, " ")
					.replace(/\s+/g, " ")
					.trim();
				// Avoid markdown list bullets — they mis-align next to inline code in Monaco hover.
				params.push("**" + paramName + "** — " + (rest || "_(no description)_"));
				continue;
			}

			if (name === "returns" || name === "return") {
				returns = raw.replace(/^\s+/, "");
				continue;
			}

			if (name === "example") {
				var code = raw.replace(/^\r?\n/, "").replace(/\s+$/, "");
				if (!code) continue;
				if (code.indexOf("```") !== -1) examples.push(code);
				else examples.push("```typescript\n" + code + "\n```");
				continue;
			}

			if (name === "deprecated") {
				other.push("> **Deprecated:** " + raw.replace(/^\s+/, ""));
				continue;
			}

			if (name === "see" || name === "seealso") {
				other.push("See also: " + raw.replace(/^\s+/, ""));
				continue;
			}

			other.push("**@" + name + "**" + (raw ? " — " + raw.replace(/^\s+/, "") : ""));
		}

		var sections = [];
		if (params.length) {
			sections.push("**Parameters**\n\n" + params.join("\n\n"));
		}
		if (returns) sections.push("**Returns** — " + returns);
		if (other.length) sections.push(other.join("\n\n"));
		if (examples.length) {
			sections.push("**Examples**\n\n" + examples.join("\n\n"));
		}
		return sections;
	}

	/** Collapse odd spaces TS leaves before punctuation after inline code / links. */
	function tidyHoverDocs(text) {
		return String(text || "")
			.replace(/\s+([.,;:!?)\]])/g, "$1")
			.replace(/([({\[])\s+/g, "$1")
			.replace(/[ \t]+\n/g, "\n")
			.replace(/\n{3,}/g, "\n\n")
			.replace(/^\s+|\s+$/g, "");
	}

	function buildHoverMarkdown(info) {
		var signature = displayPartsToText(info.displayParts);
		var rawDocs = displayPartsToText(info.documentation);
		var typeNames = collectLinkedTypeNames(signature, rawDocs, info.tags);
		var docs = tidyHoverDocs(linkifyTypeNamesInText(processInlineJsDoc(rawDocs), typeNames));

		var contents = [];
		var sigMd = signatureMarkdown(signature);
		if (sigMd) contents.push(mdTrusted(sigMd));
		var typesRow = typesLinksMarkdown(typeNames);
		if (typesRow) contents.push(mdTrusted(typesRow));
		if (docs) contents.push(mdTrusted(docs));

		var sections = formatJsDocTags(info.tags);
		for (var s = 0; s < sections.length; s++) {
			contents.push(mdTrusted(tidyHoverDocs(linkifyTypeNamesInText(sections[s], typeNames))));
		}
		return { contents: contents, signature: signature, typeNames: typeNames, hasSignatureFence: !!sigMd };
	}

	function textSpanToRange(model, span) {
		if (!span || typeof model.getPositionAt !== "function") return null;
		var p1 = model.getPositionAt(span.start);
		var p2 = model.getPositionAt(span.start + span.length);
		return {
			startLineNumber: p1.lineNumber,
			startColumn: p1.column,
			endLineNumber: p2.lineNumber,
			endColumn: p2.column,
		};
	}

	function ensureCustomHover() {
		if (customHoverRegistered || !global.monaco || !monaco.languages) return;
		var ts = tsLanguageApi();
		if (!ts || typeof ts.getJavaScriptWorker !== "function") return;
		customHoverRegistered = true;
		ensureTypeCommand();
		ensureLinkOpener();

		function provideHover(model, position) {
			try {
				var eds = monaco.editor.getEditors ? monaco.editor.getEditors() : [];
				for (var e = 0; e < (eds || []).length; e++) {
					if (eds[e].getModel && eds[e].getModel() === model) {
						hoverSourceEditor = eds[e];
						break;
					}
				}
			} catch (err) {}

			var getWorker = model.getLanguageId() === "typescript" && typeof ts.getTypeScriptWorker === "function" ? ts.getTypeScriptWorker : ts.getJavaScriptWorker;
			return getWorker()
				.then(function (workerGetter) {
					return workerGetter(model.uri);
				})
				.then(function (client) {
					var offset = model.getOffsetAt(position);
					return client.getQuickInfoAtPosition(model.uri.toString(), offset);
				})
				.then(function (info) {
					if (!info) return null;
					var built = buildHoverMarkdown(info);
					if (!built.contents.length) return null;
					return {
						range: textSpanToRange(model, info.textSpan),
						contents: built.contents,
					};
				})
				.catch(function (err) {
					console.warn("[ALEditor] custom hover failed", err);
					return null;
				});
		}

		monaco.languages.registerHoverProvider("javascript", { provideHover: provideHover });
		monaco.languages.registerHoverProvider("typescript", { provideHover: provideHover });
	}

	/** Console helper: ALEditor.debugTypes() — paste results if hover still says `any`. */
	function debugTypes() {
		var ts = tsLanguageApi();
		var out = {
			hasMonaco: !!global.monaco,
			hasTs: !!(ts && ts.javascriptDefaults),
			tsApiPath: monaco.typescript ? "monaco.typescript" : monaco.languages && monaco.languages.typescript ? "monaco.languages.typescript" : null,
			bundleKeys: global.__AL_MONACO_TYPES__ ? Object.keys(global.__AL_MONACO_TYPES__) : [],
			typesRegistered: typesRegistered,
			models: [],
			extraLibs: null,
			compilerOptions: null,
			quickInfo: null,
			error: null,
		};
		if (!out.hasTs) {
			console.warn("[ALEditor.debugTypes]", out);
			return out;
		}
		try {
			var jsDefaults = ts.javascriptDefaults;
			out.compilerOptions = jsDefaults.getCompilerOptions ? jsDefaults.getCompilerOptions() : null;
			out.extraLibs = jsDefaults.getExtraLibs ? jsDefaults.getExtraLibs() : null;
			var models = monaco.editor.getModels();
			for (var i = 0; i < models.length; i++) {
				out.models.push({
					uri: String(models[i].uri),
					language: models[i].getLanguageId ? models[i].getLanguageId() : "",
					len: models[i].getValueLength ? models[i].getValueLength() : models[i].getValue().length,
				});
			}
		} catch (e) {
			out.error = String(e && e.message ? e.message : e);
		}

		var probe = "get_nearest_monster";
		var getWorker = ts.getJavaScriptWorker;
		if (typeof getWorker !== "function") {
			out.error = "getJavaScriptWorker missing on TS API";
			console.warn("[ALEditor.debugTypes]", out);
			return out;
		}
		return getWorker()
			.then(function (workerGetter) {
				var model = null;
				try {
					var editors = monaco.editor.getEditors ? monaco.editor.getEditors() : [];
					if (editors && editors.length && editors[0].getModel) model = editors[0].getModel();
				} catch (e) {}
				if (!model) {
					var allModels = monaco.editor.getModels();
					for (var m = 0; m < allModels.length; m++) {
						if (String(allModels[m].uri).indexOf("/slots/") !== -1) {
							model = allModels[m];
							break;
						}
					}
					if (!model && allModels.length) model = allModels[0];
				}
				if (!model) {
					out.error = "no model";
					console.warn("[ALEditor.debugTypes]", out);
					return out;
				}
				var text = model.getValue();
				var idx = text.indexOf(probe);
				if (idx < 0) {
					out.error = "string " + probe + " not found in active model — put the cursor on it or leave it in the file";
					console.warn("[ALEditor.debugTypes]", out);
					return out;
				}
				return workerGetter(model.uri).then(function (client) {
					return client.getQuickInfoAtPosition(model.uri.toString(), idx).then(function (info) {
						out.quickInfo = info;
						out.probeOffset = idx;
						out.modelUri = String(model.uri);
						console.log("[ALEditor.debugTypes]", out);
						return out;
					});
				});
			})
			.catch(function (err) {
				out.error = String(err && err.message ? err.message : err);
				console.warn("[ALEditor.debugTypes]", out);
				return out;
			});
	}

	var ALEditor = global.ALEditor || (global.ALEditor = {});
	Object.assign(ALEditor, {
		registerTypes: registerAdventureLandTypes,
		debugTypes: debugTypes,
		jsDocStartLine: jsDocStartLine,
		tsLanguageApi: tsLanguageApi,
		ensureCustomHover: ensureCustomHover,
		showDefinitionOverlay: showDefinitionOverlay,
	});
})(typeof window !== "undefined" ? window : globalThis);
