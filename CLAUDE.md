# Twitch4SteamDeck — CLAUDE.md

Ad-freier Twitch-Client für das Steam Deck. Electron + React, gamepad-navigierbar, Big-Screen-UI (auf Linux/Steam Deck: Fenster maximiert auf Primärdisplay; im Windows-Dev: 1280x800). Unterstützt Live-Streams und VODs mit Resume und Kapitelwahl. Deployment als Flatpak auf dem Steam Deck.

---

## Tech-Stack

| Schicht | Technologie |
|---|---|
| Framework | Electron 33, electron-vite, React 18, TypeScript 5.5 |
| Playback | mpv 0.41.0 (direkt gespawnt), Streamlink 6.11.0 im Flatpak-Build / 8.2.1 im aktuellen Windows-Dev-Setup |
| DB | better-sqlite3 (VOD-Verlauf + Resume-Positionen) |
| Packaging | Flatpak (freedesktop SDK 24.08, Electron2 BaseApp) |
| Build-Host | Windows, Flatpak-Build läuft in WSL2 |
| Target | Steam Deck (Linux x86_64, Gaming Mode) |

---

## Architektur

```
Electron Main Process
├── AuthService          — Twitch Device Code Flow, Token-Verwaltung (safeStorage)
├── HelixClient          — Twitch Helix REST API + GQL (Kapitel)
├── PlaybackService      — Live-/VOD-Orchestrierung
│   ├── streamlink.ts    — Prozess-Spawning (Streamlink + mpv)
│   ├── MpvController    — mpv JSON-IPC (Unix-Socket / Named Pipe)
│   └── hlsTrimmer.ts    — Lokale HLS-Snapshots für Live-VODs + fMP4-Seek-Workaround
├── historyRepo          — SQLite VOD-Verlauf (Resume, Completed)
└── gamepadReader        — Linux /dev/input/js* Joystick-Leser

Preload (contextBridge)
└── window.t4sd          — Typisierte IPC-Bridge (auth, twitch, history, playback, gamepad)

Renderer (React)
├── App.tsx              — Auth-Gate: LoginScreen | AppShell
├── AppShell.tsx         — Tab-Routing, Sidebar/Main-Fokus
├── screens/             — FollowingScreen, BrowseScreen, CategoryScreen,
│                          ChannelScreen (Hauptscreen), StreamListScreen, Settings, Account
├── input/gamepad.ts     — Browser Gamepad API (Windows, Dev-Mode)
└── context/SettingsContext.tsx — localStorage-Settings (streamBadgeMode, sidebarWidth, …)
```

### Datenfluss

- **Auth:** LoginScreen → IPC → AuthService → Device Code Flow → Token (safeStorage)
- **Browsing:** Screen → IPC → HelixClient → Twitch Helix API → Screen
- **Live-Playback:** ChannelScreen → IPC → PlaybackService → `spawnStreamlink()` (startet mpv intern)
- **VOD-Playback:** ChannelScreen → IPC → PlaybackService → `getStreamUrl()` → Playlist-Inspektion (`fMP4`, `EVENT`, `ENDLIST`) → optional lokaler Snapshot (`hlsTrimmer.ts`) → `spawnMpv()` + MpvController-IPC
- **Gamepad:** `/dev/input/js*` (Linux/Gaming-Mode) **oder** `navigator.getGamepads()` (Windows/Dev) → synthetische `KeyboardEvent`s → alle Screen-Handler reagieren auf Keys

---

## Entwicklung

### Voraussetzungen
- Node.js, npm
- `.env` mit `MAIN_VITE_TWITCH_CLIENT_ID=<deine-client-id>` (Twitch Application, Public, Device Code Flow)
- Windows: mpv unter `C:\Program Files\MPV Player\mpv.exe`, Streamlink unter `%LOCALAPPDATA%\Programs\Streamlink\bin\streamlink.exe`

### Build-Befehle

```bash
npm install          # Dependencies installieren
npm run dev          # Electron Dev-Server mit Hot-Reload starten
npm run build        # Produktions-Build (out/)
npm run typecheck    # TypeScript prüfen (npx tsc --noEmit)
npm run package      # Linux AppImage bauen (dist/)
```

### Flatpak-Build (WSL2)
Muss aus dem WSL2-Dateisystem (NICHT `/mnt/`) laufen:
```bash
bash flatpak/build-flatpak.sh
```
Das Skript: prüft deps → npm-Build → Python-Deps generieren → mpv/Streamlink-Tarballs hashen → `flatpak-builder` → SCP zum Steam Deck.

---

## Codebase-Struktur

