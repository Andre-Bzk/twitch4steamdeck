# Twitch4SteamDeck — Architekturplan

> Spiegel von `C:\Users\andre\.claude\plans\smooth-shimmying-parasol.md`.
> Fortschritt steht in `todo.md`, aktueller Stand in `CLAUDE_PROGRESS.md`.

## Ziel

Steam-Deck-App zur **werbefreien** Wiedergabe von Twitch-Livestreams und -VODs.
Big-Screen-/10-Foot-UI, vollständig per Gamepad bedienbar. Lokaler VOD-Verlauf
mit Resume. Verteilung als Flatpak.

## Tech-Stack (entschieden)

| Bereich | Wahl |
|---|---|
| Sprache/Runtime | TypeScript + Electron (Main + Renderer) |
| UI | React + CSS, Spatial-Navigation für Gamepad |
| Wiedergabe | externer **mpv**-Prozess via JSON-IPC-Socket |
| Stream-Quelle / Ad-Bypass | **Streamlink** (Subprozess) + `--twitch-disable-ads`, optional TTV.LOL |
| Twitch-Auth | **OAuth 2.0 Device Code Flow** |
| Twitch-Daten | Helix-API (`api.twitch.tv/helix`) |
| Token-Storage | Electron `safeStorage` → `userData/twitch-tokens.bin` |
| Lokale Persistenz | SQLite via `better-sqlite3` (VOD-Verlauf, Settings) |
| Packaging | `electron-builder` → Flatpak |

## MVP-Scope

1. Twitch-Login via Device Code Flow
2. Followed Channels (Liste, Live-Indicator)
3. Live-Stream-Wiedergabe werbefrei (Streamlink → mpv)
4. VOD-Browsing pro Kanal
5. VOD-Wiedergabe werbefrei
6. Lokaler VOD-Verlauf + Resume + „Continue Watching"-Reihe

**Bewusst nicht im MVP:** Chat/Emotes, Suche (Text-Input), PiP, Themes.

## Architektur

```
┌─────────────────────────────────────────────────┐
│ Electron Main Process (Node)                    │
│  - AuthService (Device Code Flow, Refresh)      │
│  - TwitchApiClient (Helix)                      │
│  - StreamlinkRunner (spawn streamlink)          │
│  - MpvController (spawn mpv, JSON-IPC)          │
│  - HistoryStore (better-sqlite3)                │
│  - SettingsStore                                │
└──────────────┬──────────────────────────────────┘
               │ IPC (contextBridge / preload)
┌──────────────┴──────────────────────────────────┐
│ Electron Renderer (React + TS)                  │
│  - Screens: Login, Home, Channel, Player        │
│  - SpatialNavigation (Gamepad-Fokus)            │
│  - GamepadInputService                          │
└─────────────────────────────────────────────────┘
```

Wiedergabe läuft **außerhalb** Electron in einem mpv-Vollbildfenster.
Electron startet/stoppt mpv, sendet Befehle, lauscht auf `time-pos` für Verlaufsspeicherung.

## Verzeichnisstruktur (Ist-Stand + Soll)

```
twitch4steamdeck/
├── package.json                          ✅
├── electron.vite.config.ts               ✅
├── electron-builder.yml                  ✅
├── .env.example                          ✅
├── flatpak/
│   └── tv.twitch4steamdeck.App.yml       ⏳ Phase 6
├── src/
│   ├── main/
│   │   ├── index.ts                      ✅ (Auth + Helix instanziiert)
│   │   ├── auth/
│   │   │   ├── deviceCodeFlow.ts         ✅
│   │   │   ├── tokenStore.ts             ✅
│   │   │   └── authService.ts            ✅
│   │   ├── twitch/
│   │   │   ├── helixClient.ts            ✅
│   │   │   └── types.ts                  ✅
│   │   ├── playback/
│   │   │   ├── types.ts                  ✅ Phase 3
│   │   │   ├── streamlink.ts             ✅ Phase 3
│   │   │   ├── mpvController.ts          ✅ Phase 3
│   │   │   └── playbackService.ts        ✅ Phase 3
│   │   ├── store/
│   │   │   ├── db.ts                     ⏳ Phase 5
│   │   │   ├── historyRepo.ts            ⏳ Phase 5
│   │   │   └── settingsRepo.ts           ⏳ Phase 5
│   │   └── ipc/
│   │       └── handlers.ts               ✅ (Auth + twitch:get-followed + playback:*)
│   ├── preload/
│   │   └── index.ts                      ✅ (auth + twitch APIs)
│   └── renderer/
│       ├── index.html                    ✅
│       └── src/
│           ├── main.tsx                  ✅
│           ├── App.tsx                   ✅ (Routing: LoginScreen / AppShell)
│           ├── screens/
│           │   ├── LoginScreen.tsx       ✅
│           │   ├── AppShell.tsx          ✅ (Sidebar + Main-Content, Region-Nav)
│           │   ├── FollowingScreen.tsx   ✅ (ersetzt die ursprünglich geplante HomeScreen.tsx)
│           │   ├── BrowseScreen.tsx      ✅ (Platzhalter)
│           │   ├── AccountScreen.tsx     ✅ (Platzhalter + Logout)
│           │   ├── ChannelScreen.tsx     ✅ Phase 3
│           │   └── PlayerLaunchScreen.tsx — entfällt (in ChannelScreen integriert)
│           ├── components/
│           │   ├── Sidebar.tsx           ✅
│           │   ├── Icons.tsx             ✅ (inline SVG: Heart/Compass/User)
│           │   └── FocusableCard.tsx     ✅ (Block-Layout)
│           ├── input/
│           │   └── gamepad.ts            ✅
│           ├── types/
│           │   └── t4sd.d.ts             ✅
│           └── styles/
│               └── global.css            ✅
└── resources/
    └── icons/                            ⏳
```

