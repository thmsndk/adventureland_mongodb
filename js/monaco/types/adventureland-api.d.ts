/**
 * AdventureLand CODE API functions (IDE only).
 * Entity / filter types live in adventureland-core.d.ts.
 */

/** Named shortcuts accepted by {@link smart_move} (in addition to maps / monsters / NPCs). */
type SmartMoveShortcut = "town" | "upgrade" | "compound" | "exchange" | "potions" | "scrolls";

/** Destinations accepted by {@link smart_move}. */
type SmartMoveDestination =
	MapKey | MonsterKey | NpcKey | SmartMoveShortcut | EventKey | string | { x: number; y: number; map?: MapKey } | { to: SmartMoveDestination; map?: MapKey; return?: boolean };

/**
 * Load another character into CODE mode (iframe runner).
 * @param name Character name on this account.
 * @param code_slot_or_name Optional slot number or code name to run.
 * @returns Promise from the parent runner starter.
 */
declare function start_character(name: string, code_slot_or_name?: string | number): any;
/** Stop a character previously started with {@link start_character}. */
declare function stop_character(name: string): void;
/**
 * Evaluate a CODE snippet on another active character.
 * @param name Target character name.
 * @param code_snippet JavaScript source to run there.
 */
declare function command_character(name: string, code_snippet: string): void;
/**
 * Map of active multi-characters → state string.
 * States include `"self"`, `"starting"`, `"loading"`, `"active"`, `"code"`.
 */
declare function get_active_characters(): { [name: string]: string };
/**
 * Switch servers by navigating to the character URL (full reload).
 * @param region e.g. `"EU"`, `"US"`, `"ASIA"`.
 * @param name Server name, e.g. `"I"`, `"II"`, `"PVP"`.
 * @example
 * change_server("EU", "I");
 */
declare function change_server(region: ServerRegion | string, name: ServerIdentifier | string): void;
/**
 * `true` if the current map or this server is PVP
 * (`G.maps[character.map].pvp || server.pvp`).
 */
declare function in_pvp(): boolean;
/**
 * Type guard: `entity` is an NPC (`entity.npc` or `type === "npc"`).
 * Runtime may return a truthy value or `undefined` (not strictly `false`).
 */
declare function is_npc(entity: Entity): entity is NpcEntity;
/**
 * Type guard: `entity.type === "monster"`.
 * Runtime may return a truthy value or `undefined` (not strictly `false`).
 */
declare function is_monster(entity: Entity): entity is MonsterEntity;
/**
 * Type guard: player character (`type === "character"` and not NPC).
 * Runtime may return a truthy value or `undefined` (not strictly `false`).
 */
declare function is_character(entity: Entity): entity is CharacterEntity;
/**
 * Interact with a named NPC or object.
 * Currently only `"monsterhunt"` is implemented in CODE helpers.
 * @param name NPC / interactable id (e.g. `"monsterhunt"`).
 * @returns Deferred result, or `undefined` for unimplemented names.
 */
declare function interact(name: string): any;
/**
 * Use the nearest door/transporter on this map (within ~100px).
 * @returns {@link transport} promise, or a rejected distance promise.
 */
declare function use_nearest_door(): any;
/**
 * Enter a place or dungeon instance.
 * @param place Destination id (e.g. `"crypt"`, `"duelland"`).
 * @param name Optional instance / inviter name.
 */
declare function enter(place: string, name?: string): any;
/**
 * Join a server event or instance (see `G.events`).
 * @param event Event id.
 */
declare function join(event: EventKey | string): any;
/**
 * Activate an inventory item by slot index (e.g. a booster).
 * @param num Inventory index.
 */
declare function activate(num: number): any;
/**
 * Shift a booster-like item in inventory to another mode.
 * @param num Inventory index.
 * @param name Target mode id (e.g. `"xpbooster"`, `"luckbooster"`).
 * @example
 * shift(0, "xpbooster");
 */
declare function shift(num: number, name: string): any;
/**
 * Throw an inventory item toward a map position (items with `"throw": true`).
 * @param num Inventory index.
 */
declare function throw_item(num: number, x: number, y: number): any;
/**
 * `true` if a skill is allowed for your class and not on cooldown.
 * @param name Skill id (see `G.skills`).
 */
