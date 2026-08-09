/**
 * Socket event payloads - first-party AdventureLand types (shared + Monaco).
 * Use via {@link get_socket} / `parent.socket`.
 * Owned first-party source - edit in place.
 *
 * @example
 * const socket = get_socket();
 * socket.on("game_response", (data) => {
 *   if (data.response === "buy_success") game_log("bought");
 * });
 * socket.emit("ping_trig", {});
 */

type AttackFailedGRDataObject = {
	response: "attack_failed";
	place: "attack";
	id: string;
};

type BankOperationGRDataObject = {
	response: "data" | "storage_full" | "bank_unavailable";
	place: "bank";
	gold?: number;
	cevent?: true;
	failed?: true;
	success?: true;
};

/** When you try to enter the bank, but another one of your characters is already inside. */

type BankOPXGRDataObject = {
	response: "bank_opx";
	/** The character that is already inside */
	name: string;
	reason: "mounted";
};

type BankRestrictionsGRDataObject = {
	response: "bank_restrictions";
	place: string;
};

type BuySuccessGRDataObject = {
	cevent: "buy";
	response: "buy_success";
	success: boolean;
	place: "buy";
	cost: number;
	/** Inventory slot that the item is now in */
	num: number;
	name: ItemKey;
	/** Note, if you don't specify the quantity in the `buy` socket emit, it will be set to 1 by the server */
	q: number;
};

type CondExpGRDataObject = {
	response: "ex_condition";
	name: SkillKey;
};

type CooldownGRDataObject = {
	response: "cooldown";
	failed: true;
	skill?: SkillKey;
	id?: string;
	place: SkillKey;
	ms: number;
};

type CraftGRDataObject = {
	response: "craft";
	name: ItemKey;
};

type DefeatedByMonsterGRDataObject = {
	response: "defeated_by_a_monster";
	xp: number;
	monster: MonsterKey;
};

type DisabledGRDataObject = {
	response: "disabled";
	place: SkillKey;
};

type DismantleGRDataObject = {
	response: "dismantle";
	/** Item that was dismantled (`item.name`). */
	name: ItemKey;
	level?: number;
	cost?: number;
	cevent?: boolean;
};

/** Called when donating to the goblin.
 * donation < 100k ➡️ low
 * 100k <= donation < 1m ➡️ gum
 * donation >= 1m ➡️ ability to see lost and found */

type DonateGRDataObject = {
	response: "donate_gum" | "donate_low" | "donate_thx";
	gold: number;
	xprate: number;
};

/** Called when a condition expires */

type EquipFailedGRDataObject = {
	response: "cant_equip";
	place: "equip";
	failed: true;
};

type EquipGRDataObject = EquipSuccessGRDataObject | EquipFailedGRDataObject;

type EquipSuccessGRDataObject = {
	response: "data";
	place: "equip";
	success: true;
	slot: SlotType;
	num: number;
};

type ExchangeNotEnoughGRDataObject = {
	response: "exchange_notenough";
	place: "exchange_buy";
	failed: true;
};

type GameResponseDataObject =
	| AttackFailedGRDataObject
	| BankOPXGRDataObject
	| BankRestrictionsGRDataObject
	| BuySuccessGRDataObject
	| CooldownGRDataObject
	| CraftGRDataObject
	| SkillSuccessGRDataObject
	| ProjectileSkillGRDataObject
	| DefeatedByMonsterGRDataObject
	| DisabledGRDataObject
	| DismantleGRDataObject
	| DonateGRDataObject
	| CondExpGRDataObject
	| GetCloserGRDataObject
	| GoldSentGRDataObject
	| ItemLockedGRDataObject
	| ItemSentGRDataObject
	| LostFoundInfoGRDataObject
	| MagiportGRDataObject
	| TakeMailItemGRDataObject
	| NoItemGRDataObject
	| NoMPGRDataObject
	| NoTargetGRDataObject
	| SeashellGRDataObject
	| SkillStatusGRDataObject
	| TargetLockGRDataObject
	| TooFarGRDataObject
	| UnfriendFailedGRDataObject
	| GoldReceivedGRDataObject
	| ItemReceivedGRDataObject
	| ItemPlaceholderGRDataObject
	| CxNewGRDataObject
	| CxReceivedGRDataObject
	| CxSentGRDataObject
	| TownGRDataObject
	| TransportGRDataObject
	| EquipGRDataObject
	| ExchangeNotEnoughGRDataObject
	| UpgradeCompoundGRDataObject
	| HomeSetGRDataObject
	| ShTimeGRDataObject
	| ChallengeSentGRDataObject
	| ChallengeReceivedGRDataObject
	| ChallengeAcceptedGRDataObject
	| DuelStartedGRDataObject
	| ConditionExpiredGRDataObject
	| AddItemGRDataObject
	| RewardReceivedGRDataObject
	| MailSentGRDataObject
	| MailFailedGRDataObject
	| EmotionNewGRDataObject
	| SignedUpGRDataObject
	| DistanceGRDataObject
	| FriendFailedGRDataObject
	| MonsterhuntInfoGRDataObject
	| ScrollsmithSuccessGRDataObject
	| UpgradeScrollQGRDataObject
	| MaxLevelGRDataObject
	| GoldUseGRDataObject
	| TemporalsurgeGRDataObject
	| SkillImmuneGRDataObject
	| ReviveFailedGRDataObject
	| MagiportGoneGRDataObject
	| GiveawayJoinGRDataObject
	| MiscFailGRDataObject
	| BankStoreWithdrawGRDataObject
	| BankOperationGRDataObject;

