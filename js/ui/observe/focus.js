/**
 * /comm observe focus — player-frame follows `observing` instead of `character`.
 * Declares config source + redefines the widget click/inspect seams (loaded after unit-frame.js).
 */
(function (global) {
	function observedEntity() {
		return global.observing || null;
	}

	function selectObserved(event) {
		var target = event.target;
		if (target.closest && target.closest(".unitframe-effects")) return;
		if (target.closest && target.closest(".unitframe-inspect")) return;
		var observing = observedEntity();
		if (!observing) return;
		if (typeof btc === "function") btc(event);
		global.ctarget = observing;
		if (typeof reset_topleft === "function") reset_topleft();
	}

	if (global.ALUI && global.ALUI.config && typeof global.ALUI.config.registerDefaults === "function") {
		global.ALUI.config.registerDefaults({
			frames: {
				"player-frame": { source: "observing" },
			},
		});
	}

	function definePlayerFrame() {
		if (typeof global.ALUI.defineWidget !== "function") return;
		if (typeof global.ALUI.createUnitFrameRenderer !== "function") return;
		global.ALUI.defineWidget(
			"player-frame",
			global.ALUI.createUnitFrameRenderer("player-frame", {
				createContainer: true,
				containerClass: "vtopx enableclicks inline-block",
				containerStyle: "font-size: 0px;",
				insertAfter: "topmid",
				layoutConfigPath: "frames.player-frame.layout",
				effectsConfigPath: "frames.player-frame.effects",
				getInspectEntity: observedEntity,
				onClick: selectObserved,
			}),
			{
				edit: {
					label: "Player",
					kind: "unit",
					layoutPath: "frames.player-frame.layout",
					draggable: true,
					order: 20,
					unitOpts: { showAvatar: true },
				},
			},
		);
	}

	function syncObservedTarget() {
		if (!global.observing) return;
		if (!global.ctarget) global.ctarget = global.observing;
	}

	definePlayerFrame();

	global.ALUI = global.ALUI || {};
	global.ALUI.onWidgetsMounted = global.ALUI.onWidgetsMounted || [];
	global.ALUI.onWidgetsMounted.push(syncObservedTarget);
})(typeof window !== "undefined" ? window : global);
