/**
 * Widget registry (classic script).
 */
(function (global) {
	var registry = {};

	function registerWidget(id, factory) {
		registry[id] = { factory: factory, instance: null };
	}

	function defineWidget(id, factory) {
		registerWidget(id, factory);
		return factory;
	}

	function mountWidget(id, initialSlice) {
		var entry = registry[id];
		if (!entry) {
			return;
		}
		var target = document.querySelector('[data-widget="' + id + '"]');
		var instance = entry.factory();
		if (instance.init) {
			instance.init(target || null, initialSlice);
		}
		entry.instance = instance;
	}

	function mountAll(snapshot) {
		var ids = Object.keys(registry);
		for (var i = 0; i < ids.length; i++) {
			var id = ids[i];
			var slice = snapshot && snapshot[id] ? snapshot[id] : null;
			mountWidget(id, slice);
		}
	}

	function pushUpdate(id, payload) {
		var entry = registry[id];
		if (entry && entry.instance && entry.instance.update) {
			entry.instance.update(payload);
		}
	}

	global.ALUI = global.ALUI || {};
	global.ALUI.registerWidget = registerWidget;
	global.ALUI.defineWidget = defineWidget;
	global.ALUI.mountWidget = mountWidget;
	global.ALUI.mountAll = mountAll;
	global.ALUI.pushUpdate = pushUpdate;
})(typeof window !== "undefined" ? window : global);