type GameResponseDataString =
	| "bank_restrictions"
	/** When you attempt to place a bet while after you drank an xshot */
	| "bet_xshot"
	/** When you attempt to blink to a spot you can't reach. */
	| "blink_failed"
	| "buy_cant_npc"
	| "buy_cant_space"
	| "buy_cost"
	/** When you're too far from Ponty and try to view Ponty's items */
	| "buy_get_closer"
	/** When you try to use `transport` on a door that needs `enter` */
	| "cant_enter"
	/** When attempting to leave a map you can't use the leave command on
	 *
	 * When attempting to warp or change maps when you have a lot of targets
	 */
	| "cant_escape"
	/** When we try to dash too far */
	| "dash_failed"
	/** Too far away from monster hunt npc */
	| "ecu_get_closer"
	/** When you try to do an emotion but it's not a valid emotion name, or you don't have that emotion */
	| "emotion_cant"
	/** When you try to do an emotion but it's rejected because it's on cooldown */
	| "emotion_cooldown"
	/** We are already exchanging something */
	| "exchange_existing"
	/** The given item requires multiple to exchange */
	| "exchange_notenough"
	/** When you send a friend request for someone you're already friends with */
	| "friend_already"
	/** When you try to accept a friend request, but you took too long (or they never sent one in the first place) */
	| "friend_expired"
	/** When you send a friend request but they aren't on the server to accept the request */
	| "friend_rleft"
	/** When you send a friend request for a valid player name */
	| "friend_rsent"
	/** When you try to sell a locked item */
	| "item_locked"
	/** When you try to loot a chest with items but there's no space in your inventory to loot */
	| "loot_no_space"
	/** When you try to look at the lost and found, but haven't donated enough */
	| "lostandfound_donate"
	/** When a merchant tries to start a monster hunt */
	| "monsterhunt_merchant"
	| "monsterhunt_started"
	/** When you try to use a skill, but you're not a high enough level */
	| "no_level"
	/** When you attack or use a skill with "id" set to "null" */
	| "no_target"
	/** After you use a skill, when the server is done with everything, it will send this in response */
	| "resolve_skill"
	/** When you try to send an item to another character, but they don't have room for it in their inventory */
	| "send_no_space"
	/** When you try to send a cosmetic you don't own / can't spare */
	| "send_no_cx"
	/** When you try to send cosmetics to a character on another account */
	| "send_diff_owner"
	/** When you try to send an item that isn't in that inventory slot */
	| "send_no_item"
	/** When you try to equip a cosmetic you don't own */
	| "cx_not_found"
	| "skill_cant_incapacitated"
	/** When you try to use a skill that requires a certain item to be equipped, but you don't have that item equipped */
	| "skill_cant_slot"
	/** When you try to use a skill, but you don't have the right weapon type equipped for that skill */
	| "skill_cant_wtype"
	| "skill_too_far"
	/** When you try to list an item for sale/purchase in a slot that already has something listed */
	| "slot_occupied"
	/** When you try to sell an item to another merchant, but there's no space on that merchant */
	| "trade_bspace"
	| "trade_get_closer"
	/** When you try to enter a dungeon, but you don't have a key */
	| "transport_cant_item"
	/** When you try to go through a door you haven't unlocked yet (e.g. lower bank) */
	| "transport_cant_locked"
	/** When you're too far away from a door */
	| "transport_cant_reach"
	/** When you try to upgrade an item that isn't upgradable */
	| "upgrade_cant"
	/** Failed upgrading (to chance) */
	| "upgrade_fail"
	/** We are already upgrading something */
	| "upgrade_in_progress"
	/** We are trying to use a scroll to upgrade something that is a higher grade than the scroll can upgrade */
	| "upgrade_incompatible_scroll"
	/** When you specify an inventory index for the item that is empty */
	| "upgrade_no_item"
	/** When you specify an inventory index for the scroll that is empty */
	| "upgrade_no_scroll"
	/** Successfully upgraded an item */
	| "upgrade_success"
	/** Sucessfully applied a stat scroll to an item */
	| "upgrade_success_stat"
	/** We are trying to use an offering that is not high enough grade to upgrade our item */
	| "upgrade_invalid_offering"
	/** Auto-added from server emit/fail/success string responses */
	| "already_in_party"
	| "already_unlocked"
	| "bank_new_pack"
	| "bank_opi"
	| "bank_pack_unlocked"
	| "blessed"
	| "blessed_fail"
	| "buyer_gold"
	| "buyer_gone"
	| "cant"
	| "cant_consume"
	| "cant_in_bank"
	| "cant_join"
	| "cant_kick"
	| "cant_respawn"
	| "cant_space"
	| "cant_when_sick"
	| "charm_failed"
	| "chat_slowdown"
	| "compound_cant"
	| "compound_in_progress"
	| "compound_incompatible_scroll"
	| "compound_invalid_offering"
	| "compound_mismatch"
	| "compound_no_scroll"
	| "craft_atleast2"
	| "craft_cant"
	| "craft_cant_quantity"
	| "cruise"
	| "destroyed"
	| "dismantle_cant"
	| "distance"
	| "dont_have_enough"
	| "door_unlocked"
	| "error"
	| "giveaway"
	| "gold_not_enough"
	| "hmm"
	| "home_set"
	| "in_progress"
	| "insufficient_q"
	| "inv_size"
	| "invalid"
	| "invalid_quest"
	| "invalid_target"
	| "inventory_full"
	| "invitation_expired"
	| "inviter_gone"
	| "item_blocked"
	| "item_gone"
	| "join_too_late"
	| "locksmith_alocked"
	| "locksmith_aunlocked"
	| "locksmith_cant"
	| "locksmith_locked"
	| "locksmith_sealed"
	| "locksmith_unlocked"
	| "locksmith_unseal_complete"
	| "locksmith_unsealed"
	| "locksmith_unsealing"
	| "loot_failed"
	| "mail_sending"
	| "merge_complete"
	| "merge_mismatch"
	| "monsterhunt_already"
	| "muted"
	| "need_auth"
	| "no"
	| "no_merchants"
	| "no_skill"
	| "no_space"
	| "non_friendly_target"
	| "not_enough"
	| "not_enough_gold"
	| "not_in_a_party"
	| "not_in_pvp"
	| "not_in_this_server"
	| "not_ready"
	| "nothing"
	| "npc_param_missing"
	| "only_in_bank"
	| "party_full"
	| "player_gone"
	| "quest_in_progress"
	| "quest_param_missing"
	| "receiver_unavailable"
	| "request_expired"
	| "reward_already"
	| "reward_notverified"
	| "safety_check"
	| "scrollsmith_cant"
	| "seller_gone"
	| "sh_time"
	| "skill_cant_charges"
	| "skill_cant_item"
	| "skill_cant_pve"
	| "skill_cant_requirements"
	| "skill_cant_safe"
	| "skill_cant_use"
	| "skill_no_item"
	| "slot_occuppied"
	| "slots_fail"
	| "slots_success"
	| "sneaky"
	| "target_alive"
	| "target_invincible"
	| "tarot_exists"
	| "tavern_dice_exist"
	| "tavern_gold_not_enough"
	| "tavern_not_yet"
	| "tavern_too_late"
	| "tavern_too_many_bets"
	| "temporalsurge_none"
	| "transport_cant_dampened"
	| "transport_cant_invalid"
	| "transport_cant_protection"
	| "transport_failed"
	| "upgrade_mismatch";

type HomeSetGRDataObject = {
	response: "home_set";
	home: string;
	place?: string;
	success?: true;
};

type ShTimeGRDataObject = {
	response: "sh_time";
	hours: number;
	failed?: true;
	place?: string;
};

type ChallengeSentGRDataObject = {
	response: "challenge_sent";
	name: string;
};

type ChallengeReceivedGRDataObject = {
	response: "challenge_received";
	name: string;
};

type ChallengeAcceptedGRDataObject = {
	response: "challenge_accepted";
	name: string;
};

type DuelStartedGRDataObject = {
	response: "duel_started";
	[key: string]: unknown;
};

type ConditionExpiredGRDataObject = {
	response: "condition";
	name?: ConditionKey | string;
	expired?: boolean;
	[key: string]: unknown;
};

type AddItemGRDataObject = {
	response: "add_item";
	name?: ItemKey | string;
	q?: number;
	num?: number;
	[key: string]: unknown;
};

type RewardReceivedGRDataObject = {
	response: "reward_received";
	rewards?: unknown;
	[key: string]: unknown;
};

type MailSentGRDataObject = {
	response: "mail_sent";
	[key: string]: unknown;
};

type MailFailedGRDataObject = {
	response: "mail_failed" | "mail_take_item_failed" | "mail_item_already_taken";
	failed?: true;
	[key: string]: unknown;
};

type EmotionNewGRDataObject = {
	response: "emotion_new";
	name?: EmotionKey | string;
	[key: string]: unknown;
};

type SignedUpGRDataObject = {
	response: "signed_up";
	[key: string]: unknown;
};

type DistanceGRDataObject = {
	response: "distance";
	failed?: true;
	place?: string;
	dist?: number;
	[key: string]: unknown;
};

type FriendFailedGRDataObject = {
	response: "friend_failed";
	failed?: true;
	[key: string]: unknown;
};

