# RAG Quality Scoring: Claude vs Gemma 4B vs Gemma 12B

Scoring each answer on 3 dimensions (1-5 each, max 15 per query):
- **Completeness**: Did it include all relevant facts?
- **Synthesis**: Did it connect information across notes / draw inferences?
- **Open Threads**: Did it identify unresolved plot points when relevant?

## Q1: "Who betrayed the party?"

| Model | Completeness | Synthesis | Threads | Total | Notes |
|---|---|---|---|---|---|
| Claude | 5 | 5 | 4 | 14 | Full arc: betrayal + foreshadowing + Lyra's objection |
| Gemma 4B | 4 | 3 | 2 | 9 | Facts correct, mentions sessions, no foreshadowing |
| Gemma 12B | 5 | 4 | 2 | 11 | Session 2→3 arc, missing Lyra angle |

## Q2: "Where did the party fight goblins?"

| Model | Completeness | Synthesis | Threads | Total | Notes |
|---|---|---|---|---|---|
| Claude | 5 | 4 | 3 | 12 | Tunnels + Theron damage + Lyra heal + loot |
| Gemma 4B | 3 | 1 | 1 | 5 | Just tunnels + count |
| Gemma 12B | 4 | 2 | 1 | 7 | Tunnels + count + location context |

## Q3: "Who is the healer?"

| Model | Completeness | Synthesis | Threads | Total | Notes |
|---|---|---|---|---|---|
| Claude | 5 | 4 | 3 | 12 | Lyra + Silver Flame + personality + Theron dynamic |
| Gemma 4B | 4 | 2 | 1 | 7 | Lyra + Silver Flame + healed Theron |
| Gemma 12B | 4 | 3 | 1 | 8 | Same + session reference |

## Q4: "What do we know about the missing shipments?"

| Model | Completeness | Synthesis | Threads | Total | Notes |
|---|---|---|---|---|---|
| Claude | 5 | 5 | 5 | 15 | Full picture + Kira's intel may be a ruse + still unresolved |
| Gemma 4B | 4 | 2 | 2 | 8 | Facts + Kira betrayal mentioned |
| Gemma 12B | 5 | 4 | 4 | 13 | Connection to Iron Keep + "remains unresolved" |

## Q5: "What happened at the Iron Keep?"

| Model | Completeness | Synthesis | Threads | Total | Notes |
|---|---|---|---|---|---|
| Claude | 5 | 5 | 4 | 14 | Multi-session narrative, all details |
| Gemma 4B | 5 | 4 | 2 | 11 | Good narrative, covers key events |
| Gemma 12B | 5 | 5 | 4 | 14 | Full chronological narrative + Kira's motivation inference |

## Q6: "Tell me about the strange lights"

| Model | Completeness | Synthesis | Threads | Total | Notes |
|---|---|---|---|---|---|
| Claude | 4 | 3 | 5 | 12 | Cemetery + barkeep + "still an open lead" |
| Gemma 4B | 4 | 2 | 3 | 9 | Same facts, less emphasis on it being open |
| Gemma 12B | 4 | 3 | 4 | 11 | Good context, clear "no one has investigated" |

## Q7: "Which NPCs have we met?"

| Model | Completeness | Synthesis | Threads | Total | Notes |
|---|---|---|---|---|---|
| Claude | 5 | 4 | 3 | 12 | 3 NPCs + party members listed separately |
| Gemma 4B | 4 | 2 | 1 | 7 | 3 NPCs listed correctly |
| Gemma 12B | 4 | 4 | 4 | 12 | 3 NPCs + session refs + identifies open threads |

## Q8: "What treasure did we find?"

| Model | Completeness | Synthesis | Threads | Total | Notes |
|---|---|---|---|---|---|
| Claude | 5 | 5 | 3 | 13 | 200g + dagger + "Kira stole it, party kept gold" |
| Gemma 4B | 4 | 3 | 2 | 9 | 200g + dagger + Kira stole it |
| Gemma 12B | 5 | 4 | 3 | 12 | "Two things!" + context + Kira stole dagger |

## Q9: "Why doesn't Lyra trust Kira?"

| Model | Completeness | Synthesis | Threads | Total | Notes |
|---|---|---|---|---|---|
| Claude | 5 | 5 | 4 | 14 | Session 2 objection → Session 3 vindication arc |
| Gemma 4B | 3 | 3 | 1 | 7 | Gets objection + cautious nature, no narrative |
| Gemma 12B | 5 | 5 | 3 | 13 | "Had a feeling... proven correct" — full arc |

## Q10: "What quests are still open?"

| Model | Completeness | Synthesis | Threads | Total | Notes |
|---|---|---|---|---|---|
| Claude | 5 | 5 | 5 | 15 | 3 quests, all synthesized with context |
| Gemma 4B | 3 | 3 | 3 | 9 | 2 quests (misses cemetery) |
| Gemma 12B | 5 | 4 | 5 | 14 | 3 quests + Kira as unresolved thread |

---

## TOTALS

| Model | Total Score | Percentage | Avg per Query |
|---|---|---|---|
| **Claude** | 133 / 150 | 88.7% | 13.3 |
| **Gemma 12B** | 115 / 150 | 76.7% | 11.5 |
| **Gemma 4B** | 81 / 150 | 54.0% | 8.1 |

## Gap Analysis

- **Claude → Gemma 12B gap: 12%** (133 vs 115)
- **Claude → Gemma 4B gap: 35%** (133 vs 81)
- **Gemma 12B is 42% better than 4B** (115 vs 81)
- **12B matched or beat Claude on 3 queries** (Q5, Q7, Q10)

## Verdict

Gemma 12B closes most of the gap to Claude. The remaining 12% is mostly prose polish
and subtle inference (like Claude noting Kira's intel "may have been a ruse" in Q4).
For a local, free, offline game companion — 77% of Claude quality is excellent.
