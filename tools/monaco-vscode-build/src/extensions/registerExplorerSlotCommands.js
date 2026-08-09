/**
 * Explorer / Markers view contributions via stock menus.
 * Implementations live in alGameCommands (CommandsRegistry); Delete needs URI from context.
 */
import { registerExtension, ExtensionHostKind } from "@codingame/monaco-vscode-api/extensions";
import { slotFromUri } from "../alSlotFiles.js";

var CMD_DELETE = "adventureland.code.deleteSlot";
var CMD_NEW = "adventureland.code.newUntitled";
var CMD_DOCS = "adventureland.code.openDocs";
var CMD_FIX = "adventureland.code.eslintFixAll";
var DOCS_CONTAINER_ID = "adventureland-docs";
var DOCS_VIEW_ID = "adventureland.code.docsView";

export async function registerExplorerSlotCommands() {
	var ext = registerExtension(
		{
			name: "adventureland-code-explorer",
			displayName: "AdventureLand CODE Explorer",
			publisher: "adventureland",
			version: "1.0.0",
			engines: { vscode: "*" },
			activationEvents: ["onStartupFinished", "onView:" + DOCS_VIEW_ID],
			contributes: {
				commands: [
					{ command: CMD_DELETE, title: "Delete CODE Slot" },
					{ command: CMD_NEW, title: "New Untitled File", icon: "$(new-file)" },
					{ command: CMD_DOCS, title: "Code slots documentation", icon: "$(book)" },
					{ command: CMD_FIX, title: "ESLint: Fix all auto-fixable problems", icon: "$(wrench)" },
				],
				viewsContainers: {
					activitybar: [
						{
							id: DOCS_CONTAINER_ID,
							title: "Documentation",
							icon: "$(book)",
						},
					],
				},
				views: {
					[DOCS_CONTAINER_ID]: [
						{
							id: DOCS_VIEW_ID,
							name: "Documentation",
							icon: "$(book)",
						},
					],
				},
				menus: {
					"explorer/context": [
						{
							command: CMD_DELETE,
							when: "resourceScheme == file && resourcePath =~ /\\/adventureland\\/(slots|characters)\\//",
							group: "7_modification",
						},
					],
					"view/title": [
						{
							command: CMD_FIX,
							when: "view == workbench.panel.markers.view || view == workbench.panel.markers",
							group: "navigation",
						},
					],
				},
			},
		},
		ExtensionHostKind.LocalProcess,
	);

	var api = await ext.getApi();
	api.commands.registerCommand(CMD_DELETE, function (uri) {
		try {
			var u = uri || (api.window.activeTextEditor && api.window.activeTextEditor.document && api.window.activeTextEditor.document.uri);
			var slot = u ? slotFromUri(u) : null;
			if (slot == null && u) {
				var s = String(u);
				var m = s.match(/\/(?:slots|characters)\/([^/]+)\.js/i);
				if (m) {
					try {
						slot = decodeURIComponent(m[1].replace(/\s*\(#.*$/, ""));
					} catch (e) {
						slot = m[1];
					}
				}
			}
			if (slot == null) return;
			if (window.SlotSession && typeof window.SlotSession.delete_slot === "function") {
				window.SlotSession.delete_slot(slot);
			}
		} catch (e) {
			console.warn("[ALExplorer] delete slot", e);
		}
	});

	// Activity-bar Docs icon: open the guide, then restore Explorer (no empty docs pane).
	try {
		var tree = api.window.createTreeView(DOCS_VIEW_ID, {
			treeDataProvider: {
				getChildren: function () {
					return Promise.resolve([]);
				},
				getTreeItem: function (el) {
					return el;
				},
			},
		});
		tree.onDidChangeVisibility(function (e) {
			if (!e || !e.visible) return;
			Promise.resolve(api.commands.executeCommand(CMD_DOCS)).then(
				function () {
					return api.commands.executeCommand("workbench.view.explorer");
				},
				function () {
					return api.commands.executeCommand("workbench.view.explorer");
				},
			);
		});
	} catch (eTree) {
		console.warn("[ALExplorer] docs activity view", eTree);
	}

	await ext.whenReady();
	return ext;
}
