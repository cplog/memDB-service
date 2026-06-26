#!/usr/bin/env python3
"""Production data reset + full portal E2E via API. Run with dev stack up."""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

API = os.environ.get("BACKEND_URL", "http://127.0.0.1:8000")
EMAIL = "eric@consultant.com"
STAMP = datetime.now(timezone.utc).strftime("%Y%m%d")
PREFIX = f"e2e-reset-{STAMP}"
REPO = Path(__file__).resolve().parents[1]
EVIDENCE = REPO / ".uat" / "evidence" / f"reset-{STAMP}"
REPORT_PATH = REPO / ".uat" / "reports" / f"e2e-reset-{STAMP}.json"


class E2ERunner:
    def __init__(self) -> None:
        self.s = requests.Session()
        self.report: dict[str, Any] = {
            "stamp": STAMP,
            "prefix": PREFIX,
            "banks": {},
            "flows": {},
            "errors": [],
        }
        self.e2e_doc_ids: list[tuple[str, str]] = []

    def fail(self, msg: str) -> None:
        self.report["errors"].append(msg)
        raise RuntimeError(msg)

    def ok(self, key: str, detail: Any = True) -> None:
        self.report["flows"][key] = detail

    def login(self) -> None:
        r = self.s.post(
            f"{API}/api/auth/login",
            json={"email": EMAIL},
            timeout=60,
        )
        if not r.ok:
            self.fail(f"login failed: {r.status_code} {r.text[:200]}")
        self.ok("login")

    def banks(self) -> list[str]:
        r = self.s.get(f"{API}/api/banks", timeout=60)
        r.raise_for_status()
        data = r.json()
        ids = data.get("banks") or []
        if not ids:
            teams = self.s.get(f"{API}/api/teams", timeout=60).json()
            ids = [t["bankId"] for t in teams.get("teams", [])]
            cs = teams.get("companySlug", "ech")
            shared = f"co-{cs}-shared" if cs else None
            if shared:
                ids.append(shared)
        return list(dict.fromkeys(ids))

    def list_all_docs(self, bank_id: str) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        offset = 0
        while True:
            r = self.s.get(
                f"{API}/api/documents",
                params={"bankId": bank_id, "limit": 100, "offset": offset},
                timeout=120,
            )
            if not r.ok:
                self.report["errors"].append(
                    f"list docs {bank_id}: {r.status_code} {r.text[:120]}"
                )
                break
            batch = r.json().get("items") or []
            items.extend(batch)
            if len(batch) < 100:
                break
            offset += 100
        return items

    def backup_bank(self, bank_id: str, docs: list[dict[str, Any]]) -> None:
        bank_dir = EVIDENCE / bank_id.replace("/", "_")
        bank_dir.mkdir(parents=True, exist_ok=True)
        (bank_dir / "inventory.json").write_text(
            json.dumps({"bankId": bank_id, "count": len(docs), "items": docs}, indent=2)
        )
        for kind in ("export", "export-wiki"):
            try:
                r = self.s.post(
                    f"{API}/api/{kind}",
                    json={"bankId": bank_id, "bankLabel": bank_id},
                    timeout=300,
                )
                if r.ok:
                    (bank_dir / f"{kind}.json").write_text(
                        json.dumps(r.json(), indent=2)[:5_000_000]
                    )
                else:
                    self.report["errors"].append(
                        f"{kind} {bank_id}: {r.status_code} {r.text[:120]}"
                    )
            except Exception as e:
                self.report["errors"].append(f"{kind} {bank_id}: {e}")

    def delete_doc(self, bank_id: str, doc_id: str) -> bool:
        r = self.s.delete(
            f"{API}/api/documents/{requests.utils.quote(doc_id, safe='')}",
            params={"bankId": bank_id},
            timeout=120,
        )
        return r.ok

    def wipe_all(self, bank_ids: list[str]) -> None:
        deleted: dict[str, list[str]] = {}
        for bank_id in bank_ids:
            docs = self.list_all_docs(bank_id)
            self.report["banks"].setdefault(bank_id, {})["preflight_count"] = len(docs)
            self.backup_bank(bank_id, docs)
            removed: list[str] = []
            for doc in docs:
                doc_id = str(doc.get("id", ""))
                if not doc_id:
                    continue
                if self.delete_doc(bank_id, doc_id):
                    removed.append(doc_id)
                else:
                    self.report["errors"].append(f"delete failed {bank_id}/{doc_id}")
                time.sleep(0.3)
            deleted[bank_id] = removed
            self.report["banks"][bank_id]["deleted"] = removed
        self.ok("wipe", {k: len(v) for k, v in deleted.items()})

    def verify_empty(self, bank_ids: list[str]) -> None:
        empty: dict[str, int] = {}
        for bank_id in bank_ids:
            n = len(self.list_all_docs(bank_id))
            empty[bank_id] = n
            if n:
                self.report["errors"].append(f"not empty after wipe: {bank_id} ({n})")
        self.ok("verify_empty", empty)

    def wait_for_doc(
        self, bank_id: str, doc_id: str, timeout_s: float = 90.0
    ) -> dict[str, Any]:
        deadline = time.time() + timeout_s
        last_status = 0
        while time.time() < deadline:
            r = self.s.get(
                f"{API}/api/documents/{requests.utils.quote(doc_id, safe='')}",
                params={"bankId": bank_id},
                timeout=60,
            )
            last_status = r.status_code
            if r.ok:
                return r.json()
            for doc in self.list_all_docs(bank_id):
                if str(doc.get("id")) == doc_id:
                    r2 = self.s.get(
                        f"{API}/api/documents/{requests.utils.quote(doc_id, safe='')}",
                        params={"bankId": bank_id},
                        timeout=60,
                    )
                    if r2.ok:
                        return r2.json()
            time.sleep(2)
        self.fail(f"doc {doc_id} not ready after {timeout_s}s (last {last_status})")
        return {}

    def retain(
        self,
        bank_id: str,
        content: str,
        *,
        session_id: str | None = None,
        document_id: str | None = None,
        append: bool = False,
        tags_meta: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "bankId": bank_id,
            "content": content,
            "scope": "private",
        }
        if document_id:
            body["documentId"] = document_id
            if append:
                body["updateMode"] = "append"
        elif session_id:
            body["sessionId"] = session_id
        if tags_meta:
            body.update(tags_meta)
        r = self.s.post(f"{API}/api/retain", json=body, timeout=120)
        if not r.ok:
            self.fail(f"retain failed: {r.status_code} {r.text[:200]}")
        return r.json()

    def run_e2e(self, bank_id: str) -> None:
        note_id = f"{PREFIX}-note"
        upload_name = f"{PREFIX}-upload.md"

        # Upload
        upload_path = REPO / ".uat" / "scratch" / upload_name
        upload_path.parent.mkdir(parents=True, exist_ok=True)
        upload_path.write_text(
            f"# {PREFIX} upload\n\nMegaCorp decided to pilot Hindsight in Q3.\n"
        )
        with upload_path.open("rb") as f:
            r = self.s.post(
                f"{API}/api/upload",
                data={"bankId": bank_id},
                files={"file": (upload_name, f, "text/markdown")},
                timeout=120,
            )
        if not r.ok:
            self.fail(f"upload failed: {r.status_code} {r.text[:200]}")
        upload_resp = r.json()
        upload_doc_id = upload_name
        for item in upload_resp.get("results") or upload_resp.get("files") or []:
            if isinstance(item, dict) and item.get("document_id"):
                upload_doc_id = str(item["document_id"])
                break
        self.e2e_doc_ids.append((bank_id, upload_doc_id))
        self.ok("upload", {"id": upload_doc_id, "response": upload_resp})

        # Read source (async indexing)
        doc = self.wait_for_doc(bank_id, upload_doc_id)
        self.ok("read_upload", bool(doc.get("original_text")))

        # New note
        self.retain(
            bank_id,
            f"{PREFIX} meeting notes: agreed on timeline for rollout.",
            session_id=note_id,
            tags_meta={
                "sourceType": "meeting",
                "meetingName": f"{PREFIX} standup",
            },
        )
        self.e2e_doc_ids.append((bank_id, note_id))
        self.ok("retain_note", note_id)

        # Append
        self.retain(
            bank_id,
            f"{PREFIX} append: follow-up action items captured.",
            document_id=note_id,
            append=True,
        )
        self.ok("append_note")

        # Edit text
        r = self.s.put(
            f"{API}/api/documents/{requests.utils.quote(note_id, safe='')}",
            json={
                "bankId": bank_id,
                "content": f"{PREFIX} edited body with updated decisions.",
            },
            timeout=120,
        )
        if not r.ok:
            self.fail(f"edit failed: {r.status_code} {r.text[:200]}")
        self.ok("edit_note")
        self.wait_for_doc(bank_id, note_id, timeout_s=60)

        # Tags (may lag after retain replace)
        tags_ok = False
        for _ in range(15):
            r = self.s.patch(
                f"{API}/api/documents/{requests.utils.quote(note_id, safe='')}",
                json={"bankId": bank_id, "tags": [f"scope:e2e", f"project:{PREFIX}"]},
                timeout=60,
            )
            if r.ok:
                tags_ok = True
                break
            if r.status_code != 500 or "not found" not in r.text.lower():
                self.fail(f"tags failed: {r.status_code} {r.text[:200]}")
            time.sleep(2)
        if not tags_ok:
            self.fail(f"tags failed after retries")
        self.ok("tags")

        # Replace upload file
        upload_path.write_text(
            f"# {PREFIX} upload replaced\n\nReplaced content mentions MegaCorp expansion.\n"
        )
        with upload_path.open("rb") as f:
            r = self.s.post(
                f"{API}/api/upload",
                data={"bankId": bank_id, "documentId": upload_doc_id},
                files={"file": (upload_name, f, "text/markdown")},
                timeout=120,
            )
        if not r.ok:
            self.fail(f"replace upload failed: {r.status_code} {r.text[:200]}")
        self.ok("replace_upload")

        time.sleep(3)

        # Query recall / reflect (indexing may still be in flight)
        recall_n = 0
        for _ in range(15):
            r = self.s.post(
                f"{API}/api/recall",
                json={"bankId": bank_id, "query": PREFIX},
                timeout=120,
            )
            if not r.ok:
                self.fail(f"recall failed: {r.status_code} {r.text[:200]}")
            recall_n = len(r.json().get("memories") or [])
            if recall_n:
                break
            time.sleep(4)
        self.ok("recall", recall_n)

        r = self.s.post(
            f"{API}/api/reflect",
            json={"bankId": bank_id, "query": f"Summarize {PREFIX} decisions"},
            timeout=300,
        )
        if not r.ok:
            self.fail(f"reflect failed: {r.status_code} {r.text[:200]}")
        self.ok("reflect", bool(r.json().get("response") or r.json().get("text")))

        # Knowledge list
        r = self.s.get(
            f"{API}/api/memories",
            params={"bankId": bank_id, "limit": 50},
            timeout=60,
        )
        if not r.ok:
            self.fail(f"memories failed: {r.status_code}")
        mems = r.json().get("items") or r.json().get("memories") or []
        self.ok("knowledge", len(mems))

        # Entities
        r = self.s.get(
            f"{API}/api/entities",
            params={"bankId": bank_id, "limit": 20},
            timeout=60,
        )
        entity_id = None
        if r.ok:
            items = r.json().get("items") or []
            self.ok("entities_list", len(items))
            if items:
                entity_id = items[0].get("id")
        else:
            self.report["errors"].append(f"entities list: {r.status_code}")

        if entity_id:
            r = self.s.get(
                f"{API}/api/entities/{requests.utils.quote(str(entity_id), safe='')}",
                params={"bankId": bank_id},
                timeout=60,
            )
            self.ok("entity_detail", r.ok)

        # Export
        for kind in ("export", "export-wiki"):
            r = self.s.post(
                f"{API}/api/{kind}",
                json={"bankId": bank_id, "bankLabel": "Product"},
                timeout=300,
            )
            if not r.ok:
                self.fail(f"{kind} failed: {r.status_code} {r.text[:200]}")
            self.ok(kind, True)

        upload_path.unlink(missing_ok=True)

    def cleanup_e2e(self) -> None:
        removed = []
        for bank_id, doc_id in self.e2e_doc_ids:
            if self.delete_doc(bank_id, doc_id):
                removed.append(f"{bank_id}/{doc_id}")
            time.sleep(0.3)
        self.ok("cleanup_e2e", removed)

    def final_verify(self, bank_id: str) -> None:
        left = [d["id"] for d in self.list_all_docs(bank_id) if PREFIX in str(d.get("id", ""))]
        if left:
            self.report["errors"].append(f"e2e docs remain on {bank_id}: {left}")
        self.ok("final_verify", left)


