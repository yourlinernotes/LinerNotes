#!/bin/bash

# LinerNotes Setup and Test Script
# Run from project root: chmod +x scripts/setup-and-test.sh && ./scripts/setup-and-test.sh

set -e

echo "🎵 LinerNotes - Setup and Test Script"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env.local exists
if [ ! -f .env.local ]; then
  echo -e "${RED}✗ .env.local not found!${NC}"
  echo ""
  echo "Creating .env.local template..."
  cat > .env.local <<EOF
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<run: openssl rand -base64 32>

# Google OAuth (see GOOGLE_OAUTH_SETUP.md)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/linernotes

# Spotify (optional - for music connector)
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/connect/spotify/callback

# Last.fm (optional - for music connector)
LASTFM_API_KEY=your-lastfm-api-key
LASTFM_API_SECRET=your-lastfm-api-secret
EOF
  echo -e "${YELLOW}✓ Created .env.local template${NC}"
  echo ""
  echo "Please fill in the values in .env.local:"
  echo "1. Generate NEXTAUTH_SECRET: openssl rand -base64 32"
  echo "2. Get Google OAuth credentials (see GOOGLE_OAUTH_SETUP.md)"
  echo "3. Add your DATABASE_URL"
  echo ""
  exit 1
fi

echo "✓ .env.local found"
echo ""

# Check if NEXTAUTH_SECRET is set
if grep -q "NEXTAUTH_SECRET=<run:" .env.local; then
  echo -e "${YELLOW}⚠  NEXTAUTH_SECRET not set!${NC}"
  echo ""
  echo "Generating NEXTAUTH_SECRET..."
  SECRET=$(openssl rand -base64 32)
  sed -i '' "s|NEXTAUTH_SECRET=<run: openssl rand -base64 32>|NEXTAUTH_SECRET=$SECRET|" .env.local
  echo -e "${GREEN}✓ Generated NEXTAUTH_SECRET${NC}"
  echo ""
fi

# Check for Google credentials
if grep -q "GOOGLE_CLIENT_ID=your-client-id" .env.local; then
  echo -e "${YELLOW}⚠  Google OAuth not configured${NC}"
  echo "Please set up Google OAuth credentials (see GOOGLE_OAUTH_SETUP.md)"
  echo ""
fi

# Check for DATABASE_URL
if grep -q "DATABASE_URL=postgresql://user:password" .env.local; then
  echo -e "${YELLOW}⚠  DATABASE_URL not configured${NC}"
  echo "Please set your Railway PostgreSQL connection string"
  echo ""
fi

echo "📦 Installing dependencies..."
npm install

echo ""
echo "🗄️  Running Prisma setup..."

# Generate Prisma client
npx prisma generate

echo ""
echo -e "${YELLOW}⚠  Database migration required${NC}"
echo "Run manually when database is ready:"
echo "  npx prisma migrate dev --name add_nextauth_models"
echo ""

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Follow GOOGLE_OAUTH_SETUP.md to get Google credentials"
echo "2. Update .env.local with Google OAuth credentials"
echo "3. Run: npx prisma migrate dev --name add_nextauth_models"
echo "4. Run: npm run dev"
echo "5. Visit: http://localhost:3000/login"
echo ""
echo "📚 Documentation:"
echo "  - GOOGLE_OAUTH_SETUP.md - Google OAuth setup"
echo "  - AUTH_MIGRATION_GUIDE.md - Complete auth migration guide"
echo "  - API_ROUTES_UPDATE_CHECKLIST.md - API routes status"
echo "  - CLAUDE_DESIGN_CONTEXT.md - For designing in Claude Design"
echo ""
