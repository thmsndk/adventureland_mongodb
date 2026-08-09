/**
 * AdventureLand CODE API — functions available in your character CODE (IDE only).
 *
 * Quick map:
 * - Combat: {@link attack}, {@link heal}, {@link use_skill}, {@link can_attack}, {@link get_nearest_monster}
 * - Move: {@link move}, {@link xmove}, {@link smart_move}, {@link town}, {@link transport}
 * - Items: {@link buy}, {@link sell}, {@link equip}, {@link upgrade}, {@link compound}, {@link loot}
 * - Bank: {@link bank_store}, {@link bank_retrieve}, {@link bank_deposit}, {@link bank_withdraw}
 * - Party / social: {@link send_party_invite}, {@link send_cm}, {@link say}, {@link pm}
 * - Inspect: {@link show_json}, {@link game_log}, `character`, `G`, `smart`
 *
 * Tip: type a name then hover / Ctrl+Space. Examples below are copy-pasteable.
 *
 * Entity / filter types live in adventureland-core.d.ts.
 */

/** Named shortcuts accepted by {@link smart_move} (in addition to maps / monsters / NPCs). */
type SmartMoveShortcut = "town" | "upgrade" | "compound" | "exchange" | "potions" | "scrolls";

/** Typical deferred result from {@link use_skill} / combat helpers. */
type SkillUseResult = BetterUX<HitData | CodeSuccess | CodeFailure>;

/** Destinations accepted by {@link smart_move}. */
type SmartMoveDestination =
	MapKey | MonsterKey | NpcKey | SmartMoveShortcut | EventKey | string | { x: number; y: number; map?: MapKey } | { to: SmartMoveDestination; map?: MapKey; return?: boolean };

/**
 * Load another character into CODE mode (iframe runner).
 * @param name Character name on this account.
 * @param code_slot_or_name Optional slot number or code name to run.
 * @returns Promise from the parent runner starter.
 * @example
 * start_character("Merchant", 1); // slot 1
 */
declare function start_character(name: string, code_slot_or_name?: string | number): void;
/** Stop a character previously started with {@link start_character}.
 * @example
 * stop_character("Merchant");
 */
declare function stop_character(name: string): void;
/**
 * Evaluate a CODE snippet on another active character.
 * @param name Target character name.
 * @param code_snippet JavaScript source to run there.
 
 * @example
 * command_character("Merchant", "smart_move('main')");
 */
declare function command_character(name: string, code_snippet: string): void;
/**
 * Map of active multi-characters → state string.
 * States include `"self"`, `"starting"`, `"loading"`, `"active"`, `"code"`.
 
 * @example
 * show_json(get_active_characters());
 */
declare function get_active_characters(): {
	[name: string]: "self" | "starting" | "loading" | "active" | "code" | string;
};
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
 
 * @example
 * if (in_pvp()) game_log("PVP zone");
 */
declare function in_pvp(): boolean;
/**
 * Type guard: `entity` is an NPC (`entity.npc` or `type === "npc"`).
 * Runtime may return a truthy value or `undefined` (not strictly `false`).
 
 * @example
 * if (is_npc(e)) game_log(e.name);
 */
declare function is_npc(entity: Entity): entity is NpcEntity;
/**
 * Type guard: `entity.type === "monster"`.
 * Runtime may return a truthy value or `undefined` (not strictly `false`).
 
 * @example
 * if (is_monster(e)) change_target(e);
 */
declare function is_monster(entity: Entity): entity is MonsterEntity;
/**
 * Type guard: player character (`type === "character"` and not NPC).
 * Runtime may return a truthy value or `undefined` (not strictly `false`).
 
 * @example
 * if (is_character(e) && e.name !== character.name) pm(e.name, "hi");
 */
declare function is_character(entity: Entity): entity is CharacterEntity;
/**
 * Interact with a named NPC or object.
 * Currently only `"monsterhunt"` is implemented in CODE helpers.
 * @param name NPC / interactable id (e.g. `"monsterhunt"`).
 * @returns Deferred result, or `undefined` for unimplemented names.
 
 * @example
 * interact("monsterhunt");
 */
declare function interact(name: string): Promise<BetterUX<{ success?: boolean; name?: string } | CodeFailure>>; /**
 * Use the nearest door/transporter on this map (within ~100px).
 * @returns {@link transport} promise, or a rejected distance promise.
 
 * @example
 * await use_nearest_door();
 */
declare function use_nearest_door(): Promise<BetterUX<{ success?: boolean } | CodeFailure>>; /**
 * Enter a place or dungeon instance.
 * @param place Destination id (e.g. `"crypt"`, `"duelland"`).
 * @param name Optional instance / inviter name.
 
 * @example
 * enter("crypt");
 */
declare function enter(place: string, name?: string): Promise<BetterUX<{ success?: boolean; place?: string } | CodeFailure>>; /**
 * Join a server event or instance (see `G.events`).
 * @param event Event id.
 
 * @example
 * join("goobrawl");
 */
declare function join(event: EventKey | string): Promise<BetterUX<{ success?: boolean; name?: string } | CodeFailure>>; /**
 * Activate an inventory item by slot index (e.g. a booster).
 * @param num Inventory index.
 
 * @example
 * activate(locate_item("xpbooster"));
 */
declare function activate(num: number): Promise<BetterUX<{ success?: boolean; num?: number } | CodeFailure>>; /**
 * Shift a booster-like item in inventory to another mode.
 * @param num Inventory index.
 * @param name Target mode id (e.g. `"xpbooster"`, `"luckbooster"`).
 * @example
 * shift(0, "xpbooster");
 */
declare function shift(num: number, name: BoosterKey): Promise<{ name: BoosterKey; success?: boolean } | CodeFailure>; /**
 * Throw an inventory item toward a map position (items with `"throw": true`).
 * @param num Inventory index.
 
 * @example
 * throw_item(0, character.x + 20, character.y);
 */
declare function throw_item(num: number, x: number, y: number): Promise<SkillUseResult>; /**
 * `true` if a skill is allowed for your class and not on cooldown.
 * @param name Skill id (see `G.skills`).
 * @example
 * if (can_use("attack") && can_attack(target)) attack(target);
 */
declare function can_use(name: SkillKey): boolean;
/**
 * Use a skill by name (see `G.skills` / `show_json(G.skills)`).
 * If `target` is omitted, uses {@link get_target}.
 *
 * @example
 * use_skill("attack");
 * use_skill("burst", target);
 * use_skill("use_hp");
 * use_skill("blink", [character.x, character.y - 50]);
 * use_skill("cburst", [[monster.id, 200], [monster2.id, 200]]);
 * use_skill("3shot", [m1, m2, m3]);
 * use_skill("throw", target, 0);
 * use_skill("energize", get_player("Friend"), 200);
 * use_skill("magiport", "FriendName");
 */
