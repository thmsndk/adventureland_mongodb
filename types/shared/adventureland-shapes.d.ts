/**
 * Rich CODE object shapes (shared + Monaco).
 * First-party AdventureLand types (entities, status, items, queues, …).
 */

/** Scroll / elixir applied secondary attribute. */
type StatType =
	| "armor"
	| "attack"
	| "dex"
	| "for"
	| "frequency"
	| "gold"
	| "xp"
	| "hp"
	| "mp"
	| "int"
	| "lifesteal"
	| "luck"
	| "mp_cost"
	| "mp_reduction"
	| "range"
	| "resistance"
	| "speed"
	| "str"
	| "vit"
	| "stat"
	| "evasion"
	| "reflection"
	| "manasteal"
	| "rpiercing"
	| "apiercing"
	| "crit"
	| "dreturn"
	| "output";

/** Inventory boosters that {@link shift} cycles between. */
type BoosterKey = "goldbooster" | "luckbooster" | "xpbooster";

/** Merchant / trade listing item (equipment slots never use this). */
interface TradeItemInfo extends ItemInfo {
	/** Required to buy/sell against this listing. */
	rid: string;
	price: number;
	/** Buy offer / wishlist listing. */
	b?: boolean;
	giveaway?: number;
	list?: string[];
	gf?: string;
}

/** Equipped elixir slot shape (`character.slots.elixir`). */
interface EquippedElixirItemInfo extends ItemInfo {
	/** Often set on active elixirs. */
	ex?: boolean;
	/** ISO expiry timestamp. */
	expires?: string;
}

/**
 * Inventory placeholder while upgrade / compound / exchange is running
 * (`character.items[n].name === "placeholder"`).
 */
interface InventoryPlaceholderItem {
	name: "placeholder";
	p?: {
		chance: number;
		name: ItemKey;
		level: number;
		scroll: ItemKey;
		nums: [number, number] | number[];
	};
	q?: number;
	level?: number;
}

/** Equipment + trade slots on your character / merchants. */
type CharacterSlots = {
	[K in Exclude<SlotType, "elixir">]: ItemInfo | null;
} & {
	elixir: EquippedElixirItemInfo | ItemInfo | null;
} & {
	[K in TradeSlotType]?: TradeItemInfo | null;
};

/** Inventory cell — real item, null, or in-progress placeholder. */
type InventoryItem = ItemInfo | InventoryPlaceholderItem | null;

/** Fixed-length tuple helper (typed-AL `Tuple`). */
type Tuple<T, N extends number, R extends unknown[] = []> = R["length"] extends N ? R : Tuple<T, N, [...R, T]>;

/** Skill target as id string or `{ id }`. */
type SkillTarget = string | { id: string } | Entity;

/**
 * Entity / point for {@link can_move} geometry checks.
 * Needs `going_x` / `going_y` (destination) and usually `map`.
 */
interface CanMoveEntity {
	map?: MapKey | string;
	x: number;
	y: number;
	going_x: number;
	going_y: number;
	base?: { h: number; v: number | null; vn: number };
}

/** Smart path node (elements of `smart.plot`). */
interface PositionSmart extends Point {
	map?: MapKey | string;
	/** BFS back-link index into the search queue. */
	i?: number;
	/** When true, this node triggers a `transport` emit. */
	transport?: boolean;
	/** Spawn / door index for `transport` (`s`). */
	s?: number;
}

/** Base status duration entry. */
interface StatusInfoBase {
	ms: number;
}

/**
 * Typed `entity.s` / `character.s` conditions.
 * Known keys use specialized shapes; others are `{ ms }` / `false`.
 *
 * @example
 * if (character.s.monsterhunt) {
 *   smart_move(character.s.monsterhunt.id);
 * }
 * if (character.s.mluck) game_log("Luck from " + character.s.mluck.f);
 * if (character.s.cursed) use_skill("purify", character);
 * if (character.s.energized) game_log("energized by " + character.s.energized.f);
 */
