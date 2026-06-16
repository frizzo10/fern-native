#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Fern Native — One-command setup
# Run this once after cloning the repo:
#   bash setup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

FOREST="\033[0;32m"
ORANGE="\033[0;33m"
RED="\033[0;31m"
BOLD="\033[1m"
RESET="\033[0m"

echo ""
echo "${BOLD}${FOREST}🌿 Fern Native — Setup${RESET}"
echo "────────────────────────────────"

# ── 1. Check for Node ────────────────────────────────────────────────────────
echo ""
echo "${BOLD}Checking Node.js...${RESET}"
if ! command -v node &>/dev/null; then
  echo "${ORANGE}Node.js not found. Installing via Homebrew...${RESET}"
  if ! command -v brew &>/dev/null; then
    echo "${BOLD}Installing Homebrew first...${RESET}"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  fi
  brew install node
else
  NODE_VER=$(node --version)
  echo "${FOREST}✅ Node.js found: $NODE_VER${RESET}"
fi

# ── 2. Install Expo CLI + EAS CLI ────────────────────────────────────────────
echo ""
echo "${BOLD}Installing Expo CLI and EAS CLI...${RESET}"
npm install -g expo-cli eas-cli 2>/dev/null || true
echo "${FOREST}✅ Expo CLI + EAS CLI installed${RESET}"

# ── 3. Install project dependencies ─────────────────────────────────────────
echo ""
echo "${BOLD}Installing project dependencies...${RESET}"
npm install
echo "${FOREST}✅ Dependencies installed${RESET}"

# ── 4. Create .env if it doesn't exist ──────────────────────────────────────
echo ""
echo "${BOLD}Setting up .env file...${RESET}"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "${FOREST}✅ .env file created from template${RESET}"

  # Pre-fill the Supabase keys (safe — anon key is public)
  sed -i '' \
    's|EXPO_PUBLIC_SUPABASE_URL=.*|EXPO_PUBLIC_SUPABASE_URL=https://axqkdhzcfcroxlkducea.supabase.co|' \
    .env 2>/dev/null || \
  sed -i \
    's|EXPO_PUBLIC_SUPABASE_URL=.*|EXPO_PUBLIC_SUPABASE_URL=https://axqkdhzcfcroxlkducea.supabase.co|' \
    .env

  sed -i '' \
    's|EXPO_PUBLIC_SUPABASE_ANON_KEY=.*|EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4cWtkaHpjZmNyb3hsa2R1Y2VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NzU5OTUsImV4cCI6MjA4ODI1MTk5NX0.4gl0rnBx8s7RN33VDXhLM3PN5hoIzAfgQGIq2L2hZfs|' \
    .env 2>/dev/null || \
  sed -i \
    's|EXPO_PUBLIC_SUPABASE_ANON_KEY=.*|EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4cWtkaHpjZmNyb3hsa2R1Y2VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NzU5OTUsImV4cCI6MjA4ODI1MTk5NX0.4gl0rnBx8s7RN33VDXhLM3PN5hoIzAfgQGIq2L2hZfs|' \
    .env

  echo "${FOREST}✅ Supabase keys pre-filled${RESET}"
else
  echo "${FOREST}✅ .env already exists — skipping${RESET}"
fi

# ── 5. Check for Groq key ────────────────────────────────────────────────────
echo ""
GROQ_KEY=$(grep EXPO_PUBLIC_GROQ_KEY .env | cut -d'=' -f2)
if [ -z "$GROQ_KEY" ] || [ "$GROQ_KEY" = "your_groq_key_here" ]; then
  echo "${ORANGE}⚠️  Groq API key missing.${RESET}"
  echo "   Get one free at: ${BOLD}console.groq.com${RESET} → API Keys → Create"
  echo "   Then add to .env:  EXPO_PUBLIC_GROQ_KEY=gsk_your_key_here"
else
  echo "${FOREST}✅ Groq key found${RESET}"
fi

# ── 6. Done ──────────────────────────────────────────────────────────────────
echo ""
echo "────────────────────────────────"
echo "${BOLD}${FOREST}✅ Setup complete!${RESET}"
echo ""
echo "Next steps:"
echo ""
echo "  ${BOLD}Preview the app (instant, no build):${RESET}"
echo "  npx expo start"
echo "  → Scan the QR code with Expo Go on your phone"
echo ""
echo "  ${BOLD}Build iOS .ipa for Frank:${RESET}"
echo "  eas build --platform ios --profile preview"
echo ""
echo "  ${BOLD}Build Android .apk for Frank:${RESET}"
echo "  eas build --platform android --profile preview"
echo ""
echo "  ${BOLD}Build both at once:${RESET}"
echo "  eas build --platform all --profile preview

  [1mSend an update (after first build, no reinstall):[0m
  eas update --branch production --message "What changed""
echo ""
echo "${FOREST}Repo: github.com/frizzo10/fern-native${RESET}"
echo "${FOREST}Web:  app.clickpickandcook.com${RESET}"
echo ""
