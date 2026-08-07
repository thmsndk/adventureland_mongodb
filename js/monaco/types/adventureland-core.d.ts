/**
 * AdventureLand CODE core types — globals, Entity, filters (IDE only).
 * API functions live in adventureland-api.d.ts.
 * Sources: docs/directory.js + js/runner_functions.js.
 *
 * Browser/ES builtins come from Monaco `lib: ["es2020","dom"]` (not a hand shim).
 * `parent` is the game frame (`Window` from lib.dom) plus the fields below.
 */

/** Game frame properties exposed on `parent` / the runner window. */
interface Window {
	character: Character;
	entities: { [id: string]: Entity };
	G: GCatalog;
	/** Steam / desktop Electron client. */
	is_electron?: boolean;
	/** Headless / CLI bot runner. */
	is_cli?: boolean;
	is_pvp?: boolean;
	is_bot?: boolean;
	no_graphics?: boolean;
	no_html?: boolean;
	gameplay?: string;
	server_region?: string;
	server_identifier?: string;
	friends?: string[];
	/** Socket / runner helpers — prefer typed CODE APIs when available. */
	socket?: any;
	distance?: (a: any, b: any) => number;
	start_character_runner?: (name: string, code_slot_or_name?: string | number) => any;
	stop_character_runner?: (name: string) => void;
	CLI_OUT?: any[];
	cli_require?: (id: string) => any;
	ls_emulation?: Storage;
	RESOLVE_ALL?: boolean;
	parent?: Window;
}

/**
 * Your character — a proxy over `parent.character`.
 * In CODE, `character.x` / `character.y` already return precise coords
 * (aliased to `parent.character.real_x` / `real_y`); setters are blocked.
 * Prefer helpers like {@link move} rather than assigning coordinates.
 */
declare const character: Character;

/**
 * Nearby entities keyed by id (monsters, players, NPCs in your viewport).
 *
 * Reliable access is `parent.entities`. A bare `entities` global is **not**
 * always defined in the CODE runner — prefer `parent.entities` or helpers
 * like {@link get_nearest_monster} / {@link get_entity}.
 */
declare const entities: { [id: string]: Entity };

/**
 * When `true` (default), some helpers throttle bursty socket traffic that can
 * disconnect you (e.g. {@link say}, {@link loot}, {@link use_hp_or_mp}).
 * Unrelated to {@link safe_log}, which always HTML-escapes.
 */
declare const safeties: boolean;

/** Client / runtime info (`platform`, `graphics`, `html`, …). */
declare const game: GameInfo;

/** Current server (`region`, `id`, `pvp`, …). Use {@link in_pvp} for map+server PVP. */
declare const server: ServerInfo;

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
	hp: number;
	max_hp: number;
	mp: number;
	max_mp: number;
	xp?: number;
	attack?: number;
	map?: MapKey;
	in?: string;
	level?: number;
	range?: number;
	speed?: number;
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
	/** Active status conditions keyed by {@link ConditionKey} (`s.cursed`, `s.stunned`, …). */
	s?: Partial<Record<ConditionKey, any>>;
	/** Active channels / cast states (e.g. `c.town`). */
	c?: { [channel: string]: any };
}

/** Visible monster (`type === "monster"`). Species id is {@link MonsterKey} on `mtype`. */
interface MonsterEntity extends EntityBase {
	type: "monster";
	/** Monster species id (e.g. `"goo"`). See `show_json(G.monsters)`. */
	mtype: MonsterKey;
	monster?: true;
	/** True / reason string when defeated or out of vision. */
	dead?: boolean | string;
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
 * Your character — extends {@link CharacterEntity} with inventory / gold.
 */
interface Character extends CharacterEntity {
	name: string;
	ctype?: ClassKey;
	gold: number;
	xp: number;
	max_xp?: number;
	/** Inventory slots; empty slots are `null`. */
	items: (ItemInfo | null)[];
	/** Equipped gear + optional trade slots. */
	slots: Partial<Record<SlotType | TradeSlotType, ItemInfo | null>>;
	range: number;
	bot?: boolean;
}

interface ItemInfo {
	/** Item id — autocomplete via {@link ItemKey}. */
	name: ItemKey;
	/** Upgrade / compound level. */
	level?: number;
	/** Stack quantity. */
	q?: number;
	gift?: number;
	/** Extra server fields (`stat_type`, `expires`, …). */
	[key: string]: any;
}

interface GameInfo {
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
