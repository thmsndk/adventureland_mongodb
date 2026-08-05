/**
 * Panel widget shell — host container, layout binding, bus subscription.
 * For widgets that paint their own markup (options.render(root, slice)),
 * the HTML counterpart to unit-frame's createRenderer.
 */
(function (global) {
	function escapeHtml(value) {
		return String(value == null ? "" : value)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}

	/** Game-style thousand separators; "—" for missing numbers. */
	function prettyNum(num) {
		if (num == null || isNaN(num)) return "—";
		if (typeof to_pretty_num === "function") return to_pretty_num(num);
		return String(Math.round(num));
	}

	function createHost(topic, options) {
		var root = document.createElement("div");
		root.setAttribute("data-widget", topic);
		if (options.containerClass) root.className = options.containerClass;
		if (options.containerStyle) root.style.cssText = options.containerStyle;
		var after = document.getElementById(options.insertAfter || "topmid");
		if (after && after.parentNode) {
			if (after.nextSibling) after.parentNode.insertBefore(root, after.nextSibling);
			else after.parentNode.appendChild(root);
		} else {
			document.body.appendChild(root);
		}
		return root;
	}

	/**
	 * @param {string} topic bus topic + data-widget id
	 * @param {{render:function, createContainer?:boolean, containerClass?:string,
	 *   containerStyle?:string, insertAfter?:string, layoutConfigPath?:string,
	 *   onClick?:function}} options
	 * @returns {function} widget factory for defineWidget
	 */
	function createPanelRenderer(topic, options) {
		options = options || {};
		return function () {
			var root, unsubscribe;

			function render(slice) {
				if (!root || typeof options.render !== "function") return;
				options.render(root, slice);
			}

			function handleClick(event) {
				options.onClick(event, root);
			}

			return {
				init: function (target, initial) {
					root = target || document.querySelector('[data-widget="' + topic + '"]');
					if (!root) {
						if (options.createContainer === false) return;
						root = createHost(topic, options);
					}
					if (options.layoutConfigPath) {
						root.setAttribute("data-alui-layout-path", options.layoutConfigPath);
						if (global.ALUI && global.ALUI.layout) {
							global.ALUI.layout.applyPathToElement(root, options.layoutConfigPath);
						}
					}
					if (typeof options.onClick === "function") root.addEventListener("click", handleClick);
					render(initial || null);
					if (typeof global.ALUI.subscribe === "function") {
						unsubscribe = global.ALUI.subscribe(topic, render);
					}
				},
				update: render,
				dispose: function () {
					if (unsubscribe) unsubscribe();
					unsubscribe = null;
					if (root && typeof options.onClick === "function") root.removeEventListener("click", handleClick);
					root = null;
				},
			};
		};
	}

	global.ALUI = global.ALUI || {};
	global.ALUI.createPanelRenderer = createPanelRenderer;
	global.ALUI.escapeHtml = global.ALUI.escapeHtml || escapeHtml;
	global.ALUI.prettyNum = global.ALUI.prettyNum || prettyNum;
})(typeof window !== "undefined" ? window : global);
