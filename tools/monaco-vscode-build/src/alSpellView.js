/**
 * Spell Checker panel — sibling tab next to Problems (stock viewsContainers.panel).
 * Two views in one container: Spelling Issues (files) | Words with Issues.
 * Bottom panel ViewPaneContainer uses horizontal orientation → Cursor-style columns.
 *
 * Container id must match /^[a-z0-9_-]+$/i (no dots) or viewsExtensionPoint rejects it and
 * the view falls into Explorer.
 */
import { registerExtension, ExtensionHostKind } from "@codingame/monaco-vscode-api/extensions";
import { StandaloneServices } from "@codingame/monaco-vscode-api/services";
import { IViewsService } from "@codingame/monaco-vscode-api/vscode/vs/workbench/services/views/common/viewsService.service";
import { IEditorService } from "@codingame/monaco-vscode-api/vscode/vs/workbench/services/editor/common/editorService.service";
import { IActivityService } from "@codingame/monaco-vscode-api/vscode/vs/workbench/services/activity/common/activity.service";
import { IViewDescriptorService } from "@codingame/monaco-vscode-api/vscode/vs/workbench/common/views.service";
import { NumberBadge } from "@codingame/monaco-vscode-api/vscode/vs/workbench/services/activity/common/activity";
import { Parts } from "@codingame/monaco-vscode-views-service-override";
import { scheduleLayoutHostedPart } from "./alPartLayout.js";

/** Extension contribute id (alphanumeric / _ / - only). */
export var SPELL_CONTAINER_ID = "adventureland-spell";
/** Workbench id after viewsExtensionPoint prefixes workbench.view.extension. */
export var SPELL_CONTAINER_WORKBENCH_ID = "workbench.view.extension." + SPELL_CONTAINER_ID;
export var SPELL_FILES_VIEW_ID = "adventureland.code.spellFiles";
export var SPELL_WORDS_VIEW_ID = "adventureland.code.spellWords";
/** @deprecated use SPELL_FILES_VIEW_ID — kept for older focusSpellView callers */
export var SPELL_VIEW_ID = SPELL_FILES_VIEW_ID;

var filesTreeView = null;
var wordsTreeView = null;
var onDidChangeFiles = null;
var onDidChangeWords = null;
var vscodeApi = null;
var markersSub = null;
var visibilitySub = null;
var viewDescSub = null;
var registered = false;
/** @type {{ dispose: function(): void } | null} */
var panelActivity = null;
var refreshTimer = null;

function extractWord(message) {
	var m = String(message || "").match(/^"([^"]+)"/);
	return m ? m[1] : "";
}

function resourceLabel(uri) {
	try {
		var s = String(uri && uri.path ? uri.path : uri || "");
		var parts = s.split("/").filter(Boolean);
		if (parts.length >= 2) return parts.slice(-2).join("/");
		return parts[parts.length - 1] || s || "file";
	} catch (e) {
		return "file";
	}
}

/** Match diagnostics.js — spell panel lists player slots/characters only. */
function isPlayerSpellUri(uri) {
	var s = String(uri && uri.path ? uri.path : uri || "");
	if (!s) return false;
	if (s.indexOf("_standalone_host") !== -1) return false;
	if (
		s.indexOf("ts:adventureland/") === 0 ||
		s.indexOf("ts:al-types-augment/") === 0 ||
		s.indexOf("/adventureland/types/") !== -1 ||
		s.indexOf("/adventureland/types-augment/") !== -1 ||
		/\.d\.ts(?:$|\?)/i.test(s)
	) {
		return false;
	}
	return s.indexOf("/adventureland/slots/") !== -1 || s.indexOf("/adventureland/characters/") !== -1;
}

/**
 * @returns {{ uri: any, message: string, word: string, startLineNumber: number, startColumn: number, endLineNumber: number, endColumn: number }[]}
 */
