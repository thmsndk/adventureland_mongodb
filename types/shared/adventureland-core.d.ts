/**
 * Shared entity / character / item shapes (server + client + Monaco).
 * CODE/runner globals live in types/monaco/adventureland-globals.d.ts.
 * Game-frame `parent`/`Window` live in types/client/parent-window.d.ts.
 */

/** Button registered with {@link add_top_button} / {@link add_bottom_button}. */
interface CodeButton {
	value?: string;
	fn?: () => void;
	place?: "top" | "bottom" | string;
}

/** Live pathfinding / travel state used by {@link smart_move}. */
interface SmartState {
	/** `true` while a smart_move is in progress. */
	moving: boolean;
	/** Destination map id (empty string while idle / resetting). */
	map: MapKey | string;
	x: number;
	y: number;
	/** Completion callback used internally / by legacy callers. */
	on_done: (done?: boolean, reason?: string) => void;
	/** Current BFS plot / path nodes (debug). */
	plot: PositionSmart[] | null;
	/** How close (px) is “arrived”. */
	edge: number;
	baby_edge: number;
	try_exact_spot: boolean;
	use_town: boolean;
	prune: { smooth: boolean; map: boolean };
	/** Path search markers (e.g. `map` once destination map is reached). */
	flags: { map?: boolean; [flag: string]: unknown };
	searching?: boolean;
	found?: boolean;
}

/** Shared fields for monsters, players, and NPCs in vision. */
interface EntityBase {
	id?: string;
	name?: string;
	/**
	 * Map x. For the CODE `character` proxy this is already precise (`real_x`).
	 * For other entities prefer `real_x` when present.
	 */
	x: number;
	/**
	 * Map y. For the CODE `character` proxy this is already precise (`real_y`).
	 * For other entities prefer `real_y` when present.
	 */
	y: number;
	/** Precise map x (when provided by the client). */
	real_x?: number;
	/** Precise map y (when provided by the client). */
	real_y?: number;
	going_x?: number;
	going_y?: number;
	from_x?: number;
	from_y?: number;
	/** Speed on the X-axis while moving. */
	vx?: number;
	/** Speed on the Y-axis while moving. */
	vy?: number;
	hp: number;
	max_hp: number;
	mp: number;
	max_mp: number;
	xp?: number;
	attack?: number;
	frequency?: number;
	armor?: number;
	resistance?: number;
	map?: MapKey;
	in?: string;
	level?: number;
	range?: number;
	speed?: number;
	skin?: string;
	width?: number;
	height?: number;
	/**
	 * Who this entity is targeting, if any.
	 * Monsters store a **player name**; players store a target **id**.
	 * Resolve with {@link get_target_of}.
	 */
	target?: string;
	rip?: boolean;
	/** False after the entity leaves your viewport (stale reference). */
	visible?: boolean;
	moving?: boolean;
	/** Active status conditions keyed by {@link ConditionKey} (`s.cursed`, `s.monsterhunt`, …). */
	s?: StatusInfo;
	/** Active channels / cast states (e.g. `c.town`). */
	c?: EntityChannels;
}

/** Condition / buff entry on `entity.s` (false, or `{ ms, … }`). */
type StatusCondition =
	| boolean
	| {
			ms?: number;
			/** Who applied this condition (character name), when attributed. */
			f?: string;
			name?: string;
			skin?: string;
			duration?: number;
			intensity?: number;
			[key: string]: unknown;
	  };

/** Channeling action on `entity.c` (e.g. town portal). */
interface ChannelState {
	ms?: number;
	f?: string;
	drop?: string;
	target?: string;
	[key: string]: unknown;
}

