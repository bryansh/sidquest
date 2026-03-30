#!/bin/bash
# Embedding Model Bake-off: nomic-embed-text vs snowflake-arctic-embed
# Tests retrieval quality with game note content
# Usage: bash scripts/embedding-bakeoff.sh

MODELS=("nomic-embed-text" "snowflake-arctic-embed:110m")

# --- Sample game notes (documents to embed) ---
DOCS=(
  "Kira is a rogue NPC who hangs out at the Iron Keep, an old abandoned fortress north of the city. She claimed to know about the missing merchant guild shipments but ultimately betrayed the party, stealing a magic blue-glowing dagger and escaping through a secret passage beneath the keep."
  "The Rusty Flagon is a tavern in the city where the party frequently gathers. The barkeep mentioned strange lights near the old cemetery. It serves as the party's main hub for rumors and quest hooks."
  "Theron is a fighter in the party. He took heavy damage during the goblin fight in the tunnels beneath the Iron Keep but was healed by Lyra. He wields a greatsword and tends to charge into combat first."
  "Lyra is the party's healer and cleric of the Silver Flame. She healed Theron during the goblin ambush. She is cautious and often argues with Theron about rushing into danger."
  "Session 3: The party explored the tunnels beneath the Iron Keep following Kira's lead. They fought 6 goblins, found a chest with 200 gold and a magic dagger that glows blue. Kira betrayed them at the end and stole the dagger, fleeing through a secret passage."
  "The Merchant Guild has been losing shipments along the northern trade road. Guild Master Aldric posted a bounty of 500 gold for information. Kira claimed to have intel about the missing shipments."
  "Session 1: The party met at the Rusty Flagon and accepted a quest from Guild Master Aldric to investigate missing merchant shipments. They traveled north and discovered tracks leading to the Iron Keep."
  "Session 2: The party scouted the Iron Keep exterior and met Kira, who offered to guide them through the tunnels in exchange for a share of any treasure found. The party agreed despite Lyra's objections."
  "The Old Cemetery sits on a hill east of the city. Strange lights have been reported there at night. The barkeep at the Rusty Flagon warned the party about it. No one has investigated yet."
  "The Iron Keep is an abandoned fortress north of the city, built during the old war. Beneath it lies a network of tunnels infested with goblins. A secret passage exists that Kira used to escape."
)

# --- Queries to test retrieval ---
QUERIES=(
  "Who betrayed the party?"
  "Where did the party fight goblins?"
  "Who is the healer?"
  "What do we know about the missing shipments?"
  "What happened at the Iron Keep?"
  "Tell me about the strange lights"
  "Which NPCs have we met?"
  "What treasure did we find?"
  "Why doesn't Lyra trust Kira?"
  "What quests are still open?"
)

# --- Expected best matches (doc indices, 0-based, top 3) ---
# These are human-judged "ideal" results for scoring
EXPECTED=(
  "0,4,7"    # betrayal: Kira doc, Session 3, Session 2
  "4,9,2"    # goblins: Session 3, Iron Keep, Theron
  "3,4,2"    # healer: Lyra, Session 3 (healing), Theron (was healed)
  "5,6,0"    # shipments: Merchant Guild, Session 1, Kira
  "9,4,7"    # Iron Keep: Iron Keep doc, Session 3, Session 2
  "8,1,6"    # strange lights: Cemetery, Rusty Flagon, Session 1
  "0,5,3"    # NPCs: Kira, Aldric, Lyra
  "4,0,6"    # treasure: Session 3, Kira (dagger), Session 1
  "7,3,0"    # Lyra trust: Session 2 (objections), Lyra, Kira
  "8,5,6"    # open quests: Cemetery, Merchant Guild, Session 1
)

OUTDIR="/tmp/embedding-bakeoff-$(date +%s)"
mkdir -p "$OUTDIR"

echo "=== Embedding Model Bake-off ==="
echo "Output dir: $OUTDIR"
echo "Documents: ${#DOCS[@]}"
echo "Queries: ${#QUERIES[@]}"
echo ""

# Function: get embedding from ollama
get_embedding() {
  local model="$1"
  local text="$2"
  curl -s http://localhost:11434/api/embed -d "{
    \"model\": \"$model\",
    \"input\": \"$text\"
  }" | python3 -c "import sys,json; data=json.load(sys.stdin); print(json.dumps(data['embeddings'][0]))" 2>/dev/null
}

