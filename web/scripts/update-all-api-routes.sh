#!/bin/bash

# Script to update all API routes from iron-session to NextAuth
# Run from project root: chmod +x scripts/update-all-api-routes.sh && ./scripts/update-all-api-routes.sh

set -e

echo "Updating all API routes to use NextAuth..."

# Function to replace iron-session imports with NextAuth
update_route() {
  local file=$1
  echo "Updating $file..."

  # Create backup
  cp "$file" "$file.backup"

  # Replace imports
  sed -i '' 's/import { getIronSession } from "iron-session";/import { requireAuth, getSession } from "@\/lib\/auth-helpers";/g' "$file"
  sed -i '' '/import { sessionOptions, SessionData } from "@\/lib\/session";/d' "$file"
  sed -i '' '/import { cookies } from "next\/headers";/d' "$file"

  # Replace session retrieval pattern
  sed -i '' '/const cookieStore = await cookies();/d' "$file"
  sed -i '' 's/const session = await getIronSession<SessionData>(cookieStore, sessionOptions);/const user = await requireAuth();/g' "$file"

  # Replace session.userId with user.id
  sed -i '' 's/session\.userId/user.id/g' "$file"

  # Update error handling
  sed -i '' 's/if (!session\.userId) {/try {/g' "$file"
  sed -i '' 's/return NextResponse\.json({ error: "Unauthorized" }, { status: 401 });/const user = await requireAuth();/g' "$file"

  echo "✓ Updated $file"
}

# List of routes to update (you can add more here)
routes=(
  "app/api/friends/[userId]/route.ts"
  "app/api/reviews/[id]/route.ts"
  "app/api/reviews/[id]/like/route.ts"
  "app/api/reviews/[id]/repost/route.ts"
  "app/api/album-reviews/route.ts"
  "app/api/album-reviews/[id]/route.ts"
  "app/api/album-reviews/[id]/like/route.ts"
  "app/api/album-reviews/[id]/repost/route.ts"
)

for route in "${routes[@]}"; do
  if [ -f "$route" ]; then
    update_route "$route"
  else
    echo "⚠ File not found: $route"
  fi
done

echo ""
echo "✅ All routes updated!"
echo ""
echo "NOTE: This is a basic automated update. You should:"
echo "1. Review each file for accuracy"
echo "2. Test the API routes"
echo "3. Delete .backup files once verified"
