/**
 * Unit frame widgets — player + target (classic script port from idle-rpg).
 */
(function (global) {
	var defineWidget = global.ALUI.defineWidget;
	var subscribe = global.ALUI.subscribe;

	function template(target) {
		target.innerHTML = [
			'<div class="unitframe">',
			'<div class="unitframe-name">',
			'<span class="unitframe-name-text"></span>',
			'<span class="unitframe-level"></span>',
			"</div>",
			'<div class="unitframe-bar unitframe-health">',
			'<div class="unitframe-fill"></div>',
			'<div class="unitframe-text unitframe-health-text"></div>',
			"</div>",
			'<div class="unitframe-bar unitframe-mana">',
			'<div class="unitframe-fill"></div>',
			'<div class="unitframe-text unitframe-mana-text"></div>',
			"</div>",
			"</div>",
		].join("");
		return {
			name: target.querySelector(".unitframe-name-text"),
			level: target.querySelector(".unitframe-level"),
			health: target.querySelector(".unitframe-health .unitframe-fill"),
			healthText: target.querySelector(".unitframe-health-text"),
			mana: target.querySelector(".unitframe-mana .unitframe-fill"),
			manaText: target.querySelector(".unitframe-mana-text"),
		};
	}

	function formatNumber(num) {
		return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	}

	function createRenderer(topic, options) {
		options = options || {};
		return function () {
			var root, els, unsubscribe;

			function render(slice) {
				if (!els) return;
				if (!slice) {
					if (root && options.hideWhenEmpty) {
						root.style.display = "none";
					} else {
						if (els.name) els.name.textContent = "No Target";
						if (els.level) els.level.textContent = "";
						if (els.health) els.health.style.width = "0%";
						if (els.healthText) els.healthText.textContent = "0 / 0 (0%)";
						if (els.mana) els.mana.style.width = "0%";
						if (els.manaText) els.manaText.textContent = "0 / 0 (0%)";
					}
					return;
				}
				if (root && options.hideWhenEmpty) {
					root.style.display = "";
				}
				if (els.name) els.name.textContent = slice.name || "Unknown";
				if (els.level) {
					els.level.textContent = slice.level !== undefined && slice.level !== null ? "Lv." + slice.level : "";
				}
				if (els.health) els.health.style.width = slice.healthPercent + "%";
				if (els.healthText) {
					els.healthText.textContent = formatNumber(slice.hp || 0) + " / " + formatNumber(slice.maxHp || 0) + " (" + (slice.healthPercent || 0) + "%)";
				}
				if (els.mana) els.mana.style.width = slice.manaPercent + "%";
				if (els.manaText) {
					els.manaText.textContent = formatNumber(slice.mp || 0) + " / " + formatNumber(slice.maxMp || 0) + " (" + (slice.manaPercent || 0) + "%)";
				}
			}

			function handleClick(event) {
				if (options.onClick) options.onClick(event, els);
			}

			return {
				init: function (target, initial) {
					if (!target) {
						var existing = document.querySelector('[data-widget="' + topic + '"]');
						if (existing) {
							root = existing;
						} else if (options.createContainer) {
							root = document.createElement("div");
							root.setAttribute("data-widget", topic);
							if (options.containerClass) root.className = options.containerClass;
							if (options.containerStyle) root.style.cssText = options.containerStyle;
							if (options.insertAfter) {
								var afterEl = document.getElementById(options.insertAfter);
								if (afterEl && afterEl.parentNode) {
									if (afterEl.nextSibling) {
										afterEl.parentNode.insertBefore(root, afterEl.nextSibling);
									} else {
										afterEl.parentNode.appendChild(root);
									}
								} else {
									document.body.appendChild(root);
								}
							} else {
								document.body.appendChild(root);
							}
						} else {
							return;
						}
					} else {
						root = target;
					}
					els = template(root);
					render(initial || null);
					unsubscribe = subscribe(topic, render);
					if (options.onClick) root.addEventListener("click", handleClick);
				},
				update: render,
				dispose: function () {
					if (unsubscribe) unsubscribe();
					if (root && options.onClick) root.removeEventListener("click", handleClick);
					if (root) root.innerHTML = "";
					els = null;
				},
			};
		};
	}

	defineWidget(
		"player-frame",
		createRenderer("player-frame", {
			createContainer: true,
			containerClass: "vtopx enableclicks inline-block",
			containerStyle: "position: fixed; bottom: 200px; left: calc(50% - 240px - 25px); z-index: 5; font-size: 0px;",
			insertAfter: "topmid",
			onClick: function (event) {
				if (event.target.closest && event.target.closest(".unitframe-name")) {
					if (typeof btc === "function") btc(event);
					if (typeof tut === "function") tut("character");
					if (typeof toggle_character === "function") toggle_character();
				} else if (event.target.closest && event.target.closest(".unitframe-health")) {
					if (typeof use === "function") use("hp");
				} else if (event.target.closest && event.target.closest(".unitframe-mana")) {
					if (typeof use === "function") use("mp");
				}
			},
		}),
	);

	defineWidget(
		"target-frame",
		createRenderer("target-frame", {
			createContainer: true,
			containerClass: "vtopx enableclicks inline-block",
			containerStyle: "position: fixed; bottom: 200px; left: calc(50% + 25px); z-index: 5; font-size: 0px;",
			insertAfter: "topmid",
			hideWhenEmpty: true,
		}),
	);
})(typeof window !== "undefined" ? window : global);
