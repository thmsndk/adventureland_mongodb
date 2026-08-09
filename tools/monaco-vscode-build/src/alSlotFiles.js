/**
 * AdventureLand CODE slots as monaco-vscode-api workbench editor tabs.
 * Friendly URIs mirror the explorer (characters/ / slots/) so tab titles and
 * breadcrumbs look like real files — then outline symbols appear "inside" them.
 */
import { RegisteredFileSystemProvider, RegisteredMemoryFile, registerFileSystemOverlay } from "@codingame/monaco-vscode-files-service-override";
import { StandaloneServices } from "@codingame/monaco-vscode-api/services";
import { IEditorService } from "@codingame/monaco-vscode-api/vscode/vs/workbench/services/editor/common/editorService.service";
import { ITextFileService } from "@codingame/monaco-vscode-api/vscode/vs/workbench/services/textfile/common/textfiles.service";
import * as monaco from "monaco-editor";

var ROOT = "file:///adventureland/";
var LEGACY_SLOT_PREFIX = ROOT + "slots/";
var provider = null;
var overlayDisposable = null;
var memoryFiles = Object.create(null);
var fileDisposables = Object.create(null);
var modelRefs = Object.create(null);
var uriBySlot = Object.create(null);
var slotByUri = Object.create(null);
var activeListener = null;
var textEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
/** Last known slot body — survives model dispose during URI remounts. */
var lastContentBySlot = Object.create(null);

