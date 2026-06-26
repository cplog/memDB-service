#!/bin/bash
# Hindsight Migration Script
# Run this to migrate your data from Railway (or any host) to a new host

set -e

echo "=== Hindsight Database Migration ==="

# Source (Railway or current host)
read -p "Source database URL (e.g., postgresql://user:pass@railwayhost:5432/postgres): " SOURCE_URL

# Target (new host)
read -p "Target database URL (e.g., postgresql://user:pass@awshost:5432/postgres): " TARGET_URL

echo "Creating backup..."
pg_dump "$SOURCE_URL" > hindsight_full_backup_$(date +%Y%m%d_%H%M%S).sql

echo "Restoring to target..."
psql "$TARGET_URL" < hindsight_full_backup_*.sql

echo "Verifying pgvector extension on target..."
psql "$TARGET_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;"

echo "Migration complete!"
echo "Next steps:"
echo "1. Update HINDSIGHT_API_DATABASE_URL to point to the new target"
echo "2. Restart Hindsight"
echo "3. Verify by creating a test memory in the Web UI"
