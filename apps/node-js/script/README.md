#!/bin/bash
# ========================================
# Error Injection Scripts - Quick Start
# ========================================
#
# This folder contains cross-platform shell scripts for testing error scenarios
# Compatible with: Linux, macOS, and Windows (via WSL or Git Bash)
#
# SCRIPTS:
# ========================================
# 1. ./01-inject-jwt-invalid.sh          - JWT verification failure
# 2. ./02-inject-debug-prod.sh           - Debug logging in production
# 3. ./03-inject-wrong-db.sh             - Wrong database connection
# 4. ./04-inject-memory-leak.sh          - Memory leak in cache
# 5. ./05-inject-redis-down.sh           - Redis circuit breaker failure
#
# REVERT SCRIPTS:
# ========================================
# 1. ./01-revert-jwt-invalid.sh          - Revert JWT failure
# 2. ./02-revert-debug-prod.sh           - Revert debug logging
# 3. ./03-revert-wrong-db.sh             - Revert database failure
# 4. ./04-revert-memory-leak.sh          - Revert memory leak
# 5. ./05-revert-redis-down.sh           - Revert Redis failure
#
# HOW TO RUN:
# ========================================
# 1. Make scripts executable (first time only):
#    chmod +x *.sh
#
# 2. Run an injection script from this directory:
#    ./01-inject-jwt-invalid.sh
#
# 3. Test the failure scenario in your application
#
# 4. Stop the server with Ctrl+C
#
# 5. Run the corresponding revert script to restore normal behavior:
#    ./01-revert-jwt-invalid.sh
#
# EXAMPLE WORKFLOW:
# ========================================
# chmod +x *.sh
# ./01-inject-jwt-invalid.sh
# # Test JWT failure scenarios...
# # Press Ctrl+C to stop
# ./01-revert-jwt-invalid.sh
# # Backend runs normally again
#
# ========================================