def main() -> int:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    skip_wipe = "--e2e-only" in sys.argv
    runner = E2ERunner()
    try:
        runner.login()
        bank_ids = runner.banks()
        runner.report["bank_ids"] = bank_ids
        print(f"→ banks: {bank_ids}")

        if not skip_wipe:
            runner.wipe_all(bank_ids)
            print("→ wipe complete")
            runner.verify_empty(bank_ids)
            print("→ empty verify")
        else:
            print("→ skip wipe (--e2e-only)")
            for bank_id in bank_ids:
                docs = runner.list_all_docs(bank_id)
                runner.report["banks"].setdefault(bank_id, {})["preflight_count"] = len(
                    docs
                )
                # ponytail: drop stale partial e2e docs from failed runs
                for doc in docs:
                    doc_id = str(doc.get("id", ""))
                    if PREFIX in doc_id:
                        runner.delete_doc(bank_id, doc_id)
                        time.sleep(0.3)

        primary = next((b for b in bank_ids if "product" in b), bank_ids[0])
        runner.run_e2e(primary)
        print(f"→ e2e flows on {primary}")

        runner.cleanup_e2e()
        runner.final_verify(primary)
        print("→ e2e cleanup")

        runner.report["success"] = len(runner.report["errors"]) == 0
    except Exception as e:
        runner.report["success"] = False
        if str(e) not in runner.report["errors"]:
            runner.report["errors"].append(str(e))
        print(f"FAIL: {e}", file=sys.stderr)

    REPORT_PATH.write_text(json.dumps(runner.report, indent=2))
    print(f"→ report {REPORT_PATH}")
    print(f"→ evidence {EVIDENCE}")
    return 0 if runner.report.get("success") else 1


if __name__ == "__main__":
    sys.exit(main())
