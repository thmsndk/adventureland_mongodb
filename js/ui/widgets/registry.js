/**
 * Widget registry (classic script).
 * Optional third-arg meta.edit is the single source of truth for Edit Mode shells.
 */
(function (global) {
	var registry = {};

	function clonePlain(obj) {
		if (!obj || typeof obj !== "object") return obj;
		var out = {};
		var keys = Object.keys(obj);
		for (var i = 0; i < keys.length; i++) {
			var k = keys[i];
			var v = obj[k];
			if (v && typeof v === "object" && !Array.isArray(v)) out[k] = clonePlain(v);
			else out[k] = v;
		}
		return out;
	}

	function registerWidget(id, factory, meta) {
		registry[id] = {
			factory: factory,
			instance: null,
			edit: meta && meta.edit ? clonePlain(meta.edit) : null,
		};
	}

	function defineWidget(id, factory, meta) {
		registerWidget(id, factory, meta);
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
			if (global.ALUI && global.ALUI.config && typeof global.ALUI.config.isEnabled === "function") {
				if (!global.ALUI.config.isEnabled(id)) continue;
			}
			var slice = snapshot && snapshot[id] ? snapshot[id] : null;
			mountWidget(id, slice);
		}
	}

	/** Edit Mode catalog — derived from defineWidget(..., { edit }). */
	function listEditableFrames() {
		var out = [];
		var ids = Object.keys(registry);
		for (var i = 0; i < ids.length; i++) {
			var entry = registry[ids[i]];
			if (!entry || !entry.edit) continue;
			var row = clonePlain(entry.edit);
			row.id = ids[i];
			out.push(row);
		}
		out.sort(function (a, b) {
			return (a.order || 0) - (b.order || 0);
		});
		return out;
	}

	global.ALUI = global.ALUI || {};
	global.ALUI.registerWidget = registerWidget;
	global.ALUI.defineWidget = defineWidget;
	global.ALUI.mountWidget = mountWidget;
	global.ALUI.mountAll = mountAll;
	global.ALUI.listEditableFrames = listEditableFrames;
})(typeof window !== "undefined" ? window : global);
