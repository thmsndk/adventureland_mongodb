/**
 * /comm bottom chrome — character strip, observe actions, styled server dropdown.
 */
var last_focus = new Date();
setInterval(function () {
	if ($(":focus").length) last_focus = new Date();
}, 120);

function touch_startify() {
	return;
}

/** No-op kept for observe_character(); server UI is a persistent dropdown. */
function hide_nav() {}

/** Mobile paperdoll tab: "stats" | "gear" */
var comm_paperdoll_tab = "stats";

/**
 * Switch /comm paperdoll between stats and gear (mobile tabs).
 * @param {"stats"|"gear"} tab
 */
function set_comm_paperdoll_tab(tab) {
	comm_paperdoll_tab = tab === "gear" ? "gear" : "stats";
	sync_comm_paperdoll_tabs();
}

/** Show/hide mobile paperdoll tabs based on current #topleftcornerui content. */
function sync_comm_paperdoll_tabs() {
	if (!window.is_comm) return;
	var root = document.getElementById("topleftcorner");
	var ui = document.getElementById("topleftcornerui");
	if (!root || !ui) return;

	var hasInfo = !!ui.querySelector(".renderedinfo");
	var hasSlots = !!ui.querySelector(".slots");
	var empty = !hasInfo && !hasSlots && !ui.children.length;

	root.classList.toggle("comm-pd-empty", empty);
	root.classList.toggle("comm-pd-no-gear", hasInfo && !hasSlots);

	if (comm_paperdoll_tab === "gear" && !hasSlots) comm_paperdoll_tab = "stats";
	root.setAttribute("data-comm-pd-tab", comm_paperdoll_tab);

	var tabs = root.querySelectorAll(".comm-pd-tab");
	for (var i = 0; i < tabs.length; i++) {
		var t = tabs[i];
		var id = t.getAttribute("data-comm-pd-tab");
		var on = id === comm_paperdoll_tab;
		t.classList.toggle("is-active", on);
		t.setAttribute("aria-selected", on ? "true" : "false");
	}
}

function sync_comm_chrome() {
	var watching = !!(window.observing && window.observing.name);
	$(".comm-chrome").toggleClass("is-watching", watching);
	// Clear jQuery .show()/.hide() inline display so CSS owns visibility.
	if (watching) {
		$("#observeui").removeClass("hidden").css("display", "inline-flex");
	} else {
		$("#observeui").addClass("hidden").css("display", "none");
	}
	// Do not bust caches — render_* already key on observing / server state.
	render_characters();
	render_servers();
}

var rc_cache = "-1";
var rc_list_cache = "-1";
function render_characters() {
	var html = "",
		key = "",
		listKey = "",
		chars = X.characters || [],
		i,
		char,
		active,
		root,
		nodes;
	for (i = 0; i < chars.length; i++) {
		char = chars[i];
		key += char.name + " " + char.level + " " + char.server + " " + char.rip + " " + char.skin + " " + char.online + "|";
		listKey += char.name + " " + char.online + "|";
	}
	if (observing && observing.name) key += "obs:" + observing.name;
	if (key == rc_cache) return;

	root = document.querySelector(".charactersuic");
	// Same character list — only patch active observe highlight (no sprite flicker).
	if (root && listKey === rc_list_cache && root.querySelectorAll(".comm-char").length) {
		rc_cache = key;
		nodes = root.querySelectorAll(".comm-char");
		for (i = 0; i < nodes.length; i++) {
			var nameEl = nodes[i].querySelector(".comm-char-name");
			var name = nameEl ? nameEl.textContent : "";
			// Truncated names end with … — match via onclick attribute instead.
			var onclick = nodes[i].getAttribute("onclick") || "";
			var m = onclick.match(/observe_character\("([^"]+)"\)/);
			var fullName = m ? m[1] : name;
			nodes[i].classList.toggle("is-active", !!(observing && observing.name === fullName));
		}
		return;
	}

	rc_cache = key;
	rc_list_cache = listKey;
	for (i = 0; i < chars.length; i++) {
		char = chars[i];
		if (!char.online) continue;
		active = observing && observing.name == char.name;
		html +=
			"<button type='button' class='comm-char" +
			(active ? " is-active" : "") +
			"' title='" +
			char.name +
			" · Lv." +
			char.level +
			" · " +
			server_to_ui(char.server) +
			"' onclick='if(bc(this)) return; observe_character(\"" +
			char.name +
			"\");'>";
		html += "<span class='comm-char-sprite'>" + sprite(char.skin, { cx: char.cx, rip: char.rip }) + "</span>";
		html += "<span class='comm-char-meta'>";
		html += "<span class='comm-char-name'>" + ((char.name.length <= 10 && char.name) || char.name.substr(0, 9) + "…") + "</span>";
		html += "<span class='comm-char-sub'>" + char.level + "</span>";
		html += "</span></button>";
	}
	if (!html) html = "<div class='comm-empty'>No characters online</div>";
	$(".charactersuic").html(html);
}

/**
 * Connect as a generic observer on X.servers[index].
 * @param {number|string} index
 */
function select_comm_server(index) {
	close_comm_server_dd();
	var i = parseInt(index, 10);
	var servers = X.servers || [];
	if (!(i >= 0) || i >= servers.length) return;
	var server = servers[i];
	if (!server) return;
	server_address = server.address;
	server_path = server.path;
	init_socket();
}

