#!/usr/bin/env python3
"""
Hindsight Cold Start Demo — ECH Consulting Setup
Run this script to bootstrap your Hindsight instance with ECH data.

Prerequisites:
  pip install hindsight-client requests python-dotenv
  Set HINDSIGHT_URL and HINDSIGHT_API_KEY in project root .env

Usage:
  python examples/ech_cold_start.py --phase all
  python examples/ech_cold_start.py --phase create_banks
  python examples/ech_cold_start.py --phase verify
"""

import argparse
import json
import os
import time
from pathlib import Path

import requests
from dotenv import load_dotenv
from hindsight_client import Hindsight

# Load .env from project root (does not override existing env vars)
PROJECT_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(PROJECT_ROOT / ".env")

# ═══════════════════════════════════════════════════════════════
# CONFIG — set in .env or export as environment variables
# ═══════════════════════════════════════════════════════════════

HINDSIGHT_URL = os.environ.get("HINDSIGHT_URL", "https://your-hindsight-url.up.railway.app")
HINDSIGHT_API_KEY = os.environ.get("HINDSIGHT_API_KEY", "your-api-key-here")

# Document paths for Phase 4 (set to None to skip)
DOCUMENTS = {
    "team-product": [
        # ("./ECH_2026_Strategy.pdf", "strategy_deck"),
    ],
    "team-sales": [
        # ("./MegaCorp_Contract_2025.pdf", "contract"),
    ],
}

BANKS = [
    "team-product",
    "team-engineering",
    "team-sales",
    "team-ops",
]

client = Hindsight(base_url=HINDSIGHT_URL, api_key=HINDSIGHT_API_KEY)
HEADERS = {"Authorization": f"Bearer {HINDSIGHT_API_KEY}", "Content-Type": "application/json"}

# ═══════════════════════════════════════════════════════════════
# PHASE 1 — CREATE BANKS
# ═══════════════════════════════════════════════════════════════

def phase_create_banks():
    print("\n📦 PHASE 1: Creating banks...")
    for bank in BANKS:
        try:
            client.create_bank(bank_id=bank)
            print(f"   ✅ Created: {bank}")
        except Exception as e:
            err = str(e)
            if "409" in err or "already exists" in err.lower():
                print(f"   ⚠️  Already exists: {bank}")
            else:
                print(f"   ❌ Failed {bank}: {e}")
    print("   Done.\n")

# ═══════════════════════════════════════════════════════════════
# PHASE 2 — SEED STRUCTURED FACTS
# ═══════════════════════════════════════════════════════════════

def phase_seed_facts():
    print("📋 PHASE 2: Seeding structured facts...")

    facts = [
        "Alice Chen is a Product Manager at ECH, joined March 2025, reports to David Wong",
        "Bob Smith is a Senior Engineer at ECH, leads the backend team, joined January 2024",
        "Carol Lee is the Sales Director at ECH, manages enterprise accounts, based in Hong Kong",
        "David Wong is the CTO at ECH, co-founder, oversees product and engineering",
        "Eric Tai is an external consultant advising ECH on platform architecture and data systems",
        "Project Phoenix is ECH's platform migration initiative, budget 500K USD, deadline Q3 2026, owner Alice Chen",
        "Project Titan is ECH's new AI feature set, budget 1.2M USD, deadline Q4 2026, owner David Wong",
        "MegaCorp is an enterprise client of ECH, contract value 1.2M USD, renewal date 2026-09-15, account owner Carol Lee",
        "FastStart is a startup client of ECH, contract value 80K USD, monthly SaaS plan, account owner Bob Smith",
        "ECH is headquartered in Hong Kong, founded 2022, 45 employees, focuses on B2B SaaS automation",
        "ECH's Q2 2026 revenue target is 3M USD, currently at 2.1M USD with 4 weeks remaining",
        "ECH uses PostgreSQL as primary database, Redis for caching, and Railway for hosting",
    ]

    for i, fact in enumerate(facts, 1):
        try:
            client.retain(
                bank_id="team-product",
                content=fact,
                metadata={
                    "source_company": "ech",
                    "source_team": "product",
                    "data_type": "structured_fact",
                    "fact_category": "entity_directory",
                    "consultant_visible": "true",
                    "retained_by": "consultant-eric",
                    "batch_index": str(i),
                }
            )
            print(f"   ✅ Fact {i}/{len(facts)}: {fact[:60]}...")
        except Exception as e:
            print(f"   ❌ Fact {i} failed: {e}")
    print("   Done.\n")