export function listSpellIssues() {
	if (typeof monaco === "undefined" || !monaco.editor || typeof monaco.editor.getModelMarkers !== "function") {
		return [];
	}
	var seen = Object.create(null);
	var all = [];
	function pushMarker(mk) {
		if (!mk) return;
		var key = String(mk.resource || "") + ":" + (mk.startLineNumber || 0) + ":" + (mk.startColumn || 0) + ":" + (mk.endLineNumber || 0) + ":" + (mk.endColumn || 0) + ":" + String(mk.message || "");
		if (seen[key]) return;
		seen[key] = true;
		all.push(mk);
	}
	try {
		var byOwner = monaco.editor.getModelMarkers({ owner: "cspell" }) || [];
		for (var a = 0; a < byOwner.length; a++) pushMarker(byOwner[a]);
	} catch (e) {}
	try {
		var raw = monaco.editor.getModelMarkers({}) || [];
		for (var i = 0; i < raw.length; i++) {
			var mk = raw[i];
			var src = (mk && (mk.source || mk.owner)) || "";
			if (src === "cspell") pushMarker(mk);
		}
	} catch (e2) {}
	var out = [];
	for (var j = 0; j < all.length; j++) {
		var m = all[j];
		if (!m || !isPlayerSpellUri(m.resource)) continue;
		out.push({
			uri: m.resource,
			message: String(m.message || "Unknown word"),
			word: extractWord(m.message) || "",
			startLineNumber: m.startLineNumber || 1,
			startColumn: m.startColumn || 1,
			endLineNumber: m.endLineNumber || m.startLineNumber || 1,
			endColumn: m.endColumn || (m.startColumn || 1) + 1,
		});
	}
	return out;
}

function groupByFile(issues) {
	var map = Object.create(null);
	var order = [];
	for (var i = 0; i < issues.length; i++) {
		var it = issues[i];
		var key = String(it.uri || "");
		if (!map[key]) {
			map[key] = { kind: "file", id: "file:" + key, uri: it.uri, label: resourceLabel(it.uri), issues: [] };
			order.push(key);
		}
		map[key].issues.push(
			Object.assign({ kind: "issue", id: "issue:" + key + ":" + i }, it, {
				parentLabel: map[key].label,
			}),
		);
	}
	var files = [];
	for (var o = 0; o < order.length; o++) files.push(map[order[o]]);
	files.sort(function (a, b) {
		return b.issues.length - a.issues.length || String(a.label).localeCompare(String(b.label));
	});
	return files;
}

function groupByWord(issues) {
	var map = Object.create(null);
	var order = [];
	for (var i = 0; i < issues.length; i++) {
		var it = issues[i];
		var word = it.word || extractWord(it.message) || "(unknown)";
		var key = word.toLowerCase();
		if (!map[key]) {
			map[key] = { kind: "word", id: "word:" + key, word: word, issues: [], files: Object.create(null) };
			order.push(key);
		}
		map[key].issues.push(Object.assign({ kind: "issue", id: "word-issue:" + key + ":" + i }, it));
		var fk = String(it.uri || "");
		map[key].files[fk] = true;
	}
	var words = [];
	for (var o = 0; o < order.length; o++) {
		var w = map[order[o]];
		var fileCount = 0;
		for (var fk2 in w.files) {
			if (Object.prototype.hasOwnProperty.call(w.files, fk2)) fileCount++;
		}
		w.fileCount = fileCount;
		w.label = w.word + "  " + w.issues.length + (w.issues.length === 1 ? " issue" : " issues") + " in " + fileCount + (fileCount === 1 ? " file" : " files");
		words.push(w);
	}
	words.sort(function (a, b) {
		return b.issues.length - a.issues.length || String(a.word).localeCompare(String(b.word));
	});
	return words;
}

/**
 * Stock panel-tab badge — same path as Markers ActivityUpdater:
 * IActivityService.showViewActivity(viewId, { badge: NumberBadge }).
 *
 * ViewContainerActivityByView binds the badge onto the container when it appears; do not
 * dispose that waiter on empty issue counts during container registration (markers often
 * arrive later). Do not drive badges via TreeView.badge / $setBadge — that races activity.
 */
function clearPanelActivity() {
	try {
		if (panelActivity && typeof panelActivity.dispose === "function") panelActivity.dispose();
	} catch (e) {}
	panelActivity = null;
}

function readContainerActivities() {
	try {
		var activityService = StandaloneServices.get(IActivityService);
		return activityService.getViewContainerActivities(SPELL_CONTAINER_WORKBENCH_ID) || [];
	} catch (e) {
		return [];
	}
}

