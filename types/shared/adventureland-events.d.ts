/**
 * Typed CODE events + utility types (shared + Monaco).
 * First-party AdventureLand types.
 */

/**
 * Distribute a union and add missing keys as optional `undefined`
 * so IntelliSense shows a stable property set across variants.
 */
type AllKeys<T> = T extends any ? keyof T : never;
type WithMissingKeys<T, K extends PropertyKey> = T & {
	[P in Exclude<K, keyof T>]?: undefined;
};
type BetterUX<T> = T extends any ? WithMissingKeys<T, AllKeys<T>> : never;

/** Map point used by movement helpers. */
interface Point {
	x: number;
	y: number;
	map?: MapKey;
	real_x?: number;
	real_y?: number;
}

/** Coordinate pair for blink / skill targets. */
type XY = [x: number, y: number];

/**
 * Door tuple from `G.maps[map].doors`:
 * `[x, y, width, height, map, spawn?, nearbySpawn?, lock?, flag?]`
 */
type DoorInfo = [x: number, y: number, width: number, height: number, map: MapKey | string, spawn?: number, nearbySpawn?: number, lock?: string, flag?: string];

/** Generic deferred failure (`rejecting_promise({ reason })`). */
interface CodeFailure {
	success?: false;
	failed?: true;
	reason: string;
	in_progress?: boolean;
}

/** Generic deferred success. */
type CodeSuccess<T extends object = {}> = { success: true } & T;

type CodeResult<T extends object = {}> = BetterUX<CodeSuccess<T> | CodeFailure>;

interface BuySuccessResponse {
	success: true;
	response: "buy_success";
	place: "buy";
	name: ItemKey;
	num: number;
	q: number;
	cost: number;
}

/** Cosmetic slot names on `character.cx` (equipped looks). */
type CosmeticSlotKey = "head" | "hair" | "hat" | "face" | "makeup" | "chin" | "upper" | "back" | "tail" | "gravestone" | "special" | "stone";

/**
 * Equipped cosmetics (`character.cx` / party / online listings).
 * Slot → cosmetic id. Not the owned inventory — that is {@link CharacterOwnedCosmetics}.
 */
interface CharacterCosmeticInfos {
	chin?: string;
	face?: string;
	hair?: CosmeticHairKey | string;
	hat?: CosmeticHatKey | string;
	head?: CosmeticHeadKey | string;
	makeup?: string;
	upper?: string;
	back?: string;
	tail?: string;
	gravestone?: CosmeticGravestoneKey | string;
	special?: string;
	stone?: string;
	/** Bundle / prop ids and future slots. */
	[slot: string]: string | undefined;
}

/**
 * Owned cosmetics inventory (`character.acx` / `player.p.acx`).
 * Cosmetics id → count. Sending uses a single id string via {@link send_cx}, not this map.
 */
type CharacterOwnedCosmetics = Record<string, number>;

/** Options for {@link can_stack}. */
interface CanStackArgs {
	/** If true, ignore the PVP flag (e.g. bank_store). */
	ignore_pvp?: boolean;
}

/** Failed craft / auto_craft. */
interface CraftFailureResponse {
	failed: true;
	reason: string;
}

/** Failed {@link move} acknowledgement. */
interface MoveFailureResponse {
	reason: string | "unable" | "interrupted";
}

/**
 * {@link move} resolves when the server acknowledges the request — not on arrival.
 * Prefer {@link smart_move} / {@link xmove} for pathing.
 */
type MoveResponse = void | MoveFailureResponse;

/** Account character row from {@link get_characters} / `parent.X.characters`. */
interface OnlineCharacter {
	id: string;
	name: string;
	level: number;
	type: ClassKey | string;
	ctype?: ClassKey | string;
	map: MapKey | string;
	in: string;
	x: number;
	y: number;
	skin: string;
	server: string;
	home?: `${ServerRegion}${ServerIdentifier}` | string;
	online: number | boolean;
	secret?: string;
	cx?: CharacterCosmeticInfos;
}

/** Server row from {@link get_servers} / `parent.X.servers`. */
interface ServerListing {
	name: string;
	region: ServerRegion | string;
	players?: number;
	key: string;
	port?: number;
	addr: string;
	ip?: string;
}

/**
 * Hit / projectile payload shared by character & game hit events.
 * Fields are optional because not every projectile carries every flag.
 */
interface HitData {
	/** Attack source skill / action id (can be positive or negative). */
	source?: string;
	/** Attacker entity id. */
	actor?: string;
	/** Defender entity id. */
	target?: string;
	damage?: number;
	/** Set when the projectile heals instead of (or in addition to) damaging. */
	heal?: number;
	damage_type?: string;
	projectile?: string;
	/** Projectile instance id. */
	pid?: string;
	eta?: number;
	crit?: boolean;
	kill?: boolean;
	evade?: boolean;
	miss?: boolean;
	/** Target outran the projectile. */
	avoid?: boolean;
	poison?: boolean;
	freeze?: boolean;
	stun?: boolean;
	/** Reflected damage amount. */
	reflect?: number;
	dreturn?: number;
	/** Condition / buff triggered by the hit. */
	trigger?: string;
	condition?: string;
	/** Rogue sneak attack. */
	sneak?: boolean;
	/** Entity ids sharing the tile that also got hit. */
	stacked?: string[];
	mobbing?: number;
	unintentional?: boolean;
	aoe?: boolean;
}

