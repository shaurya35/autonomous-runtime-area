#!/bin/bash

# SRE-0016: Revert Memory Leak in Session Cache Failure
# This script reverts the memory leak by clearing environment

echo "========================================"
echo "SRE-0016: Reverting Memory Leak Cache"
echo "========================================"
echo ""

# Unset environment variables
unset FAILURE_INJECTION
unset FAILURE_SCENARIO
unset SESSION_CACHE_SIZE
unset FAILURE_DELAY_MS

echo "Environment variables cleared"
echo ""

echo "Starting backend with normal cache configuration..."
echo ""

cd ../
npm run dev
