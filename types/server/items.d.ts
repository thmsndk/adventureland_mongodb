/**
 * Server-only item helpers (node/). Not shipped to Monaco.
 * Shared item shapes: {@link ItemInfo}, {@link ItemKey}.
 */

/** Options for {@link add_item}. */
interface ServerAddItemArgs {
	announce?: boolean;
	q?: number;
	p?: ItemInfo["p"];
	m?: boolean | number;
	r?: boolean | number;
	[k: string]: unknown;
}

/**
 * Create a new item instance from a catalog name.
 * See `create_new_item` in node/server.js.
 */
declare function create_new_item(name: ItemKey | string, quantity?: number): ItemInfo;

/**
 * Clone/stack-friendly copy used for special drops.
 * See `create_new_sitem` in node/server.js.
 */
declare function create_new_sitem(item: ItemInfo, quantity?: number): ItemInfo;

/**
 * Add an item to a player's inventory (mutates `player.items`).
 * See `add_item` in node/server.js — keep in sync with `can_add_item`.
 */
declare function add_item(player: { items: Array<ItemInfo | null>; [k: string]: unknown }, new_item: ItemInfo | ItemKey | string, args?: ServerAddItemArgs): number | false | void;

/**
 * Build a network/cache-safe item view (strips ignored props).
 * See `cache_item` in node/server_functions.js.
 */
declare function cache_item(current: ItemInfo | null | undefined, trade?: boolean, override?: Partial<ItemInfo>): ItemInfo | null;
