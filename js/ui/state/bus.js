/**
 * Simple event bus for widget communication (classic script, no modules).
 * Skips notify when the payload signature is unchanged.
 */
(function (global) {
	var topics = {};
	var lastSignature = {};

	function signature(payload) {
		if (payload === null || payload === undefined) return "\0";
		try {
			return JSON.stringify(payload);
		} catch (e) {
			return String(payload);
		}
	}

	function publish(topic, payload) {
		if (!topics[topic]) return;
		var sig = signature(payload);
		if (lastSignature[topic] === sig) return;
		lastSignature[topic] = sig;
		for (var i = 0; i < topics[topic].length; i++) {
			topics[topic][i](payload);
		}
	}

	function subscribe(topic, listener) {
		if (!topics[topic]) {
			topics[topic] = [];
		}
		topics[topic].push(listener);
		return function unsubscribe() {
			var next = [];
			for (var i = 0; i < topics[topic].length; i++) {
				if (topics[topic][i] !== listener) next.push(topics[topic][i]);
			}
			topics[topic] = next;
		};
	}

	global.ALUI = global.ALUI || {};
	global.ALUI.publish = publish;
	global.ALUI.subscribe = subscribe;
})(typeof window !== "undefined" ? window : global);
