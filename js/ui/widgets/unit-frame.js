/**
 * Unit frame widgets — player, combat target, and compact focus, with buff/debuff row under the frame box.
 */
(function (global) {
	var defineWidget = global.ALUI.defineWidget;
	var subscribe = global.ALUI.subscribe;

	function template(target, options) {
		options = options || {};
		var frameClass = options.compact ? "unitframe unitframe--compact" : "unitframe";
		var html = [];
		if (options.roleLabel) {
			html.push('<div class="unitframe-role">' + options.roleLabel + "</div>");
		}
		html.push(
			'<div class="' + frameClass + '">',
			'<div class="unitframe-name">',
			'<span class="unitframe-skull" title="Dead" aria-hidden="true">☠</span>',
			'<button type="button" class="unitframe-inspect" title="Inspect">{}</button>',
			'<span class="unitframe-name-text"></span>',
			'<span class="unitframe-diff"></span>',
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
		);
		target.innerHTML = html.join("");
		return {
			rootFrame: target.querySelector(".unitframe"),
			name: target.querySelector(".unitframe-name-text"),
			diff: target.querySelector(".unitframe-diff"),
			level: target.querySelector(".unitframe-level"),
			inspect: target.querySelector(".unitframe-inspect"),
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

	function setDiff(el, label, color) {
		if (!el) return;
		if (!label) {
			if (el.textContent !== "") el.textContent = "";
			if (el.style.color !== "") el.style.color = "";
			el.hidden = true;
			return;
		}
		el.hidden = false;
		if (el.textContent !== label) el.textContent = label;
		if (el.style.color !== color) el.style.color = color || "";
	}

	function setWidth(el, value) {
		if (!el) return;
		if (el.style.width === value) return;
		el.style.width = value;
	}

	function effectLoaderId(frameId, effectId) {
		return ("uf_" + frameId + "_" + String(effectId || "")).replace(/[^a-zA-Z0-9_\-]/g, "_");
	}

	function applyEffectTint(wrap, rid, ms) {
		if (!wrap || !rid || !(ms > 0)) return;
		if (typeof add_tint !== "function") return;

		var host = wrap.querySelector("div[style*='overflow']");
		if (!host) host = wrap.firstElementChild;
		if (!host) return;

		var loader = wrap.querySelector(".skidloader" + rid);
		if (!loader) {
			loader = document.createElement("div");
			loader.className = "skidloader" + rid;
			// Same 4px side bar as skillbar / cooldown-widget skill tints.
			loader.setAttribute("style", "position: absolute; bottom: 0px; right: 0px; width: 4px; height: 0px; background-color: yellow");
			host.appendChild(loader);
		}

		// Only (re)tint when the end time jumps forward (new/refreshed buff), not every tick.
		var until = Date.now() + ms;
		var prevUntil = Number(loader.getAttribute("data-until") || 0);
		if (prevUntil && until <= prevUntil + 400) return;
		loader.setAttribute("data-until", String(until));

		add_tint(".skidloader" + rid, {
			ms: ms,
			type: "skill",
			skid: rid,
		});
	}

	function renderEffects(effectsEl, effects, effectsKey, lastKeyRef, frameId, iconSize) {
		if (!effectsEl) return;
		var size = iconSize || 32;

		if (lastKeyRef.key === effectsKey) {
			// Same buff set — refresh timers without rebuilding icons.
			if (!effects || !effects.length) return;
			for (var r = 0; r < effects.length; r++) {
				var existing = effects[r];
				if (!(existing.ms > 0)) continue;
				var existingRid = effectLoaderId(frameId, existing.id);
				var existingWrap = effectsEl.querySelector('[data-condition="' + existing.id + '"]');
				applyEffectTint(existingWrap, existingRid, existing.ms);
			}
			return;
		}
		lastKeyRef.key = effectsKey;

		effectsEl.innerHTML = "";
		if (!effects || !effects.length) return;
		if (typeof item_container !== "function") return;

		for (var i = 0; i < effects.length; i++) {
			var effect = effects[i];
			var isDebuff = !!effect.debuff;
			var rid = effectLoaderId(frameId, effect.id);
			var opts = {
				skin: effect.skin,
				size: size,
				noBorder: !isDebuff,
				noBackground: true,
				debuffBorder: isDebuff,
			};
			if (effect.type !== "skill") opts.onclick = "condition_click('" + effect.id + "')";

			var wrap = document.createElement("div");
			wrap.className = "unitframe-effect";
			wrap.setAttribute("data-condition", effect.id);
			wrap.innerHTML = item_container(opts);
			effectsEl.appendChild(wrap);
			applyEffectTint(wrap, rid, effect.ms);
		}
	}

	function createRenderer(topic, options) {
		options = options || {};
		var effectIconSize = options.compact ? 24 : 32;
		return function () {
			var root, els, unsubscribe;
			var effectsKeyRef = { key: null };

			function render(slice) {
				if (!els) return;
				if (!slice) {
					if (root && options.hideWhenEmpty) {
						root.style.display = "none";
					} else {
						if (els.rootFrame) els.rootFrame.classList.remove("unitframe-dead");
						setText(els.name, "No Target");
						setDiff(els.diff, "", "");
						setText(els.level, "");
						setWidth(els.health, "0%");
						setText(els.healthText, "0 / 0 (0%)");
						setWidth(els.mana, "0%");
						setText(els.manaText, "0 / 0 (0%)");
						renderEffects(els.effects, [], "", effectsKeyRef, topic, effectIconSize);
					}
					return;
				}
				if (root && options.hideWhenEmpty) {
					root.style.display = "";
				}
				if (els.rootFrame) els.rootFrame.classList.toggle("unitframe-dead", !!slice.dead);
				setText(els.name, slice.name || "Unknown");
				setDiff(els.diff, slice.diffLabel || "", slice.diffColor || "");
				setText(els.level, slice.level !== undefined && slice.level !== null ? "Lv." + slice.level : "");
				setWidth(els.health, slice.healthPercent + "%");
				setText(els.healthText, formatNumber(slice.hp || 0) + " / " + formatNumber(slice.maxHp || 0) + " (" + (slice.healthPercent || 0) + "%)");
				setWidth(els.mana, slice.manaPercent + "%");
				setText(els.manaText, formatNumber(slice.mp || 0) + " / " + formatNumber(slice.maxMp || 0) + " (" + (slice.manaPercent || 0) + "%)");
				renderEffects(els.effects, slice.effects || [], slice.effectsKey || "", effectsKeyRef, topic, effectIconSize);
			}

			function handleClick(event) {
				if (options.onClick) options.onClick(event, els);
			}

			function handleInspect(event) {
				if (event.stopPropagation) event.stopPropagation();
				if (typeof btc === "function") btc(event);
				var entity = options.getInspectEntity && options.getInspectEntity();
				if (entity && typeof ui_inspect === "function") ui_inspect(entity);
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
					els = template(root, options);
					render(initial || null);
					unsubscribe = subscribe(topic, render);
					if (options.onClick) root.addEventListener("click", handleClick);
					if (els.inspect) els.inspect.addEventListener("click", handleInspect);
				},
				update: render,
				dispose: function () {
					if (unsubscribe) unsubscribe();
					if (root && options.onClick) root.removeEventListener("click", handleClick);
					if (els && els.inspect) els.inspect.removeEventListener("click", handleInspect);
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
			getInspectEntity: function () {
				return typeof character !== "undefined" ? character : null;
			},
			onClick: function (event) {
				if (event.target.closest && event.target.closest(".unitframe-effects")) return;
				if (event.target.closest && event.target.closest(".unitframe-inspect")) return;
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
			roleLabel: "Target",
			getInspectEntity: function () {
				if (typeof ctarget !== "undefined" && ctarget) return ctarget;
				return null;
			},
		}),
	);

	defineWidget(
		"focus-frame",
		createRenderer("focus-frame", {
			createContainer: true,
			containerClass: "vtopx enableclicks inline-block",
			containerStyle: "position: fixed; bottom: 250px; left: calc(50% + 25px); z-index: 5; font-size: 0px;",
			insertAfter: "topmid",
			hideWhenEmpty: true,
			compact: true,
			roleLabel: "Focus",
			getInspectEntity: function () {
				if (typeof xtarget !== "undefined" && xtarget) return xtarget;
				return null;
			},
		}),
	);
})(typeof window !== "undefined" ? window : global);
