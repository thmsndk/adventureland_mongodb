/**
 * `G` catalog wiring - first-party AdventureLand types (shared + Monaco).
 * Deep value shapes: g-shapes.d.ts. Key unions: g-keys.d.ts (from design/).
 *
 * @example
 * show_json(G.monsters.goo);
 * show_json(G.skills.burst);
 * const atk = G.items.blade.attack;
 * if (G.craft.computer) auto_craft("computer");
 * show_json(Object.keys(G.items));
 */

/**
 * Static game data catalog (`parent.G` / global {@link G}).
 * No open index signature — unknown buckets stay optional known fields so typos fail checkJs.
 */
interface GCatalog {
	/** Skill definitions keyed by {@link SkillKey}. */
	skills: Record<SkillKey, GSkill>;
	/** Item definitions keyed by {@link ItemKey}. */
	items: Record<ItemKey, GItem>;
	/** Monster base stats keyed by {@link MonsterKey}. */
	monsters: Record<MonsterKey, GMonster>;
	/** Map metadata, doors, NPC lists, spawn points, … */
	maps: Record<MapKey, GMap>;
	/** NPC definitions (shops, roles, quests). */
	npcs: Record<NpcKey, GNpc>;
	/** Class definitions. */
	classes: Record<ClassKey, GClass>;
	/** Status condition definitions. */
	conditions: Record<ConditionKey, GCondition>;
	/** Crafting recipes. */
	craft?: GCrafts;
	/** Dismantle recipes. */
	dismantle?: Partial<Record<ItemKey | string, GDismantle>>;
	/** Drop tables. */
	drops?: GDrops;
	/** Events joinable via {@link join} / {@link smart_move}. */
	events?: Partial<Record<EventKey, GEvent>>;
	/** Set bonuses. */
	sets?: Record<string, GSet>;
	/** Token shop maps. */
	tokens?: Partial<Record<ItemKey | string, Partial<Record<ItemKey | string, number>>>>;
	/** Projectiles. */
	projectiles?: Partial<Record<ProjectileKey, GProjectile>>;
	/** Cosmetics catalog. */
	cosmetics?: GCosmetic;
	/** Dimensions / sprite sizes. */
	dimensions?: Record<string, GDimension>;
	/** Map geometry used by movement checks. */
	geometry?: Partial<Record<MapKey | string, GGeometry>>;
	/** Animations. */
	animations?: Partial<Record<AnimationKey, GAnimation>>;
	/** Achievements. */
	achievements?: Record<string, GAchievement>;
	/** Emotions. */
	emotions?: Partial<Record<EmotionKey, GEmotion>>;
	/** Images / imagesets / sprites / tilesets / titles / games / multipliers / levels. */
	images?: Record<string, GImage>;
	imagesets?: Record<string, GImageset>;
	sprites?: Record<string, GSprite>;
	tilesets?: Record<string, GTileset>;
	titles?: Record<string, GTitle>;
	games?: Record<string, GGame>;
	multipliers?: Record<string, GMultiplier>;
	/** XP thresholds by level. */
	levels?: Partial<Record<number, number>>;
	/** Docs / tutorial metadata. */
	docs?: { functions?: string[]; objects?: string[]; [key: string]: unknown };
	/** Data version number. */
	version?: number;
	/**
	 * Base gold by monster/map — attached at runtime from `socket.on("start")`.
	 * @example
	 * show_json(G.base_gold?.goo);
	 */
	base_gold?: Partial<Record<MonsterKey, Partial<Record<MapKey, number>>>>;
}