declare function can_use(name: SkillKey): boolean;
/**
 * Use a skill by name (delegates to {@link use_skill}).
 * @param name Skill id.
 * @param target Optional entity or id.
 */
declare function use(name: SkillKey, target?: any): any;
/**
 * Equip / activate an inventory slot (delegates toward {@link equip}).
 * @param inventory_slot Inventory index.
 */
declare function use(inventory_slot: number): any;
/**
 * Use a skill by name (see `G.skills`).
 * If `target` is omitted, uses {@link get_target}.
 * Special cases include blink `[x,y]`, multi-shot arrays, throw + inventory slot, energize + mp.
 * @param name Skill id (e.g. `"attack"`, `"burst"`, `"use_hp"`).
 * @param target Optional entity, id, coordinate array, or target list depending on the skill.
 * @param extra_arg Skill-specific extra (e.g. inventory slot for `"throw"`, mp for `"energize"`).
 * @returns Promise (or an array of Promises for multi-target skills).
 * @example
 * use_skill("attack");
 * use_skill("burst", target);
 * use_skill("blink", [character.x, character.y - 50]);
 */
declare function use_skill(name: SkillKey, target?: any, extra_arg?: any): any;
/**
 * Reduce a skill's remaining cooldown by adjusting `parent.next_skill`.
 * Useful after an attack to compensate for ping.
 * @param name Skill id.
 * @param ms Milliseconds to subtract.
 * @example
 * attack(target).then(function () {
 *   reduce_cooldown("attack", character.ping * 0.95);
 * });
 */
declare function reduce_cooldown(name: SkillKey, ms: number): void;
/**
 * Deposit gold into the bank. Requires `character.bank` (must be inside the bank).
 * @returns Deferred result, or rejected `{ reason: "not_in_bank" }`.
 */
declare function bank_deposit(gold: number): any;
/**
 * Withdraw gold from the bank. Requires `character.bank`.
 * @returns Deferred result, or rejected `{ reason: "not_in_bank" }`.
 */
declare function bank_withdraw(gold: number): any;
/**
 * Store an inventory item into a bank pack.
 * Omit `pack` / `pack_num` to auto-pick a stackable or empty slot (`pack_num` defaults to `-1`).
 * @param num Inventory index.
 * @param pack Pack id (`"items0"`, `"items1"`, …).
 * @param pack_num Slot inside the pack (`-1` = first free).
 * @returns Deferred result, or rejected {@link BankFailure} (e.g. `{ reason: "not_in_bank" }`).
 */
declare function bank_store(num: number, pack?: BankPackType, pack_num?: number): any;
/**
 * Move an item from a bank pack into inventory.
 * @param pack Pack id.
 * @param pack_num Slot inside the pack.
 * @param num Optional inventory destination index (`-1` = first free).
 * @returns Deferred result, or rejected {@link BankFailure}.
 */
declare function bank_retrieve(pack: BankPackType, pack_num: number, num?: number): any;
/** Swap two slots inside a bank pack. */
declare function bank_swap(pack: BankPackType, a: number, b: number): any;
/** Swap / move two inventory indices (`imove`). */
declare function swap(a: number, b: number): any;
/**
 * First inventory index of an item name.
 * @returns Index, or `-1` if not found.
 */
declare function locate_item(name: ItemKey): number;
/**
 * Total quantity of an item across inventory stacks (`q` or `1` per slot).
 * @param name Item id.
 */
declare function quantity(name: ItemKey): number;
/**
 * Resolved combat/stat properties for an item instance.
 * @returns Properties object, or `null` if `item` / `item.name` is missing.
 */
declare function item_properties(item: ItemInfo): any;
/**
 * Item grade / rarity number (0 normal … higher for high-level upgrade/compound gear).
 * Pass an item object with `.name` (and optional `.level`).
 * @returns Grade number, or `-1` if invalid.
 */
declare function item_grade(item: ItemInfo): number;
/**
 * Estimated gold value of an item instance.
 * Pass an item object with `.name` (gift items return `1`).
 * @returns Estimated value, or `0` if invalid.
 */
declare function item_value(item: ItemInfo): number;
/**
 * Transport to a map / spawn. May wait while `in_progress` (e.g. bank entry).
 * @param map Map id.
 * @param spawn Optional spawn index on that map.
 */
