#!/bin/bash
# Launcher für Twitch4SteamDeck im Flatpak.
# Launcher for Twitch4SteamDeck inside Flatpak.
# zypak-wrapper ersetzt den Chrome-Sandbox-Helper (setuid) durch eine
# zypak-wrapper replaces the Chrome sandbox helper (setuid) with a
# Flatpak-kompatible Lösung — Pflicht für Electron in Flatpak-Sandboxes.
# Flatpak-compatible solution - required for Electron in Flatpak sandboxes.
exec zypak-wrapper \
  /app/lib/twitch4steamdeck/node_modules/electron/dist/electron \
  /app/lib/twitch4steamdeck/out/main/index.js \
  "$@"
