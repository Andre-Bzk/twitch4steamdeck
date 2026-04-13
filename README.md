# Twitch4SteamDeck

Werbefreier Twitch-Client fuer das Steam Deck mit Big-Screen-UI, Gamepad-Steuerung und VOD-Wiedergabe mit Resume-Funktion.

## Features

- **Live-Streams** -- Wiedergabe ueber Streamlink + mpv, werbefrei
- **VOD-Wiedergabe** -- Aufnahmen ansehen mit automatischem Resume an der letzten Position
- **Gamepad-Steuerung** -- Volle Bedienung per Steam Deck Controller oder Xbox-Gamepad, auch im Gaming Mode (liest `/dev/input/js*` direkt, umgeht Chromium-Sandbox-Limitierungen)
- **Big-Screen-UI** -- 10-Foot-Interface optimiert fuer TV/Deck (React + Electron)
- **Twitch-Login** -- Device Code Flow mit QR-Code (kein Browser noetig)
- **Gefolgte Kanaele** -- Live-Status und Uebersicht der gefolgten Streamer
- **Kategorie-Browser** -- Twitch-Kategorien durchsuchen
- **VOD-Verlauf** -- Lokale SQLite-Datenbank mit Wiedergabe-Historie und Fortschritt
- **VAAPI Hardware-Decoding** -- GPU-beschleunigte Videowiedergabe auf dem Steam Deck

## Architektur

```
Electron (Main Process)
  ├── Auth          -- Twitch Device Code Flow + Token-Verwaltung (Electron safeStorage)
  ├── Helix Client  -- Twitch API (gefolgete Kanaele, Streams, VODs, Kategorien)
  ├── Playback      -- Streamlink (Live) / mpv (VODs) mit IPC-Steuerung
  ├── Gamepad       -- Linux joystick API (/dev/input/js*)
  └── History       -- SQLite (better-sqlite3) fuer VOD-Verlauf + Resume

Electron (Renderer)
  └── React UI      -- Screens: Login, Following, Browse, Channel, Settings
```

## Installation (Steam Deck)

```bash
flatpak install --user twitch4steamdeck.flatpak
flatpak run tv.twitch4steamdeck.App
```

Fertige Flatpak-Bundles enthalten alles (inkl. mpv, Streamlink und Twitch-Anbindung) -- keine weitere Einrichtung noetig.

---

## Selbst bauen (Entwickler)

### Voraussetzungen

- [Node.js](https://nodejs.org/) >= 20
- npm
- Fuer Flatpak-Build: WSL2 (Ubuntu) mit `flatpak`, `flatpak-builder`, `librsvg2-bin`

### Einrichtung

1. Repository klonen:
   ```bash
   git clone https://github.com/<user>/twitch4steamdeck.git
   cd twitch4steamdeck
   ```

2. Eigene Twitch-App registrieren auf https://dev.twitch.tv/console/apps:
   - **OAuth Redirect URLs:** `http://localhost`
   - **Client Type:** Public

3. `.env` anlegen:
   ```bash
   cp .env.example .env
   ```
   Die Client-ID aus Schritt 2 in `.env` eintragen:
   ```
   MAIN_VITE_TWITCH_CLIENT_ID=deine_client_id_hier
   ```

   > Die Client-ID wird beim Build in die App eingebettet. Endnutzer, die ein fertiges Flatpak installieren, brauchen keine eigene Twitch-App zu registrieren.

4. Abhaengigkeiten installieren:
   ```bash
   npm install
   ```

### Entwicklung

```bash
npm run dev
```

Startet Electron mit Hot-Reload (electron-vite).

## Build

### Desktop (AppImage)

```bash
npm run package
```

Erzeugt ein Linux-AppImage unter `dist/`.

### Flatpak (Steam Deck)

Der Flatpak-Build muss in WSL2 auf dem Linux-Dateisystem ausgefuehrt werden (nicht unter `/mnt/`):

```bash
# Projekt auf Linux-Dateisystem kopieren
cp -rp /mnt/c/Projekte/twitch4steamdeck ~/twitch4steamdeck
cd ~/twitch4steamdeck

# Kompletten Build ausfuehren (inkl. mpv, streamlink, Electron)
bash flatpak/build-flatpak.sh
```

Das Script erledigt automatisch:
1. Flatpak-Runtimes installieren (freedesktop SDK 24.08, Electron2 BaseApp)
2. npm install + native Module rebuilden (better-sqlite3 fuer Linux x64)
3. electron-vite Build
4. Streamlink Python-Deps generieren
5. flatpak-builder ausfuehren (baut mpv 0.41.0, libass, libplacebo, Lua 5.2 mit)
6. Flatpak-Bundle erstellen und per SCP aufs Steam Deck uebertragen

## Gamepad-Belegung

| Taste | Funktion |
|-------|----------|
| A | Bestaetigen / Auswaehlen |
| B | Zurueck |
| D-Pad | Navigation |
| Left Stick | Navigation |
| LB / RB | Tab wechseln |
| R2 | Vorspulen (VODs) |
| L2 | Zurueckspulen (VODs) |

## Sicherheit

- **Twitch-Tokens** werden verschluesselt im OS-Keystore gespeichert (Electron `safeStorage`) und landen weder im Build noch im Repository
- **Client-ID** ist eine oeffentliche Kennung (Public App) und kein Geheimnis
- `.env`, `out/`, `dist/` und `userData/` sind in `.gitignore` ausgeschlossen

## Tech-Stack

| Komponente | Technologie |
|-----------|-------------|
| Framework | Electron 33 + electron-vite |
| UI | React 18 + TypeScript |
| Video (Live) | Streamlink + mpv |
| Video (VOD) | mpv (direkt, IPC-gesteuert) |
| Datenbank | better-sqlite3 |
| Gamepad | Linux joystick API (`/dev/input/js*`) |
| Packaging | Flatpak / electron-builder (AppImage) |
| HW-Decoding | VAAPI (via mpv + ffmpeg-full Extension) |

## Lizenz

