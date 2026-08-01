/**
 * ALUI publishers — features register topic builders; init loops them.
 */
(function (global) {
	var publishers = [];

	function normalizeGroups(options) {
		options = options || {};
		if (options.groups && options.groups.length) return options.groups.slice();
		return [options.group || "frames"];
	}

	function registerPublisher(topic, buildFn, options) {
		if (!topic || typeof buildFn !== "function") return;
		var entry = {
			topic: String(topic),
			build: buildFn,
			groups: normalizeGroups(options),
		};
		for (var i = 0; i < publishers.length; i++) {
			if (publishers[i].topic === entry.topic) {
				publishers[i] = entry;
				return;
			}
		}
		publishers.push(entry);
	}

	function listPublishers(group) {
		if (!group) return publishers.slice();
		var out = [];
		for (var i = 0; i < publishers.length; i++) {
			var groups = publishers[i].groups || ["frames"];
			if (groups.indexOf(group) !== -1) out.push(publishers[i]);
		}
		return out;
	}

	global.ALUI = global.ALUI || {};
	global.ALUI.registerPublisher = registerPublisher;
	global.ALUI.listPublishers = listPublishers;
})(typeof window !== "undefined" ? window : global);
