#!/bin/bash
# Model Bake-off: Test cleanup + entity extraction across models
# Usage: bash scripts/model-bakeoff.sh

MODELS=("gemma3:4b" "phi4-mini" "qwen2.5:3b" "qwen2.5:7b" "qwen3:8b" "qwen3.5:4b")

CLEANUP_SYSTEM="You clean up and organize TTRPG session notes. Preserve all factual content. Group into sections with ## headers. Use bullet points with -. Be concise."

CLEANUP_INPUT="ok so we met this npc named Kira she was like a rogue type character hanging out at the iron keep which is this old abandoned fortress north of the city. she said she knew something about the missing merchant guild shipments. the party decided to follow her lead and went into the tunnels beneath the keep. we fought some goblins down there, about 6 of them, Theron took some damage but Lyra healed him. found a chest with 200 gold and a magic dagger that glows blue. kira betrayed us at the end and stole the dagger, ran off through a secret passage. cliffhanger ending. also the barkeep at the rusty flagon told us earlier that day that theres been weird lights seen near the old cemetery"

EXTRACT_SYSTEM="You are a TTRPG session note analyzer. Extract all named entities from the session notes. Return ONLY valid JSON with this exact structure, no other text:
{\"characters\": [{\"name\": \"...\", \"type\": \"npc|pc\", \"summary\": \"...\"}], \"locations\": [{\"name\": \"...\", \"summary\": \"...\"}], \"items\": [{\"name\": \"...\", \"summary\": \"...\"}], \"factions\": [{\"name\": \"...\", \"summary\": \"...\"}]}"

EXTRACT_INPUT="$CLEANUP_INPUT"

OUTDIR="/tmp/bakeoff-$(date +%s)"
mkdir -p "$OUTDIR"

echo "=== Model Bake-off ==="
echo "Output dir: $OUTDIR"
echo ""

for MODEL in "${MODELS[@]}"; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "MODEL: $MODEL"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Task 1: Cleanup
  echo ""
  echo "--- Task 1: Note Cleanup ---"
  START=$(date +%s%N)
  CLEANUP_OUT=$(ollama run "$MODEL" --format "" "$CLEANUP_SYSTEM

$CLEANUP_INPUT" 2>/dev/null)
  END=$(date +%s%N)
  CLEANUP_MS=$(( (END - START) / 1000000 ))
  echo "$CLEANUP_OUT"
  echo ""
  echo "[Time: ${CLEANUP_MS}ms]"
  echo "$CLEANUP_OUT" > "$OUTDIR/${MODEL//[:\/]/_}_cleanup.txt"

  # Task 2: Entity Extraction
  echo ""
  echo "--- Task 2: Entity Extraction (JSON) ---"
  START=$(date +%s%N)
  EXTRACT_OUT=$(ollama run "$MODEL" --format json "$EXTRACT_SYSTEM

Session notes:
$EXTRACT_INPUT" 2>/dev/null)
  END=$(date +%s%N)
  EXTRACT_MS=$(( (END - START) / 1000000 ))
  echo "$EXTRACT_OUT"
  echo ""

  # Validate JSON
  if echo "$EXTRACT_OUT" | python3 -m json.tool > /dev/null 2>&1; then
    ENTITIES=$(echo "$EXTRACT_OUT" | python3 -c "
import json, sys
d = json.load(sys.stdin)
chars = len(d.get('characters', []))
locs = len(d.get('locations', []))
items = len(d.get('items', []))
factions = len(d.get('factions', []))
print(f'Valid JSON: {chars} characters, {locs} locations, {items} items, {factions} factions')
" 2>/dev/null)
    echo "[JSON: $ENTITIES]"
  else
    echo "[JSON: INVALID]"
  fi
  echo "[Time: ${EXTRACT_MS}ms]"
  echo "$EXTRACT_OUT" > "$OUTDIR/${MODEL//[:\/]/_}_extract.json"

  echo ""
done

echo "=== Results saved to $OUTDIR ==="
