// Fixed masters so backend + gameserver share auth across containers
module.exports = {
	server_keyword: "docker-dev-server-keyword",
	mongodb_uri: "mongodb://mongo:27017/adventureland?replicaSet=rs0",
	mongodb_name: "adventureland",
	mongodb_config: {},
	stripe_test_api_key: "",
	stripe_test_pkey: "",
	stripe_api_key: "",
	stripe_pkey: "",
	steam_web_apikey: "",
	steam_publisher_web_apikey: "",
	// Admin Steam sales dashboard (/admin) — partner financial reports (not the publisher key)
	steam_financial_web_apikey: "",
	sdk_password: "docker-dev-sdk-password",
	amazon_ses_user: process.env.AMAZON_SES_USER || "",
	amazon_ses_key: process.env.AMAZON_SES_KEY || "",
	amazon_ses_region: process.env.AMAZON_SES_REGION || "us-east-1",
	// Mailpit (docker-compose.dev.yml): SMTP 1025, UI http://localhost:8025
	smtp: {
		host: process.env.SMTP_HOST || "mailpit",
		port: parseInt(process.env.SMTP_PORT || "1025", 10),
		secure: false,
		user: process.env.SMTP_USER || "",
		pass: process.env.SMTP_PASS || "",
	},
	ACCESS_MASTER: "docker-dev-access-master-key00",
	BOT_MASTER: "docker-dev-bot-master-key0000",
	SERVER_MASTER: "docker-dev-server-master",
	discord_token: "",
	apple_token: "",
	steam_key: "",
};
