/**
 * /comm responsive layout — mobile / tablet / desktop presets.
 * Does not persist; respects HUD edit mode; re-applies saved layout on desktop.
 *
 * Breakpoints (CSS px):
 *   mobile  ≤ 600
 *   tablet  601–1100  (iPad Air ~820, etc.)
 *   desktop ≥ 1101
 */
(function (global) {
	var MQ_MOBILE = "(max-width: 600px)";
	var MQ_TABLET = "(min-width: 601px) and (max-width: 1100px)";

	var PATHS = {
		"player-frame": "frames.player-frame.layout",
		"target-frame": "frames.target-frame.layout",
		"observe-cooldowns": "frames.observe-cooldowns.layout",
		"observe-roster": "frames.observe-roster.layout",
		"observe-aggro": "frames.observe-aggro.layout",
		"observe-status": "frames.observe-status.layout",
	};

	/** Phones — stack ToT above target; frames in bottom corners; room for buffs under bars. */
	var MOBILE = {
		"player-frame": { anchorX: "left", anchorY: "bottom", offsetX: 4, offsetY: 100, grow: "down", zIndex: 310 },
		"target-frame": { anchorX: "right", anchorY: "bottom", offsetX: 4, offsetY: 100, grow: "down", zIndex: 310 },
		"observe-cooldowns": { anchorX: "left", anchorY: "bottom", offsetX: 4, offsetY: 150, grow: "up", zIndex: 305 },
		"observe-roster": { anchorX: "left", anchorY: "top", offsetX: 4, offsetY: 4, grow: "down", zIndex: 200 },
		"observe-aggro": { anchorX: "right", anchorY: "top", offsetX: 4, offsetY: 4, grow: "down", zIndex: 200 },
		"observe-status": { anchorX: "left", anchorY: "top", offsetX: 4, offsetY: 100, grow: "down", zIndex: 200 },
	};

	/** Tablets — same corner anchors as mobile, more chrome clearance + ToT stack with larger gap. */
	var TABLET = {
		"player-frame": { anchorX: "left", anchorY: "bottom", offsetX: 8, offsetY: 120, grow: "down", zIndex: 310 },
		"target-frame": { anchorX: "right", anchorY: "bottom", offsetX: 8, offsetY: 120, grow: "down", zIndex: 310 },
		"observe-cooldowns": { anchorX: "left", anchorY: "bottom", offsetX: 8, offsetY: 175, grow: "up", zIndex: 305 },
		"observe-roster": { anchorX: "left", anchorY: "top", offsetX: 6, offsetY: 6, grow: "down", zIndex: 200 },
		"observe-aggro": { anchorX: "right", anchorY: "top", offsetX: 6, offsetY: 6, grow: "down", zIndex: 200 },
		"observe-status": { anchorX: "left", anchorY: "top", offsetX: 6, offsetY: 120, grow: "down", zIndex: 200 },
	};

	function editModeOn() {
		return !!(global.ALUI && global.ALUI.config && global.ALUI.config.get && global.ALUI.config.get("editMode.enabled"));
	}

	function match(mq) {
		return !!(global.matchMedia && global.matchMedia(mq).matches);
	}

	/** @returns {"mobile"|"tablet"|"desktop"} */
	function viewportTier() {
		if (match(MQ_MOBILE)) return "mobile";
		if (match(MQ_TABLET)) return "tablet";
		return "desktop";
	}

	function setViewportClasses(tier) {
		var root = document.documentElement;
		var body = document.body;
		var tiers = ["mobile", "tablet", "desktop"];
		for (var i = 0; i < tiers.length; i++) {
			var t = tiers[i];
			var on = t === tier;
			if (root && root.classList) {
				root.classList.toggle("comm-vp-" + t, on);
				root.classList.toggle("comm-" + t, on);
			}
			if (body && body.classList) {
				body.classList.toggle("comm-vp-" + t, on);
				body.classList.toggle("comm-" + t, on);
			}
		}
		// Back-compat: comm-narrow = phone-sized stacking / density.
		var narrow = tier === "mobile";
		if (root && root.classList) root.classList.toggle("comm-narrow", narrow);
		if (body && body.classList) body.classList.toggle("comm-narrow", narrow);
		// Tablets also stack ToT / use corner frames.
		var stack = tier === "mobile" || tier === "tablet";
		if (root && root.classList) root.classList.toggle("comm-stack-tot", stack);
		if (body && body.classList) body.classList.toggle("comm-stack-tot", stack);
	}

	function presetFor(tier) {
		if (tier === "mobile") return MOBILE;
		if (tier === "tablet") return TABLET;
		return null;
	}

	function applyResponsiveLayouts() {
		if (!global.ALUI || !global.ALUI.layout) return;
		if (editModeOn()) return;

		var tier = viewportTier();
		setViewportClasses(tier);
		var preset = presetFor(tier);

		var ids = Object.keys(PATHS);
		for (var i = 0; i < ids.length; i++) {
			var id = ids[i];
			var el = document.querySelector('[data-widget="' + id + '"]');
			if (!el) continue;
			// Docked cooldowns follow the player frame — skip free layout.
			if (id === "observe-cooldowns" && el.getAttribute("data-alui-docked") === "player-frame") continue;

			if (preset && preset[id]) {
				global.ALUI.layout.apply(el, preset[id]);
				el.setAttribute("data-alui-responsive", tier);
			} else if (el.getAttribute("data-alui-responsive")) {
				el.removeAttribute("data-alui-responsive");
				if (typeof global.ALUI.layout.applyPathToElement === "function") {
					global.ALUI.layout.applyPathToElement(el, PATHS[id]);
				}
			}
		}
		if (typeof global.ALUI.placeObserveCdsOnPlayer === "function") {
			global.ALUI.placeObserveCdsOnPlayer();
		}
	}

	var resizeTimer = null;
	function onViewportChange() {
		if (resizeTimer) clearTimeout(resizeTimer);
		resizeTimer = setTimeout(applyResponsiveLayouts, 120);
	}

	function boot() {
		applyResponsiveLayouts();
		if (global.matchMedia) {
			var mqs = [MQ_MOBILE, MQ_TABLET, "(min-width: 1101px)"];
			for (var i = 0; i < mqs.length; i++) {
				var mql = global.matchMedia(mqs[i]);
				if (mql.addEventListener) mql.addEventListener("change", onViewportChange);
				else if (mql.addListener) mql.addListener(onViewportChange);
			}
		}
		global.addEventListener("resize", onViewportChange);
		global.addEventListener("orientationchange", onViewportChange);
		if (global.ALUI.config && typeof global.ALUI.config.onChange === "function") {
			global.ALUI.config.onChange(function (change) {
				if (change && change.layout) onViewportChange();
			});
		}
	}

	global.ALUI = global.ALUI || {};
	global.ALUI.applyCommResponsive = applyResponsiveLayouts;
	global.ALUI.commViewportTier = viewportTier;
	global.ALUI.onWidgetsMounted = global.ALUI.onWidgetsMounted || [];
	global.ALUI.onWidgetsMounted.push(boot);

	if (document.readyState === "complete" || document.readyState === "interactive") {
		setTimeout(function () {
			if (document.querySelector("[data-widget]")) boot();
		}, 0);
	}
})(typeof window !== "undefined" ? window : global);
