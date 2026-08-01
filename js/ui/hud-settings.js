/**
 * /hud settings panel — renders registered ALUI.config settings only.
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

	function resolveOptions(row) {
		if (typeof row.getOptions === "function") {
			try {
				var dynamic = row.getOptions();
				if (Array.isArray(dynamic)) return dynamic;
			} catch (e) {
				/* fall through */
			}
		}
		return row.options || [];
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
		var options = resolveOptions(row);
		for (var i = 0; i < options.length; i++) {
			var opt = options[i];
			var option = document.createElement("option");
			option.value = String(opt.value);
			option.textContent = opt.label != null ? opt.label : String(opt.value);
			if (String(opt.value) === String(current)) option.selected = true;
			select.appendChild(option);
		}
		select.addEventListener("change", function () {
			var raw = select.value;
			var matched = raw;
			for (var j = 0; j < options.length; j++) {
				if (String(options[j].value) === raw) {
					matched = options[j].value;
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
		var groups = global.ALUI.config.listSettingsGrouped();
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
		if (global.ALUI.exitEditMode) global.ALUI.exitEditMode();

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

	global.ALUI = global.ALUI || {};
	global.ALUI.openHudSettings = openHudSettings;
	global.ALUI.closeHudSettings = closeHudSettings;
})(typeof window !== "undefined" ? window : global);
