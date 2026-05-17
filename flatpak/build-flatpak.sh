#!/bin/bash
# build-flatpak.sh — Kompletter Build-Ablauf für das Twitch4SteamDeck Flatpak.
# build-flatpak.sh — Complete build flow for the Twitch4SteamDeck Flatpak.
# Ausführen in WSL2 Ubuntu:  bash flatpak/build-flatpak.sh
# Run in WSL2 Ubuntu: bash flatpak/build-flatpak.sh
set -e


# ─────────────────────────────────────────────────────────────────────────────
# Schritt 0: Projektdateien vom Windows-Dateisystem in WSL2 synchronisieren
# Step 0: sync project files from the Windows filesystem into WSL2
# ─────────────────────────────────────────────────────────────────────────────
WIN_PROJECT="/mnt/c/Projekte/twitch4steamdeck"
WSL_PROJECT="$HOME/twitch4steamdeck"

echo "=== Syncing $WIN_PROJECT -> $WSL_PROJECT ==="
rsync -a --delete \
  --exclude=node_modules/ \
  --exclude=out/ \
  --exclude=dist/ \
  --exclude=build-dir/ \
  --exclude='*.flatpak' \
  "$WIN_PROJECT/" "$WSL_PROJECT/"
echo "  ✓ Sync completed"

cd "$WSL_PROJECT"
echo "=== Working directory: $WSL_PROJECT ==="

# ─────────────────────────────────────────────────────────────────────────────
# WSL2-Dateisystem-Check: flatpak-builder kann nicht über /mnt/ (Windows 9P) bauen
# WSL2 filesystem check: flatpak-builder cannot build through /mnt/ (Windows 9P)
# ─────────────────────────────────────────────────────────────────────────────
if [[ "$WSL_PROJECT" == /mnt/* ]]; then
  echo ""
  echo "ERROR: WSL_PROJECT points to the Windows filesystem ($WSL_PROJECT)."
  echo "  flatpak-builder requires FUSE, which does not work on /mnt/."
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# Schritt 1: Flatpak-Abhängigkeiten prüfen
# Step 1: verify Flatpak dependencies
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=== [1/5] Checking Flatpak prerequisites ==="
for cmd in flatpak flatpak-builder node npm python3 rsvg-convert; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: '$cmd' not found."
    case "$cmd" in
      flatpak|flatpak-builder) echo "  → sudo apt install flatpak flatpak-builder" ;;
      node|npm) echo "  → curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install nodejs" ;;
      rsvg-convert) echo "  → sudo apt install librsvg2-bin" ;;
    esac
    exit 1
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# Schritt 2: Flatpak-Runtimes prüfen / installieren
# Step 2: verify / install Flatpak runtimes
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=== [2/5] Checking Flatpak runtimes ==="
RUNTIMES=(
  "org.freedesktop.Platform//24.08"
  "org.freedesktop.Sdk//24.08"
  "org.electronjs.Electron2.BaseApp//24.08"
)
for rt in "${RUNTIMES[@]}"; do
  if ! flatpak info --user "$rt" &>/dev/null 2>&1 && \
     ! flatpak info --system "$rt" &>/dev/null 2>&1; then
    echo "Installing: $rt"
    flatpak install --user --noninteractive flathub "$rt"
  else
    echo "  ✓ $rt already installed"
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# Schritt 3: .env prüfen
# Step 3: verify .env
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=== [3/5] Checking .env (Twitch client ID) ==="
if [ ! -f .env ]; then
  echo "ERROR: .env not found."
  echo "  → Copy .env.example to .env and add MAIN_VITE_TWITCH_CLIENT_ID."
  exit 1
fi
if ! grep -q "MAIN_VITE_TWITCH_CLIENT_ID=" .env; then
  echo "ERROR: MAIN_VITE_TWITCH_CLIENT_ID is missing in .env"
  exit 1
fi
echo "  ✓ .env found"

# ─────────────────────────────────────────────────────────────────────────────
# Schritt 4: npm install (Linux) + better-sqlite3 rebuild + Build
# Step 4: npm install (Linux) + better-sqlite3 rebuild + build
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=== [4/5] npm install (Linux binaries) + rebuild native modules ==="
npm install
echo "  → Rebuilding better-sqlite3 for Linux x64 ..."
npx @electron/rebuild --module-dir node_modules/better-sqlite3
echo "  → Running build (electron-vite) ..."
npm run build

# Verifikation: better_sqlite3.node muss ELF/Linux sein
# Verification: better_sqlite3.node must be ELF/Linux
NATIVE_NODE="node_modules/better-sqlite3/build/Release/better_sqlite3.node"
if [ -f "$NATIVE_NODE" ]; then
  FILE_OUT=$(file "$NATIVE_NODE")
  echo "  Native module: $FILE_OUT"
  if echo "$FILE_OUT" | grep -q "ELF"; then
    echo "  ✓ Linux ELF - correct"
  else
    echo "  WARNING: File is not a Linux ELF. Rebuild may have failed."
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Schritt 4b: Python-Deps für streamlink via flatpak-pip-generator
# Step 4b: generate Python dependencies for streamlink via flatpak-pip-generator
# Erzeugt flatpak/python3-streamlink.json mit allen pip-Deps + sha256-Hashes.
# Generates flatpak/python3-streamlink.json with all pip dependencies + sha256 hashes.
# Die Datei wird von tv.twitch4steamdeck.App.yml per !include eingebunden.
# The file is included by tv.twitch4steamdeck.App.yml via !include.
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=== [4b] Generating Python dependencies for streamlink ==="
if ! python3 -c "import flatpak_pip_generator" &>/dev/null; then
  echo "  → Installing flatpak-pip-generator ..."
  # Ubuntu 24.04: externally-managed-environment → --break-system-packages nötig
  # Ubuntu 24.04: externally-managed-environment -> requires --break-system-packages
  pip3 install --quiet --break-system-packages flatpak-pip-generator
fi
python3 -m flatpak_pip_generator \
  streamlink==6.11.0 \
  --output flatpak/python3-streamlink
echo "  ✓ Generated flatpak/python3-streamlink.json ($(wc -l < flatpak/python3-streamlink.json) lines)"

# ─────────────────────────────────────────────────────────────────────────────
# Schritt 5: flatpak-builder — Build + lokale Installation
# Step 5: flatpak-builder - build + local install
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=== [5/5] flatpak-builder ==="
flatpak-builder \
  --user \
  --install \
  --force-clean \
  --disable-rofiles-fuse \
  build-dir \
  flatpak/tv.twitch4steamdeck.App.yml

echo ""
echo "======================================================"
echo "  Build completed!"
echo "  Run:  flatpak run tv.twitch4steamdeck.App"
echo ""
echo "  For Steam Deck (create bundle):"
echo "    flatpak build-bundle ~/.local/share/flatpak/repo \\"
echo "      twitch4steamdeck.flatpak tv.twitch4steamdeck.App"
echo "    # Then copy twitch4steamdeck.flatpak to the Deck via USB/SSH"
echo "    # There: flatpak install --user twitch4steamdeck.flatpak"
echo "======================================================"
echo "=== flatpak build-bundle  ==="
flatpak build-bundle ~/.local/share/flatpak/repo twitch4steamdeck.flatpak tv.twitch4steamdeck.App
echo "=== Copying bundle to Steam Deck ==="
scp twitch4steamdeck.flatpak steamdeck:/home/deck/
