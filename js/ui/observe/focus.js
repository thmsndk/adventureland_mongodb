/**
 * /comm observe focus — state C player-frame from `observing`; select-only clicks.
 * Does not touch selectors.js; does not sync bags.
 */
(function (global) {
	function unitFrameSignature(payload) {
		if (typeof global.ALUI.getPublisherSignature === "function") {
			var sig = global.ALUI.getPublisherSignature("target-frame");
			if (typeof sig === "function") return sig(payload);
		}
		if (payload === null || payload === undefined) return "\0";
		return [payload.name, payload.hp, payload.mp, payload.dead ? 1 : 0].join("\x1f");
	}

	function registerObservePlayerPublisher() {
		if (typeof global.ALUI.registerPublisher !== "function") return;
		if (typeof global.ALUI.buildPlayerFrame !== "function") return;
		global.ALUI.registerPublisher(
			"player-frame",
			function () {
				return global.ALUI.buildPlayerFrame(global.observing || null);
			},
			{ on: ["update_overlays"], signature: unitFrameSignature },
		);
	}

	function selectOnlyPlayerClick(event) {
		if (event.target.closest && event.target.closest(".unitframe-effects")) return;
		if (event.target.closest && event.target.closest(".unitframe-inspect")) return;
		if (!global.observing) return;
		if (typeof btc === "function") btc(event);
		global.ctarget = global.observing;
		if (typeof reset_topleft === "function") reset_topleft();
	}

	function installSelectOnlyPlayerClick() {
		var root = document.querySelector('[data-widget="player-frame"]');
		if (!root || root.getAttribute("data-observe-select-only")) return;
		root.setAttribute("data-observe-select-only", "1");
		root.addEventListener(
			"click",
			function (event) {
				event.stopImmediatePropagation();
				selectOnlyPlayerClick(event);
			},
			true,
		);
	}

	function syncObservedTarget() {
		if (!global.observing) return;
		if (!global.ctarget) global.ctarget = global.observing;
	}

	registerObservePlayerPublisher();

	global.ALUI = global.ALUI || {};
	global.ALUI.onWidgetsMounted = global.ALUI.onWidgetsMounted || [];
	global.ALUI.onWidgetsMounted.push(function () {
		installSelectOnlyPlayerClick();
		syncObservedTarget();
	});
})(typeof window !== "undefined" ? window : global);
