#!/bin/bash

# SRE-0008: Revert JWT Invalid Secret Failure
# This script reverts the JWT verification failure by clearing environment

echo "========================================"
echo "SRE-0008: Reverting JWT Invalid Secret"
echo "========================================"
echo ""

# Unset environment variables
unset FAILURE_INJECTION
unset FAILURE_SCENARIO
unset FAILURE_DELAY_MS

echo "Environment variables cleared"
echo ""

echo "Starting backend with normal JWT configuration..."
echo ""

cd ../
npm run dev
