module.exports = {
	// Always visible at the bottom of the offline Tauri loader. Named parameters: {support_email}.
	"desktop.support": "For any issues, email: {support_email}",
	// The native Tauri loading window, before the remote game page opens.
	"desktop.loading": "LOADING",
	// Native loader after a long connection delay. Keep Adventure Land unchanged. Named parameters: {support_email}.
	"desktop.connection_help": "Adventure Land needs an internet connection. Check your connection and try reloading. If it still won't load, email {support_email}.",
	// A small apology when the native loading screen has waited even longer.
	"desktop.apology": "Sorry about the wait :)",
	// Native Tauri confirmation shown when the player closes the game window. Keep Adventure Land unchanged.
	"desktop.close_confirmation": "Are you sure you want to close Adventure Land?",
	// Native Tauri loader after 30 seconds. Compatibility mode uses the Cloudflare route for this app session only.
	"desktop.compatibility_help": "You may have an internet or ISP problem. If your ISP is the problem, compatibility mode may help. Would you like to use it for this session?",
	// The single confirmation button beneath desktop.compatibility_help.
	"desktop.compatibility_yes": "Yes",
	// Native loader after 60 seconds total, if compatibility mode is active. Keep VPN/Steam and match pages.steam_signup.title. Named parameters: {support_email}, {base_url}.
	"desktop.compatibility_retry": "Please try reloading the game. Check your connection and whether your ISP is blocking it. Try a VPN if you have one, or contact {support_email}. You can also play in your browser: open {base_url} and choose “Sign Up with Steam”.",
};