type MonsterhuntInfoGRDataObject = {
	response: "monsterhunt";
	[key: string]: unknown;
};

type ScrollsmithSuccessGRDataObject = {
	response: "scrollsmith_success";
	[key: string]: unknown;
};

type UpgradeScrollQGRDataObject = {
	response: "upgrade_scroll_q" | "upgrade_offering_success";
	[key: string]: unknown;
};

type MaxLevelGRDataObject = {
	response: "max_level";
	[key: string]: unknown;
};

type GoldUseGRDataObject = {
	response: "gold_use";
	gold?: number;
	[key: string]: unknown;
};

type TemporalsurgeGRDataObject = {
	response: "temporalsurge";
	[key: string]: unknown;
};

type SkillImmuneGRDataObject = {
	response: "skill_immune";
	failed?: true;
	place?: SkillKey | string;
	[key: string]: unknown;
};

type ReviveFailedGRDataObject = {
	response: "revive_failed";
	failed?: true;
	[key: string]: unknown;
};

type MagiportGoneGRDataObject = {
	response: "magiport_gone";
	[key: string]: unknown;
};

type GiveawayJoinGRDataObject = {
	response: "giveaway_join";
	[key: string]: unknown;
};

type MiscFailGRDataObject = {
	response: "misc_fail" | "exception" | "pick_failed" | "picked" | "got_picked" | "friendly" | "non_friendly_target" | "not_in_this_server";
	failed?: true;
	[key: string]: unknown;
};

type BankStoreWithdrawGRDataObject = {
	response: "bank_store" | "bank_withdraw" | "bank_new_pack";
	place?: string;
	gold?: number;
	success?: true;
	failed?: true;
	[key: string]: unknown;
};

type GameResponseDataUpgradeChance = {
	response: "compound_chance" | "upgrade_chance";

	/** The chance for a success */
	chance: number;

	/** The item being compounded */
	item: ItemInfo;

	/** The scroll used for the compound calculation */
	scroll: ItemKey;

	/** The offering used for the compound calculation */
	offering: ItemKey;

	/** Related to compound chance */
	grace: number;
};

type GetCloserGRDataObject = {
	response: "get_closer";
	place: "upgrade";
};

type GoldReceivedGRDataObject = {
	response: "gold_received";
	/** Sender / source character name. */
	name: string;
	gold: number;
	cevent?: boolean;
};

type ItemReceivedGRDataObject = {
	response: "item_received";
	/** Sender character name. */
	name: string;
	item: ItemKey;
	q?: number;
	num?: number;
	cevent?: boolean;
};

/** Inventory slot was empty / a placeholder when an item op ran. */
type ItemPlaceholderGRDataObject = {
	response: "item_placeholder";
	failed?: true;
	place?: string;
	num?: number;
	/** Sometimes the skill / item name is attached. */
	name?: string;
	reason?: string;
};

type GoldSentGRDataObject = {
	response: "gold_sent";
	name: string;
	gold: number;
	place?: "send";
	cevent?: boolean;
};

type CxNewGRDataObject = {
	response: "cx_new";
	/** Updated owned cosmetics inventory. */
	acx: CharacterOwnedCosmetics;
	/** Newly unlocked cosmetics id. */
	name: string;
	from?: string;
};

type CxReceivedGRDataObject = {
	response: "cx_received";
	/** Sender character name. */
	name: string;
	/** Cosmetics id received. */
	cx: string;
	acx: CharacterOwnedCosmetics;
	cevent?: boolean;
};

type CxSentGRDataObject = {
	response: "cx_sent";
	/** Receiver character name. */
	name: string;
	/** Cosmetics id sent. */
	cx: string;
	acx: CharacterOwnedCosmetics;
	cevent?: boolean;
	place?: "send";
};

type ItemLockedGRDataObject = {
	response: "item_locked";
	place: "upgrade";
};

type ItemSentGRDataObject = {
	response: "item_sent";
	/** Receiver character name. */
	name: string;
	item: ItemKey;
	/** Quantity sent (always set on the server emit). */
	q: number;
	num?: number;
	place?: string;
	cevent?: boolean;
};

type LostFoundInfoGRDataObject = {
	response: "lostandfound_info";
	gold: number;
};

type MagiportGRDataObject = {
	response: "magiport_failed" | "magiport_sent";
	id: string;
};

type NoItemGRDataObject = {
	response: "no_item";
	place: "upgrade" | "compound";
	failed: true;
};

type NoMPGRDataObject = {
	response: "no_mp";
	place: SkillKey;
	failed: true;
};

type NoTargetGRDataObject = {
	response: "no_target";
	failed?: true;
	/** Skill / place that failed (often the skill name). */
	place?: SkillKey | string;
	reason?: string;
	id?: string;
};

type ProjectileSkillGRDataObject = {
	response: "data";
	place: Extract<SkillKey, "attack" | "taunt" | "heal" | "curse" | "supershot">;
	dist?: number;
	reason?: string;
	failed?: boolean;
	id?: string;
} & Partial<ServerToClient_action_projectile>;

type SeashellGRDataObject = {
	response: "seashell_success";
	suffix: string | "";
};

type SkillStatusGRDataObject = {
	response: "skill_fail" | "skill_success";
	name: SkillKey;
};

type SkillSuccessGRDataObject = {
	response: "data";
	place: Exclude<SkillKey, "attack" | "taunt" | "heal" | "curse" | "supershot">;
	success: boolean;
	in_progress?: true;
};

type TakeMailItemGRDataObject = {
	response: "mail_item_taken";
};

type TargetLockGRDataObject = {
	response: "target_lock";
	monster: MonsterKey;
};

type TooFarGRDataObject = {
	response: "too_far";
	place: SkillKey;
	id: string;
	dist: number;
};

type TownGRDataObject =
	| {
			success: false;
			in_progress: true;
			response: "data";
			place: "town";
	  }
	| {
			success: false;
			response: "cant_escape";
			place: "town";
	  };

type TransportGRDataObject =
	| {
			success: true;
			response: "data";
			place: "transport";
	  }
	| {
			success: false;
			response: "cant_escape";
			place: "transport";
	  };

type UnfriendFailedGRDataObject = {
	response: "unfriend_failed";
	reason: "bank" | "coms failure" | "nouser";
};

type UpgradeCompoundGRDataObject = {
	response: "upgrade_success" | "upgrade_fail" | "compound_success" | "compound_fail";
	/** the level attempted */
	level: number;
	/** the inventory slot used as item to upgrade */
	num: number;
};

type ClientToServer_attack = {
	id: string;
};

type ClientToServer_auth = {
	/** Account auth token (`user_auth` after login / Electron store). */
	auth: string;

	/** NOTE: This is not the name of the player. It's a long number, encoded as a string. */
	user: string;

	/** NOTE: This is not the name of the character. It's a long number, encoded as a string. */
	character: string;
	passphrase: string;

	height: number;
	width: number;
	scale: number;

	no_html: "" | "1";
	no_graphics: "" | "True";

	code_slot?: number;
};

type ClientToServer_bank =
	| {
			amount: number;
			operation: "deposit" | "withdraw";
	  }
	| {
			inv: number;
			operation: "swap";
			pack: BankPackType;
			str: number;
	  }
	| {
			operation: "move";
			a: number;
			b: number;
			pack: BankPackType;
	  };

