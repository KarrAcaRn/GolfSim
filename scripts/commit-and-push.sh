#!/bin/bash
# Auto-commit and push script for GolfSim
# Usage: ./scripts/commit-and-push.sh "Commit message"

set -e

cd "$(dirname "$0")/.."

MESSAGE="${1:-Auto-commit: update GolfSim}"

# Type-check before committing
echo ">> Type-checking..."
npx tsc --noEmit

# Stage all changes (except node_modules, dist)
echo ">> Staging changes..."
git add -A

# Check if there are changes to commit
if git diff --cached --quiet; then
  echo ">> No changes to commit."
  exit 0
fi

# Commit
echo ">> Committing: $MESSAGE"
git commit -m "$MESSAGE

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

# Push
echo ">> Pushing to origin/main..."
git push origin main

echo ">> Done!"