```
src/main/
  index.ts                    — Electron-Einstiegspunkt, Service-Wiring, Window (Linux: maximiert auf Primärdisplay; Windows: 1280x800)
  env.d.ts                    — Typ für MAIN_VITE_TWITCH_CLIENT_ID
  auth/
    authService.ts            — Auth-Lifecycle, Token-Refresh, Event-Emitter
    deviceCodeFlow.ts         — OAuth Device Code + Polling (https://id.twitch.tv/oauth2/)
    tokenStore.ts             — safeStorage-Verschlüsselung, Fallback auf plaintext
  input/
    gamepadReader.ts          — /dev/input/js* Leser, Hotplug (3s-Scan), Deduplizierung (40ms)
  ipc/
    handlers.ts               — Alle ipcMain.handle()-Registrierungen
  playback/
    playbackService.ts        — Zentraler Orchestrator (startLive, startVod, seek, stop)
    mpvController.ts          — mpv JSON-IPC-Client (Socket-Verbindung, Property-Observer)
    streamlink.ts             — Streamlink/mpv Prozess-Spawning, Pfad-Auflösung
    hlsTrimmer.ts             — HLS-Playlist-Parser, lokaler HTTP-Server für Snapshot-/Trim-Playlists
    types.ts                  — Quality-Typ, PlaybackEvent
  store/
    db.ts                     — SQLite-Init, WAL-Modus, Migration (vod_history-Tabelle)
    historyRepo.ts            — upsertVod, updatePosition, markCompleted, getProgressMap
  twitch/
    helixClient.ts            — Helix-API (followed, streams, videos, games) + GQL (Kapitel)
    types.ts                  — Helix-Typen + vereinfachte Renderer-Typen

src/preload/
  index.ts                    — contextBridge: window.t4sd (auth, twitch, history, playback, gamepad)

src/renderer/src/
  App.tsx                     — Auth-Gate, Gamepad-Init
  main.tsx                    — React-DOM-Bootstrap, SettingsProvider
  screens/
    AppShell.tsx              — Tab-Routing, Sidebar/Main-Fokus-Split
    LoginScreen.tsx           — Device-Code-Login, QR-Code, Countdown
    FollowingScreen.tsx       — Gefolgte Kanäle (Grid), Live/Offline-Sort
    BrowseScreen.tsx          — Top-Streams-Shelf + Kategorien-Grid (Infinite Scroll)
    CategoryScreen.tsx        — Streams einer Kategorie
    ChannelScreen.tsx         — Channel-Detail, VOD-Shelf, Playback-Controls, Kapitel-Panel
    StreamListScreen.tsx      — Sprachgefilterte Stream-Liste (DE/EN-Tabs)
    SettingsScreen.tsx        — streamBadgeMode, sidebarWidth, badgeGap, mpvLogging
    AccountScreen.tsx         — Nutzerinfo, Logout
  components/
    FocusableCard.tsx         — Wiederverwendbare Kanal-Karte (Thumbnail, Badge, Progress)
    Sidebar.tsx               — Navigationssidebar (6 Tabs)
    LanguageBadge.tsx         — Sprach-/Flagge-Badge
    Icons.tsx                 — SVG-Icons
  context/
    SettingsContext.tsx        — localStorage-Settings, CSS-Custom-Properties-Sync
  input/
    gamepad.ts                — Browser Gamepad API, rAF-Poll, Achsen-Debounce
  lib/
    languageBadge.ts          — ISO-Code → Flagge/Kürzel Mapping (~40 Sprachen)
  styles/
    global.css                — Dark Theme (#0e0e10, #9147ff Akzent), 1280x800-optimiert
  types/
    t4sd.d.ts                 — window.t4sd-Typ-Deklaration

flatpak/
  tv.twitch4steamdeck.App.yml — Flatpak-Manifest (mpv, Streamlink, alle Native-Deps)
  build-flatpak.sh            — 6-Schritt Build-Pipeline (WSL2)
  twitch4steamdeck.sh         — Launcher mit zypak-wrapper
  tv.twitch4steamdeck.App.desktop
  patches/mpv-ffmpeg7-avio-const.patch
```

---

## Wichtige Patterns & Architektur-Entscheidungen

### IPC-Bridge Pattern
Alle Renderer→Main-Calls gehen über `window.t4sd.*` (definiert in `src/preload/index.ts`). Neue Features brauchen:
1. Handler in `src/main/ipc/handlers.ts` (`ipcMain.handle('kanal:aktion', ...)`)
2. Bridge-Methode in `src/preload/index.ts`
3. Typ-Deklaration in `src/renderer/src/types/t4sd.d.ts`