type ClientToServer_bet = {
	type: "dice";
	dir: "up" | "down";
	num: number;
	gold: number;
};

type ClientToServer_booster = {
	action: "shift";
	num: number;
	to: string;
};

type ClientToServer_buy = {
	name: ItemKey;
	quantity?: number;
};

type ClientToServer_cm = {
	message: string;
	to: Array<string>;
};

type ClientToServer_compound = {
	calculate?: boolean;
	clevel: number;
	items: [number, number, number];
	offering_num?: number;
	scroll_num: number;
};

type ClientToServer_craft = {
	items: Array<[craftSlot: number, inventorySlot: number]>;
};

type ClientToServer_dismantle = {
	/** Inventory slot to dismantle */
	num: number;
};

type ClientToServer_donate = {
	gold: number;
};

type ClientToServer_emotion = {
	name: string;
};

type ClientToServer_enter = {
	name?: string;
	place: MapKey | string;
};

type ClientToServer_equip =
	| {
			num: number;
			slot: SlotType;
	  }
	| {
			consume: true;
			num: number;
	  }
	| {
			num: number;
			price: number;
			q: number;
			slot: TradeSlotType;
	  };

type ClientToServer_eval = {
	command: string;
};

type ClientToServer_exchange = {
	item_num: number;
	q?: number;
};

type ClientToServer_exchange_buy = {
	name: ItemKey;
	num: number;
	q: number;
};

type ClientToServer_friend = {
	event: "accept" | "request" | "unfriend";
	name: string;
};

type ClientToServer_heal = {
	id: string;
};

type ClientToServer_imove = {
	a: number;
	b: number;
};

type ClientToServer_interaction =
	| {
			key: string;
	  }
	| {
			type: "newyear_tree";
	  };

type ClientToServer_join = {
	name: string;
};

type ClientToServer_join_giveaway = {
	slot: TradeSlotType;
	id: string;
	rid: string;
};

type ClientToServer_leave = void;

type ClientToServer_loaded = {
	/** The height of the monitor's resolution */
	height: number;

	/** The width of the monitor's resolution */
	width: number;

	/** Client pixel / CSS scale used when sizing vision (`screen` scale). */
	scale: number;
	success: number | 1;
};

type ClientToServer_lostandfound = "info" | undefined;

type ClientToServer_magiport = {
	name: string;
};

type ClientToServer_mail = {
	item: boolean;
	message: string;
	subject: string;
	to: string;
};

type ClientToServer_mail_take_item = {
	id: string;
};

type ClientToServer_merchant =
	| {
			close: number;
	  }
	| {
			num: number;
	  };

type ClientToServer_monsterhunt = void;

type ClientToServer_move =
	| {
			going_x: number;
			going_y: number;
			m: number;
			x: number;
			y: number;
	  }
	| {
			key: "down" | "left" | "right" | "up";
	  };

type ClientToServer_open_chest = {
	id: string;
};

type ClientToServer_party =
	| {
			event: "accept" | "invite" | "kick" | "raccept" | "request";
			name: string;
	  }
	| {
			event: "leave";
	  };

type ClientToServer_ping_trig = {
	id: string;
};

type ClientToServer_players = void;

type ClientToServer_property = {
	typing: boolean;
};

type ClientToServer_respawn = {
	safe: boolean;
};

type ClientToServer_say = {
	message: string;
	name?: string;
};

type ClientToServer_sbuy = {
	rid: string;
};

type ClientToServer_secondhands = void;

type ClientToServer_sell = {
	num: number;
	quantity: number;
};

type ClientToServer_send =
	| {
			gold: number;
			name: string;
	  }
	| {
			name: string;
			num: number;
			q: number;
	  }
	| {
			name: string;
			/** Cosmetic id to send (not a full `cx` slot map). */
			cx: string;
	  };

type ClientToServer_send_updates = Record<string, never>;

type ClientToServer_skill =
	/** Skills that don't take any parameters */
	| {
			name: SkillKey_NoParameter;
	  }
	/** Skills that target an entity */
	| {
			name: SkillKey_TargetParameter;
			id: string;
	  }
	/** Skills that use an item */
	| {
			name: SkillKey_ItemNeeded;
			num: number;
	  }
	/** Skills that target an entity and use an item */
	| {
			name: SkillKey_ItemAndTargetNeeded;
			id: string;
			num: number;
	  }
	/** Skills that need coordinates */
	| {
			name: SkillKey_CoordinatesNeeded;
			x: number;
			y: number;
	  }
	/** Other special skills */
	| {
			name: Extract<SkillKey, "3shot">;
			ids: [string, string, string];
	  }
	| {
			name: Extract<SkillKey, "5shot">;
			ids: [string, string, string, string, string];
	  }
	| {
			name: Extract<SkillKey, "cburst">;
			targets: [string, number][];
	  }
	| {
			name: Extract<SkillKey, "energize">;
			id: string;
			mp: number;
	  };

type ClientToServer_split = {
	num: number;
	quantity: number;
};

type ClientToServer_stop = {
	action: "invis" | "town";
};

type ClientToServer_town = void;

type ClientToServer_tracker = void;

type ClientToServer_trade_buy = {
	id: string;

	/** Quantity (client may send a number or numeric string; server `parseInt`s). */
	q: number | string;
	rid: string;
	slot: TradeSlotType;
};

type ClientToServer_trade_history = void;

type ClientToServer_trade_sell = {
	id: string;
	q: number;
	rid: string;
	slot: TradeSlotType;
};

type ClientToServer_trade_wishlist = {
	level?: number;
	name: ItemKey;
	price: number;
	q: number;
	slot: TradeSlotType;
};

type ClientToServer_transport = {
	s: number;
	to: MapKey;
};

type ClientToServer_unequip = {
	slot: SlotType | TradeSlotType;
};

type ClientToServer_upgrade = {
	calculate?: boolean;
	clevel: number;
	item_num: number;
	offering_num: number;
	scroll_num: number;
};

type ClientToServer_use = {
	item: "hp" | "mp";
};

/** Throw an inventory item toward map coords (`throw_item`). */
type ClientToServer_throw = {
	num: number;
	x: number;
	y: number;
};

/** Equip several items in one request. */
type ClientToServer_equip_batch = Array<{ num: number; slot?: SlotType | TradeSlotType }>;

/** Set run speed / cruise mode. */
type ClientToServer_cruise = number;

/** Equip a cosmetic onto a CX slot. */
type ClientToServer_cx = {
	/** CX slot to change (`skin` changes `player.skin`). Omit with `name` for type-inferred slot. */
	slot?: CosmeticSlotKey | "skin";
	/** Cosmetics id to equip; omit (with `slot`) to unequip. */
	name?: string;
};

type ServerToClient_achievement_progress =
	| ServerToClient_achievement_progress_firehazard
	| {
			name: string;
	  };

type ServerToClient_achievement_progress_firehazard = {
	name: "firehazard";
	count: number;
	needed: number;
};

type ServerToClient_action = ServerToClient_action_projectile | ServerToClient_action_ray;

type ServerToClient_action_base = {
	attacker: string;
	conditions?: Array<ConditionKey>;
	damage?: number;
	heal?: number;
	eta: number;
	m: number;
	pid: string;
	source: SkillKey;
	target: string;
	type: SkillKey;
	x: number;
	y: number;
};

type ServerToClient_action_projectile = ServerToClient_action_base & {
	projectile: string;
};

type ServerToClient_action_ray = ServerToClient_action_base & {
	instant: boolean;
};

