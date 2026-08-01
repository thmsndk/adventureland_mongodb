/**
 * Shared HUD frame screen layout — anchors, offsets, grow.
 * Used by party/unit frames and Edit Mode drag/snap.
 */
(function (global) {
	/**
	 * anchorX: "left"|"right"|"center"
	 * anchorY: "top"|"bottom"|"center"
	 * offsetX/offsetY: px from that edge (or from mid-screen when center — left/top edge relative to 50%)
	 * grow: "up"|"down" (list expansion for stacked widgets)
	 */
	function normalizeLayout(layout, fallbacks) {
		layout = layout || {};
		fallbacks = fallbacks || {};
		var anchorX = "left";
		if (layout.anchorX === "right" || layout.anchorX === "center") anchorX = layout.anchorX;
		else if (fallbacks.anchorX === "right" || fallbacks.anchorX === "center") anchorX = fallbacks.anchorX;

		var anchorY = "bottom";
		if (layout.anchorY === "top" || layout.anchorY === "center") anchorY = layout.anchorY;
		else if (fallbacks.anchorY === "top" || fallbacks.anchorY === "center") anchorY = fallbacks.anchorY;

		var grow = "down";
		if (layout.grow === "up" || layout.grow === "down") grow = layout.grow;
		else if (fallbacks.grow === "up" || fallbacks.grow === "down") grow = fallbacks.grow;

		return {
			anchorX: anchorX,
			anchorY: anchorY,
			offsetX: typeof layout.offsetX === "number" ? layout.offsetX : typeof fallbacks.offsetX === "number" ? fallbacks.offsetX : 0,
			offsetY: typeof layout.offsetY === "number" ? layout.offsetY : typeof fallbacks.offsetY === "number" ? fallbacks.offsetY : 0,
			grow: grow,
			zIndex: typeof layout.zIndex === "number" ? layout.zIndex : typeof fallbacks.zIndex === "number" ? fallbacks.zIndex : 200,
		};
	}

	function edgeExpr(offset) {
		return offset ? "calc(50% + " + offset + "px)" : "50%";
	}

	function applyFrameLayout(root, layout, fallbacks) {
		if (!root) return;
		var L = normalizeLayout(layout, fallbacks);
		root.style.position = "fixed";
		root.style.zIndex = String(L.zIndex);
		root.style.transform = "";

		if (L.anchorX === "left") {
			root.style.left = L.offsetX + "px";
			root.style.right = "auto";
		} else if (L.anchorX === "right") {
			root.style.right = L.offsetX + "px";
			root.style.left = "auto";
		} else {
			root.style.left = edgeExpr(L.offsetX);
			root.style.right = "auto";
		}

		if (L.anchorY === "bottom") {
			root.style.bottom = L.offsetY + "px";
			root.style.top = "auto";
		} else if (L.anchorY === "center") {
			root.style.top = edgeExpr(L.offsetY);
			root.style.bottom = "auto";
		} else {
			root.style.top = L.offsetY + "px";
			root.style.bottom = "auto";
		}

		// Pin bottom + grow up (or pin top/center + grow down) → normal column.
		var pinBottom = L.anchorY === "bottom";
		var growUp = L.grow === "up";
		root.style.flexDirection = (pinBottom && growUp) || (!pinBottom && !growUp) ? "column" : "column-reverse";
		root.setAttribute("data-anchor-x", L.anchorX);
		root.setAttribute("data-anchor-y", L.anchorY);
		root.setAttribute("data-grow", L.grow);
	}

	/** Current on-screen top-left box (viewport px). */
	function getViewportRect(el) {
		if (!el) return null;
		var r = el.getBoundingClientRect();
		return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
	}

	/**
	 * Convert a free top-left position into layout offsets using the given anchors.
	 */
	function layoutFromTopLeft(left, top, width, height, anchors) {
		var L = normalizeLayout(anchors || {});
		var vw = window.innerWidth || document.documentElement.clientWidth || 0;
		var vh = window.innerHeight || document.documentElement.clientHeight || 0;
		width = width || 0;
		height = height || 0;
		if (L.anchorX === "left") L.offsetX = Math.round(left);
		else if (L.anchorX === "right") L.offsetX = Math.round(vw - left - width);
		else L.offsetX = Math.round(left - vw / 2);
		if (L.anchorY === "top") L.offsetY = Math.round(top);
		else if (L.anchorY === "bottom") L.offsetY = Math.round(vh - top - height);
		else L.offsetY = Math.round(top - vh / 2);
		return L;
	}

	function snapValue(value, gridSize) {
		if (!gridSize || gridSize < 1) return Math.round(value);
		return Math.round(value / gridSize) * gridSize;
	}

	/**
	 * Snap a top-left position. Options: gridSize, snapGrid, snapCenter, snapElements, threshold, others[{left,top,width,height}], width, height.
	 */
	function snapTopLeft(left, top, opts) {
		opts = opts || {};
		var width = opts.width || 0;
		var height = opts.height || 0;
		var vw = window.innerWidth || document.documentElement.clientWidth || 0;
		var vh = window.innerHeight || document.documentElement.clientHeight || 0;
		var threshold = typeof opts.threshold === "number" ? opts.threshold : 8;
		var gridSize = opts.gridSize || 20;
		var outLeft = left;
		var outTop = top;

		if (opts.snapGrid !== false) {
			outLeft = snapValue(outLeft, gridSize);
			outTop = snapValue(outTop, gridSize);
		}

		if (opts.snapCenter !== false) {
			var cx = outLeft + width / 2;
			var cy = outTop + height / 2;
			if (Math.abs(cx - vw / 2) <= threshold) outLeft = vw / 2 - width / 2;
			if (Math.abs(cy - vh / 2) <= threshold) outTop = vh / 2 - height / 2;
			if (Math.abs(outLeft - vw / 2) <= threshold) outLeft = vw / 2;
			if (Math.abs(outTop - vh / 2) <= threshold) outTop = vh / 2;
			if (Math.abs(outLeft + width - vw / 2) <= threshold) outLeft = vw / 2 - width;
			if (Math.abs(outTop + height - vh / 2) <= threshold) outTop = vh / 2 - height;
		}

		if (opts.snapElements && opts.others && opts.others.length) {
			for (var i = 0; i < opts.others.length; i++) {
				var o = opts.others[i];
				if (!o) continue;
				// Align left/right/center X
				if (Math.abs(outLeft - o.left) <= threshold) outLeft = o.left;
				if (Math.abs(outLeft + width - o.right) <= threshold) outLeft = o.right - width;
				if (Math.abs(outLeft - o.right) <= threshold) outLeft = o.right;
				if (Math.abs(outLeft + width - o.left) <= threshold) outLeft = o.left - width;
				if (Math.abs(outLeft + width / 2 - (o.left + o.width / 2)) <= threshold) {
					outLeft = o.left + o.width / 2 - width / 2;
				}
				// Align top/bottom/center Y
				if (Math.abs(outTop - o.top) <= threshold) outTop = o.top;
				if (Math.abs(outTop + height - o.bottom) <= threshold) outTop = o.bottom - height;
				if (Math.abs(outTop - o.bottom) <= threshold) outTop = o.bottom;
				if (Math.abs(outTop + height - o.top) <= threshold) outTop = o.top - height;
				if (Math.abs(outTop + height / 2 - (o.top + o.height / 2)) <= threshold) {
					outTop = o.top + o.height / 2 - height / 2;
				}
			}
		}

		return { left: Math.round(outLeft), top: Math.round(outTop) };
	}

	/** Editable HUD widgets that own a free screen layout. */
	var EDITABLE_FRAMES = [
		{ id: "party-frame", layoutPath: "frames.party-frame.layout", label: "Party" },
		{ id: "player-frame", layoutPath: "frames.player-frame.layout", label: "Player" },
		{ id: "target-frame", layoutPath: "frames.target-frame.layout", label: "Target" },
	];

	function applyLayoutFromConfig(frameId) {
		var entry = null;
		for (var i = 0; i < EDITABLE_FRAMES.length; i++) {
			if (EDITABLE_FRAMES[i].id === frameId) {
				entry = EDITABLE_FRAMES[i];
				break;
			}
		}
		if (!entry) return;
		var el = document.querySelector('[data-widget="' + frameId + '"]');
		if (!el || !global.ALUI || !global.ALUI.config) return;
		applyFrameLayout(el, global.ALUI.config.get(entry.layoutPath) || {});
	}

	function applyAllLayoutsFromConfig() {
		for (var i = 0; i < EDITABLE_FRAMES.length; i++) {
			applyLayoutFromConfig(EDITABLE_FRAMES[i].id);
		}
	}

	global.ALUI = global.ALUI || {};
	global.ALUI.layout = {
		normalize: normalizeLayout,
		apply: applyFrameLayout,
		fromTopLeft: layoutFromTopLeft,
		getViewportRect: getViewportRect,
		snapTopLeft: snapTopLeft,
		snapValue: snapValue,
		EDITABLE_FRAMES: EDITABLE_FRAMES,
		applyFromConfig: applyLayoutFromConfig,
		applyAllFromConfig: applyAllLayoutsFromConfig,
	};
	// Back-compat aliases used by party-frame
	global.ALUI.normalizePartyLayout = normalizeLayout;
	global.ALUI.applyPartyLayout = applyFrameLayout;
	global.ALUI.applyFrameLayout = applyFrameLayout;
	global.ALUI.normalizeFrameLayout = normalizeLayout;
})(typeof window !== "undefined" ? window : global);
