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
- [x] **User:** `mpv` installieren — `winget install shinchiro.mpv`, via `setx` zum PATH
- [x] **User:** `streamlink` installieren — `winget install streamlink` (8.2.1)
- [x] **User:** Baseline-Test erfolgreich:
      `streamlink --twitch-disable-ads twitch.tv/streamerhouse best --player mpv`

### Backend (Main-Prozess)
- [x] `src/main/playback/types.ts`
- [x] `src/main/playback/streamlink.ts` — `resolveStreamlinkBin()` (Win32-Pfad-Auflösung),
      `spawnStreamlink()` mit `--player mpv --player-args "..."` (Variante 2)
- [x] `src/main/playback/mpvController.ts` — Named Pipe (Win32) / Unix Socket (Linux),
      connect mit Retry, `quit()`, `disconnect()`
- [x] `src/main/playback/playbackService.ts`
- [x] IPC-Kanäle: `playback:start-live`, `playback:stop`, `playback:event`

### Renderer (UI)
- [x] Preload + `t4sd.d.ts` erweitern: `window.t4sd.playback.{startLive, stop, onEvent}`
- [x] `src/renderer/src/screens/ChannelScreen.tsx` (Hero + Live-Button + Zustandsanzeige)
- [x] Routing in `AppShell.tsx`: `selectedChannel`-State → `ChannelScreen`
- [x] `FocusableCard.onSelect` → setzt `selectedChannel` via `onSelectChannel`-Prop
- [x] Spatial-Nav: Escape/B im ChannelScreen → Stop oder Zurück

### Verifikation
- [x] Stream startet: mpv-Fenster öffnet sich, Stream spielt ab (2026-04-08)
      _(Fix: --twitch-api-header entfernt, resolveMpvBin() ergänzt)_
- [x] **User:** Stop-Verhalten: mpv-Fenster schließt sich, keine Zombie-Prozesse (2026-04-08)
- [x] **User:** Logout → Login → Stream starten funktioniert ohne App-Neustart (2026-04-08)
      ⚠️ `--twitch-disable-ads` ist von streamlink deaktiviert — Werbung wird ggf. abgespielt (Post-MVP)

## Phase 4 — VOD-Browsing + -Wiedergabe
- [x] Helix `GET /videos?user_id=…&type=archive` → `getVideos()` in helixClient
- [x] VOD-Shelf im ChannelScreen (horizontal, obere Hälfte fix)
- [x] `playback:start-vod` IPC-Kanal + `PlaybackService.startVod()`
- [x] mpv `--start=<seconds>` beim Spawn (Parameter vorbereitet für Phase 5)
- [x] **User:** VOD-Wiedergabe + Stop-Verhalten verifiziert (2026-04-08)

## Phase 5 — Lokaler VOD-Verlauf (Resume)
- [x] SQLite-Setup: `src/main/store/db.ts` (better-sqlite3, Migration)
- [x] `historyRepo.ts` mit `vod_history`-Tabelle
- [x] mpv `time-pos`-Observer schreibt alle ~5s in DB
- [x] Auto-Resume: beim VOD-Start Position aus DB lesen → `--start=<s>`
- [x] Auto-Complete bei >95% Wiedergabefortschritt
- [x] Resume-Indikator auf VOD-Karte (Fortschrittsbalken + „0:16 von 6:22" + „Vor X Min.")
- [x] Completed-Indikator (dunkles Overlay + Checkmark)
- [x] **User:** Verifiziert (2026-04-08)
- ~~„Continue Watching"-Reihe~~ — entfällt (nicht benötigt)

## Phase 5.5 — Browse-Menü: Kategorien + Top Live-Streams

- [x] `HelixGame`, `GameInfo` Typen in `types.ts`
- [x] `helixClient.ts`: `getTopGames()` + `getTopStreams(gameId?)`
- [x] IPC: `twitch:get-top-games`, `twitch:get-top-streams`
- [x] Preload + `t4sd.d.ts`: Typen + API-Methoden
- [x] `gamepad.ts`: Button 2 (X) → `'x'`, Button 3 (Y) → `'y'`
- [x] `BrowseScreen.tsx`: Shelf (Top Live) + Grid (Kategorien), Key-Mapping
- [x] `CategoryScreen.tsx`: Streams-Grid pro Game
- [x] `AppShell.tsx`: `selectedCategory`-Routing
- [x] `global.css`: Browse/Game-Card-Styles
- [x] **User:** End-to-End-Verifikation (Browse laden, Live starten, Kategorie-Drilldown)

## Phase 5.6 — Einstellungen + Sprach-Badge/Flagge

- [x] `language` in `HelixStream` + `FollowedChannelInfo` (types.ts, preload, t4sd.d.ts)
- [x] `helixClient.ts`: `language` in `getTopStreams` + `getFollowedWithLiveStatus`
- [x] `SettingsContext.tsx`: Provider + `useSettings()` + localStorage-Persistenz
- [x] `Icons.tsx`: `SettingsIcon` (Zahnrad)
- [x] `Sidebar.tsx`: 4. Tab „Einstellungen"
- [x] `LanguageBadge.tsx`: Badge/Flag/Both Rendering + 38-Sprachen-Map
- [x] `SettingsScreen.tsx`: Radio-Liste mit 4 Optionen
- [x] `AppShell.tsx`: Settings-Tab routen
- [x] `main.tsx`: `<SettingsProvider>` um App
- [x] `FocusableCard.tsx`: LanguageBadge unten-rechts
- [x] `BrowseScreen.tsx`: LanguageBadge in Shelf-Cards
- [x] `global.css`: Badge + Settings-Screen Styles
- [x] **User:** End-to-End-Verifikation (Einstellungen + Badge funktionieren, Persistenz bestätigt; Flaggen erst auf Steam Deck testbar)

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