type ServerToClient_chat_log = {
	/* The name of the sending player */
	owner: string;

	/* The message of the sending player */
	message: string;

	/* The ID (name) Of the sending player */
	id: string;

	/* Player */
	p?: boolean;
};

type ServerToClient_chest_opened = ServerToClient_chest_opened_loot | ServerToClient_chest_opened_gone;

type ServerToClient_chest_opened_gone = {
	id: string;
	gone: true;
};

type ServerToClient_chest_opened_loot = {
	id: string;
	gold: number;
	goldm: number;
	items: Array<{
		name: string;
		q?: number;
		level?: number;
		looter: string;
	}>;
	opener: string;
	party: boolean;
};

type ServerToClient_cm = {
	/** The name of the player that sent the CM */
	name: string;

	/** The message that they sent */
	message: string;
};

type ServerToClient_code_eval = string;

type ServerToClient_death = {
	id: string;
	place?: string | "attack";
};

type ServerToClient_disappear =
	| ServerToClient_disappear_blink
	| ServerToClient_disappear_invis
	| ServerToClient_disappear_disconnect
	| ServerToClient_disappear_magiport
	| ServerToClient_disappear_door
	| ServerToClient_disappear_town;

type ServerToClient_disappear_blink = {
	/** Blink animation will be used */
	effect: "blink";
	/** Character name */
	id: string;
	reason: "transport";
	/** [x, y, orientation (up/down/left/right)] */
	s?: [x: number, y: number, orientation: number];
	to?: MapKey;
};

/** Character (rogue) went invisible */

type ServerToClient_disappear_disconnect = {
	/** Character name */
	id: string;
	reason: "disconnect";
};

/** Character used 'magiport' */

type ServerToClient_disappear_door = {
	effect?: undefined;
	/** Character name */
	id: string;
	reason: "transport";
	s?: number;
	to?: MapKey | string;
};

/** Character used a 'town' teleport */

type ServerToClient_disappear_invis = {
	/** Character name */
	id: string;
	invis: true;
	reason: "invis";
};

/** Character disconnected */

type ServerToClient_disappear_magiport = {
	effect: "magiport";
	/** Character name */
	id: string;
	reason: "transport";
	s?: [number, number];
	to?: MapKey;
};

/** Character went through a door */

type ServerToClient_disappear_town = {
	/** Town teleport effect (stealth cape still uses `effect: 1` in practice). */
	effect: 1;
	/** Character name */
	id: string;
	reason: "transport";
	s?: number;
	to?: MapKey;
};

type ServerToClient_disappearing_text = {
	message: string;
	x: number;
	y: number;
	id: string;
	args:
		| {
				c: string;
				s: string;
		  }
		| {
				color: string;
				size: string;
		  };
};

type ServerToClient_disconnect_reason = unknown;

type ServerToClient_drop = {
	chest: string;
	id: string;
	items: number;
	map: MapKey;
	party: string;
	x: number;
	y: number;
};

type ServerToClient_emotion = {
	/** emotion name */
	name: string;

	/** character name that did the emotion */
	player: string;
};

type ServerToClient_entities = {
	type: "all" | "xy";
	in: string;
	map: MapKey;

	monsters: ServerToClient_entities_monsters[];
	players: ServerToClient_entities_players[];
};

type ServerToClient_entities_monsters = {
	id: string;
	type: MonsterKey;

	angle?: number;
	move_num?: number;
	moving?: boolean;
	x: number;
	y: number;

	armor?: number;
	attack?: number;
	/** Change id — bumps on entity updates so clients refresh UI. */
	cid: number;
	frequency?: number;
	going_x: number;
	going_y: number;
	mp?: number;
	speed?: number;
	resistance?: number;
	s: StatusInfo;
	/** The ID of the target */
	target?: string | null;

	abs?: false;
	hp?: number;
	level?: number;
	max_hp?: number;
	xp?: number;
};

type ServerToClient_entities_players = {
	id: string;
	ctype: ClassKey | NpcKey;

	abs?: boolean;
	angle?: number;
	going_x?: number;
	going_y?: number;

	/** The 'pvp' NPC has an extra  */
	allow?: boolean;

	afk?: boolean | "code";
	age?: number;
	armor: number;
	attack?: number;
	c: EntityChannelInfos;
	cid: number;
	code?: boolean | string;
	controller?: string;
	cx: CharacterCosmeticInfos;
	focus?: string | null;
	frequency?: number;
	heal?: number;
	x: number;
	y: number;
	hp: number;
	level: number;
	max_hp: number;
	max_mp?: number;
	move_num?: number;
	moving?: boolean;
	mp?: number;
	/** NPCs have names set, normal players do not */
	name?: string;
	npc?: NpcKey;
	owner: string;
	party?: string;
	/** Party DPS contribution metric. */
	pdps?: number;
	q: CharacterQueue;
	range?: number;
	resistance?: number;
	rip?: boolean | number;
	s: StatusInfo;
	skin: string;
	slots?: CharacterSlots;
	speed: number;
	stand?: boolean | "cstand" | "stand0";
	target?: string | null;
	tp?: boolean;
	xp?: number;
};

type ServerToClient_eval = {
	code: string;
};

type ServerToClient_friend =
	| {
			event: "lost";
			friends: Array<string>;
			/** The name of the player that you are no longer friends with */
			name: string;
	  }
	| {
			event: "new";
			/** The name of the player that you are now friends with */
			friends: Array<string>;
			name: string;
	  }
	| {
			event: "request";
			/** The name of the player who sent you a friend request */
			name: string;
	  }
	| {
			event: "update";
			friends: Array<string>;
	  };

type ServerToClient_game_error =
	| string
	| {
			message: string;
	  };

/**
 * World / event spawn notices (`socket.on("game_event")` → {@link on_game_event}).
 * Most boss/event respawns include `map` + coords; `ab_score` carries team scores.
 */
type ServerToClient_game_event = {
	name: MonsterKey | EventKey | string;
	map?: MapKey;
	x?: number;
	y?: number;
	/** AB testing scoreboard (`name === "ab_score"`). */
	A?: number;
	B?: number;
	color?: string;
};

type ServerToClient_game_log =
	| ServerToClient_game_log_string
	| {
			color: string;
			message: ServerToClient_game_log_string;
	  };

type ServerToClient_game_log_string =
	| string
	| "Already partying"
	| "Can't respawn yet."
	| "Invitation expired"
	/** Sent when you chat with { code: true } */
	| "You can't chat this fast with Code yet. The interval is 15 seconds.";

type ServerToClient_game_response = GameResponseDataObject | GameResponseDataString | GameResponseDataUpgradeChance;

type ServerToClient_hit = {
	anim?: string | "miss" | "reflect";
	/** If this is true, the hit was due to an aoe attack */
	aoe?: boolean;
	/** If this is set, we avoided the projectile (by running?) */
	avoid?: boolean;
	/** If set, the projectile has inflicted burn on the target */
	burn?: boolean;
	damage?: number;
	evade?: boolean;
	heal?: number;
	hid?: string;
	id?: string;
	/** Did the entity die from this hit? */
	kill?: boolean;
	lifesteal?: number;
	manasteal?: number;
	miss?: boolean;
	/** Combo / pile-on intensity when many attackers hit the same target. */
	mobbing?: number;
	/** UI Related. Skips drawing line to target (used for cleave, for example) */
	no_lines?: boolean;
	pid?: string;
	projectile?: string;
	reflect?: number;
	/** If set, this was a sneak attack by a rogue */
	sneak?: boolean;
	source?: SkillKey | "burn";
	/** If this is set, these IDs are too close to each other and are receiving additional damage on each hit */
	stacked?: string[];
	/** If set, the character is stunned with this attack */
	stun?: boolean;
};

