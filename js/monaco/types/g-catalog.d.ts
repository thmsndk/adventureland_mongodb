/** Shallow G catalog shapes for autocomplete */
interface GSkill {
	name?: string;
	type?: string;
	mp?: number;
	cooldown?: number;
	range?: number;
	[key: string]: any;
}

interface GItem {
	name?: string;
	type?: string;
	g?: number;
	[key: string]: any;
}

interface GMonster {
	name?: string;
	hp?: number;
	attack?: number;
	xp?: number;
	[key: string]: any;
}

interface GCatalog {
	skills: { [id: string]: GSkill };
	items: { [id: string]: GItem };
	monsters: { [id: string]: GMonster };
	maps: { [id: string]: any };
	npcs: { [id: string]: any };
	classes: { [id: string]: any };
	conditions: { [id: string]: any };
	dimensions?: { [id: string]: any };
	geometry?: { [id: string]: any };
	tokens?: { [id: string]: any };
	craft?: { [id: string]: any };
	docs?: { functions: string[]; objects: string[] };
	[key: string]: any;
}

declare const G: GCatalog;
