/**
 * /comm observe ALUI entry — page profile already set before config.js loads.
 * Loads observe widgets; play-only CD/XP stay off this page.
 */
(function (global) {
	global.ALUI = global.ALUI || {};
	global.ALUI_PAGE = global.ALUI_PAGE || "observe";
})(typeof window !== "undefined" ? window : global);