# ═══════════════════════════════════════════════════════════════
# PHASE 3 — TEAM MEETING NOTES
# ═══════════════════════════════════════════════════════════════

def phase_team_notes():
    print("📝 PHASE 3: Injecting team meeting notes...")

    notes = {
        "team-product": [
            """Product team sync — 2026-06-10
Attendees: Alice, David, external consultant Eric

Alice: Mobile onboarding conversion is 12%, desktop is 34%. We need to close this gap.
David: Enterprise clients (MegaCorp, FastStart) are desktop-heavy. Don't abandon desktop.
Decision: Run parallel A/B tests — mobile simplified flow vs desktop optimized flow.
Alice owns mobile test. Bob owns desktop backend optimization.
Deadline: Results by July 1.""",
            """User research session — 2026-06-12
Researcher: Alice

5 enterprise users interviewed. Top complaints:
1. Onboarding takes too long (8 steps)
2. No single sign-on (SSO) support
3. Reporting dashboard is confusing

Positive: API reliability praised by MegaCorp's engineering team.
Carol (Sales) says MegaCorp might renew early if we fix SSO by August.""",
            """Roadmap review — 2026-06-14
Alice + David

Q3 priorities finalized:
1. Project Phoenix platform migration (Alice)
2. SSO integration for enterprise clients (Bob)
3. Custom reporting module (Alice, but needs design support)

Deprioritized: Project Titan AI features moved to Q4 due to budget constraints.
David noted that MegaCorp renewal is critical to fund Titan.""",
        ],
        "team-engineering": [
            """Architecture decision record — 2026-06-08
Proposed by: Bob

Decision: Migrate from REST to GraphQL for internal APIs.
Rationale: Frontend team needs flexible queries, reducing over-fetching by ~40%.
Risk: Learning curve for junior devs. Mitigation: Bob runs internal workshop June 20.
Rejected alternative: gRPC — too complex for current team size.""",
            """Incident post-mortem — 2026-06-15
Severity: P2 (2-hour outage)

Root cause: Database connection pool exhausted during MegaCorp bulk import.
Fix: Increased pool size from 20 to 100. Added connection timeout alerts.
Action item: Bob to implement circuit breaker pattern by June 30.""",
            """Engineering standup — 2026-06-17

Alice (Product) asked for SSO timeline. Bob said OAuth2 + SAML will take 6 weeks.
David wants it in 4 weeks for MegaCorp. Bob pushed back — needs dedicated frontend dev.
Decision: Pull one dev from Project Titan to support SSO. David approved.""",
        ],
        "team-sales": [
            """MegaCorp Q2 check-in — 2026-06-14
Carol + Bob (technical)

MegaCorp's engineering lead (Tom) is happy with API stability after the recent fix.
BUT: Procurement is pushing for a 15% discount on renewal.
Carol's counter: Add premium support tier instead of discount.
Tom's concern: SSO timeline — they need it by August for their internal security audit.
Next step: Carol sends revised proposal by June 20.""",
            """FastStart upsell call — 2026-06-16
Carol only

FastStart wants to upgrade from Starter to Enterprise.
Blocker: They need custom reporting module. Product team says this is on Q4 roadmap.
Workaround: Carol offered a 3-month bridge with manual reports from Alice.
Risk: Manual reports burn Alice's time. David approved as one-off.""",
            """Sales pipeline review — 2026-06-17
Carol + David

Q2 status:
- MegaCorp: 80% likely to renew, but SSO is blocker
- FastStart: 60% upsell chance, waiting on reporting module
- New lead: GreenTech (200K potential), Carol to demo next week

Q3 target: 4 new enterprise clients. Carol needs marketing support for case studies.""",
        ],
        "team-ops": [
            """Vendor review — 2026-06-11
Ops lead: Diana

Current vendors:
- Railway: Hosting, satisfactory, no issues
- NeonDB: Database, satisfactory, but costs rising 20% QoQ
- SendGrid: Email, complaints about deliverability to enterprise inboxes

Decision: Evaluate AWS SES as SendGrid alternative. Diana to run cost comparison by June 25.""",
            """Compliance audit prep — 2026-06-13
Diana + external consultant Eric

SOC 2 Type II audit scheduled for August.
Gaps identified:
1. No formal access review process (David approves ad-hoc)
2. Incident response docs are in Slack, not formal system
3. Vendor risk assessments missing for 2 small tools

Action: Diana to implement quarterly access reviews. Eric to document incident response runbook.""",
        ],
    }

    for bank_id, team_notes in notes.items():
        team = bank_id.replace("team-", "")
        print(f"\n   🏦 {bank_id}:")
        for i, note in enumerate(team_notes, 1):
            try:
                client.retain(
                    bank_id=bank_id,
                    content=note.strip(),
                    metadata={
                        "source_company": "ech",
                        "source_team": team,
                        "data_type": "unstructured",
                        "data_subtype": "meeting_note",
                        "consultant_visible": "true",
                        "retained_by": "consultant-eric",
                        "note_index": str(i),
                    }
                )
                print(f"      ✅ Note {i} retained")
            except Exception as e:
                print(f"      ❌ Note {i} failed: {e}")
    print("\n   Done.\n")

