#!/bin/bash
# Launcher für Twitch4SteamDeck im Flatpak.
# zypak-wrapper ersetzt den Chrome-Sandbox-Helper (setuid) durch eine
# Flatpak-kompatible Lösung — Pflicht für Electron in Flatpak-Sandboxes.
exec zypak-wrapper \
  /app/lib/twitch4steamdeck/node_modules/electron/dist/electron \
  /app/lib/twitch4steamdeck/out/main/index.js \
  "$@"
