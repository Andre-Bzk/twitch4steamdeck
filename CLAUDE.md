# Twitch4SteamDeck — CLAUDE.md

Twitch-Client für das Steam Deck. Electron + React, gamepad-navigierbar, Big-Screen-UI (auf Linux/Steam Deck: Fenster maximiert auf Primärdisplay; im Windows-Dev: 1280x800). Unterstützt Live-Streams und VODs mit Resume und Kapitelwahl. Deployment als Flatpak auf dem Steam Deck.

---

## Tech-Stack

| Schicht | Technologie |
|---|---|
| Framework | Electron 33, electron-vite, React 18, TypeScript 5.5 |
| Playback | hls.js 1.6 (HTML5 `<video>` im Renderer), Streamlink 6.11.0 im Flatpak-Build / 8.2.1 im Windows-Dev (nur für `--stream-url`) |
| Gamepad (Linux) | evdev `/dev/input/event*` mit BTN_*-Codes (Xbox, PlayStation, Nintendo; USB + Bluetooth) |
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
│   └── streamlink.ts    — getStreamUrl() + getAvailableQualities() via streamlink
├── historyRepo          — SQLite VOD-Verlauf (Resume, Completed)
└── gamepadReader        — Linux evdev /dev/input/event* (via js*-Discovery, BTN_*-Codes)

Preload (contextBridge)
└── window.t4sd          — Typisierte IPC-Bridge (auth, twitch, history, playback, gamepad)

