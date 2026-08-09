/**
 * Client-frame helpers beyond {@link parent-window.d.ts} (js/ only, not node/server).
 * Monaco already packs parent-window; these stay VS Code client IntelliSense extras
 * unless added to types/monaco/manifest.js `extraFiles`.
 */

/** Common client UI / NPC panel mode flags used across html.js / game.js. */
interface AdventureLandClientUiState {
	/** Active left NPC / panel mode (e.g. `"recipes"`, merchant ids). */
	topleft_npc?: string | null;
	/** Recipe browser page indexes by category. */
	r_page?: { [category: string]: number };
}
