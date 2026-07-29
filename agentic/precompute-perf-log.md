# Precompute BFS performance log

Measured stack for faster BFS precompute (see plan: Faster BFS Precompute).

Champion rule: keep only changes that deep-equal prior dumps and improve median wall-clock by ≥3%.

## baseline

- Runs ms: [122049,125423]
- Median wall-clock: **123736ms**
- Equality vs compare: **n/a**
- Top slowest maps: main 20491ms, winterland 13759ms, shellsisland 12136ms, desertland 11662ms, duelland 9821ms
- Finished: 2026-07-27T21:54:06.498Z

## L0

- Runs ms: [106916,122082]
- Median wall-clock: **114499ms**
- vs `baseline`: 123736ms → 114499ms (-7.5%)
- Equality vs compare: **PASS**
- Top slowest maps: main 16806ms, shellsisland 16221ms, winterland 12889ms, desertland 9948ms, duelland 8181ms
- Finished: 2026-07-27T21:58:39.427Z

- Takeaway: PR #71 stripped BFS collision in `server_bfs2` only; dumps identical, ~7.5% wall-clock (smap still uses classic `can_move`).
