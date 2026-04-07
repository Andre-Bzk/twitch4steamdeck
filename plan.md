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

**Bewusst nicht im MVP:** Chat/Emotes, Suche, Kategorien, PiP, Themes.

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

## Verzeichnisstruktur (Soll)

```
twitch4steamdeck/
├── package.json
├── electron.vite.config.ts
├── electron-builder.yml
├── flatpak/
│   └── tv.twitch4steamdeck.App.yml
├── src/
│   ├── main/
│   │   ├── index.ts                     ✅
│   │   ├── auth/
│   │   │   ├── deviceCodeFlow.ts        ✅
│   │   │   ├── tokenStore.ts            ✅
│   │   │   └── authService.ts           ✅
│   │   ├── twitch/
│   │   │   ├── helixClient.ts           ⏳ Phase 2
│   │   │   └── types.ts                 ⏳ Phase 2
│   │   ├── playback/
│   │   │   ├── streamlink.ts            ⏳ Phase 3
│   │   │   └── mpvController.ts         ⏳ Phase 3
│   │   ├── store/
│   │   │   ├── db.ts                    ⏳ Phase 5
│   │   │   ├── historyRepo.ts           ⏳ Phase 5
│   │   │   └── settingsRepo.ts          ⏳ Phase 5
│   │   └── ipc/
│   │       └── handlers.ts              ✅ (nur Auth)
│   ├── preload/
│   │   └── index.ts                     ✅
│   └── renderer/
│       ├── index.html                   ✅
│       └── src/
│           ├── main.tsx                 ✅
│           ├── App.tsx                  ✅
│           ├── screens/
│           │   ├── LoginScreen.tsx      ✅
│           │   ├── HomeScreen.tsx       ⏳ Phase 2
│           │   ├── ChannelScreen.tsx    ⏳ Phase 3/4
│           │   └── PlayerLaunchScreen.tsx ⏳ Phase 3
│           ├── components/
│           │   ├── FocusableCard.tsx    ⏳ Phase 2
│           │   └── SpatialNav/          ⏳ Phase 2
│           ├── input/
│           │   └── gamepad.ts           ⏳ Phase 2
│           ├── types/
│           │   └── t4sd.d.ts            ✅
│           └── styles/
│               └── global.css           ✅
└── resources/
    └── icons/
```

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

### Helix-Client (⏳ Phase 2)
MVP-Endpoints:
- `GET /users` (eigener User)
- `GET /channels/followed?user_id=…` (paginiert via `after`)
- `GET /streams?user_id=…` (batched, max 100 IDs/Call)
- `GET /videos?user_id=…&type=archive`

Header: `Client-Id: <id>`, `Authorization: Bearer <access_token>`.

### Streamlink + mpv (⏳ Phase 3)
- `streamlink --twitch-disable-ads --twitch-api-header=Authorization=OAuth <token> --stdout twitch.tv/<channel> best`
- Pipe an `mpv -` mit `--input-ipc-server=/tmp/twitch4sd-mpv.sock --fullscreen --hwdec=vaapi`
- Auf Windows: Named Pipe statt Unix-Socket.

### VOD-History-DB (⏳ Phase 5)
```sql
CREATE TABLE vod_history (
  vod_id TEXT PRIMARY KEY,
  channel_login TEXT NOT NULL,
  channel_display TEXT,
  title TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  resume_position_seconds INTEGER NOT NULL DEFAULT 0,
  watched_at INTEGER NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_history_watched ON vod_history(watched_at DESC);
```
„Continue Watching": `SELECT … WHERE completed=0 ORDER BY watched_at DESC LIMIT 20`.
Complete-Threshold: `resume_position / duration > 0.95`.

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
