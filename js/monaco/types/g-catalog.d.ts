/** Shallow G catalog shapes for autocomplete */
interface GCatalog {
	skills: { [id: string]: any };
	items: { [id: string]: any };
	monsters: { [id: string]: any };
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