Renderer (React)
├── App.tsx              — Auth-Gate: LoginScreen | AppShell
├── AppShell.tsx         — Tab-Routing, Sidebar/Main-Fokus, Globaler Playback-Overlay
├── screens/             — FollowingScreen, BrowseScreen, CategoryScreen,
│                          ChannelScreen (Hauptscreen), StreamListScreen, Settings, Account
├── components/
│   ├── VideoPlayer.tsx  — hls.js <video> Wrapper (forwardRef, imperative handle)
│   └── PlaybackOverlay.tsx — DOM-Overlay über dem Video (z-index: 300)
├── input/gamepad.ts     — Browser Gamepad API (Windows, Dev-Mode)
└── context/SettingsContext.tsx — localStorage-Settings (streamBadgeMode, sidebarWidth, …)
```

### Datenfluss

- **Auth:** LoginScreen → IPC → AuthService → Device Code Flow → Token (safeStorage)
- **Browsing:** Screen → IPC → HelixClient → Twitch Helix API → Screen
- **Live-Playback (via ChannelScreen):** ChannelScreen → IPC `playback:start-live` → PlaybackService → `streamlink --stream-url twitch.tv/<login>` → HLS-URL → IPC-Event `playback:hls-url` → Renderer → `VideoPlayer` (hls.js)
- **Live-Playback (Direkt-Start):** BrowseScreen/StreamListScreen/CategoryScreen → A-Button → `window.t4sd.playback.startLive()` → PlaybackService → HLS-URL → IPC-Event `playback:hls-url` → AppShell-Globaler-Overlay → `VideoPlayer` (hls.js) — **kein ChannelScreen-Routing**
- **VOD-Playback:** ChannelScreen → IPC `playback:start-vod` → PlaybackService → `streamlink --stream-url twitch.tv/videos/<id>` → HLS-URL → IPC-Event `playback:hls-url` → Renderer → `VideoPlayer` (hls.js, seekTo startPosition)
- **Overlay:** `PlaybackOverlay` (z-index: 300) liegt als normales DOM-Element über `VideoPlayer` (z-index: 100) — kein Fenster-Layering nötig
- **Seek/Pause/Stop:** direkt über `videoRef.current` (kein IPC-Roundtrip)
- **Qualitätswechsel:** `videoRef.current.stop()` → `startLive/startVod(quality)` → neuer `playback:hls-url` Event — streamlink-Neustart nötig, da Single-Bitrate-HLS (kein hls.js Level-Switch möglich)
- **Qualitätsliste:** `IPC playback:get-qualities` → `streamlink --json <url>` → `Object.keys(streams)` sortiert nach fixem Order-Array
- **Position-Tracking:** `VideoPlayer` meldet alle 5s via IPC `playback:report-position` → Main → SQLite
- **Gamepad:** evdev `/dev/input/event*` via js*-Discovery (Linux/Gaming-Mode) **oder** `navigator.getGamepads()` (Windows/Dev) → synthetische `KeyboardEvent`s → alle Screen-Handler reagieren auf Keys

---

## Entwicklung

### Voraussetzungen
- Node.js, npm
- `.env` mit `MAIN_VITE_TWITCH_CLIENT_ID=<deine-client-id>` (Twitch Application, Public, Device Code Flow)
- Windows: Streamlink unter `%LOCALAPPDATA%\Programs\Streamlink\bin\streamlink.exe`

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
Das Skript: prüft deps → npm-Build → Python-Deps generieren → Streamlink-Tarballs hashen → `flatpak-builder` → SCP zum Steam Deck.

> **Hinweis:** Das Flatpak-Manifest (`flatpak/tv.twitch4steamdeck.App.yml`) enthält noch mpv als Dependency — muss bereinigt werden, sobald der hls.js-Ansatz auf dem Steam Deck getestet und bestätigt ist.

---

## Codebase-Struktur

```
src/main/
  index.ts                    — Electron-Einstiegspunkt, Service-Wiring, Window (Linux: maximiert auf Primärdisplay; Windows: 1280x800), CORS-Handler für Twitch CDN
  env.d.ts                    — Typ für MAIN_VITE_TWITCH_CLIENT_ID
  auth/
    authService.ts            — Auth-Lifecycle, Token-Refresh, Event-Emitter
    deviceCodeFlow.ts         — OAuth Device Code + Polling (https://id.twitch.tv/oauth2/)
    tokenStore.ts             — safeStorage-Verschlüsselung, Fallback auf plaintext
  input/
    gamepadReader.ts          — evdev /dev/input/event* Leser (via js*-Discovery), Hotplug (3s-Scan), Deduplizierung (40ms); BTN_*-Codes für controller-unabhängiges Mapping
  ipc/
    handlers.ts               — Alle ipcMain.handle()-Registrierungen + Event-Forwarding
  playback/
    playbackService.ts        — Orchestrator: streamlink --stream-url → HLS-URL → playback-hls-url Event; startVod(quality?); getAvailableQualities()
    streamlink.ts             — getStreamUrl() + getAvailableQualities() via streamlink (--stream-url für URL, --json für Qualitätsliste)
    types.ts                  — Quality-Typ, PlaybackEvent, HlsUrlPayload
  store/
    db.ts                     — SQLite-Init, WAL-Modus, Migration (vod_history-Tabelle)
    historyRepo.ts            — upsertVod, updatePosition, markCompleted, getProgressMap
  twitch/
    helixClient.ts            — Helix-API (followed, streams, videos, games) + GQL (Kapitel)
    types.ts                  — Helix-Typen + vereinfachte Renderer-Typen

src/preload/
  index.ts                    — contextBridge: window.t4sd (auth, twitch, history, playback, gamepad)

src/renderer/
  index.html                  — CSP: default-src 'self'; media-src 'self' blob: (blob: nötig für hls.js MediaSource)

src/renderer/src/
  App.tsx                     — Auth-Gate, Gamepad-Init
  main.tsx                    — React-DOM-Bootstrap, SettingsProvider
  screens/
    AppShell.tsx              — Tab-Routing, Sidebar/Main-Fokus-Split, Globaler Playback-Overlay (direkter Stream-Start ohne ChannelScreen), Qualitätswahl für Live
    LoginScreen.tsx           — Device-Code-Login, QR-Code, Countdown
    FollowingScreen.tsx       — Gefolgte Kanäle (Grid), Live/Offline-Sort
    BrowseScreen.tsx          — Top-Streams-Shelf (A=Direkt-Play, X=Kanalseite) + Kategorien-Grid (Infinite Scroll)
    CategoryScreen.tsx        — Streams einer Kategorie (A=Direkt-Play, X=Kanalseite)
    ChannelScreen.tsx         — Channel-Detail, VOD-Shelf, VideoPlayer + PlaybackOverlay, Kapitel-Panel, Qualitätswahl
    StreamListScreen.tsx      — Sprachgefilterte Stream-Liste DE/EN (A=Direkt-Play, X=Kanalseite)
    SettingsScreen.tsx        — streamBadgeMode, sidebarWidth, badgeGap
    AccountScreen.tsx         — Nutzerinfo, Logout
  components/
    VideoPlayer.tsx           — hls.js <video> Wrapper, forwardRef (seek, seekTo, pause, play, stop, getCurrentTime); attachMedia vor loadSource; play() in MANIFEST_PARSED
    PlaybackOverlay.tsx       — DOM-Overlay (Seek-Bar, Kanalinfo, Gamepad-Hints, Auto-Hide, Qualitäts-Button + Panel); playState: 'playing'|'paused'
    FocusableCard.tsx         — Wiederverwendbare Kanal-Karte (Thumbnail, Badge, Progress)
    Sidebar.tsx               — Navigationssidebar (6 Tabs)
    LanguageBadge.tsx         — Sprach-/Flagge-Badge
    Icons.tsx                 — SVG-Icons
  context/
    SettingsContext.tsx        — localStorage-Settings (streamBadgeMode, sidebarWidth, badgeGap), CSS-Custom-Properties-Sync
  input/
    gamepad.ts                — Browser Gamepad API, rAF-Poll, Achsen-Debounce
  lib/
    languageBadge.ts          — ISO-Code → Flagge/Kürzel Mapping (~40 Sprachen)
  styles/
    global.css                — Dark Theme (#0e0e10, #9147ff Akzent), 1280x800-optimiert
  types/
    t4sd.d.ts                 — window.t4sd-Typ-Deklaration

scripts/
  test-playback-pipeline.mjs  — Standalone-Test: streamlink → HLS-URL → Manifest → Segment (node scripts/test-playback-pipeline.mjs twitch.tv/<kanal>)

flatpak/
  tv.twitch4steamdeck.App.yml — Flatpak-Manifest (Streamlink, alle Native-Deps; mpv-Einträge noch zu bereinigen)
  build-flatpak.sh            — 6-Schritt Build-Pipeline (WSL2)
  twitch4steamdeck.sh         — Launcher mit zypak-wrapper
  tv.twitch4steamdeck.App.desktop
  patches/mpv-ffmpeg7-avio-const.patch  — (obsolet nach mpv-Entfernung)
```

---

## Wichtige Patterns & Architektur-Entscheidungen

### IPC-Bridge Pattern
Alle Renderer→Main-Calls gehen über `window.t4sd.*` (definiert in `src/preload/index.ts`). Neue Features brauchen:
1. Handler in `src/main/ipc/handlers.ts` (`ipcMain.handle('kanal:aktion', ...)`)
2. Bridge-Methode in `src/preload/index.ts`
3. Typ-Deklaration in `src/renderer/src/types/t4sd.d.ts`

### Zwei Playback-Kontexte

**1. ChannelScreen-Playback** (Live + VOD, X-Button oder „Du folgst"):
- Nutzer navigiert zur ChannelScreen → drückt „▶ Live ansehen" oder wählt einen VOD
- ChannelScreen hält eigenen `hlsPayload`-State, eigenen `videoRef`, eigene PlaybackOverlay
- VOD-Features: Resume, Kapitel-Panel, Position-Tracking

**2. Globaler AppShell-Overlay** (Direkt-Start, A-Button in BrowseScreen/StreamListScreen/CategoryScreen):
- Nutzer drückt A auf einer Stream-Karte → `onStartLive(ch)` → AppShell ruft `startLive()` direkt auf
- AppShell hält `liveChannel`, `liveHlsPayload`, `livePlayState`, `liveVideoRef`
- `isGlobalPlaybackInitiated` Ref verhindert, dass ChannelScreen-IPC-Events den globalen Overlay aktivieren
- Während Playback: `hasFocus={false}` für alle Browse-Screens → keine Tastenkonflikte
- AppShell-eigener Keydown-Handler: Escape=Stop, Enter=Pause, Pfeile=Seek
- Nur Live-Streams (kein VOD, kein Resume, kein Position-Tracking)

### Playback-Architektur (hls.js im Renderer)
Video läuft als HTML5 `<video>` Element innerhalb des Electron-Fensters — **kein externer mpv-Prozess**.

**VideoPlayer-Initialisierung (kritisch):**
1. `hls.attachMedia(video)` — zuerst Media-Kontext aufbauen
2. Im `MEDIA_ATTACHED`-Event: `hls.loadSource(hlsUrl)` — dann erst Source laden
3. Im `MANIFEST_PARSED`-Event: `video.play()` — jetzt ist MediaSource bereit
- **Reihenfolge wichtig:** `loadSource` vor `attachMedia` → MANIFEST_PARSED feuert bevor MSE bereit → `play()` wirft `NotSupportedError: The element has no supported sources`
- **CSP:** `media-src 'self' blob:` in `src/renderer/index.html` — hls.js braucht `blob:` für MediaSource

**Imperative Handle** — ChannelScreen / AppShell halten `videoRef = useRef<VideoPlayerHandle>()`:
- `videoRef.current.seek(delta)` — relativer Seek (Sekunden)
- `videoRef.current.seekTo(abs)` — absoluter Seek
- `videoRef.current.pause()` / `.play()` / `.togglePause()`
- `videoRef.current.stop()` — zerstört hls.js-Instanz, leert `<video>`
- `videoRef.current.getCurrentTime()` — aktuell abgespielte Position (synchron)

**Warum dieser Ansatz:** Früherer Ansatz mit externem mpv-Fullscreen-Fenster wurde vom OS-Windowmanager (Gamescope auf Steam Deck) immer über das Electron-Fenster gelegt. CSS `z-index` wirkt nur innerhalb eines Dokuments, nicht auf OS-Fensterebene. Die Lösung: Video und Overlay im selben Rendering-Kontext halten.

### Qualitätswahl während Wiedergabe
- **Qualitätswechsel = streamlink-Neustart**: streamlink liefert Single-Bitrate-HLS → hls.js-Level-Switch nicht nutzbar. Wechsel: `videoRef.stop()` → `startLive/startVod(quality)` → neuer `hls-url` Event.
- **VOD mit Resume**: `getCurrentTime()` vor Stop → als `startSeconds` an neues `startVod()`.
- **Qualitätsliste**: asynchron nach Stream-Start via `playback:get-qualities` IPC → `streamlink --json <url>` → `Object.keys(json.streams)`, sortiert: `['best', '1080p60', '720p60', '480p', '360p', '160p', 'audio_only', 'worst']`
- **Session-only**: kein Persistieren in Settings/localStorage.
- **Panel-State im Parent**: `qualityPanelOpen`, `qualityFocusedIndex` in ChannelScreen/AppShell — PlaybackOverlay bekommt Props + Callbacks.
- **Key-Handler Priorität**: `qualityPanelOpen`-Block wird VOR allen anderen Keys geprüft und gibt `return` — verhindert Seek/Pause-Konflikte während das Panel offen ist.
- **X-Taste** öffnet Quality-Panel (Gamepad Button X → `x`-KeyboardEvent).

### Kapitel-Panel during Playback
Wenn der User während der Wiedergabe das Kapitel-Panel öffnet (Y-Taste), läuft das Video **weiter** (nicht pausiert). `PlaybackOverlay` wird per conditional render (`!chapterPanelVod`) ausgeblendet, sodass das Kapitel-Panel sauber über dem Video erscheint. Nach Kapitelwahl: `seekTo(chapter.positionSeconds)` — kein `play()` nötig, da Video bereits läuft. Nach Schließen ohne Auswahl: Panel weg, Video läuft unverändert weiter. Bei leerer Kapitelliste: X-Taste seeked zu `0` (Videoanfang).

### Gamepad Dual-Path
- **Linux/Gaming-Mode:** `src/main/input/gamepadReader.ts` nutzt Linux evdev (`/dev/input/event*`). Erkennung läuft über `/dev/input/js*`-Scan; für jedes js*-Device wird via `/sys/class/input/jsN` das zugehörige `event*`-Device ermittelt und geöffnet. Dadurch werden standardisierte `BTN_*`-Codes gelesen (BTN_NORTH=X, BTN_SOUTH=A usw.) — funktioniert treiber- und controller-unabhängig für Xbox, PlayStation, Nintendo und beliebige USB/Bluetooth-Gamepads.
- **Windows/Dev:** `src/renderer/src/input/gamepad.ts` nutzt `navigator.getGamepads()` via rAF-Loop
- Beide Pfade erzeugen synthetische `KeyboardEvent('keydown')`. Alle UI-Komponenten reagieren nur auf Key-Events — kein Gamepad-Code in Screens.
- Button-Mapping: A=Enter, B=Escape, X=x, Y=y, LB=l1, RB=r1, LT=l2, RT=r2, DPad=Arrows
- Fallback: Falls `/sys`-Lookup fehlschlägt, öffnet `JoystickFallbackReader` das js*-Device direkt (altes Joystick-API mit festem Button-Nummern-Mapping)

### A-Button-Verhalten je Screen
| Screen | A-Button | X-Button |
|---|---|---|
| FollowingScreen | Kanalseite öffnen | — |
| BrowseScreen (Shelf) | Stream direkt starten (AppShell-Overlay) | Kanalseite öffnen |
| StreamListScreen | Stream direkt starten (AppShell-Overlay) | Kanalseite öffnen |
| CategoryScreen | Stream direkt starten (AppShell-Overlay) | Kanalseite öffnen |
| ChannelScreen | Live-Stream starten / Bestätigen | — |

### VOD vs. Live Playback
- **Live:** `streamlink --stream-url twitch.tv/<login> <quality>` → HLS-URL → hls.js spielt Live-Playlist nativ
- **VOD:** `streamlink --stream-url twitch.tv/videos/<id> <quality>` → HLS-URL → hls.js seeked zu `startPosition` via `video.currentTime`
- **Quality-Default:** `'best'` — kein Persistieren, nur Session-State
- **Resume:** `history.getPosition(vodId)` im Main-Prozess → als `startPosition` im `playback:hls-url` Event → `VideoPlayer` seeked nach MANIFEST_PARSED

### Position-Tracking
`VideoPlayer` meldet alle 5s via `window.t4sd.playback.reportPosition(vodId, currentTime, durationSeconds)` → Main → `historyRepo.updatePosition()` + `markCompleted()` (bei >95% Fortschritt). Nur für VODs (nicht Live).

### Twitch API
- Helix REST API für alle Standard-Daten: `https://api.twitch.tv/helix`
- Twitch GraphQL für Kapitel-Daten (`getVodChapters`): `https://gql.twitch.tv/gql` mit public client-id `kimne78kx3ncx6brgo4mv6wki5h1ko` (kein eigener Token nötig)
- Auth-Scope: nur `user:read:follows`
- `getTopGames()` macht 40 parallele `/streams?game_id=<id>&first=100` Calls zur Zuschauerzahl-Schätzung

### Settings-Persistenz
- UI-Settings (Badge-Mode, Sidebar-Breite, Badge-Gap) → `localStorage` unter Key `t4sd:settings` (kein IPC, kein Flicker beim Start)
- VOD-Verlauf + Resume → SQLite `history.db` in `userData/`
- Twitch-Tokens → Electron `safeStorage` (OS-Keystore), Datei: `userData/twitch-tokens.bin`

---

## Bekannte Einschränkungen

| Problem | Status | Details |
|---|---|---|
| hls.js Performance auf Steam Deck | Ungetestet | Chromiums VA-API Hardware-Decode sollte ausreichen. Falls Dropped Frames bei 1080p60 → Qualitäts-Button im Overlay nutzen (720p60 wählen) oder mpv-Fallback evaluieren. |
| Twitch Live-Stream URL-Expiry | Unkritisch | `streamlink --stream-url` Token in URL kann ablaufen. hls.js handelt Playlist-Refresh automatisch; bei Verbindungsabbruch muss neu gestartet werden. |
| Ad-Bypass | Nicht implementiert | `--twitch-disable-ads` von Streamlink deprecated. Post-MVP. |
| Flaggen-Emojis auf Windows | Nur Rechtecke | Unicode Regional Indicators brauchen Noto Color Emoji (Linux). Im Dev-Mode ignorieren. |
| Browser Gamepad API in Gaming Mode | Nicht nutzbar | Steam Input + Flatpak-Sandbox blockiert udev-Events für Chromium. Deshalb evdev direkt im Main-Process. |
| Bluetooth-Controller-Deduplizierung | Aktiv | Mehrere `/dev/input/js*`-Devices (z.B. Raw-Device + Steam-Virtual-Device) → 40ms-Deduplizierungsfenster in `gamepadReader.ts` |
| Direkt-Start: kein VOD-Support | By Design | AppShell-Overlay nur für Live-Streams. VODs nur über Kanalseite (ChannelScreen) mit Resume + Kapitel. |

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

### Kein Playback / Video startet nicht
1. In DevTools (Ctrl+Shift+I im Dev-Mode) Console prüfen — `[VideoPlayer]`-Logs zeigen jeden Schritt
2. `node scripts/test-playback-pipeline.mjs twitch.tv/<kanal>` ausführen — testet streamlink + Manifest + Segment
3. `streamlink --stream-url <url> best` manuell ausführen: liefert es eine gültige `https://`-URL?
4. CSP-Fehler? → `src/renderer/index.html` prüfen: `media-src 'self' blob:` muss vorhanden sein
5. CORS-Fehler? → `session.defaultSession.webRequest` in `index.ts` prüfen

### VideoPlayer-Diagnose (DevTools Console)
Beim Start erscheinen diese Logs (alle mit `[VideoPlayer]`-Prefix):
- `Hls.isSupported: true` — hls.js kann MSE nutzen
- `attachMedia aufgerufen` — MediaSource wird aufgebaut
- `MEDIA_ATTACHED — lade Source` — MediaSource bereit, Manifest wird geladen
- `MANIFEST_PARSED — readyState: X networkState: Y` — Manifest geladen, play() wird aufgerufen
- `play() erfolgreich` — Video läuft

### VOD startet an falscher Position
1. `startPosition` im `playback:hls-url` Event korrekt? In `PlaybackService.startVod()` prüfen
2. hls.js seeked in `MANIFEST_PARSED`-Handler: `video.currentTime = startPosition`

### Gamepad-Eingaben kommen nicht an (Steam Deck)
1. `gamepadReader.ts` scannt `/dev/input/js*` — prüfen ob js-Device vorhanden (`ls /dev/input/js*`)
2. Für jedes js-Device wird via `/sys/class/input/jsN` ein evdev-Device (`event*`) gesucht — Log `[gamepad] geöffnet (evdev): /dev/input/js0 → /dev/input/event4` zeigt ob das funktioniert
3. Deduplizierungs-Fenster: 40ms — bei Doppel-Inputs `DUPLICATE_EVENT_WINDOW_MS` erhöhen
4. Axis-Mapping: DPad ist ABS_HAT0X/Y (code 16/17), Stick ist ABS_X/Y (code 0/1, threshold 16384)

### IPC-Channel fehlt / unbekannt
Prüfen: `handlers.ts` (Main), `preload/index.ts` (Bridge), `t4sd.d.ts` (Renderer-Typen) — alle drei müssen übereinstimmen.

### TypeScript-Fehler
```bash
npm run typecheck
```
Zwei unabhängige tsconfig: `tsconfig.node.json` (Main+Preload) und `tsconfig.web.json` (Renderer).