/** Controlled burst — each entry is `[target, mana]`. */
declare function use_skill(name: "cburst", targets: Array<[string | Entity | { id: string }, number]>): Promise<SkillUseResult>;
/** Teleport to map coordinates `[x, y]`. */
declare function use_skill(name: "blink", coords: XY): Promise<SkillUseResult>;
/** Offer magiport to a character (PVE may require {@link accept_magiport}). */
declare function use_skill(name: "magiport", target: string | CharacterEntity | Character | { id: string }): Promise<SkillUseResult>;
/** Auto-picks up to 3 targets in range when none supplied. */
declare function use_skill(name: "3shot"): Promise<SkillUseResult>;
declare function use_skill(name: "3shot", targets: Tuple<SkillTarget, 1> | Tuple<SkillTarget, 2> | Tuple<SkillTarget, 3> | Entity[]): Promise<SkillUseResult>;
/** Auto-picks up to 5 targets in range when none supplied. */
declare function use_skill(name: "5shot"): Promise<SkillUseResult>;
declare function use_skill(
	name: "5shot",
	targets: Tuple<SkillTarget, 1> | Tuple<SkillTarget, 2> | Tuple<SkillTarget, 3> | Tuple<SkillTarget, 4> | Tuple<SkillTarget, 5> | Entity[],
): Promise<SkillUseResult>;
/** Throw an inventory item at a target. */
declare function use_skill(name: "throw", target: Entity | SkillTarget, inventory_slot: number): Promise<SkillUseResult>;
/** Share MP with an ally (`mp` = mana to send). */
declare function use_skill(name: "energize", target: Entity | string, mp?: number): Promise<SkillUseResult>;
/** Skills that consume an inventory item and need a target. */
declare function use_skill(name: SkillKeyItemAndTarget, target: SkillTarget, inventory_slot?: number): Promise<SkillUseResult>;
/** Skills that only need an inventory item slot. */
declare function use_skill(name: SkillKeyItemNeeded, inventory_slot?: number): Promise<SkillUseResult>;
/** Self / no-target skills (potions, warcry, fishing, …). */
declare function use_skill(name: SkillKeyNoTarget): Promise<SkillUseResult>;
/** Single-target skills (`attack`, `burst`, `curse`, …). */
declare function use_skill(name: SkillKeyTargeted, target?: Entity | string | { id: string }): Promise<SkillUseResult>;
/** Catch-all overload for any {@link SkillKey}. */
declare function use_skill(name: SkillKey, target?: Entity | string | XY | Entity[] | unknown, extra_arg?: unknown): Promise<SkillUseResult>;
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
 * Deposit gold into the bank. Requires `character.bank` (stand inside the bank).
 * @example
 * if (character.bank) await bank_deposit(character.gold - 50000);
 */
declare function bank_deposit(gold: number): Promise<BetterUX<{ success?: boolean; gold?: number } | CodeFailure>>; /**
 * Withdraw gold from the bank. Requires `character.bank`.
 * @example
 * await bank_withdraw(1000000);
 */
declare function bank_withdraw(gold: number): Promise<BetterUX<{ success?: boolean; gold?: number } | CodeFailure>>; /**
 * Store an inventory item into a bank pack.
 * Omit `pack` / `pack_num` to auto-pick a stackable or empty slot (`pack_num` defaults to `-1`).
 * @param num Inventory index.
 * @param pack Pack id (`"items0"`, `"items1"`, …).
 * @param pack_num Slot inside the pack (`-1` = first free).
 * @returns Deferred result, or rejected {@link BankFailure} (e.g. `{ reason: "not_in_bank" }`).
 
 * @example
 * await bank_store(locate_item("shadowstone"));
 */
declare function bank_store(num: number, pack?: BankPackType, pack_num?: number): Promise<BetterUX<{ success?: boolean } | CodeFailure>>; /**
 * Move an item from a bank pack into inventory.
 * @param pack Pack id.
 * @param pack_num Slot inside the pack.
 * @param num Optional inventory destination index (`-1` = first free).
 * @returns Deferred result, or rejected {@link BankFailure}.
 
 * @example
 * await bank_retrieve("items0", 0);
 */
declare function bank_retrieve(pack: BankPackType, pack_num: number, num?: number): Promise<BetterUX<{ success?: boolean } | CodeFailure>>; /** Swap two slots inside a bank pack.
 * @example
 * await bank_swap("items0", 0, 1);
 */
declare function bank_swap(pack: BankPackType, a: number, b: number): Promise<BetterUX<{ success?: boolean } | CodeFailure>>; /** Swap / move two inventory indices (`imove`).
 * @example
 * swap(0, 1);
 */
declare function swap(a: number, b: number): Promise<unknown>; /**
 * First inventory index of an item name.
 * @returns Index, or `-1` if not found.
 
 * @example
 * const s = locate_item("hpot0");
 */
declare function locate_item(name: ItemKey): number;
/**
 * Total quantity of an item across inventory stacks (`q` or `1` per slot).
 * @param name Item id.
 
 * @example
 * if (quantity("hpot0") < 50) buy("hpot0", 100);
 */
declare function quantity(name: ItemKey): number;
/**
 * Resolved combat/stat properties for an item instance.
 * @returns Properties object, or `null` if `item` / `item.name` is missing.
 
 * @example
 * show_json(item_properties(character.items[0]));
 */
declare function item_properties(item: ItemInfo): ItemProperties | null;
/**
 * Item grade / rarity number (0 normal … higher for high-level upgrade/compound gear).
 * Pass an item object with `.name` (and optional `.level`).
 * @returns Grade number, or `-1` if invalid.
 
 * @example
 * game_log(item_grade(character.items[0]));
 */
declare function item_grade(item: ItemInfo | { name: ItemKey; level?: number }): -1 | 0 | 1 | 2 | 3 | 4;
/**
 * Estimated gold value of an item instance.
 * Pass an item object with `.name` (gift items return `1`).
 * @returns Estimated value, or `0` if invalid.
 
 * @example
 * game_log(item_value(character.items[0]));
 */
declare function item_value(item: ItemInfo): number;
/**
 * Transport to a map / spawn. May wait while `in_progress` (e.g. bank entry).
 * @param map Map id.
 * @param spawn Optional spawn index on that map.
 
 * @example
 * await transport("main", 0);
 */
declare function transport(map: MapKey, spawn?: number): Promise<BetterUX<{ success?: boolean; map?: MapKey } | CodeFailure>>; /** Leave the current instance / event map (`"leave"`).
 * @example
 * await leave();
 */
declare function leave(): Promise<BetterUX<{ success?: boolean } | CodeFailure>>; /**
 * `true` if the **graphics** client is paused (`parent.paused`).
 * This is not a CODE-execution pause flag.
 
 * @example
 * if (is_paused()) game_log("Graphics paused");
 */
declare function is_paused(): boolean;
/**
 * Toggle the game **graphics** pause UI (`parent.pause()`).
 * Does not pause your CODE intervals by itself.
 
 * @example
 * pause(); // toggles graphics pause
 */
declare function pause(): void;
/** Underlying game socket (advanced).
 * @example
 * const socket = get_socket();
 */
declare function get_socket(): GameSocket;
/**
 * Current map **definition object** (`G.maps[current_map]`), not the map id string.
 * Use `character.map` for the map id.
 
 * @example
 * show_json(get_map());
 */
declare function get_map(): GMap;
/**
 * Set the small status message drawn for this CODE character.
 * @param text Message text.
 * @param color Optional CSS color (wrapped in a span).
 
 * @example
 * set_message("Farming", "#FEFF9D");
 */
declare function set_message(text: string, color?: string): void;
/**
 * Write a line to the in-game log.
 * On Electron, routes through {@link safe_log} unless a third internal flag is set.
 * @param message Value to print.
 * @param color Optional CSS color (default `#51D2E1`).
 
 * @example
 * game_log("Hello", "#51D2E1");
 */
