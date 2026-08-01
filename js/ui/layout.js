/**
 * Shared HUD frame screen geometry — anchors, offsets, grow, snap.
 * No widget registry. Suspend blocks apply while Edit Mode owns positions.
 */
(function (global) {
	var suspended = false;

	/**
	 * anchorX: "left"|"right"|"center"
	 * anchorY: "top"|"bottom"|"center"
	 * offsetX/offsetY: px from that edge (or from mid-screen when center)
	 * grow: "up"|"down"
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
		if (!root || suspended) return;
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

		var pinBottom = L.anchorY === "bottom";
		var growUp = L.grow === "up";
		root.style.flexDirection = (pinBottom && growUp) || (!pinBottom && !growUp) ? "column" : "column-reverse";
		root.setAttribute("data-anchor-x", L.anchorX);
		root.setAttribute("data-anchor-y", L.anchorY);
		root.setAttribute("data-grow", L.grow);
	}

	function getViewportRect(el) {
		if (!el) return null;
		var r = el.getBoundingClientRect();
		return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
	}

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

	/** Inverse of layoutFromTopLeft for known size (center X/Y treat offset as left/top edge vs mid). */
	function topLeftFromLayout(layout, width, height) {
		var L = normalizeLayout(layout || {});
		var vw = window.innerWidth || document.documentElement.clientWidth || 0;
		var vh = window.innerHeight || document.documentElement.clientHeight || 0;
		width = width || 0;
		height = height || 0;
		var left = 0;
		var top = 0;
		if (L.anchorX === "left") left = L.offsetX;
		else if (L.anchorX === "right") left = vw - width - L.offsetX;
		else left = vw / 2 + L.offsetX;
		if (L.anchorY === "top") top = L.offsetY;
		else if (L.anchorY === "bottom") top = vh - height - L.offsetY;
		else top = vh / 2 + L.offsetY;
		return { left: Math.round(left), top: Math.round(top) };
	}

	function snapValue(value, gridSize) {
		if (!gridSize || gridSize < 1) return Math.round(value);
		return Math.round(value / gridSize) * gridSize;
	}

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
				if (Math.abs(outLeft - o.left) <= threshold) outLeft = o.left;
				if (Math.abs(outLeft + width - o.right) <= threshold) outLeft = o.right - width;
				if (Math.abs(outLeft - o.right) <= threshold) outLeft = o.right;
				if (Math.abs(outLeft + width - o.left) <= threshold) outLeft = o.left - width;
				if (Math.abs(outLeft + width / 2 - (o.left + o.width / 2)) <= threshold) {
					outLeft = o.left + o.width / 2 - width / 2;
				}
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

	/** Apply config layout to every node that declared data-alui-layout-path at mount. */
	function applyAllFromConfig() {
		if (suspended || !global.ALUI || !global.ALUI.config) return;
		var nodes = document.querySelectorAll("[data-alui-layout-path]");
		for (var i = 0; i < nodes.length; i++) {
			var el = nodes[i];
			var path = el.getAttribute("data-alui-layout-path");
			if (!path) continue;
			applyFrameLayout(el, global.ALUI.config.get(path) || {});
		}
	}

	function applyPathToElement(el, layoutPath) {
		if (!el || !layoutPath || !global.ALUI || !global.ALUI.config) return;
		applyFrameLayout(el, global.ALUI.config.get(layoutPath) || {});
	}

	function suspend() {
		suspended = true;
	}

	function resume() {
		suspended = false;
	}

	function isSuspended() {
		return suspended;
	}

	global.ALUI = global.ALUI || {};
	global.ALUI.layout = {
		normalize: normalizeLayout,
		apply: applyFrameLayout,
		fromTopLeft: layoutFromTopLeft,
		topLeftFromLayout: topLeftFromLayout,
		getViewportRect: getViewportRect,
		snapTopLeft: snapTopLeft,
		snapValue: snapValue,
		applyAllFromConfig: applyAllFromConfig,
		applyPathToElement: applyPathToElement,
		suspend: suspend,
		resume: resume,
		isSuspended: isSuspended,
	};
	global.ALUI.applyFrameLayout = applyFrameLayout;
	global.ALUI.normalizeFrameLayout = normalizeLayout;
})(typeof window !== "undefined" ? window : global);