declare function transport(map: MapKey, spawn?: number): any;
/** Leave the current instance / event map (`"leave"`). */
declare function leave(): any;
/**
 * `true` if the **graphics** client is paused (`parent.paused`).
 * This is not a CODE-execution pause flag.
 */
declare function is_paused(): boolean;
/**
 * Toggle the game **graphics** pause UI (`parent.pause()`).
 * Does not pause your CODE intervals by itself.
 */
declare function pause(): void;
/** Underlying game socket (advanced). */
declare function get_socket(): any;
/**
 * Current map **definition object** (`G.maps[current_map]`), not the map id string.
 * Use `character.map` for the map id.
 */
declare function get_map(): any;
/**
 * Set the small status message drawn for this CODE character.
 * @param text Message text.
 * @param color Optional CSS color (wrapped in a span).
 */
declare function set_message(text: string, color?: string): void;
/**
 * Write a line to the in-game log.
 * On Electron, routes through {@link safe_log} unless a third internal flag is set.
 * @param message Value to print.
 * @param color Optional CSS color (default `#51D2E1`).
 */
declare function game_log(message: any, color?: string): void;
/**
 * Alias for {@link game_log}; objects are JSON.stringified first.
 */
declare function log(message: any, color?: string): void;
/**
 * Like {@link game_log}, but HTML-escapes the message (safe for untrusted CM/chat data).
 * Always escapes; unrelated to the {@link safeties} flag.
 */
declare function safe_log(message: any, color?: string): void;
/**
 * Secondary focus target (`parent.xtarget`) if still visible; else `null`.
 */
declare function get_focus(): Entity | null;
/**
 * Who `entity` is targeting, if that target is still visible / is you.
 * Resolves monster targets by name and player targets by id.
 * @param entity Source entity.
 */
declare function get_target_of(entity: Entity): Entity | null;
/**
 * Your current target (`ctarget`, else `xtarget`) if still visible.
 * @returns The target entity, or `null`.
 */
declare function get_target(): Entity | null;
/**
 * Your current target **only if** it is a living monster (`!dead`).
 * Returns `null` when you have no monster target (players / missing).
 *
 * @returns The targeted monster, or `null`.
 * @example
 * let target = get_targeted_monster();
 * if (!target) target = get_nearest_monster({ min_xp: 100 });
 */
declare function get_targeted_monster(): MonsterEntity | null;
/**
 * Set or clear your current target (assigns `parent.ctarget` and may emit `"target"`).
 * Pass an entity object or `null` — not a string id.
 * @param target Entity to target, or `null` to clear.
 */
declare function change_target(target: Entity | null): void;
/**
 * `true` if you can walk in a straight line to `(x, y)`.
 * @param x Map x.
 * @param y Map y.
 */
declare function can_move_to(x: number, y: number): boolean;
/**
 * `true` if you can walk in a straight line to an entity's `real_x`/`real_y` (or `x`/`y`).
 * @param entity Entity or point object.
 */
declare function can_move_to(entity: Entity | { real_x?: number; real_y?: number; x?: number; y?: number }): boolean;
/**
 * Move if {@link can_move_to}, otherwise {@link smart_move} toward the point.
 * @param x Destination x.
 * @param y Destination y.
 */
declare function xmove(x: number, y: number): any;
/**
 * `true` if `target` is visible and within range for an attack or skill.
 * Skills with absolute `G.skills[skill].range` use that; otherwise
 * `character.range * range_multiplier + range_bonus`.
 * @param target Entity to check.
 * @param skill Optional skill id (`"attack"`, `"heal"`, `"mentalburst"`, …).
 */
declare function is_in_range(target: Entity, skill?: SkillKey): boolean;
/**
 * `true` if the skill (or its shared cooldown group) is still on cooldown.
 * @param skill Skill id.
 */
declare function is_on_cooldown(skill: SkillKey): boolean;
/**
 * `true` if you can attack `target` now (not disabled, in range, attack ready).
 * Does not check monster-specific attack range bonuses beyond {@link is_in_range}.
 * @param target Monster or player entity.
 */
declare function can_attack(target: Entity): boolean;
/**
 * `true` if you can heal `target` now (same readiness as attack; false for monsters).
 * @param target Friendly entity.
 */
