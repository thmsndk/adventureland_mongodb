/**
 * Shallow `G` catalog shapes for autocomplete.
 * Inspect live data with `show_json(G)` / `show_json(Object.keys(G))`.
 * `G` is `parent.G` — static game data loaded from `/data.js` and post-processed.
 * Key unions come from g-keys.d.ts (generated from design/).
 */

interface GSkill {
	name?: string;
	type?: string;
	mp?: number;
	cooldown?: number;
	range?: number;
	/** Shared cooldown group id (see {@link is_on_cooldown}). */
	share?: string;
	/** Classes allowed to use this skill. */
	class?: ClassKey[];
	/** When set, the skill expects a target id. */
	target?: any;
	range_multiplier?: number;
	range_bonus?: number;
	[key: string]: any;
}

interface GItem {
	name?: string;
	type?: string;
	/** Base gold value. */
	g?: number;
	upgrade?: any;
	compound?: any;
	/** Potion-like restores, e.g. `[["hp", 200]]`. */
	gives?: any[];
	stand?: any;
	[key: string]: any;
}

interface GMonster {
	name?: string;
	hp?: number;
	attack?: number;
	xp?: number;
	speed?: number;
	range?: number;
	damage_type?: string;
	/** Derived charge speed when missing in raw data. */
	charge?: number;
	[key: string]: any;
}

interface GCatalog {
	/** Skill definitions keyed by {@link SkillKey}. */
	skills: Record<SkillKey, GSkill>;
	/** Item definitions keyed by {@link ItemKey}. */
	items: Record<ItemKey, GItem>;
	/** Monster base stats keyed by {@link MonsterKey}. */
	monsters: Record<MonsterKey, GMonster>;
	/** Map metadata, doors, NPC lists, spawn points, … */
	maps: Record<MapKey, any>;
	/** NPC definitions (shops, roles, quests). */
	npcs: Record<NpcKey, any>;
	/** Class definitions. */
	classes: Record<ClassKey, any>;
	/** Status condition definitions. */
	conditions: Record<ConditionKey, any>;
	/** Visual / collision dimensions. */
	dimensions?: { [id: string]: any };
	/** Map geometry used by movement checks. */
	geometry?: { [id: string]: any };
	/** Token / special-currency shops. */
	tokens?: { [id: string]: any };
	/** Crafting recipes keyed by product {@link ItemKey}. */
	craft?: Partial<Record<ItemKey, any>>;
	/** Docs / tutorial metadata and related content. */
	docs?: { functions?: string[]; objects?: string[]; [key: string]: any };
	/** Events joinable via {@link join} / {@link smart_move}. */
	events?: Partial<Record<EventKey, any>>;
	[key: string]: any;
}

/**
 * Static game data (items, monsters, skills, maps, …).
 * Example: `show_json(G.monsters.goo)`, `show_json(G.skills.burst)`.
 */
declare const G: GCatalog;