function close_comm_server_dd() {
	var nodes = document.querySelectorAll(".comm-server-dd");
	for (var i = 0; i < nodes.length; i++) {
		nodes[i].classList.remove("is-open");
		nodes[i].setAttribute("aria-expanded", "false");
	}
}

function toggle_comm_server_dd(event) {
	if (event) {
		if (event.stopPropagation) event.stopPropagation();
		if (typeof btc === "function") btc(event);
	}
	var root = event && event.currentTarget && event.currentTarget.closest ? event.currentTarget.closest(".comm-server-dd") : document.querySelector(".comm-server-dd");
	if (!root) return;
	var open = root.classList.contains("is-open");
	close_comm_server_dd();
	if (!open) {
		root.classList.add("is-open");
		root.setAttribute("aria-expanded", "true");
	}
}

var sl_cache = "-1";
var sl_list_cache = "-1";
function render_servers() {
	var servers = X.servers || [],
		key = "",
		listKey = "",
		i,
		server,
		currentIndex = -1,
		wasOpen = !!document.querySelector(".comm-server-dd.is-open"),
		triggerName = "Select server…",
		triggerPlayers = "",
		root,
		nameEl,
		subEl,
		opts,
		html;
	for (i = 0; i < servers.length; i++) {
		server = servers[i];
		key += server.region + " " + server.name + " " + server.players + "|";
		listKey += server.region + " " + server.name + "|";
		if (server_region == server.region && server_identifier == server.name) currentIndex = i;
	}
	if (socket && currentIndex < 0) key += "conn:" + server_region + " " + server_identifier;
	else key += "cur:" + currentIndex;
	if (key == sl_cache) return;

	if (currentIndex >= 0 && servers[currentIndex]) {
		triggerName = servers[currentIndex].region + " " + servers[currentIndex].name;
		triggerPlayers = String(servers[currentIndex].players);
	} else if (socket && server_region) {
		triggerName = server_region + " " + (server_identifier || "");
	}

	root = document.querySelector(".comm-server-dd");
	// Same server list — patch labels/counts only (no full rebuild / flicker).
	if (root && listKey === sl_list_cache && root.querySelectorAll(".comm-server-dd-option").length === servers.length) {
		sl_cache = key;
		nameEl = root.querySelector(".comm-server-dd-name");
		subEl = root.querySelector(".comm-server-dd-sub");
		if (nameEl) nameEl.textContent = triggerName;
		if (subEl) subEl.textContent = triggerPlayers !== "" ? triggerPlayers : "—";
		opts = root.querySelectorAll(".comm-server-dd-option");
		for (i = 0; i < opts.length && i < servers.length; i++) {
			opts[i].classList.toggle("is-active", i === currentIndex);
			var p = opts[i].querySelector(".comm-server-dd-option-players");
			if (p) p.textContent = String(servers[i].players);
		}
		return;
	}

	sl_cache = key;
	sl_list_cache = listKey;

	var menuHtml = "";
	if (!servers.length) {
		menuHtml = "<div class='comm-server-dd-empty'>No servers online</div>";
	} else {
		for (i = 0; i < servers.length; i++) {
			server = servers[i];
			menuHtml += "<button type='button' class='comm-server-dd-option" + (i === currentIndex ? " is-active" : "") + "' onclick='if(bc(this)) return; select_comm_server(" + i + ")'>";
			menuHtml += "<span class='comm-server-dd-option-name'>" + server.region + " " + server.name + "</span>";
			menuHtml += "<span class='comm-server-dd-option-players'>" + server.players + "</span>";
			menuHtml += "</button>";
		}
	}

	html =
		"<div class='comm-server-dd" +
		(wasOpen ? " is-open" : "") +
		"' aria-expanded='" +
		(wasOpen ? "true" : "false") +
		"'>" +
		"<button type='button' class='comm-server-dd-trigger' onclick='toggle_comm_server_dd(event)' aria-haspopup='listbox'>" +
		"<span class='comm-server-dd-meta'>" +
		"<span class='comm-server-dd-name'>" +
		triggerName +
		"</span>" +
		"<span class='comm-server-dd-sub'>" +
		(triggerPlayers !== "" ? triggerPlayers : "—") +
		"</span>" +
		"</span>" +
		"<span class='comm-server-dd-chevron' aria-hidden='true'></span>" +
		"</button>" +
		"<div class='comm-server-dd-menu' role='listbox'>" +
		menuHtml +
		"</div>" +
		"</div>";

	$(".serversuic").html(html);
}

if (!window.__commServerDdDocBound) {
	window.__commServerDdDocBound = true;
	document.addEventListener(
		"click",
		function (event) {
			var t = event.target;
			if (t && t.nodeType === 3) t = t.parentNode;
			if (t && t.closest && t.closest(".comm-server-dd")) return;
			close_comm_server_dd();
		},
		true,
	);
	document.addEventListener("keydown", function (event) {
		if (event.key === "Escape" || event.keyCode === 27) close_comm_server_dd();
	});
}

/** Kept for older onclick=toggle_ui() callers. */
function toggle_ui() {
	var trigger = document.querySelector(".comm-server-dd-trigger");
	if (trigger) trigger.click();
}

function toggle_servers_ui() {
	toggle_ui();
}
