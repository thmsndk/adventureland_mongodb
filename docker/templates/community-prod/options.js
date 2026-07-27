var base_url = process.env.COMMUNITY_BASE_URL || "https://play.adventureland.community";
var gs_public = process.env.COMMUNITY_GS_PUBLIC || "gs.adventureland.community";
var gs_port = parseInt(process.env.COMMUNITY_GS_PORT || "443", 10);
var https_mode = process.env.COMMUNITY_HTTPS !== "0";
var gs_address = gs_public;
if (!https_mode || (gs_port !== 443 && gs_port !== 80)) gs_address = gs_public + ":" + gs_port;

machines = {
	docker: {
		key: "",
		ip: "0.0.0.0",
		user: "",
	},
};

servers = {
	local: {
		region: "US",
		name: "I",
		path: "/socket.io/",
		api_path: "/server.api/",
		local_ip: "0.0.0.0",
		local_port: 7192,
		address: gs_address,
		internal_address: "gameserver:7192",
		machine: "docker",
		db: "prod",
		secure: https_mode,
		nginx: false,
		Dev: false,
		realm: "community",
	},
	ptr: {
		region: "US",
		name: "PTR",
		path: "/socket.io/",
		api_path: "/server.api/",
		local_ip: "0.0.0.0",
		local_port: 7193,
		address: process.env.COMMUNITY_PTR_PUBLIC || gs_address.replace(String(gs_port), "7193"),
		internal_address: "gameserver-ptr:7193",
		machine: "docker",
		db: "prod",
		secure: https_mode,
		nginx: false,
		Dev: false,
		realm: "ptr",
	},
};

leagues = {
	community: {
		name: "Community",
		permanent: true,
		hardcore: false,
		ssf: false,
	},
	ptr: {
		name: "PTR",
		permanent: true,
		ptr: true,
		hardcore: false,
		ssf: false,
	},
};

module.exports = {
	project_name: "adventureland",
	name: "Adventure Land Community",
	base_url: base_url,
	https_mode: https_mode,
	Dev: false,
	Local: false,
	Prod: true,
	Staging: false,
	Engine: "mongodb",
	observer_map: "main",
	merchant_map: "main",
	port: 8090,
	close_timeout: 4000,
	ip_limit: 32,
	character_limit: 32,
	signup_ip_limit: 4,
	allow_web_signup: true,
	fast_sdk: 0,
	default_league: "community",
	payments_enabled: false,
	community_host: true,
	official_game_url: "https://adventure.land",
	operator_email: process.env.COMMUNITY_OPERATOR_EMAIL || "",
	machines: machines,
	servers: servers,
	leagues: leagues,
	cookie_key: "auth",
	unsecure_admin: false,
	offline_alert_email: process.env.COMMUNITY_ALERT_EMAIL || "",
	discord_url: process.env.COMMUNITY_DISCORD_URL || "",
	discord: { enabled: false },
	mode: {
		drm_check: 0,
		notverified_debuff: 0,
	},
};