**Architektur-Abweichungen vom Original-Plan (bewusst):**
- `HomeScreen.tsx` wurde durch `FollowingScreen.tsx` ersetzt und in ein `AppShell.tsx`-Layout
  mit linker `Sidebar.tsx` (3 Tabs: Du folgst / Durchsuchen / Mein Account) eingebettet.
- Spatial-Navigation ist eine **eigene Implementierung** (Region-basiert: `sidebar` ↔ `main`),
  kein `@noriginmedia/norigin-spatial-navigation`. Grund: einfacher, keine externe Dependency,
  volle Kontrolle über das Region-Switch-Verhalten.
- `FocusableCard` nutzt **Block-Layout** (nicht Flex), weil Flex im Zusammenspiel mit
  `aspect-ratio` und Grid-Zellen Schrumpf-Artefakte hatte.

## Kernkomponenten — Spezifikation

### Auth (✅ implementiert)
- Endpoint `POST https://id.twitch.tv/oauth2/device` mit `client_id` + `scopes` (space-sep).
- Anzeige `user_code` + `verification_uri` + QR.
- Polling `POST https://id.twitch.tv/oauth2/token` mit
  `grant_type=urn:ietf:params:oauth:grant-type:device_code`.
- Refresh-Token via Electron `safeStorage`.
- Auto-Refresh wenn Helix 401.
- Client-ID via `MAIN_VITE_TWITCH_CLIENT_ID` (`.env` im Projektroot, electron-vite lädt sie).
- Scope MVP: `user:read:follows`.

### Helix-Client (✅ implementiert)
Implementierte Endpoints (in `src/main/twitch/helixClient.ts`):
- `GET /users` (eigener User → `cachedUserId`)
- `GET /users?id=…` (batched, für Avatare der Followed-Kanäle)
- `GET /channels/followed?user_id=…` (paginiert via `after`, safety-cap 500)
- `GET /streams?user_id=…` (batched, max 100 IDs/Call)
- `GET /videos?user_id=…&type=archive` — `getVideos()` ✅
- `GET /games/top` — `getTopGames()` ✅ Phase 5.5
- `GET /streams` (global + game_id) — `getTopStreams()` ✅ Phase 5.5

Header: `Client-Id: <id>`, `Authorization: Bearer <access_token>`.
`getFollowedWithLiveStatus()` merged Followed + Live + Avatare zu `FollowedChannelInfo[]` und
sortiert live-zuerst, dann alphabetisch.

### Streamlink + mpv (✅ Phase 3 + 4)

**Zwei unterschiedliche Spawn-Strategien (implementiert):**

**Live-Streams** (`spawnStreamlink`):
```
streamlink --player <mpv-bin> --player-args "--fullscreen" twitch.tv/<channel> best
```
- streamlink spawnt mpv als Kind-Prozess, kein IPC
- `--twitch-disable-ads` wurde von streamlink deaktiviert (deprecated) — kein Ad-Bypass
- `--twitch-api-header=Authorization=OAuth` wird **nicht** übergeben: Twitch lehnt
  Device-Code-Flow-Token für streamlinks interne GQL-API ab