# ═══════════════════════════════════════════════════════════════
# PHASE 4 — FILE UPLOADS
# ═══════════════════════════════════════════════════════════════

def phase_upload_files():
    print("📁 PHASE 4: Uploading documents...")
    if not any(DOCUMENTS.values()):
        print("   ⚠️  No documents configured. Set DOCUMENTS dict in script to enable.\n")
        return
    for bank_id, files in DOCUMENTS.items():
        for file_path, doc_type in files:
            p = Path(file_path)
            if not p.exists():
                print(f"   ❌ File not found: {file_path}")
                continue
            try:
                with open(p, "rb") as f:
                    resp = requests.post(
                        f"{HINDSIGHT_URL}/v1/default/banks/{bank_id}/files/retain",
                        headers={"Authorization": f"Bearer {HINDSIGHT_API_KEY}"},
                        files={"file": (p.name, f, "application/pdf")},
                        data={
                            "metadata": json.dumps({
                                "source_company": "ech",
                                "data_type": "document",
                                "document_type": doc_type,
                                "consultant_visible": "true",
                                "retained_by": "consultant-eric",
                            }),
                            "parser": "markitdown",
                        },
                        timeout=120,
                    )
                if resp.status_code in (200, 201, 202):
                    print(f"   ✅ Uploaded: {p.name} → {bank_id}")
                else:
                    print(f"   ❌ Failed {p.name}: {resp.status_code} {resp.text[:100]}")
            except Exception as e:
                print(f"   ❌ Error {p.name}: {e}")
    print("   Done.\n")

# ═══════════════════════════════════════════════════════════════
# PHASE 5 — VERIFY MENTAL MODELS
# ═══════════════════════════════════════════════════════════════

