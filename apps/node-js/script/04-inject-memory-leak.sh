#!/bin/bash

# SRE-0016: Memory Leak in Session Cache Failure Test
# This script injects a memory leak by disabling cache eviction
# Result: Session cache grows unbounded, simulating memory leak

echo "========================================"
echo "SRE-0016: Injecting Memory Leak Cache"
echo "========================================"
echo ""

echo "Starting backend with memory leak cache..."
echo "Expected behavior: Cache grows unbounded, memory usage increases"
echo "Normal cache size limit: SESSION_CACHE_SIZE=100"
echo "Broken behavior: No eviction, cache grows forever"
echo ""

# Set environment variables
export FAILURE_INJECTION="true"
export FAILURE_SCENARIO="memory-leak-cache"
export SESSION_CACHE_SIZE="100"
export FAILURE_DELAY_MS="0"

echo "Environment variables set:"
echo "  FAILURE_INJECTION = $FAILURE_INJECTION"
echo "  FAILURE_SCENARIO = $FAILURE_SCENARIO"
echo "  SESSION_CACHE_SIZE = $SESSION_CACHE_SIZE"
echo ""

echo "Starting server..."
echo "Press Ctrl+C to stop"
echo "Monitor memory usage with: ps aux | grep node"
echo ""

cd ../
npm run dev
