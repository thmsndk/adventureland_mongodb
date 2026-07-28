/**
 * Initialize HUD widget system and hook game update paths.
 * Unit frames publish only when slice data changes (bus dedupes).
 * Buff/debuff strip refreshes on a timer — not every overlay frame.
 */
(function (global) {
	var mounted = false;
	var hooksInstalled = false;
	var conditionsInterval = null;

	function initWidgets() {
		if (!global.character || mounted) return;
		var snapshot = {
			"player-frame": global.ALUI.buildPlayerFrame(global.character),
			"target-frame": global.ALUI.buildTargetFrame(global.ctarget || null),
		};
		global.ALUI.mountAll(snapshot);
		mounted = true;
	}

	function installHooks() {
		if (hooksInstalled) return;
		if (typeof global.update_overlays !== "function" || typeof global.reset_topleft !== "function") {
			return;
		}
		var originalUpdateOverlays = global.update_overlays;
		global.update_overlays = function () {
			var result = originalUpdateOverlays.apply(this, arguments);
			if (global.character) {
				global.ALUI.publish("player-frame", global.ALUI.buildPlayerFrame(global.character));
			}
			return result;
		};
		var originalResetTopleft = global.reset_topleft;
		global.reset_topleft = function () {
			var result = originalResetTopleft.apply(this, arguments);
			if (global.ctarget) {
				global.ALUI.publish("target-frame", global.ALUI.buildTargetFrame(global.ctarget));
			} else {
				global.ALUI.publish("target-frame", null);
			}
			return result;
		};
		if (!conditionsInterval) {
			conditionsInterval = setInterval(function () {
				if (typeof global.render_hud_conditions === "function") {
					try {
						global.render_hud_conditions();
					} catch (e) {
						/* no-op */
					}
				}
			}, 500);
		}
		hooksInstalled = true;
	}

	function tryInit() {
		installHooks();
		if (!hooksInstalled) {
			setTimeout(tryInit, 100);
			return;
		}
		if (global.character) {
			initWidgets();
			global.ALUI.publish("player-frame", global.ALUI.buildPlayerFrame(global.character));
			global.ALUI.publish("target-frame", global.ctarget ? global.ALUI.buildTargetFrame(global.ctarget) : null);
			if (typeof global.render_cooldown_widget === "function") {
				global.render_cooldown_widget();
			}
			if (typeof global.render_hud_conditions === "function") {
				global.render_hud_conditions();
			}
		} else {
			setTimeout(tryInit, 200);
		}
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", function () {
			setTimeout(tryInit, 100);
		});
	} else {
		setTimeout(tryInit, 100);
	}
})(typeof window !== "undefined" ? window : global);