declare function game_log(message: unknown, color?: string): void;
/**
 * Alias for {@link game_log}; objects are JSON.stringified first.
 
 * @example
 * log({ hp: character.hp });
 */
declare function log(message: unknown, color?: string): void;
/**
 * Like {@link game_log}, but HTML-escapes the message (safe for untrusted CM/chat data).
 * Always escapes; unrelated to the {@link safeties} flag.
 
 * @example
 * safe_log("<b>escaped</b>");
 */
declare function safe_log(message: unknown, color?: string): void;
/**
 * Secondary focus target (`parent.xtarget`) if still visible; else `null`.
 
 * @example
 * const f = get_focus();
 */
declare function get_focus(): Entity | null;
/**
 * Who `entity` is targeting, if that target is still visible / is you.
 * Resolves monster targets by name and player targets by id.
 * @param entity Source entity.
 
 * @example
 * const t = get_target_of(monster);
 */
declare function get_target_of(entity: Entity): Entity | null;
/**
 * Your current target (`ctarget`, else `xtarget`) if still visible.
 * @returns The target entity, or `null`.
 
 * @example
 * const t = get_target();
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
 
 * @example
 * change_target(get_nearest_monster({ type: "goo" }));
 */
declare function change_target(target: Entity | null): void;
/**
 * `true` if you can walk in a straight line to `(x, y)`.
 * @param x Map x.
 * @param y Map y.
 
 * @example
 * if (can_move_to(target)) move(target.x, target.y);
 */
/**
 * Low-level geometry check: can an entity walk from `(x,y)` to `(going_x,going_y)` on its map?
 * Used internally by {@link can_move_to} / smart pathing. Prefer {@link can_move_to} for bots.
 * @example
 * can_move({ map: character.map, x: character.x, y: character.y, going_x: tx, going_y: ty, base: character.base });
 * @see can_move_to
 */
declare function can_move(entity: CanMoveEntity, based?: boolean | number): boolean;
/**
 * Resolve a deferred helper with success data (CODE internals / custom wrappers).
 * @example
 * return resolving_promise({ success: true, used: true });
 */
declare function resolving_promise<T>(data: T): Promise<T>;
/**
 * Reject (or resolve-as-failure when `RESOLVE_ALL`) a deferred helper.
 * @example
 * return rejecting_promise({ reason: "not_in_bank" });
 */
declare function rejecting_promise<T = CodeFailure>(data: T): Promise<T>;
declare function can_move_to(x: number, y: number): boolean;
/**
 * `true` if you can walk in a straight line to an entity's `real_x`/`real_y` (or `x`/`y`).
 * @param entity Entity or point object.
 
 * @example
 * if (can_move_to(target)) move(target.x, target.y);
 */
declare function can_move_to(entity: Entity | Point): boolean;
/**
 * Move if {@link can_move_to}, otherwise {@link smart_move} toward the point.
 * @param x Destination x.
 * @param y Destination y.
 
 * @example
 * xmove(target.x, target.y);
 */
declare function xmove(x: number, y: number): Promise<SmartMoveResult> | SmartMoveResult; /**
 * `true` if `target` is visible and within range for an attack or skill.
 * Skills with absolute `G.skills[skill].range` use that; otherwise
 * `character.range * range_multiplier + range_bonus`.
 * @param target Entity to check.
 * @param skill Optional skill id (`"attack"`, `"heal"`, `"mentalburst"`, …).
 
 * @example
 * if (is_in_range(target, "attack")) attack(target);
 */
declare function is_in_range(target: Entity, skill?: SkillKey): boolean;
/**
 * `true` if the skill (or its shared cooldown group) is still on cooldown.
 * @param skill Skill id.
 
 * @example
 * if (!is_on_cooldown("attack")) use_skill("attack");
 */
declare function is_on_cooldown(skill: SkillKey): boolean;
/**
 * `true` if you can attack `target` now (not disabled, in range, attack ready).
 * Does not check monster-specific attack range bonuses beyond {@link is_in_range}.
 * @param target Monster or player entity.
 
 * @example
 * if (can_attack(target)) attack(target);
 */
declare function can_attack(target: Entity): boolean;
/**
 * `true` if you can heal `target` now (same readiness as attack; false for monsters).
 * @param target Friendly entity.
 
 * @example
 * if (can_heal(friend)) heal(friend);
 */
declare function can_heal(target: Entity): boolean;
/**
 * `true` if the entity is moving, or (for you) if `smart.moving`.
 
 * @example
 * if (!is_moving(character)) move(x, y);
 */
declare function is_moving(entity: Entity): boolean;
/**
 * `true` if the entity is mid-town transport, or (for you) `parent.transporting`.
 
 * @example
 * if (is_transporting(character)) return;
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
declare function attack(target: Entity): Promise<BetterUX<HitData | CodeFailure>>; /**
 * Heal a friendly target entity.
 * @param target Entity to heal (object; use `character` to heal yourself).
 
 * @example
 * heal(character);
 */
declare function heal(target: Entity): Promise<BetterUX<HitData | CodeFailure>>; /**
 * Buy from an NPC shop (gold or shells depending on the listing).
 * @param name Item id (`G.items` key).
 * @param quantity Stack size (default 1).
 * @example
 * await buy("hpot0", 100);
 * buy("mpot1", 200).then((data) => game_log("Bought into slot " + data.num));
 */
declare function buy(name: ItemKey, quantity?: number): Promise<BuySuccessResponse | CodeFailure>; /** Buy using gold specifically.
 * @example
 * await buy_with_gold("hpot0", 100);
 */
declare function buy_with_gold(name: ItemKey, quantity?: number): Promise<BuySuccessResponse | CodeFailure>; /** Buy using shells / special currency (may return `in_progress`).
 * @example
 * await buy_with_shells("xpbooster");
 */
declare function buy_with_shells(name: ItemKey, quantity?: number): Promise<BetterUX<BuySuccessResponse | CodeFailure | { in_progress?: boolean }>>; /**
 * Sell an inventory slot.
 * @param num Inventory index.
 * @param quantity Optional count for stacks.
 
 * @example
 * sell(locate_item("hpamulet"), 1);
 */
declare function sell(
	num: number,
	quantity?: number,
): Promise<BetterUX<{ success?: boolean; gold?: number; place?: "sell" } | CodeFailure>>; /** Consume / use an inventory item by index (`equip` with `consume: true`).
 * @example
 * consume(locate_item("candypop"));
 */
declare function consume(num: number): Promise<BetterUX<{ success?: boolean; num?: number; name?: ItemKey } | CodeFailure>>; /**
 * Equip an inventory item.
 * @param num Inventory index (`>= 0`).
 * @param slot Optional equipment slot name.
 
 * @example
 * equip(locate_item("blade"));
 */
declare function equip(num: number, slot?: SlotType): Promise<BetterUX<{ success?: boolean; slot?: SlotType; num?: number } | CodeFailure>>; /**
 * Equip several items in one batch call (max 15; each entry needs `num >= 0`).
 * @param data Array of {@link EquipBatchEntry} objects.
 
 * @example
 * equip_batch([{ num: 0, slot: "mainhand" }, { num: 1, slot: "helmet" }]);
 */
