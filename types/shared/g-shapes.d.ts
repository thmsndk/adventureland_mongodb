/**
 * Deep G* value shapes - first-party AdventureLand types (shared + Monaco).
 * Key unions: g-keys.d.ts (from design/). Catalog wiring: g-catalog.d.ts.
 * Owned first-party source - edit in place.
 */

/** Item `type` field in `G.items`. */
// from items\index.ts
type ItemType =
	| "activator"
	| "amulet"
	| "bank_key"
	| "belt"
	| "booster"
	| "box"
	| "cape"
	| "chest"
	| "chrysalis"
	| "computer"
	| "container"
	| "cosmetics"
	| "cscroll"
	| "dungeon_key"
	| "earring"
	| "elixir"
	| "flute"
	| "gem"
	| "gloves"
	| "helmet"
	| "jar"
	| "licence"
	| "material"
	| "misc"
	| "misc_offhand"
	| "offering"
	| "orb"
	| "pants"
	| "petlicence"
	| "placeholder"
	| "pot"
	| "pscroll"
	| "qubics"
	| "quest"
	| "quiver"
	| "ring"
	| "shield"
	| "shoes"
	| "skill_item"
	| "source"
	| "spawner"
	| "stand"
	| "stone"
	| "test"
	| "throw"
	| "token"
	| "tome"
	| "tool"
	| "tracker"
	| "uscroll"
	| "weapon"
	| "xp";

// from maps\Maps.ts
type MapZoneKey = "fishing" | "mining";

// from npcs\Npcs.ts
type NpcRole =
	| "blocker"
	| "bouncer"
	| "citizen"
	| "companion"
	| "compound"
	| "craftsman"
	| "cx"
	| "events"
	| "exchange"
	| "friendtokens"
	| "funtokens"
	| "gold"
	| "guard"
	| "items"
	| "jailer"
	| "locksmith"
	| "lostandfound"
	| "lottery"
	| "mcollector"
	| "merchant"
	| "monstertokens"
	| "newupgrade"
	| "newyear_tree"
	| "petkeeper"
	| "premium"
	| "pvp_announcer"
	| "pvptokens"
	| "quest"
	| "repeater"
	| "resort"
	| "rewards"
	| "santa"
	| "secondhands"
	| "shells"
	| "ship"
	| "shrine"
	| "standmerchant"
	| "tavern"
	| "tease"
	| "thesearch"
	| "transport"
	| "witch";

// from items\index.ts — OffhandType hand-curated; WeaponType generated in g-keys.d.ts
type OffhandType = "dagger" | "fist" | "mace" | "misc_offhand" | "quiver" | "shield" | "short_sword" | "source" | "stars" | "sword";

// from geometry\Geometry.ts
interface GGeometry {
	tiles: Array<[string, number, number, number] | [string, number, number, number, number] | [string, number, number, number, null, number]>;
	min_x: number;
	min_y: number;
	default?: number;
	y_lines?: Array<[number, number, number]>;
	points?: Record<string, [number, number]>;
	lights?: Array<[number, number, number]>;
	x_lines?: Array<[number, number, number]>;
	placements: Array<[number, number, number] | Tuple<number, 5>>;
	groups?: Array<Array<[number, number, number] | [number, number, number, null, null, number]>>;
	rectangles?: Record<string, [number, number, number, number]>;
	max_x: number;
	max_y: number;
	polygons?: Record<string, Array<[number, number]>>;
	nights?: Array<[number, number, number, null, null, number, number, number]>;
	animations?: Array<[number, number, number, number, number, number, string, number]>;
}

// from monsters\Monsters.ts
type GMonsterAbilities = {
	anger?: {
		cooldown: number;
		radius: number;
	};
	burn?: {
		attr0: number;
		unlimited: boolean;
	};
	curse_aura?: {
		aura: boolean;
		condition: ConditionKey;
		cooldown: number;
		radius: number;
	};
	dampening_aura?: {
		aura: boolean;
		condition: ConditionKey;
		cooldown: number;
		radius: number;
	};
	deepfreeze?: {
		cooldown: number;
		radius: number;
	};
	degen?: {
		amount: number;
		cooldown: number;
	};
	heal?: {
		cooldown: number;
		heal: number;
	};
	healing?: {
		cooldown: number;
		heal: number;
	};
	mlight?: {
		cooldown: number;
	};
	mtangle?: {
		cooldown: number;
	};
	multi_burn?: {
		cooldown: number;
		damage: number;
	};
	multi_freeze?: {
		cooldown: number;
		damage: number;
	};
	portal?: {
		cooldown: number;
	};
	putrid?: {
		curse: boolean;
		poison: boolean;
	};
	self_healing?: {
		cooldown: number;
		heal: number;
	};
	stone?: {
		cooldown: number;
	};
	tangle?: {
		cooldown: number;
	};
	warp_on_hit?: {
		attr0: number;
		unlimited: boolean;
	};
	warpstomp?: {
		cooldown: number;
		radius: number;
		stun: number;
	};
	weakness_aura?: {
		aura: boolean;
		condition: ConditionKey;
		cooldown: number;
		radius: number;
	};
	zap?: {
		amount: number;
		cooldown: number;
		pure: boolean;
		radius: number;
	};
};

// from utils.ts
type AllKeys<Terface> = Terface extends any ? keyof Terface & (string | number | symbol) : never;

/** Creates a new interface adding the missing keys to Terface */

// from utils.ts
type BetterUX<Terface, Keys extends AllKeys<Terface> = AllKeys<Terface>> = Terface extends any ? Wrap<Terface, Keys> : never;

/** Builds a tuple containing N times the type T. */
// CraftKey is generated in g-keys.d.ts from design/recipes.js

// from utils.ts
type Debug<Terface> = Terface extends infer O ? { [K in keyof O]: O[K] } : never;

/** Creates a union of all keys of all objects in the Terface union */

// from utils.ts
type Tuple<T, N extends number> = N extends N ? (number extends N ? T[] : _TupleOf<T, N, []>) : never;

type _TupleOf<T, N extends number, R extends unknown[]> = R["length"] extends N ? R : _TupleOf<T, N, [T, ...R]>;

// from utils.ts
type Wrap<Terface, Keys extends string | number | symbol> = Terface & {
	[K in Exclude<Keys, keyof Terface>]?: undefined;
};

/** Distributes the union and automatically add the missing keys */

// from achievements\Achievements.ts
interface GAchievement {
	count?: number;
	explanation?: string;
	name: string;
	title?: string;
	rr?: number;
	shells?: number;
	item?: ItemKey;
}

// from items\Activator.ts
interface GActivator {
	action: string;
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The full display name of an item. */
	name: string;
	onclick: string;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The skin of the item. */
	skin: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "activator";
}

// from games\Games.ts
type string = "dice" | "slots" | "tarot" | "wheel";

// from items\Amulet.ts
interface GAmulet {
	a?: boolean;
	apiercing?: number;
	armor?: number;
	attr0?: number;
	aura?: ItemKey;
	/** Contains information about what stats the item will gain with each compound level. Set if the item is compoundable. */
	compound?: {
		apiercing?: number;
		armor?: number;
		attr0?: number;
		crit?: number;
		critdamage?: number;
		dex?: number;
		dreturn?: number;
		evasion?: number;
		for?: number;
		hp?: number;
		int?: number;
		lifesteal?: number;
		mp_cost?: number;
		mp_reduction?: number;
		resistance?: number;
		str?: number;
		vit?: number;
		xp?: number;
	};
	crit?: number;
	critdamage?: number;
	dex?: number;
	dreturn?: number;
	edge?: number;
	evasion?: number;
	explanation?: string;
	for?: number;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	gold?: number;
	/** The first number refers to what level the item begins being `high` grade, the second for `rare`. */
	grades: [number, number, number, number];
	hp?: number;
	int?: number;
	lifesteal?: number;
	luck?: number;
	manasteal?: number;
	mp_cost?: number;
	mp_reduction?: number;
	/** The full display name of an item. */
	name: string;
	reflection?: number;
	resistance?: number;
	rpiercing?: number;
	/** The set this item is part of `G.sets.wanderers`. */
	set?: string;
	/** The skin of the item. */
	skin: ItemKey;
	str?: number;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "amulet";
	/** Contains information about what stats the item will gain with each upgrade level. Set if the item is upgradable. */
	upgrade?: {
		apiercing: number;
		rpiercing: number;
	};
	vit?: number;
	xp?: number;
}