### Gamepad Dual-Path
- **Linux/Gaming-Mode:** `src/main/input/gamepadReader.ts` liest `/dev/input/js*` direkt (Chromium Gamepad API funktioniert nicht im Flatpak-Sandbox ohne udev)
- **Windows/Dev:** `src/renderer/src/input/gamepad.ts` nutzt `navigator.getGamepads()` via rAF-Loop
- Beide Pfade erzeugen synthetische `KeyboardEvent('keydown')`. Alle UI-Komponenten reagieren nur auf Key-Events — kein Gamepad-Code in Screens.
- Button-Mapping: A=Enter, B=Escape, X=x, Y=y, LB=l1, RB=r1, LT=l2, RT=r2, DPad=Arrows

### Live-VOD- und fMP4-Snapshot-Logik
`PlaybackService` unterscheidet vor dem VOD-Start zwischen abgeschlossenen VODs und laufenden Live-VODs:
- `inspectVodPlaylist()` prüft das HLS-Manifest auf `#EXT-X-MAP`, `#EXT-X-PLAYLIST-TYPE` und `#EXT-X-ENDLIST`
- **Laufende Live-VODs** kommen von Twitch oft als offene `EVENT`-/DVR-Playlist zurück; diese würde mpv sonst wie einen Live-Stream behandeln und am Live-Rand starten
- **fMP4-VODs** sind zusätzlich für HLS-Seeks im FFmpeg/mpv-Demuxer unzuverlässig

Workaround in `src/main/playback/hlsTrimmer.ts`:
- erzeugt aus der aktuellen Twitch-Playlist einen lokalen statischen Snapshot ab Zielsegment
- setzt immer `#EXT-X-PLAYLIST-TYPE:VOD`
- setzt immer `#EXT-X-ENDLIST`
- serviert die Playlist via lokalem HTTP-Server (zufälliger Port auf `127.0.0.1`)
- mpv lädt neue Snapshots via `loadfile replace`

Wichtig:
- Warum HTTP statt `file://`: FFmpeg's Protokoll-Whitelist blockiert HTTPS-Subrequests von file://-HLS-Playlists
- `streamlink --stream-url` liefert bei laufenden VODs nur die rohe Twitch-DVR-URL; erst der lokale Snapshot macht daraus ein statisches VOD
- `PlaybackService` hält eine **absolute VOD-Zeitachse** über `playbackOffsetSeconds` + `lastKnownAbsolutePositionSeconds`, damit Kapitelwahl, Resume und Folge-Seeks nicht auf die lokale Zeit des Snapshots driften
- Reload-Races werden über `seekGeneration` / `loadGeneration` abgefedert, damit alte `time-pos`-Events keine falschen Offsets in die History schreiben

### mpv JSON-IPC
`src/main/playback/mpvController.ts` kommuniziert via Unix-Socket (`/tmp/twitch4sd-mpv.sock`) oder Windows Named Pipe (`\\.\pipe\twitch4sd-mpv`). Wichtig:
- Verbindung wird mit 12 Retries × 250ms hergestellt (mpv braucht Zeit zum Starten)
- `observeTimePos()` abonniert `time-pos`-Events; falls in 10s kein Event kommt → Fallback auf `pollTimePos()` (Intervall-Polling)
- `playback-restart` markiert nach `loadfile` den aktiven Reload als abgeschlossen; bei klassischen TS-VODs triggert es außerdem den initialen Resume-Seek

### VOD vs. Live Playback
- **Live:** `streamlink --player mpv --player-args '...'` — Streamlink managed mpv intern. Kein IPC nötig (kein Seeking bei Live).
- **VOD:** `streamlink --stream-url` liefert eine HLS-URL → mpv wird **direkt** mit `--input-ipc-server` gespawnt. Ermöglicht Seeking + Position-Tracking.
- **Laufendes Live-VOD:** Die von Streamlink gelieferte URL ist oft eine offene `index-dvr.m3u8` (`EVENT`, ohne `ENDLIST`). Diese darf nicht direkt an mpv gehen, sondern wird zuerst lokal als Snapshot eingefroren.
- **Geschlossenes fMP4-VOD:** Seeks laufen ueber Snapshot-Reload statt mpv-internem HLS-Seek.
- Reason: Piped Streams (streamlink mit stdout) sind nicht seekable.

### Twitch API
- Helix REST API für alle Standard-Daten: `https://api.twitch.tv/helix`
- Twitch GraphQL für Kapitel-Daten (`getVodChapters`): `https://gql.twitch.tv/gql` mit public client-id `kimne78kx3ncx6brgo4mv6wki5h1ko` (kein eigener Token nötig)
- Auth-Scope: nur `user:read:follows`
- `getTopGames()` macht 40 parallele `/streams?game_id=<id>&first=100` Calls zur Zuschauerzahl-Schätzung