/** Visible monster (`type === "monster"`). Species id is {@link MonsterKey} on `mtype`. */
interface MonsterEntity extends EntityBase {
	type: "monster";
	/** Monster species id (e.g. `"goo"`). See `show_json(G.monsters)`. */
	mtype: MonsterKey;
	monster?: true;
	/** True / reason string when defeated or out of vision. */
	dead?: boolean | string;
	damage_type?: "physical" | "magical" | "pure" | string;
	aggro?: number;
	rage?: number;
	/** Some skills/conditions are more effective vs humanoids. */
	humanoid?: boolean;
	/** Everyone gets a %-based drop. */
	cooperative?: boolean;
	/** Immune to most skills and conditions. */
	immune?: boolean;
	/** Attacks only deal 1 HP damage. */
	"1hp"?: boolean;
	/** Copy of `G.monsters[mtype].abilities` when present. */
	abilities?: GMonsterAbilities;
	/**
	 * Boss minion spawn table from `G.monsters[mtype].spawns`.
	 * Timed: `[intervalMs, monsterType, count?]`; object form uses options as 3rd.
	 */
	spawns?: Array<[number, MonsterKey | string, number | Record<string, unknown>?]>;
	evasion?: number;
	reflection?: number;
	lifesteal?: number;
	dreturn?: number;
}

/** Nearby player character (`type === "character"`, not an NPC). */
interface CharacterEntity extends EntityBase {
	type: "character";
	/** Character class id. */
	ctype?: ClassKey;
	player?: true;
	npc?: false | undefined;
	bot?: boolean;
	owner?: string;
	/** Party leader name when in a party. */
	party?: string;
	/** Equipped gear when visible (merchants / inspect). */
	slots?: Partial<CharacterSlots>;
	stand?: boolean | string;
	cx?: CharacterCosmeticInfos;
}

/** NPC in vision (`type === "npc"` or `npc` truthy). */
interface NpcEntity extends EntityBase {
	type: "npc";
	npc: true | string;
	player?: false | undefined;
}

/**
 * Any nearby entity. Narrow with {@link is_monster} / {@link is_character} / {@link is_npc}.
 */
type Entity = MonsterEntity | CharacterEntity | NpcEntity;

/**
 * Progressed actions on `character.q` (upgrade / compound / exchange, …).
 * Not the same as item stack quantity `item.q`.
 * @see CharacterQueue in adventureland-shapes.d.ts
 */

/**
 * Bank contents — only present while you are inside the bank.
 * Packs are arrays of inventory-like slots (`items0`, `items1`, …).
 */
type BankInfo = {
	gold: number;
} & Partial<Record<BankPackType, (ItemInfo | null)[]>>;

/** Account bank packs on the user/character document (`player.user` / socket `user`). */
type CharacterBankInfos = BankInfo;

/**
 * Your character — extends {@link CharacterEntity} with inventory / stats / events.
 * Inspect live shape with `show_json(character)`.
 */
