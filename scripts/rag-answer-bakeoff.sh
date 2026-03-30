#!/bin/bash
# RAG Answer Bake-off: Test Gemma 3 4B answering questions with retrieved context
# Uses snowflake-arctic-embed for retrieval, Gemma for generation
# Usage: bash scripts/rag-answer-bakeoff.sh

EMBED_MODEL="snowflake-arctic-embed:110m"
GEN_MODEL="gemma3:4b"

# --- Same documents as embedding bakeoff ---
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

OUTDIR="/tmp/rag-answer-bakeoff-$(date +%s)"
mkdir -p "$OUTDIR"

echo "=== RAG Answer Bake-off ==="
echo "Embedding: $EMBED_MODEL"
echo "Generation: $GEN_MODEL"
echo "Output dir: $OUTDIR"
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

# Embed all documents upfront
echo "Embedding ${#DOCS[@]} documents with $EMBED_MODEL..."
DOC_EMBEDDINGS=()
for i in "${!DOCS[@]}"; do
  emb=$(get_embedding "$EMBED_MODEL" "${DOCS[$i]}")
  DOC_EMBEDDINGS+=("$emb")
  echo "  Doc $i embedded"
done
echo ""

for q in "${!QUERIES[@]}"; do
  query="${QUERIES[$q]}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Q$((q+1)): \"$query\""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Embed query
  query_emb=$(get_embedding "$EMBED_MODEL" "$query")

  # Calculate similarities and get top 5
  SIMS=()
  for d in "${!DOC_EMBEDDINGS[@]}"; do
    sim=$(python3 -c "
import json, math
a = json.loads('$query_emb')
b = json.loads('${DOC_EMBEDDINGS[$d]}')
dot = sum(x*y for x,y in zip(a,b))
mag_a = math.sqrt(sum(x*x for x in a))
mag_b = math.sqrt(sum(x*x for x in b))
print(dot / (mag_a * mag_b) if mag_a and mag_b else 0.0)
")
    SIMS+=("$sim")
  done

  # Get top 5 doc indices
  TOP5=$(python3 -c "
sims = [${SIMS[0]}, ${SIMS[1]}, ${SIMS[2]}, ${SIMS[3]}, ${SIMS[4]}, ${SIMS[5]}, ${SIMS[6]}, ${SIMS[7]}, ${SIMS[8]}, ${SIMS[9]}]
ranked = sorted(range(len(sims)), key=lambda i: sims[i], reverse=True)[:5]
print(','.join(str(i) for i in ranked))
")

  # Build context from top 5 docs
  IFS=',' read -ra TOP_INDICES <<< "$TOP5"
  CONTEXT=""
  echo "  Retrieved docs: $TOP5"
  for idx in "${TOP_INDICES[@]}"; do
    CONTEXT="$CONTEXT\n---\n${DOCS[$idx]}"
  done

  # Build prompt and call Gemma
  SYSTEM_PROMPT="You are a helpful game companion assistant. Answer the player's question based ONLY on the provided game notes. Be concise but thorough. If the notes don't contain enough information to fully answer, say what you know and note what's uncertain."

  # Use ollama generate API
  RESPONSE=$(curl -s http://localhost:11434/api/chat -d "{
    \"model\": \"$GEN_MODEL\",
    \"stream\": false,
    \"messages\": [
      {\"role\": \"system\", \"content\": \"$SYSTEM_PROMPT\"},
      {\"role\": \"user\", \"content\": \"Here are the relevant game notes:\\n$CONTEXT\\n\\n---\\nQuestion: $query\"}
    ],
    \"options\": {\"temperature\": 0.3}
  }" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data.get('message',{}).get('content','ERROR: no response'))" 2>/dev/null)

  echo ""
  echo "$RESPONSE"
  echo ""

  # Save to file
  echo "Q: $query" >> "$OUTDIR/answers.txt"
  echo "Retrieved: $TOP5" >> "$OUTDIR/answers.txt"
  echo "A: $RESPONSE" >> "$OUTDIR/answers.txt"
  echo "---" >> "$OUTDIR/answers.txt"
  echo "" >> "$OUTDIR/answers.txt"
done

echo "=== Done! Full answers saved to $OUTDIR/answers.txt ==="
