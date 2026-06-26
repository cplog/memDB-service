#!/usr/bin/env python3
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
        bank_id=BANK_MAP.get(team, "co-ech-shared"),
        content=f"Weekly Slack summary — {team} team:\n{summary}",
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
        bank_id=BANK_MAP.get(team, "co-ech-shared"),
        content=f"Weekly update — {team}:\n{update}",
        metadata={
            "source_company": "ech",
            "source_team": team,
            "data_type": "unstructured",
            "data_subtype": "weekly_update",
            "consultant_visible": "true",
            "retained_by": "consultant-eric",
        }
    )