declare function equip_batch(data: EquipBatchEntry[]): Promise<BetterUX<{ success?: boolean } | CodeFailure>>; /**
 * Unequip a named gear or trade slot.
 * @param slot e.g. `"helmet"`, `"mainhand"`, `"trade1"` (see `character.slots`).
 
 * @example
 * unequip("helmet");
 */
declare function unequip(
	slot: SlotType | TradeSlotType,
): Promise<BetterUX<{ success?: boolean; slot?: SlotType | TradeSlotType } | CodeFailure>>; /** Lock an inventory item so it cannot be sold/upgraded by mistake.
 * @example
 * lock_item(0);
 */
declare function lock_item(num: number): Promise<BetterUX<{ success?: boolean; num?: number } | CodeFailure>>; /** Seal an item (cannot unlock for ~2 days).
 * @example
 * seal_item(0);
 */
declare function seal_item(num: number): Promise<BetterUX<{ success?: boolean; num?: number } | CodeFailure>>; /**
 * Unlock a previously locked inventory item.
 * Sealed items may return `{ hours, success: false, in_progress: true }`.
 
 * @example
 * unlock_item(0);
 */
declare function unlock_item(num: number): Promise<BetterUX<{ success?: boolean; num?: number } | CodeFailure>>; /**
 * Open a merchant stand.
 * @param num Optional stand item inventory index (auto-detected if omitted).
 
 * @example
 * open_stand();
 */
declare function open_stand(num?: number): Promise<unknown>; /** Close your merchant stand.
 * @example
 * close_stand();
 */
declare function close_stand(): Promise<unknown>; /**
 * List an inventory item on a trade slot (coerces `1` → `"trade1"`).
 * @param num Inventory index.
 * @param trade_slot Trade slot name or number (`1`–`16`).
 * @param price Price in gold.
 * @param quantity Optional stack size (default 1).
 
 * @example
 * trade(0, "trade1", 1000000);
 */
declare function trade(num: number, trade_slot: TradeSlotType | number, price: number, quantity?: number): Promise<BetterUX<{ success?: boolean; slot?: TradeSlotType } | CodeFailure>>; /**
 * Buy from another player's trade slot (uses that slot's `.rid`).
 * @param target Player entity.
 
 * @example
 * trade_buy(merchant, "trade1");
 */
declare function trade_buy(target: Entity, trade_slot: TradeSlotType | number, quantity?: number): Promise<BetterUX<BuySuccessResponse | CodeFailure>>; /**
 * Sell into another player's wishlist / buy offer (uses that slot's `.rid`).
 * @param target Player entity.
 
 * @example
 * trade_sell(merchant, "trade1");
 */
declare function trade_sell(target: Entity, trade_slot: TradeSlotType | number, quantity?: number): Promise<BetterUX<{ success?: boolean; gold?: number } | CodeFailure>>; /**
 * Post a wishlist buy offer on a trade slot.
 * @param trade_slot Trade slot name or number.
 * @param name Item id to buy.
 * @param price Offer price.
 * @param level Optional required item level.
 * @param quantity Optional count (default 1).
 
 * @example
 * wishlist("trade1", "staff", 500000, 0, 1);
 */
declare function wishlist(
	trade_slot: TradeSlotType | number,
	name: ItemKey,
	price: number,
	level?: number,
	quantity?: number,
): Promise<BetterUX<{ success?: boolean; slot?: TradeSlotType } | CodeFailure>>; /**
 * Start an item giveaway on a trade slot.
 * @example
 * giveaway("trade1", 0, 12, 20);
 */
declare function giveaway(slot: TradeSlotType | number, num: number, q: number, minutes: number): Promise<BetterUX<{ success?: boolean; slot?: TradeSlotType } | CodeFailure>>; /**
 * Join someone else's giveaway (needs that listing's `.rid`).
 * @example
 * join_giveaway("Name", "trade1", get_player("Name").slots.trade1.rid);
 */
declare function join_giveaway(name: string, slot: TradeSlotType | number, rid: string): Promise<BetterUX<{ success?: boolean } | CodeFailure>>; /**
 * Upgrade an item with a scroll (and optional offering).
 * Check `character.q.upgrade` while an upgrade is in progress.
 *
 * @param item_num Inventory index of the item (0–41).
 * @param scroll_num Inventory index of the upgrade scroll.
 * @param offering_num Optional offering index (e.g. primordial essence).
 * @param only_calculate When `true`, only returns chance / cost — does not upgrade.
 * @example
 * upgrade(0, 1);
 * upgrade(0, 1, 2);
 * if (character.q.upgrade) game_log("Already upgrading");
 * const chance = await upgrade(locate_item("coat"), locate_item("scroll0"), null, true);
 * game_log("Chance: " + chance.chance);
 * upgrade(locate_item("coat"), locate_item("scroll0")).then((data) => {
 *   if (data.success) game_log("Now +" + data.level);
 *   else game_log("Failed: " + data.reason);
 * });
 */
/** Calculate upgrade chance only. */
declare function upgrade(item_num: number, scroll_num: number, offering_num: number | null | undefined, only_calculate: true): Promise<UpgradeCalculateResponse> | UpgradeCalculateResponse;
/** Perform the upgrade. */
declare function upgrade(item_num: number, scroll_num: number, offering_num?: number | null, only_calculate?: false): Promise<BetterUX<UpgradeSuccessResponse | CodeFailure>>; /**
 * Compound three matching items with a scroll (and optional offering).
 * @param only_calculate When `true`, only returns chance / cost.
 * @example
 * compound(0, 1, 2, locate_item("cscroll0"));
 * const info = await compound(0, 1, 2, locate_item("cscroll0"), null, true);
 * game_log("Compound chance " + info.chance);
 */
/** Calculate compound chance only. */
declare function compound(
	item0: number,
	item1: number,
	item2: number,
	scroll_num: number,
	offering_num: number | null | undefined,
	only_calculate: true,
): Promise<CompoundCalculateResponse> | CompoundCalculateResponse;
/** Perform the compound. */
declare function compound(
	item0: number,
	item1: number,
	item2: number,
	scroll_num: number,
	offering_num?: number | null,
	only_calculate?: false,
): Promise<BetterUX<CompoundSuccessResponse | CodeFailure>>; /**
 * Craft using up to nine craft-grid inventory slots (`null` for empty cells).
 * Positions map to the 3×3 crafting UI. Some recipes also cost gold (`G.craft`).
 * @returns {@link CraftSuccessResponse} or {@link CraftFailureResponse}
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
): Promise<BetterUX<CraftSuccessResponse | CraftFailureResponse>>; /**
 * Auto-craft a named recipe if materials are available.
 * @param name Recipe / item id (e.g. `"computer"`).
 
 * @example
 * await auto_craft("computer");
 */
declare function auto_craft(name: ItemKey): Promise<BetterUX<CraftSuccessResponse | CraftFailureResponse | CodeFailure>>; /**
 * Exchange / open an exchangeable inventory item; waits for the exchange queue.
 * @returns `{ success, reward?, num? }` when finished.
 
 * @example
 * await exchange(locate_item("gem0"));
 */
declare function exchange(item_num: number): Promise<BetterUX<ExchangeSuccessResponse | CodeFailure>>; /**
 * Buy from an exchange shop listing.
 * @param token Token / shop currency id (e.g. `"funtoken"`).
 * @param name Item id to buy (e.g. `"confetti"`).
 
 * @example
 * await exchange_buy("funtoken", "confetti");
 */
