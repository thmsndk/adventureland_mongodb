/**
 * ALUI publishers — features register topic builders + when to publish.
 *
 * Options:
 *   on: ["update_overlays"|"reset_topleft"|"render_party"|"render_skillbar", ...]
 *   signature: optional fn(payload) → string (omit volatile fields; bus default is JSON)
 *   groups: legacy alias — "frames"→update_overlays, "target-related"→reset_topleft
 */
(function (global) {
	var publishers = [];

	function addUnique(list, value) {
		if (list.indexOf(value) === -1) list.push(value);
	}

	function normalizeOn(options) {
		options = options || {};
		if (options.on && options.on.length) return options.on.slice();

		var groups = [];
		if (options.groups && options.groups.length) groups = options.groups.slice();
		else if (options.group) groups = [options.group];
		else groups = ["frames"];

		var triggers = [];
		for (var i = 0; i < groups.length; i++) {
			if (groups[i] === "frames") addUnique(triggers, "update_overlays");
			else if (groups[i] === "target-related") addUnique(triggers, "reset_topleft");
			else addUnique(triggers, groups[i]);
		}
		if (!triggers.length) triggers.push("update_overlays");
		return triggers;
	}

	function registerPublisher(topic, buildFn, options) {
		if (!topic || typeof buildFn !== "function") return;
		options = options || {};
		var entry = {
			topic: String(topic),
			build: buildFn,
			on: normalizeOn(options),
			signature: typeof options.signature === "function" ? options.signature : null,
		};
		for (var i = 0; i < publishers.length; i++) {
			if (publishers[i].topic === entry.topic) {
				publishers[i] = entry;
				return;
			}
		}
		publishers.push(entry);
	}

	function listPublishers(trigger) {
		if (!trigger) return publishers.slice();
		// Legacy group names still work for callers.
		if (trigger === "frames") trigger = "update_overlays";
		if (trigger === "target-related") trigger = "reset_topleft";
		var out = [];
		for (var i = 0; i < publishers.length; i++) {
			var on = publishers[i].on || ["update_overlays"];
			if (on.indexOf(trigger) !== -1) out.push(publishers[i]);
		}
		return out;
	}

	function getPublisherSignature(topic) {
		for (var i = 0; i < publishers.length; i++) {
			if (publishers[i].topic === topic) return publishers[i].signature;
		}
		return null;
	}

	function listTriggers() {
		var triggers = [];
		for (var i = 0; i < publishers.length; i++) {
			var on = publishers[i].on || [];
			for (var j = 0; j < on.length; j++) addUnique(triggers, on[j]);
		}
		return triggers;
	}

	global.ALUI = global.ALUI || {};
	global.ALUI.registerPublisher = registerPublisher;
	global.ALUI.listPublishers = listPublishers;
	global.ALUI.getPublisherSignature = getPublisherSignature;
	global.ALUI.listPublisherTriggers = listTriggers;
})(typeof window !== "undefined" ? window : global);