function syncPanelBadge() {
	var n = listSpellIssues().length;
	if (n <= 0) {
		clearPanelActivity();
		return;
	}
	var label = n + " spelling issue" + (n === 1 ? "" : "s");
	try {
		var activityService = StandaloneServices.get(IActivityService);
		clearPanelActivity();
		panelActivity = activityService.showViewActivity(SPELL_FILES_VIEW_ID, {
			badge: new NumberBadge(n, function () {
				return label;
			}),
		});
	} catch (e) {
		console.warn("[ALSpellView] syncPanelBadge showViewActivity", e);
	}
}

/** Re-apply badge when the panel host mounts or markers arrive after registration. */
export function syncSpellPanelBadge() {
	var n = listSpellIssues().length;
	if (n <= 0) {
		clearPanelActivity();
		return readContainerActivities().length;
	}
	var activities = readContainerActivities();
	var current = activities.length ? activities[0] && activities[0].badge && activities[0].badge.number : null;
	if (panelActivity && current === n) return n;
	syncPanelBadge();
	return n;
}

/**
 * Markers / diagnostics changed — refresh Spelling Issues + Words trees and the tab badge.
 * Call from the spell worker path (including fingerprint no-ops) so the panel cannot go stale.
 */
export function refreshSpellDiagnostics() {
	scheduleRefreshTree();
}

function refreshTree() {
	if (onDidChangeFiles) onDidChangeFiles.fire(undefined);
	if (onDidChangeWords) onDidChangeWords.fire(undefined);
	syncPanelBadge();
}

/** cspell markers arrive after models open — coalesce so the tab count catches up. */
function scheduleRefreshTree() {
	if (refreshTimer) clearTimeout(refreshTimer);
	refreshTimer = setTimeout(function () {
		refreshTimer = null;
		refreshTree();
	}, 50);
}

function openIssue(issue) {
	if (!issue || !issue.uri) return Promise.resolve(null);
	try {
		var editorService = StandaloneServices.get(IEditorService);
		var options = {
			pinned: true,
			selection: {
				startLineNumber: issue.startLineNumber,
				startColumn: issue.startColumn,
				endLineNumber: issue.endLineNumber,
				endColumn: issue.endColumn,
			},
		};
		return Promise.resolve(
			editorService.openEditor({
				resource: issue.uri,
				options: options,
			}),
		);
	} catch (e) {
		console.warn("[ALSpellView] openIssue", e);
		return Promise.resolve(null);
	}
}

function makeFilesProvider(vscode) {
	return {
		onDidChangeTreeData: onDidChangeFiles.event,
		getChildren: function (element) {
			var issues = listSpellIssues();
			if (!element) return Promise.resolve(groupByFile(issues));
			if (element.kind === "file") return Promise.resolve(element.issues || []);
			return Promise.resolve([]);
		},
		getTreeItem: function (element) {
			var item;
			if (element.kind === "file") {
				var count = (element.issues && element.issues.length) || 0;
				item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Collapsed);
				item.id = element.id;
				item.description = String(count);
				item.tooltip = element.label + " — " + count + " spelling issue" + (count === 1 ? "" : "s");
				// ThemeIcon.File + resourceUri → current file icon theme (not a warning glyph).
				item.iconPath = vscode.ThemeIcon.File;
				item.contextValue = "alSpellFile";
				item.resourceUri = element.uri;
				return item;
			}
			item = new vscode.TreeItem(element.message + "  Ln " + element.startLineNumber + ", Col " + element.startColumn, vscode.TreeItemCollapsibleState.None);
			item.id = element.id;
			item.tooltip = element.message;
			item.iconPath = new vscode.ThemeIcon("info");
			item.contextValue = "alSpellIssue";
			item.command = {
				command: "adventureland.code.openSpellIssue",
				title: "Open",
				arguments: [element],
			};
			return item;
		},
	};
}

