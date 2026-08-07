/**
 * AdventureLand CODE API ambient types (IDE only).
 * Sources: docs/directory.js + js/runner_functions.js shapes.
 */

declare const character: Character;
declare const entities: { [id: string]: Entity };
declare const party: string[];
declare const safeties: boolean;
declare const game: GameInfo;
declare const server: ServerInfo;

interface Entity {
	id?: string;
	name?: string;
	x: number;
	y: number;
	real_x?: number;
	real_y?: number;
	going_x?: number;
	going_y?: number;
	hp: number;
	max_hp: number;
	mp: number;
	max_mp: number;
	xp?: number;
	attack?: number;
	type?: string;
	mtype?: string;
	ctype?: string;
	map?: string;
	in?: string;
	level?: number;
	range?: number;
	speed?: number;
	target?: string;
	rip?: boolean;
	npc?: boolean;
	player?: boolean;
	monster?: boolean;
	visible?: boolean;
	moving?: boolean;
	s?: { [condition: string]: any };
	c?: { [channel: string]: any };
	[key: string]: any;
}

interface Character extends Entity {
	name: string;
	ctype?: string;
	gold: number;
	xp: number;
	max_xp?: number;
	items: (ItemInfo | null)[];
	slots: { [slot: string]: ItemInfo | null };
	range: number;
	bot?: boolean;
}