**VODs** (`getStreamUrl` + `spawnMpv`):
```
# Schritt 1: HLS-URL abrufen
streamlink --stream-url https://www.twitch.tv/videos/<id> best
# → gibt z.B. https://…/playlist.m3u8 zurück

# Schritt 2: mpv direkt mit HLS-URL starten
mpv <hls-url> --input-ipc-server=<ipcPath> --fullscreen --hwdec=<auto|vaapi> --start=<resumePos>
```
- mpv wird direkt gespawnt (nicht via streamlink) → HLS-URL ist seekable → Seeking/Fortschrittsbalken funktioniert
- IPC funktioniert zuverlässig (direkter mpv-Prozess, kein Pfad-Escaping durch streamlink)
- `--hwdec=auto` auf Windows, `--hwdec=vaapi` auf Linux/Steam Deck

**IPC-Pfade:**
- Windows: Named Pipe `\\.\pipe\twitch4sd-mpv`
- Linux/Flatpak: Unix Socket `/tmp/twitch4sd-mpv.sock`

**mpvController** (`src/main/playback/mpvController.ts`):
- `connect(retries, delayMs)` — verbindet nach Spawn
- `observeTimePos(cb)` — registriert `observe_property 1 time-pos`, parst JSON-Lines
- `quit()` — sendet `{"command":["quit"]}` via IPC
- Wird bei Live-Streams instanziiert aber nie verbunden (harmlos)

**IPC zwischen Renderer und Main:**
- `playback:start-live` → `(channelLogin, quality?)` → `PlaybackService.startLive()`
- `playback:start-vod` → `(vodId, channelLogin, title, durationSeconds)` → `PlaybackService.startVod()`
- `playback:stop` → `PlaybackService.stop()`
- `playback:event` (main → renderer) → `{kind: 'started'|'stopped'|'error', message?}`

### VOD-History-DB (✅ Phase 5)
```sql
CREATE TABLE vod_history (
  vod_id                   TEXT PRIMARY KEY,
  channel_login            TEXT NOT NULL,
  title                    TEXT,
  duration_seconds         INTEGER,
  resume_position_seconds  INTEGER NOT NULL DEFAULT 0,
  watched_at               INTEGER NOT NULL,
  completed                INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_history_watched ON vod_history(watched_at DESC);
```
- DB-Pfad: `app.getPath('userData')/history.db`, WAL-Modus
- Complete-Threshold: `resume_position / duration > 0.95`
- `„Continue Watching"-Reihe` bewusst weggelassen (nicht benötigt)
- IPC: `history:get-progress` → `(vodIds: string[]) → Record<vodId, VodProgress>`
- VOD-Karte zeigt: Fortschrittsbalken, `0:16 von 6:22`, `Vor X Min.`, Completed-Overlay

### Big-Screen-UI / Gamepad
- Spatial-Navigation-Lib oder eigene Mini-Implementierung.
- Fokus-Ring deutlich sichtbar.
- Schrift: min. 22px Body, 36px+ Headlines.
- Mapping: D-Pad/Stick = Navigation, A = Aktivieren, B = Zurück, Y = Refresh, Start = Menü, L1/R1 = Tab.

### Flatpak (⏳ Phase 6)
- Runtime: `org.freedesktop.Platform//23.08`, `org.electronjs.Electron2.BaseApp`
- Module: app-bundle, `mpv`, `streamlink` (pip), evtl. `streamlink-ttvlol`
- Permissions: `--share=network`, `--share=ipc`, `--socket=wayland`, `--socket=fallback-x11`,
  `--socket=pulseaudio`, `--device=dri`

## Verifikation

End-to-End auf Steam Deck oder Linux-Box:
1. Build: `npm install && npm run build && flatpak-builder --user --install build-dir flatpak/…yml`
2. Login-Flow mit Device-Code + Smartphone
3. Live-Stream 5+ Min ohne Werbe-Unterbrechung (Streamlink-Debug-Logs gegenchecken)
4. VOD ansehen, mpv beenden, neu starten → springt an gespeicherte Position
5. Komplette Bedienung nur mit Steam-Deck-Controller
6. Im Gaming Mode als Non-Steam-Game starten und alles wiederholen

## Offene Punkte (Post-MVP)
- Eigene `client_id` im Build vor Release.
- Chat / Emotes (BTTV/FFZ/7TV).
- Suche, Kategorien, Top-Streams.
- README + ToS-Disclaimer (Twitch-Werbeumgehung kann gegen ToS verstoßen).
