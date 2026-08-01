/**
 * Unit frame widgets — shared mount/render API + player/target/hover/ToT.
 */
(function (global) {
	var defineWidget = global.ALUI.defineWidget;
	var subscribe = global.ALUI.subscribe;

	function template(target, options) {
		options = options || {};
		// chrome:false → core only (name + bars). Parent chrome (e.g. party row) wraps it.
		var chrome = options.chrome !== false;
		var showAvatar = options.showAvatar === true || (options.showAvatar !== false && chrome);
		var frameClass = "unitframe";
		if (!chrome) frameClass += " unitframe--embedded";
		if (options.compact) frameClass += " unitframe--compact";
		if (showAvatar) frameClass += " unitframe--has-avatar";
		if (options.frameClass) frameClass += " " + options.frameClass;
		var html = [];
		if (options.roleLabel) {
			html.push('<div class="unitframe-role">' + options.roleLabel + "</div>");
		}
		html.push('<div class="' + frameClass + '">');
		if (showAvatar) {
			html.push('<div class="unitframe-avatar"><div class="unitframe-avatar-inner"></div></div>');
		}
		html.push(
			'<div class="unitframe-body">',
			'<div class="unitframe-name">',
			options.hideSkull ? "" : '<span class="unitframe-skull" title="Dead" aria-hidden="true">☠</span>',
			options.hideInspect ? "" : '<button type="button" class="unitframe-inspect" title="Inspect">{}</button>',
			'<span class="unitframe-name-text"></span>',
			'<span class="unitframe-diff"></span>',
			'<span class="unitframe-name-extra">' + (options.nameExtraHtml || "") + "</span>",
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
			"</div>", // .unitframe-body
			"</div>", // .unitframe
			options.hideEffects ? "" : '<div class="unitframe-effects"></div>',
		);
		target.innerHTML = html.join("");
		var els = {
			host: target,
			rootFrame: target.querySelector(".unitframe"),
			avatar: target.querySelector(".unitframe-avatar"),
			avatarInner: target.querySelector(".unitframe-avatar-inner"),
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
		// Optional: park effects under a parent chrome (party slot) instead of inside the core host.
		if (els.effects && options.effectsHost) {
			var after = options.effectsAfter;
			if (after && after.parentNode === options.effectsHost) {
				if (after.nextSibling) options.effectsHost.insertBefore(els.effects, after.nextSibling);
				else options.effectsHost.appendChild(els.effects);
			} else {
				options.effectsHost.appendChild(els.effects);
			}
		}
		return els;
	}

	function avatarKey(slice) {
		if (!slice) return "";
		var cx = "";
		try {
			cx = JSON.stringify(slice.cx || {});
		} catch (e) {
			cx = "";
		}
		return [slice.skin || "", slice.mtype || "", slice.dead || slice.rip ? 1 : 0, cx].join("|");
	}

	/**
	 * HTML for an entity portrait (sprite() when possible).
	 * Tries skin then mtype so monsters work even when live skin was omitted from sync.
	 */
	function renderAvatarHtml(slice, options) {
		options = options || {};
		slice = slice || {};
		var dead = !!(slice.dead || slice.rip);
		var isMonster = slice.entityType === "monster" || !!slice.mtype;
		var candidates = [];
		if (slice.skin) candidates.push(slice.skin);
		if (slice.mtype && slice.mtype !== slice.skin) candidates.push(slice.mtype);

		if (typeof precompute_image_positions === "function") {
			try {
				precompute_image_positions();
			} catch (e) {
				/* ignore */
			}
		}

		if (typeof sprite === "function") {
			for (var i = 0; i < candidates.length; i++) {
				var name = candidates[i];
				try {
					// Let sprite() map monster type → skin when given an mtype key.
					var html = sprite(name, {
						cx: isMonster ? {} : slice.cx || {},
						rip: dead,
						scale: options.compact ? 1.5 : 2,
						height: options.compact ? 44 : 50,
						overflow: true,
					});
					if (html) return html;
				} catch (e) {
					/* try next candidate */
				}
			}
		}
		if (dead) return '<span class="unitframe-avatar-skull">☠</span>';
		if (options.fallbackClass && (slice.type || slice.mtype)) {
			return (
				'<span class="unitframe-avatar-cls">' +
				String(slice.type || slice.mtype)
					.slice(0, 3)
					.toUpperCase() +
				"</span>"
			);
		}
		return "";
	}

	/**
	 * Paint avatar into a host that contains .unitframe-avatar-inner or .party-d-avatar.
	 */
	function applyAvatar(host, slice, options) {
		if (!host) return;
		options = options || {};
		var inner = host.querySelector(".unitframe-avatar-inner") || host.querySelector(".party-d-avatar") || host;
		var key = avatarKey(slice);
		if (host.getAttribute("data-portrait-key") === key) return;
		var html = slice ? renderAvatarHtml(slice, options) : "";
		// Don't cache failures — IID/sprite sheets may not be ready on first paint.
		if (slice && (slice.skin || slice.mtype) && !html && !slice.dead && !slice.rip) {
			host.removeAttribute("data-portrait-key");
			inner.innerHTML = "";
			return;
		}
		host.setAttribute("data-portrait-key", key);
		inner.innerHTML = html;
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
		// When embedded (chrome:false), parent chrome owns dead/far visuals — avoid double opacity.
		var paintFrameState = options.chrome !== false;
		var showAvatar = !!(els.avatar || els.avatarInner);
		if (!slice) {
			if (paintFrameState && els.rootFrame) els.rootFrame.classList.remove("unitframe-dead", "unitframe-far");
			setText(els.name, options.emptyName || "No Target");
			setDiff(els.diff, "", "");
			setText(els.level, "");
			setWidth(els.health, "0%");
			setText(els.healthText, options.textMode === "percent" ? "0%" : "0 / 0 (0%)");
			setWidth(els.mana, "0%");
			setText(els.manaText, options.textMode === "percent" ? "0%" : "0 / 0 (0%)");
			if (showAvatar) applyAvatar(els.avatar || els.avatarInner, null, options);
			renderEffects(els.effects, [], "", effectsKeyRef, frameId, effectIconSize);
			return;
		}

		if (paintFrameState && els.rootFrame) {
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
		if (showAvatar) applyAvatar(els.avatar || els.avatarInner, slice, options);
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
				if (els && els.effects && els.effects.parentNode && els.effects.parentNode !== host) {
					els.effects.parentNode.removeChild(els.effects);
				}
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
		clearStaleMtarget();
		publishHoverNow();
		var hover = document.querySelector('[data-widget="hover-frame"]');
		if (!hover || hover.classList.contains("alui-hidden-empty")) return;
		var offset = 18;
		hover.style.left = event.clientX + offset + "px";
		hover.style.top = event.clientY + offset + "px";
	}

	function installHoverCursorFollow() {
		if (global.__aluiHoverCursorInstalled) return;
		global.__aluiHoverCursorInstalled = true;
		document.addEventListener("mousemove", followHoverCursor, true);
	}

	/**
	 * PIXI binds mouseout by function reference at sprite create time, so wrapping
	 * window.mouseout misses existing entities. Clear mtarget when the pointer is
	 * no longer over that display object (map / empty space / other sprites).
	 */
	function clearStaleMtarget() {
		var m = global.mtarget;
		if (!m) return;
		var interaction = global.renderer && global.renderer.plugins && global.renderer.plugins.interaction;
		if (!interaction || !interaction.eventData) return;
		var current = interaction.eventData.target;
		var node = current;
		while (node) {
			if (node === m) return;
			node = node.parent;
		}
		global.mtarget = null;
	}

	/** Publish hover from current mtarget (bus signature dedupes unchanged payloads). */
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
		// Still wrap for sprites created after mount (they pick up the new global).
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
	global.ALUI.renderUnitAvatarHtml = renderAvatarHtml;
	global.ALUI.applyUnitAvatar = applyAvatar;
	global.ALUI.unitFrameAvatarKey = avatarKey;

	global.ALUI.onWidgetsMounted = global.ALUI.onWidgetsMounted || [];
	global.ALUI.onWidgetsMounted.push(function () {
		placeTotOnTarget();
		installHoverCursorFollow();
		installHoverTargetHooks();
	});
})(typeof window !== "undefined" ? window : global);
