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

## L1

- Runs ms: [79194,76654]
- Median wall-clock: **77924ms**
- vs `L0`: 114499ms → 77924ms (-31.9%)
- Equality vs compare: **PASS**
- Top slowest maps: shellsisland 13741ms, main 9012ms, winterland 7258ms, desertland 5747ms, duelland 4972ms
- Finished: 2026-07-27T22:04:36.018Z

- Takeaway: Uniform XY grid (cell 48) over geometry lines cuts amap collision work hard on dense maps; dumps identical.

## L2

- Runs ms: [27494,26385]
- Median wall-clock: **26939.5ms**
- vs `L1`: 77924ms → 26939.5ms (-65.4%)
- Equality vs compare: **PASS**
- Top slowest maps: shellsisland 13104ms, main 8669ms, winterland 6569ms, desertland 6462ms, duelland 5173ms
- Finished: 2026-07-27T22:07:28.339Z

- Takeaway: worker_threads pool (cpus-1) brings wall-clock near slowest-map bound; dumps identical.

## E1

- Runs ms: [19451,19170]
- Median wall-clock: **19310.5ms**
- vs `champion`: 26939.5ms → 19310.5ms (-28.3%)
- Equality vs compare: **PASS**
- Top slowest maps: shellsisland 12276ms, main 8434ms, winterland 6665ms, desertland 5316ms, duelland 4626ms
- Finished: 2026-07-27T22:09:16.774Z

## E1 (kept)

- Median: **19310.5ms** vs L2 champion 26939.5ms (−28.3%)
- Equality: PASS
- Takeaway: Greedy pack by prior map timings beats round-robin when outliers (shellsisland) dominate.

## E2

- Runs ms: [24782,23398]
- Median wall-clock: **24090ms**
- vs `champion`: 19310.5ms → 24090ms (+24.8%)
- Equality vs compare: **PASS**
- Top slowest maps: shellsisland 16104ms, main 10455ms, winterland 8590ms, desertland 6736ms, duelland 5571ms
- Finished: 2026-07-27T22:11:00.545Z

## E3

- Runs ms: [25698,21979]
- Median wall-clock: **23838.5ms**
- vs `champion`: 19310.5ms → 23838.5ms (+23.4%)
- Equality vs compare: **PASS**
- Top slowest maps: shellsisland 15209ms, main 10154ms, winterland 7999ms, desertland 6498ms, duelland 5403ms
- Finished: 2026-07-27T22:12:29.531Z

## E4

- Runs ms: [20002,19431]
- Median wall-clock: **19716.5ms**
- vs `champion`: 19310.5ms → 19716.5ms (+2.1%)
- Equality vs compare: **FAIL**
- Top slowest maps: winterland 4779ms, desertland 4646ms, main 4375ms, duelland 4294ms, halloween 4123ms
- Finished: 2026-07-27T22:14:11.497Z

## E5

- Runs ms: [31420,26012]
- Median wall-clock: **28716ms**
- vs `champion`: 19310.5ms → 28716ms (+48.7%)
- Equality vs compare: **PASS**
- Top slowest maps: main 13057ms, winterland 10940ms, desertland 9105ms, duelland 5850ms, halloween 4181ms
- Finished: 2026-07-27T22:15:33.205Z

## E6

- Runs ms: [18457,24340]
- Median wall-clock: **21398.5ms**
- vs `champion`: 19310.5ms → 21398.5ms (+10.8%)
- Equality vs compare: **PASS**
- Top slowest maps: main 12483ms, winterland 9490ms, desertland 6849ms, halloween 6151ms, spookytown 5643ms
- Finished: 2026-07-27T22:16:58.942Z

## Experiment loop stop

- Consecutive failures: 5 (E2–E6)
- Champion remains **E1** (19310.5ms median)
- Exhausted meaningful short-horizon hypotheses for precompute wall-clock without gameplay risk

## L3 runtime server_can_move

- Agreement samples: 15000, disagreements: 0 (100.0000% agree)
- Microbench 2000 rect moves on `main`: classic 47ms → fast 25ms
- Gate: PASS (exact boolean match on samples)
- Takeaway: boolean roam/NPC paths use server_can_move; calculate_move keeps classic can_move.
