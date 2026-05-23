#!/bin/bash

# SRE-0012: Revert Wrong Database Name Failure
# This script reverts the wrong database connection by clearing environment

echo "========================================"
echo "SRE-0012: Reverting Wrong Database Name"
echo "========================================"
echo ""

# Unset environment variables
unset FAILURE_INJECTION
unset FAILURE_SCENARIO
unset FAILURE_DELAY_MS

echo "Environment variables cleared"
echo ""

echo "Starting backend with correct database configuration..."
echo ""

cd ../
npm run dev