def phase_verify():
    print("🔍 PHASE 5: Verifying recall and mental models...")
    print("   (If results are empty, wait 5–10 minutes for consolidation and retry.)\n")
    tests = [
        ("team-product", "What do we know about MegaCorp's concerns and timeline?"),
        ("team-product", "What are the onboarding conversion rates and what was decided?"),
        ("team-engineering", "What caused the outage on June 15 and what was the fix?"),
        ("team-sales", "What is Carol's strategy for MegaCorp renewal?"),
        ("team-sales", "What is the status of FastStart upsell?"),
        ("team-product", "Who is Alice Chen and what is she working on?"),
    ]
    for bank_id, query in tests:
        print(f"   🧪 {bank_id}: \"{query[:60]}...\"")
        try:
            results = client.recall(
                bank_id=bank_id,
                query=query,
            )
            memories = results.results if results else None
            if memories:
                count = len(memories)
                top = memories[0].text[:120]
                print(f"      ✅ {count} memories found. Top: {top}...")
            else:
                print(f"      ⚠️  No memories returned (consolidation may still be running)")
        except Exception as e:
            print(f"      ❌ Error: {e}")
    print("\n   🧠 Reflect test (cross-bank synthesis)...")
    try:
        response = client.reflect(
            bank_id="team-product",
            query="Summarize the top 3 risks ECH faces in Q3 2026 and who owns each mitigation"
        )
        print(f"      ✅ Reflect returned: {response.text[:200]}...")
    except Exception as e:
        print(f"      ❌ Reflect failed: {e}")
    print("\n   Done.\n")

# ═══════════════════════════════════════════════════════════════
# PHASE 6 — WEEKLY AUTOMATION TEMPLATE
# ═══════════════════════════════════════════════════════════════

def phase_export_template():
    print("📤 PHASE 6: Exporting weekly automation template...")
    template = '''#!/usr/bin/env python3
"""
Weekly ingestion automation for ECH.
Run via cron every Friday at 6 PM:
  0 18 * * 5 /usr/bin/python3 /path/to/weekly_ingest.py
"""

from hindsight_client import Hindsight

client = Hindsight(
    base_url="YOUR_HINDSIGHT_URL",
    api_key="YOUR_API_KEY"
)

BANK_MAP = {
    "product": "team-product",
    "engineering": "team-engineering",
    "sales": "team-sales",
    "ops": "team-ops",
}

def ingest_slack_summary(team: str, summary: str):
    client.retain(
        bank_id=BANK_MAP.get(team, "team-product"),
        content=f"Weekly Slack summary — {team} team:\\n{summary}",
        metadata={
            "source_company": "ech",
            "source_team": team,
            "data_type": "unstructured",
            "data_subtype": "slack_summary",
            "consultant_visible": "true",
            "retained_by": "consultant-eric",
        }
    )

def ingest_weekly_update(team: str, update: str):
    client.retain(
        bank_id=BANK_MAP.get(team, "team-product"),
        content=f"Weekly update — {team}:\\n{update}",
        metadata={
            "source_company": "ech",
            "source_team": team,
            "data_type": "unstructured",
            "data_subtype": "weekly_update",
            "consultant_visible": "true",
            "retained_by": "consultant-eric",
        }
    )
'''
    out_path = PROJECT_ROOT / "examples" / "templates" / "ech_weekly_template.py"
    out_path.write_text(template)
    print(f"   ✅ Template saved to: {out_path.absolute()}")
    print("   Done.\n")

# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="ECH Hindsight Cold Start")
    parser.add_argument(
        "--phase",
        choices=["all", "create_banks", "seed_facts", "team_notes", "upload_files", "verify", "template"],
        default="all",
        help="Which phase to run (default: all)"
    )
    args = parser.parse_args()
    print("=" * 60)
    print("  Hindsight Cold Start — ECH Demo")
    print(f"  URL: {HINDSIGHT_URL}")
    print("=" * 60)
    if args.phase in ("all", "create_banks"):
        phase_create_banks()
    if args.phase in ("all", "seed_facts"):
        phase_seed_facts()
    if args.phase in ("all", "team_notes"):
        phase_team_notes()
    if args.phase in ("all", "upload_files"):
        phase_upload_files()
    if args.phase in ("all", "verify"):
        print("⏳ Waiting 3 seconds for indexing...")
        time.sleep(3)
        phase_verify()
    if args.phase in ("all", "template"):
        phase_export_template()
    client.close()
    print("🎉 Cold start complete!")
    if args.phase == "all":
        print("   Next: Wait 5–10 minutes, then re-run with --phase verify")

if __name__ == "__main__":
    main()