### Settings-Persistenz
- UI-Settings (Badge-Mode, Sidebar-Breite, etc.) → `localStorage` unter Key `t4sd:settings` (kein IPC, kein Flicker beim Start)
- VOD-Verlauf + Resume → SQLite `history.db` in `userData/`
- Twitch-Tokens → Electron `safeStorage` (OS-Keystore), Datei: `userData/twitch-tokens.bin`

---

## Bekannte Einschränkungen

| Problem | Status | Details |
|---|---|---|
| Live-VOD startet am Live-Rand | Workaround aktiv | Offene `EVENT`-/DVR-Playlists werden vor dem Start als lokaler VOD-Snapshot eingefroren (`inspectVodPlaylist()` + `hlsTrimmer.ts`). |
| fMP4-Seek-Bug | Workaround aktiv | fMP4-Seeks laufen über Snapshot-Reload statt mpv-internem HLS-Seek (`reloadFmp4AtAbsolutePosition()` in `playbackService.ts`). |
| Streamlink `--twitch-api-header` | Nicht verwendet | Twitch lehnt Device-Code-Token für Streamlinks interne GQL-API ab. Öffentliche Streams funktionieren ohne. |
| Ad-Bypass | Nicht implementiert | `--twitch-disable-ads` von Streamlink deprecated. Post-MVP. |
| Flaggen-Emojis auf Windows | Nur Rechtecke | Unicode Regional Indicators brauchen Noto Color Emoji (Linux). Im Dev-Mode ignorieren. |
| Browser Gamepad API in Gaming Mode | Nicht nutzbar | Steam Input + Flatpak-Sandbox blockiert udev-Events für Chromium. Deshalb `/dev/input/js*` direkt. |
| Bluetooth-Controller-Deduplizierung | Aktiv | Mehrere `/dev/input/js*`-Devices melden gleiche Inputs → 40ms-Deduplizierungsfenster in `gamepadReader.ts` |

---

## Deployment auf dem Steam Deck

```bash
# Auf Steam Deck installieren (einmalig)
flatpak install --user twitch4steamdeck.flatpak

# Starten
flatpak run tv.twitch4steamdeck.App

# Update (Neuinstallation)
flatpak uninstall tv.twitch4steamdeck.App
flatpak install --user twitch4steamdeck.flatpak
```

Flatpak-Berechtigungen (aus Manifest): `--share=network`, `--socket=x11`, `--socket=pulseaudio`, `--device=all` (GPU + `/dev/input/*`), `--share=ipc`.

---

## Typische Debugging-Workflows

### mpv startet nicht / kein Playback
1. mpv-Logging aktivieren (SettingsScreen → "mpv-Logging")
2. Log-Pfad via IPC: `window.t4sd.playback.getLogPath()`
3. Prüfen: `spawnMpv()` in `src/main/playback/streamlink.ts:77`
4. Bei VODs prüfen, ob mpv mit einer lokalen `http://127.0.0.1/...m3u8` oder direkt mit einer Twitch-/CloudFront-`index-dvr.m3u8` gestartet wurde

### Live-VOD spielt Livestream statt VOD
1. `streamlink --stream-url https://www.twitch.tv/videos/<id> best` prüfen: liefert es eine nackte `index-dvr.m3u8`, ist das noch keine statische VOD-Quelle
2. Manifest prüfen: `#EXT-X-PLAYLIST-TYPE:EVENT` oder fehlendes `#EXT-X-ENDLIST` bedeutet offenes Live-DVR
3. `inspectVodPlaylist()` und `createTrimmedPlaylist()` in `src/main/playback/playbackService.ts` / `src/main/playback/hlsTrimmer.ts` prüfen
4. In `mpv.log` muss beim korrekten Pfad die Start-URL auf `127.0.0.1` zeigen; eine direkte CloudFront-`index-dvr.m3u8` bedeutet, dass der Snapshot-Pfad nicht gegriffen hat

### Gamepad-Eingaben kommen nicht an (Steam Deck)
1. `gamepadReader.ts` liest `/dev/input/js*` — prüfen ob Device vorhanden
2. Deduplizierungs-Fenster: 40ms — bei Doppel-Inputs erhöhen
3. Axis-Mapping: DPad ist Axis 6/7 (binary), Stick ist 0/1 (threshold 16384)

### IPC-Channel fehlt / unbekannt
Prüfen: `handlers.ts` (Main), `preload/index.ts` (Bridge), `t4sd.d.ts` (Renderer-Typen) — alle drei müssen übereinstimmen.

### TypeScript-Fehler
```bash
npm run typecheck
```
Zwei unabhängige tsconfig: `tsconfig.node.json` (Main+Preload) und `tsconfig.web.json` (Renderer).