function safeFileBase(label, slot) {
	var base = String(label == null ? "" : label)
		// Legacy titles: "Name — slot #N", "Name (character code)", "Name (#N)"
		.replace(/\s+[—–-]\s+slot\s*#\d+\s*$/i, "")
		.replace(/\s+\(character code\)\s*$/i, "")
		.replace(/\s+\(unsaved\)\s*$/i, "")
		.replace(/\s*\(#\d+\)\s*$/i, "")
		.replace(/\.js$/i, "")
		.trim();
	if (!base) base = "";
	base = base.replace(/[<>:"|?*\u0000-\u001f\\/]/g, "_");
	return base;
}

/** True when the visible filename is still a raw slot id / legacy title (CH_… / bare number / #N suffix). */
function isUglyBase(base, slot) {
	var b = String(base || "")
		.replace(/\.js$/i, "")
		.trim();
	var s = String(slot || "");
	if (!b) return true;
	if (b === s) return true;
	if (/^CH_[A-Za-z0-9_-]+$/i.test(b)) return true;
	if (/\s+[—–-]\s+slot\s*#\d+$/i.test(b)) return true;
	if (/\s+\(character code\)\s*$/i.test(b)) return true;
	// Always-appended slot marker (not collision-only when base is otherwise clean).
	if (s && new RegExp("\\s*\\(#" + s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\)\\s*$").test(b)) return true;
	return false;
}

function isProvisionalBase(base) {
	var b = String(base || "")
		.replace(/\.js$/i, "")
		.trim();
	return b === "code" || b === "character" || b.indexOf("_pending_") === 0;
}

function needsRelabel(key, opts) {
	opts = opts || {};
	var uri = uriBySlot[key];
	if (!uri) return false;
	var current = uriFileBase(uri);
	var labelBase = safeFileBase(opts.label, key);
	var uriStr = String(uri);
	// Never downgrade a friendly name to a provisional label (code.js / character.js).
	if (labelBase && isProvisionalBase(labelBase) && !isProvisionalBase(current) && !isUglyBase(current, key)) {
		return false;
	}
	if (opts.character && uriStr.indexOf("/characters/") === -1) return true;
	if (!opts.character && labelBase && uriStr.indexOf("/slots/") === -1) return true;
	if (isUglyBase(current, key)) return true;
	if (labelBase && !isUglyBase(labelBase, key) && !isProvisionalBase(labelBase) && current !== labelBase) return true;
	if (labelBase && !isUglyBase(labelBase, key) && !isProvisionalBase(labelBase) && isProvisionalBase(current)) return true;
	return false;
}

function uriFileBase(uri) {
	try {
		var path = uri && (uri.path || uri.fsPath || String(uri));
		var parts = String(path).split("/");
		var leaf = parts[parts.length - 1] || "";
		return decodeURIComponent(leaf).replace(/\.js$/i, "");
	} catch (e) {
		return "";
	}
}

function desiredBase(slot, opts) {
	opts = opts || {};
	var key = String(slot);
	var base = safeFileBase(opts.label, key);
	if (isUglyBase(base, key)) {
		base = opts.character ? "character" : "code";
	}
	return base;
}

function forgetSlotUri(key) {
	var uri = uriBySlot[key];
	if (uri) {
		delete slotByUri[String(uri)];
		try {
			delete slotByUri[uri.toString(true)];
		} catch (e) {}
	}
	delete uriBySlot[key];
}

/**
 * Build a stable, human-readable URI for a slot.
 * characters/Ahnaki.js · slots/MyCode.js (disambiguate with (#n) on collision)
 */
export function slotUri(slot, opts) {
	opts = opts || {};
	var key = String(slot);
	var base = desiredBase(key, opts);
	var existing = uriBySlot[key];
	// Never remapping unless forceRelabel — callers that only look up a URI must not
	// point uriBySlot at a path that is not yet registered (openEditor → FileNotFound).
	// Ugly/provisional → friendly renames go through ensureSlotFile(needsRelabel) → retire → register.
	if (existing && !opts.forceRelabel) {
		return existing;
	}
	if (existing && opts.forceRelabel) {
		forgetSlotUri(key);
	}

	var folder = opts.character ? "characters" : "slots";
	var file = base + ".js";
	var candidate = ROOT + folder + "/" + encodeURIComponent(file);

	var guard = 0;
	while (slotByUri[candidate] && slotByUri[candidate] !== key && guard < 50) {
		guard++;
		var alt = base + " (#" + key + ")";
		if (guard > 1) alt = base + " (#" + key + ") " + guard;
		file = alt + ".js";
		candidate = ROOT + folder + "/" + encodeURIComponent(file);
	}

	var uri = monaco.Uri.parse(candidate);
	uriBySlot[key] = uri;
	slotByUri[String(uri)] = key;
	slotByUri[candidate] = key;
	return uri;
}

export function slotFromUri(uri) {
	if (!uri) return null;
	var s = String(uri);
	if (slotByUri[s]) return slotByUri[s];
	// Legacy: file:///adventureland/slots/{slotId}.js
	if (s.indexOf(LEGACY_SLOT_PREFIX) === 0) {
		var rest = s.slice(LEGACY_SLOT_PREFIX.length);
		if (rest.slice(-3) === ".js") rest = rest.slice(0, -3);
		try {
			var decoded = decodeURIComponent(rest);
			if (/^CH_/i.test(decoded) || /^\d+$/.test(decoded)) return decoded;
		} catch (e) {}
	}
	return null;
}

export function initSlotFiles() {
	if (provider) return;
	provider = new RegisteredFileSystemProvider(false);
	overlayDisposable = registerFileSystemOverlay(1, provider);
}

function encodeText(text) {
	if (textEncoder) return textEncoder.encode(text);
	var s = String(text);
	var arr = new Uint8Array(s.length);
	for (var i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i) & 0xff;
	return arr;
}

function closeEditorsForUri(uri) {
	if (!uri) return Promise.resolve();
	try {
		var editorService = StandaloneServices.get(IEditorService);
		var editors = editorService.findEditors ? editorService.findEditors(uri) : [];
		if (editors && editors.length) {
			return Promise.resolve(editorService.closeEditors(editors)).catch(function () {});
		}
	} catch (e) {}
	return Promise.resolve();
}

function retireSlotBindings(key) {
	var uri = uriBySlot[key];
	return closeEditorsForUri(uri).then(function () {
		if (modelRefs[key]) {
			try {
				modelRefs[key].dispose();
			} catch (e2) {}
			delete modelRefs[key];
		}
		if (fileDisposables[key]) {
			try {
				fileDisposables[key].dispose();
			} catch (e3) {}
			delete fileDisposables[key];
		}
		delete memoryFiles[key];
		// Keep lastContentBySlot — remounts need the body after model dispose.
		forgetSlotUri(key);
	});
}

function readSlotContent(key, fallback) {
	if (fallback != null) return String(fallback);
	try {
		var uri = uriBySlot[key];
		var model = uri && monaco.editor.getModel(uri);
		if (model) {
			var live = model.getValue();
			lastContentBySlot[key] = live;
			return live;
		}
	} catch (e) {}
	if (lastContentBySlot[key] != null) return lastContentBySlot[key];
	return null;
}

/**
 * Run model writes without marking the slot dirty in SlotSession
 * (ALCodeSessionState.applying_model gates onDidChangeContent).
 */
function withApplyingModel(fn) {
	var state = typeof window !== "undefined" ? window.ALCodeSessionState : null;
	var prev = state ? !!state.applying_model : false;
	if (state) state.applying_model = true;
	try {
		return fn();
	} finally {
		if (state) state.applying_model = prev;
	}
}

/** Clear workbench dirty for a VFS URI (seeded / load_code bodies are not user edits). */
function markUriEditorClean(uri) {
	if (!uri) return;
	try {
		var textFileService = StandaloneServices.get(ITextFileService);
		var model = textFileService && textFileService.files && typeof textFileService.files.get === "function" ? textFileService.files.get(uri) : null;
		if (model && typeof model.setDirty === "function") model.setDirty(false);
	} catch (e) {}
}

/** setValue + clear dirty; no-op setValue when already equal. */
function setModelValueClean(uri, text) {
	var model = uri && monaco.editor.getModel(uri);
	if (!model) return false;
	var next = String(text);
	if (model.getValue() === next) {
		markUriEditorClean(uri);
		return true;
	}
	withApplyingModel(function () {
		model.setValue(next);
	});
	markUriEditorClean(uri);
	return true;
}

/** Clear workbench dirty for a CODE slot tab after programmatic seed/load. */
export function markSlotEditorClean(slot) {
	var key = String(slot);
	markUriEditorClean(uriBySlot[key]);
}

/** Wire onDidActiveEditorChange once (CODE hydrate / SlotSession.on_workbench_active_slot). */
export function ensureActiveEditorSlotSync(onActiveSlot) {
	wireActiveEditorListener(onActiveSlot);
}

/**
 * Serialize VFS register/retire/open across ALL slots (and nest re-entrancy per slot).
 * Cross-slot races on the codingame FS overlay were still able to FileNotFound.
 */
var openSlotChains = Object.create(null);
var openSlotDepth = Object.create(null);
var openSkipWarned = Object.create(null);
var globalVfsChain = Promise.resolve();

function withSlotLock(key, fn) {
	if (openSlotDepth[key]) {
		return Promise.resolve()
			.then(fn)
			.catch(function (err) {
				console.warn("[ALSlotFiles] slot op failed", key, err);
				return null;
			});
	}
	var prevSlot = openSlotChains[key] || Promise.resolve();
	var prevGlobal = globalVfsChain;
	var job = Promise.all([prevSlot.catch(function () {}), prevGlobal.catch(function () {})]).then(function () {
		openSlotDepth[key] = (openSlotDepth[key] || 0) + 1;
		return Promise.resolve()
			.then(fn)
			.finally(function () {
				openSlotDepth[key] -= 1;
				if (!openSlotDepth[key]) delete openSlotDepth[key];
			});
	});
	openSlotChains[key] = job.then(
		function () {},
		function () {},
	);
	globalVfsChain = job.then(
		function () {},
		function () {},
	);
	return job;
}

/**
 * Register or update slot file content in the VFS (does not open a tab).
 * content == null → keep existing VFS/model (label remounts / focus-only opens).
 * forceValue: false → never overwrite an existing file's body.
 * Never creates a brand-new empty file from a null body (callers must load_code first).
 */
export function ensureSlotFile(slot, content, opts) {
	var key = String(slot);
	return withSlotLock(key, function () {
		return ensureSlotFileNow(key, content, opts);
	});
}

/**
 * Relabel without unregistering the old path until the new path is registered.
 * Keeps the FS overlay consistent so close/open cannot FileNotFound mid-remount.
 */
function softRelabelSlot(key, body, opts) {
	var oldUri = uriBySlot[key];
	var oldDisp = fileDisposables[key];
	var oldRef = modelRefs[key];
	forgetSlotUri(key);
	var newUri = slotUri(key, Object.assign({}, opts, { forceRelabel: true }));
	if (oldUri && String(oldUri) === String(newUri)) {
		uriBySlot[key] = oldUri;
		slotByUri[String(oldUri)] = key;
		try {
			slotByUri[oldUri.toString(true)] = key;
		} catch (e) {}
		if (!memoryFiles[key] && body != null) {
			lastContentBySlot[key] = String(body);
			memoryFiles[key] = new RegisteredMemoryFile(oldUri, String(body));
			fileDisposables[key] = provider.registerFile(memoryFiles[key]);
		}
		return Promise.resolve(oldUri);
	}

	lastContentBySlot[key] = String(body);
	memoryFiles[key] = new RegisteredMemoryFile(newUri, String(body));
	fileDisposables[key] = provider.registerFile(memoryFiles[key]);
	if (oldRef) {
		try {
			oldRef.dispose();
		} catch (e2) {}
	}
	delete modelRefs[key];

	// Old file stays registered (oldDisp) until editors on it are closed.
	return closeEditorsForUri(oldUri).then(function () {
		if (oldDisp) {
			try {
				oldDisp.dispose();
			} catch (e3) {}
		}
		return newUri;
	});
}

function ensureSlotFileNow(key, content, opts) {
	initSlotFiles();
	opts = opts || {};

	function register(uri, body) {
		if (!memoryFiles[key]) {
			if (body == null) {
				// Do not invent an empty USERCODE stand-in — wait for a real body.
				return Promise.resolve(null);
			}
			lastContentBySlot[key] = String(body);
			memoryFiles[key] = new RegisteredMemoryFile(uri, String(body));
			fileDisposables[key] = provider.registerFile(memoryFiles[key]);
			return Promise.resolve(uri);
		}
		if (body == null) return Promise.resolve(uri);
		if (opts.forceValue === false) return Promise.resolve(uri);
		var text = String(body);
		lastContentBySlot[key] = text;
		var model = monaco.editor.getModel(uri);
		if (model) {
			setModelValueClean(uri, text);
			return Promise.resolve(uri);
		}
		return Promise.resolve(memoryFiles[key].write(encodeText(text))).then(function () {
			return uri;
		});
	}

	if (needsRelabel(key, opts)) {
		var body = readSlotContent(key, content);
		// Relabel needs a real body to re-seed VFS — never point uriBySlot at an unregistered path.
		if (body == null) {
			if (opts.forceValue) body = content != null ? String(content) : "";
			else {
				// Keep the existing registered URI — never call slotUri here (that remaps
				// without registering and causes openEditor FileNotFound).
				return Promise.resolve(uriBySlot[key] || null);
			}
		}
		return softRelabelSlot(key, body, opts);
	}

	var uri = slotUri(key, opts);
	return register(uri, content);
}

function disposeConflictingStandaloneModel(uri) {
	try {
		var existing = monaco.editor.getModel(uri);
		if (!existing) return;
		var key = slotFromUri(uri);
		// Never dispose models backed by our VFS / workbench refs (label remount races).
		if (key != null && (modelRefs[key] || memoryFiles[key])) return;
		existing.dispose();
	} catch (e) {}
}

export function getActiveCodeEditor() {
	try {
		var editorService = StandaloneServices.get(IEditorService);
		var ctrl = editorService && editorService.activeTextEditorControl;
		if (ctrl && typeof ctrl.getModel === "function") return ctrl;
	} catch (e) {}
	return null;
}

export function getActiveSlot() {
	var ed = getActiveCodeEditor();
	if (!ed || !ed.getModel) return null;
	var model = ed.getModel();
	return model ? slotFromUri(model.uri) : null;
}

export function openSlotEditor(slot, content, opts, showWorkbench, onActiveSlot) {
	opts = opts || {};
	var key = String(slot);
	return withSlotLock(key, function () {
		return openSlotEditorNow(key, content, opts, showWorkbench, onActiveSlot);
	});
}

function warnOpenSkip(key) {
	if (openSkipWarned[key]) return;
	openSkipWarned[key] = true;
	console.warn("[ALSlotFiles] openSlotEditor skipped — no VFS body for", key);
}

function openSlotEditorNow(key, content, opts, showWorkbench, onActiveSlot) {
	var label = opts.label || desiredBase(key, opts) + ".js";
	// Always seed a VFS body before openEditor — FileNotFound if uri is mapped but unregistered.
	var openContent = content;
	if (openContent == null && opts.forceValue) openContent = "";
	// Character tabs may remount before a body arrives — never leave them unregistered.
	if (openContent == null && opts.character) openContent = "";
	return ensureSlotFileNow(key, openContent, opts)
		.then(function (uri) {
			if (!uri || !memoryFiles[key]) {
				var seed0 = openContent != null ? String(openContent) : readSlotContent(key, null);
				if (seed0 == null && (opts.forceValue || opts.character)) seed0 = "";
				if (seed0 == null) {
					warnOpenSkip(key);
					return null;
				}
				uri = slotUri(key, opts);
				if (!memoryFiles[key]) {
					lastContentBySlot[key] = seed0;
					memoryFiles[key] = new RegisteredMemoryFile(uri, seed0);
					fileDisposables[key] = provider.registerFile(memoryFiles[key]);
				}
			}
			delete openSkipWarned[key];
			if (typeof showWorkbench === "function") showWorkbench();
			enableWorkbenchOwnsTabsDom();
			disposeConflictingStandaloneModel(uri);

			function afterModel() {
				var editorService = StandaloneServices.get(IEditorService);
				function doOpen(resource) {
					return Promise.resolve(
						editorService.openEditor({
							resource: resource,
							label: label.replace(/\.js$/i, "") + ".js",
							options: {
								pinned: true,
								preserveFocus: !!opts.preserveFocus,
							},
						}),
					);
				}
				// Yield so the FS overlay finishes notifying before setInput resolves the resource.
				return Promise.resolve()
					.then(function () {
						return doOpen(uri);
					})
					.then(function () {
						wireActiveEditorListener(onActiveSlot);
						return monaco.editor.getModel(uri);
					})
					.catch(function (err) {
						var body = openContent != null ? String(openContent) : readSlotContent(key, "");
						return ensureSlotFileNow(key, body, Object.assign({}, opts, { forceValue: true })).then(function (uri2) {
							if (!uri2 || !memoryFiles[key]) {
								console.warn("[ALSlotFiles] openEditor failed", String(uri), err);
								return Promise.reject(err);
							}
							return Promise.resolve()
								.then(function () {
									return doOpen(uri2);
								})
								.then(function () {
									wireActiveEditorListener(onActiveSlot);
									return monaco.editor.getModel(uri2);
								})
								.catch(function (err2) {
									console.warn("[ALSlotFiles] openEditor failed", String(uri2), err2);
									return Promise.reject(err2);
								});
						});
					});
			}

			if (modelRefs[key]) {
				if (opts.forceValue && openContent != null) {
					setModelValueClean(uri, openContent);
				} else {
					markUriEditorClean(uri);
				}
				return afterModel().then(function (model) {
					markUriEditorClean(uri);
					return model;
				});
			}

			var seed = openContent != null ? String(openContent) : readSlotContent(key, null);
			if (seed == null) seed = opts.forceValue || opts.character ? "" : null;
			if (!memoryFiles[key]) {
				if (seed == null) {
					warnOpenSkip(key);
					return null;
				}
				memoryFiles[key] = new RegisteredMemoryFile(uri, seed);
				fileDisposables[key] = provider.registerFile(memoryFiles[key]);
			}
			return monaco.editor.createModelReference(uri, seed != null ? seed : undefined).then(function (ref) {
				modelRefs[key] = ref;
				return afterModel().then(function (model) {
					if (opts.forceValue || openContent != null) markUriEditorClean(uri);
					return model;
				});
			});
		})
		.catch(function (err) {
			console.warn("[ALSlotFiles] openSlotEditor failed", key, err);
			return null;
		});
}

function enableWorkbenchOwnsTabsDom() {
	var codeui = document.getElementById("codeui");
	if (codeui) codeui.classList.add("al-workbench-owns-tabs");
	var slot = document.getElementById("code-ide-editor-slot");
	if (!slot) return;
	var hosts = slot.querySelectorAll(".monaco-editor-host");
	for (var i = 0; i < hosts.length; i++) {
		// visibility — not display:none — so any nested ListView can still measure.
		hosts[i].style.visibility = "hidden";
		hosts[i].style.pointerEvents = "none";
		hosts[i].dataset.alHiddenForWorkbench = "1";
	}
}

export function disableWorkbenchOwnsTabsDom() {
	var codeui = document.getElementById("codeui");
	if (codeui) codeui.classList.remove("al-workbench-owns-tabs");
}

function wireActiveEditorListener(onActiveSlot) {
	if (activeListener || typeof onActiveSlot !== "function") return;
	try {
		var editorService = StandaloneServices.get(IEditorService);
		activeListener = editorService.onDidActiveEditorChange(function () {
			try {
				onActiveSlot(getActiveSlot());
			} catch (e) {}
		});
	} catch (e) {}
}

export function closeSlotEditor(slot) {
	var key = String(slot);
	return retireSlotBindings(key);
}

var typeLibFiles = Object.create(null);
var typeLibDisposables = Object.create(null);

/**
 * Register AdventureLand .d.ts libs under file:///adventureland/types/ so
 * workbench createModelReference / Go to Definition can resolve them.
 * (ts:adventureland/… models are invisible to the FileService → "Unable to resolve resource".)
 */
export function ensureTypeLibFile(name, content) {
	initSlotFiles();
	var file = String(name || "").replace(/^.*\//, "");
	if (!file) return null;
	var uri = monaco.Uri.parse(ROOT + "types/" + encodeURIComponent(file));
	var text = content != null ? String(content) : "";
	var key = "type:" + file;
	if (!typeLibFiles[key]) {
		typeLibFiles[key] = new RegisteredMemoryFile(uri, text);
		typeLibDisposables[key] = provider.registerFile(typeLibFiles[key]);
	} else {
		try {
			var model = monaco.editor.getModel(uri);
			if (model && model.getValue() !== text) model.setValue(text);
			else typeLibFiles[key].write(encodeText(text));
		} catch (e) {}
	}
	return uri;
}

export function typeLibUri(name) {
	var file = String(name || "").replace(/^.*\//, "");
	return monaco.Uri.parse(ROOT + "types/" + encodeURIComponent(file));
}

/**
 * Ensure roster entries exist in the VFS (Explorer tree). Does not open tabs.
 * Does not invent USERCODE — character default starter is applied on open via
 * SlotSession.default_code_seed() / open_slot_in_workbench.
 * @param {Array<{slot: string|number, label?: string, character?: boolean, content?: string|null}>} items
 */
export function syncRosterFiles(items) {
	initSlotFiles();
	if (!items || !items.length) return Promise.resolve();
	var chain = Promise.resolve();
	for (var i = 0; i < items.length; i++) {
		(function (item) {
			chain = chain.then(function () {
				var key = item && item.slot != null ? String(item.slot) : "";
				if (!key) return;
				var opts = { label: item.label, character: !!item.character };
				var body = item.content;
				// Skip no-op when the VFS already has a body and caller passed no content.
				if (body == null && memoryFiles[key]) return;
				if (body == null) body = "";
				return ensureSlotFile(key, body, Object.assign({}, opts, { forceValue: item.content != null })).then(function (uri) {
					attachDiagnosticsForUri(uri);
					return uri;
				});
			});
		})(items[i]);
	}
	return chain.catch(function (err) {
		console.warn("[ALSlotFiles] syncRosterFiles", err);
	});
}

function attachDiagnosticsForUri(uri) {
	if (!uri || typeof monaco === "undefined" || !monaco.editor) return;
	try {
		var model = monaco.editor.getModel(uri);
		if (!model) return;
		if (typeof window !== "undefined" && window.ALEditor && typeof window.ALEditor.attachModelDiagnostics === "function") {
			window.ALEditor.attachModelDiagnostics(model);
		}
	} catch (e) {}
}

/**
 * Open a types/*.d.ts lib in the workbench editor (Go to Definition / Types row).
 */
export function openTypeLibEditor(name, content, range) {
	initSlotFiles();
	var uri = ensureTypeLibFile(name, content);
	if (!uri) return Promise.resolve(null);
	try {
		enableWorkbenchOwnsTabsDom();
		var editorService = StandaloneServices.get(IEditorService);
		var options = { pinned: true };
		if (range && typeof range.startLineNumber === "number") {
			options.selection = {
				startLineNumber: range.startLineNumber,
				startColumn: range.startColumn || 1,
				endLineNumber: range.endLineNumber || range.startLineNumber,
				endColumn: range.endColumn || (range.startColumn || 1) + 1,
			};
		}
		return Promise.resolve(
			editorService.openEditor({
				resource: uri,
				label: String(name || "").replace(/^.*\//, "") || "types.d.ts",
				options: options,
			}),
		).then(function () {
			var model = monaco.editor.getModel(uri);
			if (model) model.__alTypeLibOpened = true;
			return model;
		});
	} catch (e) {
		console.warn("[ALSlotFiles] openTypeLibEditor", e);
		return Promise.resolve(null);
	}
}

/** Snapshot of registered slot URIs (for decorations refresh). */
export function listSlotUris() {
	var out = [];
	for (var key in uriBySlot) {
		if (!Object.prototype.hasOwnProperty.call(uriBySlot, key)) continue;
		if (uriBySlot[key]) out.push(uriBySlot[key]);
	}
	return out;
}