declare function exchange_buy(token: ItemKey, name: ItemKey): Promise<BetterUX<BuySuccessResponse | CodeFailure>>; /** Say in local chat (respects {@link safeties}).
 * @example
 * say("Hello!");
 */
declare function say(message: string): void;
/** Say in party chat (respects {@link safeties}).
 * @example
 * party_say("On me");
 */
declare function party_say(message: string): void;
/**
 * Private-message a player (respects {@link safeties}).
 * @param name Player name.
 * @param message Message text.
 
 * @example
 * pm("Friend", "Need pots");
 */
declare function pm(name: string, message: string): void;
/**
 * Walk toward a map position (direct move). Rejects if {@link can_walk} fails.
 * Resolves when the server acknowledges the request — **not** when you arrive.
 * Failure shapes are {@link MoveFailureResponse} (`unable` / `interrupted` / …).
 * Prefer {@link xmove} / {@link smart_move} for pathing around obstacles.
 * @param x Destination x.
 * @param y Destination y.
 * @returns {@link MoveResponse}
 * @example
 * move(character.x + 20, character.y);
 */
declare function move(x: number, y: number): Promise<MoveResponse> | MoveResponse;
/**
 * Cap movement speed (cruise control). Use a high value (e.g. `500`) to clear the cap.
 * @param speed Max speed to use.
 
 * @example
 * cruise(30); // cap speed; cruise(500) clears
 */
declare function cruise(speed: number): void;
/**
 * Pretty-print JSON in a UI window (debug).
 * @example
 * show_json(G.monsters.goo);
 * show_json(character.items);
 */
declare function show_json(json: unknown): void;
/** Characters on this account (`parent.X.characters`; infrequently updated).
 * @example
 * show_json(get_characters());
 */
declare function get_characters(): OnlineCharacter[];
/** Available servers list (`parent.X.servers`).
 * @example
 * show_json(get_servers());
 */
declare function get_servers(): ServerListing[];
/**
 * Party members keyed by name (`parent.party`).
 * Inspect with `show_json(get_party())`. For the name list, see `parent.party_list`.
 
 * @example
 * show_json(get_party());
 */
declare function get_party(): { [name: string]: PartyMember };
/**
 * Nearby player by name (or yourself).
 * @returns Player entity, or `null`.
 
 * @example
 * const p = get_player("Friend");
 */
declare function get_player(name: string): CharacterEntity | Character | null;
/**
 * Monster by entity id (within vision).
 * @returns Monster entity, or `null` if missing / not a monster.
 
 * @example
 * const m = get_monster("1234");
 */
declare function get_monster(id: string): MonsterEntity | null;
/**
 * Any entity by id (or yourself when `id === character.name`).
 * @returns Entity, or `null` / undefined if missing.
 
 * @example
 * const e = get_entity(character.id);
 */
declare function get_entity(id: string): Entity | null;
/**
 * Locate an NPC id across maps (smart_move-friendly coords).
 * @returns `{ map, in, x, y }`, or `null`.
 
 * @example
 * const n = find_npc("fancypots"); if (n) smart_move(n);
 */
declare function find_npc(npc_id: NpcKey): NpcLocation | null;
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
/** Closest entity with `type === "npc"`.
 * @example
 * const npc = get_nearest_npc();
 */
declare function get_nearest_npc(): NpcEntity | null;
/**
 * Use HP and/or MP potions as needed (priority: low MP, then low HP, then top-off).
 * Throttled when {@link safeties} is on; skipped while `use_hp` is on cooldown.
 * @returns Promise-like result (`used` / `reason` when skipped).
 
 * @example
 * setInterval(use_hp_or_mp, 250);
 */
declare function use_hp_or_mp(): Promise<BetterUX<{ success?: boolean; pot?: ItemKey } | CodeFailure>> | void; /**
 * Loot nearby chests (opens up to two per call with safety checks).
 * @example
 * setInterval(function () { loot(); }, 500);
 */
declare function loot(): Promise<BetterUX<LootEvent | CodeFailure>>; /**
 * Loot a specific chest by id.
 * @param chest_id Chest id from {@link get_chests}.
 
 * @example
 * setInterval(function () { loot(); }, 500);
 */
declare function loot(chest_id: string): Promise<BetterUX<LootEvent | CodeFailure>>; /**
 * Loot via the commander path when `true`.
 * @param commander Pass `true` to use the commander loot path.
 
 * @example
 * setInterval(function () { loot(); }, 500);
 */
declare function loot(commander: true): Promise<BetterUX<LootEvent | CodeFailure>>; /** Open chests currently on the map, keyed by id (`parent.chests`).
 * @example
 * show_json(get_chests());
 */
declare function get_chests(): { [id: string]: ChestInfo };
/**
 * Send gold to a player.
 * @param receiver Player name (or entity with `.name`).
 * @param gold Amount.
 
 * @example
 * send_gold("Merchant", 100000);
 */
declare function send_gold(receiver: string | Entity, gold: number): Promise<BetterUX<{ success?: boolean; gold?: number; name?: string } | CodeFailure>>; /**
 * Send an inventory item (stack) to a player.
 * @param receiver Player name (or entity with `.name`).
 * @param num Inventory index.
 * @param quantity Optional count (default 1).
 
 * @example
 * send_item("Merchant", 0, 10);
 */
declare function send_item(
	receiver: string | Entity,
	num: number,
	quantity?: number,
): Promise<BetterUX<{ success?: boolean; name?: string; item?: ItemKey; q?: number; num?: number } | CodeFailure>>; /**
 * Destroy / poof an inventory item (slots 0–41).
 * @param num Inventory index.
 
 * @example
 * destroy(locate_item("frogs"));
 */
declare function destroy(num: number): Promise<BetterUX<{ success: boolean; place: "destroy" } | CodeFailure>>; /**
 * Split a stack at inventory index `num` into a second stack of `quantity`.
 * @param num Inventory index of the stack.
 * @param quantity Size of the new stack.
 
 * @example
 * split(locate_item("hpot0"), 10);
 */
declare function split(num: number, quantity: number): Promise<unknown>; /**
 * Dismantle a craftable item at an inventory index.
 * @param item_num Inventory index.
 
 * @example
 * dismantle(locate_item("firestaff"));
 */
declare function dismantle(item_num: number): Promise<BetterUX<{ success?: boolean; name?: ItemKey } | CodeFailure>>; /**
 * Send in-game mail. Optionally attaches inventory slot 0 when `item` is truthy.
 * @param to Recipient character name.
 * @param subject Mail subject.
 * @param message Body text.
 * @param item When truthy, attach the item in inventory slot 0.
 
 * @example
 * send_mail("Friend", "Hello", "Body text", false);
 */
declare function send_mail(to: string, subject: string, message: string, item?: boolean): Promise<BetterUX<{ success?: boolean; to?: string } | CodeFailure>>; /**
 * Unfriend a player by name (or owner id).
 * @param name Friend name or owner id.
 
 * @example
 * unfriend("Name");
 */
declare function unfriend(name: string): Promise<BetterUX<{ success?: boolean } | CodeFailure>>; /**
 * Set your character's home spawn to the current location.
 
 * @example
 * set_home();
 */
declare function set_home(): Promise<BetterUX<{ success?: boolean } | CodeFailure>>; /**
 * Draw a line into the game map (PIXI). Destroy drawings or call {@link clear_drawings} to avoid lag.
 * @returns PIXI.Graphics, or `undefined` when graphics are off.
 * @example
 * draw_line(character.x, character.y, character.x + 40, character.y);
 */