// from animations\Animations.ts
interface GAnimation {
	frames: number;
	file: string;
	alpha?: number;
	aspeed?: string;
	tiling?: boolean;
	fade?: boolean;
	directional?: boolean;
	framefps?: number;
	continuous?: boolean;
	speed?: number;
	scale?: number;
	proportional?: boolean;
	front?: boolean;
	speeding?: boolean;
	bubble?: boolean;
	y?: number;
	exact?: boolean;
	size?: number;
}

// from items\ItemKey.ts
interface ItemKey {
	action: string;
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The full display name of an item. */
	name: string;
	onclick: string;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The skin of the item. */
	skin: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "bank_key";
	unlocks?: MapKey;
}

// from items\Belt.ts
interface GBelt {
	a?: boolean;
	armor?: number;
	/** Contains information about what stats the item will gain with each compound level. Set if the item is compoundable. */
	compound: {
		armor?: number;
		dex?: number;
		hp?: number;
		int?: number;
		mp_cost?: number;
		mp_reduction?: number;
		resistance?: number;
		speed?: number;
		str?: number;
	};
	dex?: number;
	evasion?: number;
	explanation?: string;
	for?: number;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The first number refers to what level the item begins being `high` grade, the second for `rare`. */
	grades: [number, number, number, number];
	hp?: number;
	int?: number;
	mp_cost?: number;
	mp_reduction?: number;
	/** The full display name of an item. */
	name: string;
	resistance?: number;
	/** The set this item is part of `G.sets.wanderers`. */
	set?: string;
	/** The skin of the item. */
	skin: ItemKey;
	speed?: number;
	str?: number;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "belt";
}

// from items\Booster.ts
interface GBooster {
	/** Contains information about what stats the item will gain with each compound level. Set if the item is compoundable. */
	compound: {
		gold?: number;
		luck?: number;
		xp?: number;
	};
	days: number;
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	gain: string;
	gold?: number;
	/** The first number refers to what level the item begins being `high` grade, the second for `rare`. */
	grades: [number, number, number, number];
	legacy?: {
		gold?: number;
		luck?: number;
	};
	luck?: number;
	/** The full display name of an item. */
	name: string;
	/** The skin of the item. */
	skin: ItemKey;
	skin_a: string;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "booster";
	xp?: number;
}

// from items\Box.ts
interface GBox {
	a: number | boolean;
	/** Refers to how many items are needed to exchange (see .quest as well!) */
	e: number;
	event?: boolean;
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	ignore?: boolean;
	/** The full display name of an item. */
	name: string;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The skin of the item. */
	skin: string;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "box";
}

// from items\Cape.ts
interface GCape {
	a?: boolean;
	action?: string;
	armor?: number;
	cuteness?: number;
	dex?: number;
	evasion?: number;
	explanation?: string;
	extra_stat?: number;
	firesistance?: number;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The first number refers to what level the item begins being `high` grade, the second for `rare`. */
	grades: [number, number, number, number];
	/** The full display name of an item. */
	name: string;
	onclick?: string;
	pnresistance?: number;
	reflection?: number;
	resistance?: number;
	scroll?: boolean;
	/** The set this item is part of `G.sets.wanderers`. */
	set?: string;
	/** The skin of the item. */
	skin: string;
	speed?: number;
	stat: number;
	str?: number;
	/** The tier of the item. */
	tier?: number;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "cape";
	/** Contains information about what stats the item will gain with each upgrade level. Set if the item is upgradable. */
	upgrade: {
		armor?: number;
		cuteness?: number;
		evasion?: number;
		firesistance?: number;
		pnresistance?: number;
		resistance?: number;
		speed?: number;
		stat: number;
	};
}

// from items\Chest.ts
interface GChest {
	a?: number | boolean;
	ability?: SkillKey;
	apiercing?: number;
	armor?: number;
	charge?: number;
	charisma?: number;
	/** An array of classes that can use this item. */
	class?: [ClassKey];
	dex?: number;
	dreturn?: number;
	edge?: number;
	evasion?: number;
	explanation?: string;
	extra_stat?: number;
	frequency?: number;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The first number refers to what level the item begins being `high` grade, the second for `rare`. */
	grades: [number, number, number, number];
	hp?: number;
	int?: number;
	lifesteal?: number;
	luck?: number;
	manasteal?: number;
	mp?: number;
	mp_cost?: number;
	/** The full display name of an item. */
	name: string;
	resistance?: number;
	rpiercing?: number;
	scroll?: boolean;
	/** The set this item is part of `G.sets.wanderers`. */
	set?: string;
	/** The skin of the item. */
	skin: string;
	speed?: number;
	stat?: number;
	str?: number;
	/** The tier of the item. */
	tier?: number;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "chest";
	/** Contains information about what stats the item will gain with each upgrade level. Set if the item is upgradable. */
	upgrade?: {
		apiercing?: number;
		armor?: number;
		dex?: number;
		evasion?: number;
		for?: number;
		hp?: number;
		int?: number;
		lifesteal?: number;
		luck?: number;
		manasteal?: number;
		mp_cost?: number;
		resistance?: number;
		rpiercing?: number;
		speed?: number;
		stat?: number;
		str?: number;
		vit?: number;
		xp?: number;
	};
	vit?: number;
	xp?: number;
}

// from items\Chrysalis.ts
interface GChrysalis {
	a: boolean;
	explanation?: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	grade: number;
	ignore: boolean;
	monster: MonsterKey;
	/** The full display name of an item. */
	name: string;
	/** The skin of the item. */
	skin: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "chrysalis";
}

// from classes\Classes.ts
interface GClass {
	armor: number;
	attack: number;
	base_slots: {
		mainhand: {
			gift: number;
			level: number;
			name: ItemKey;
		};
	};
	bmresistance?: number;
	brave?: boolean;
	courage: number;
	damage_type: string;
	description: string;
	/** Two-hand penalties / bonuses keyed by {@link WeaponType} (includes `great_sword`). */
	doublehand: {
		[Type in WeaponType]?: {
			frequency?: number;
			miss?: number;
			mp_cost?: number;
			speed?: number;
		};
	};
	frequency: number;
	fzresistance?: number;
	hp: number;
	looks: Tuple<[string, CharacterCosmeticInfos], 4>;
	/** Gained stats per level. */
	lstats: {
		dex: number;
		for: number;
		int: number;
		str: number;
		vit: number;
	};
	main_stat: string;
	mainhand: {
		[K in WeaponType]?: {
			apiercing?: number;
			frequency?: number;
			mp_cost?: number;
			output?: number;
			speed?: number;
		};
	};
	mcourage: number;
	mp: number;
	mp_cost: number;
	offhand: {
		[Type in OffhandType]?: {
			frequency?: number;
			speed?: number;
		};
	};
	output: number;
	pcourage: number;
	phresistance?: number;
	pnresistance?: number;
	projectile: string;
	range: number;
	resistance: number;
	side_stat?: string;
	speed: number;
	/** Base stats the class starts with. */
	stats: {
		dex: number;
		for: number;
		int: number;
		str: number;
		vit: number;
	};
	stresistance?: number;
	xcx?: Array<string>;
}

