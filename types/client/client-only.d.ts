/**
 * Client-only markers for VS Code when editing `js/` (not for node/server).
 * Game-frame `parent`/`Window` fields: {@link parent-window.d.ts}.
 */

interface AdventureLandClientOnly {
	/** Set when running inside the game iframe / parent frame tooling. */
	__al_client?: true;
}