declare function can_heal(target: Entity): boolean;
/**
 * `true` if the entity is moving, or (for you) if `smart.moving`.
 */
declare function is_moving(entity: Entity): boolean;
/**
 * `true` if the entity is mid-town transport, or (for you) `parent.transporting`.
 */
declare function is_transporting(entity: Entity): boolean;
/**
 * Attack a monster or player entity.
 * Remaps the CODE `character` proxy to `parent.character` when needed.
 * @param target Entity to attack (must be an object with `.type` / `.id`).
 * @returns Promise/deferred from the server call when available.
 * @example
 * if (can_attack(target)) await attack(target);
 */
declare function attack(target: Entity): Promise<any> | any;
/**
 * Heal a friendly target entity.
 * @param target Entity to heal (object; use `character` to heal yourself).
 */
declare function heal(target: Entity): Promise<any> | any;
/**
 * Buy from an NPC shop.
 * @param name Item id.
 * @param quantity Stack size (default 1).
 */
declare function buy(name: ItemKey, quantity?: number): any;
/** Buy using gold specifically. */
declare function buy_with_gold(name: ItemKey, quantity?: number): any;
/** Buy using shells / special currency (may return `in_progress`). */
declare function buy_with_shells(name: ItemKey, quantity?: number): any;
/**
 * Sell an inventory slot.
 * @param num Inventory index.
 * @param quantity Optional count for stacks.
 */
declare function sell(num: number, quantity?: number): any;
/** Consume / use an inventory item by index (`equip` with `consume: true`). */
declare function consume(num: number): any;
/**
 * Equip an inventory item.
 * @param num Inventory index (`>= 0`).
 * @param slot Optional equipment slot name.
 */
declare function equip(num: number, slot?: SlotType): any;
/**
 * Equip several items in one batch call (max 15; each entry needs `num >= 0`).
 * @param data Array of `{ num, slot? }` objects.
 */
declare function equip_batch(data: any[]): any;
/**
 * Unequip a named gear slot.
 * @param slot e.g. `"helmet"`, `"mainhand"` (see `character.slots`).
 */
declare function unequip(slot: SlotType): any;
/** Lock an inventory item so it cannot be sold/upgraded by mistake. */
declare function lock_item(num: number): any;
/** Seal an item (cannot unlock for ~2 days). */
declare function seal_item(num: number): any;
/**
 * Unlock a previously locked inventory item.
 * Sealed items may return `{ hours, success: false, in_progress: true }`.
 */
declare function unlock_item(num: number): any;
/**
 * Open a merchant stand.
 * @param num Optional stand item inventory index (auto-detected if omitted).
 */
declare function open_stand(num?: number): any;
/** Close your merchant stand. */
declare function close_stand(): any;
/**
 * List an inventory item on a trade slot (coerces `1` → `"trade1"`).
 * @param num Inventory index.
 * @param trade_slot Trade slot name or number (`1`–`16`).
 * @param price Price in gold.
 * @param quantity Optional stack size (default 1).
 */
declare function trade(num: number, trade_slot: TradeSlotType | number, price: number, quantity?: number): any;
/**
 * Buy from another player's trade slot (uses that slot's `.rid`).
 * @param target Player entity.
 */
declare function trade_buy(target: Entity, trade_slot: TradeSlotType | number, quantity?: number): any;
/**
 * Sell into another player's wishlist / buy offer (uses that slot's `.rid`).
 * @param target Player entity.
 */
declare function trade_sell(target: Entity, trade_slot: TradeSlotType | number, quantity?: number): any;
/**
 * Post a wishlist buy offer on a trade slot.
 * @param trade_slot Trade slot name or number.
 * @param name Item id to buy.
 * @param price Offer price.
 * @param level Optional required item level.
 * @param quantity Optional count (default 1).
 */
declare function wishlist(trade_slot: TradeSlotType | number, name: ItemKey, price: number, level?: number, quantity?: number): any;
/**
 * Start an item giveaway on a trade slot.
 * @example
 * giveaway("trade1", 0, 12, 20);
 */
declare function giveaway(slot: TradeSlotType | number, num: number, q: number, minutes: number): any;
/**
 * Join someone else's giveaway (needs that listing's `.rid`).
 * @example
 * join_giveaway("Name", "trade1", get_player("Name").slots.trade1.rid);
 */
