/**
 * Initialize HUD widget system and hook game update paths.
 */
(function (global) {
	var mounted = false;
	var hooksInstalled = false;

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
		if (typeof global.update_overlays === "function") {
			var originalUpdateOverlays = global.update_overlays;
			global.update_overlays = function () {
				var result = originalUpdateOverlays.apply(this, arguments);
				if (global.character) {
					global.ALUI.publish("player-frame", global.ALUI.buildPlayerFrame(global.character));
				}
				if (typeof global.render_hud_conditions === "function") {
					global.render_hud_conditions();
				}
				return result;
			};
		}
		if (typeof global.reset_topleft === "function") {
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
		}
		hooksInstalled = true;
	}

	function tryInit() {
		installHooks();
		if (global.character) {
			initWidgets();
			global.ALUI.publish("player-frame", global.ALUI.buildPlayerFrame(global.character));
			global.ALUI.publish("target-frame", global.ctarget ? global.ALUI.buildTargetFrame(global.ctarget) : null);
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
