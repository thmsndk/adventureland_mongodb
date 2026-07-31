/**
 * HUD widget core — bus/registry bootstrap and game update hooks.
 * Feature branches register widgets/builders; this mounts whatever is present.
 */
(function (global) {
	var mounted = false;
	var hooksInstalled = false;

	function focusSliceEntity() {
		var focus = global.xtarget;
		if (!focus || focus.visible === false) return null;
		if (global.ctarget && focus === global.ctarget) return null;
		return focus;
	}

	function publishTargetFrames() {
		if (typeof global.ALUI.buildTargetFrame !== "function") return;
		if (global.ctarget) {
			global.ALUI.publish("target-frame", global.ALUI.buildTargetFrame(global.ctarget));
		} else {
			global.ALUI.publish("target-frame", null);
		}
		var focus = focusSliceEntity();
		if (focus) {
			global.ALUI.publish("focus-frame", global.ALUI.buildTargetFrame(focus));
		} else {
			global.ALUI.publish("focus-frame", null);
		}
	}

	function publishFrames() {
		if (global.character) {
			if (typeof global.ALUI.buildPlayerFrame === "function") {
				global.ALUI.publish("player-frame", global.ALUI.buildPlayerFrame(global.character));
			}
			if (typeof global.ALUI.buildXpFrame === "function") {
				global.ALUI.publish("xp-frame", global.ALUI.buildXpFrame(global.character));
			}
		}
		publishTargetFrames();
	}

	function buildSnapshot() {
		var snapshot = {};
		if (global.character && typeof global.ALUI.buildPlayerFrame === "function") {
			snapshot["player-frame"] = global.ALUI.buildPlayerFrame(global.character);
		}
		if (typeof global.ALUI.buildTargetFrame === "function") {
			snapshot["target-frame"] = global.ALUI.buildTargetFrame(global.ctarget || null);
			var focus = focusSliceEntity();
			snapshot["focus-frame"] = focus ? global.ALUI.buildTargetFrame(focus) : null;
		}
		if (global.character && typeof global.ALUI.buildXpFrame === "function") {
			snapshot["xp-frame"] = global.ALUI.buildXpFrame(global.character);
		}
		return snapshot;
	}

	function initWidgets() {
		if (!global.character || mounted) return;
		global.ALUI.mountAll(buildSnapshot());
		mounted = true;
		var hooks = global.ALUI.onWidgetsMounted || [];
		for (var i = 0; i < hooks.length; i++) {
			if (typeof hooks[i] === "function") hooks[i]();
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
			publishTargetFrames();
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
		} else {
			setTimeout(tryInit, 200);
		}
	}

	global.ALUI = global.ALUI || {};
	global.ALUI.onWidgetsMounted = global.ALUI.onWidgetsMounted || [];

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", function () {
			setTimeout(tryInit, 100);
		});
	} else {
		setTimeout(tryInit, 100);
	}
})(typeof window !== "undefined" ? window : global);
