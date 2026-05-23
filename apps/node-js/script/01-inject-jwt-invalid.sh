#!/bin/bash

# SRE-0008: JWT Invalid Secret Failure Test
# This script injects a JWT verification failure by using an invalid JWT secret
# Result: All protected API endpoints will return 401 Unauthorized

echo "========================================"
echo "SRE-0008: Injecting JWT Invalid Secret"
echo "========================================"
echo ""

echo "Starting backend with invalid JWT secret..."
echo "Expected behavior: Login works but protected endpoints fail"
echo ""

# Set environment variables
export FAILURE_INJECTION="true"
export FAILURE_SCENARIO="jwt-invalid"
export FAILURE_DELAY_MS="0"

echo "Environment variables set:"
echo "  FAILURE_INJECTION = $FAILURE_INJECTION"
echo "  FAILURE_SCENARIO = $FAILURE_SCENARIO"
echo ""

echo "Starting server..."
echo "Press Ctrl+C to stop"
echo ""

cd ../
npm run dev
