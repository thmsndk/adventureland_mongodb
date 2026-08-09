/**
 * Seti file icons + stock folder SVGs (vs-seti has no folder glyphs).
 * Named CODE roots (characters / slots / types) get distinct folder icons.
 */
import { registerExtension, ExtensionHostKind } from "@codingame/monaco-vscode-api/extensions";
import setiThemeJson from "@codingame/monaco-vscode-theme-seti-default-extension/resources/vs-seti-icon-theme.json";
import setiWoffUrl from "@codingame/monaco-vscode-theme-seti-default-extension/resources/seti.woff";
import folderDarkUrl from "@codingame/monaco-vscode-theme-defaults-default-extension/resources/folder-dark.svg";
import folderOpenDarkUrl from "@codingame/monaco-vscode-theme-defaults-default-extension/resources/folder-open-dark.svg";
import rootFolderDarkUrl from "@codingame/monaco-vscode-theme-defaults-default-extension/resources/root-folder-dark.svg";
import rootFolderOpenDarkUrl from "@codingame/monaco-vscode-theme-defaults-default-extension/resources/root-folder-open-dark.svg";
import folderCharactersUrl from "./icons/folder-characters.svg";
import folderCharactersOpenUrl from "./icons/folder-characters-open.svg";
import folderSlotsUrl from "./icons/folder-slots.svg";
import folderSlotsOpenUrl from "./icons/folder-slots-open.svg";
import folderTypesUrl from "./icons/folder-types.svg";
import folderTypesOpenUrl from "./icons/folder-types-open.svg";

var ICON_THEME_ID = "code-ide-icons";

function toDataJsonUrl(obj) {
	return "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obj));
}

/**
 * Bundle emits root-relative asset paths; @font-face / CSS url() need absolute http(s)
 * in our detached host (file:///js/... is blocked by the browser).
 */
function publicAssetUrl(path) {
	if (!path) return path;
	if (/^(https?:|data:|blob:)/i.test(String(path))) return String(path);
	var origin = typeof location !== "undefined" && location.origin ? location.origin : "";
	var p = String(path);
	return origin + (p.charAt(0) === "/" ? p : "/" + p);
}

function buildTheme() {
	var theme = JSON.parse(JSON.stringify(setiThemeJson));
	theme.iconDefinitions = theme.iconDefinitions || {};
	theme.iconDefinitions._folder = { iconPath: "./icons/folder-dark.svg" };
	theme.iconDefinitions._folder_open = { iconPath: "./icons/folder-open-dark.svg" };
	theme.iconDefinitions._root_folder = { iconPath: "./icons/root-folder-dark.svg" };
	theme.iconDefinitions._root_folder_open = { iconPath: "./icons/root-folder-open-dark.svg" };
	theme.iconDefinitions._folder_characters = { iconPath: "./icons/folder-characters.svg" };
	theme.iconDefinitions._folder_characters_open = { iconPath: "./icons/folder-characters-open.svg" };
	theme.iconDefinitions._folder_slots = { iconPath: "./icons/folder-slots.svg" };
	theme.iconDefinitions._folder_slots_open = { iconPath: "./icons/folder-slots-open.svg" };
	theme.iconDefinitions._folder_types = { iconPath: "./icons/folder-types.svg" };
	theme.iconDefinitions._folder_types_open = { iconPath: "./icons/folder-types-open.svg" };
	theme.folder = "_folder";
	theme.folderExpanded = "_folder_open";
	theme.rootFolder = "_root_folder";
	theme.rootFolderExpanded = "_root_folder_open";
	// Multi-root CODE workspace roots + nested folder names.
	theme.rootFolderNames = {
		characters: "_folder_characters",
		slots: "_folder_slots",
		types: "_folder_types",
	};
	theme.rootFolderNamesExpanded = {
		characters: "_folder_characters_open",
		slots: "_folder_slots_open",
		types: "_folder_types_open",
	};
	theme.folderNames = {
		characters: "_folder_characters",
		slots: "_folder_slots",
		types: "_folder_types",
	};
	theme.folderNamesExpanded = {
		characters: "_folder_characters_open",
		slots: "_folder_slots_open",
		types: "_folder_types_open",
	};
	// Theme JSON lives at extension root — keep font/icon paths under ./icons/
	if (theme.fonts && theme.fonts[0] && theme.fonts[0].src && theme.fonts[0].src[0]) {
		theme.fonts[0].src[0].path = "./icons/seti.woff";
	}
	if (theme.light) {
		theme.light.folder = "_folder";
		theme.light.folderExpanded = "_folder_open";
		theme.light.rootFolder = "_root_folder";
		theme.light.rootFolderExpanded = "_root_folder_open";
		theme.light.rootFolderNames = theme.rootFolderNames;
		theme.light.rootFolderNamesExpanded = theme.rootFolderNamesExpanded;
		theme.light.folderNames = theme.folderNames;
		theme.light.folderNamesExpanded = theme.folderNamesExpanded;
	}
	return theme;
}

export async function registerCodeIdeIconTheme() {
	var theme = buildTheme();
	var ext = registerExtension(
		{
			name: "code-ide-icons",
			displayName: "CODE IDE Icons",
			publisher: "code-ide",
			version: "1.0.0",
			engines: { vscode: "*" },
			contributes: {
				iconThemes: [
					{
						id: ICON_THEME_ID,
						label: "CODE IDE",
						path: "./code-icons.json",
					},
				],
			},
		},
		ExtensionHostKind.LocalProcess,
	);

	ext.registerFileUrl("./code-icons.json", toDataJsonUrl(theme));
	ext.registerFileUrl("./icons/seti.woff", publicAssetUrl(setiWoffUrl));
	ext.registerFileUrl("./icons/folder-dark.svg", publicAssetUrl(folderDarkUrl));
	ext.registerFileUrl("./icons/folder-open-dark.svg", publicAssetUrl(folderOpenDarkUrl));
	ext.registerFileUrl("./icons/root-folder-dark.svg", publicAssetUrl(rootFolderDarkUrl));
	ext.registerFileUrl("./icons/root-folder-open-dark.svg", publicAssetUrl(rootFolderOpenDarkUrl));
	ext.registerFileUrl("./icons/folder-characters.svg", publicAssetUrl(folderCharactersUrl));
	ext.registerFileUrl("./icons/folder-characters-open.svg", publicAssetUrl(folderCharactersOpenUrl));
	ext.registerFileUrl("./icons/folder-slots.svg", publicAssetUrl(folderSlotsUrl));
	ext.registerFileUrl("./icons/folder-slots-open.svg", publicAssetUrl(folderSlotsOpenUrl));
	ext.registerFileUrl("./icons/folder-types.svg", publicAssetUrl(folderTypesUrl));
	ext.registerFileUrl("./icons/folder-types-open.svg", publicAssetUrl(folderTypesOpenUrl));

	await ext.whenReady();
	return ICON_THEME_ID;
}

/** @deprecated use registerCodeIdeIconTheme */
export async function registerAdventureLandIconTheme() {
	return registerCodeIdeIconTheme();
}

export { ICON_THEME_ID };
