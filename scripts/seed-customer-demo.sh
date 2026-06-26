#!/usr/bin/env bash
# Seed customer-facing demo data via portal APIs only (no Python).
# Usage: ./scripts/seed-customer-demo.sh
# Requires: dev stack up (npm run dev), curl, jq

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTENT="$ROOT/examples/demo-content"
API="${BACKEND_URL:-http://127.0.0.1:8000}"
if [[ -f "$ROOT/.uat/dev-ports.json" ]] && command -v jq >/dev/null 2>&1; then
  API="$(jq -r '.backend_url // empty' "$ROOT/.uat/dev-ports.json")"
  [[ -n "$API" ]] || API="${BACKEND_URL:-http://127.0.0.1:8000}"
fi
COOKIE="$(mktemp /tmp/portal-demo-cookie.XXXXXX)"
REPORT="$ROOT/.uat/reports/customer-demo-seed.json"
trap 'rm -f "$COOKIE"' EXIT

SHARED=co-ech-shared
PRODUCT=co-ech-team-product
ENGINEERING=co-ech-team-engineering
SALES=co-ech-team-sales
OPS=co-ech-team-ops
EMAIL=eric@consultant.com

log() { printf '→ %s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

api_json() {
  local method=$1 path=$2 body=${3:-}
  if [[ -n "$body" ]]; then
    curl -sfS -X "$method" "$API$path" -b "$COOKIE" -c "$COOKIE" \
      -H 'Content-Type: application/json' -d "$body"
  else
    curl -sfS -X "$method" "$API$path" -b "$COOKIE" -c "$COOKIE"
  fi
}

api_upload() {
  local bank=$1 file=$2 extra=("${@:3}")
  local args=(-sfS -X POST "$API/api/upload" -b "$COOKIE" -c "$COOKIE" -F "bankId=$bank" -F "file=@$file")
  for kv in "${extra[@]}"; do args+=(-F "$kv"); done
  curl "${args[@]}"
}

wait_docs() {
  local bank=$1 min=${2:-1} tries=${3:-45}
  local n=0 i count
  for ((i = 0; i < tries; i++)); do
    count="$(api_json GET "/api/documents?bankId=$bank&limit=100" | jq '.total // 0')"
    if [[ "$count" -ge "$min" ]]; then
      log "  $bank: $count document(s) visible"
      return 0
    fi
    sleep 2
  done
  fail "$bank: expected >= $min docs, got $count"
}

retain_new() {
  local bank=$1 sessionId=$2 content=$3
  local sourceType=${4:-other} meetingName=${5:-} ticketId=${6:-} sourceDate=${7:-}
  local scope=${8:-private}
  local scenarioId=${9:-} retainStrategy=${10:-}
  api_json POST /api/retain "$(jq -n \
    --arg bankId "$bank" --arg content "$content" --arg sessionId "$sessionId" \
    --arg sourceType "$sourceType" --arg meetingName "$meetingName" \
    --arg ticketId "$ticketId" --arg sourceDate "$sourceDate" --arg scope "$scope" \
    --arg scenarioId "$scenarioId" --arg retainStrategy "$retainStrategy" \
    '{bankId:$bankId, content:$content, scope:$scope, sessionId:$sessionId, sourceType:$sourceType}
     + (if $meetingName != "" then {meetingName:$meetingName} else {} end)
     + (if $ticketId != "" then {ticketId:$ticketId} else {} end)
     + (if $sourceDate != "" then {sourceDate:$sourceDate} else {} end)
     + (if $scenarioId != "" then {scenarioId:$scenarioId} else {} end)
     + (if $retainStrategy != "" then {retainStrategy:$retainStrategy} else {} end)')" >/dev/null
}

retain_append() {
  local bank=$1 documentId=$2 content=$3
  api_json POST /api/retain "$(jq -n \
    --arg bankId "$bank" --arg content "$content" --arg documentId "$documentId" \
    '{bankId:$bankId, content:$content, scope:"private", documentId:$documentId, updateMode:"append"}')" >/dev/null
}

tag_doc() {
  local bank=$1 doc=$2
  shift 2
  local tags_json doc_enc
  tags_json="$(printf '%s\n' "$@" | jq -R . | jq -s .)"
  doc_enc="$(jq -rn --arg d "$doc" '$d|@uri')"
  local try=0
  while (( try < 20 )); do
    if api_json PATCH "/api/documents/$doc_enc" \
      "{\"bankId\":\"$bank\",\"tags\":$tags_json}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    ((try++)) || true
  done
  log "  warn: tags skipped for $doc"
}

login() {
  log "login $EMAIL @ $API"
  api_json POST /api/auth/login "{\"email\":\"$EMAIL\"}" >/dev/null
}

seed_shared_facts() {
  log "shared bank — structured facts"
  local ids=(
    ech-demo-fact-alice-chen
    ech-demo-fact-bob-smith
    ech-demo-fact-carol-lee
    ech-demo-fact-david-wong
    ech-demo-fact-eric-tai
    ech-demo-fact-megacorp
    ech-demo-fact-phoenix
    ech-demo-fact-titan
    ech-demo-fact-faststart
    ech-demo-fact-ech-company
  )
  local facts=(
    "Alice Chen is Product Manager at ECH, joined March 2025, reports to David Wong, owns Project Phoenix"
    "Bob Smith is Senior Engineer at ECH, leads backend, owns SSO delivery and GraphQL ADR-001"
    "Carol Lee is Sales Director at ECH, account owner for MegaCorp USD 1.2M renewal September 2026"
    "David Wong is CTO and co-founder at ECH, sponsors Project Phoenix and Project Titan"
    "Eric Tai is external consultant advising ECH on Hindsight knowledge platform and SOC 2 evidence"
    "MegaCorp is enterprise client, contract USD 1.2M, renewal 2026-09-15, needs SSO by August 2026"
    "Project Phoenix is platform migration, budget USD 500K, deadline Q3 2026, PM Alice Chen"
    "Project Titan is AI feature set, budget USD 1.2M, deferred to Q4 2026, sponsor David Wong"
    "FastStart is startup client USD 80K/year, upsell blocked on custom reporting until Q4"
    "ECH is Hong Kong B2B SaaS company founded 2022, 45 employees, Q2 revenue target USD 3M"
  )
  local i
  for i in "${!facts[@]}"; do
    api_json POST /api/retain "$(jq -n \
      --arg bankId "$SHARED" \
      --arg content "${facts[$i]}" \
      --arg sessionId "${ids[$i]}" \
      '{bankId:$bankId, content:$content, scope:"shared", sessionId:$sessionId}')" >/dev/null
    sleep 0.4
  done
  api_upload "$SHARED" "$CONTENT/shared/ech-company-directory.md" \
    "sourceType=doc" "sourceDate=2026-06-01" >/dev/null
}

seed_product() {
  log "product bank — uploads + meeting lifecycle"
  api_upload "$PRODUCT" "$CONTENT/product/q3-2026-roadmap.md" \
    "sourceType=doc" "sourceDate=2026-06-14" "scenarioId=q3-roadmap" "retainStrategy=uploads" >/dev/null
  api_upload "$PRODUCT" "$CONTENT/product/megacorp-customer-profile.md" \
    "sourceType=doc" "sourceDate=2026-06-17" "scenarioId=megacorp-renewal" "retainStrategy=uploads" >/dev/null

  retain_new "$PRODUCT" "ech-demo-product-sync-2026-06-10" \
    "Product team sync — 2026-06-10
Attendees: Alice Chen, David Wong, Eric Tai (consultant)

Alice: Mobile onboarding conversion is 12%, desktop 34%. Gap is unacceptable before MegaCorp renewal.
David: Enterprise users are desktop-heavy — do not deprioritize desktop.
Decision: Parallel A/B tests — Alice owns mobile simplified flow, Bob owns desktop backend perf.
Deadline: Results by July 1, 2026." \
    meeting "Product sync — June 10" "" "2026-06-10" private megacorp-renewal meetings

  retain_append "$PRODUCT" "ech-demo-product-sync-2026-06-10" \
    "Follow-up: Alice to share Figma mocks by June 12. Eric to document decisions in Hindsight for Carol's renewal deck."

  api_json PUT "/api/documents/ech-demo-product-sync-2026-06-10" \
    "{\"bankId\":\"$PRODUCT\",\"content\":\"Product team sync — 2026-06-10 (edited)\\n\\nAttendees: Alice Chen, David Wong, Eric Tai\\n\\nKey decision: SSO for MegaCorp is Q3 priority #2 — escalated from engineering backlog.\\nMobile A/B test still owned by Alice. Desktop perf owned by Bob.\\nCarol notified that SSO timeline is now on critical path for September renewal.\"}" >/dev/null

  retain_new "$PRODUCT" "ech-demo-user-research-2026-06-12" \
    "User research — 2026-06-12 (5 enterprise interviews)
Top pain: 8-step onboarding, no SSO, confusing reporting dashboard.
Positive: MegaCorp engineering praised API reliability post June 15 fix.
Carol says MegaCorp may renew early if SSO ships by August." \
    meeting "Enterprise user research" "" "2026-06-12" private megacorp-renewal meetings

  tag_doc "$PRODUCT" "ech-demo-product-sync-2026-06-10" \
    "scope:shared" "project:phoenix" "client:megacorp" "scenario:megacorp-renewal" "demo:customer"
  tag_doc "$PRODUCT" "ech-demo-user-research-2026-06-12" \
    "scope:shared" "team:product" "scenario:megacorp-renewal" "demo:customer"
  tag_doc "$PRODUCT" "q3-2026-roadmap" \
    "scenario:q3-roadmap" "demo:customer" 2>/dev/null || true
  tag_doc "$PRODUCT" "megacorp-customer-profile" \
    "scenario:megacorp-renewal" "demo:customer" 2>/dev/null || true
}

seed_engineering() {
  log "engineering bank — ADR upload + incident note"
  api_upload "$ENGINEERING" "$CONTENT/engineering/adr-001-graphql-internal-apis.md" \
    "sourceType=doc" "sourceDate=2026-06-08" >/dev/null

  retain_new "$ENGINEERING" "ech-demo-incident-2026-06-15" \
    "P2 incident post-mortem — 2026-06-15
Two-hour outage during MegaCorp bulk import.
Root cause: PostgreSQL connection pool exhausted (limit 20).
Fix applied: pool increased to 100, connection timeout alerts enabled.
Action: Bob Smith to implement circuit breaker by 2026-06-30.
Customer impact: MegaCorp batch delayed 2h; Tom Nguyen informed same day." \
    other "" "INC-2847" "2026-06-15"

  api_json PUT "/api/documents/ech-demo-incident-2026-06-15" \
    "{\"bankId\":\"$ENGINEERING\",\"content\":\"P2 incident post-mortem — 2026-06-15 (final)\\n\\nSeverity: P2 · Duration: 2 hours\\nRoot cause: DB connection pool exhausted during MegaCorp bulk import.\\nFix: Pool 20→100, PagerDuty alert on pool saturation >80%.\\nFollow-up: Circuit breaker pattern due 2026-06-30 (Bob Smith).\\nMegaCorp status: Tom confirmed no data loss; renewal discussions continue.\"}" >/dev/null

  tag_doc "$ENGINEERING" "ech-demo-incident-2026-06-15" \
    "scope:shared" "severity:p2" "client:megacorp" "demo:customer"
}

seed_sales() {
  log "sales bank — proposal upload + call notes"
  api_upload "$SALES" "$CONTENT/sales/megacorp-renewal-proposal-draft.md" \
    "sourceType=doc" "sourceDate=2026-06-18" >/dev/null

  retain_new "$SALES" "ech-demo-megacorp-call-2026-06-14" \
    "MegaCorp Q2 check-in call — 2026-06-14
Attendees: Carol Lee, Bob Smith (technical), Tom Nguyen (MegaCorp)

Tom happy with API stability after incident fix.
Procurement (Lisa Park) requesting 15% discount on renewal.
Carol countered with premium support tier instead of discount.
Blocker: SSO must be live by August for MegaCorp security audit.
Next: Carol sends revised proposal v2 by June 20." \
    meeting "MegaCorp Q2 check-in" "" "2026-06-14"

  retain_new "$SALES" "ech-demo-faststart-upsell-2026-06-16" \
    "FastStart upsell — 2026-06-16
FastStart wants Enterprise tier upgrade.
Blocker: custom reporting module on Q4 roadmap.
Workaround approved: 3-month manual reports from Alice (David sign-off).
Risk: burns PM capacity; track hours weekly." \
    meeting "FastStart upsell call" "" "2026-06-16"

  tag_doc "$SALES" "ech-demo-megacorp-call-2026-06-14" \
    "scope:shared" "client:megacorp" "demo:customer"
}

seed_ops() {
  log "ops bank — compliance upload + note"
  api_upload "$OPS" "$CONTENT/ops/soc2-readiness-checklist.md" \
    "sourceType=doc" "sourceDate=2026-06-13" >/dev/null

  retain_new "$OPS" "ech-demo-compliance-2026-06-13" \
    "Compliance prep working session — 2026-06-13
Attendees: Diana Park, Eric Tai (consultant)

SOC 2 Type II audit scheduled August 2026.
Gaps: informal access reviews, incident docs in Slack, 2 vendor assessments missing.
Actions: Diana — quarterly access reviews by June 25.
Eric — incident runbook + Hindsight export for audit evidence trail." \
    meeting "SOC 2 prep session" "" "2026-06-13"

  tag_doc "$OPS" "ech-demo-compliance-2026-06-13" "scope:shared" "demo:customer"
}

seed_mental_models() {
  log "product playbooks (mental models)"
  api_json POST /api/mental-models \
    "{\"bankId\":\"$PRODUCT\",\"id\":\"megacorp-renewal-playbook\",\"name\":\"MegaCorp renewal playbook\",\"sourceQuery\":\"What blocks MegaCorp renewal and who owns each mitigation?\",\"autoRefresh\":true}" \
    >/dev/null || log "  (megacorp playbook may already exist)"
  api_json POST /api/mental-models \
    "{\"bankId\":\"$PRODUCT\",\"id\":\"sso-critical-path\",\"name\":\"SSO critical path\",\"sourceQuery\":\"What is the SSO timeline, owners, and customer impact for MegaCorp?\",\"autoRefresh\":true}" \
    >/dev/null || log "  (sso playbook may already exist)"
  api_json POST /api/mental-models \
    "{\"bankId\":\"$PRODUCT\",\"id\":\"q3-priorities\",\"name\":\"Q3 priorities\",\"sourceQuery\":\"What are Q3 product priorities, budgets, and deprioritized work?\",\"autoRefresh\":true}" \
    >/dev/null || log "  (q3 playbook may already exist)"
  log "  3 playbooks submitted (content generates async)"
}

verify_demo() {
  log "waiting for indexing (up to 3 min per bank)…"
  wait_docs "$SHARED" 5 90
  wait_docs "$PRODUCT" 4 90
  wait_docs "$ENGINEERING" 2 90
  wait_docs "$SALES" 3 90
  wait_docs "$OPS" 2 90

  log "recall smoke — MegaCorp SSO"
  local recall_n recall_scenario
  recall_n="$(api_json POST /api/recall \
    "{\"bankId\":\"$PRODUCT\",\"query\":\"MegaCorp SSO August renewal Carol\"}" \
    | jq '.memories | length')"
  log "  recall hits: $recall_n"
  recall_scenario="$(api_json POST /api/recall \
    "{\"bankId\":\"$PRODUCT\",\"query\":\"Q3 roadmap priorities\",\"scenarioId\":\"q3-roadmap\"}" \
    | jq '.memories | length')"
  log "  recall (scenario q3-roadmap): $recall_scenario"

  log "graph — product bank"
  local nodes links
  nodes="$(api_json GET "/api/banks/$PRODUCT/graph" | jq '.meta.totalNodes // 0')"
  links="$(api_json GET "/api/banks/$PRODUCT/graph" | jq '.meta.totalLinks // 0')"
  log "  graph nodes=$nodes links=$links"

  log "entities — product bank"
  api_json GET "/api/entities?bankId=$PRODUCT&limit=10" | jq -r '.items[:5][] | "  · \(.canonical_name) (\(.mention_count // 0) mentions)"'

  log "OKF wiki export — product bank"
  local wiki_files
  wiki_files="$(api_json POST /api/export-wiki \
    "{\"bankId\":\"$PRODUCT\",\"bankLabel\":\"Product\"}" \
    | jq '.files | keys | length')"
  log "  wiki pages: $wiki_files"

  mkdir -p "$(dirname "$REPORT")"
  jq -n \
    --arg api "$API" \
    --argjson recall "$recall_n" \
    --argjson nodes "$nodes" \
    --argjson links "$links" \
    --argjson wiki "$wiki_files" \
    '{
      success: true,
      api: $api,
      portal_hint: "Open Product bank — Sources, Knowledge, Query, Graph, Export",
      demo_tag: "demo:customer",
      verify: {recall_hits: $recall, graph_nodes: $nodes, graph_links: $links, wiki_pages: $wiki}
    }' >"$REPORT"
  log "report → $REPORT"
}

command -v jq >/dev/null || fail "jq required (brew install jq)"
command -v curl >/dev/null || fail "curl required"

login
seed_shared_facts
seed_product
seed_engineering
seed_sales
seed_ops
seed_mental_models
verify_demo

FRONT="$(jq -r '.frontend // 3000' "$ROOT/.uat/dev-ports.json" 2>/dev/null || echo 3000)"
log "done — open http://localhost:${FRONT} · log in as $EMAIL · select Product (or Shared) bank"
log "features: Sources tree · Knowledge facts · Recall/Reflect · Graph · Export wiki links"