// from items\CompoundScroll.ts
interface GCompoundScroll {
	a?: boolean;
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	grade: number;
	markup?: number;
	/** The full display name of an item. */
	name: string;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The skin of the item. */
	skin: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "cscroll";
}

// from items\Computer.ts
interface GComputer {
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The full display name of an item. */
	name: string;
	/** The skin of the item. */
	skin: string;
	special: boolean;
	stand: string;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "computer";
}

// from conditions\Conditions.ts
interface GCondition {
	armor?: number;
	attr0?: string;
	aura?: boolean;
	blocked?: boolean;
	buff?: boolean;
	can_move?: boolean;
	cap_reflection?: number;
	channel?: boolean;
	courage?: number;
	damage?: number;
	debuff?: boolean;
	dex?: number;
	duration?: number;
	duration_min?: number;
	evasion?: number;
	explanation?: string;
	frequency?: number;
	frequencym?: number;
	gold?: number;
	heal?: number;
	healm?: number;
	incdmgamp?: number;
	intensity?: string;
	interval?: number;
	lifesteal?: number;
	luck?: number;
	mcourage?: number;
	miss?: number;
	mp?: number;
	mp_cost?: number;
	name: string;
	output?: number;
	pcourage?: number;
	persistent?: boolean;
	potionsm?: number;
	reflection?: number;
	resistance?: number;
	set_speed?: number;
	skin?: string;
	special?: ItemKey;
	speed?: number;
	str?: number;
	technical?: boolean;
	ui?: boolean;
	xp?: number;
}

// from items\Container.ts
interface GContainer {
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	grade: number;
	ignore: boolean;
	/** The full display name of an item. */
	name: string;
	/** The skin of the item. */
	skin: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "container";
}

// from cosmetics\Cosmetics.ts
interface GCosmetic {
	default_beard_position: number;
	default_face_position: number;
	default_hair_place: number;
	default_hat_place: number;
	default_head_place: number;
	default_makeup_position: number;
	bundle: Partial<Record<CosmeticBundleKey, Array<string>>>;
	gravestone: Partial<Record<CosmeticGravestoneKey, number>>;
	hair: Partial<Record<CosmeticHairKey, [number, number]>>;
	hat: Partial<Record<CosmeticHatKey, number>>;
	head: Partial<Record<CosmeticHeadKey, [string, string, string] | [string, string, string, number]>>;
	map: {
		old: "new";
	};
	no_upper: Array<never>;
	prop: Partial<Record<CosmeticPropKey, Array<string>>>;
}

// from items\CosmeticsItems.ts
interface GCosmeticItem {
	cash: number;
	/** Refers to how many items are needed to exchange (see .quest as well!) */
	e?: number;
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The full display name of an item. */
	name: string;
	/** Indicates the `quest` that this item is needed to complete. */
	quest: NpcRole;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The skin of the item. */
	skin: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "cosmetics";
}

// from craft\Craft.ts
interface GCraft {
	items: Array<[quantity: number, item: ItemKey] | [quantity: number, item: ItemKey, level: number]>;
	cost: number;
	quest?: NpcKey;
}

// from craft\Craft.ts
type GCrafts = Record<CraftKey, GCraft> & Partial<Record<Exclude<ItemKey, CraftKey>, undefined>>;

// from dimensions\Dimensions.ts
type GDimension = [number, number] | [number, number, number] | [number, number, number, number] | [number, number, number, number, number];

// from dismantle\Dismantle.ts
interface GDismantle {
	items: Array<[quantity: number, item: ItemKey]>;
	cost: number;
}

// from drops\Drops.ts
type GDropCX = [weight: number, type: "cx" | "cxbundle", cosmetic: string];

/** Map `event` field — {@link EventKey} plus map-only ids like pirateship (`design/maps.js`). */
type MapEventKey = EventKey | "pirateship";

// from drops\Drops.ts
type GDropGold = [weight: number, type: "gold", amount: number];

// from drops\Drops.ts
type GDropList = Array<GDropSimple | GDropGold | GDropOpenBox | GDropCX | GDropShells>;

// from drops\Drops.ts
type GDropMaps = Partial<Record<MapKey | "global" | "global_static", GDropList>>;

// from drops\Drops.ts
type GDropMonsters = Partial<Record<MonsterKey, GDropList>>;

// from drops\Drops.ts
type GDropNormalDrops = Record<GDropNormalKey, GDropList>;

// from drops\Drops.ts
type GDropNormalKey =
	| "5bucks"
	| "abtesting"
	| "abtesting_loser"
	| "apologybox"
	| "armorbox"
	| "armorx"
	| "basicelixir"
	| "basketofeggs"
	| "bugbountybox"
	| "candy0"
	| "candy0v2"
	| "candy0v3"
	| "candy1"
	| "candy1v2"
	| "candy1v3"
	| "candycane"
	| "candypop"
	| "cosmo0"
	| "cosmo1"
	| "cosmo2"
	| "cosmo3"
	| "eastereggs"
	| "f1"
	| "gem0"
	| "gem1"
	| "gem1_old"
	| "gemfragment"
	| "gift0"
	| "gift1"
	| "glitch"
	| "goldenegg"
	| "greenenvelope"
	| "jewellerybox"
	| "konami"
	| "leather"
	| "lglitch"
	| "lightmage"
	| "lostearring0"
	| "lostearring1"
	| "lostearring2"
	| "lostearring3"
	| "lostearring4"
	| "m1"
	| "m2"
	| "mistletoe"
	| "mysterybox"
	| "ornament"
	| "quiver"
	| "redenvelope"
	| "redenvelopev2"
	| "redenvelopev2_shouldhavebeen"
	| "redenvelopev3"
	| "redenvelopev4"
	| "seashell"
	| "statamulet"
	| "statbelt"
	| "statring"
	| "test"
	| "thrash"
	| "troll"
	| "weaponbox"
	| "weaponofthedead"
	| "xN"
	| "xbox";

// from drops\Drops.ts
type GDropOpenBox = [weight: number, type: "open", container: GDropsOpened];

// from drops\Drops.ts
type GDrops = GDropNormalDrops & {
	gold: {
		random: number;
		x10: number;
		base: number;
		x50: number;
	};

	/**
	 * Character skin unlock pools (`design/drops.js` → `G.drops.skins`).
	 * Tier weights in design comments: gold ~0.05, silver ~0.1, bronze ~0.8, normal ~0.05.
	 * Entries are cosmetic skin ids (e.g. `"mwarrior_cool"`), not {@link ItemKey}s.
	 */
	skins: {
		bronze: string[];
		silver: string[];
		gold: string[];
		normal: string[];
	};

	monsters: GDropMonsters;
	maps: GDropMaps;
};

// from drops\Drops.ts
type GDropShells = [weight: number, type: "5bucks" | "shells", amount: number];

// from drops\Drops.ts
type GDropSimple = [weight: number, item: ItemKey];

// from drops\Drops.ts
type GDropsOpened =
	"armorbox" | "armorx" | "basicelixir" | "basketofeggs" | "eastereggs" | "gem0" | "lglitch" | "lightmage" | "statamulet" | "statbelt" | "statring" | "thrash" | "weaponbox" | "weaponofthedead" | "xN";

// from items\ItemKey.ts
interface ItemKey {
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The full display name of an item. */
	name: string;
	opens: string;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The skin of the item. */
	skin: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "dungeon_key";
}

// from items\Earring.ts
interface GEarring {
	a?: boolean;
	apiercing?: number;
	/** Contains information about what stats the item will gain with each compound level. Set if the item is compoundable. */
	compound: {
		apiercing?: number;
		dex?: number;
		int?: number;
		luck?: number;
		str?: number;
		vit?: number;
	};
	dex?: number;
	/** Refers to how many items are needed to exchange (see .quest as well!) */
	e?: number;
	edge?: number;
	explanation?: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The first number refers to what level the item begins being `high` grade, the second for `rare`. */
	grades: [number, number, number, number];
	int?: number;
	luck?: number;
	/** The full display name of an item. */
	name: string;
	/** Indicates the `quest` that this item is needed to complete. */
	quest?: ItemKey;
	/** The set this item is part of `G.sets.wanderers`. */
	set?: string;
	/** The skin of the item. */
	skin: ItemKey;
	speed?: number;
	str?: number;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "earring";
	vit?: number;
}

