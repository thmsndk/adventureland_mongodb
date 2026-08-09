/**
 * Shared SlotSession state bag.
 * Field owners: workspace (models/tabs/dirty), explorer (tree folders via S.tree_folders),
 * io (list_fetched via handle_code_list), chrome (layout/alpha/statusbar/editor ref bind),
 * problems (filter/panel state).
 */
(function (global) {
	"use strict";

	var S = (global.ALCodeSessionState = {
		editor: null,
		list_fetched: false,
		explorer_collapsed: false,
		models: Object.create(null),
		/** Slots whose body was applied from load_code / handle_code (USERCODE). */
		server_loaded: Object.create(null),
		open_tabs: [],
		dirty_slots: Object.create(null),
		model_listeners: Object.create(null),
		type_tab_models: Object.create(null),
		untitled_slots: Object.create(null),
		untitled_seq: 0,
		applying_model: false,
		TYPE_TAB_PREFIX: "type:",
		/** Settings / Keyboard Shortcuts as CODE IDE tabs (siblings of code files). */
		VIEW_TAB_PREFIX: "view:",
		VIEW_SETTINGS: "view:settings",
		VIEW_KEYBINDINGS: "view:keybindings",
		statusbar_cursor_bound: false,
		LAYOUT_KEY: "al_code_layout_mode",
		ALPHA_KEY: "al_code_overlay_alpha",
		PRESETS_KEY: "al_code_layout_presets",
		TREE_KEY: "al_code_tree_folders",
		PROBLEMS_HEIGHT_KEY: "al_code_problems_height",
		PROBLEMS_HEIGHT_PREV_KEY: "al_code_problems_height_prev",
		AUTO_RERUN_KEY: "al_code_auto_rerun",
		DEFAULT_RUN_ACTION_KEY: "al_code_default_run_action",
		layout_mode: "overlay-half",
		overlay_alpha: 1,
		layout_presets: null,
		/** @type {"play"|"playRerunOnSave"} */
		default_run_action: "play",
		/** Derived from default_run_action for Save restart. */
		auto_rerun: false,
		tree_folders: Object.create(null),
		problems_height: 220,
	});

	/** Overlay-only presets — use opacity 1 for solid (former dock), <1 for see-through. */
	S.DEFAULT_LAYOUT_PRESETS = {
		"overlay-third": { widthPercent: 33, opacity: 0.92 },
		"overlay-half": { widthPercent: 50, opacity: 1 },
		"overlay-full": { widthPercent: 100, opacity: 0.92 },
	};
	S.LAYOUT_MODE_ORDER = ["overlay-third", "overlay-half", "overlay-full"];
	S.layout_presets = Object.assign({}, S.DEFAULT_LAYOUT_PRESETS);

	function migrate_layout_mode(mode) {
		if (!mode || mode === "dock-half" || String(mode).indexOf("dock") === 0) return "overlay-half";
		if (S.LAYOUT_MODE_ORDER.indexOf(mode) === -1) return "overlay-half";
		return mode;
	}

	try {
		var savedLayout = localStorage.getItem(S.LAYOUT_KEY);
		if (savedLayout) S.layout_mode = migrate_layout_mode(savedLayout);
		else S.layout_mode = "overlay-half";
		if (S.layout_mode !== savedLayout) {
			try {
				localStorage.setItem(S.LAYOUT_KEY, S.layout_mode);
			} catch (eMig) {}
		}
		var savedAlpha = localStorage.getItem(S.ALPHA_KEY);
		if (savedAlpha != null) S.overlay_alpha = Math.max(0.35, Math.min(1, parseFloat(savedAlpha) || 1));
		var savedRunAction = localStorage.getItem(S.DEFAULT_RUN_ACTION_KEY);
		if (savedRunAction === "play" || savedRunAction === "playRerunOnSave") {
			S.default_run_action = savedRunAction;
		} else {
			var savedAuto = localStorage.getItem(S.AUTO_RERUN_KEY);
			if (savedAuto != null && (savedAuto === "1" || savedAuto === "true")) {
				S.default_run_action = "playRerunOnSave";
			}
		}
		S.auto_rerun = S.default_run_action === "playRerunOnSave";
		var savedTree = localStorage.getItem(S.TREE_KEY);
		if (savedTree) S.tree_folders = JSON.parse(savedTree) || Object.create(null);
		var savedProblemsH = parseInt(localStorage.getItem(S.PROBLEMS_HEIGHT_KEY) || "", 10);
		if (isFinite(savedProblemsH) && savedProblemsH >= 100) S.problems_height = savedProblemsH;
		var savedPresets = localStorage.getItem(S.PRESETS_KEY);
		if (savedPresets) {
			var parsed = JSON.parse(savedPresets);
			if (parsed && typeof parsed === "object") {
				// Carry former dock width/opacity into overlay-half if user had customized dock.
				if (parsed["dock-half"] && typeof parsed["dock-half"] === "object" && !parsed["overlay-half"]) {
					parsed["overlay-half"] = parsed["dock-half"];
				}
				delete parsed["dock-half"];
				S.layout_presets = Object.assign({}, S.DEFAULT_LAYOUT_PRESETS, parsed);
				try {
					localStorage.setItem(S.PRESETS_KEY, JSON.stringify(S.layout_presets));
				} catch (eP) {}
			}
		}
		var activePreset = S.layout_presets[S.layout_mode];
		if (activePreset && typeof activePreset.opacity === "number") {
			S.overlay_alpha = activePreset.opacity;
		}
	} catch (e) {}
})(typeof window !== "undefined" ? window : globalThis);
