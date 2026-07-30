/**
 * Initialize HUD widget system and hook game update paths.
 * Unit frames publish only when slice data changes (bus dedupes).
 * Buffs/debuffs live on each unit frame; cooldowns are a separate centered strip.
 */
(function (global) {
	var mounted = false;
	var hooksInstalled = false;

	function publishFrames() {
		if (global.character) {
			global.ALUI.publish("player-frame", global.ALUI.buildPlayerFrame(global.character));
			global.ALUI.publish("xp-frame", global.ALUI.buildXpFrame(global.character));
		}
		if (global.ctarget) {
			global.ALUI.publish("target-frame", global.ALUI.buildTargetFrame(global.ctarget));
		} else {
			global.ALUI.publish("target-frame", null);
		}
	}

	function initWidgets() {
		if (!global.character || mounted) return;
		var snapshot = {
			"player-frame": global.ALUI.buildPlayerFrame(global.character),
			"target-frame": global.ALUI.buildTargetFrame(global.ctarget || null),
			"xp-frame": global.ALUI.buildXpFrame(global.character),
		};
		global.ALUI.mountAll(snapshot);
		mounted = true;
		var oldXp = document.querySelectorAll(".xpsui");
		for (var i = 0; i < oldXp.length; i++) {
			oldXp[i].style.display = "none";
		}
	}

	function installHooks() {
		if (hooksInstalled) return;
		if (typeof global.update_overlays !== "function" || typeof global.reset_topleft !== "function") {
			return;
		}
		var originalUpdateOverlays = global.update_overlays;
		global.update_overlays = function () {
			var result = originalUpdateOverlays.apply(this, arguments);
			publishFrames();
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
			publishFrames();
			if (typeof global.render_cooldown_widget === "function") {
				global.render_cooldown_widget();
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
