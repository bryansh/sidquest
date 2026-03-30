#!/bin/bash
# RAG Prompt Bake-off: Test different system prompts with Gemma 3 4B
# Focuses on the weak queries (synthesis/inference) but runs all 10
# Usage: bash scripts/rag-prompt-bakeoff.sh

EMBED_MODEL="snowflake-arctic-embed:110m"
GEN_MODEL="gemma3:4b"

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

# --- Three prompt variants to test ---
PROMPT_NAMES=("basic" "synthesis" "structured")

PROMPT_BASIC="You are a helpful game companion assistant. Answer the player's question based ONLY on the provided game notes. Be concise but thorough. If the notes don't contain enough information to fully answer, say what you know and note what's uncertain."

PROMPT_SYNTHESIS="You are a game companion who helps players remember their adventure. Answer based ONLY on the provided game notes.

Important instructions:
- Connect information across multiple notes to build a complete picture
- When asked about motivations or relationships, infer from actions and events described in the notes
- Identify unresolved plot threads, unanswered questions, and loose ends when relevant
- Reference specific sessions or events to support your answer
- Be concise but don't leave out important connections between notes"

PROMPT_STRUCTURED="You are a game companion who helps players catch up on their adventure. Answer based ONLY on the provided game notes.

For each answer:
1. Directly answer the question first
2. Add relevant context by connecting details across different notes
3. Note any unresolved threads or open questions related to the topic
4. Reference which session events occurred in when known

Be concise. Use bullet points for lists. Draw inferences from character actions when motivations aren't explicitly stated."

PROMPTS=("$PROMPT_BASIC" "$PROMPT_SYNTHESIS" "$PROMPT_STRUCTURED")

OUTDIR="/tmp/rag-prompt-bakeoff-$(date +%s)"
mkdir -p "$OUTDIR"

echo "=== RAG Prompt Bake-off ==="
echo "Testing ${#PROMPT_NAMES[@]} prompt variants on ${#QUERIES[@]} queries"
echo "Output dir: $OUTDIR"
echo ""

# Embed docs once
echo "Embedding ${#DOCS[@]} documents..."
DOC_EMBEDDINGS=()
for i in "${!DOCS[@]}"; do
  emb=$(curl -s http://localhost:11434/api/embed -d "{
    \"model\": \"$EMBED_MODEL\",
    \"input\": \"${DOCS[$i]}\"
  }" | python3 -c "import sys,json; data=json.load(sys.stdin); print(json.dumps(data['embeddings'][0]))" 2>/dev/null)
  DOC_EMBEDDINGS+=("$emb")
done
echo "Done."
echo ""

# Pre-compute query embeddings and top-5 retrievals
echo "Computing retrievals..."
QUERY_TOP5S=()
for q in "${!QUERIES[@]}"; do
  query_emb=$(curl -s http://localhost:11434/api/embed -d "{
    \"model\": \"$EMBED_MODEL\",
    \"input\": \"${QUERIES[$q]}\"
  }" | python3 -c "import sys,json; data=json.load(sys.stdin); print(json.dumps(data['embeddings'][0]))" 2>/dev/null)

  top5=$(python3 << PYEOF
import json, math
q = json.loads('$query_emb')
sims = []
for d_str in ['''${DOC_EMBEDDINGS[0]}''', '''${DOC_EMBEDDINGS[1]}''', '''${DOC_EMBEDDINGS[2]}''', '''${DOC_EMBEDDINGS[3]}''', '''${DOC_EMBEDDINGS[4]}''', '''${DOC_EMBEDDINGS[5]}''', '''${DOC_EMBEDDINGS[6]}''', '''${DOC_EMBEDDINGS[7]}''', '''${DOC_EMBEDDINGS[8]}''', '''${DOC_EMBEDDINGS[9]}''']:
    d = json.loads(d_str)
    dot = sum(a*b for a,b in zip(q,d))
    mag_q = math.sqrt(sum(a*a for a in q))
    mag_d = math.sqrt(sum(b*b for b in d))
    sims.append(dot / (mag_q * mag_d) if mag_q and mag_d else 0.0)
ranked = sorted(range(len(sims)), key=lambda i: sims[i], reverse=True)[:5]
print(','.join(str(i) for i in ranked))
PYEOF
)
  QUERY_TOP5S+=("$top5")
done
echo "Done."
echo ""

# Run each prompt variant
for p in "${!PROMPT_NAMES[@]}"; do
  pname="${PROMPT_NAMES[$p]}"
  prompt="${PROMPTS[$p]}"

  echo "╔══════════════════════════════════════════════════╗"
  echo "║  PROMPT: $pname"
  echo "╚══════════════════════════════════════════════════╝"
  echo ""

  for q in "${!QUERIES[@]}"; do
    query="${QUERIES[$q]}"
    top5="${QUERY_TOP5S[$q]}"

    # Build context
    IFS=',' read -ra TOP_INDICES <<< "$top5"
    CONTEXT=""
    for idx in "${TOP_INDICES[@]}"; do
      CONTEXT="${CONTEXT}\n---\n${DOCS[$idx]}"
    done

    # Escape for JSON
    ESCAPED_PROMPT=$(echo "$prompt" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read())[1:-1])")
    ESCAPED_CONTEXT=$(echo -e "$CONTEXT" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read())[1:-1])")
    ESCAPED_QUERY=$(echo "$query" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read())[1:-1])")

    RESPONSE=$(curl -s http://localhost:11434/api/chat -d "{
      \"model\": \"$GEN_MODEL\",
      \"stream\": false,
      \"messages\": [
        {\"role\": \"system\", \"content\": \"$ESCAPED_PROMPT\"},
        {\"role\": \"user\", \"content\": \"Here are the relevant game notes:\\n$ESCAPED_CONTEXT\\n\\n---\\nQuestion: $ESCAPED_QUERY\"}
      ],
      \"options\": {\"temperature\": 0.3}
    }" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data.get('message',{}).get('content','ERROR'))" 2>/dev/null)

    echo "Q$((q+1)): $query"
    echo "$RESPONSE"
    echo ""

    # Save
    echo "Q$((q+1)): $query" >> "$OUTDIR/${pname}.txt"
    echo "$RESPONSE" >> "$OUTDIR/${pname}.txt"
    echo "---" >> "$OUTDIR/${pname}.txt"
  done
done

echo "=== Done! Results saved to $OUTDIR/ ==="