type ServerToClient_invite = {
	/** The name of the character who invited */
	name: string;
};

type ServerToClient_limitdcreport = {
	/** How many of each call you made */
	mcalls: {
		auth?: number;
		bank?: number;
		buy?: number;
		code?: number;
		equip?: number;
		leave?: number;
		loaded?: number;
		merchant?: number;
		move?: number;
		"o:home"?: number;
		party?: number;
		ping_trig?: number;
		players?: number;
		property?: number;
		render?: number;
		secondhands?: number;
		send?: number;
		send_updates?: number;
		skill?: number;
		stop?: number;
		target?: number;
		transport?: number;
		unequip?: number;
		use?: number;
	};
	/** Call cost limit. It's lower for comm sockets. */
	climit?: number;
	/** Total number of socket messages sent */
	total?: number;
};

type ServerToClient_lostandfound = Array<
	ItemInfo & {
		/** If set, this item is not for sale. The player wants to buy this item. */
		b?: boolean;
		/** Number of minutes remaining for giveaway items */
		giveaway?: number;
		/** List of character IDs that are in the giveaway */
		list?: Array<string>;
		price: number;
		rid: string;
	}
>;

type ServerToClient_magiport = {
	name: string;
};

type ServerToClient_new_map = {
	direction: number;
	effect: number | "blink" | "magiport";
	entities: ServerToClient_entities;
	eval?: string;
	in: string;
	info?: ServerToClient_new_map_map_infos;
	m: number;
	name: MapKey;
	x: number;
	y: number;
};

type ServerToClient_new_map_map_infos =
	| {
			dice: "bets" | "roll" | "lock";
			num?: string;
			seconds: number;
	  }
	| Record<string, never>;

type ServerToClient_notthere = {
	place: "attack";
};

type ServerToClient_party_update = {
	list: string[];
	message?: string;
	party: {
		[T in string]: {
			gold: number;
			in: string;
			/** Party size when this party snapshot was built. */
			l: number;
			level: number;
			luck: number;
			map: MapKey;
			share: number;
			pdps: number;
			skin: string;
			type: ClassKey;
			x: number;
			xp: number;
			y: number;
			cx?: CharacterCosmeticInfos;
		};
	};
};

type ServerToClient_ping_ack = {
	id: string;
};

type ServerToClient_player = CharacterEntity & {
	hp: number;
	max_hp: number;
	mp: number;
	max_mp: number;
	attack: number;
	heal: number;
	fear: number;
	courage: number;
	mcourage: number;
	pcourage: number;
	frequency: number;
	speed: number;
	range: number;
	armor: number;
	resistance: number;
	level: number;
	rip: boolean;
	afk: boolean | string | "afk";
	s: StatusInfo;
	c: EntityChannelInfos;
	q: CharacterQueue;
	/** Absolute placement — entity was snapped/set without relative motion. */
	abs?: boolean;
	age: number;
	angle?: number;
	blast: number;
	pdps: number;
	id: string;
	name?: string;
	x: number;
	y: number;
	going_x?: number;
	going_y?: number;
	moving?: boolean;
	stand?: boolean | "cstand" | "stand0";
	skin: string;
	slots: CharacterSlots;
	ctype: ClassKey;
	owner: string;
	party?: string;
	explosion: number;
	firesistance: number;
	fzresistance: number;
	mp_reduction: number;
	pnresistance: number;
	stun: number;
	int: number;
	str: number;
	dex: number;
	vit: number;
	for: number;
	mp_cost: number;
	max_xp: number;
	goldm: number;
	xpm: number;
	xp: number;
	luckm: number;
	map: MapKey;
	in: string;
	/** The size of the character's inventory */
	isize: number;
	/** The number of empty inventory slots */
	esize: number;
	gold: number;
	cash: number;
	/** This number is the number of monsters currently targeting you */
	targets: number;
	target?: string;
	m: number;
	evasion: number;
	miss: number;
	move_num?: number;
	reflection: number;
	lifesteal: number;
	manasteal: number;
	rpiercing: number;
	apiercing: number;
	crit: number;
	critdamage: number;
	dreturn: number;
	emx?: {
		[T in string]?: number;
	};
	tax: number;
	xrange: number;
	items: Array<ItemInfo | null>;
	cc: number;

	// (Probably) GUI Related things
	cid: number;
	controller?: string;
	cx: CharacterCosmeticInfos;

	ipass?: string;
	friends?: Array<string>;
	/** Owned cosmetics inventory counts (`player.p.acx` — id → qty). */
	acx?: CharacterOwnedCosmetics;
	/** Extra equipped cosmetic ids. */
	xcx?: Array<string>;
	/** Extra events (e.g. ["game_response", {response: "upgrade_success", level: 4, num: 8}]) */
	hitchhikers?: Array<[string, ServerToClient_game_response | ServerToClient_eval]>;
	/** Holds bank information when the character is inside the bank */
	user?: CharacterBankInfos;
	/** (GUI Related) Set if you move inventory items. Flag for reopening player's inventory. */
	reopen?: boolean;
};

type ServerToClient_players = Array<{
	/** Are they AFK? */
	afk: number;

	/** How many days have passed since this character was created */
	age: number;

	/** What level are they */
	level: number;

	/** Character name */
	name: string;

	/** What map are they on */
	map: MapKey;

	/** What party are they in? */
	party: string;

	/** What type of character are they */
	type: ClassKey;
}>;

type ServerToClient_pm = {
	/* The name of the sending player */
	owner: string;

	/* The player the message is being sent to */
	to: string;

	/* The message of the sending player */
	message: string;

	/* The ID (name) Of the sending player */
	id: string;

	/* Denotes whether this message has been sent cross server */
	xserver?: string;
};

type ServerToClient_q_data = {
	num: number;
	p: {
		chance: number;
		level: number;
		name: ItemKey;
		nums: Array<number>;
		scroll: ItemKey;
		offering?: ItemKey;
		failure?: true;
		success?: true;
	};
	q: CharacterQueue;
};

type ServerToClient_request = {
	name: string;
};

type ServerToClient_secondhands = Array<
	ItemInfo & {
		/** If set, this item is not for sale. The player wants to buy this item. */
		b?: boolean;
		/** Number of minutes remaining for giveaway items */
		giveaway?: number;
		/** List of character IDs that are in the giveaway */
		list?: Array<string>;
		price: number;
		rid: string;
	}
>;

type ServerToClient_server_info = Partial<Record<MonsterKey, ServerToClient_server_info_live | ServerToClient_server_info_notlive | ServerToClient_server_info_event>> & {
	egghunt?: boolean;
	halloween?: boolean;
	holidayseason?: boolean;
	lunarnewyear?: boolean;
	valentines?: boolean;
} & {
	goobrawl?: ServerToClient_server_info_event;
} & {
	abtesting?:
		| ServerToClient_server_info_event
		| {
				/** A date string of when sign-ups will stop for the event */
				signup_end: string;
				/** Team A signup / score count (AB testing). */
				A: number;
				/** Team B signup / score count (AB testing). */
				B: number;
				/** AB testing event id. */
				id: string;
		  };
};

