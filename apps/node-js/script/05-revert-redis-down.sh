#!/bin/bash

# SRE-0019: Revert Redis Circuit Breaker Failure
# This script reverts the Redis failure by clearing environment

echo "========================================"
echo "SRE-0019: Reverting Redis Circuit Breaker"
echo "========================================"
echo ""

# Unset environment variables
unset FAILURE_INJECTION
unset FAILURE_SCENARIO
unset FAILURE_DELAY_MS

echo "Environment variables cleared"
echo ""

echo "Starting backend with normal Redis configuration..."
echo ""

cd ../
npm run dev
