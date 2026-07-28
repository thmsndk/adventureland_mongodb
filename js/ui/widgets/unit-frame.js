/**
 * Unit frame widgets — player + target, with buff/debuff row under the frame box.
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
			'<div class="unitframe-effects"></div>',
		].join("");
		return {
			name: target.querySelector(".unitframe-name-text"),
			level: target.querySelector(".unitframe-level"),
			health: target.querySelector(".unitframe-health .unitframe-fill"),
			healthText: target.querySelector(".unitframe-health-text"),
			mana: target.querySelector(".unitframe-mana .unitframe-fill"),
			manaText: target.querySelector(".unitframe-mana-text"),
			effects: target.querySelector(".unitframe-effects"),
		};
	}

	function formatNumber(num) {
		return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	}

	function setText(el, value) {
		if (!el) return;
		if (el.textContent === value) return;
		el.textContent = value;
	}

	function setWidth(el, value) {
		if (!el) return;
		if (el.style.width === value) return;
		el.style.width = value;
	}

	function renderEffects(effectsEl, effects, effectsKey, lastKeyRef) {
		if (!effectsEl) return;
		if (lastKeyRef.key === effectsKey) return;
		lastKeyRef.key = effectsKey;

		effectsEl.innerHTML = "";
		if (!effects || !effects.length) return;
		if (typeof item_container !== "function") return;

		for (var i = 0; i < effects.length; i++) {
			var effect = effects[i];
			var isDebuff = !!effect.debuff;
			var html;
			if (effect.type === "skill") {
				var rid = "uf_" + effect.id;
				html = item_container({
					skin: effect.skin,
					size: 32,
					loader: "ufc" + rid,
					noBorder: !isDebuff,
					noBackground: true,
					debuffBorder: isDebuff,
				});
			} else {
				html = item_container({
					skin: effect.skin,
					size: 32,
					onclick: "condition_click('" + effect.id + "')",
					noBorder: !isDebuff,
					noBackground: true,
					debuffBorder: isDebuff,
				});
			}

			var wrap = document.createElement("div");
			wrap.className = "unitframe-effect";
			wrap.setAttribute("data-condition", effect.id);
			wrap.innerHTML = html;
			effectsEl.appendChild(wrap);

			if (effect.type === "skill" && effect.ms && typeof add_tint === "function" && typeof future_ms === "function") {
				var rid2 = "uf_" + effect.id;
				var loader = effectsEl.querySelector(".loaderufc" + rid2);
				if (loader) loader.style.opacity = "0.5";
				add_tint(".loaderufc" + rid2, {
					ms: effect.ms,
					start: future_ms(effect.ms - 24000),
					type: "progress",
				});
			}
		}
	}

	function createRenderer(topic, options) {
		options = options || {};
		return function () {
			var root, els, unsubscribe;
			var effectsKeyRef = { key: null };

			function render(slice) {
				if (!els) return;
				if (!slice) {
					if (root && options.hideWhenEmpty) {
						root.style.display = "none";
					} else {
						setText(els.name, "No Target");
						setText(els.level, "");
						setWidth(els.health, "0%");
						setText(els.healthText, "0 / 0 (0%)");
						setWidth(els.mana, "0%");
						setText(els.manaText, "0 / 0 (0%)");
						renderEffects(els.effects, [], "", effectsKeyRef);
					}
					return;
				}
				if (root && options.hideWhenEmpty) {
					root.style.display = "";
				}
				setText(els.name, slice.name || "Unknown");
				setText(els.level, slice.level !== undefined && slice.level !== null ? "Lv." + slice.level : "");
				setWidth(els.health, slice.healthPercent + "%");
				setText(els.healthText, formatNumber(slice.hp || 0) + " / " + formatNumber(slice.maxHp || 0) + " (" + (slice.healthPercent || 0) + "%)");
				setWidth(els.mana, slice.manaPercent + "%");
				setText(els.manaText, formatNumber(slice.mp || 0) + " / " + formatNumber(slice.maxMp || 0) + " (" + (slice.manaPercent || 0) + "%)");
				renderEffects(els.effects, slice.effects || [], slice.effectsKey || "", effectsKeyRef);
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

	// Frame box is bottom-anchored; effects are absolutely positioned under the box
	// so adding/removing buffs does not move the frame.
	defineWidget(
		"player-frame",
		createRenderer("player-frame", {
			createContainer: true,
			containerClass: "vtopx enableclicks inline-block",
			containerStyle: "position: fixed; bottom: 130px; left: calc(50% - 240px - 25px); z-index: 5; font-size: 0px;",
			insertAfter: "topmid",
			onClick: function (event) {
				if (event.target.closest && event.target.closest(".unitframe-effects")) return;
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
			containerStyle: "position: fixed; bottom: 130px; left: calc(50% + 25px); z-index: 5; font-size: 0px;",
			insertAfter: "topmid",
			hideWhenEmpty: true,
		}),
	);
})(typeof window !== "undefined" ? window : global);
