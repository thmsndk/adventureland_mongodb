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
		address: "localhost:7192",
		internal_address: "gameserver:7192",
		machine: "docker",
		db: "dev",
		secure: false,
		nginx: false,
		Dev: false,
	},
};

module.exports = {
	project_name: "adventureland",
	name: "Adventure Land",
	base_url: "http://localhost:8090",
	https_mode: false,
	Dev: false,
	Local: false,
	Prod: false,
	Staging: false,
	Engine: "mongodb",
	observer_map: "main",
	merchant_map: "main",
	port: 8090,
	close_timeout: 4000,
	ip_limit: 32,
	character_limit: 32,
	signup_ip_limit: 0,
	allow_web_signup: true,
	fast_sdk: 0,
	machines: machines,
	servers: servers,
	cookie_key: "auth",
	unsecure_admin: false,
	offline_alert_email: "",
	discord_url: "https://discord.gg/44yUVeU",
	discord: { enabled: false },
	// google_analytics_id: "", // optional; unset/empty = no GA (never defaults to adventure.land)
	mode: {
		drm_check: 0,
		notverified_debuff: 0,
	},
};