interface StatusInfoKnown {
	monsterhunt: {
		/** Kills remaining. */
		c: number;
		dl?: boolean;
		/** Monster to hunt. */
		id: MonsterKey;
		ms: number;
		/** Server key where the hunt is valid. */
		sn: string;
	};
	/** Beekeeper quest progress (similar shape to monsterhunt when active). */
	quest_beekeeper: {
		c?: number;
		id?: MonsterKey | string;
		ms: number;
		sn?: string;
		f?: string;
	};
	mluck: { f: string; ms: number; strong?: boolean };
	burned: {
		f: string;
		fid?: string;
		intensity?: number;
		duration?: number;
		ms: number;
		last?: string;
	};
	magiport: {
		f: string;
		map: MapKey | string;
		in: string;
		x: number;
		y: number;
		ms: number;
	};
	cursed: { ms: number; duration?: number; f?: string };
	marked: { ms: number; duration?: number; f?: string };
	poisoned: { ms: number; duration?: number; f?: string };
	poisonous: { ms: number; f?: string };
	darkblessing: { f?: string; ms: number };
	rspeed: { f?: string; ms: number };
	warcry: { f?: string; ms: number };
	hardshell: { ms: number };
	block: { f: string; ms: number };
	hopsickness: { duration?: number; ms: number };
	sugarrush: { duration?: number; ms: number };
	xshotted: { duration?: number; ms: number };
	multi_burn: { ms: number; ability?: boolean };
	newcomersblessing: { f?: string; ms: number; [key: string]: unknown };
	citizen0aura: { citizens?: boolean; luck?: number; ms: number; name?: string; skin?: string };
	citizen4aura: { citizens?: boolean; gold?: number; ms: number; name?: string; skin?: string };
	stunned: boolean | StatusInfoBase;
	fingered: boolean | StatusInfoBase;
	deepfreezed: boolean | StatusInfoBase;
	sleeping: boolean | StatusInfoBase;
	invincible: boolean | StatusInfoBase;
	invis: boolean | StatusInfoBase;
	blink: { d?: number; in?: string; map?: string; ms: number; x?: number; y?: number };
	coop: { id?: string; ms: number; p?: number };
	stack: { ms: number; s?: number };
	/** Mage energize — frequency buff from caster `f`. */
	energized: { f?: string; ms: number };
	/** Priest reflective shield. */
	reflection: { f?: string; ms: number };
	charging: { ms: number };
	dash: { ms: number };
	dampened: { ms: number };
	frozen: { ms: number; f?: string };
	stoned: boolean | StatusInfoBase;
	tangled: { ms: number; f?: string };
	woven: { ms: number; f?: string };
	shocked: { ms: number; f?: string };
	weakness: { ms: number; f?: string };
	withdrawal: { ms: number };
	slowness: { ms: number; f?: string };
	charmed: { ms: number; f?: string };
	phasedout: { ms: number };
	/** Skill / action penalty timer (stacks up to a cap). */
	penalty_cd: { ms: number };
	massproduction: { ms: number };
	massproductionpp: { ms: number };
	massexchange: { ms: number };
	massexchangepp: { ms: number };
	mcourage: { ms: number };
	mfrenzy: { ms: number };
	mshield: { ms: number; f?: string };
	mlifesteal: { ms: number; f?: string };
	eheal: { ms: number; f?: string };
	eburn: { ms: number; f?: string; intensity?: number };
	power: { ms: number };
	xpower: { ms: number };
	purifier: { ms: number };
	sanguine: { ms: number };
	fullguard: { ms: number };
	fullguardx: { ms: number };
	holidayspirit: { ms: number };
	easterluck: { ms: number };
	halloween0: { ms: number };
	halloween1: { ms: number };
	halloween2: { ms: number };
	patronsgrace: { f?: string; ms: number };
	licenced: { ms: number };
	notverified: { ms: number };
	authfail: { ms: number };
	beekeeper_aura: { ms: number; name?: string; skin?: string };
	bee_pheromones_attack: { ms: number };
	bee_pheromones_heal: { ms: number };
	/** Channel indicators also mirrored on `character.c` while active. */
	fishing: { ms: number };
	mining: { ms: number };
	pickpocket: { ms: number; target?: string };
	town: { ms: number };
}

/**
 * `entity.s` / `character.s` — specialized shapes win over the generic `{ ms }` bag.
 */
type StatusInfo = {
	[K in ConditionKey]?: K extends keyof StatusInfoKnown ? StatusInfoKnown[K] : StatusInfoBase | false;
};