interface ActionEvent {
	source: string;
	actor: string;
	target: string;
	damage?: number;
	heal?: number;
	projectile?: string;
	eta?: number;
	pid?: string;
	ray?: string;
	instant?: boolean;
}

/** One item roll from a {@link LootEvent}. */
interface LootedItem {
	name: ItemKey;
	/** Character the item is for (null if unassigned / lost). */
	looter: string | null;
	level?: number;
	q?: number;
	lostandfound?: boolean;
	/** Set when the chest was a PVP character drop. */
	pvp_loot?: boolean;
}

interface LootEvent {
	id: string;
	opener: string;
	goldm: number;
	dry: boolean;
	stale: boolean;
	gold: number;
	party?: boolean;
	items: LootedItem[];
}

/**
 * Character event → payload map.
 * Enables `character.on("loot", (data) => data.gold)` style IntelliSense.
 */
interface CharacterEvents {
	death: { past?: boolean };
	respawn: Record<string, never> | {};
	cm: {
		name: string;
		message: unknown;
		date?: Date | string;
		local?: boolean;
	};
	gold_sent: BetterUX<{ to?: string; amount?: number; name?: string; gold?: number } | { response: "gold_sent"; place: "send"; success: boolean; name: string; gold: number }>;
	gold_received: BetterUX<{ from?: string; amount?: number; name?: string; gold?: number } | { response: "gold_received"; name: string; gold: number }>;
	buy: { name: ItemKey; num: number; q: number; cost: number };
	sell: { item: ItemInfo; gold: number; success?: boolean; response?: string; place?: string };
	loot: LootEvent;
	hit: HitData;
	target_hit: HitData;
	incoming: ActionEvent;
	level_up: { level: number };
	new_map: { name: MapKey | string; in: string };
	mluck: { name: string; item: ItemInfo; num: number };
	item_received: BetterUX<
		| {
				response: "item_received";
				item: ItemKey;
				name: string;
				q?: number;
				num: number;
		  }
		| { name: string; item: ItemKey; q?: number; num: number }
		| { name: ItemKey; from: string; q?: number; num: number }
	>;
	item_sent: { name: string; item: ItemKey; q: number; num: number };
	mail_sent: { to: string };
	mail_failed: { reason: string };
	craft: { name: ItemKey; num: number };
	dismantle: { name: ItemKey };
	sale: { buyer: string; item: ItemInfo; slot: TradeSlotType | string };
	exchange_buy: { num: number };
	mobbing: { intensity: number };
	stacked: { ids: string[] };
	clim: unknown;
}

/** Game / world event → payload map (`game.on(...)`). */
interface GameEvents {
	event: { name: string; map?: MapKey | string; x?: number; y?: number };
	level_up: { name: string; level: number };
	shutdown: { seconds: number };
	action: ActionEvent;
	hit: HitData;
	trade: {
		seller: string;
		buyer: string;
		item: ItemInfo;
		slot: TradeSlotType | string;
	};
	buy: {
		type?: "+$";
		id?: NpcKey | string;
		name: string;
		item: ItemInfo;
		event?: "buy";
	};
	sell: {
		type?: "-$";
		id?: NpcKey | string;
		name: string;
		item: ItemInfo;
		num?: number;
		event?: "sell";
	};
	death: { id: string; luckm?: number; points?: Record<string, number> };
	item_sent: { sender: string; receiver: string; item: ItemInfo };
	gold_sent: { sender: string; receiver: string; gold: number };
	cx_sent: { sender: string; receiver: string; cx: string };
	mluck: { name: string; item: ItemInfo; num: number };
	sbuy: { name: string; item: ItemInfo };
	fbuy: { name: string; item: ItemInfo };
	api_response: BetterUX<ApiResponse>;
	/** Server \`game_response\` payloads (also on the socket). */
	game_response: BetterUX<ServerToClient_game_response>;
}

/** In-game mail row from `pull_mail` / api_response. */
interface MailMessage {
	id: string;
	fro: string;
	to: string;
	subject: string;
	message: string;
	sent?: string;
	item?: string;
	taken?: boolean;
}

/** Cursor page from `parent.api_call("pull_mail", …)`. */
interface PullMailResponse {
	type: "mail";
	mail?: MailMessage[];
	cursored?: boolean;
	cursor?: string;
	more?: boolean;
}