declare function draw_line(x: number, y: number, x2: number, y2: number, size?: number, color?: number): PIXIGraphics | undefined;
/**
 * Draw a circle into the game map (PIXI).
 * @returns PIXI.Graphics, or `undefined` when graphics are off.
 * @example
 * draw_circle(character.real_x, character.real_y, character.range);
 */
declare function draw_circle(x: number, y: number, radius: number, size?: number, color?: number): PIXIGraphics | undefined;
/** Destroy all CODE drawings created with {@link draw_line} / {@link draw_circle}.
 * @example
 * clear_drawings();
 */
declare function clear_drawings(): void;
/**
 * Plot / inspect a pathfinding graph node (debug helper).
 * @param index Node index.
 
 * @example
 * plot(0); // debug path node
 */
declare function plot(index: number): void;
/** Force a CODE drawing refresh (advanced / debug).
 * @example
 * code_draw();
 */
declare function code_draw(): void;
/**
 * Bank helpers reject when you are not inside the bank.
 * Successful calls resolve with server ack payloads; failures include `{ reason: "not_in_bank" | … }`.
 */
type BankFailure = CodeFailure;
/**
 * Send a CODE message (CM) to one or more characters.
 * Uses local delivery when the target is local; otherwise server CM.
 * Received via {@link on_cm} / `character.on("cm", …)`.
 * @param to Name or list of names.
 * @param data JSON-serializable payload.
 
 * @example
 * send_cm("Merchant", { need: "hpot0" });
 */
declare function send_cm(to: string | string[], data: unknown): Promise<BetterUX<{ success?: boolean } | CodeFailure>> | void;
/**
 * **Override hook** — called when a CM arrives (wired from `character.on("cm")`).
 * @param from Sender character name.
 * @param data Payload message.
 
 * @example
 * // Override in your CODE:
 * // function on_cm(from, data) { game_log(from + ": " + data); }
 */
declare function on_cm(from: string, data: unknown): void;
/** Respawn after death (server cooldown applies; wait ~15s in practice).
 * @example
 * if (character.rip) setTimeout(respawn, 15000);
 */
declare function respawn(): Promise<BetterUX<{ success?: boolean } | CodeFailure>>; /**
 * **Override hook** — called when your character dies (`character.on("death")`).
 * Define in your CODE to auto-respawn or run recovery logic.
 
 * @example
 * // function handle_death() { setTimeout(respawn, 15000); }
 */
declare function handle_death(): void;
/**
 * **Override hook** — handle custom chat commands (`/command …`).
 * Return anything other than `-1` to consume the command.
 * @param command Command name without prefix.
 * @param args Remainder of the line.
 
 * @example
 * // function handle_command(command, args) { if (command === "test") return true; }
 */
declare function handle_command(command: string, args?: string): void;
/** **Override hook** — party invite received from `name`.
 * @example
 * // function on_party_invite(name) { accept_party_invite(name); }
 */
declare function on_party_invite(name: string): void;
/** **Override hook** — party request received from `name`.
 * @example
 * // function on_party_request(name) { accept_party_request(name); }
 */
declare function on_party_request(name: string): void;
/** **Override hook** — CODE context is being destroyed (clears drawings/buttons by default).
 * @example
 * // function on_destroy() { clear_drawings(); clear_buttons(); }
 */
declare function on_destroy(): void;
/**
 * **Override hook** — called each draw frame (up to ~60/s).
 * Keep this light; heavy work belongs in your main loop / intervals.
 
 * @example
 * // function on_draw() { } // keep this light — heavy work belongs in intervals
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
declare function on_game_event(data: ServerToClient_game_event): void;
/**
 * Invite a player to your party (name, id, or player object).
 * @param name Player name or entity.
 
 * @example
 * send_party_invite("Friend");
 */
declare function send_party_invite(name: string | Entity): Promise<BetterUX<{ success?: boolean; name?: string } | CodeFailure>>; /** Request to join someone's party.
 * @example
 * send_party_request("Leader");
 */
declare function send_party_request(name: string): Promise<BetterUX<{ success?: boolean; name?: string } | CodeFailure>>; /** Accept a party invite.
 * @example
 * accept_party_invite(name);
 */
declare function accept_party_invite(name: string): Promise<BetterUX<{ success?: boolean; name?: string } | CodeFailure>>; /** Accept a party request.
 * @example
 * accept_party_request(name);
 */
declare function accept_party_request(name: string): Promise<BetterUX<{ success?: boolean; name?: string } | CodeFailure>>; /** Leave your current party.
 * @example
 * leave_party();
 */
declare function leave_party(): Promise<BetterUX<{ success?: boolean } | CodeFailure>>; /** Kick a member from your party (leader).
 * @example
 * kick_party_member("Name");
 */
declare function kick_party_member(name: string): Promise<BetterUX<{ success?: boolean; name?: string } | CodeFailure>>; /** Accept an incoming magiport from `name`.
 * @example
 * accept_magiport(name);
 */
declare function accept_magiport(name: string): Promise<BetterUX<{ success?: boolean; name?: string } | CodeFailure>>; /**
 * Bind a keyboard key to a skill or CODE snippet.
 * @param key Key name (e.g. `"1"`, `"ESC"`).
 * @param skill Skill id, or mapping object.
 * @param code Optional CODE snippet for `"snippet"`-style bindings.
 * @example
 * map_key("1", "use_hp");
 * map_key("2", "snippet", "say('OMG')");
 */
declare function map_key(key: string, skill: string | object, code?: string): void;
/** Remove a key binding created with {@link map_key}.
 * @example
 * unmap_key("1");
 */
declare function unmap_key(key: string): void;
/**
 * Load another code slot/snippet into this CODE context (top-level / global scope).
 * @param name Slot number or code name.
 * @param onerror Optional error handler.
 
 * @example
 * load_code("utils");
 */
declare function load_code(name: string | number, onerror?: (error?: unknown) => void): void;
/**
 * Require / evaluate another code slot in its own scope and return `module.exports`.
 * @param name Slot number or code name.
 
 * @example
 * const utils = require_code("utils");
 */
declare function require_code(name: string | number): unknown;
/**
 * Pathfind / travel to a destination (map, monster type, coords, NPC id, shortcuts, …).
 * Runs asynchronously; returns a Promise. Interrupts a prior smart_move.
 *
 * Resolves with {@link SmartMoveSuccess}. Rejects with {@link SmartMoveFailure}
 * (`reason` e.g. `"invalid"`, `"interrupted"`, `"failed"`).
 *
 * @param dest Destination string, monster type, shortcut (`"town"`, `"upgrade"`, …), or `{ x, y, map? }` / `{ to }` object.
 * @param on_done Optional callback `(done, reason?)` when finished.
 * @returns Promise resolving to {@link SmartMoveSuccess} (also supports the legacy `on_done` callback).
 * @example
 * smart_move("main");
 * smart_move("goo");
 * smart_move("upgrade");
 * smart_move({ x: 0, y: 0, map: "main" }, () => game_log("arrived"));
 * smart_move("town").catch((e) => game_log(e.reason));
 */