// from items\Elixir.ts
interface GElixir {
	a?: boolean;
	apiercing?: number;
	armor?: number;
	crit?: number;
	dex?: number;
	duration: number;
	/** Refers to how many items are needed to exchange (see .quest as well!) */
	e?: number;
	eat?: boolean;
	evasion?: number;
	explanation?: string;
	firesistance?: number;
	fzresistance?: number;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	hp?: number;
	int?: number;
	lifesteal?: number;
	luck?: number;
	miss?: number;
	mp?: number;
	/** The full display name of an item. */
	name: string;
	pnresistance?: number;
	reflection?: number;
	resistance?: number;
	rpiercing?: number;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The set this item is part of `G.sets.wanderers`. */
	set?: string;
	/** The skin of the item. */
	skin: ItemKey;
	skin_a: ItemKey;
	speed?: number;
	str?: number;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "elixir";
	vit?: number;
	withdrawal?: ConditionKey;
}

// from items\Gem.ts
type ItemKey =
	| "candy0" // Rare Candy
	| "candy0v2" // Rare Candy [h2]
	| "candy0v3" // Rare Candy
	| "candy1" // Candy
	| "candy1v2" // Candy [h2]
	| "candy1v3" // Candy
	| "candycane" // Candy Cane
	| "gem0" // Raw Emerald
	| "gem1" // Tiny Ruby
	| "gem2" // Raw Diamond
	| "gem3" // Raw Colourful Diamond
	| "gift0" // Rare Gift
	| "gift1" // Gift
	| "greenenvelope" // Green Envelope
	| "mistletoe" // Mistletoe
	| "redenvelope" // Red Envelope
	| "redenvelopev2" // Red Envelope
	| "redenvelopev3" // Red Envelope
	| "redenvelopev4"; // Red Envelope

// from emotions\Emotions.ts
interface GEmotion {
	fx: string;
	cooldown: number;
}

// from geometry\Geometry.ts
type string =
	| "abtesting"
	| "arena"
	| "bank"
	| "bank_b"
	| "bank_u"
	| "cave"
	| "cgallery"
	| "crypt"
	| "cyberland"
	| "d_a1"
	| "d_a2"
	| "d_b1"
	| "d_e"
	| "d_g"
	| "desertland"
	| "duelland"
	| "dungeon0"
	| "goobrawl"
	| "halloween"
	| "hut"
	| "jail"
	| "level1"
	| "level2"
	| "level2e"
	| "level2n"
	| "level2s"
	| "level2w"
	| "level3"
	| "level4"
	| "main"
	| "mansion"
	| "mtunnel"
	| "resort"
	| "resort_e"
	| "shellsisland"
	| "ship0"
	| "spookytown"
	| "tavern"
	| "test"
	| "tomb"
	| "tunnel"
	| "winter_cave"
	| "winter_cove"
	| "winter_inn"
	| "winter_inn_rooms"
	| "winter_instance"
	| "winterland"
	| "woffice";

// from events\Events.ts
interface GEvent {
	duration: number;
	join?: boolean;
	modal: string;
	name: string;
	sprite: string;
	type: string;
}

// from items\Flute.ts
interface GFlute {
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The full display name of an item. */
	name: string;
	/** The skin of the item. */
	skin: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "flute";
}

// from games\Games.ts
interface GGame {
	gold?: number;
	slices?: Array<[string, "gold", number, string] | [string, "item", ItemKey, string]>;
	cards?: Tuple<string, 78>;
	hours?: number;
	npc?: string;
	glyphs?: Tuple<string, 10>;
}

// from items\Gem.ts
interface GGem {
	a?: number | boolean;
	/** Refers to how many items are needed to exchange (see .quest as well!) */
	e?: number;
	event?: boolean;
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	ignore?: boolean;
	/** The full display name of an item. */
	name: string;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The skin of the item. */
	skin: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "gem";
}

// from items\Gloves.ts
interface GGlove {
	a?: number | boolean;
	ability?: string;
	apiercing?: number;
	armor: number;
	attr0?: number;
	charge?: number;
	/** An array of classes that can use this item. */
	class?: [ClassKey];
	crit?: number;
	explanation?: string;
	extra_stat?: number;
	frequency?: number;
	fzresistance?: number;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	gold?: number;
	/** The first number refers to what level the item begins being `high` grade, the second for `rare`. */
	grades: [number, number, number, number];
	int?: number;
	/** The full display name of an item. */
	name: string;
	output?: number;
	resistance: number;
	rpiercing?: number;
	scroll?: boolean;
	/** The set this item is part of `G.sets.wanderers`. */
	set?: string;
	/** The skin of the item. */
	skin: string;
	speed?: number;
	stat?: number;
	str?: number;
	/** The tier of the item. */
	tier: number;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "gloves";
	/** Contains information about what stats the item will gain with each upgrade level. Set if the item is upgradable. */
	upgrade: {
		apiercing?: number;
		armor: number;
		attr0?: number;
		frequency?: number;
		gold?: number;
		resistance: number;
		rpiercing?: number;
		stat?: number;
	};
}

// from items\Helmet.ts
interface GHelmet {
	a?: number | boolean;
	apiercing?: number;
	armor?: number;
	/** An array of classes that can use this item. */
	class?: Array<ClassKey>;
	/** Contains information about what stats the item will gain with each compound level. Set if the item is compoundable. */
	compound?: {
		cuteness: number;
		range: number;
	};
	crit?: number;
	cuteness?: number;
	dex?: number;
	evasion?: number;
	explanation?: string;
	extra_stat?: number;
	firesistance?: number;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The first number refers to what level the item begins being `high` grade, the second for `rare`. */
	grades?: [number, number, number, number];
	hat?: string;
	hp?: number;
	ignore?: boolean;
	int?: number;
	legacy?: {
		/** An array of classes that can use this item. */
		class: null;
		/** The set this item is part of `G.sets.wanderers`. */
		set: null;
	};
	lifesteal?: number;
	luck?: number;
	mcourage?: number;
	/** The full display name of an item. */
	name: string;
	output?: number;
	pcourage?: number;
	pnresistance?: number;
	protection?: boolean;
	range?: number;
	reflection?: number;
	resistance?: number;
	rogue?: {
		crit: number;
		/** Contains information about what stats the item will gain with each upgrade level. Set if the item is upgradable. */
		upgrade: {
			crit: number;
		};
	};
	rpiercing?: number;
	scroll?: boolean;
	/** The set this item is part of `G.sets.wanderers`. */
	set?: string;
	/** The skin of the item. */
	skin: ItemKey;
	speed?: number;
	stat?: number;
	str?: number;
	/** The tier of the item. */
	tier?: number;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "helmet";
	/** Contains information about what stats the item will gain with each upgrade level. Set if the item is upgradable. */
	upgrade?: {
		apiercing?: number;
		armor: number;
		crit?: number;
		cuteness?: number;
		dex?: number;
		evasion?: number;
		int?: number;
		reflection?: number;
		resistance: number;
		rpiercing?: number;
		stat: number;
		str?: number;
		vit?: number;
	};
	vit?: number;
	xcx?: [string];
	xscroll?: boolean;
}

// from images\Images.ts
interface GImage {
	width: number;
	type: string;
	height: number;
}

// from imagesets\Imagesets.ts
interface GImageset {
	rows: number;
	file: string;
	columns: number;
	size: number;
	load?: boolean;
}