/** Merchant stand listings from `parent.api_call("pull_merchants")`. */
interface MerchantsApiResponse {
	type: "merchants";
	chars: Array<{
		name: string;
		map: MapKey | string;
		x: number;
		y: number;
		level?: number;
		server?: string;
		/** Stand item id or `"cstand"` (computer). */
		stand?: string;
		afk?: boolean | string;
		skin?: string;
		cx?: CharacterCosmeticInfos;
		slots?: Partial<Record<TradeSlotType, TradeItemInfo>>;
	}>;
}

interface FriendsApiResponse {
	type: "friends";
	chars: Array<string | OnlineCharacter | { name?: string; [k: string]: unknown }>;
}

interface ServersAndCharactersTutorial {
	step: number;
	completed: string[];
	finished: boolean;
	task: boolean;
	progress: number;
}

interface ServersAndCharactersApiResponse {
	type: "servers_and_characters";
	servers: ServerListing[];
	characters: OnlineCharacter[];
	tutorial?: ServersAndCharactersTutorial;
	code_list?: { [slot: string]: [string, number] };
	mail?: number;
	rewards?: unknown[];
}

/** Cursor page from `parent.api_call("pull_messages", …)`. */
interface PullMessagesResponse {
	type: "messages" | string;
	messages?: unknown[];
	cursored?: boolean;
	cursor?: string;
	more?: boolean;
}

/** Known `game.on("api_response")` payloads from {@link Window.api_call}. */
type ApiResponse = MerchantsApiResponse | FriendsApiResponse | ServersAndCharactersApiResponse | PullMailResponse | PullMessagesResponse | { type: string; [key: string]: unknown };

/** Args for well-known `parent.api_call` methods (CODE / client DX). */
interface ApiCallArgsByMethod {
	pull_merchants: Record<string, never> | undefined;
	pull_friends: Record<string, never> | undefined;
	pull_mail: { cursor?: string } | undefined;
	pull_messages: { type?: string; cursor?: string } | undefined;
	servers_and_characters: Record<string, never> | undefined;
	delete_mail: { mid: string };
	read_mail: { mail: string };
	load_code: { name: string | number; run?: string; log?: boolean | number; save?: boolean };
	save_code: {
		code?: string;
		slot?: string | number;
		name?: string;
		auto?: boolean;
		log?: boolean | number;
		electron?: boolean;
	};
	list_codes: { purpose?: string } | undefined;
	disconnect_character: { name: string };
	tutorial: { step?: number; task?: string } | undefined;
	load_article: { name: string; func?: boolean; guide?: boolean; url?: string; tutorial?: string };
	load_gcode: { file: string };
}

/** Promise / api_response shapes for known methods. */
interface ApiCallResultByMethod {
	pull_merchants: MerchantsApiResponse;
	pull_friends: FriendsApiResponse;
	pull_mail: PullMailResponse | PullMailResponse[];
	pull_messages: PullMessagesResponse | PullMessagesResponse[];
	servers_and_characters: ServersAndCharactersApiResponse | ServersAndCharactersApiResponse[];
	delete_mail: ApiResponse;
	read_mail: ApiResponse;
	load_code: ApiResponse;
	save_code: ApiResponse;
	list_codes: ApiResponse;
	disconnect_character: ApiResponse;
	tutorial: ApiResponse;
	load_article: ApiResponse;
	load_gcode: ApiResponse;
}

/** Options object for `parent.api_call(method, args, options)`. */
interface ApiCallOptions {
	callback?: (data: unknown) => void;
	/** When true, returns a Promise instead of relying on the event. */
	promise?: boolean;
	silent?: boolean;
	/** CODE string evaluated with `smart_eval` on success. */
	success?: string;
}

/** Floating combat / feedback text options for {@link Window.d_text}. */
interface DTextArgs {
	color?: string;
	size?: string | number;
	offset?: number;
	y?: number;
	parent?: unknown;
	dont_animate?: boolean;
	/** SFX id when set. */
	s?: string;
}

interface CodeEventEmitter<Events> {
	/**
	 * Subscribe to a typed event.
	 * @returns Listener id (pass around / compare; removal is via once/`delete` patterns).
	 */
	on<K extends keyof Events>(event: K, handler: (data: Events[K], eventName?: K) => void): string;
	once<K extends keyof Events>(event: K, handler: (data: Events[K], eventName?: K) => void): string;
	/** Subscribe to every event; handler receives `(eventName, data)`. */
	all(handler: (eventName: string, data: unknown) => void): string;
	trigger<K extends keyof Events>(event: K, data?: Events[K]): void;
	listeners?: Array<{ f: (...args: unknown[]) => void; id: string; event: string; once?: boolean }>;
	/** Removes all listeners for event `eventName` (when supported). */
	off?<K extends keyof Events>(eventName: K): void;
	/** Remove a listener by id returned from {@link CodeEventEmitter.on}. */
	remove?(id: string): void;
}

type CharacterEventName = keyof CharacterEvents;
type GameEventName = keyof GameEvents;
