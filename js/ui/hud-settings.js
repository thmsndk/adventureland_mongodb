/**
 * /hud settings panel — grouped boolean / enum / number / action controls.
 */
(function (global) {
	var ROOT_ID = "alui-hud-settings";

	function closeHudSettings() {
		var existing = document.getElementById(ROOT_ID);
		if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
	}

	function coerceNumber(raw, row) {
		var n = parseFloat(raw);
		if (isNaN(n)) n = 0;
		if (typeof row.min === "number" && n < row.min) n = row.min;
		if (typeof row.max === "number" && n > row.max) n = row.max;
		return n;
	}

	function appendBoolean(body, row) {
		var wrap = document.createElement("label");
		wrap.className = "alui-hud-row alui-hud-row--bool";
		var input = document.createElement("input");
		input.type = "checkbox";
		input.checked = !!global.ALUI.config.get(row.path);
		input.addEventListener("change", function () {
			global.ALUI.config.set(row.path, !!input.checked);
		});
		var text = document.createElement("span");
		text.textContent = row.label;
		wrap.appendChild(input);
		wrap.appendChild(text);
		body.appendChild(wrap);
	}

	function appendEnum(body, row) {
		var wrap = document.createElement("label");
		wrap.className = "alui-hud-row alui-hud-row--enum";
		var text = document.createElement("span");
		text.className = "alui-hud-row-label";
		text.textContent = row.label;
		var select = document.createElement("select");
		var current = global.ALUI.config.get(row.path);
		for (var i = 0; i < row.options.length; i++) {
			var opt = row.options[i];
			var option = document.createElement("option");
			option.value = String(opt.value);
			option.textContent = opt.label != null ? opt.label : String(opt.value);
			if (String(opt.value) === String(current)) option.selected = true;
			select.appendChild(option);
		}
		select.addEventListener("change", function () {
			var raw = select.value;
			var matched = raw;
			for (var j = 0; j < row.options.length; j++) {
				if (String(row.options[j].value) === raw) {
					matched = row.options[j].value;
					break;
				}
			}
			global.ALUI.config.set(row.path, matched);
		});
		wrap.appendChild(text);
		wrap.appendChild(select);
		body.appendChild(wrap);
	}

	function appendNumber(body, row) {
		var wrap = document.createElement("label");
		wrap.className = "alui-hud-row alui-hud-row--number";
		var text = document.createElement("span");
		text.className = "alui-hud-row-label";
		text.textContent = row.label;
		var input = document.createElement("input");
		input.type = "number";
		if (typeof row.min === "number") input.min = String(row.min);
		if (typeof row.max === "number") input.max = String(row.max);
		if (typeof row.step === "number") input.step = String(row.step);
		var cur = global.ALUI.config.get(row.path);
		input.value = typeof cur === "number" ? String(cur) : "0";
		input.addEventListener("change", function () {
			global.ALUI.config.set(row.path, coerceNumber(input.value, row));
		});
		wrap.appendChild(text);
		wrap.appendChild(input);
		body.appendChild(wrap);
	}

	function appendAction(body, row) {
		var wrap = document.createElement("div");
		wrap.className = "alui-hud-row alui-hud-row--action";
		var btn = document.createElement("button");
		btn.type = "button";
		btn.className = "alui-hud-action";
		btn.textContent = row.label;
		btn.addEventListener("click", function () {
			if (typeof row.action === "function") row.action();
			else if (row.path === "editMode.enter" && global.ALUI.enterEditMode) {
				closeHudSettings();
				global.ALUI.enterEditMode();
			}
		});
		wrap.appendChild(btn);
		if (row.description) {
			var hint = document.createElement("div");
			hint.className = "alui-hud-hint";
			hint.textContent = row.description;
			wrap.appendChild(hint);
		}
		body.appendChild(wrap);
	}

	function appendSetting(body, row) {
		if (row.type === "enum") appendEnum(body, row);
		else if (row.type === "number") appendNumber(body, row);
		else if (row.type === "action") appendAction(body, row);
		else appendBoolean(body, row);
	}

	function renderRows(body) {
		body.innerHTML = "";
		var groups =
			global.ALUI.config.listSettingsGrouped && typeof global.ALUI.config.listSettingsGrouped === "function"
				? global.ALUI.config.listSettingsGrouped()
				: [{ name: "General", settings: global.ALUI.config.listSettings() }];
		if (!groups.length || (groups.length === 1 && !groups[0].settings.length)) {
			body.innerHTML = '<div class="alui-hud-empty">No HUD widgets loaded</div>';
			return;
		}
		for (var g = 0; g < groups.length; g++) {
			var group = groups[g];
			var section = document.createElement("section");
			section.className = "alui-hud-group";
			var title = document.createElement("h3");
			title.className = "alui-hud-group-title";
			title.textContent = group.name;
			section.appendChild(title);
			for (var i = 0; i < group.settings.length; i++) {
				appendSetting(section, group.settings[i]);
			}
			body.appendChild(section);
		}
	}

	function openHudSettings() {
		if (!global.ALUI || !global.ALUI.config) return;
		closeHudSettings();
		if (global.ALUI.isEditMode && global.ALUI.isEditMode()) {
			if (global.ALUI.exitEditMode) global.ALUI.exitEditMode();
		}

		var root = document.createElement("div");
		root.id = ROOT_ID;
		root.className = "alui-hud-settings";
		root.innerHTML =
			'<div class="alui-hud-panel">' +
			'<div class="alui-hud-header">' +
			"<strong>HUD settings</strong>" +
			'<button type="button" class="alui-hud-close" aria-label="Close">✕</button>' +
			"</div>" +
			'<div class="alui-hud-body"></div>' +
			'<div class="alui-hud-footer">' +
			'<button type="button" class="alui-hud-edit">Edit Mode</button>' +
			'<button type="button" class="alui-hud-reset">Reset to defaults</button>' +
			"</div>" +
			"</div>";

		var body = root.querySelector(".alui-hud-body");
		renderRows(body);

		root.querySelector(".alui-hud-close").addEventListener("click", closeHudSettings);
		root.querySelector(".alui-hud-reset").addEventListener("click", function () {
			global.ALUI.config.resetOverrides();
			renderRows(body);
			if (global.ALUI.layout && global.ALUI.layout.applyAllFromConfig) {
				global.ALUI.layout.applyAllFromConfig();
			}
		});
		root.querySelector(".alui-hud-edit").addEventListener("click", function () {
			closeHudSettings();
			if (global.ALUI.enterEditMode) global.ALUI.enterEditMode();
		});
		root.addEventListener("click", function (event) {
			if (event.target === root) closeHudSettings();
		});

		document.body.appendChild(root);
	}

	function sideOptions() {
		return [
			{ value: "bottom", label: "Bottom" },
			{ value: "top", label: "Top" },
			{ value: "left", label: "Left" },
			{ value: "right", label: "Right" },
		];
	}

	function anchorOptionsForSide() {
		return [
			{ value: "left", label: "Left / Top" },
			{ value: "right", label: "Right / Bottom" },
			{ value: "center", label: "Center" },
			{ value: "top", label: "Top" },
			{ value: "bottom", label: "Bottom" },
		];
	}

	function directionOptions() {
		return [
			{ value: "right", label: "Right" },
			{ value: "left", label: "Left" },
			{ value: "down", label: "Down" },
			{ value: "up", label: "Up" },
		];
	}

	function registerEffectsSettings(frameKey, group) {
		var base = "frames." + frameKey + ".effects";
		global.ALUI.config.registerSetting({
			path: base + ".enabled",
			label: "Buffs / debuffs",
			type: "boolean",
			group: group,
		});
		global.ALUI.config.registerSetting({
			path: base + ".side",
			label: "Buffs side",
			type: "enum",
			group: group,
			options: sideOptions(),
		});
		global.ALUI.config.registerSetting({
			path: base + ".anchor",
			label: "Buffs anchor",
			type: "enum",
			group: group,
			options: anchorOptionsForSide(),
		});
		global.ALUI.config.registerSetting({
			path: base + ".direction",
			label: "Buffs grow",
			type: "enum",
			group: group,
			options: directionOptions(),
		});
		global.ALUI.config.registerSetting({
			path: base + ".gap",
			label: "Buffs gap",
			type: "number",
			group: group,
			min: 0,
			max: 64,
			step: 1,
		});
	}

	function registerLayoutSettings(frameKey, group, includeGrow) {
		var base = "frames." + frameKey + ".layout";
		global.ALUI.config.registerSetting({
			path: base + ".anchorX",
			label: "Anchor X",
			type: "enum",
			group: group,
			options: [
				{ value: "left", label: "Left" },
				{ value: "center", label: "Center" },
				{ value: "right", label: "Right" },
			],
		});
		global.ALUI.config.registerSetting({
			path: base + ".anchorY",
			label: "Anchor Y",
			type: "enum",
			group: group,
			options: [
				{ value: "top", label: "Top" },
				{ value: "center", label: "Center" },
				{ value: "bottom", label: "Bottom" },
			],
		});
		global.ALUI.config.registerSetting({
			path: base + ".offsetX",
			label: "Offset X",
			type: "number",
			group: group,
			min: -2000,
			max: 2000,
			step: 1,
		});
		global.ALUI.config.registerSetting({
			path: base + ".offsetY",
			label: "Offset Y",
			type: "number",
			group: group,
			min: -2000,
			max: 2000,
			step: 1,
		});
		if (includeGrow) {
			global.ALUI.config.registerSetting({
				path: base + ".grow",
				label: "Grow",
				type: "enum",
				group: group,
				options: [
					{ value: "down", label: "Down" },
					{ value: "up", label: "Up" },
				],
			});
		}
		global.ALUI.config.registerSetting({
			path: base + ".zIndex",
			label: "Z-index",
			type: "number",
			group: group,
			min: 1,
			max: 4000,
			step: 1,
		});
	}

	function registerHudUiSettings() {
		if (!global.ALUI.config) return;
		global.ALUI.config.registerDefaults({
			editMode: {
				showGrid: true,
				snap: true,
				snapElements: true,
				gridSize: 20,
				snapThreshold: 8,
			},
		});
		global.ALUI.config.registerSetting({
			path: "editMode.enter",
			label: "Enter Edit Mode",
			type: "action",
			group: "Edit Mode",
			description: "Drag HUD frames. Grid + snap on by default. Hold Ctrl to free-move.",
			action: function () {
				closeHudSettings();
				if (global.ALUI.enterEditMode) global.ALUI.enterEditMode();
			},
		});
		global.ALUI.config.registerSetting({
			path: "editMode.showGrid",
			label: "Show grid",
			type: "boolean",
			group: "Edit Mode",
		});
		global.ALUI.config.registerSetting({
			path: "editMode.snap",
			label: "Snap to grid / center",
			type: "boolean",
			group: "Edit Mode",
		});
		global.ALUI.config.registerSetting({
			path: "editMode.snapElements",
			label: "Snap to other frames",
			type: "boolean",
			group: "Edit Mode",
		});
		global.ALUI.config.registerSetting({
			path: "editMode.gridSize",
			label: "Grid size (px)",
			type: "number",
			group: "Edit Mode",
			min: 4,
			max: 64,
			step: 1,
		});
		global.ALUI.config.registerSetting({
			path: "editMode.snapThreshold",
			label: "Snap distance (px)",
			type: "number",
			group: "Edit Mode",
			min: 1,
			max: 40,
			step: 1,
		});

		global.ALUI.config.registerSetting({ path: "frames.player-frame.enabled", label: "Enabled", type: "boolean", group: "Player" });
		registerLayoutSettings("player-frame", "Player", false);
		registerEffectsSettings("player-frame", "Player");

		global.ALUI.config.registerSetting({ path: "frames.target-frame.enabled", label: "Enabled", type: "boolean", group: "Target" });
		registerLayoutSettings("target-frame", "Target", false);
		registerEffectsSettings("target-frame", "Target");

		global.ALUI.config.registerSetting({ path: "frames.hover-frame.enabled", label: "Enabled", type: "boolean", group: "Hover" });
		registerEffectsSettings("hover-frame", "Hover");

		global.ALUI.config.registerSetting({ path: "frames.tot-frame.enabled", label: "Enabled", type: "boolean", group: "Target’s Target" });
		registerEffectsSettings("tot-frame", "Target’s Target");

		global.ALUI.config.registerSetting({ path: "frames.party-frame.enabled", label: "Enabled", type: "boolean", group: "Party" });
		global.ALUI.config.registerSetting({
			path: "frames.party-frame.omitSelf",
			label: "Hide yourself",
			type: "boolean",
			group: "Party",
		});
		global.ALUI.config.registerSetting({
			path: "frames.party-frame.showInvite",
			label: "Show invite",
			type: "boolean",
			group: "Party",
		});
		global.ALUI.config.registerSetting({
			path: "frames.party-frame.showLeave",
			label: "Show leave",
			type: "boolean",
			group: "Party",
		});
		global.ALUI.config.registerSetting({
			path: "frames.party-frame.highlightFocus",
			label: "Highlight focus",
			type: "boolean",
			group: "Party",
		});
		global.ALUI.config.registerSetting({
			path: "frames.party-frame.width",
			label: "Width",
			type: "number",
			group: "Party",
			min: 120,
			max: 480,
			step: 1,
		});
		global.ALUI.config.registerSetting({
			path: "frames.party-frame.memberTarget.enabled",
			label: "Member target",
			type: "boolean",
			group: "Party",
		});
		registerLayoutSettings("party-frame", "Party", true);
		registerEffectsSettings("party-frame", "Party");
	}

	registerHudUiSettings();

	global.ALUI = global.ALUI || {};
	global.ALUI.openHudSettings = openHudSettings;
	global.ALUI.closeHudSettings = closeHudSettings;
})(typeof window !== "undefined" ? window : global);
