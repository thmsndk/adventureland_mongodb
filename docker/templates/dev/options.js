machines = {
	local: {
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
		msgpack_path: "/socket.io-msgpack/",
		api_path: "/server.api/",
		local_ip: "0.0.0.0",
		local_port: 7192,
		address: process.env.GS_PUBLIC || "localhost:7192",
		internal_address: "gameserver:7192",
		// Plain HTTP inside the compose network; TLS terminates at Traefik for `address`.
		internal_protocol: "http",
		machine: "local",
		db: "dev",
		secure: process.env.HTTPS_MODE === "1",
		nginx: false,
		Dev: true,
	},
};

module.exports = {
	project_name: "adventureland",
	name: "Adventure Land",
	base_url: process.env.BASE_URL || "http://localhost:8090",
	https_mode: process.env.HTTPS_MODE === "1",
	behind_proxy: process.env.BEHIND_PROXY === "1",
	Dev: true,
	Local: true,
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
	unsecure_admin: true,
	offline_alert_email: "",
	discord_url: "",
	discord: { enabled: false, channels: { default: "", join: "" } },
	// Explicit clears / private overrides so official AL code defaults are not inherited.
	google_analytics_id: "",
	email_provider: "smtp",
	mail_from: "noreply@localhost",
	mail_reply_to: "noreply@localhost",
	support_email: "dev@localhost",
	steam_app_id: 0,
	google_site_verification: "",
	// Social / SEO meta (htmls/seo.html). Prefer seo_*; og_* remain aliases.
	// seo_origin defaults to the origin of base_url when omitted.
	seo_origin: "",
	seo_site_name: "",
	seo_title: "Adventure Land",
	seo_description: "A Casual Browser Based MMORPG Where You Can Even Code Your Character!",
	seo_image_url: "/images/first_logo.png",
	seo_image_alt: "",
	// Legacy aliases (still read when the matching seo_* key is empty):
	og_image: "/images/first_logo.png",
	og_title: "Adventure Land",
	og_description: "A Casual Browser Based MMORPG Where You Can Even Code Your Character!",
	ip_to_subdomain: {},
	mode: {
		drm_check: 0,
		notverified_debuff: 0,
		require_verified_rewards: 0,
	},
};