interface ItemInfo {
	name: string;
	level?: number;
	q?: number;
	gift?: number;
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

interface NearestMonsterFilter {
	min_xp?: number;
	max_att?: number;
	type?: string;
	types?: string[];
	path_check?: boolean;
	no_target?: boolean;
	target?: any;
	[key: string]: any;
}

/** Load another character in CODE mode. */
declare function start_character(name: string, code_slot_or_name?: string | number): void;
declare function stop_character(name: string): void;
declare function command_character(name: string, code_snippet: string): void;
declare function get_active_characters(): { [name: string]: string };
declare function change_server(region: string, name: string): void;
declare function in_pvp(): boolean;
declare function is_npc(entity: Entity): boolean;
declare function is_monster(entity: Entity): boolean;
declare function is_character(entity: Entity): boolean;
declare function interact(name: string): any;
declare function use_nearest_door(): any;
declare function enter(place: string, name?: string): any;
declare function join(event: string): any;
declare function activate(num: number): any;
declare function shift(num: number, name: string): any;
declare function throw_item(num: number, x: number, y: number): any;
declare function can_use(name: string): boolean;
declare function use(name: string, target?: any): any;
/** Use a skill by name. */
declare function use_skill(name: string, target?: any, extra_arg?: any): any;
declare function reduce_cooldown(name: string, ms: number): void;
declare function bank_deposit(gold: number): any;
declare function bank_withdraw(gold: number): any;
declare function bank_store(num: number, pack?: string, pack_num?: number): any;
declare function bank_retrieve(pack: string, pack_num: number, num?: number): any;
declare function bank_swap(pack: string, a: number, b: number): any;
declare function swap(a: number, b: number): any;
declare function locate_item(name: string): number;
declare function quantity(name: string): number;
declare function item_properties(item: ItemInfo): any;
declare function item_grade(item: ItemInfo | string): number;
declare function item_value(item: ItemInfo | string): number;
declare function transport(map: string, spawn?: number): any;
declare function leave(): any;
declare function is_paused(): boolean;
declare function pause(): void;
declare function get_socket(): any;
declare function get_map(): string;
/** Set the small status message above the character. */
declare function set_message(text: string, color?: string): void;
declare function game_log(message: any, color?: string): void;
declare function log(message: any, color?: string): void;
declare function safe_log(message: any, color?: string): void;
declare function get_focus(): Entity | null;
declare function get_target_of(entity: Entity): Entity | null;
declare function get_target(): Entity | null;
declare function get_targeted_monster(): Entity | null;
declare function change_target(target: Entity | string | null): void;
declare function can_move_to(x: number, y: number): boolean;
declare function xmove(x: number, y: number): any;
/** True if target is within attack/skill range. */
declare function is_in_range(target: Entity, skill?: string): boolean;
declare function is_on_cooldown(skill: string): boolean;
/** True if you can attack target now (in range, not disabled, attack ready). */
declare function can_attack(target: Entity): boolean;
declare function can_heal(target: Entity): boolean;
declare function is_moving(entity: Entity): boolean;
declare function is_transporting(entity: Entity): boolean;
/** Attack a monster or player. */
declare function attack(target: Entity | string): Promise<any> | any;
declare function heal(target: Entity | string): Promise<any> | any;
declare function buy(name: string, quantity?: number): any;
declare function buy_with_gold(name: string, quantity?: number): any;
declare function buy_with_shells(name: string, quantity?: number): any;
declare function sell(num: number, quantity?: number): any;
declare function consume(num: number): any;
declare function equip(num: number, slot?: string): any;
declare function equip_batch(data: any[]): any;
declare function unequip(slot: string): any;
declare function lock_item(num: number): any;
declare function seal_item(num: number): any;
declare function unlock_item(num: number): any;
declare function open_stand(num?: number): any;
declare function close_stand(): any;
declare function trade(num: number, trade_slot: string | number, price: number, quantity?: number): any;
declare function trade_buy(target: Entity, trade_slot: string | number, quantity?: number): any;
declare function trade_sell(target: Entity, trade_slot: string | number, quantity?: number): any;
declare function wishlist(trade_slot: string | number, name: string, price: number, level?: number, quantity?: number): any;
declare function giveaway(slot: string | number, num: number, q: number, minutes: number): any;
declare function join_giveaway(name: string, slot: string | number, rid: string): any;
declare function upgrade(item_num: number, scroll_num: number, offering_num?: number, only_calculate?: boolean): any;
declare function compound(item0: number, item1: number, item2: number, scroll_num: number, offering_num?: number, only_calculate?: boolean): any;
declare function craft(...item_nums: number[]): any;
declare function auto_craft(name: string): any;
declare function exchange(item_num: number): any;
declare function exchange_buy(id: string, name: string, num?: number): any;
declare function say(message: string): any;
declare function party_say(message: string): any;
declare function pm(name: string, message: string): any;
/** Walk toward (x, y). */
declare function move(x: number, y: number): any;
declare function cruise(speed: number): any;
declare function show_json(json: any): void;
declare function get_characters(): any[];
declare function get_servers(): any[];
declare function get_party(): { [name: string]: any };
declare function get_player(name: string): Entity | null;
declare function get_monster(id: string): Entity | null;
declare function get_entity(id: string): Entity | null;
declare function find_npc(npc_id: string): any;
/** Nearest monster matching optional filters (e.g. {min_xp, max_att}). */
declare function get_nearest_monster(args?: NearestMonsterFilter): Entity | null;
declare function get_nearest_hostile(args?: any): Entity | null;
declare function get_nearest_npc(): Entity | null;
declare function use_hp_or_mp(): void;
declare function loot(id_or_boolean?: string | boolean): void;
declare function get_chests(): { [id: string]: any };
declare function send_gold(receiver: string, gold: number): any;
declare function send_item(receiver: string, num: number, quantity?: number): any;
declare function send_cm(to: string | string[], data: any): any;
declare function on_cm(from: string, data: any): void;
declare function respawn(): any;
declare function handle_death(): void;
declare function handle_command(command: string, args?: string): void;
declare function on_party_invite(name: string): void;
declare function on_party_request(name: string): void;
declare function on_destroy(): void;
declare function on_draw(): void;
declare function on_game_event(event: string, data?: any): void;
declare function send_party_invite(name: string): any;
declare function send_party_request(name: string): any;
declare function accept_party_invite(name: string): any;
declare function accept_party_request(name: string): any;
declare function leave_party(): any;
declare function kick_party_member(name: string): any;
declare function accept_magiport(name: string): any;
declare function map_key(key: string, skill: string, code?: string): void;
declare function unmap_key(key: string): void;
declare function load_code(name: string | number, onerror?: any): void;
declare function require_code(name: string | number): any;
/** Smart pathfind / travel to a destination. */
declare function smart_move(dest: any, on_done?: Function): any;
declare function stop(action?: string): any;
declare function distance(a: Entity | { x: number; y: number }, b: Entity | { x: number; y: number }): number;
declare function can_walk(entity?: Entity): boolean;
declare function is_disabled(entity: Entity): boolean;
declare function get(name: string): any;
declare function set(name: string, value: any): void;