function makeWordsProvider(vscode) {
	return {
		onDidChangeTreeData: onDidChangeWords.event,
		getChildren: function (element) {
			var issues = listSpellIssues();
			if (!element) return Promise.resolve(groupByWord(issues));
			if (element.kind === "word") return Promise.resolve(element.issues || []);
			return Promise.resolve([]);
		},
		getTreeItem: function (element) {
			var item;
			if (element.kind === "word") {
				item = new vscode.TreeItem(element.word, vscode.TreeItemCollapsibleState.Collapsed);
				item.id = element.id;
				item.description = element.issues.length + (element.issues.length === 1 ? " issue" : " issues") + " in " + element.fileCount + (element.fileCount === 1 ? " file" : " files");
				item.tooltip = element.label;
				item.iconPath = new vscode.ThemeIcon("symbol-text");
				item.contextValue = "alSpellWord";
				return item;
			}
			item = new vscode.TreeItem(resourceLabel(element.uri) + "  Ln " + element.startLineNumber + ", Col " + element.startColumn, vscode.TreeItemCollapsibleState.None);
			item.id = element.id;
			item.tooltip = element.message;
			item.iconPath = vscode.ThemeIcon.File;
			item.resourceUri = element.uri;
			item.contextValue = "alSpellIssue";
			item.command = {
				command: "adventureland.code.openSpellIssue",
				title: "Open",
				arguments: [element],
			};
			return item;
		},
	};
}

/**
 * Register Spell Checker panel container + two column tree views.
 * @returns {Promise<boolean>}
 */
export async function registerSpellView() {
	if (registered) return true;
	registered = true;

	var ext = registerExtension(
		{
			name: "adventureland-spell-checker",
			displayName: "AdventureLand Spell Checker",
			publisher: "adventureland",
			version: "1.0.0",
			engines: { vscode: "*" },
			activationEvents: ["onStartupFinished", "onView:" + SPELL_FILES_VIEW_ID, "onView:" + SPELL_WORDS_VIEW_ID],
			contributes: {
				viewsContainers: {
					panel: [
						{
							id: SPELL_CONTAINER_ID,
							title: "Spell Checker",
							icon: "$(book)",
						},
					],
				},
				views: {
					[SPELL_CONTAINER_ID]: [
						{
							id: SPELL_FILES_VIEW_ID,
							name: "Spelling Issues",
							icon: "$(warning)",
							initialSize: 2,
						},
						{
							id: SPELL_WORDS_VIEW_ID,
							name: "Words with Issues",
							icon: "$(symbol-text)",
							initialSize: 1,
						},
					],
				},
				commands: [{ command: "adventureland.code.openSpellIssue", title: "Open Spelling Issue" }],
			},
		},
		ExtensionHostKind.LocalProcess,
	);

	var api = await ext.getApi();
	vscodeApi = api;
	onDidChangeFiles = new api.EventEmitter();
	onDidChangeWords = new api.EventEmitter();

	api.commands.registerCommand("adventureland.code.openSpellIssue", function (issue) {
		return openIssue(issue);
	});

	try {
		filesTreeView = api.window.createTreeView(SPELL_FILES_VIEW_ID, {
			treeDataProvider: makeFilesProvider(api),
			showCollapseAll: true,
		});
		filesTreeView.title = "Spelling Issues";
	} catch (eFiles) {
		console.warn("[ALSpellView] createTreeView files", eFiles);
	}

	try {
		wordsTreeView = api.window.createTreeView(SPELL_WORDS_VIEW_ID, {
			treeDataProvider: makeWordsProvider(api),
			showCollapseAll: true,
		});
		wordsTreeView.title = "Words with Issues";
	} catch (eWords) {
		console.warn("[ALSpellView] createTreeView words", eWords);
	}

	try {
		if (typeof monaco !== "undefined" && monaco.editor && typeof monaco.editor.onDidChangeMarkers === "function") {
			markersSub = monaco.editor.onDidChangeMarkers(function () {
				scheduleRefreshTree();
			});
		}
	} catch (eSub) {}

	try {
		var views = StandaloneServices.get(IViewsService);
		if (views && views.onDidChangeViewContainerVisibility) {
			visibilitySub = views.onDidChangeViewContainerVisibility(function (e) {
				if (!e || e.id !== SPELL_CONTAINER_WORKBENCH_ID) return;
				// Stock ViewContainerActivityByView rebinds on container moves; refresh count only.
				syncSpellPanelBadge();
			});
		}
	} catch (eVis) {}

	try {
		var vds = StandaloneServices.get(IViewDescriptorService);
		var store = [];
		if (vds && vds.onDidChangeContainer) {
			store.push(
				vds.onDidChangeContainer(function (e) {
					if (!e || !e.views) return;
					var hit = false;
					for (var i = 0; i < e.views.length; i++) {
						if (e.views[i] && (e.views[i].id === SPELL_FILES_VIEW_ID || e.views[i].id === SPELL_WORDS_VIEW_ID)) {
							hit = true;
							break;
						}
					}
					if (hit) syncSpellPanelBadge();
				}),
			);
		}
		if (vds && vds.onDidChangeViewContainers) {
			store.push(
				vds.onDidChangeViewContainers(function () {
					syncSpellPanelBadge();
				}),
			);
		}
		if (store.length) {
			viewDescSub = {
				dispose: function () {
					for (var i = 0; i < store.length; i++) {
						try {
							if (store[i] && typeof store[i].dispose === "function") store[i].dispose();
						} catch (e) {}
					}
				},
			};
		}
	} catch (eVd) {}

	refreshTree();
	await ext.whenReady();
	refreshTree();
	scheduleRefreshTree();
	return true;
}