interface Character extends CharacterEntity {
	name: string;
	ctype?: ClassKey;
	/** Always set for your CODE character. */
	me?: 1 | boolean;
	gold: number;
	/** Shells / cash currency. */
	cash?: number;
	xp: number;
	max_xp?: number;
	/** Inventory slots; empty slots are `null` (placeholders while upgrading). */
	items: InventoryItem[];
	/** Inventory capacity (usually 42). */
	isize?: number;
	/**
	 * Empty inventory slots.
	 * @example
	 * if (character.esize === 0) game_log("Inventory full");
	 */
	esize?: number;
	/** Equipped gear + optional trade slots. */
	slots: CharacterSlots;
	range: number;
	/** Extra range allowance (ramps up while fighting). */
	xrange?: number;
	/** Flat attack damage. */
	attack?: number;
	/** Heal power (priests). */
	heal?: number;
	/** Attacks per second. */
	frequency?: number;
	armor?: number;
	resistance?: number;
	critdamage?: number;
	mp_reduction?: number;
	/** Combined home server id, e.g. `"EUI"`. */
	home?: string;
	direction?: number;
	bot?: boolean;
	/**
	 * Bank packs + bank gold. `undefined` when you are not inside the bank.
	 * Required by {@link bank_store} / {@link bank_withdraw} / etc.
	 * @example
	 * if (!character.bank) smart_move("bank");
	 * else bank_deposit(character.gold - 10000);
	 */
	bank?: BankInfo;
	/** Party leader name, if any. */
	party?: string;
	/**
	 * Average round-trip latency to the server (ms).
	 * @example
	 * reduce_cooldown("attack", character.ping * 0.95);
	 */
	ping?: number;
	/**
	 * Progressed actions (`upgrade`, `compound`, `exchange`, …).
	 * @example
	 * if (character.q.upgrade) game_log("Upgrading… " + character.q.upgrade.ms + "ms");
	 */
	q?: CharacterQueue;
	/** Secondary focus target name (`parent.xtarget`). */
	focus?: string;
	/** Owner account id (empty when private). */
	owner?: string;
	/** Guild tag when applicable. */
	guild?: string;
	/** Merchant stand type / flag. */
	stand?: boolean | string;
	/** Age in days. */
	age?: number;
	/** Cosmetics currently equipped (slot → id). */
	cx?: CharacterCosmeticInfos;
	/** Owned cosmetics inventory (id → count). */
	acx?: CharacterOwnedCosmetics;
	/** Friend owner ids. */
	friends?: string[];
	/** Approx party DPS share metric. */
	pdps?: number;
	/** Team id (events / PVP modes). */
	team?: string;
	/** `true` while CODE is running. */
	code?: boolean;
	/** Becomes true after mouse activity (AFK detection). */
	afk?: boolean | string;
	/** Monsters currently targeting you. */
	targets?: number;
	/** Call-code cost accumulator. */
	cc?: number;
	/** Vision rectangle half-sizes, e.g. `[700, 500]`. */
	vision?: [number, number];
	/** Base stats. */
	str?: number;
	int?: number;
	dex?: number;
	vit?: number;
	/** Fortitude — PVP damage reduction %. */
	for?: number;
	mp_cost?: number;
	evasion?: number;
	miss?: number;
	reflection?: number;
	lifesteal?: number;
	manasteal?: number;
	rpiercing?: number;
	apiercing?: number;
	crit?: number;
	dreturn?: number;
	courage?: number;
	mcourage?: number;
	pcourage?: number;
	fear?: number;
	tax?: number;
	xpm?: number;
	luckm?: number;
	goldm?: number;
}

/** Documented character event names — prefer {@link CharacterEvents} for payload typing. */
type CharacterListener = {
	f: (...args: unknown[]) => void;
	id: string;
	event: string;
	once?: boolean;
};

/**
 * Your live CODE character also implements {@link CodeEventEmitter}<{@link CharacterEvents}>.
 *
 * @example
 * character.on("loot", (data) => game_log("Looted " + data.gold + " gold"));
 * character.on("cm", (data) => game_log(data.name + ": " + JSON.stringify(data.message)));
 * character.on("death", () => setTimeout(respawn, 15000));
 * character.on("level_up", (data) => game_log("Level " + data.level + "!"));
 */
interface Character extends CodeEventEmitter<CharacterEvents> {
	/**
	 * Typed CM helper — `message` is generic for your payload shape.
	 * @example
	 * character.on<{ cmd: string }>("cm", (data) => {
	 *   if (data.message.cmd === "come") smart_move(data.name);
	 * });
	 */
	on<T = unknown>(event: "cm", handler: (data: { name: string; message: T; date?: Date | string; local?: boolean }) => void): string;
}

interface ItemInfo {
	/** Item id — autocomplete via {@link ItemKey}. */
	name: ItemKey;
	/** Upgrade / compound level. */
	level?: number;
	/** Stack quantity (stackables only). */
	q?: number;
	/** Gifted starter items sell for 1 gold. */
	gift?: 1 | number;
	/** Scroll / elixir stat type (e.g. `"str"`). */
	stat_type?: StatType;
	/** Expiry timestamp string for temporary items / elixirs. */
	expires?: string;
	/** Special prefix / variant. */
	p?: "festive" | "firehazard" | "glitched" | "gooped" | "legacy" | "lucky" | "shiny" | "superfast" | string;
	/** Trade listing id (merchant slots). */
	rid?: string;
	/** Listed price (trade / wishlist). */
	price?: number;
	/** `true` when this trade slot is a buy offer. */
	b?: boolean;
	/** Giveaway participants keyed by id → player name. */
	registry?: Record<string, string>;
	/** mluck source character name. */
	m?: string;
	/** Charges remaining (e.g. chests). */
	charges?: number;
	/** Achievement id when applicable. */
	ach?: string;
	/** PVP / timed item marker. */
	v?: string;
	/** Accrue / internal counter on some items. */
	acc?: number;
	/** Ponty / cash shop related. */
	cash?: number;
	/** Extra prefix list. */
	ps?: string[];
	l?: string;
	ld?: string;
}