declare function join_giveaway(name: string, slot: TradeSlotType | number, rid: string): any;
/**
 * Upgrade an item with a scroll.
 * @param item_num Inventory index of the item.
 * @param scroll_num Inventory index of the upgrade scroll.
 * @param offering_num Optional offering item index.
 * @param only_calculate If true, only compute chance / cost.
 */
declare function upgrade(item_num: number, scroll_num: number, offering_num?: number, only_calculate?: boolean): any;
/**
 * Compound three matching items with a scroll.
 * @param item0 First inventory index.
 * @param item1 Second inventory index.
 * @param item2 Third inventory index.
 * @param scroll_num Compound scroll index.
 * @param offering_num Optional offering index.
 * @param only_calculate If true, only compute chance / cost.
 */
declare function compound(item0: number, item1: number, item2: number, scroll_num: number, offering_num?: number, only_calculate?: boolean): any;
/**
 * Craft using up to nine craft-grid inventory slots (`null` for empty cells).
 * Positions map to the 3×3 crafting UI.
 * @example
 * craft(null, 0, null, null, 1, null, null, 2, null);
 */
declare function craft(
	i0?: number | null,
	i1?: number | null,
	i2?: number | null,
	i3?: number | null,
	i4?: number | null,
	i5?: number | null,
	i6?: number | null,
	i7?: number | null,
	i8?: number | null,
): any;
/**
 * Auto-craft a named recipe if materials are available.
 * @param name Recipe / item id (e.g. `"computer"`).
 */
declare function auto_craft(name: ItemKey): any;
/**
 * Exchange / open an exchangeable inventory item; waits for the exchange queue.
 * @returns `{ success, reward?, num? }` when finished.
 */
declare function exchange(item_num: number): any;
/**
 * Buy from an exchange shop listing.
 * @param token Token / shop currency id (e.g. `"funtoken"`).
 * @param name Item id to buy (e.g. `"confetti"`).
 */
declare function exchange_buy(token: ItemKey, name: ItemKey): any;
/** Say in local chat (respects {@link safeties}). */
declare function say(message: string): any;
/** Say in party chat (respects {@link safeties}). */
declare function party_say(message: string): any;
/**
 * Private-message a player (respects {@link safeties}).
 * @param name Player name.
 * @param message Message text.
 */
declare function pm(name: string, message: string): any;
/**
 * Walk toward a map position (direct move). Rejects if {@link can_walk} fails.
 * @param x Destination x.
 * @param y Destination y.
 */
declare function move(x: number, y: number): any;
/**
 * Cap movement speed (cruise control). Use a high value (e.g. `500`) to clear the cap.
 * @param speed Max speed to use.
 */
declare function cruise(speed: number): any;
/**
 * Pretty-print JSON in a UI window (debug).
 * @example
 * show_json(G.monsters.goo);
 * show_json(character.items);
 */
declare function show_json(json: any): void;
/** Characters on this account (`parent.X.characters`; infrequently updated). */
declare function get_characters(): any[];
/** Available servers list (`parent.X.servers`). */
declare function get_servers(): any[];
/**
 * Party members keyed by name (`parent.party`).
 * Inspect with `show_json(get_party())`. For the name list, see `parent.party_list`.
 */
declare function get_party(): { [name: string]: any };
/**
 * Nearby player by name (or yourself).
 * @returns Player entity, or `null`.
 */
declare function get_player(name: string): CharacterEntity | Character | null;
/**
 * Monster by entity id (within vision).
 * @returns Monster entity, or `null` if missing / not a monster.
 */
declare function get_monster(id: string): MonsterEntity | null;
/**
 * Any entity by id (or yourself when `id === character.name`).
 * @returns Entity, or `null` / undefined if missing.
 */
declare function get_entity(id: string): Entity | null;
/**
 * Locate an NPC id across maps (smart_move-friendly coords).
 * @returns `{ map, in, x, y }`, or `null`.
 */
declare function find_npc(npc_id: NpcKey): any;
/**
 * Closest visible living monster that matches the optional filters.
 * Filter fields are documented on {@link NearestMonsterFilter}.
 *
 * @param args Optional filters (`type`, `min_xp`, `max_att`, `no_target`, `path_check`, …).
 * @returns The nearest matching monster, or `null` if none match.
 *
 * @example
 * let target = get_nearest_monster({ min_xp: 100, max_att: 120 });
 *
 * @example
 * let bee = get_nearest_monster({ type: "bee", path_check: true });
 *
 * @example
 * if (!get_targeted_monster()) {
 *   change_target(get_nearest_monster({ no_target: true }));
 * }
 */
