/**
 * Player experience bar — thin strip snug above the bottom ATT/NAME/INV chrome.
 */
(function (global) {
	var defineWidget = global.ALUI.defineWidget;
	var subscribe = global.ALUI.subscribe;

	function template(target) {
		target.innerHTML = [
			'<div class="xpframe" title="Experience">',
			'<div class="xpframe-fill"></div>',
			'<div class="xpframe-ticks" aria-hidden="true"></div>',
			'<div class="xpframe-text"></div>',
			"</div>",
		].join("");
		return {
			fill: target.querySelector(".xpframe-fill"),
			text: target.querySelector(".xpframe-text"),
		};
	}

	function formatNumber(num) {
		if (typeof to_pretty_num === "function") return to_pretty_num(num);
		return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	}

	function setText(el, value) {
		if (!el) return;
		if (el.textContent === value) return;
		el.textContent = value;
	}

	function setWidth(el, value) {
		if (!el) return;
		if (el.style.width === value) return;
		el.style.width = value;
	}

	defineWidget("xp-frame", function () {
		var root, els, unsubscribe;

		function render(slice) {
			if (!els) return;
			if (!slice) {
				setWidth(els.fill, "0%");
				setText(els.text, "");
				return;
			}
			setWidth(els.fill, (slice.percent || 0) + "%");
			setText(els.text, "Lv." + slice.level + "  " + (slice.percent || 0) + "%");
			if (root) {
				root.title = "XP " + formatNumber(slice.xp || 0) + " / " + formatNumber(slice.maxXp || 0);
			}
		}

		function handleClick(event) {
			if (typeof btc === "function") btc(event);
			if (typeof tut === "function") tut("stats");
			if (typeof toggle_stats === "function") toggle_stats();
		}

		return {
			init: function (target, initial) {
				if (!target) {
					var existing = document.querySelector('[data-widget="xp-frame"]');
					if (existing) {
						root = existing;
					} else {
						root = document.createElement("div");
						root.setAttribute("data-widget", "xp-frame");
						root.className = "enableclicks";
						root.style.cssText = "position: fixed; bottom: 36px; left: calc(50% - 170px); width: 340px; z-index: 5;";
						var afterEl = document.getElementById("topmid");
						if (afterEl && afterEl.parentNode) {
							if (afterEl.nextSibling) {
								afterEl.parentNode.insertBefore(root, afterEl.nextSibling);
							} else {
								afterEl.parentNode.appendChild(root);
							}
						} else {
							document.body.appendChild(root);
						}
					}
				} else {
					root = target;
				}
				els = template(root);
				render(initial || null);
				unsubscribe = subscribe("xp-frame", render);
				root.addEventListener("click", handleClick);
			},
			update: render,
			dispose: function () {
				if (unsubscribe) unsubscribe();
				if (root) root.removeEventListener("click", handleClick);
				if (root) root.innerHTML = "";
				els = null;
			},
		};
	});
})(typeof window !== "undefined" ? window : global);