// from items\Jar.ts
interface GJar {
	exclusive?: boolean;
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The full display name of an item. */
	name: string;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The skin of the item. */
	skin: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "jar";
}

// from levels\Levels.ts
type GLevel = number;

// from items\Licence.ts
interface GLicence {
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The full display name of an item. */
	name: string;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The skin of the item. */
	skin: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "licence";
}

// from items\Gloves.ts
type ItemKey =
	| "fierygloves" // Fiery Gloves
	| "gloves" // Gloves
	| "gloves1" // Rugged Gloves
	| "goldenpowerglove" // Golden Power Glove
	| "handofmidas" // Hand of Midas
	| "hgloves" // Heavy Gloves
	| "mcgloves" // Gloves of the Hunter Merchant
	| "mittens" // Mittens
	| "mmgloves" // Gloves of the Hunter Mage
	| "mpgloves" // Gloves of the Hunter Priest
	| "mpxgloves" // Mana Gloves
	| "mrgloves" // Gloves of the Hunter Rogue
	| "mrngloves" // Gloves of the Hunter Ranger
	| "mwgloves" // Gloves of the Hunter Warrior
	| "poker" // Poker
	| "powerglove" // Power Glove
	| "supermittens" // Super Mittens
	| "vgloves" // Vampiric Gloves
	| "wgloves" // Wanderer's Gloves
	| "xgloves"; // Darkforge Gloves

// from maps\Maps.ts
interface GMap {
	animatables?: {
		the_door?: {
			position: string;
			x: number;
			y: number;
		};
		the_lever?: {
			position: string;
			x: number;
			y: number;
		};
	};
	burn_multiplier?: number;
	code?: string;
	day?: boolean;
	data: GGeometry;
	doors: Array<
		| [number, number, number, number, MapKey, number]
		| [number, number, number, number, MapKey, number, number]
		| [number, number, number, number, MapKey, number, number, "key", ItemKey]
		| [number, number, number, number, MapKey, number, number, "ulocked", "complicated"]
		| [number, number, number, number, MapKey, number, number, "protected" | "ulocked"]
	>;
	drop_norm?: number;
	/** Seasonal / instanced event this map belongs to (`G.maps[…].event`). */
	event?: MapEventKey;
	freeze_multiplier?: number;
	fx?: string;
	ignore?: boolean;
	instance?: boolean;
	irregular?: boolean;
	key: string;
	loss?: boolean;
	lux?: number;
	machines?: Array<{
		set: string;
		y: number;
		x: number;
		frames: Array<[number, number, number, number]>;
		subframes?: Array<[number, number, number, number]>;
		type: string;
	}>;
	/**
	 * Merchants on the map that sell validates against
	 */
	merchants?: Array<{
		/** The map the merchant currently is on */
		map: MapKey;
		/** The unique id of the instance you are in, else a `MapKey` */
		in: MapKey | string;
		x: number;
		y: number;
		id: NpcKey;
	}>;
	monsters?: Array<{
		boundaries?: Array<[MapKey, number, number, number, number]>;
		boundary?: [number, number, number, number];
		count: number;
		gatekeeper?: boolean;
		grow?: boolean;
		polygon?: Array<[number, number]>;
		position?: [number, number];
		rage?: [number, number, number, number];
		random?: boolean;
		roam?: boolean;
		radius?: number;
		stype?: string;
		special?: boolean;
		type: MonsterKey;
	}>;
	mount?: boolean;
	name: string;
	no_bounds?: boolean;
	npcs: Array<{
		position?: [x: number, y: number] | [number, number, number];
		id: NpcKey;
		name?: string;
		boundary?: [number, number, number, number];
		positions?: [[number, number], [number, number, number]];
	}>;
	old_monsters?: Tuple<
		{
			count: number;
			boundary: [number, number, number, number];
			type: MonsterKey;
		},
		12
	>;
	on_death?: [MapKey, number];
	on_exit?: [MapKey, number];
	outside?: boolean;
	pvp?: boolean;
	quirks?: Array<[number, number, number, number, string, string] | [number, number, number, number, string]>;
	ref?: {
		c_mid?: [number, number];
		cx?: [number, number, number, number];
		poof?: {
			in: MapKey;
			map: MapKey;
			x: number;
			y: number;
		};
		u_mid?: [number, number];
	};
	safe?: boolean;
	safe_pvp?: boolean;
	small_steps?: boolean;
	/**
	 * direction is the way the character spawns 0 down,1 right, 2 bottom ,3 left.
	 * size indicates an area you could spawn in with x,y as the center.
	 */
	spawns: Array<[x: number, y: number] | [x: number, y: number, direction: number] | [x: number, y: number, direction: number, size: number]>;
	traps?: [
		{
			polygon?: Tuple<[number, number], 60>;
			position?: [number, number];
			type: string;
		},
	];
	unlist?: boolean;
	/**
	 * The position of the upgrade station where you can upgrade
	 */
	upgrade?: {
		map: MapKey;
		in: MapKey | string;
		x: number;
		y: number;
		id: NpcKey;
	};
	/**
	 * The position of the compound station where you can compound
	 */
	compound?: {
		map: MapKey;
		in: MapKey | string;
		x: number;
		y: number;
		id: NpcKey;
	};
	/**
	 * Positions where the item is sold.
	 */
	items?: Partial<
		Record<
			ItemKey,
			Array<{
				map: MapKey;
				in: MapKey | string;
				x: number;
				y: number;
				id: NpcKey;
			}>
		>
	>;
	weather?: string;
	world?: string;
	zones?: [
		{
			drop: string;
			polygon: Array<[number, number]>;
			type: MapZoneKey;
		},
	];
}

// from items\Material.ts
interface GMaterial {
	action?: string;
	event?: boolean;
	explanation?: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The full display name of an item. */
	name: string;
	offering?: number;
	onclick?: string;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The skin of the item. */
	skin: ItemKey;
	throw?: boolean;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "material";
}

// from items\Misc.ts
interface GMisc {
	a?: boolean;
	/** Contains information about what stats the item will gain with each compound level. Set if the item is compoundable. */
	compound?: {};
	/** Refers to how many items are needed to exchange (see .quest as well!) */
	e?: number;
	event?: boolean;
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The first number refers to what level the item begins being `high` grade, the second for `rare`. */
	grades?: [number, number, number, number];
	ignore?: boolean;
	/** The full display name of an item. */
	name: string;
	rare?: boolean;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s?: number;
	/** The skin of the item. */
	skin: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "misc";
	/** Contains information about what stats the item will gain with each upgrade level. Set if the item is upgradable. */
	upgrade?: {};
}

// from items\MiscOffhand.ts
interface GMiscOffhand {
	armor?: number;
	/** Contains information about what stats the item will gain with each compound level. Set if the item is compoundable. */
	compound: {
		evasion?: number;
		int?: number;
		resistance?: number;
		str?: number;
	};
	cx: {
		scale?: number;
	};
	evasion?: number;
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The first number refers to what level the item begins being `high` grade, the second for `rare`. */
	grades: [number, number, number, number];
	int?: number;
	/** The full display name of an item. */
	name: string;
	resistance?: number;
	/** The skin of the item. */
	skin: ItemKey;
	str?: number;
	/** The tier of the item. */
	tier: number;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "misc_offhand";
}

