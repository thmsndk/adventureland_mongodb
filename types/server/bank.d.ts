/**
 * Server-only bank helpers / player bank working state (node/).
 * Not shipped to Monaco. Shared pack shapes: {@link BankInfo}, {@link BankPackType}.
 */

/** Cached bank item views built in `init_bank` (`player.cuser`). */
type ServerBankCache = Partial<Record<BankPackType, Array<ItemInfo | null>>>;

/**
 * Server player bank fields while inside (or syncing) the bank.
 * `user` holds durable packs; `cuser` holds cached item views for sync.
 */
interface ServerPlayerBankState {
	/** Durable bank gold + packs (`items0` …). */
	user: CharacterBankInfos;
	/** In-memory cached pack contents for the connected player. */
	cuser?: ServerBankCache;
}

/** See `init_bank` in node/server_functions.js. */
declare function init_bank(player: ServerPlayerBankState): void;
/** See `init_bank_exit` in node/server_functions.js. */
declare function init_bank_exit(player: { user: CharacterBankInfos }): void;
/** See `bank_add_item` in node/server.js. */
declare function bank_add_item(player: ServerPlayerBankState, slot: BankPackType, new_item: ItemInfo | { name: ItemKey; [k: string]: unknown }): number;
