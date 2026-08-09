/**
 * Game-frame `Window` / `parent` surface for client + Monaco (not for node/server).
 */

/** Game frame properties exposed on `parent` / the runner window. */
interface Window {
	character: Character;
	entities: { [id: string]: Entity };
	G: GCatalog;
	/**
	 * Tracktrix data when unlocked / available.
	 * @example
	 * show_json(parent.tracker?.monsters);
	 */
	tracker?: Tracker;
	/**
	 * Live world events / bosses.
	 * @example
	 * if (parent.S && parent.S.franky && parent.S.franky.live) smart_move("franky");
	 * show_json(parent.S);
	 */
	S?: SEventsInfos;
	/** Account characters / servers cache (`parent.X`). */
	X?: ParentXInfo;
	/**
	 * Client API helper (merchants, friends, mail, …).
	 * Responses arrive on `game.on("api_response", …)` as {@link ApiResponse}.
	 * Pass `{ promise: true }` in options to await instead of listening.
	 * @example
	 * parent.api_call("pull_merchants");
	 * const mail = await parent.api_call("pull_mail", undefined, { promise: true });
	 * game.on("api_response", (data) => { if (data.type === "merchants") show_json(data.chars); });
	 */
	api_call?: {
		<M extends keyof ApiCallArgsByMethod>(method: M, args?: ApiCallArgsByMethod[M], extra?: ApiCallOptions): void | Promise<ApiCallResultByMethod[M]>;
		(method: string, args?: Record<string, unknown>, extra?: ApiCallOptions): void | Promise<unknown>;
	};
	/**
	 * Open a ground chest by id (`parent.chests`).
	 * @example
	 * for (const id in parent.chests) parent.open_chest?.(id);
	 */
	open_chest?: (id: string) => Promise<BetterUX<{ success?: boolean; in_progress?: boolean; reason?: string } | CodeFailure>> | unknown;
	clear_game_logs?: () => void;
	/**
	 * Floating text at map coords, or above an entity when the 2nd arg is an object.
	 * @example
	 * parent.d_text?.("Miss", monster, { color: "evade" });
	 * parent.d_text?.("+1", character.x, character.y - 20, { color: "green" });
	 */
	d_text?: (message: string, xOrEntity?: number | Entity, yOrArgs?: number | DTextArgs, args?: DTextArgs) => void;
	/** Bank pack unlock table (also available as global {@link bank_packs}). */
	bank_packs?: Record<BankPackType, [MapKey, number, number]>;
	pings?: number[];
	user_id?: string;
	user_auth?: string;
	smart_eval?: (code: string) => void;
	open_merchant?: (num?: number) => void;
	close_merchant?: () => void;
	/** Render item HTML into a selector / last dialog (`html.js`). */
	render_item?: (
		selector: string | unknown,
		args?: {
			name?: ItemKey | string;
			item?: GItem | ItemInfo | { name?: string; skin?: string; [k: string]: unknown };
			actual?: ItemInfo;
			value?: number;
			cash?: number;
			pure?: boolean;
			styles?: string;
			prop?: unknown;
			[k: string]: unknown;
		},
	) => void;
	render_computer?: (element: unknown, type?: string, slot?: number) => void;
	/** Live game socket (same as {@link get_socket}). */
	socket?: GameSocket;

	/** Live party members keyed by name (`parent.party`). */
	party?: { [name: string]: PartyMember };
	/** Ordered party member names (`parent.party_list`). */
	party_list?: string[];
	/** Open chests keyed by id (`parent.chests`). */
	chests?: { [id: string]: ChestInfo };
	/**
	 * Next usable time per skill.
	 * @example
	 * if (parent.next_skill.attack) game_log(-mssince(parent.next_skill.attack));
	 */
	next_skill?: Partial<Record<SkillKey, Date>>;
	friends?: string[];
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
	distance?: (a: Point | Entity | { x: number; y: number }, b: Point | Entity | { x: number; y: number }) => number;
	start_character_runner?: (name: string, code_slot_or_name?: string | number) => unknown;
	stop_character_runner?: (name: string) => void;
	CLI_OUT?: unknown[];
	cli_require?: (id: string) => unknown;
	ls_emulation?: Storage;
	RESOLVE_ALL?: boolean;
	parent?: Window;
}
