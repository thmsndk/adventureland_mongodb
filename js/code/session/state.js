/**
 * Shared SlotSession state bag.
 * Field owners: workspace (models/tabs/dirty/explorer), io (list_fetched via handle_code_list),
 * chrome (layout/alpha/statusbar/editor ref bind), problems (filter/panel state).
 */
(function (global) {
	"use strict";

	var S = (global.ALCodeSessionState = {
		editor: null,
		list_fetched: false,
		explorer_collapsed: false,
		models: Object.create(null),
		open_tabs: [],
		dirty_slots: Object.create(null),
		model_listeners: Object.create(null),
		type_tab_models: Object.create(null),
		untitled_slots: Object.create(null),
		untitled_seq: 0,
		applying_model: false,
		TYPE_TAB_PREFIX: "type:",
		problems_view: "all",
		problems_panel_tab: "problems",
		problems_filter: "",
		problems_show_errors: true,
		problems_show_warnings: true,
		problems_show_infos: true,
		problems_active_only: false,
		problems_collapsed_files: Object.create(null),
		statusbar_cursor_bound: false,
		LAYOUT_KEY: "al_code_layout_mode",
		ALPHA_KEY: "al_code_overlay_alpha",
		TREE_KEY: "al_code_tree_folders",
		layout_mode: "dock-half",
		overlay_alpha: 0.92,
		tree_folders: Object.create(null),
	});

	try {
		var savedLayout = localStorage.getItem(S.LAYOUT_KEY);
		if (savedLayout) S.layout_mode = savedLayout;
		var savedAlpha = localStorage.getItem(S.ALPHA_KEY);
		if (savedAlpha != null) S.overlay_alpha = Math.max(0.35, Math.min(1, parseFloat(savedAlpha) || 0.92));
		var savedTree = localStorage.getItem(S.TREE_KEY);
		if (savedTree) S.tree_folders = JSON.parse(savedTree) || Object.create(null);
	} catch (e) {}
})(typeof window !== "undefined" ? window : globalThis);
