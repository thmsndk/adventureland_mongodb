/**
 * Monaco player CODE pack — ambient libs embedded in `js/monaco/types/bundle.js`.
 *
 * Packs: types/shared + types/monaco + selected client frame types.
 * Never packs types/server.
 */
module.exports = {
	sharedDir: "types/shared",
	monacoDir: "types/monaco",
	/** Extra .d.ts files (relative to repo root) included in the Monaco bundle. */
	extraFiles: ["types/client/parent-window.d.ts"],
};