# Function: cosine similarity between two JSON arrays
cosine_sim() {
  local vec1="$1"
  local vec2="$2"
  python3 -c "
import json, math
a = json.loads('$vec1')
b = json.loads('$vec2')
dot = sum(x*y for x,y in zip(a,b))
mag_a = math.sqrt(sum(x*x for x in a))
mag_b = math.sqrt(sum(x*x for x in b))
if mag_a == 0 or mag_b == 0:
    print(0.0)
else:
    print(dot / (mag_a * mag_b))
"
}

for MODEL in "${MODELS[@]}"; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "MODEL: $MODEL"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Embed all documents
  echo "Embedding ${#DOCS[@]} documents..."
  DOC_EMBEDDINGS=()
  EMBED_START=$(python3 -c "import time; print(time.time())")
  for i in "${!DOCS[@]}"; do
    emb=$(get_embedding "$MODEL" "${DOCS[$i]}")
    DOC_EMBEDDINGS+=("$emb")
    echo "  Doc $i embedded (${#emb} chars)"
  done
  EMBED_END=$(python3 -c "import time; print(time.time())")
  EMBED_TIME=$(python3 -c "print(f'{$EMBED_END - $EMBED_START:.2f}')")
  echo "Embedding time: ${EMBED_TIME}s"
  echo ""

  TOTAL_SCORE=0
  TOTAL_POSSIBLE=0

  for q in "${!QUERIES[@]}"; do
    query="${QUERIES[$q]}"
    expected="${EXPECTED[$q]}"
    echo "Query $((q+1)): \"$query\""

    # Embed query
    query_emb=$(get_embedding "$MODEL" "$query")

    # Calculate similarities
    SIMS=()
    for d in "${!DOC_EMBEDDINGS[@]}"; do
      sim=$(cosine_sim "$query_emb" "${DOC_EMBEDDINGS[$d]}")
      SIMS+=("$sim")
    done

    # Rank by similarity (get top 3 indices)
    RANKED=$(python3 -c "
import json
sims = [${SIMS[0]}, ${SIMS[1]}, ${SIMS[2]}, ${SIMS[3]}, ${SIMS[4]}, ${SIMS[5]}, ${SIMS[6]}, ${SIMS[7]}, ${SIMS[8]}, ${SIMS[9]}]
ranked = sorted(range(len(sims)), key=lambda i: sims[i], reverse=True)
top3 = ranked[:3]
for i, idx in enumerate(top3):
    print(f'  #{i+1}: Doc {idx} (sim={sims[idx]:.4f}) - short preview')
print(f'TOP3={top3[0]},{top3[1]},{top3[2]}')
")

    # Print ranked results with doc previews
    TOP3_LINE=$(echo "$RANKED" | grep "^TOP3=")
    TOP3="${TOP3_LINE#TOP3=}"
    echo "$RANKED" | grep -v "^TOP3="

    # Score: 3 points if expected doc is #1, 2 if #2, 1 if #3
    IFS=',' read -ra EXP_ARR <<< "$expected"
    IFS=',' read -ra GOT_ARR <<< "$TOP3"
    QUERY_SCORE=0
    for rank in 0 1 2; do
      exp_doc="${EXP_ARR[$rank]}"
      for got_rank in 0 1 2; do
        if [[ "${GOT_ARR[$got_rank]}" == "$exp_doc" ]]; then
          points=$((3 - got_rank))
          QUERY_SCORE=$((QUERY_SCORE + points))
          break
        fi
      done
    done
    QUERY_MAX=9  # 3+2+1 per expected doc if all in top 3 at right positions... simplified: 3 docs * 3 max = 9
    TOTAL_SCORE=$((TOTAL_SCORE + QUERY_SCORE))
    TOTAL_POSSIBLE=$((TOTAL_POSSIBLE + QUERY_MAX))
    echo "  Score: $QUERY_SCORE / $QUERY_MAX  (expected: $expected, got: $TOP3)"
    echo ""
  done

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "TOTAL SCORE: $TOTAL_SCORE / $TOTAL_POSSIBLE"
  echo "Embed time: ${EMBED_TIME}s for ${#DOCS[@]} docs"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  # Save results
  echo "$MODEL: $TOTAL_SCORE / $TOTAL_POSSIBLE (embed: ${EMBED_TIME}s)" >> "$OUTDIR/summary.txt"
done

echo ""
echo "=== SUMMARY ==="
cat "$OUTDIR/summary.txt"
