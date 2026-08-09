/**
 * CODE / runner globals for Monaco and client VS Code (not included in node/server jsconfig).
 */

/**
 * Your character — a proxy over `parent.character`.
 *
 * In CODE, `character.x` / `character.y` are already precise coords
 * (aliased to `real_x` / `real_y`); assigning them is blocked — use {@link move}.
 *
 * @example
 * game_log(character.name + " HP " + character.hp + "/" + character.max_hp);
 * if (character.rip) { setTimeout(respawn, 15000); return; }
 * if (character.mp < 200) use_skill("use_mp");
 * show_json(character.slots);
 * show_json(character.items);
 */
declare const character: Character;

/**
 * Nearby entities keyed by id (monsters, players, NPCs in your viewport).
 *
 * Prefer `parent.entities` or helpers like {@link get_nearest_monster} /
 * {@link get_entity}. A bare `entities` global is not always defined.
 *
 * @example
 * for (const id in parent.entities) {
 *   const e = parent.entities[id];
 *   if (e.type === "monster") game_log(e.mtype);
 * }
 */
declare const entities: { [id: string]: Entity };

/**
 * When `true` (default), some helpers throttle bursty socket traffic that can
 * disconnect you (e.g. {@link say}, {@link loot}, {@link use_hp_or_mp}).
 * Unrelated to {@link safe_log}, which always HTML-escapes.
 *
 * @example
 * safeties = false; // advanced — you must rate-limit yourself
 */
declare const safeties: boolean;

/**
 * Client / runtime info.
 * @example
 * if (!game.graphics) return; // headless / no PIXI
 * if (game.html) game_log("Running inside CODE iframe");
 */
declare const game: GameInfo;

/**
 * Current server (`region`, `id`, `pvp`, …).
 * Use {@link in_pvp} for map+server PVP checks.
 * @example
 * game_log(server.region + " " + server.id);
 */
declare const server: ServerInfo;

/**
 * PIXI namespace from the game frame (`parent.PIXI`) for custom drawings.
 * Prefer {@link draw_line} / {@link draw_circle} unless you need raw Graphics.
 * @example
 * const g = new PIXI.Graphics();
 */
declare const PIXI: PIXINamespace;

/**
 * Active CODE drawings (`parent.drawings`) — clear with {@link clear_drawings}.
 * @example
 * clear_drawings();
 * draw_circle(character.x, character.y, character.range);
 */
declare let drawings: PIXIGraphics[];

/**
 * CODE UI buttons registered via {@link add_top_button} / {@link add_bottom_button}.
 * @example
 * add_bottom_button("loot", "LOOT", () => loot());
 * set_button_color("loot", "#67D74C");
 */
declare const buttons: { [id: string]: CodeButton };

/**
 * Live {@link smart_move} state. Check `smart.moving` before starting a new path.
 * @example
 * if (!smart.moving) smart_move("goo");
 * if (smart.moving) stop(); // cancel path + movement
 * game_log(smart.map + " " + smart.x + "," + smart.y);
 */
declare const smart: SmartState;

/**
 * Static game data (`parent.G`).
 * @example
 * show_json(G.monsters.goo);
 * const atk = G.items.blade.attack;
 */
declare const G: GCatalog;