type ServerToClient_server_info_event = {
	/** A date string of when the event will end */
	end?: string;
};

type ServerToClient_server_info_live = {
	hp: number;
	live: true;
	map: MapKey;
	max_hp: number;
	target?: string;
	/** NOTE: Some event monsters don't have x and y (e.g.: Slenderman) */
	x?: number;
	y?: number;
};

type ServerToClient_server_info_notlive = {
	live: false;
	/** When the monster will spawn next */
	spawn: string;
};

type ServerToClient_skill_timeout = {
	name: SkillKey;
	ms: number;
	penalty: number;
};

type ServerToClient_start = ServerToClient_player & {
	info?: ServerToClient_new_map_map_infos;
	code_slot: number;
	code_version: number;
	base_gold: {
		[T in MonsterKey]?: { [T in string]?: number };
	};
	s_info: ServerToClient_server_info;
	entities: ServerToClient_entities;
};

type ServerToClient_tavern = {
	event: "lost" | "won" | "bet";
	name: string;
	type: "dice";
	num: number;
	gold: number;
	dir: "up" | "down";
};

type ServerToClient_tracker = Tracker;

type ServerToClient_ui =
	| ServerToClient_ui_buy_sell
	| ServerToClient_ui_trade
	| ServerToClient_ui_fishing_mining
	| ServerToClient_ui_massproduction
	| ServerToClient_ui_mluck
	| ServerToClient_ui_aoe
	| ServerToClient_ui_rspeed
	| ServerToClient_ui_track
	| { type: string; [key: string]: unknown };

type ServerToClient_ui_track = {
	type: "track";
	name: string;
};

type ServerToClient_ui_aoe = {
	type: "stomp" | "agitate" | "scare";
	name: string;
	ids: Array<string>;
};

type ServerToClient_ui_buy_sell = {
	type: "-$" | "+$";
	id: string | "basics" | "scrolls";
	name: string;
	item: {
		name: ItemKey;
		q: number;
	};
	num?: string;
};

type ServerToClient_ui_fishing_mining = {
	type: "fishing_fail" | "fishing_none" | "fishing_start" | "mining_fail" | "mining_none" | "mining_start";
	name?: string;
	direction?: number;
};

type ServerToClient_ui_massproduction = {
	type: "massproduction";
	name: string;
};

type ServerToClient_ui_mluck = {
	type: "mluck";
	from: string;
	to: string;
};

type ServerToClient_ui_rspeed = {
	type: "rspeed";
	from: string;
	to: string;
};

type ServerToClient_ui_trade = {
	type: "+$$";
	seller: string;
	buyer: string;
	item: ItemInfo & { price: number };
	slot: TradeSlotType;
	num: number;
	snum: number;
};

type ServerToClient_upgrade = {
	type: "compound" | "exchange" | "upgrade";

	/** 0 = fail, 1 = success */
	success: 0 | 1;
};

type ServerToClient_welcome = {
	/** The character gets returned if you open a socket with a secret (i.e. /comm and click on one of your characters) */
	character?: CharacterEntity;
	region: ServerRegion;
	in: string;
	map: MapKey;

	/** Server mode. */
	gameplay: "normal" | "hardcore" | "test" | "dungeon";

	/**
	 * Map instance info for the observer's first map (`instances[map].info`).
	 * Usually `{}`; duel / event maps may include `A`/`B` teams, `seconds`, `active`, …
	 */
	info: {
		seconds?: number;
		active?: boolean;
		A?: Array<Record<string, unknown>>;
		B?: Array<Record<string, unknown>>;
		[key: string]: unknown;
	};

	name: ServerIdentifier;
	pvp: boolean;
	x: number;
	y: number;
	version?: number;
	/** Live world events (`E`) at connect time. */
	S?: SEventsInfos;
};

type ClientToServer_set_home = void;

type ClientToServer_activate = { num: number; slot?: undefined } | { slot: SlotType | string; num?: undefined };

type ClientToServer_destroy = {
	num: number;
	q?: number;
	statue?: boolean;
};

type ClientToServer_code = {
	run?: boolean;
};

type ClientToServer_convert = {
	num?: number;
	[key: string]: unknown;
};

type ClientToServer_list_pvp = {
	code?: string | number;
};

type ClientToServer_target = {
	id?: string | null;
};

type ClientToServer_duel = { event: "challenge"; id?: string; name?: string } | { event: "accept"; id?: string; name?: string } | { event: string; id?: string; name?: string };

type ClientToServer_destat = {
	num: number;
};

type ClientToServer_locksmith = {
	num: number;
	operation: "lock" | "unlock" | "seal" | "unseal" | string;
	item_num?: number;
};

type ClientToServer_merge = {
	pet?: SlotType | string;
	[key: string]: unknown;
};

type ClientToServer_poke = {
	name: string;
};

type ClientToServer_signup = {
	[key: string]: unknown;
};

type ClientToServer_buy_with_cash = {
	name?: ItemKey | string;
	[key: string]: unknown;
};

type ClientToServer_buy_shells = {
	gold: number;
};

type ClientToServer_quest = {
	[key: string]: unknown;
};

type ClientToServer_tavern_cmd = {
	[key: string]: unknown;
};

type ServerToClient_kill_credit = {
	mtype: MonsterKey | string;
};

type ServerToClient_correction = {
	x: number;
	y: number;
};

type ServerToClient_track = Array<{
	id?: string;
	dist?: number;
	[key: string]: unknown;
}>;

type ServerToClient_pvp_list = {
	code?: string | number;
	list: unknown[];
};

type ServerToClient_game_chat = string;

type ServerToClient_ui_log = string;

type ServerToClient_simple_eval = {
	code?: string;
	output?: unknown;
	json_output?: unknown;
	[key: string]: unknown;
};

type ServerToClient_duel = {
	event: string;
	name?: string;
	[key: string]: unknown;
};

type ServerToClient_observing = {
	map?: MapKey | string;
	x?: number;
	y?: number;
};