/** Channeling actions on `entity.c` / `character.c`.
 * @example
 * if (character.c.town) stop("town");
 * while (character.c.town) await sleep(50);
 */
interface EntityChannels {
	town?: { ms: number };
	revival?: { ms?: number; f: string };
	fishing?: { ms: number; drop?: string };
	mining?: { ms: number; drop?: string };
	pickpocket?: { ms: number; target: string };
	[channel: string]: ChannelState | undefined;
}

/** Progressed actions on `character.q`.
 * @example
 * while (character.q.exchange) await sleep(100);
 * if (!character.q.upgrade) upgrade(0, locate_item("scroll0"));
 */
interface CharacterQueueAction {
	ms?: number;
	len?: number;
	num?: number | string;
	nums?: number[];
	name?: ItemKey | string;
	id?: string;
	q?: number;
	qs?: string;
	s?: string;
	v?: string | number;
	silent?: boolean;
	stale?: boolean;
	[key: string]: unknown;
}

interface CharacterQueue {
	upgrade?: {
		ms: number;
		len?: number;
		num: number | string;
		/** True for silent / background upgrades. */
		silent?: boolean;
		stale?: boolean;
	};
	compound?: {
		ms: number;
		len?: number;
		num: number | string;
		/** Inventory indices involved in the compound. */
		nums?: number[];
		stale?: boolean;
	};
	exchange?: {
		ms: number;
		len?: number;
		name: ItemKey | string;
		num: number;
		q?: number;
		id?: string;
		qs?: string;
		/** Name suffix used for some exchange tables. */
		s?: string;
		/** Item `v` / variant when relevant. */
		v?: string | number;
		stale?: boolean;
	};
	/** Brief lock while rearranging equipment / CX slots. */
	slots?: {
		ms: number;
		len?: number;
		stale?: boolean;
	};
	[action: string]: CharacterQueueAction | undefined;
}

/** Resolved combat/stat bag from {@link item_properties}. */
interface ItemProperties {
	armor?: number;
	resistance?: number;
	attack?: number;
	range?: number;
	speed?: number;
	str?: number;
	int?: number;
	dex?: number;
	vit?: number;
	for?: number;
	hp?: number;
	mp?: number;
	miss?: number;
	evasion?: number;
	reflection?: number;
	lifesteal?: number;
	manasteal?: number;
	rpiercing?: number;
	apiercing?: number;
	crit?: number;
	dreturn?: number;
	frequency?: number;
	mp_cost?: number;
	gold?: number;
	xp?: number;
	luck?: number;
	[stat: string]: number | undefined;
}

interface CompoundCalculateResponse {
	calculate: boolean;
	chance: number;
	item?: ItemInfo;
	scroll?: string;
	grace?: number;
	success?: boolean;
	response?: string;
	place?: string;
}

interface CompoundSuccessResponse {
	success: boolean;
	level: number;
	num: number;
}

interface UpgradeCalculateResponse {
	calculate: boolean;
	chance: number;
	item?: ItemInfo;
	scroll?: string;
	grace?: number;
	success?: boolean;
	response?: string;
	place?: string;
}

interface UpgradeSuccessResponse {
	success: boolean;
	level: number;
	num: number;
}

interface CraftSuccessResponse {
	success: true;
	response: "craft";
	place: "craft";
	name: ItemKey;
	num: number;
}

interface ExchangeSuccessResponse {
	success: boolean;
	reward?: ItemKey | string;
	num?: number;
}

/** Live world-event monster entry in `parent.S` (coordinates may be omitted, e.g. slenderman). */
type SMonsterEventLive = {
	live: true;
	map: MapKey | string;
	hp: number;
	max_hp: number;
	x?: number;
	y?: number;
	target?: string | null;
	end?: Date | string;
};
type SMonsterEvent = BetterUX<SMonsterEventLive | { live: false; spawn: string }>;
/** Event bosses that always publish map coordinates when live. */
type SMonsterEventWithCoordinates = BetterUX<(SMonsterEventLive & { x: number; y: number }) | { live: false; spawn: string }>;

/**
 * Live server events (`parent.S`) — spawn flags and boss coordinates.
 * Inspect with `show_json(parent.S)`.
 * @example
 * if (parent.S?.franky?.live) smart_move({ map: parent.S.franky.map, x: parent.S.franky.x, y: parent.S.franky.y });
 */
