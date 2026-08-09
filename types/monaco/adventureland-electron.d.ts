/**
 * Additive Node / Electron typings for CODE IntelliSense.
 * Registered only when `is_electron` or `is_cli` is set on the client.
 * Web browsers do not get these globals.
 *
 * Runtime: Electron desktop / CLI runners may expose `require` and
 * `cli_require` (see runner_functions.js). This is a curated surface, not
 * full @types/node.
 */

interface NodeFSPromises {
	readFile?(path: string, encoding?: string): Promise<string | Uint8Array>;
	writeFile?(path: string, data: string | Uint8Array): Promise<void>;
	[key: string]: unknown;
}

interface NodeFSModule {
	readFileSync?(path: string, encoding?: string): string | Buffer;
	writeFileSync?(path: string, data: string | Uint8Array): void;
	existsSync?(path: string): boolean;
	promises?: NodeFSPromises;
	[key: string]: unknown;
}

interface NodePathModule {
	join?(...parts: string[]): string;
	dirname?(path: string): string;
	basename?(path: string, ext?: string): string;
	extname?(path: string): string;
	resolve?(...parts: string[]): string;
	[key: string]: unknown;
}

interface NodeRequire {
	(id: "fs"): NodeFSModule;
	(id: "path"): NodePathModule;
	(id: string): unknown;
	resolve?(id: string): string;
	cache?: { [id: string]: { exports?: unknown } };
	main?: { exports?: unknown };
}

interface NodeModule {
	exports: unknown;
	require?: NodeRequire;
	id?: string;
	filename?: string;
	loaded?: boolean;
	parent?: NodeModule | null;
	children?: NodeModule[];
	paths?: string[];
}

interface NodeProcess {
	env: { [key: string]: string | undefined };
	platform: string;
	arch?: string;
	version?: string;
	versions?: { [key: string]: string | undefined };
	cwd(): string;
	chdir?(directory: string): void;
	nextTick(callback: (...args: unknown[]) => void, ...args: unknown[]): void;
	exit?(code?: number): void;
	argv?: string[];
	pid?: number;
}

interface NodeBuffer {
	length: number;
	toString(encoding?: string): string;
	[index: number]: number;
}

interface NodeBufferConstructor {
	from(data: string | ArrayBuffer | ArrayLike<number> | NodeBuffer, encoding?: string): NodeBuffer;
	alloc?(size: number, fill?: string | number | NodeBuffer, encoding?: string): NodeBuffer;
	isBuffer?(obj: unknown): obj is NodeBuffer;
}

declare var require: NodeRequire;
declare var module: NodeModule;
declare var exports: unknown;
declare var process: NodeProcess;
declare var Buffer: NodeBufferConstructor;

/**
 * CLI runner bridge (`window.cli_require = parent.cli_require` when `is_cli`).
 * Prefer this over bare `require` in CODE when both exist.
 */
declare var cli_require: NodeRequire;
