# AdventureLand types — open-source package design (not published yet)

This documents how first-party types in this repo can later ship as a community
replacement for typed-adventureland. **Do not publish until explicitly asked.**

## Goals

- One source of truth in `adventureland_mongodb` / this game repo
- Player CODE (Monaco), VS Code client (`js/`), and VS Code server (`node/`) share shapes
- Privileged server/client internals stay out of the public package
- No dependency on typed-adventureland

## Folder → audience

| Path | Monaco players | npm public | VS Code client | VS Code server |
|------|----------------|------------|----------------|----------------|
| `types/shared` | yes | **yes** | yes | yes |
| `types/monaco` | yes | optional / “code” entry | yes | no |
| `types/client` | parent-window only (via manifest) | no (or thin re-export) | yes | no |
| `types/server` | **never** | **never** | no | yes |

## Proposed package name

Working name: `adventureland-types` (or `@adventureland/types` if a scope exists).

## Proposed package layout (when publishing)

Publish a **built** subset, not the whole game repo:

```text
adventureland-types/
  package.json
  README.md
  shared/          # copied/generated from types/shared
  code/            # optional: monaco globals + api ambient for CODE authors
  index.d.ts       # re-exports shared (+ code if included)
```

`types/server` and most of `types/client` stay private to the game repo.

## package.json sketch

See `package.json.example` in this folder. Highlights:

- `"types"` / `exports` pointing at `index.d.ts`
- `files`: only the published `.d.ts` tree
- No runtime JS required (types-only package)
- Version aligned with game `Version` or independent semver — decide at publish time

## Consumer setup (future)

**CODE / Monaco (this game):** unchanged — `bundle.js` from `rebuild_monaco_types_bundle.js`.

**External bots / scripts (npm):**

```jsonc
// tsconfig.json
{
  "compilerOptions": { "types": ["adventureland-types"] }
  // or: "include": ["./node_modules/adventureland-types/**/*.d.ts"]
}
```

## Generation / CI before publish

1. `node agentic/generate_monaco_g_keys.js` (design/ → key unions)
2. `node agentic/rebuild_monaco_types_bundle.js` (game Monaco only)
3. `node agentic/check_types_layout.js` (layout + bundle + CraftKey)
4. A future `agentic/pack_public_types.js` would copy `types/shared` (+ optional code) into the publish folder and strip internal `@link`s that point at private APIs

## Non-goals for v1 public package

- Full socket protocol parity docs site
- Server economy / DB schemas
- Shipping `bundle.js` (Monaco wiring stays in the game)

## Open questions (decide at publish)

- Scoped vs unscoped npm name
- Whether CODE globals (`declare const character`) ship in the public package or only shared interfaces
- License notice / attribution for community contributors
- Sync cadence with game `Version`