interface SEventsInfos {
	schedule?: {
		time_offset?: number;
		dailies?: number[];
		nightlies?: number[];
		night?: boolean;
	};
	egghunt?: boolean;
	valentines?: boolean;
	lunarnewyear?: boolean;
	holidayseason?: boolean;
	halloween?: boolean;
	wabbit?: SMonsterEventWithCoordinates;
	pinkgoo?: SMonsterEvent;
	snowman?: SMonsterEventWithCoordinates;
	grinch?: SMonsterEventWithCoordinates;
	franky?: SMonsterEventWithCoordinates;
	dragold?: SMonsterEventWithCoordinates;
	tiger?: SMonsterEvent;
	mrpumpkin?: SMonsterEventWithCoordinates;
	mrgreen?: SMonsterEventWithCoordinates;
	slenderman?: SMonsterEvent;
	icegolem?: SMonsterEventWithCoordinates;
	crabxx?: SMonsterEventWithCoordinates;
	goobrawl?: { end?: string; join?: boolean };
	abtesting?: {
		end?: string;
		signup_end?: string;
		A?: number;
		B?: number;
		id?: string;
		join?: boolean;
	};
	[event: string]: unknown;
}

/**
 * Tracktrix / achievement tracker (`parent.tracker`).
 * @example
 * show_json(parent.tracker?.monsters);
 */
/** Drop discoveries for a monster (Tracktrix `tracker.drops[monster]`). */
type TrackerDropList = unknown[];

interface Tracker {
	monsters?: Partial<Record<MonsterKey, number>>;
	monsters_diff?: Partial<Record<MonsterKey, number>>;
	exchanges?: Partial<Record<ItemKey | string, number>>;
	maps?: Partial<Record<MapKey | string, number>>;
	tables?: Record<string, number>;
	max?: { monsters?: Partial<Record<MonsterKey, [score: number, char: string]>> };
	/** Items found while killing — keyed by monster id. */
	drops?: Partial<Record<MonsterKey | string, TrackerDropList>>;
	/** Home-server drop discoveries (same shape as {@link Tracker.drops}). */
	drops_home?: Partial<Record<MonsterKey | string, TrackerDropList>>;
	global?: Record<string, number>;
	global_static?: Record<string, number>;
}

/** Account meta blob (`parent.X`). */
interface ParentXInfo {
	characters?: OnlineCharacter[];
	servers?: ServerListing[];
}

/** Skills that take no target argument. */
type SkillKeyNoTarget = Extract<
	SkillKey,
	| "agitate"
	| "alchemy"
	| "charge"
	| "cleave"
	| "darkblessing"
	| "dash"
	| "fishing"
	| "hardshell"
	| "invis"
	| "light"
	| "massproduction"
	| "massproductionpp"
	| "mcourage"
	| "mining"
	| "mshield"
	| "partyheal"
	| "scare"
	| "selfheal"
	| "stomp"
	| "warcry"
	| "use_hp"
	| "use_mp"
	| "use_town"
	| "regen_hp"
	| "regen_mp"
>;

/** Skills that normally take a single entity / id target. */
type SkillKeyTargeted = Extract<
	SkillKey,
	| "4fingers"
	| "absorb"
	| "attack"
	| "burst"
	| "charm"
	| "curse"
	| "heal"
	| "huntersmark"
	| "magiport"
	| "mentalburst"
	| "mluck"
	| "pickpocket"
	| "piercingshot"
	| "purify"
	| "quickpunch"
	| "quickstab"
	| "reflection"
	| "rspeed"
	| "smash"
	| "snowball"
	| "supershot"
	| "taunt"
	| "zapperzap"
>;

/** Skills that need an inventory item (no separate target). */
type SkillKeyItemNeeded = Extract<SkillKey, "pcoat" | "shadowstrike">;

/** Skills that need both a target and an inventory item. */
type SkillKeyItemAndTarget = Extract<SkillKey, "entangle" | "poisonarrow" | "revive" | "snowball">;

/** Skills that need `[x, y]` coordinates. */
type SkillKeyCoordinates = Extract<SkillKey, "blink">;