declare function smart_move(dest: SmartMoveDestination, on_done?: (done: boolean, reason?: string) => void): Promise<SmartMoveSuccess>;
/**
 * Stop movement or a named action.
 * Omit / `"move"` cancels smart movement and issues a stay-put move.
 * `"smart"` cancels pathfinding only. Also supports `"town"` / `"teleport"` / `"invis"` / `"revival"`.
 * @param action Optional action id.
 
 * @example
 * stop(); // cancel movement
 * stop("town");
 */
declare function stop(action?: string): void;
/**
 * Distance between two entities or points (hitbox-aware; large value if different map/`in`).
 * @param a First entity or `{x,y}` / `{real_x,real_y}`.
 * @param b Second entity or point.
 
 * @example
 * game_log(distance(character, target));
 */
declare function distance(a: Entity | Point, b: Entity | Point): number;
/**
 * `true` if the entity can walk (not dashing / mid-transport / disabled).
 * @param entity Entity to inspect (typically `character`).
 
 * @example
 * if (can_walk(character)) move(x, y);
 */
declare function can_walk(entity: Entity): boolean;
/**
 * `true` if the entity is crowd-controlled / disabled
 * (`rip`, stunned, fingered, stoned, deepfreezed, sleeping).
 * Returns a truthy value or `undefined`.
 * @param entity Entity to inspect.
 
 * @example
 * if (is_disabled(character)) return;
 */
declare function is_disabled(entity: Entity): boolean;
/**
 * Read a value from persistent CODE storage (`localStorage` key `cstore_*`).
 * @param name Storage key.
 * @returns Parsed value, or `null` on failure / missing.
 
 * @example
 * const cfg = get("cfg") || {};
 */
declare function get<T = unknown>(name: string): T | null;
/**
 * Write a value to persistent CODE storage (JSON-serializable).
 * @param name Storage key.
 * @param value JSON-serializable value.
 * @returns `true` on success, `false` on failure.
 
 * @example
 * set("cfg", { farm: "goo" });
 */
declare function set(name: string, value: unknown): boolean;
/**
 * Channel the town portal and wait until `character.c.town` clears.
 * @example
 * await town();
 * smart_move("upgrade");
 */
declare function town(): Promise<BetterUX<{ success?: boolean; place?: "town" } | CodeFailure>>; /**
 * Soft-set target without emitting the server `"target"` event.
 * @param target Entity to focus, or `null` to clear.
 
 * @example
 * change_target_privately(target);
 */
declare function change_target_privately(target: Entity | null): void;
/**
 * Equip a cosmetic onto a CX slot (`character.cx`). Ownership lives in `character.acx`.
 * @param slot Cosmetic slot id (`hat`, `hair`, …) or `"skin"`.
 * @param cx_name Cosmetic id.
 
 * @example
 * equip_cx("hat", "santahat");
 */
declare function equip_cx(slot: CosmeticSlotKey | "skin", cx_name: string): Promise<BetterUX<{ success?: boolean; slot?: string } | CodeFailure>>; /**
 * Send one owned cosmetic to another of your characters.
 * @param receiver Character name (or entity with `.name`).
 * @param cx Cosmetics id string (e.g. `"santahat"`), not a full `cx` slot map.
 
 * @example
 * send_cx("Alt", "santahat");
 */
declare function send_cx(receiver: string | Entity, cx: string): Promise<BetterUX<{ success?: boolean; name?: string } | CodeFailure>>;
/**
 * Send a CODE message over the server CM path only (high `character.cc` cost).
 * Prefer {@link send_cm} which routes local vs server automatically.
 * @param to Name or list of names.
 * @param message JSON-serializable payload.
 
 * @example
 * await send_server_cm("Friend", { hello: true });
 */
declare function send_server_cm(to: string | string[], message: unknown): Promise<BetterUX<{ success?: boolean } | CodeFailure>>;
/**
 * Deliver a CM locally via `localStorage` / CLI bridge (same machine / account tab).
 * @param name Target character name.
 * @param data JSON-serializable payload.
 
 * @example
 * send_local_cm("Merchant", { ping: true });
 */
declare function send_local_cm(name: string, data: unknown): void;
/**
 * `true` if `name` appears to be running locally (recent heartbeat in activity storage).
 
 * @example
 * if (is_character_local("Merchant")) send_local_cm("Merchant", 1);
 */
declare function is_character_local(name: string): boolean;
/**
 * Persistent string storage (Web `localStorage` / Electron store).
 * Prefer {@link set} / {@link get} for JSON objects.
 
 * @example
 * pset("note", "hello");
 */
declare function pset(name: string, value: string): boolean | void;
/** Read a value written with {@link pset}.
 * @example
 * const note = pget("note");
 */
declare function pget(name: string): string | null | undefined;
/**
 * Add a button above the CODE area.
 * @param id Stable button id (also used as CSS suffix).
 * @param value Optional label HTML/text.
 * @param fn Optional click handler.
 * @example
 * add_top_button("reload", "RELOAD", () => location.reload());
 */
declare function add_top_button(id: string, value?: string, fn?: () => void): void;
/**
 * Add a small button below the CODE area.
 * @param id Stable button id.
 * @param value Optional label HTML/text.
 * @param fn Optional click handler.
 
 * @example
 * add_bottom_button("loot", "LOOT", () => loot());
 */
declare function add_bottom_button(id: string, value?: string, fn?: () => void): void;
/** Update a CODE button's label.
 * @example
 * set_button_value("loot", "LOOT");
 */
declare function set_button_value(id: string, value: string): void;
/** Update a CODE button's border color.
 * @example
 * set_button_color("loot", "#67D74C");
 */
declare function set_button_color(id: string, color: string): void;
/** Replace a CODE button's click handler.
 * @example
 * set_button_onclick("loot", () => loot());
 */
declare function set_button_onclick(id: string, fn: () => void): void;
/** Remove all CODE UI buttons created with {@link add_top_button} / {@link add_bottom_button}.
 * @example
 * clear_buttons();
 */
declare function clear_buttons(): void;
/**
 * **Override hook** — entity left vision / disappeared.
 * @param entity Entity that disappeared.
 * @param data Extra disappear payload from the server.
 
 * @example
 * // function on_disappear(entity, data) { game_log("gone " + entity.id); }
 */
declare function on_disappear(entity: Entity, data?: ServerToClient_disappear | { outside?: boolean; place?: string; reason?: string }): void;
/**
 * **Override hook** — magiport offer received (PVE consent flow).
 * Call {@link accept_magiport} to accept.
 
 * @example
 * // function on_magiport(name) { accept_magiport(name); }
 */
declare function on_magiport(name: string): void;
/**
 * **Override hook** — map click in the game world.
 * Return `true` to cancel the default move.
 
 * @example
 * // function on_map_click(x, y) { xmove(x, y); return true; }
 */
declare function on_map_click(x: number, y: number): boolean | void;
/**
 * **Override hook** — stacked characters are taking combined monster damage.
 * Wired from `character.on("stacked", …)` in runner_compat.
 
 * @example
 * // function on_combined_damage() { move(character.real_x + 8, character.real_y); }
 */
declare function on_combined_damage(): void;
/**
 * Preview an item definition in a modal (item design helper).
 * @param def Item definition object (often from `G.items`).
 * @param args Optional `{ id, thumbnail }`.
 
 * @example
 * preview_item(G.items.blade);
 */
