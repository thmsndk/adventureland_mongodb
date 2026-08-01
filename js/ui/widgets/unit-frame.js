/**
 * Unit frame widgets — shared mount/render API + player/target/hover/ToT.
 */
(function (global) {
	var defineWidget = global.ALUI.defineWidget;
	var subscribe = global.ALUI.subscribe;

	function template(target, options) {
		options = options || {};
		var frameClass = "unitframe";
		if (options.compact) frameClass += " unitframe--compact";
		if (options.frameClass) frameClass += " " + options.frameClass;
		var html = [];
		if (options.roleLabel) {
			html.push('<div class="unitframe-role">' + options.roleLabel + "</div>");
		}
		html.push(
			'<div class="' + frameClass + '">',
			'<div class="unitframe-name">',
			'<span class="unitframe-skull" title="Dead" aria-hidden="true">☠</span>',
			options.hideInspect ? "" : '<button type="button" class="unitframe-inspect" title="Inspect">{}</button>',
			'<span class="unitframe-name-text"></span>',
			'<span class="unitframe-diff"></span>',
			'<span class="unitframe-name-extra"></span>',
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
			options.hideEffects ? "" : '<div class="unitframe-effects"></div>',
		);
		target.innerHTML = html.join("");
		return {
			host: target,
			rootFrame: target.querySelector(".unitframe"),
			name: target.querySelector(".unitframe-name-text"),
			diff: target.querySelector(".unitframe-diff"),
			nameExtra: target.querySelector(".unitframe-name-extra"),
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

	function barText(slice, kind, options) {
		options = options || {};
		if (!slice || slice.vitalsUnknown) {
			return kind === "health" ? "far" : "";
		}
		if (slice.dead && kind === "health") return "RIP";
		var pct = kind === "health" ? slice.healthPercent : slice.manaPercent;
		if (options.textMode === "percent") return (pct || 0) + "%";
		if (kind === "health") {
			return formatNumber(slice.hp || 0) + " / " + formatNumber(slice.maxHp || 0) + " (" + (pct || 0) + "%)";
		}
		return formatNumber(slice.mp || 0) + " / " + formatNumber(slice.maxMp || 0) + " (" + (pct || 0) + "%)";
	}

	/**
	 * Apply a unit-frame slice to an already-mounted els map.
	 * Shared by player/target/hover/ToT widgets and party rows.
	 */
	function applyUnitFrameSlice(els, slice, options, effectsKeyRef) {
		options = options || {};
		effectsKeyRef = effectsKeyRef || { key: null };
		var effectIconSize = options.compact ? 24 : 32;
		var frameId = options.frameId || "unit";

		if (!els) return;
		if (!slice) {
			if (els.rootFrame) els.rootFrame.classList.remove("unitframe-dead", "unitframe-far");
			setText(els.name, options.emptyName || "No Target");
			setDiff(els.diff, "", "");
			setText(els.level, "");
			setWidth(els.health, "0%");
			setText(els.healthText, options.textMode === "percent" ? "0%" : "0 / 0 (0%)");
			setWidth(els.mana, "0%");
			setText(els.manaText, options.textMode === "percent" ? "0%" : "0 / 0 (0%)");
			renderEffects(els.effects, [], "", effectsKeyRef, frameId, effectIconSize);
			return;
		}

		if (els.rootFrame) {
			els.rootFrame.classList.toggle("unitframe-dead", !!slice.dead);
			els.rootFrame.classList.toggle("unitframe-far", !!slice.vitalsUnknown || !!slice.far);
		}
		setText(els.name, slice.name || "Unknown");
		if (slice.nameColor && els.name) els.name.style.color = slice.nameColor;
		setDiff(els.diff, slice.diffLabel || "", slice.diffColor || "");
		setText(els.level, slice.level !== undefined && slice.level !== null ? "Lv." + slice.level : "");

		if (slice.vitalsUnknown) {
			setWidth(els.health, "0%");
			setWidth(els.mana, "0%");
		} else {
			setWidth(els.health, (slice.dead ? 0 : slice.healthPercent || 0) + "%");
			setWidth(els.mana, (slice.manaPercent || 0) + "%");
		}
		setText(els.healthText, barText(slice, "health", options));
		setText(els.manaText, barText(slice, "mana", options));
		renderEffects(els.effects, slice.effects || [], slice.effectsKey || "", effectsKeyRef, frameId, effectIconSize);
	}

	/**
	 * Mount the shared unit-frame DOM into host. Returns { els, render, destroy }.
	 */
	function mountUnitFrame(host, options) {
		options = options || {};
		if (!host) return null;
		var els = template(host, options);
		var effectsKeyRef = { key: null };
		return {
			els: els,
			render: function (slice) {
				applyUnitFrameSlice(els, slice, options, effectsKeyRef);
			},
			destroy: function () {
				host.innerHTML = "";
			},
		};
	}

	function createRenderer(topic, options) {
		options = options || {};
		options.frameId = options.frameId || topic;
		return function () {
			var root, view, unsubscribe;

			function render(slice) {
				if (!view) return;
				if (!slice) {
					if (root && options.hideWhenEmpty) {
						root.classList.add("alui-hidden-empty");
						root.style.display = "none";
						return;
					}
				} else if (root && options.hideWhenEmpty) {
					root.classList.remove("alui-hidden-empty");
					if (!root.getAttribute("data-alui-config-hidden")) {
						root.style.display = "inline-block";
					}
				}
				view.render(slice);
			}

			function handleClick(event) {
				if (options.onClick) options.onClick(event, view && view.els);
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
					view = mountUnitFrame(root, options);
					render(initial || null);
					unsubscribe = subscribe(topic, render);
					if (options.onClick) root.addEventListener("click", handleClick);
					if (view.els.inspect) view.els.inspect.addEventListener("click", handleInspect);
				},
				update: render,
				dispose: function () {
					if (unsubscribe) unsubscribe();
					if (root && options.onClick) root.removeEventListener("click", handleClick);
					if (view && view.els && view.els.inspect) view.els.inspect.removeEventListener("click", handleInspect);
					if (view) view.destroy();
					view = null;
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
			containerStyle: "position: fixed; bottom: 130px; left: calc(50% - 240px - 25px); z-index: 310; font-size: 0px;",
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
			containerStyle: "position: fixed; bottom: 130px; left: calc(50% + 25px); z-index: 310; font-size: 0px;",
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
		"hover-frame",
		createRenderer("hover-frame", {
			createContainer: true,
			containerClass: "vtopx inline-block alui-hover-anchor",
			containerStyle: "position: fixed; left: 0; top: 0; z-index: 320; font-size: 0px; pointer-events: none; display: none;",
			insertAfter: "topmid",
			hideWhenEmpty: true,
			compact: true,
			roleLabel: "Hover",
			getInspectEntity: function () {
				return global.mtarget || null;
			},
		}),
	);

	defineWidget(
		"tot-frame",
		createRenderer("tot-frame", {
			createContainer: true,
			containerClass: "vtopx enableclicks inline-block alui-tot-frame",
			containerStyle: "",
			hideWhenEmpty: true,
			compact: true,
			roleLabel: "Target’s Target",
			getInspectEntity: function () {
				var target = global.ctarget;
				if (!target || target.target == null) return null;
				if (global.character && (global.character.id == target.target || global.character.name == target.target)) {
					return global.character;
				}
				if (global.entities && global.entities[target.target]) return global.entities[target.target];
				if (global.entities) {
					for (var id in global.entities) {
						if (!Object.prototype.hasOwnProperty.call(global.entities, id)) continue;
						var e = global.entities[id];
						if (e && (e.id == target.target || e.name == target.target)) return e;
					}
				}
				return null;
			},
		}),
	);

	function placeTotOnTarget() {
		var tot = document.querySelector('[data-widget="tot-frame"]');
		var target = document.querySelector('[data-widget="target-frame"]');
		if (!tot || !target) return;
		if (tot.parentNode !== target) {
			target.style.position = target.style.position || "fixed";
			target.appendChild(tot);
		}
	}

	function followHoverCursor(event) {
		var hover = document.querySelector('[data-widget="hover-frame"]');
		if (!hover || hover.style.display === "none") return;
		var offset = 18;
		hover.style.left = event.clientX + offset + "px";
		hover.style.top = event.clientY + offset + "px";
	}

	function installHoverCursorFollow() {
		if (global.__aluiHoverCursorInstalled) return;
		global.__aluiHoverCursorInstalled = true;
		document.addEventListener("mousemove", followHoverCursor, true);
	}

	/** Republish hover immediately on mouseover/out (don't wait for overlay tick). */
	function publishHoverNow() {
		if (!global.ALUI || typeof global.ALUI.buildHoverFrame !== "function") return;
		if (typeof global.ALUI.publish !== "function") return;
		global.ALUI.publish("hover-frame", global.ALUI.buildHoverFrame());
	}

	function installHoverTargetHooks() {
		if (global.__aluiHoverTargetHooked) return;
		if (typeof global.mouseover !== "function" || typeof global.mouseout !== "function") return;
		global.__aluiHoverTargetHooked = true;
		var originalOver = global.mouseover;
		var originalOut = global.mouseout;
		global.mouseover = function () {
			var result = originalOver.apply(this, arguments);
			publishHoverNow();
			return result;
		};
		global.mouseout = function () {
			var result = originalOut.apply(this, arguments);
			publishHoverNow();
			return result;
		};
	}

	global.ALUI = global.ALUI || {};
	global.ALUI.mountUnitFrame = mountUnitFrame;
	global.ALUI.applyUnitFrameSlice = applyUnitFrameSlice;

	global.ALUI.onWidgetsMounted = global.ALUI.onWidgetsMounted || [];
	global.ALUI.onWidgetsMounted.push(function () {
		placeTotOnTarget();
		installHoverCursorFollow();
		installHoverTargetHooks();
	});
})(typeof window !== "undefined" ? window : global);
