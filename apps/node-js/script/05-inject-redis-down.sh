#!/bin/bash

# SRE-0019: Redis Circuit Breaker Failure Test
# This script injects a Redis service failure
# Result: Circuit breaker opens, favorites service returns 503

echo "========================================"
echo "SRE-0019: Injecting Redis Circuit Breaker"
echo "========================================"
echo ""

echo "Starting backend with Redis failure..."
echo "Expected behavior: Circuit breaker opens, returns 503"
echo "Circuit breaker will half-open after 30 seconds"
echo ""

# Set environment variables
export FAILURE_INJECTION="true"
export FAILURE_SCENARIO="redis-down"
export FAILURE_DELAY_MS="0"

echo "Environment variables set:"
echo "  FAILURE_INJECTION = $FAILURE_INJECTION"
echo "  FAILURE_SCENARIO = $FAILURE_SCENARIO"
echo ""

echo "Starting server..."
echo "Press Ctrl+C to stop"
echo "Try adding to favorites - request should fail with 503"
echo "Wait 30s and try again - circuit breaker will half-open"
echo ""

cd ../
npm run dev
