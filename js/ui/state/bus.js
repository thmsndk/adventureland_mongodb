/**
 * Simple event bus for widget communication (classic script, no modules).
 */
(function (global) {
	var topics = {};

	function publish(topic, payload) {
		if (!topics[topic]) return;
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
