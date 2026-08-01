/**
 * ALUI config — defaults from features, overrides in localStorage.
 */
(function (global) {
	var STORAGE_KEY = "alui_config_v1";
	var defaults = { version: 1, frames: {} };
	var overrides = { version: 1, frames: {} };
	var settings = [];
	var listeners = [];

	function isObject(value) {
		return value && typeof value === "object" && !Array.isArray(value);
	}

	function deepMerge(target, source) {
		if (!isObject(source)) return target;
		var keys = Object.keys(source);
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			var srcVal = source[key];
			if (isObject(srcVal) && isObject(target[key])) {
				deepMerge(target[key], srcVal);
			} else if (isObject(srcVal)) {
				target[key] = deepMerge({}, srcVal);
			} else {
				target[key] = srcVal;
			}
		}
		return target;
	}

	function clone(value) {
		if (!isObject(value) && !Array.isArray(value)) return value;
		return JSON.parse(JSON.stringify(value));
	}

	function splitPath(path) {
		if (!path) return [];
		return String(path).split(".");
	}

	function getAt(obj, path) {
		var parts = splitPath(path);
		var cur = obj;
		for (var i = 0; i < parts.length; i++) {
			if (cur == null) return undefined;
			cur = cur[parts[i]];
		}
		return cur;
	}

	function setAt(obj, path, value) {
		var parts = splitPath(path);
		if (!parts.length) return;
		var cur = obj;
		for (var i = 0; i < parts.length - 1; i++) {
			var key = parts[i];
			if (!isObject(cur[key])) cur[key] = {};
			cur = cur[key];
		}
		cur[parts[parts.length - 1]] = value;
	}

	function loadOverrides() {
		try {
			var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			var parsed = JSON.parse(raw);
			if (!isObject(parsed)) return;
			overrides = { version: 1, frames: {} };
			deepMerge(overrides, parsed);
		} catch (e) {
			overrides = { version: 1, frames: {} };
		}
	}

	function saveOverrides() {
		try {
			if (!global.localStorage) return;
			global.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
		} catch (e) {
			/* ignore quota / private mode */
		}
	}

	function resolved() {
		var out = clone(defaults);
		deepMerge(out, overrides);
		return out;
	}

	function notify(path) {
		for (var i = 0; i < listeners.length; i++) {
			listeners[i](path, resolved());
		}
	}

	function registerDefaults(partial) {
		if (!isObject(partial)) return;
		deepMerge(defaults, partial);
	}

	function registerSetting(spec) {
		if (!spec || !spec.path) return;
		var entry = {
			path: String(spec.path),
			label: spec.label || String(spec.path),
			type: spec.type || "boolean",
		};
		for (var i = 0; i < settings.length; i++) {
			if (settings[i].path === entry.path) {
				settings[i] = entry;
				return;
			}
		}
		settings.push(entry);
	}

	function get(path) {
		var all = resolved();
		if (!path) return all;
		return getAt(all, path);
	}

	function set(path, value) {
		setAt(overrides, path, value);
		saveOverrides();
		notify(path);
	}

	function isEnabled(frameId) {
		var frame = get("frames." + frameId);
		if (!frame || typeof frame !== "object") return false;
		return frame.enabled !== false;
	}

	function onChange(fn) {
		if (typeof fn !== "function") return function () {};
		listeners.push(fn);
		return function unsubscribe() {
			var next = [];
			for (var i = 0; i < listeners.length; i++) {
				if (listeners[i] !== fn) next.push(listeners[i]);
			}
			listeners = next;
		};
	}

	function listSettings() {
		return settings.slice();
	}

	function resetOverrides() {
		overrides = { version: 1, frames: {} };
		saveOverrides();
		notify(null);
	}

	loadOverrides();

	global.ALUI = global.ALUI || {};
	global.ALUI.config = {
		registerDefaults: registerDefaults,
		registerSetting: registerSetting,
		get: get,
		set: set,
		isEnabled: isEnabled,
		onChange: onChange,
		listSettings: listSettings,
		resetOverrides: resetOverrides,
	};
})(typeof window !== "undefined" ? window : global);