function expandAlPanelHost() {
	try {
		var el = document.getElementById("code-ide-problems");
		if (el) {
			el.classList.remove("collapsed");
			el.classList.remove("maximized");
		}
		if (window.SlotSession && typeof window.SlotSession.ensure_problems_panel === "function") {
			window.SlotSession.ensure_problems_panel();
		}
	} catch (e) {}
}

/**
 * Expand AL bottom panel host and focus the Spell Checker tab (next to Problems).
 * @param {boolean} [focus]
 * @returns {Promise<*>}
 */
export function focusSpellView(focus) {
	expandAlPanelHost();
	var views = StandaloneServices.get(IViewsService);
	var wantFocus = focus !== false;
	return Promise.resolve(views.openViewContainer(SPELL_CONTAINER_WORKBENCH_ID, wantFocus))
		.then(function () {
			return Promise.all([views.openView(SPELL_FILES_VIEW_ID, wantFocus), views.openView(SPELL_WORDS_VIEW_ID, false)]);
		})
		.then(function (opened) {
			var filesView = opened && opened[0];
			var wordsView = opened && opened[1];
			if (filesView && typeof filesView.setExpanded === "function") filesView.setExpanded(true);
			if (wordsView && typeof wordsView.setExpanded === "function") wordsView.setExpanded(true);
			refreshTree();
			try {
				scheduleLayoutHostedPart(Parts.PANEL_PART, document.getElementById("code-ide-problems-body"));
			} catch (eLay) {}
			return filesView;
		})
		.catch(function (e) {
			console.warn("[ALSpellView] focusSpellView", e);
			return null;
		});
}

export function disposeSpellView() {
	if (refreshTimer) {
		clearTimeout(refreshTimer);
		refreshTimer = null;
	}
	clearPanelActivity();
	try {
		if (viewDescSub && typeof viewDescSub.dispose === "function") viewDescSub.dispose();
	} catch (eVd) {}
	viewDescSub = null;
	try {
		if (visibilitySub && typeof visibilitySub.dispose === "function") visibilitySub.dispose();
	} catch (eVis) {}
	visibilitySub = null;
	try {
		if (markersSub && typeof markersSub.dispose === "function") markersSub.dispose();
	} catch (e) {}
	markersSub = null;
	try {
		if (filesTreeView && typeof filesTreeView.dispose === "function") filesTreeView.dispose();
	} catch (e2) {}
	filesTreeView = null;
	try {
		if (wordsTreeView && typeof wordsTreeView.dispose === "function") wordsTreeView.dispose();
	} catch (e3) {}
	wordsTreeView = null;
	try {
		if (onDidChangeFiles && typeof onDidChangeFiles.dispose === "function") onDidChangeFiles.dispose();
	} catch (e4) {}
	onDidChangeFiles = null;
	try {
		if (onDidChangeWords && typeof onDidChangeWords.dispose === "function") onDidChangeWords.dispose();
	} catch (e5) {}
	onDidChangeWords = null;
	vscodeApi = null;
	registered = false;
}
