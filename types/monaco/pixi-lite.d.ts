/**
 * Minimal PIXI surface used by CODE drawings (not a full @types/pixi.js).
 * Prefer {@link draw_line} / {@link draw_circle}; use `new PIXI.Graphics()` for custom shapes.
 */
interface PIXIGraphics {
	lineStyle(lineWidth?: number, color?: number, alpha?: number): this;
	moveTo(x: number, y: number): this;
	lineTo(x: number, y: number): this;
	drawCircle(x: number, y: number, radius: number): this;
	beginFill?(color?: number, alpha?: number): this;
	endFill(): this;
	clear?(): this;
	destroy(options?: boolean | { children?: boolean; texture?: boolean; baseTexture?: boolean }): void;
	alpha?: number;
	visible?: boolean;
	x?: number;
	y?: number;
}

interface PIXINamespace {
	Graphics: { new (): PIXIGraphics };
}
