/**
 * /comm observe focus — player-frame = observing; target-frame = observing.target.
 * Soft clicks (xtarget) drive paperdoll only, not the ALUI target frame.
 */
(function (global) {
	function observedEntity() {
		return global.observing || null;
	}

	/** Combat target of the character we are observing (not soft click / roster). */
	function observeFocusTarget() {
		var observing = global.observing;
		if (!observing || observing.target == null || observing.target === "") return null;
		if (typeof global.ALUI.resolveEntity === "function") {
			return global.ALUI.resolveEntity(observing.target);
		}
		return null;
	}

	function selectObserved(event) {
		var target = event.target;
		if (target.closest && target.closest(".unitframe-effects")) return;
		if (target.closest && target.closest(".unitframe-inspect")) return;
		var observing = observedEntity();
		if (!observing) return;
		if (typeof btc === "function") btc(event);
		// Paperdoll only — do not steal the combat target frame.
		global.xtarget = observing;
		if (typeof reset_topleft === "function") reset_topleft();
	}

	if (global.ALUI && global.ALUI.config && typeof global.ALUI.config.registerDefaults === "function") {
		global.ALUI.config.registerDefaults({
			frames: {
				"player-frame": {
					source: "observing",
					layout: {
						anchorX: "center",
						anchorY: "bottom",
						offsetX: -320,
						// Chrome (~54) + buff row (~36) + gap — effects hang below the frame.
						offsetY: 120,
						grow: "down",
						zIndex: 310,
					},
					effects: { enabled: true, side: "bottom", anchor: "left", direction: "right", gap: 4 },
				},
				"target-frame": {
					source: "observing.target",
					layout: {
						anchorX: "center",
						anchorY: "bottom",
						offsetX: 20,
						offsetY: 120,
						grow: "down",
						zIndex: 310,
					},
					effects: { enabled: true, side: "bottom", anchor: "left", direction: "right", gap: 4 },
				},
				"hover-frame": {
					effects: { enabled: true, side: "bottom", anchor: "left", direction: "right", gap: 4 },
				},
				"tot-frame": {
					// Above ToT so stacked ToT→target doesn't paint buffs onto the target bar.
					effects: { enabled: true, side: "top", anchor: "left", direction: "right", gap: 4 },
				},
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
				hideWhenEmpty: true,
				compact: true,
				sidecar: true,
				textMode: "percent",
				showAvatar: false,
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
					unitOpts: { showAvatar: false, compact: true, sidecar: true, textMode: "percent" },
				},
			},
		);
	}

	function defineTargetFrame() {
		if (typeof global.ALUI.defineWidget !== "function") return;
		if (typeof global.ALUI.createUnitFrameRenderer !== "function") return;
		global.ALUI.defineWidget(
			"target-frame",
			global.ALUI.createUnitFrameRenderer("target-frame", {
				createContainer: true,
				containerClass: "vtopx enableclicks inline-block",
				containerStyle: "font-size: 0px;",
				insertAfter: "topmid",
				hideWhenEmpty: true,
				compact: true,
				sidecar: true,
				textMode: "percent",
				showAvatar: false,
				layoutConfigPath: "frames.target-frame.layout",
				effectsConfigPath: "frames.target-frame.effects",
				getInspectEntity: observeFocusTarget,
			}),
			{
				edit: {
					label: "Target",
					kind: "unit",
					layoutPath: "frames.target-frame.layout",
					draggable: true,
					order: 30,
					unitOpts: { showAvatar: false, compact: true, sidecar: true, textMode: "percent" },
				},
			},
		);
		global.ALUI.defineWidget(
			"tot-frame",
			global.ALUI.createUnitFrameRenderer("tot-frame", {
				createContainer: true,
				containerClass: "vtopx enableclicks inline-block alui-tot-frame",
				containerStyle: "",
				hideWhenEmpty: true,
				compact: true,
				sidecar: true,
				textMode: "percent",
				showAvatar: false,
				effectsConfigPath: "frames.tot-frame.effects",
				getInspectEntity: function () {
					var focus = observeFocusTarget();
					if (!focus || focus.target == null) return null;
					return typeof global.ALUI.resolveTargetOf === "function" ? global.ALUI.resolveTargetOf(focus) : null;
				},
			}),
			{
				edit: {
					label: "Target’s Target",
					kind: "unit",
					draggable: false,
					order: 40,
					unitOpts: { showAvatar: false, compact: true, sidecar: true, textMode: "percent" },
					defaultPos: { near: "target-frame", dx: 0, dy: -56 },
				},
			},
		);
	}

	function redefineObservePublishers() {
		if (typeof global.ALUI.registerPublisher !== "function") return;
		var sig = global.ALUI.unitFrameSignature;
		var overlayOpts = { on: ["update_overlays"], signature: sig };
		var targetOpts = { on: ["update_overlays", "reset_topleft"], signature: sig };

		if (typeof global.ALUI.buildPlayerFrame === "function") {
			global.ALUI.registerPublisher(
				"player-frame",
				function () {
					return global.ALUI.buildPlayerFrame(observedEntity());
				},
				overlayOpts,
			);
		}
		if (typeof global.ALUI.buildTargetFrame === "function") {
			global.ALUI.registerPublisher(
				"target-frame",
				function () {
					return global.ALUI.buildTargetFrame(observeFocusTarget());
				},
				targetOpts,
			);
			global.ALUI.registerPublisher(
				"tot-frame",
				function () {
					var focus = observeFocusTarget();
					if (!focus) return null;
					var of = typeof global.ALUI.resolveTargetOf === "function" ? global.ALUI.resolveTargetOf(focus) : null;
					return global.ALUI.buildTargetFrame(of);
				},
				targetOpts,
			);
		}
	}

	definePlayerFrame();
	defineTargetFrame();
	redefineObservePublishers();

	global.ALUI = global.ALUI || {};
	global.ALUI.observeFocusTarget = observeFocusTarget;
})(typeof window !== "undefined" ? window : global);
