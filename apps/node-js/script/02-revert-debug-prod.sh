#!/bin/bash

# SRE-0011: Revert Debug Logging in Production Failure
# This script reverts DEBUG logging by clearing environment

echo "========================================"
echo "SRE-0011: Reverting DEBUG Prod Logging"
echo "========================================"
echo ""

# Unset environment variables
unset FAILURE_INJECTION
unset FAILURE_SCENARIO
unset LOG_LEVEL
unset FAILURE_DELAY_MS

echo "Environment variables cleared"
echo ""

echo "Starting backend with normal logging configuration..."
echo ""

cd ../
npm run dev
