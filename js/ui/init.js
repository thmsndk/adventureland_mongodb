/**
 * HUD widget core — bus/registry bootstrap and game update hooks.
 * Feature branches register publishers + widgets; this mounts whatever is present.
 */
(function (global) {
	var mounted = false;
	var hooksInstalled = false;

	function configEnabled(topic) {
		if (!global.ALUI || !global.ALUI.config || typeof global.ALUI.config.isEnabled !== "function") {
			return true;
		}
		return global.ALUI.config.isEnabled(topic);
	}

	function setTopicVisible(topic, visible) {
		var nodes = document.querySelectorAll('[data-widget="' + topic + '"]');
		for (var i = 0; i < nodes.length; i++) {
			nodes[i].style.display = visible ? "" : "none";
		}
	}

	function buildGroupSnapshot(group) {
		var snapshot = {};
		if (!global.ALUI || typeof global.ALUI.listPublishers !== "function") return snapshot;
		var list = global.ALUI.listPublishers(group);
		for (var i = 0; i < list.length; i++) {
			var entry = list[i];
			if (!configEnabled(entry.topic)) {
				setTopicVisible(entry.topic, false);
				continue;
			}
			setTopicVisible(entry.topic, true);
			try {
				snapshot[entry.topic] = entry.build();
			} catch (e) {
				/* feature builder failed — skip topic */
			}
		}
		return snapshot;
	}

	function buildFrameSnapshot() {
		return buildGroupSnapshot("frames");
	}

	function publishSnapshot(snapshot) {
		var topics = Object.keys(snapshot);
		for (var i = 0; i < topics.length; i++) {
			global.ALUI.publish(topics[i], snapshot[topics[i]]);
		}
	}

	function publishFrames() {
		publishSnapshot(buildFrameSnapshot());
	}

	function publishTargetRelated() {
		publishSnapshot(buildGroupSnapshot("target-related"));
	}

	function applyConfigVisibility() {
		if (!global.ALUI || typeof global.ALUI.listPublishers !== "function") return;
		var all = global.ALUI.listPublishers();
		for (var i = 0; i < all.length; i++) {
			var topic = all[i].topic;
			var on = configEnabled(topic);
			setTopicVisible(topic, on);
		}
		if (mounted) {
			publishFrames();
			publishTargetRelated();
		}
	}

	function initWidgets() {
		if (!global.character || mounted) return;
		global.ALUI.mountAll(buildFrameSnapshot());
		mounted = true;
		var hooks = global.ALUI.onWidgetsMounted || [];
		for (var i = 0; i < hooks.length; i++) {
			if (typeof hooks[i] === "function") hooks[i]();
		}
		applyConfigVisibility();
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
			publishTargetRelated();
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
	global.ALUI.applyConfigVisibility = applyConfigVisibility;

	if (global.ALUI.config && typeof global.ALUI.config.onChange === "function") {
		global.ALUI.config.onChange(function () {
			applyConfigVisibility();
		});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", function () {
			setTimeout(tryInit, 100);
		});
	} else {
		setTimeout(tryInit, 100);
	}
})(typeof window !== "undefined" ? window : global);
