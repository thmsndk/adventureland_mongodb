/**
 * ALUI publishers — features register topic builders; init loops them.
 */
(function (global) {
	var publishers = [];

	function registerPublisher(topic, buildFn, options) {
		if (!topic || typeof buildFn !== "function") return;
		options = options || {};
		var entry = {
			topic: String(topic),
			build: buildFn,
			group: options.group || "frames",
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
			if (publishers[i].group === group) out.push(publishers[i]);
		}
		return out;
	}

	global.ALUI = global.ALUI || {};
	global.ALUI.registerPublisher = registerPublisher;
	global.ALUI.listPublishers = listPublishers;
})(typeof window !== "undefined" ? window : global);
