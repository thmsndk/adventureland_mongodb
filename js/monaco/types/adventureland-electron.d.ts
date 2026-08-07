/**
 * Additive Node / Electron typings for CODE IntelliSense.
 * Registered only when `is_electron` or `is_cli` is set on the client.
 * Web browsers do not get these globals.
 *
 * Runtime: Electron desktop / CLI runners may expose `require` and
 * `cli_require` (see runner_functions.js). This is a curated surface, not
 * full @types/node.
 */

interface NodeRequire {
	(id: string): any;
	resolve?: (id: string) => string;
	cache?: { [id: string]: any };
	main?: any;
}

interface NodeModule {
	exports: any;
	require?: NodeRequire;
	id?: string;
	filename?: string;
	loaded?: boolean;
	parent?: any;
	children?: any[];
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
	nextTick(callback: (...args: any[]) => void, ...args: any[]): void;
	exit?(code?: number): void;
	argv?: string[];
	pid?: number;
}

declare var require: NodeRequire;
declare var module: NodeModule;
declare var exports: any;
declare var process: NodeProcess;
declare var Buffer: {
	from(data: any, encoding?: string): any;
	alloc?(size: number): any;
	isBuffer?(obj: any): boolean;
	[key: string]: any;
};

/**
 * CLI runner bridge (`window.cli_require = parent.cli_require` when `is_cli`).
 * Prefer this over bare `require` in CODE when both exist.
 */
declare var cli_require: NodeRequire;
