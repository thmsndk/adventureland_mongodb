# Precompute experiment loop log

Champion starts at L2. Keep if deep-equal to champion **and** ≥3% faster median.

| #   | Hypothesis                                   | Result  | Median before→after  | Notes                                                      |
| --- | -------------------------------------------- | ------- | -------------------- | ---------------------------------------------------------- |
| 1   | Greedy worker balance by champion per-map ms | KEEP    | 26939→19310 (-28.3%) | equal PASS                                                 |
| 2   | bfs_can_move_point+index for smap BFS        | DISCARD | 19310→24090 (+24.8%) | equal PASS but slower (grid overhead on short axis moves)  |
| 3   | Stamp Uint32Array dedupe in spatial queries  | DISCARD | 19310→23838 (+23.4%) | equal PASS but slower                                      |
| 4   | Lower unbounded queue caps (30k/15k)         | DISCARD | 19310→19716          | FAIL equality (false abort on main)                        |
| 5   | Sparse-geometry early abort (inline check)   | DISCARD | 19310→28716          | equal PASS but slower (per-iter overhead / stale schedule) |
| 6   | Cached sparse early abort + schedule bias    | DISCARD | 19310→21398 (+10.8%) | equal PASS; median not ≥3% faster (noise)                  |

**Stop:** 5 consecutive failures (E2–E6). Champion remains E1 (greedy scheduling).