// from monsters\Monsters.ts
interface GMonster {
	"1hp"?: boolean;
	abilities?: GMonsterAbilities;
	/** Kill milestones → permanent stat rewards (`effectType` is always `"stat"` today). */
	achievements?: Array<[kills: number, effectType: "stat", stat: StatType | string, amount: number]>;
	aggro: number;
	announce?: string | boolean;
	apiercing?: number;
	armor?: number;
	article?: string;
	attack: number;
	avoidance?: number;
	balance?: string;
	cbuff?: Array<[number, ConditionKey]>;
	charge?: number;
	charge_skin?: string;
	cooperative?: boolean;
	crit?: number;
	cute?: boolean;
	damage_type: string;
	/** A multiplier for monsters' gold drops */
	difficulty?: number;
	dreturn?: number;
	drop_on_hit?: boolean;
	escapist?: boolean;
	evasion?: number;
	explanation?: string;
	explosion?: number;
	frequency: number;
	global?: boolean;
	goldsteal?: number;
	hide?: boolean;
	hit?: string;
	hp: number;
	humanoid?: boolean;
	immune?: boolean;
	lifesteal?: number;
	mp: number;
	max_hp: number;
	name: string;
	operator?: boolean;
	orientation?: number;
	passive?: boolean;
	peaceful?: boolean;
	pet?: {
		aggression: [number, number];
		brightness: number;
		chatter: [number, number];
		courage: [number, number];
		exponential: boolean;

		level: {
			armor: number;
			attack: number;
			charge: number;
			evasion: number;
			hp: number;
			resistance: number;
			speed: number;
		};
		obedience: [number, number];
		passion: [number, number];
		xp: number;
	};
	phresistance?: number;
	poisonous?: boolean;
	prefix?: string;
	projectile?: string;
	rage: number;
	range: number;
	rbuff?: ConditionKey;
	reflection?: number;
	resistance?: number;
	respawn: number;
	respawn_as?: MonsterKey;
	roam?: boolean;
	rpiercing?: number;
	s?: {
		[K in ConditionKey]?: {
			ms: number;
		};
	};
	size?: number;
	skin: string;
	slots?: {
		mainhand: {
			level: number;
			name: ItemKey;
		};
		offhand?: {
			level: number;
			name: ItemKey;
		};
	};
	spawns?: Array<[number, MonsterKey] | [number, MonsterKey, number] | [number, MonsterKey, Record<string, unknown>]>;
	special?: boolean;
	speed: number;
	stationary?: boolean;
	supporter?: boolean;
	trap?: boolean;
	unlist?: boolean;
	xp: number;
	aa?: number;
}

// from multipliers\Multipliers.ts
type GMultiplier = number;

// from npcs\Npcs.ts
interface GNpc {
	allow?: boolean;
	aspeed?: string;
	attack?: number;
	atype?: string;
	aura?: {
		gold?: number;
		luck?: number;
	};
	class?: ClassKey;
	color?: string;
	cx?: {
		face?: string;
		hair?: string;
		hat?: string;
		head?: string;
	};
	delay?: number;
	heal?: number;
	hp?: number;
	id: NpcKey;
	ignore?: boolean;
	interaction?: Array<string>;
	interval?: number;
	items?: Array<ItemKey | null>;
	level?: number;
	modal?: string;
	moving?: boolean;
	name?: string;
	old_items?: Array<ItemKey | null>;
	old_role?: NpcRole;
	old_side_interaction?: {
		auto: boolean;
		message: string;
		skin: string;
	};
	pack?: NpcKey;
	places?: {
		winterland: number;
		desertland: number;
		test: number;
		cyberland: number;
		main: number;
		d_e: number;
	};
	quest?: string;
	range?: number;
	role: NpcRole;
	says?: Array<string> | string;
	seek?: string;
	side_interaction?: {
		auto: boolean;
		message: string;
		skin: string;
	};
	skin: string;
	slots?: {
		mainhand: {
			level: number;
			name: WeaponType;
		};
	};
	speed?: number;
	stand?: string;
	steps?: number;
	stopframe?: number;
	token?: ItemKey;
	transport?: boolean;
	type?: string;
}

// from items\Offering.ts
interface GOffering {
	a: boolean;
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	grade: number;
	/** The full display name of an item. */
	name: string;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The skin of the item. */
	skin: string;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "offering";
}

// from items\Orb.ts
interface GOrb {
	a?: boolean;
	ability?: string;
	armor?: number;
	attr0?: number;
	/** Contains information about what stats the item will gain with each compound level. Set if the item is compoundable. */
	compound?: {
		armor?: number;
		attr0?: number;
		courage?: number;
		dex?: number;
		int?: number;
		luck?: number;
		mp?: number;
		rpiercing?: number;
		speed?: number;
		str?: number;
		vit?: number;
		xp?: number;
	};
	courage?: number;
	critdamage?: number;
	cx?: {
		scale: number;
	};
	dex?: number;
	edge?: number;
	event?: boolean;
	explanation?: string;
	firesistance?: number;
	for?: number;
	fzresistance?: number;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The first number refers to what level the item begins being `high` grade, the second for `rare`. */
	grades?: [number, number, number, number];
	ignore?: boolean;
	int?: number;
	luck?: number;
	manasteal?: number;
	mp?: number;
	/** The full display name of an item. */
	name: string;
	pcourage?: number;
	rpiercing?: number;
	/** The set this item is part of `G.sets.wanderers`. */
	set?: string;
	/** The skin of the item. */
	skin: string;
	speed?: number;
	str?: number;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "orb";
	vit?: number;
	xp?: number;
}

// from items\Pants.ts
interface GPant {
	a?: boolean | number;
	armor: number;
	/** An array of classes that can use this item. */
	class?: Array<ClassKey>;
	crit?: number;
	dex?: number;
	explanation?: string;
	extra_stat?: number;
	frequency?: number;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The first number refers to what level the item begins being `high` grade, the second for `rare`. */
	grades: [number, number, number, number];
	legacy?: {
		/** An array of classes that can use this item. */
		class: null;
		/** The set this item is part of `G.sets.wanderers`. */
		set: null;
	};
	/** The full display name of an item. */
	name: string;
	resistance: number;
	rpiercing?: number;
	scroll: boolean;
	/** The set this item is part of `G.sets.wanderers`. */
	set?: string;
	/** The skin of the item. */
	skin: ItemKey;
	speed?: number;
	stat: number;
	/** The tier of the item. */
	tier: number;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "pants";
	/** Contains information about what stats the item will gain with each upgrade level. Set if the item is upgradable. */
	upgrade: {
		armor: number;
		crit?: number;
		resistance: number;
		rpiercing?: number;
		stat: number;
	};
	vit?: number;
}

// from items\PetLicence.ts
interface GPetLicence {
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The full display name of an item. */
	name: string;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The skin of the item. */
	skin: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "petlicence";
}

// from items\Placeholder.ts
interface GPlaceholder {
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	ignore: boolean;
	/** The full display name of an item. */
	name: string;
	/** The skin of the item. */
	skin: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "placeholder";
}

// from items\Pot.ts
interface GPot {
	cooldown?: number;
	debuff?: boolean;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** If the item gives a buff, or effect, like a health potion. */
	gives: [[string, number]];
	/** The full display name of an item. */
	name: string;
	rare?: boolean;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The skin of the item. */
	skin: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "pot";
}

// from projectiles\Projectiles.ts
interface GProjectile {
	hit_animation?: string;
	animation?: string;
	speed?: number;
	instant?: boolean;
	ray?: string;
	hit_text?: [string, string];
	kill_text?: [string, string];
	pure?: boolean;
}

// from items\Qubics.ts
interface GQubics {
	a: boolean;
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The full display name of an item. */
	name: string;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The skin of the item. */
	skin: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "qubics";
}

// from items\Quest.ts
interface GQuest {
	a?: boolean;
	/** Refers to how many items are needed to exchange (see .quest as well!) */
	e?: number;
	event?: boolean;
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The full display name of an item. */
	name: string;
	/** Indicates the `quest` that this item is needed to complete. */
	quest?: ItemKey;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The skin of the item. */
	skin: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "quest";
}

// from items\Quiver.ts
interface GQuiver {
	a?: boolean;
	armor: number;
	dex: number;
	evasion?: number;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The first number refers to what level the item begins being `high` grade, the second for `rare`. */
	grades: [number, number, number, number];
	/** The full display name of an item. */
	name: string;
	range: number;
	/** The skin of the item. */
	skin: ItemKey;
	/** The tier of the item. */
	tier: number;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "quiver";
	/** Contains information about what stats the item will gain with each upgrade level. Set if the item is upgradable. */
	upgrade: {
		armor: number;
		dex: number;
		range: number;
	};
}

