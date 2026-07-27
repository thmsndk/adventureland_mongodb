var fs = require("fs");
var path = require("path");

/** Load order matches Python config.py / main.js (dependencies first). */
var DESIGN_FILES = [
	"projectiles.js",
	"animations.js",
	"achievements.js",
	"game_design.js",
	"games.js",
	"conditions.js",
	"sprites.js",
	"dimensions.js",
	"monsters.js",
	"maps.js",
	"npcs.js",
	"multipliers.js",
	"items.js",
	"classes.js",
	"levels.js",
	"upgrades.js",
	"drops.js",
	"skills.js",
	"events.js",
	"recipes.js",
	"titles.js",
	"tokens.js",
	"cosmetics.js",
	"emotions.js",
	"precomputed_images.js",
];

function design_root() {
	if (process.env.DESIGN_PATH) return path.resolve(process.env.DESIGN_PATH);
	return path.resolve(__dirname, "design");
}

function load_design_files(root) {
	var dir = root || design_root();
	for (var design_i = 0; design_i < DESIGN_FILES.length; design_i++) {
		var file = path.join(dir, DESIGN_FILES[design_i]);
		eval("" + fs.readFileSync(file));
	}
	return dir;
}

module.exports = { DESIGN_FILES, design_root, load_design_files };
