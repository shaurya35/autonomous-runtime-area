#!/bin/bash

# SRE-0011: Debug Logging in Production Failure Test
# This script injects DEBUG level logging, exposing sensitive information
# Result: All requests logged with stack traces and internal details

echo "========================================"
echo "SRE-0011: Injecting DEBUG Prod Logging"
echo "========================================"
echo ""

echo "Starting backend with DEBUG logging..."
echo "Expected behavior: All requests logged with detailed information"
echo "Log location: backend/failure-logs/combined.log"
echo ""

# Set environment variables
export FAILURE_INJECTION="true"
export FAILURE_SCENARIO="debug-prod"
export LOG_LEVEL="debug"
export FAILURE_DELAY_MS="0"

echo "Environment variables set:"
echo "  FAILURE_INJECTION = $FAILURE_INJECTION"
echo "  FAILURE_SCENARIO = $FAILURE_SCENARIO"
echo "  LOG_LEVEL = $LOG_LEVEL"
echo ""

echo "Starting server..."
echo "Press Ctrl+C to stop"
echo "Logs will be written to: backend/failure-logs/combined.log"
echo ""

cd ../
npm run dev