// from items\Ring.ts
interface GRing {
	a?: boolean;
	ability?: string;
	action?: string;
	apiercing?: number;
	armor?: number;
	attr0?: number;
	bling?: number;
	/** Contains information about what stats the item will gain with each compound level. Set if the item is compoundable. */
	compound: {
		apiercing?: number;
		armor?: number;
		bling?: number;
		crit?: number;
		dex?: number;
		dreturn?: number;
		gold?: number;
		int?: number;
		lifesteal?: number;
		luck?: number;
		reflection?: number;
		resistance?: number;
		rpiercing?: number;
		str?: number;
		stun?: number;
		vit?: number;
	};
	courage?: number;
	crit?: number;
	dex?: number;
	dreturn?: number;
	edge?: number;
	evasion?: number;
	event?: boolean;
	explanation?: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	gold?: number;
	/** The first number refers to what level the item begins being `high` grade, the second for `rare`. */
	grades: [number, number, number, number];
	ignore?: boolean;
	int?: number;
	lifesteal?: number;
	luck?: number;
	/** The full display name of an item. */
	name: string;
	onclick?: string;
	pnresistance?: number;
	resistance?: number;
	rpiercing?: number;
	/** The set this item is part of `G.sets.wanderers`. */
	set?: string;
	/** The skin of the item. */
	skin: string;
	skin_a?: string;
	str?: number;
	stun?: number;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "ring";
	vit?: number;
}

// from sets\Sets.ts
type GSet = {
	explanation?: string;
	items: Array<ItemKey>;
	name: string;
} & {
	[Quantity in number]?: {
		[Stat in StatType]?: number;
	};
};

// from items\Shield.ts
interface GShield {
	armor?: number;
	crit?: number;
	cx?: {
		accent: string;
	};
	dex?: number;
	dreturn?: number;
	evasion?: number;
	explanation?: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The first number refers to what level the item begins being `high` grade, the second for `rare`. */
	grades: [number, number, number, number];
	int?: number;
	luck?: number;
	/** The full display name of an item. */
	name: string;
	resistance?: number;
	/** The set this item is part of `G.sets.wanderers`. */
	set?: string;
	/** The skin of the item. */
	skin: ItemKey;
	speed?: number;
	stat?: number;
	str?: number;
	/** The tier of the item. */
	tier: number;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "shield";
	/** Contains information about what stats the item will gain with each upgrade level. Set if the item is upgradable. */
	upgrade: {
		armor?: number;
		dreturn?: number;
		luck?: number;
		resistance?: number;
		stat?: number;
		str?: number;
	};
	xp?: number;
}

// from items\Shoes.ts
interface GShoe {
	a?: number | boolean;
	armor: number;
	/** An array of classes that can use this item. */
	class?: [ClassKey];
	credit?: string;
	cuteness?: number;
	dex?: number;
	explanation?: string;
	extra_stat?: number;
	firesistance?: number;
	for?: number;
	frequency?: number;
	fzresistance?: number;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The first number refers to what level the item begins being `high` grade, the second for `rare`. */
	grades: [number, number, number, number];
	/** The full display name of an item. */
	name: string;
	resistance?: number;
	scroll: boolean;
	/** The set this item is part of `G.sets.wanderers`. */
	set?: string;
	/** The skin of the item. */
	skin: ItemKey;
	speed: number;
	stat: number;
	str?: number;
	/** The tier of the item. */
	tier: number;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "shoes";
	/** Contains information about what stats the item will gain with each upgrade level. Set if the item is upgradable. */
	upgrade: {
		armor: number;
		cuteness?: number;
		frequency?: number;
		fzresistance?: number;
		resistance?: number;
		speed: number;
		stat: number;
	};
	vit?: number;
	winterland?: {
		speed: number;
		/** Contains information about what stats the item will gain with each upgrade level. Set if the item is upgradable. */
		upgrade: {
			speed: number;
		};
	};
}

// from skills\Skills.ts
interface GSkill {
	action?: string;
	apiercing?: number;
	aura?: boolean;
	class?: ClassKey[];
	code?: boolean | string;
	complementary?: string;
	condition?: ConditionKey;
	consume?: ItemKey;
	cooldown?: number;
	cooldown_multiplier?: number;
	damage?: number;
	damage_multiplier?: number;
	damage_type?: string;
	duration?: number;
	duration_max?: number;
	duration_min?: number;
	explanation?: string;
	global?: boolean;
	heal?: boolean;
	hostile?: boolean;
	inventory?: [ItemKey];
	kill_buff?: ConditionKey;
	level?: number;
	levels?: Array<[number, number]>;
	list?: boolean;
	max?: number;
	merchant_use?: boolean;
	monsters?: boolean;
	mp?: number;
	multi?: boolean;
	name: string;
	negative?: [ItemKey];
	nprop?: [SkillKey, string];
	output?: number;
	party?: boolean;
	passive?: boolean;
	persistent?: boolean;
	pierces_immunity?: boolean;
	positive?: [ItemKey];
	procs?: boolean;
	projectile?: string;
	range?: number;
	range_bonus?: number;
	range_multiplier?: number;
	ratio?: number;
	requirements?: Partial<Record<StatType, number>>;
	reuse_cooldown?: number;
	set_speed?: number;
	share?: SkillKey;
	skin?: string;
	skins?: [string, string, string];
	slot?: Array<[string, ItemKey]>;
	target?: boolean | string;
	toggle?: boolean;
	type?: string;
	ui?: boolean;
	use_range?: boolean;
	variance?: number;
	warning?: string;
	wtype?: Array<WeaponType> | WeaponType;
}

// from items\SkillItem.ts
interface GSkillItem {
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The full display name of an item. */
	name: string;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The skin of the item. */
	skin: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "skill_item";
}

// from items\Source.ts
interface GSource {
	/** Contains information about what stats the item will gain with each compound level. Set if the item is compoundable. */
	compound: {
		dex?: number;
		int?: number;
		reflection?: number;
		resistance?: number;
		vit?: number;
	};
	cx: {
		extension: boolean;
		scale: number;
	};
	dex?: number;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The first number refers to what level the item begins being `high` grade, the second for `rare`. */
	grades: [number, number, number, number];
	int?: number;
	/** The full display name of an item. */
	name: string;
	reflection?: number;
	resistance?: number;
	/** The set this item is part of `G.sets.wanderers`. */
	set?: string;
	/** The skin of the item. */
	skin: ItemKey;
	/** The tier of the item. */
	tier: number;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "source";
	vit?: number;
}

// from items\Spawner.ts
interface GSpawner {
	action?: string;
	explanation?: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	ignore?: boolean;
	/** The full display name of an item. */
	name: string;
	note?: string;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The skin of the item. */
	skin: ItemKey;
	spawn: string;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "spawner";
}

// from sprites\Sprites.ts
interface GSprite {
	rows: number;
	type?: string;
	columns: number;
	file: string;
	matrix: Array<Array<string | null>>;
	size?: string;
	skip?: number;
	rskip?: boolean;
}

// from items\Stand.ts
interface GStand {
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	ignore?: boolean;
	/** The full display name of an item. */
	name: string;
	/** The skin of the item. */
	skin: ItemKey;
	stand: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "stand";
}

// from items\StatScroll.ts
interface GStatScroll {
	evasion?: number;
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	multiplier?: number;
	/** The full display name of an item. */
	name: string;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The skin of the item. */
	skin: ItemKey;
	stat: string;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "pscroll";
}

// from items\Stone.ts
interface GStone {
	days: number;
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	ignore: boolean;
	/** The full display name of an item. */
	name: string;
	/** The skin of the item. */
	skin: ItemKey;
	skin_a: string;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "stone";
}