declare function get_nearest_monster(args?: NearestMonsterFilter): MonsterEntity | null;
/**
 * Closest **hostile player** (PVP helper) — not monsters.
 * Skips party/guild/team mates and (by default) friends.
 * For farming monsters use {@link get_nearest_monster} instead.
 *
 * @param args Optional filters — see {@link NearestHostileFilter}.
 * @returns Nearest hostile player, or `null` if none nearby.
 * @example
 * let foe = get_nearest_hostile();
 * let bee = get_nearest_monster({ type: "bee" });
 */
declare function get_nearest_hostile(args?: NearestHostileFilter): CharacterEntity | null;
/** Closest entity with `type === "npc"`. */
declare function get_nearest_npc(): NpcEntity | null;
/**
 * Use HP and/or MP potions as needed (priority: low MP, then low HP, then top-off).
 * Throttled when {@link safeties} is on; skipped while `use_hp` is on cooldown.
 * @returns Promise-like result (`used` / `reason` when skipped).
 */
declare function use_hp_or_mp(): any;
/**
 * Loot nearby chests (opens up to two per call with safety checks).
 * @returns Deferred/open-chest result, or a resolving “nothing to loot” / safety result.
 */
declare function loot(): any;
/**
 * Loot a specific chest by id.
 * @param chest_id Chest id from {@link get_chests}.
 */
declare function loot(chest_id: string): any;
/**
 * Loot via the commander path when `true`.
 * @param commander Pass `true` to use the commander loot path.
 */
declare function loot(commander: true): any;
/** Open chests currently on the map, keyed by id (`parent.chests`). */
declare function get_chests(): { [id: string]: any };
/**
 * Send gold to a player.
 * @param receiver Player name (or entity with `.name`).
 * @param gold Amount.
 */
declare function send_gold(receiver: string | Entity, gold: number): any;
/**
 * Send an inventory item (stack) to a player.
 * @param receiver Player name (or entity with `.name`).
 * @param num Inventory index.
 * @param quantity Optional count (default 1).
 */
declare function send_item(receiver: string | Entity, num: number, quantity?: number): any;
/**
 * Bank helpers reject when you are not inside the bank.
 * Successful calls resolve with server ack payloads; failures include `{ reason: "not_in_bank" | … }`.
 */
type BankFailure = { reason: string };
/**
 * Send a CODE message (CM) to one or more characters.
 * Uses local delivery when the target is local; otherwise server CM.
 * Received via {@link on_cm} / `character.on("cm", …)`.
 * @param to Name or list of names.
 * @param data JSON-serializable payload.
 */
declare function send_cm(to: string | string[], data: any): any;
/**
 * **Override hook** — called when a CM arrives (wired from `character.on("cm")`).
 * @param from Sender character name.
 * @param data Payload message.
 */
declare function on_cm(from: string, data: any): void;
/** Respawn after death (server cooldown applies; wait ~15s in practice). */
declare function respawn(): any;
/**
 * **Override hook** — called when your character dies (`character.on("death")`).
 * Define in your CODE to auto-respawn or run recovery logic.
 */
declare function handle_death(): void;
/**
 * **Override hook** — handle custom chat commands (`/command …`).
 * Return anything other than `-1` to consume the command.
 * @param command Command name without prefix.
 * @param args Remainder of the line.
 */
declare function handle_command(command: string, args?: string): void;
/** **Override hook** — party invite received from `name`. */
declare function on_party_invite(name: string): void;
/** **Override hook** — party request received from `name`. */
declare function on_party_request(name: string): void;
/** **Override hook** — CODE context is being destroyed (clears drawings/buttons by default). */
declare function on_destroy(): void;
/**
 * **Override hook** — called each draw frame (up to ~60/s).
 * Keep this light; heavy work belongs in your main loop / intervals.
 */
declare function on_draw(): void;
/**
 * **Override hook** — server game / world events.
 * Called with a single event object (e.g. `{ name: "pinkgoo", … }`).
 * @param data Event payload (`data.name` identifies the event).
 * @example
 * function on_game_event(data) {
 *   if (data.name == "goblin") game_log("Sneaky Goblin!");
 * }
 */
