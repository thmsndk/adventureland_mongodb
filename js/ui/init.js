/**
 * HUD widget core — bus/registry bootstrap and game update hooks.
 * Features register publishers with `on` triggers; init wraps those game fns once.
 */
(function (global) {
	var mounted = false;
	var hooksInstalled = false;
	var wrapped = {};

	/** Game functions init knows how to wrap for publisher triggers. */
	var KNOWN_TRIGGERS = ["update_overlays", "reset_topleft", "render_party", "render_skillbar"];

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

	function buildTriggerSnapshot(trigger) {
		var snapshot = {};
		if (!global.ALUI || typeof global.ALUI.listPublishers !== "function") return snapshot;
		var list = global.ALUI.listPublishers(trigger);
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

	function publishSnapshot(snapshot) {
		var topics = Object.keys(snapshot);
		for (var i = 0; i < topics.length; i++) {
			global.ALUI.publish(topics[i], snapshot[topics[i]]);
		}
	}

	function publishFor(trigger) {
		publishSnapshot(buildTriggerSnapshot(trigger));
	}

	function publishAllRegistered() {
		if (!global.ALUI || typeof global.ALUI.listPublishers !== "function") return;
		var all = global.ALUI.listPublishers();
		var snapshot = {};
		for (var i = 0; i < all.length; i++) {
			var entry = all[i];
			if (!configEnabled(entry.topic)) {
				setTopicVisible(entry.topic, false);
				continue;
			}
			setTopicVisible(entry.topic, true);
			try {
				snapshot[entry.topic] = entry.build();
			} catch (e) {
				/* skip */
			}
		}
		publishSnapshot(snapshot);
	}

	function applyConfigVisibility() {
		if (!global.ALUI || typeof global.ALUI.listPublishers !== "function") return;
		var all = global.ALUI.listPublishers();
		for (var i = 0; i < all.length; i++) {
			var topic = all[i].topic;
			setTopicVisible(topic, configEnabled(topic));
		}
		if (mounted) publishAllRegistered();
	}

	function wrapTrigger(name) {
		if (wrapped[name]) return true;
		if (typeof global[name] !== "function") return false;
		var original = global[name];
		global[name] = function () {
			var result = original.apply(this, arguments);
			publishFor(name);
			return result;
		};
		wrapped[name] = true;
		return true;
	}

	function installHooks() {
		if (hooksInstalled) return;
		// Core HUD path requires these two; wait until the game defines them.
		if (typeof global.update_overlays !== "function" || typeof global.reset_topleft !== "function") {
			return;
		}
		for (var i = 0; i < KNOWN_TRIGGERS.length; i++) {
			wrapTrigger(KNOWN_TRIGGERS[i]);
		}
		hooksInstalled = true;
	}

	function initWidgets() {
		if (!global.character || mounted) return;
		global.ALUI.mountAll(buildTriggerSnapshot("update_overlays"));
		mounted = true;
		var hooks = global.ALUI.onWidgetsMounted || [];
		for (var i = 0; i < hooks.length; i++) {
			if (typeof hooks[i] === "function") hooks[i]();
		}
		applyConfigVisibility();
	}

	function tryInit() {
		installHooks();
		if (!hooksInstalled) {
			setTimeout(tryInit, 100);
			return;
		}
		if (global.character) {
			initWidgets();
			publishFor("update_overlays");
		} else {
			setTimeout(tryInit, 200);
		}
	}

	global.ALUI = global.ALUI || {};
	global.ALUI.onWidgetsMounted = global.ALUI.onWidgetsMounted || [];
	global.ALUI.applyConfigVisibility = applyConfigVisibility;
	global.ALUI.publishFor = publishFor;

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