// from items\Test.ts
interface GTest {
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	ignore: boolean;
	/** The full display name of an item. */
	name: string;
	/** The skin of the item. */
	skin: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "test";
}

// from items\Throw.ts
interface GThrow {
	action?: string;
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The full display name of an item. */
	name: string;
	onclick?: string;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The skin of the item. */
	skin: ItemKey;
	throw?: boolean;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "throw";
}

// from tilesets\Tilesets.ts
interface GTileset {
	file: string;
	frames?: number;
	frame_width?: number;
	light?: string;
}

// from titles\Titles.ts
interface GTitle {
	type: string;
	for?: number;
	achievement?: string;
	title: string;
	critdamage?: number;
	luck?: number;
	str?: number;
	source?: string;
	random_stat?: number;
	manual?: boolean;
	misc?: boolean;
	frequency?: number;
	pnresistance?: number;
	improve?: boolean;
	consecutive_200p_range_last_hits?: number;
	attack?: number;
}

// from tokens\Tokens.ts
interface GToken {
	harbringer?: number;
	spear?: number;
	weaponbox?: number;
	armorbox?: number;
	t2bow?: number;
	hammer?: number;
	partyhat?: number;
	rabbitsfoot?: number;
	mshield?: number;
	exoarm?: number;
	xshield?: number;
	smoke?: number;
	confetti?: number;
	"cxjar-xgravestone2"?: number;
	mcpants?: number;
	mrnhat?: number;
	mpgloves?: number;
	networkcard?: number;
	mcboots?: number;
	mrpants?: number;
	mparmor?: number;
	mppants?: number;
	fieldgen0?: number;
	mmhat?: number;
	mrgloves?: number;
	mrnboots?: number;
	mmarmor?: number;
	mcgloves?: number;
	mwboots?: number;
	mmshoes?: number;
	troll?: number;
	mchat?: number;
	mphat?: number;
	mrarmor?: number;
	mmgloves?: number;
	funtoken?: number;
	mwpants?: number;
	mrngloves?: number;
	mrhood?: number;
	tracker?: number;
	mcarmor?: number;
	mpshoes?: number;
	mrboots?: number;
	mrnpants?: number;
	mwarmor?: number;
	mmpants?: number;
	mwgloves?: number;
	mrnarmor?: number;
	mwhelmet?: number;
}

// from items\TokenItem.ts
interface GTokenItem {
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The full display name of an item. */
	name: string;
	npc?: string;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The skin of the item. */
	skin: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "token";
}

// from items\Tome.ts
interface GTome {
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The full display name of an item. */
	name: string;
	reward: number;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The skin of the item. */
	skin: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "tome";
}

// from items\Tool.ts
interface GTool {
	breaks: number;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The first number refers to what level the item begins being `high` grade, the second for `rare`. */
	grades: [number, number, number, number];
	/** The full display name of an item. */
	name: string;
	/** The skin of the item. */
	skin: ItemKey;
	/** The tier of the item. */
	tier: number;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "tool";
	/** Contains information about what stats the item will gain with each upgrade level. Set if the item is upgradable. */
	upgrade: {
		breaks: number;
	};
	/** The type of `weapon` `wand` `axe` `mace`... */
	wtype: ItemKey;
}

// from items\Tracker.ts
interface GTracker {
	acolor: string;
	action: string;
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The full display name of an item. */
	name: string;
	onclick: string;
	/** The skin of the item. */
	skin: ItemKey;
	special: boolean;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "tracker";
}

// from items\UpgradeScroll.ts
interface GUpgradeScroll {
	a?: boolean;
	exclusive?: boolean;
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	grade: number;
	markup?: number;
	/** The full display name of an item. */
	name: string;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The skin of the item. */
	skin: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "uscroll";
}

// from items\Weapon.ts
interface GWeapon {
	a?: boolean | number;
	ability?: string;
	apiercing?: number;
	armor?: number;
	attack: number;
	attr0?: number;
	attr1?: number;
	awesomeness?: number;
	blast?: number;
	charisma?: number;
	/** An array of classes that can use this item. */
	class?: [ClassKey];
	crit?: number;
	critdamage?: number;
	cx?: {
		accent?: string;
		border?: number;
		extension?: boolean;
		large?: boolean;
		lightborder?: boolean;
		scale?: number;
	};
	damage_type: string;
	delia?: string;
	dex?: number;
	evasion?: number;
	event?: boolean;
	exclusive?: boolean;
	explanation?: string;
	explosion?: number;
	firesistance?: number;
	for?: number;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** The first number refers to what level the item begins being `high` grade, the second for `rare`. */
	grades: [number, number, number, number];
	ignore?: boolean;
	int?: number;
	lifesteal?: number;
	luck?: number;
	mp_cost?: number;
	mp_reduction?: number;
	/** The full display name of an item. */
	name: string;
	nopo?: string;
	projectile?: string;
	projectile_test?: string;
	range: number;
	reflection?: number;
	resistance?: number;
	rpiercing?: number;
	/** The set this item is part of `G.sets.wanderers`. */
	set?: string;
	/** The skin of the item. */
	skin: string;
	skin_c?: string;
	skin_r?: string;
	speed?: number;
	str?: number;
	stun?: number;
	/** The tier of the item. */
	tier: number;
	trex?: string;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "weapon";
	/** Contains information about what stats the item will gain with each upgrade level. Set if the item is upgradable. */
	upgrade: {
		apiercing?: number;
		armor?: number;
		attack: number;
		attr0?: number;
		attr1?: number;
		awesomeness?: number;
		blast?: number;
		crit?: number;
		dex?: number;
		evasion?: number;
		explosion?: number;
		int?: number;
		range: number;
		reflection?: number;
		resistance?: number;
		rpiercing?: number;
		speed?: number;
		str?: number;
		stun?: number;
		vit?: number;
	};
	vit?: number;
	/** The type of `weapon` `wand` `axe` `mace`... */
	wtype: WeaponType;
}

// from items\XP.ts
interface GXP {
	explanation: string;
	/** Cost of the item in gold, if an NPC were to sell this item. */
	g: number;
	/** If the item gives a buff, or effect, like a health potion. */
	gives: [[ItemType, number]];
	/** The full display name of an item. */
	name: string;
	/** Indicates how many of this items you can stack. Set if the item is stackable. */
	s: number;
	/** The skin of the item. */
	skin: ItemKey;
	/** The type of item, `shield`, `weapon`, `gloves`... */
	type: "xp";
}

// from (generated)
/**
 * Item definition in `G.items` — discriminated by `type` across item families.
 * Discriminated item-family union for `G.items` values.
 */
type GItem = BetterUX<
	{
		buy?: boolean;
		upgrade?: Partial<Record<StatType, number>>;
		compound?: Partial<Record<StatType, number>>;
	} & (
		| GActivator
		| GAmulet
		| ItemKey
		| GBelt
		| GBooster
		| GBox
		| GCape
		| GChest
		| GChrysalis
		| GCompoundScroll
		| GComputer
		| GContainer
		| GCosmeticItem
		| ItemKey
		| GEarring
		| GElixir
		| GFlute
		| GGem
		| GGlove
		| GHelmet
		| GJar
		| GLicence
		| GMaterial
		| GMisc
		| GMiscOffhand
		| GOffering
		| GOrb
		| GPant
		| GPetLicence
		| GPlaceholder
		| GPot
		| GQubics
		| GQuest
		| GQuiver
		| GRing
		| GShield
		| GShoe
		| GSkillItem
		| GSource
		| GSpawner
		| GStand
		| GStatScroll
		| GStone
		| GTest
		| GThrow
		| GTokenItem
		| GTome
		| GTool
		| GTracker
		| GUpgradeScroll
		| GWeapon
		| GXP
	)
>;