declare function preview_item(def: ItemInfo | GItem | { name?: ItemKey; [k: string]: unknown }, args?: { id?: string; thumbnail?: unknown }): void;
/**
 * Set which keys appear on the skill bar.
 * @example
 * set_skillbar("1", "2", "3", "4", "R");
 * set_skillbar(["1", "2", "3", "4", "R"]);
 */
declare function set_skillbar(...keys: string[]): void;
/** Array form of {@link set_skillbar}.
 * @example
 * set_skillbar("1", "2", "3", "4", "R");
 */
declare function set_skillbar(keys: string[]): void;
/**
 * Replace the entire keymap object.
 * @example
 * set_keymap({ "1": { name: "use_mp" }, "2": { name: "use_hp" } });
 */
declare function set_keymap(keymap: { [key: string]: { name?: string; code?: string; [k: string]: unknown } }): void;
/** Reset keymap / skillbar to defaults then re-apply.
 * @example
 * reset_mappings();
 */
declare function reset_mappings(): void;
/**
 * Upload code into a numbered slot (advanced / tooling).
 * @param slot_number Slot index.
 * @param slot_name Display name.
 * @param code_string Source text.
 
 * @example
 * // upload_code(1, "farm", "game_log(1)");
 */
declare function upload_code(slot_number: number, slot_name: string, code_string: string): Promise<BetterUX<{ success?: boolean; slot?: number } | CodeFailure>>; /** Active runner code slot index.
 * @example
 * game_log(get_active_code_slot());
 */
declare function get_active_code_slot(): number | string | null;
/** Slot currently open in the CODE editor UI.
 * @example
 * game_log(get_edited_code_slot());
 */
declare function get_edited_code_slot(): number | string | null;
/**
 * Force a disconnect via a burst of `"cruise"` emits (limitdc).
 * Useful for testing reconnect / {@link auto_reload}.
 
 * @example
 * // disconnect(); // force reconnect / test auto_reload
 */
declare function disconnect(): void;
/**
 * Cheap empty work to yield to the browser (UI smoothness trick).
 
 * @example
 * performance_trick();
 */
declare function performance_trick(): void;
/**
 * Configure auto-reload after rare network disconnects.
 * @param value `false` → off, `"auto"` → when CODE/stand active, otherwise always on.
 
 * @example
 * auto_reload("auto");
 */
declare function auto_reload(value?: boolean | "auto" | "on" | "off"): void;
/**
 * Alias for {@link is_in_range} / range check vs `character.range` (compat).
 
 * @example
 * if (in_attack_range(target)) attack(target);
 */
declare function in_attack_range(target: Entity): boolean;
/** Alias for {@link in_pvp}.
 * @example
 * if (is_pvp()) game_log("PVP");
 */
declare function is_pvp(): boolean;
/** Alias for {@link is_character}.
 * @example
 * if (is_player(e)) game_log(e.name);
 */
declare function is_player(entity: Entity): entity is CharacterEntity;
/** Alias for {@link destroy}.
 * @example
 * destroy_item(0);
 */
declare function destroy_item(num: number): Promise<BetterUX<{ success: boolean; place: "destroy" } | CodeFailure>>;
/** Bank pack unlock table: `[map, goldPrice, shellPrice]`. */
declare const bank_packs: Record<BankPackType, [MapKey, number, number]>;

/** Awaitable delay used throughout CODE helpers (`await sleep(100)`).
 * @example
 * await sleep(250);
 */
declare function sleep(ms: number): Promise<void>;
/**
 * Milliseconds since `t` (Date or ms timestamp).
 * @example
 * -mssince(parent.next_skill.attack)
 */
declare function mssince(t: Date | number, ref?: number): number;
/** Euclidean distance ignoring hitboxes / maps (faster than {@link distance}).
 * @example
 * game_log(simple_distance(character, target));
 */
declare function simple_distance(a: Entity | Point, b: Entity | Point): number;
/** `true` if two item instances can stack together.
 * @example
 * if (can_stack(character.items[0], character.items[1])) swap(0, 1);
 */
declare function can_stack(a: ItemInfo | null | undefined, b: ItemInfo | null | undefined, additionalQuantity?: number | null, args?: CanStackArgs): boolean;
/** `true` if the entity can transport (and you are not already transporting when `entity` is you).
 * @example
 * if (can_transport(character)) use_nearest_door();
 */
declare function can_transport(entity: Entity): boolean;
/** `true` if the entity is silenced / cannot chat-skill.
 * @example
 * if (is_silenced(character)) return;
 */
declare function is_silenced(entity: Entity): boolean;
/** Damage multiplier from defense difference (combat math helper).
 * @example
 * game_log(damage_multiplier(100));
 */
declare function damage_multiplier(defense: number): number;
/** Estimated vendor value for an item instance.
 * @example
 * game_log(calculate_item_value(character.items[0]));
 */
declare function calculate_item_value(item: ItemInfo, m?: number): number;
/** Format a number with separators (e.g. `1,234,567`).
 * @example
 * game_log(to_pretty_num(character.gold));
 */
declare function to_pretty_num(num: number): string;
/** Format a float for UI display.
 * @example
 * game_log(to_pretty_float(character.frequency));
 */
declare function to_pretty_float(num: number): string;
/** Compact number formatting for logs / HUD.
 * @example
 * game_log(smart_num(character.xp));
 */
declare function smart_num(num: number, edge?: number): string;
/** Shorten large numbers (e.g. `1.2M`).
 * @example
 * game_log(to_shrinked_num(character.gold));
 */
declare function to_shrinked_num(num: number): string;
/**
 * Fisher–Yates shuffle (in place) and return the array.
 * @example
 * const order = shuffle([0, 1, 2, 3]);
 */
declare function shuffle<T>(a: T[]): T[];
/** Type guard: value is a finite number.
 * @example
 * if (is_number(x)) move(x, y);
 */
declare function is_number(obj: unknown): obj is number;
/** Type guard: value is a string.
 * @example
 * if (is_string(dest)) smart_move(dest);
 */
declare function is_string(obj: unknown): obj is string;
/** Type guard: value is an array.
 * @example
 * if (is_array(list)) use_skill("3shot", list);
 */
declare function is_array(a: unknown): a is unknown[];
/** Type guard: value is a plain object (not array / null).
 * @example
 * if (is_object(dest) && "x" in dest) move(dest.x, dest.y);
 */
declare function is_object(o: unknown): o is object;
/** Rough door proximity check (use {@link can_use_door} for the accurate test).
 * @example
 * if (is_door_close(character.map, door, character.x, character.y)) use_nearest_door();
 */
declare function is_door_close(map: MapKey | string, door: DoorInfo, x: number, y: number): boolean;
/** Accurate door usability check (costlier).
 * @example
 * if (can_use_door(character.map, door, character.x, character.y)) use_nearest_door();
 */
declare function can_use_door(map: MapKey | string, door: DoorInfo, x: number, y: number): boolean;

/** Smaller of two numbers (legacy CODE helper).
 * @example
 * const n = min(character.hp, 200);
 */
declare function min(a: number, b: number): number;
/** Larger of two numbers (legacy CODE helper).
 * @example
 * const n = max(character.mp, 100);
 */
declare function max(a: number, b: number): number;
/** Sort object keys / values (legacy CODE helper).
 * @example
 * show_json(object_sort(G.monsters));
 */
declare function object_sort(o: Record<string, unknown> | object, algorithm?: string): Array<[string, unknown]>;
