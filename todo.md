# Twitch4SteamDeck — TODO

> Checkboxen-Tracker. Nach jedem erledigten Punkt sofort abhaken und kurzes
> Update in `CLAUDE_PROGRESS.md` ergänzen.

## Phase 0 — Projekt-Skelett
- [x] `package.json`, tsconfig (root/node/web)
- [x] `electron.vite.config.ts`, `electron-builder.yml`, `.gitignore`
- [x] Main-Stub mit BrowserWindow
- [x] Preload-Stub mit `contextBridge`
- [x] Renderer (React + Big-Screen-Baseline-CSS)
- [x] Smoke-Test: `npm install && npm run dev` zeigt Fenster

## Phase 1 — Twitch OAuth Device Code Flow
- [x] `deviceCodeFlow.ts` (request + polling + refresh)
- [x] `tokenStore.ts` (safeStorage-Persistenz)
- [x] `authService.ts` (Lifecycle + EventEmitter)
- [x] IPC-Handler + Preload-Bridge
- [x] `LoginScreen.tsx` (QR + Code + Countdown)
- [x] `App.tsx` Routing nach Auth-Status
- [x] `.env.example`
- [x] **End-to-End-Verifikation durch User** (Login mit echter Twitch-App durchführen)
- [x] Token-Persistenz prüfen: App-Neustart → bleibt eingeloggt
- [ ] Logout testen: `userData/twitch-tokens.bin` wird gelöscht (später)

## Phase 2 — Twitch Helix-Client + Followed-Channels-Home-Screen
- [x] `src/main/twitch/types.ts` (Helix-Response-Typen)
- [x] `src/main/twitch/helixClient.ts` (fetch-Wrapper, Auth-Header, Client-ID-Header, Paginierung)
- [x] Helix-Endpoints implementieren:
  - [x] `GET /users` (eigener User → user_id cachen)
  - [x] `GET /channels/followed?user_id=…` (paginiert)
  - [x] `GET /streams?user_id=…` (batched, max 100 IDs pro Call)
- [x] IPC: `twitch:get-followed` registrieren (merged live-Status + Avatar)
- [x] Preload-API erweitern: `window.t4sd.twitch.getFollowed`
- [x] `FollowingScreen.tsx` — Karten-Grid mit Live-Indicator, Vorschaubild, Titel, Zuschauerzahl
- [x] Spatial-Navigation: eigene Implementierung (Arrow-Keys + Region-Switch Sidebar ↔ Main)
- [x] Gamepad-Service: `src/renderer/src/input/gamepad.ts` (Gamepad-API → Keyboard-Events)
- [x] `FocusableCard.tsx` — Block-Layout, Avatar + Name + Titel + Spiel + Viewer-Badge
- [x] `AppShell.tsx` + `Sidebar.tsx` — Layout mit linker Navigation (Du folgst / Durchsuchen / Mein Account)
- [x] `Icons.tsx` — inline SVG-Icons (Heart, Compass, User)
- [x] `BrowseScreen.tsx` + `AccountScreen.tsx` — Platzhalter-Screens mit Logout
- [x] **End-to-End-Verifikation durch User** (2026-04-07: Karten + Tastatur-Nav bestätigt)

## Phase 3 — Streamlink + mpv (Live-Wiedergabe)

### Vorab (Dev-Setup, Windows)
- [ ] **User:** `mpv` installieren und im PATH verfügbar machen (`winget install mpv` oder
      Binary von mpv.io) — `mpv --version` muss in Shell funktionieren
- [ ] **User:** `streamlink` installieren (`winget install streamlink` oder
      `pip install streamlink`) — `streamlink --version` muss funktionieren
- [ ] **User:** Kurz manuell testen:
      `streamlink --twitch-disable-ads twitch.tv/<live-channel> best --player mpv`
      → soll ein mpv-Fenster mit Live-Stream öffnen. Wenn das klappt, ist der Pipeline-Baseline
      verifiziert und wir können im Code darauf aufbauen.

### Backend (Main-Prozess)
- [ ] `src/main/playback/types.ts` — `PlaybackState`, `PlaybackEvent`, `Quality`
- [ ] `src/main/playback/streamlink.ts` — `spawnStreamlink({channelLogin, quality, oauthToken})`,
      gibt `ChildProcess` mit stdout-Stream zurück, `--twitch-disable-ads`,
      `--twitch-api-header=Authorization=OAuth <token>`, stderr in Logger
