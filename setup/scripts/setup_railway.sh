#!/bin/bash
# Railway Setup Helper
# This script helps you verify your Railway deployment

echo "=== Hindsight Railway Setup Verification ==="

echo ""
echo "1. Check PostgreSQL is running with pgvector:"
echo "   Connect to Railway postgres service and run:"
echo "   CREATE EXTENSION IF NOT EXISTS vector;"
echo ""

echo "2. Check Hindsight can connect to DB:"
echo "   Look at Hindsight service logs in Railway dashboard"
echo "   Should see: 'Connected to PostgreSQL' or similar"
echo ""

echo "3. Verify ports:"
echo "   - Port 9999 should be PUBLIC (Control Plane / Web UI)"
echo "   - Port 8888 should be PRIVATE (API, only accessible within project)"
echo ""

echo "4. Test the API:"
echo "   curl -X POST https://your-railway-url.up.railway.app/retain \"
echo "     -H 'Content-Type: application/json' \"
echo "     -d '{"bank_id":"co-test-shared","content":"Hello from Railway"}'"
echo ""

echo "5. For migration safety, confirm:"
echo "   - You are NOT using the embedded pg0 database"
echo "   - HINDSIGHT_API_DATABASE_URL points to your external PostgreSQL"
echo "   - Your Railway PostgreSQL service has a persistent volume"
