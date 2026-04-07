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
- [ ] **End-to-End-Verifikation durch User** (Login mit echter Twitch-App durchführen)
- [ ] Token-Persistenz prüfen: App-Neustart → bleibt eingeloggt
- [ ] Logout testen: `userData/twitch-tokens.bin` wird gelöscht

## Phase 2 — Twitch Helix-Client + Followed-Channels-Home-Screen
- [ ] `src/main/twitch/types.ts` (Helix-Response-Typen)
- [ ] `src/main/twitch/helixClient.ts` (fetch-Wrapper, Auto-Refresh bei 401, Auth-Header,
      Client-ID-Header)
- [ ] Helix-Endpoints implementieren:
  - [ ] `GET /users` (eigener User → user_id cachen)
  - [ ] `GET /channels/followed?user_id=…` (paginiert)
  - [ ] `GET /streams?user_id=…&user_id=…` (batched, max 100 IDs pro Call)
- [ ] IPC: `twitch:get-followed`, `twitch:get-live` registrieren
- [ ] Preload-API erweitern: `window.t4sd.twitch.{getFollowed, getLive}`
- [ ] `HomeScreen.tsx` — Karten-Grid mit Live-Indicator, Vorschaubild, Titel, Zuschauerzahl
- [ ] Spatial-Navigation einbauen (Lib-Auswahl: `@noriginmedia/norigin-spatial-navigation` evaluieren)
- [ ] Gamepad-Service: `src/renderer/src/input/gamepad.ts` (Gamepad-API → Fokus-Events)

## Phase 3 — Streamlink + mpv (Live-Wiedergabe)
- [ ] `src/main/playback/streamlink.ts` — Subprozess-Spawning, `--twitch-disable-ads`,
      OAuth-Header für Sub-only Inhalte, optional TTV.LOL-Plugin
- [ ] `src/main/playback/mpvController.ts` — Spawn mpv mit `--input-ipc-server`,
      Unix-Socket JSON-IPC (Win: Named Pipe), `pause`/`seek`/`quit`-Befehle,
      `observe_property time-pos`
- [ ] IPC: `playback:start-live`, `playback:stop`
- [ ] Channel-Detail-Screen mit „Live ansehen"-Button
- [ ] Quality-Picker
- [ ] End-to-End: 5 min Live-Stream ohne Werbe-Unterbrechung

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
