#!/bin/bash
# FINAL MODEL BAKE-OFF: All 3 AI tasks across all contender models
# Tasks: (1) Note Cleanup, (2) Entity Extraction, (3) RAG Chat
# Usage: bash scripts/final-bakeoff.sh
# Or specific models: bash scripts/final-bakeoff.sh "gemma3:4b" "qwen3:8b"

EMBED_MODEL="snowflake-arctic-embed:110m"

if [ $# -gt 0 ]; then
  MODELS=("$@")
else
  MODELS=(
    # Small tier (~3-4B)
    "gemma3:4b"
    # Medium tier (~8-14B)
    "qwen3:8b"
    "gemma3:12b"
    "qwen3:14b"
    "phi4:14b"
    # Large tier (~24-32B)
    "mistral-small:24b"
    "gemma3:27b"
    "qwen3:32b"
    # XL tier
    "llama3.3:70b"
  )
fi

# ═══════════════════════════════════════════════════
# TASK 1: NOTE CLEANUP
# ═══════════════════════════════════════════════════

CLEANUP_SYSTEM="You clean up and organize game session notes. Preserve all factual content. Group into sections with ## headers. Use bullet points with -. Be concise."

CLEANUP_INPUT="ok so we met this npc named Kira she was like a rogue type character hanging out at the iron keep which is this old abandoned fortress north of the city. she said she knew something about the missing merchant guild shipments. the party decided to follow her lead and went into the tunnels beneath the keep. we fought some goblins down there, about 6 of them, Theron took some damage but Lyra healed him. found a chest with 200 gold and a magic dagger that glows blue. kira betrayed us at the end and stole the dagger, ran off through a secret passage. cliffhanger ending. also the barkeep at the rusty flagon told us earlier that day that theres been weird lights seen near the old cemetery"

# ═══════════════════════════════════════════════════
# TASK 2: ENTITY EXTRACTION
# ═══════════════════════════════════════════════════

ENTITY_TYPES=("NPCs" "Locations" "Items" "Factions")
TYPES_LIST=$(IFS=', '; echo "${ENTITY_TYPES[*]}")
CATEGORIES_TEMPLATE=$(printf '"%s": [{"name": "...", "label": "short label", "description": "2-4 sentence description"}], ' "${ENTITY_TYPES[@]}")
CATEGORIES_TEMPLATE="${CATEGORIES_TEMPLATE%, }"

EXTRACT_SYSTEM="You are a game session note analyzer. Extract ALL named entities from the session notes.

Classify each entity into one of these categories: ${TYPES_LIST}

RULES:
- Include unnamed characters by their role (e.g., \"Barkeep\", \"Guard Captain\")
- Include currency and treasure as items
- Be thorough - extract every person, place, thing, and organization mentioned
- For each entity, provide TWO fields:
  - \"label\": a short 2-5 word label (e.g., \"Evil wizard\", \"Abandoned fortress\", \"Enchanted dagger\")
  - \"description\": a DETAILED 2-4 sentence description capturing everything the notes say - relationships, goals, actions, and context
- Return ONLY valid JSON with this exact structure, no other text:

{\"categories\": {${CATEGORIES_TEMPLATE}}}

Where each category contains an array of objects with \"name\", \"label\", and \"description\" fields."

EXTRACT_INPUT="$CLEANUP_INPUT"

# ═══════════════════════════════════════════════════
# TASK 3: RAG CHAT (3 queries: factual, synthesis, open threads)
# ═══════════════════════════════════════════════════

RAG_SYSTEM="You are a game companion who helps players remember their adventure. Answer based ONLY on the provided game notes.

Important instructions:
- Connect information across multiple notes to build a complete picture
- When asked about motivations or relationships, infer from actions and events described in the notes
- Identify unresolved plot threads, unanswered questions, and loose ends when relevant
- Reference specific sessions or events to support your answer
- Be concise but don't leave out important connections between notes"

RAG_DOCS=(
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

# Test 3 representative queries: factual, synthesis, open-ended
RAG_QUERIES=(
  "What happened at the Iron Keep?"
  "Why doesn't Lyra trust Kira?"
  "What quests are still open?"
)

# Pre-computed top-5 retrievals from snowflake (consistent across runs)
RAG_RETRIEVALS=(
  "9,6,4,0,7"
  "7,0,3,9,4"
  "6,8,9,1,0"
)

# ═══════════════════════════════════════════════════

OUTDIR="/tmp/final-bakeoff-$(date +%s)"
mkdir -p "$OUTDIR"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║          FINAL MODEL BAKE-OFF: ALL AI TASKS             ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Models: ${#MODELS[@]} local + Claude baseline                   ║"
echo "║  Tasks: Cleanup, Extraction, RAG Chat (3 queries)       ║"
echo "║  Output: $OUTDIR  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Build RAG contexts from pre-computed retrievals
RAG_CONTEXTS=()
for r in "${!RAG_RETRIEVALS[@]}"; do
  IFS=',' read -ra INDICES <<< "${RAG_RETRIEVALS[$r]}"
  ctx=""
  for idx in "${INDICES[@]}"; do
    ctx="${ctx}\n---\n${RAG_DOCS[$idx]}"
  done
  RAG_CONTEXTS+=("$ctx")
done

ESCAPED_RAG_SYSTEM=$(echo "$RAG_SYSTEM" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read())[1:-1])")

# ═══════════════════════════════════════════════════
# Helper: call Claude API
# ═══════════════════════════════════════════════════
call_claude() {
  local system_prompt="$1"
  local user_message="$2"
  local escaped_system=$(echo "$system_prompt" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read())[1:-1])")
  local escaped_user=$(echo "$user_message" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read())[1:-1])")

  curl -s https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d "{
      \"model\": \"claude-sonnet-4-20250514\",
      \"max_tokens\": 2048,
      \"temperature\": 0.3,
      \"system\": \"$escaped_system\",
      \"messages\": [{\"role\": \"user\", \"content\": \"$escaped_user\"}]
    }" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data.get('content',[{}])[0].get('text','ERROR: ' + str(data)))" 2>/dev/null
}

# ═══════════════════════════════════════════════════
# CLAUDE BASELINE
# ═══════════════════════════════════════════════════
if [ -n "$ANTHROPIC_API_KEY" ]; then
  echo ""
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║  BASELINE: Claude (claude-sonnet-4-20250514)            ║"
  echo "╚══════════════════════════════════════════════════════════╝"

  MODEL_FILE="claude_baseline"
  MODEL_START=$(python3 -c "import time; print(time.time())")

  # Task 1: Cleanup
  echo ""
  echo "  ┌─ Task 1: Note Cleanup ─────────────────────────────┐"
  T1_START=$(python3 -c "import time; print(time.time())")
  T1_RESPONSE=$(call_claude "$CLEANUP_SYSTEM" "$CLEANUP_INPUT")
  T1_END=$(python3 -c "import time; print(time.time())")
  T1_TIME=$(python3 -c "print(f'{$T1_END - $T1_START:.1f}')")
  echo "$T1_RESPONSE"
  echo ""
  echo "  └─ Cleanup time: ${T1_TIME}s ────────────────────────┘"
  echo "=== TASK 1: CLEANUP (${T1_TIME}s) ===" > "$OUTDIR/${MODEL_FILE}.txt"
  echo "$T1_RESPONSE" >> "$OUTDIR/${MODEL_FILE}.txt"
  echo "" >> "$OUTDIR/${MODEL_FILE}.txt"

  # Task 2: Extraction
  echo ""
  echo "  ┌─ Task 2: Entity Extraction ────────────────────────┐"
  T2_START=$(python3 -c "import time; print(time.time())")
  T2_RESPONSE=$(call_claude "$EXTRACT_SYSTEM" "Session notes:
$EXTRACT_INPUT")
  T2_END=$(python3 -c "import time; print(time.time())")
  T2_TIME=$(python3 -c "print(f'{$T2_END - $T2_START:.1f}')")
  T2_VALID=$(echo "$T2_RESPONSE" | python3 -c "
import json, sys
try:
    text = sys.stdin.read()
    # Strip markdown code fences if present
    import re
    text = re.sub(r'\`\`\`json?\s*', '', text)
    text = re.sub(r'\`\`\`\s*$', '', text)
    d = json.loads(text)
    cats = d.get('categories', d)
    total = 0
    parts = []
    for key, val in cats.items():
        if isinstance(val, list):
            total += len(val)
            parts.append(f'{key}: {len(val)}')
    has_desc = False
    for key, val in cats.items():
        if isinstance(val, list):
            for ent in val:
                if len(ent.get('description', '')) > 20:
                    has_desc = True
                    break
    quality = 'with descriptions' if has_desc else 'labels only'
    print(f'VALID JSON - {total} entities ({\", \".join(parts)}) [{quality}]')
except Exception as e:
    print(f'INVALID JSON: {e}')
" 2>/dev/null)
  echo "$T2_RESPONSE" | python3 -c "
import sys, re, json
text = sys.stdin.read()
text = re.sub(r'\`\`\`json?\s*', '', text)
text = re.sub(r'\`\`\`\s*$', '', text)
try:
    print(json.dumps(json.loads(text), indent=2))
except:
    print(text)
" 2>/dev/null
  echo ""
  echo "  [$T2_VALID]"
  echo "  └─ Extraction time: ${T2_TIME}s ─────────────────────┘"
  echo "=== TASK 2: EXTRACTION (${T2_TIME}s) [$T2_VALID] ===" >> "$OUTDIR/${MODEL_FILE}.txt"
  echo "$T2_RESPONSE" >> "$OUTDIR/${MODEL_FILE}.txt"
  echo "" >> "$OUTDIR/${MODEL_FILE}.txt"

  # Task 3: RAG Chat
  echo ""
  echo "  ┌─ Task 3: RAG Chat ─────────────────────────────────┐"
  echo "=== TASK 3: RAG CHAT ===" >> "$OUTDIR/${MODEL_FILE}.txt"
  T3_TOTAL=0
  for q in "${!RAG_QUERIES[@]}"; do
    query="${RAG_QUERIES[$q]}"
    ctx="${RAG_CONTEXTS[$q]}"
    CONTEXT_TEXT=$(echo -e "$ctx")

    T3Q_START=$(python3 -c "import time; print(time.time())")
    T3_RESPONSE=$(call_claude "$RAG_SYSTEM" "Here are the relevant game notes:
$CONTEXT_TEXT

---
Question: $query")
    T3Q_END=$(python3 -c "import time; print(time.time())")
    T3Q_TIME=$(python3 -c "print(f'{$T3Q_END - $T3Q_START:.1f}')")
    T3_TOTAL=$(python3 -c "print(f'{$T3_TOTAL + $T3Q_END - $T3Q_START:.1f}')")

    echo ""
    echo "  Q: $query (${T3Q_TIME}s)"
    echo "$T3_RESPONSE"

    echo "Q: $query (${T3Q_TIME}s)" >> "$OUTDIR/${MODEL_FILE}.txt"
    echo "$T3_RESPONSE" >> "$OUTDIR/${MODEL_FILE}.txt"
    echo "---" >> "$OUTDIR/${MODEL_FILE}.txt"
  done
  echo ""
  echo "  └─ RAG Chat total: ${T3_TOTAL}s ─────────────────────┘"

  MODEL_END=$(python3 -c "import time; print(time.time())")
  MODEL_TIME=$(python3 -c "print(f'{$MODEL_END - $MODEL_START:.1f}')")
  echo ""
  echo "  ═══ Claude baseline total: ${MODEL_TIME}s ═══"
  echo "claude-sonnet-4 | cleanup: ${T1_TIME}s | extract: ${T2_TIME}s [$T2_VALID] | rag: ${T3_TOTAL}s | total: ${MODEL_TIME}s" >> "$OUTDIR/summary.txt"
else
  echo "⚠ ANTHROPIC_API_KEY not set — skipping Claude baseline"
  echo "  Set it with: export ANTHROPIC_API_KEY=\"sk-ant-...\""
fi

# ═══════════════════════════════════════════════════
# LOCAL MODELS
# ═══════════════════════════════════════════════════

for MODEL in "${MODELS[@]}"; do
  echo ""
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║  MODEL: $MODEL"
  echo "╚══════════════════════════════════════════════════════════╝"

  MODEL_FILE="${MODEL//[:\/]/_}"
  MODEL_START=$(python3 -c "import time; print(time.time())")

  # ─────────────────────────────────────────────────
  # TASK 1: NOTE CLEANUP
  # ─────────────────────────────────────────────────
  echo ""
  echo "  ┌─ Task 1: Note Cleanup ─────────────────────────────┐"

  ESCAPED_CLEANUP_SYSTEM=$(echo "$CLEANUP_SYSTEM" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read())[1:-1])")
  ESCAPED_CLEANUP_INPUT=$(echo "$CLEANUP_INPUT" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read())[1:-1])")

  T1_START=$(python3 -c "import time; print(time.time())")

  T1_RESPONSE=$(curl -s http://localhost:11434/api/chat -d "{
    \"model\": \"$MODEL\",
    \"stream\": false,
    \"messages\": [
      {\"role\": \"system\", \"content\": \"$ESCAPED_CLEANUP_SYSTEM\"},
      {\"role\": \"user\", \"content\": \"$ESCAPED_CLEANUP_INPUT\"}
    ],
    \"options\": {\"temperature\": 0.3}
  }" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data.get('message',{}).get('content','ERROR'))" 2>/dev/null)

  T1_END=$(python3 -c "import time; print(time.time())")
  T1_TIME=$(python3 -c "print(f'{$T1_END - $T1_START:.1f}')")

  echo "$T1_RESPONSE"
  echo ""
  echo "  └─ Cleanup time: ${T1_TIME}s ────────────────────────┘"

  echo "=== TASK 1: CLEANUP (${T1_TIME}s) ===" > "$OUTDIR/${MODEL_FILE}.txt"
  echo "$T1_RESPONSE" >> "$OUTDIR/${MODEL_FILE}.txt"
  echo "" >> "$OUTDIR/${MODEL_FILE}.txt"

  # ─────────────────────────────────────────────────
  # TASK 2: ENTITY EXTRACTION
  # ─────────────────────────────────────────────────
  echo ""
  echo "  ┌─ Task 2: Entity Extraction ────────────────────────┐"

  ESCAPED_EXTRACT_SYSTEM=$(echo "$EXTRACT_SYSTEM" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read())[1:-1])")
  ESCAPED_EXTRACT_INPUT=$(echo "$EXTRACT_INPUT" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read())[1:-1])")

  T2_START=$(python3 -c "import time; print(time.time())")

  T2_RESPONSE=$(curl -s http://localhost:11434/api/chat -d "{
    \"model\": \"$MODEL\",
    \"stream\": false,
    \"messages\": [
      {\"role\": \"system\", \"content\": \"$ESCAPED_EXTRACT_SYSTEM\"},
      {\"role\": \"user\", \"content\": \"Session notes:\\n$ESCAPED_EXTRACT_INPUT\"}
    ],
    \"options\": {\"temperature\": 0.3},
    \"format\": \"json\"
  }" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data.get('message',{}).get('content','ERROR'))" 2>/dev/null)

  T2_END=$(python3 -c "import time; print(time.time())")
  T2_TIME=$(python3 -c "print(f'{$T2_END - $T2_START:.1f}')")

  # Validate JSON and count entities
  T2_VALID=$(echo "$T2_RESPONSE" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    cats = d.get('categories', d)
    total = 0
    parts = []
    for key, val in cats.items():
        if isinstance(val, list):
            total += len(val)
            parts.append(f'{key}: {len(val)}')
    has_desc = False
    for key, val in cats.items():
        if isinstance(val, list):
            for ent in val:
                if len(ent.get('description', '')) > 20:
                    has_desc = True
                    break
    quality = 'with descriptions' if has_desc else 'labels only'
    print(f'VALID JSON - {total} entities ({', '.join(parts)}) [{quality}]')
except:
    print('INVALID JSON')
" 2>/dev/null)

  echo "$T2_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$T2_RESPONSE"
  echo ""
  echo "  [$T2_VALID]"
  echo "  └─ Extraction time: ${T2_TIME}s ─────────────────────┘"

  echo "=== TASK 2: EXTRACTION (${T2_TIME}s) [$T2_VALID] ===" >> "$OUTDIR/${MODEL_FILE}.txt"
  echo "$T2_RESPONSE" >> "$OUTDIR/${MODEL_FILE}.txt"
  echo "" >> "$OUTDIR/${MODEL_FILE}.txt"

  # ─────────────────────────────────────────────────
  # TASK 3: RAG CHAT (3 queries)
  # ─────────────────────────────────────────────────
  echo ""
  echo "  ┌─ Task 3: RAG Chat ─────────────────────────────────┐"

  echo "=== TASK 3: RAG CHAT ===" >> "$OUTDIR/${MODEL_FILE}.txt"

  T3_TOTAL=0
  for q in "${!RAG_QUERIES[@]}"; do
    query="${RAG_QUERIES[$q]}"
    ctx="${RAG_CONTEXTS[$q]}"

    ESCAPED_CONTEXT=$(echo -e "$ctx" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read())[1:-1])")
    ESCAPED_QUERY=$(echo "$query" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read())[1:-1])")

    T3Q_START=$(python3 -c "import time; print(time.time())")

    T3_RESPONSE=$(curl -s http://localhost:11434/api/chat -d "{
      \"model\": \"$MODEL\",
      \"stream\": false,
      \"messages\": [
        {\"role\": \"system\", \"content\": \"$ESCAPED_RAG_SYSTEM\"},
        {\"role\": \"user\", \"content\": \"Here are the relevant game notes:\\n$ESCAPED_CONTEXT\\n\\n---\\nQuestion: $ESCAPED_QUERY\"}
      ],
      \"options\": {\"temperature\": 0.3}
    }" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data.get('message',{}).get('content','ERROR'))" 2>/dev/null)

    T3Q_END=$(python3 -c "import time; print(time.time())")
    T3Q_TIME=$(python3 -c "print(f'{$T3Q_END - $T3Q_START:.1f}')")
    T3_TOTAL=$(python3 -c "print(f'{$T3_TOTAL + $T3Q_END - $T3Q_START:.1f}')")

    echo ""
    echo "  Q: $query (${T3Q_TIME}s)"
    echo "$T3_RESPONSE"

    echo "Q: $query (${T3Q_TIME}s)" >> "$OUTDIR/${MODEL_FILE}.txt"
    echo "$T3_RESPONSE" >> "$OUTDIR/${MODEL_FILE}.txt"
    echo "---" >> "$OUTDIR/${MODEL_FILE}.txt"
  done

  echo ""
  echo "  └─ RAG Chat total: ${T3_TOTAL}s ─────────────────────┘"

  MODEL_END=$(python3 -c "import time; print(time.time())")
  MODEL_TIME=$(python3 -c "print(f'{$MODEL_END - $MODEL_START:.1f}')")

  echo ""
  echo "  ═══ $MODEL total: ${MODEL_TIME}s ═══"
  echo "$MODEL | cleanup: ${T1_TIME}s | extract: ${T2_TIME}s [$T2_VALID] | rag: ${T3_TOTAL}s | total: ${MODEL_TIME}s" >> "$OUTDIR/summary.txt"
done

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                       SUMMARY                           ║"
echo "╚══════════════════════════════════════════════════════════╝"
cat "$OUTDIR/summary.txt"
echo ""
echo "Full results: $OUTDIR/"
