# Cold Start Guide — ECH Demo

Bootstrap a Hindsight instance with ECH consulting demo data.

## Prerequisites

```bash
conda activate llm_base
pip install -r setup/requirements.txt
cp .env.example .env
```

Required in root `.env`:

```
HINDSIGHT_URL=http://localhost:8888
HINDSIGHT_API_KEY=your-tenant-api-key
```

## Phases

| Phase | Command | What it does |
|-------|---------|--------------|
| all | `--phase all` | Full bootstrap |
| create_banks | `--phase create_banks` | 5 ECH banks |
| seed_facts | `--phase seed_facts` | 12 structured facts → shared bank |
| team_notes | `--phase team_notes` | Meeting notes per team bank |
| upload_files | `--phase upload_files` | PDFs (configure `DOCUMENTS` in script) |
| verify | `--phase verify` | Recall + reflect smoke tests |
| template | `--phase template` | Write `examples/templates/ech_weekly_template.py` |

```bash
python examples/ech_cold_start.py --phase all
```

After `--phase all`, wait **5–10 minutes** for consolidation, then:

```bash
python examples/ech_cold_start.py --phase verify
```

## Banks created

- `team-product`
- `team-engineering`
- `team-sales`
- `team-ops`

Structured facts seed into `team-product`. Meeting notes go to each team bank.

## Consultant bootstrap (before heavy ingestion)

See [RETAIN_QUALITY.md](./RETAIN_QUALITY.md). Minimum order:

1. **Create banks** — portal `PUT /api/banks` or `--phase create_banks` (applies per-team missions + entity_labels)
2. **Review Config** — Admin → Config per team; tune retain/reflect/observations missions
3. **Use stable source ids** — note titles and filenames become `document_id` (no random UUID sessions)
4. **Add source context** — meeting name, ticket ID, source date on notes/uploads when known
5. **Verify** — `--phase verify` or portal Query/Sources before bulk PDF ingest

## Document uploads (optional)

Edit `DOCUMENTS` dict in `examples/ech_cold_start.py`:

```python
DOCUMENTS = {
    "co-ech-shared": [
        ("./path/to/strategy.pdf", "strategy_deck"),
    ],
}
```

## Weekly automation

Regenerate cron template:

```bash
python examples/ech_cold_start.py --phase template
```

Example cron (Fridays 18:00):

```
0 18 * * 5 /usr/bin/python3 /path/to/db_mem/examples/templates/ech_weekly_template.py
```

Update `YOUR_HINDSIGHT_URL` and `YOUR_API_KEY` in the generated template.