interface GameInfo extends CodeEventEmitter<GameEvents> {
	platform: "electron" | "web" | string;
	graphics: boolean;
	html: boolean;
	cli?: boolean;
}

interface ServerInfo {
	mode: string;
	pvp: boolean;
	region: string;
	id: string;
}

/**
 * Party member entry from {@link get_party} / `parent.party`.
 * Inspect with `show_json(get_party())`.
 */
interface PartyMember {
	/** Often equals the object key. */
	name?: string;
	map: MapKey | string;
	in: string;
	x: number;
	y: number;
	hp?: number;
	max_hp?: number;
	mp?: number;
	max_mp?: number;
	level: number;
	/** Class id (party payload historically uses `type`). */
	type: ClassKey | string;
	ctype?: ClassKey | string;
	skin: string;
	cx?: CharacterCosmeticInfos;
	rip?: boolean;
	/** Party XP share fraction (0–1). */
	share: number;
	pdps?: number;
	/** Party size when this party snapshot was built. */
	l?: number;
	/** Party gold share contribution. */
	gold?: number;
	/** Party XP share contribution. */
	xp?: number;
	/** Party luck share contribution. */
	luck?: number;
}

/** Open chest on the map (`parent.chests` / {@link get_chests}). */
interface ChestInfo {
	id?: string;
	x?: number;
	y?: number;
	map?: MapKey | string;
	/** Number of item rolls still in the chest. */
	items?: number;
	/** Set by loot helpers to throttle reopen attempts. */
	last_loot?: Date | number;
	/** Extra sprite / client fields on live chest entities. */
	[key: string]: unknown;
}

/** Result of {@link find_npc}. */
interface NpcLocation {
	map: MapKey | string;
	in: string;
	x: number;
	y: number;
}

/**
 * Optional filters for {@link get_nearest_monster}.
 * Pass an object with any of the fields below.
 */
interface NearestMonsterFilter {
	/** Minimum XP the monster must grant. */
	min_xp?: number;
	/** Skip monsters with attack above this value. */
	max_att?: number;
	/**
	 * Monster **mtype** id (e.g. `"goo"`, `"bee"`).
	 * Do **not** pass `"monster"` — that is `entity.type`, not the species.
	 */
	type?: MonsterKey;
	/** Only return a monster you can walk straight to (`can_move_to`). */
	path_check?: boolean;
	/**
	 * Prefer free monsters: skips ones that already have a target
	 * (unless that target is you).
	 */
	no_target?: boolean;
	/** Only monsters currently targeting this player name or entity. */
	target?: string | Entity;
}

/**
 * Optional filters for {@link get_nearest_hostile}.
 * Finds the nearest hostile **player** (not monsters).
 */
interface NearestHostileFilter {
	/**
	 * When true (default if `character.owner` is set), skip friends
	 * (`parent.friends` by owner id).
	 */
	friendship?: boolean;
	/** Player names to skip, e.g. `{ exclude: ["Wizard"] }`. */
	exclude?: string[];
}

/** `{ num, slot? }` entry for {@link equip_batch}. */
interface EquipBatchEntry {
	num: number;
	slot?: SlotType;
}

/** Successful {@link smart_move} resolution. */
interface SmartMoveSuccess {
	success: true;
}

/** Failed / interrupted {@link smart_move} rejection payload. */
interface SmartMoveFailure {
	success?: false;
	reason: string;
}

type SmartMoveResult = SmartMoveSuccess | SmartMoveFailure;
