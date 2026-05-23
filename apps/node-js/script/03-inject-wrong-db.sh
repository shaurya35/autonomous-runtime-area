#!/bin/bash

# SRE-0012: Wrong Database Name Failure Test
# This script injects a database connection failure by using wrong DB name
# Result: All database operations fail, server connects to 'moviebox_broken'

echo "========================================"
echo "SRE-0012: Injecting Wrong Database Name"
echo "========================================"
echo ""

echo "Starting backend with wrong database name..."
echo "Expected behavior: Server starts but all DB queries fail"
echo "Database connection: mongodb://localhost:27017/moviebox_broken"
echo ""

# Set environment variables
export FAILURE_INJECTION="true"
export FAILURE_SCENARIO="db-wrong-name"
export FAILURE_DELAY_MS="0"

echo "Environment variables set:"
echo "  FAILURE_INJECTION = $FAILURE_INJECTION"
echo "  FAILURE_SCENARIO = $FAILURE_SCENARIO"
echo ""

echo "Starting server..."
echo "Press Ctrl+C to stop"
echo "Try login/signup - they should fail"
echo ""

cd ../
npm run dev
