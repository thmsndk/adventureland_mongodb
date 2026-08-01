/**
 * /hud settings panel — renders registered ALUI.config settings.
 */
(function (global) {
	var ROOT_ID = "alui-hud-settings";

	function closeHudSettings() {
		var existing = document.getElementById(ROOT_ID);
		if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
	}

	function renderRows(body) {
		var rows = global.ALUI.config.listSettings();
		body.innerHTML = "";
		if (!rows.length) {
			body.innerHTML = '<div class="alui-hud-empty">No HUD widgets loaded</div>';
			return;
		}
		for (var i = 0; i < rows.length; i++) {
			(function (row) {
				var wrap = document.createElement("label");
				wrap.className = "alui-hud-row";
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
			})(rows[i]);
		}
	}

	function openHudSettings() {
		if (!global.ALUI || !global.ALUI.config) return;
		closeHudSettings();

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
		root.addEventListener("click", function (event) {
			if (event.target === root) closeHudSettings();
		});

		document.body.appendChild(root);
	}

	global.ALUI = global.ALUI || {};
	global.ALUI.openHudSettings = openHudSettings;
	global.ALUI.closeHudSettings = closeHudSettings;
})(typeof window !== "undefined" ? window : global);