interface ClientToServerEvents {
	attack: ClientToServer_attack;
	auth: ClientToServer_auth;
	bank: ClientToServer_bank;
	bet: ClientToServer_bet;
	booster: ClientToServer_booster;
	buy: ClientToServer_buy;
	cm: ClientToServer_cm;
	compound: ClientToServer_compound;
	craft: ClientToServer_craft;
	cruise: ClientToServer_cruise;
	cx: ClientToServer_cx;
	dismantle: ClientToServer_dismantle;
	donate: ClientToServer_donate;
	emotion: ClientToServer_emotion;
	enter: ClientToServer_enter;
	equip: ClientToServer_equip;
	equip_batch: ClientToServer_equip_batch;
	eval: ClientToServer_eval;
	exchange_buy: ClientToServer_exchange_buy;
	exchange: ClientToServer_exchange;
	friend: ClientToServer_friend;
	heal: ClientToServer_heal;
	imove: ClientToServer_imove;
	interaction: ClientToServer_interaction;
	join_giveaway: ClientToServer_join_giveaway;
	join: ClientToServer_join;
	leave: ClientToServer_leave;
	loaded: ClientToServer_loaded;
	lostandfound: ClientToServer_lostandfound;
	magiport: ClientToServer_magiport;
	mail_take_item: ClientToServer_mail_take_item;
	mail: ClientToServer_mail;
	merchant: ClientToServer_merchant;
	monsterhunt: ClientToServer_monsterhunt;
	move: ClientToServer_move;
	open_chest: ClientToServer_open_chest;
	party: ClientToServer_party;
	ping_trig: ClientToServer_ping_trig;
	players: ClientToServer_players;
	property: ClientToServer_property;
	respawn: ClientToServer_respawn;
	say: ClientToServer_say;
	sbuy: ClientToServer_sbuy;
	secondhands: ClientToServer_secondhands;
	sell: ClientToServer_sell;
	send_updates: ClientToServer_send_updates;
	send: ClientToServer_send;
	skill: ClientToServer_skill;
	split: ClientToServer_split;
	stop: ClientToServer_stop;
	throw: ClientToServer_throw;
	town: ClientToServer_town;
	tracker: ClientToServer_tracker;
	trade_buy: ClientToServer_trade_buy;
	trade_history: ClientToServer_trade_history;
	trade_sell: ClientToServer_trade_sell;
	trade_wishlist: ClientToServer_trade_wishlist;
	transport: ClientToServer_transport;
	unequip: ClientToServer_unequip;
	upgrade: ClientToServer_upgrade;
	use: ClientToServer_use;
	set_home: ClientToServer_set_home;
	activate: ClientToServer_activate;
	destroy: ClientToServer_destroy;
	code: ClientToServer_code;
	convert: ClientToServer_convert;
	list_pvp: ClientToServer_list_pvp;
	target: ClientToServer_target;
	duel: ClientToServer_duel;
	destat: ClientToServer_destat;
	locksmith: ClientToServer_locksmith;
	merge: ClientToServer_merge;
	poke: ClientToServer_poke;
	signup: ClientToServer_signup;
	buy_with_cash: ClientToServer_buy_with_cash;
	buy_shells: ClientToServer_buy_shells;
	quest: ClientToServer_quest;
	tavern: ClientToServer_tavern_cmd;
	/** Admin / UI / legacy emits — payloads vary; tighten when dogfooding those paths. */
	blend: Record<string, unknown>;
	bless_server: Record<string, unknown>;
	blocker: Record<string, unknown>;
	ccreport: Record<string, never> | void;
	click: Record<string, unknown>;
	creward: Record<string, unknown>;
	deepsea: Record<string, unknown>;
	disconnect: void;
	error: Record<string, unknown>;
	gm: Record<string, unknown>;
	harakiri: Record<string, never> | void;
	legacify: Record<string, unknown>;
	misc_npc: Record<string, unknown>;
	mreport: Record<string, unknown>;
	notice: Record<string, unknown>;
	"o:command": Record<string, unknown>;
	"o:home": Record<string, never> | void;
	pet: Record<string, unknown>;
	pets: Record<string, unknown>;
	play: Record<string, unknown>;
	random_look: Record<string, never> | void;
	render: Record<string, unknown>;
	requested_ack: Record<string, unknown>;
	shutdown: Record<string, unknown>;
	skin: Record<string, unknown>;
	tarot: Record<string, unknown>;
	test: Record<string, unknown>;
	trade: Record<string, unknown>;
	unlock: Record<string, unknown>;
	ureward: Record<string, unknown>;
	whistle: Record<string, never> | void;
}

interface ServerToClientEvents {
	/** Socket.IO connected (no game payload). */
	connect: void;
	/** Socket.IO disconnected (no game payload). */
	disconnect: void;
	achievement_progress: ServerToClient_achievement_progress;
	action: ServerToClient_action;
	chat_log: ServerToClient_chat_log;
	chest_opened: ServerToClient_chest_opened;
	cm: ServerToClient_cm;
	code_eval: ServerToClient_code_eval;
	death: ServerToClient_death;
	disappear: ServerToClient_disappear;
	disappearing_text: ServerToClient_disappearing_text;
	disconnect_reason: ServerToClient_disconnect_reason;
	drop: ServerToClient_drop;
	eval: ServerToClient_eval;
	emotion: ServerToClient_emotion;
	entities: ServerToClient_entities;
	/** Friend list updates (there is no separate `friends` socket event). */
	friend: ServerToClient_friend;
	game_error: ServerToClient_game_error;
	game_event: ServerToClient_game_event;
	game_log: ServerToClient_game_log;
	game_response: ServerToClient_game_response;
	hit: ServerToClient_hit;
	invite: ServerToClient_invite;
	limitdcreport: ServerToClient_limitdcreport;
	lostandfound: ServerToClient_lostandfound;
	magiport: ServerToClient_magiport;
	new_map: ServerToClient_new_map;
	notthere: ServerToClient_notthere;
	party_update: ServerToClient_party_update;
	ping_ack: ServerToClient_ping_ack;
	player: ServerToClient_player;
	players: ServerToClient_players;
	pm: ServerToClient_pm;
	q_data: ServerToClient_q_data;
	request: ServerToClient_request;
	/** Item list from Ponty */
	secondhands: ServerToClient_secondhands;
	server_info: ServerToClient_server_info;
	skill_timeout: ServerToClient_skill_timeout;
	start: ServerToClient_start;
	tavern: ServerToClient_tavern;
	tracker: ServerToClient_tracker;
	ui: ServerToClient_ui;
	upgrade: ServerToClient_upgrade;
	welcome: ServerToClient_welcome;
	kill_credit: ServerToClient_kill_credit;
	correction: ServerToClient_correction;
	track: ServerToClient_track;
	pvp_list: ServerToClient_pvp_list;
	game_chat: ServerToClient_game_chat;
	ui_log: ServerToClient_ui_log;
	simple_eval: ServerToClient_simple_eval;
	duel: ServerToClient_duel;
	observing: ServerToClient_observing;
	/** Echo of `player.p.trade_history` after `trade_history` emit. */
	trade_history: unknown[];
	/** Tavern bet update (server→client). */
	bet: Record<string, unknown>;
	/** GM tools / responses. */
	gm: Record<string, unknown>;
	/** Server test harness payloads. */
	test: unknown;
	blocker: unknown;
	ccreport: unknown;
	/** Rare / legacy enter ack. */
	enter: Record<string, unknown>;
}

/**
 * Emit argument list: void events take no data; otherwise data is required
 * (optional when the payload type already includes `undefined`).
 */
type GameSocketEmitArgs<T> = [T] extends [void] ? [] : undefined extends T ? [data?: T] : [data: T];

/**
 * Typed game socket — `get_socket()` / `parent.socket`.
 * `on`/`once` listen to server→client events; `emit` sends client→server events.
 *
 * @example
 * const socket = get_socket();
 * socket.on("hit", (data) => game_log(data.damage));
 * socket.emit("town");
 * socket.emit("ping_trig", { id: "x" });
 */
interface GameSocket {
	on<K extends keyof ServerToClientEvents>(event: K, handler: (data: ServerToClientEvents[K]) => void): this;
	once<K extends keyof ServerToClientEvents>(event: K, handler: (data: ServerToClientEvents[K]) => void): this;
	off?<K extends keyof ServerToClientEvents>(event: K, handler?: (data: ServerToClientEvents[K]) => void): this;
	emit<K extends keyof ClientToServerEvents>(event: K, ...args: GameSocketEmitArgs<ClientToServerEvents[K]>): this;
	connected?: boolean;
	disconnected?: boolean;
	id?: string;
}

/** Alias for docs / older CODE samples. */
type SocketWithEventsFunctions = GameSocket;
