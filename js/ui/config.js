/**
 * ALUI config — defaults from features, overrides in localStorage.
 */
(function (global) {
	var STORAGE_KEY = "alui_config_v1";

	function emptyRoot() {
		return { version: 1, frames: {}, editMode: {} };
	}

	var defaults = emptyRoot();
	var overrides = emptyRoot();
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
			overrides = emptyRoot();
			deepMerge(overrides, parsed);
		} catch (e) {
			overrides = emptyRoot();
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

	/**
	 * Spec: { path, label, type, group?, options?, getOptions?, min?, max?, step?, description?, action? }
	 * type: boolean | enum | number | action
	 */
	function registerSetting(spec) {
		if (!spec || !spec.path) return;
		var entry = {
			path: String(spec.path),
			label: spec.label || String(spec.path),
			type: spec.type || "boolean",
			group: spec.group || "General",
			description: spec.description || "",
			options: Array.isArray(spec.options) ? spec.options.slice() : [],
			getOptions: typeof spec.getOptions === "function" ? spec.getOptions : null,
			min: typeof spec.min === "number" ? spec.min : undefined,
			max: typeof spec.max === "number" ? spec.max : undefined,
			step: typeof spec.step === "number" ? spec.step : undefined,
			action: typeof spec.action === "function" ? spec.action : null,
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

	function listSettingsGrouped() {
		var groups = [];
		var byName = {};
		for (var i = 0; i < settings.length; i++) {
			var row = settings[i];
			var name = row.group || "General";
			if (!byName[name]) {
				byName[name] = { name: name, settings: [] };
				groups.push(byName[name]);
			}
			byName[name].settings.push(row);
		}
		return groups;
	}

	function resetOverrides() {
		overrides = emptyRoot();
		saveOverrides();
		notify(null);
	}

	function registerLayoutSettings(frameKey, group, opts) {
		opts = opts || {};
		var base = "frames." + frameKey + ".layout";
		registerSetting({
			path: base + ".anchorX",
			label: "Anchor X",
			type: "enum",
			group: group,
			options: [
				{ value: "left", label: "Left" },
				{ value: "center", label: "Center" },
				{ value: "right", label: "Right" },
			],
		});
		registerSetting({
			path: base + ".anchorY",
			label: "Anchor Y",
			type: "enum",
			group: group,
			options: [
				{ value: "top", label: "Top" },
				{ value: "center", label: "Center" },
				{ value: "bottom", label: "Bottom" },
			],
		});
		registerSetting({
			path: base + ".offsetX",
			label: "Offset X",
			type: "number",
			group: group,
			min: -2000,
			max: 2000,
			step: 1,
		});
		registerSetting({
			path: base + ".offsetY",
			label: "Offset Y",
			type: "number",
			group: group,
			min: -2000,
			max: 2000,
			step: 1,
		});
		if (opts.includeGrow) {
			registerSetting({
				path: base + ".grow",
				label: "Grow",
				type: "enum",
				group: group,
				options: [
					{ value: "down", label: "Down" },
					{ value: "up", label: "Up" },
				],
			});
		}
		registerSetting({
			path: base + ".zIndex",
			label: "Z-index",
			type: "number",
			group: group,
			min: 1,
			max: 4000,
			step: 1,
		});
	}

	function registerEffectsSettings(frameKey, group) {
		var base = "frames." + frameKey + ".effects";
		registerSetting({
			path: base + ".enabled",
			label: "Buffs / debuffs",
			type: "boolean",
			group: group,
		});
		registerSetting({
			path: base + ".side",
			label: "Buffs side",
			type: "enum",
			group: group,
			options: [
				{ value: "bottom", label: "Bottom" },
				{ value: "top", label: "Top" },
				{ value: "left", label: "Left" },
				{ value: "right", label: "Right" },
			],
		});
		registerSetting({
			path: base + ".anchor",
			label: "Buffs anchor",
			type: "enum",
			group: group,
			getOptions: function () {
				var side = get(base + ".side");
				if (side === "left" || side === "right") {
					return [
						{ value: "top", label: "Top" },
						{ value: "center", label: "Center" },
						{ value: "bottom", label: "Bottom" },
					];
				}
				return [
					{ value: "left", label: "Left" },
					{ value: "center", label: "Center" },
					{ value: "right", label: "Right" },
				];
			},
		});
		registerSetting({
			path: base + ".direction",
			label: "Buffs grow",
			type: "enum",
			group: group,
			getOptions: function () {
				var side = get(base + ".side");
				if (side === "left" || side === "right") {
					return [
						{ value: "down", label: "Down" },
						{ value: "up", label: "Up" },
					];
				}
				return [
					{ value: "right", label: "Right" },
					{ value: "left", label: "Left" },
				];
			},
		});
		registerSetting({
			path: base + ".gap",
			label: "Buffs gap",
			type: "number",
			group: group,
			min: 0,
			max: 64,
			step: 1,
		});
	}

	loadOverrides();

	global.ALUI = global.ALUI || {};
	global.ALUI.config = {
		registerDefaults: registerDefaults,
		registerSetting: registerSetting,
		registerLayoutSettings: registerLayoutSettings,
		registerEffectsSettings: registerEffectsSettings,
		get: get,
		set: set,
		isEnabled: isEnabled,
		onChange: onChange,
		listSettings: listSettings,
		listSettingsGrouped: listSettingsGrouped,
		resetOverrides: resetOverrides,
	};
})(typeof window !== "undefined" ? window : global);