declare function on_game_event(data: any): void;
/**
 * Invite a player to your party (name, id, or player object).
 * @param name Player name or entity.
 */
declare function send_party_invite(name: string | Entity): any;
/** Request to join someone's party. */
declare function send_party_request(name: string): any;
/** Accept a party invite. */
declare function accept_party_invite(name: string): any;
/** Accept a party request. */
declare function accept_party_request(name: string): any;
/** Leave your current party. */
declare function leave_party(): any;
/** Kick a member from your party (leader). */
declare function kick_party_member(name: string): any;
/** Accept an incoming magiport from `name`. */
declare function accept_magiport(name: string): any;
/**
 * Bind a keyboard key to a skill or CODE snippet.
 * @param key Key name (e.g. `"1"`, `"ESC"`).
 * @param skill Skill id, or mapping object.
 * @param code Optional CODE snippet for `"snippet"`-style bindings.
 * @example
 * map_key("1", "use_hp");
 * map_key("2", "snippet", "say('OMG')");
 */
declare function map_key(key: string, skill: string | object, code?: string): void;
/** Remove a key binding created with {@link map_key}. */
declare function unmap_key(key: string): void;
/**
 * Load another code slot/snippet into this CODE context (top-level / global scope).
 * @param name Slot number or code name.
 * @param onerror Optional error handler.
 */
declare function load_code(name: string | number, onerror?: any): void;
/**
 * Require / evaluate another code slot in its own scope and return `module.exports`.
 * @param name Slot number or code name.
 */
declare function require_code(name: string | number): any;
/**
 * Pathfind / travel to a destination (map, monster type, coords, NPC id, shortcuts, …).
 * Runs asynchronously; returns a Promise. Interrupts a prior smart_move.
 *
 * Resolves with `{ success: true }`. Rejects with `{ reason }` (e.g. `"invalid"`, `"interrupted"`, `"failed"`).
 *
 * @param dest Destination string, monster type, shortcut (`"town"`, `"upgrade"`, …), or `{ x, y, map? }` / `{ to }` object.
 * @param on_done Optional callback `(done, reason?)` when finished.
 * @returns Promise resolving to {@link SmartMoveSuccess} (also supports the legacy `on_done` callback).
 * @example
 * smart_move("main");
 * smart_move("goo");
 * smart_move("upgrade");
 * smart_move({ x: 0, y: 0, map: "main" }, () => game_log("arrived"));
 */
declare function smart_move(dest: SmartMoveDestination, on_done?: (done: boolean, reason?: string) => void): Promise<SmartMoveSuccess>;
/**
 * Stop movement or a named action.
 * Omit / `"move"` cancels smart movement and issues a stay-put move.
 * `"smart"` cancels pathfinding only. Also supports `"town"` / `"teleport"` / `"invis"` / `"revival"`.
 * @param action Optional action id.
 */
declare function stop(action?: string): any;
/**
 * Distance between two entities or points (hitbox-aware; large value if different map/`in`).
 * @param a First entity or `{x,y}` / `{real_x,real_y}`.
 * @param b Second entity or point.
 */
declare function distance(a: Entity | { x: number; y: number }, b: Entity | { x: number; y: number }): number;
/**
 * `true` if the entity can walk (not dashing / mid-transport / disabled).
 * @param entity Entity to inspect (typically `character`).
 */
declare function can_walk(entity: Entity): boolean;
/**
 * `true` if the entity is crowd-controlled / disabled
 * (`rip`, stunned, fingered, stoned, deepfreezed, sleeping).
 * Returns a truthy value or `undefined`.
 * @param entity Entity to inspect.
 */
declare function is_disabled(entity: Entity): boolean;
/**
 * Read a value from persistent CODE storage (`localStorage` key `cstore_*`).
 * @param name Storage key.
 * @returns Parsed value, or `null` on failure / missing.
 */
declare function get(name: string): any;
/**
 * Write a value to persistent CODE storage (JSON-serializable).
 * @param name Storage key.
 * @param value JSON-serializable value.
 * @returns `true` on success, `false` on failure.
 */
declare function set(name: string, value: any): boolean;