- [ ] `src/main/playback/mpvController.ts`:
  - [ ] Plattform-Weiche: `win32` → Named Pipe `\\.\pipe\twitch4sd-mpv-<pid>`,
        sonst Unix Socket unter `os.tmpdir()`
  - [ ] `start(stdin)` — spawnt mpv mit `--input-ipc-server=<path> --fullscreen --hwdec=auto -`
  - [ ] IPC-Client verbindet mit Retry (100–200 ms Delay nach spawn)
  - [ ] Commands: `pause(bool)`, `seek(sec)`, `quit()`, `observeProperty(name)`
  - [ ] `EventEmitter`-Events: `'started'`, `'time-pos'`, `'ended'`, `'error'`
- [ ] `src/main/playback/playbackService.ts` — bindet streamlink + mpv zusammen,
      verwaltet `currentPlayback: { streamlink, mpv, channelLogin }`, räumt beim Stop auf
- [ ] IPC-Kanäle (in `handlers.ts`):
  - [ ] `playback:start-live` → `{channelLogin, quality}` → `Promise<{playbackId}>`
  - [ ] `playback:stop`
  - [ ] `playback:event` (main → renderer, `{kind, payload?}`)

### Renderer (UI)
- [ ] Preload + `t4sd.d.ts` erweitern: `window.t4sd.playback.{startLive, stop, onEvent}`
- [ ] `src/renderer/src/screens/ChannelScreen.tsx` — Detail-Screen:
  - [ ] Hero mit Thumbnail/Avatar + Kanalname + Titel + Spiel + Viewer
  - [ ] Button „Live ansehen" (default `best`)
  - [ ] Quality-Picker als Dropdown/Liste (`best`, `720p`, `480p`, `audio_only`) — MVP optional,
        kann mit Default `best` beginnen und später nachgezogen werden
  - [ ] „Zurück"-Button (B / Escape)
- [ ] Routing in `AppShell.tsx` erweitern: `selectedChannel: FollowedChannelInfo | null` State,
      wenn gesetzt → `ChannelScreen` statt `FollowingScreen` anzeigen
- [ ] `FocusableCard.onSelect` → setzt `selectedChannel`
- [ ] Spatial-Nav: B-Taste / Escape im ChannelScreen → zurück zu FollowingScreen

### Verifikation
- [ ] 5 min Live-Stream ohne Werbe-Unterbrechung auf Windows (Dev-Setup)
- [ ] Beim Stop: mpv-Fenster schließt sich sauber, streamlink-Prozess terminiert,
      keine Zombie-Prozesse im Task-Manager
- [ ] Logout/Login und erneutes Starten funktioniert ohne App-Neustart

## Phase 4 — VOD-Browsing + -Wiedergabe
- [ ] Helix `GET /videos?user_id=…&type=archive` (paginiert)
- [ ] VOD-Listen-Screen pro Channel
- [ ] `playback:start-vod` (mit optionaler Resume-Position)
- [ ] mpv-Resume: `--start=<seconds>` beim Spawn

## Phase 5 — Lokaler VOD-Verlauf
- [ ] SQLite-Setup: `src/main/store/db.ts` (better-sqlite3, Migrations)
- [ ] `historyRepo.ts` mit `vod_history`-Tabelle (siehe plan.md)
- [ ] mpv `time-pos`-Observer schreibt alle ~5s in DB
- [ ] „Continue Watching"-Reihe auf HomeScreen
- [ ] Auto-Complete bei >95% Wiedergabefortschritt

## Phase 6 — Flatpak-Packaging
- [ ] `flatpak/tv.twitch4steamdeck.App.yml` Manifest (Runtime, Module, Permissions)
- [ ] mpv + streamlink als Flatpak-Module bündeln
- [ ] Test-Build: `flatpak-builder --user --install build-dir flatpak/…yml`
- [ ] Auf Steam Deck (oder VM) installieren und Login + Live + VOD durchspielen
- [ ] Als Non-Steam-Game in Gaming Mode hinzufügen, dort testen

## Post-MVP (bewusst nicht im ersten Release)
- [ ] Chat (Live + VOD-Replay) inkl. BTTV/FFZ/7TV
- [ ] Suche / Kategorien-Browsing
- [ ] Eigene Twitch-Client-ID im Build verankert
- [ ] README mit Disclaimer (ToS) + Setup-Anleitung
- [ ] Flathub-Einreichung
