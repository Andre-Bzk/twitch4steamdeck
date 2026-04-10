#!/bin/bash
# build-flatpak.sh — Kompletter Build-Ablauf für das Twitch4SteamDeck Flatpak.
# Ausführen in WSL2 Ubuntu:  bash flatpak/build-flatpak.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"
echo "=== Arbeitsverzeichnis: $PROJECT_DIR ==="

# ─────────────────────────────────────────────────────────────────────────────
# WSL2-Dateisystem-Check: flatpak-builder kann nicht über /mnt/ (Windows 9P) bauen
# ─────────────────────────────────────────────────────────────────────────────
if [[ "$PROJECT_DIR" == /mnt/* ]]; then
  echo ""
  echo "FEHLER: Das Projekt liegt auf dem Windows-Dateisystem ($PROJECT_DIR)."
  echo "  flatpak-builder benötigt FUSE, das auf /mnt/ nicht funktioniert."
  echo ""
  echo "  Lösung: Projekt auf das Linux-Dateisystem kopieren und von dort bauen:"
  echo "    cp -rp /mnt/c/Projekte/twitch4steamdeck ~/twitch4steamdeck"
  echo "    cd ~/twitch4steamdeck"
  echo "    bash flatpak/build-flatpak.sh"
  echo ""
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# Schritt 1: Flatpak-Abhängigkeiten prüfen
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=== [1/6] Prüfe Flatpak-Voraussetzungen ==="
for cmd in flatpak flatpak-builder node npm python3 rsvg-convert; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "FEHLER: '$cmd' nicht gefunden."
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
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=== [2/6] Prüfe Flatpak-Runtimes ==="
RUNTIMES=(
  "org.freedesktop.Platform//24.08"
  "org.freedesktop.Sdk//24.08"
  "org.electronjs.Electron2.BaseApp//24.08"
)
for rt in "${RUNTIMES[@]}"; do
  if ! flatpak info --user "$rt" &>/dev/null 2>&1 && \
     ! flatpak info --system "$rt" &>/dev/null 2>&1; then
    echo "Installiere: $rt"
    flatpak install --user --noninteractive flathub "$rt"
  else
    echo "  ✓ $rt bereits vorhanden"
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# Schritt 3: .env prüfen
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=== [3/6] Prüfe .env (Twitch Client-ID) ==="
if [ ! -f .env ]; then
  echo "FEHLER: .env nicht gefunden."
  echo "  → Kopiere .env.example nach .env und trage MAIN_VITE_TWITCH_CLIENT_ID ein."
  exit 1
fi
if ! grep -q "MAIN_VITE_TWITCH_CLIENT_ID=" .env; then
  echo "FEHLER: MAIN_VITE_TWITCH_CLIENT_ID fehlt in .env"
  exit 1
fi
echo "  ✓ .env gefunden"

# ─────────────────────────────────────────────────────────────────────────────
# Schritt 4: npm install (Linux) + better-sqlite3 rebuild + Build
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=== [4/6] npm install (Linux-Binaries) + Rebuild native Modules ==="
npm install
echo "  → Rebuilde better-sqlite3 für Linux x64 ..."
npx @electron/rebuild --module-dir node_modules/better-sqlite3
echo "  → Build (electron-vite) ..."
npm run build

# Verifikation: better_sqlite3.node muss ELF/Linux sein
NATIVE_NODE="node_modules/better-sqlite3/build/Release/better_sqlite3.node"
if [ -f "$NATIVE_NODE" ]; then
  FILE_OUT=$(file "$NATIVE_NODE")
  echo "  native module: $FILE_OUT"
  if echo "$FILE_OUT" | grep -q "ELF"; then
    echo "  ✓ Linux ELF — korrekt"
  else
    echo "  WARNUNG: Datei ist kein Linux-ELF. Rebuild möglicherweise fehlgeschlagen."
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Schritt 5: Manifest-SHA256-Werte füllen (interaktiv)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=== [5/6] SHA256-Prüfsummen für Manifest-Sources ==="
echo ""

MPV_URL="https://github.com/mpv-player/mpv/archive/refs/tags/v0.38.0.tar.gz"
SL_URL="https://github.com/streamlink/streamlink/archive/refs/tags/6.11.0.tar.gz"
MANIFEST="flatpak/tv.twitch4steamdeck.App.yml"

MPV_ARCHIVE="/tmp/mpv-0.38.0.tar.gz"
SL_ARCHIVE="/tmp/streamlink-6.11.0.tar.gz"

echo "Lade mpv 0.38.0 ..."
curl -L --progress-bar -o "$MPV_ARCHIVE" "$MPV_URL"
MPV_SHA=$(sha256sum "$MPV_ARCHIVE" | awk '{print $1}')
echo "  mpv sha256: $MPV_SHA"

echo "Lade streamlink 6.11.0 ..."
curl -L --progress-bar -o "$SL_ARCHIVE" "$SL_URL"
SL_SHA=$(sha256sum "$SL_ARCHIVE" | awk '{print $1}')
echo "  streamlink sha256: $SL_SHA"

# Platzhalter im Manifest ersetzen
sed -i "s/FILL_IN_sha256sum_of_mpv_0\.38\.0_tarball/$MPV_SHA/" "$MANIFEST"
sed -i "s/FILL_IN_sha256sum_of_streamlink_tarball/$SL_SHA/" "$MANIFEST"
echo "  ✓ Manifest aktualisiert"

# ─────────────────────────────────────────────────────────────────────────────
# Schritt 6: flatpak-builder — Build + lokale Installation
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=== [6/6] flatpak-builder ==="
flatpak-builder \
  --user \
  --install \
  --force-clean \
  --disable-rofiles-fuse \
  build-dir \
  flatpak/tv.twitch4steamdeck.App.yml

echo ""
echo "======================================================"
echo "  Build abgeschlossen!"
echo "  Starten:  flatpak run tv.twitch4steamdeck.App"
echo ""
echo "  Für Steam Deck (Bundle erstellen):"
echo "    flatpak build-bundle ~/.local/share/flatpak/repo \\"
echo "      twitch4steamdeck.flatpak tv.twitch4steamdeck.App"
echo "    # Dann twitch4steamdeck.flatpak per USB/SSH auf Deck kopieren"
echo "    # Dort: flatpak install --user twitch4steamdeck.flatpak"
echo "======================================================"
