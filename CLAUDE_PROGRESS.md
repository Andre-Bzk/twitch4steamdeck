# Twitch4SteamDeck — Fortschritts-Snapshot

> Stand: **Ende 2026-04-07**. Diese Datei dient als Übergabe zwischen Sessions.
> **Lies zuerst:** diese Datei + `todo.md` + `plan.md`.
> Architekturplan-Quelle: `C:\Users\andre\.claude\plans\smooth-shimmying-parasol.md` (im Repo gespiegelt).
>
> **Aktueller Stand:** Phase 0–2 abgeschlossen & vom User verifiziert. Als nächstes Phase 3 (Live-Wiedergabe).

---

## Bereits abgeschlossen

### ✅ Projekt-Skelett (Electron + Vite + React + TypeScript)
- `package.json`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`
- `electron.vite.config.ts`, `electron-builder.yml`, `.gitignore`
- Main-Prozess Stub: `src/main/index.ts` (BrowserWindow 1280×800, dunkles Theme)
- Preload-Stub: `src/preload/index.ts` (contextBridge → `window.t4sd`)
- Renderer: `src/renderer/index.html`, `src/renderer/src/main.tsx`, `App.tsx`,
  `styles/global.css` (Big-Screen-Baseline)
- **Status:** vom User bestätigt — `npm run dev` öffnet Fenster mit „Twitch4SteamDeck".

### ✅ Twitch OAuth Device Code Flow
- `src/main/auth/deviceCodeFlow.ts` — `requestDeviceCode()`, `pollForToken()`, `refreshAccessToken()`.
  Endpoints: `https://id.twitch.tv/oauth2/device`, `https://id.twitch.tv/oauth2/token`.
  Polling respektiert `interval`, `slow_down`, `expired`, `denied`, `cancelled`.
- `src/main/auth/tokenStore.ts` — Persistenz via Electron `safeStorage` (kein keytar/native module),
  Datei: `userData/twitch-tokens.bin`. Fallback unverschlüsselt mit `0o600` falls Encryption nicht verfügbar.
- `src/main/auth/authService.ts` — `EventEmitter`, Methoden: `init()`, `startDeviceFlow()`,
  `cancelFlow()`, `logout()`, `getValidAccessToken()` (mit Auto-Refresh, 60s Safety-Margin).
  Scope MVP: `['user:read:follows']`. Emittiert `'auth-event'`.
- `src/main/ipc/handlers.ts` — IPC-Kanäle: `auth:get-status`, `auth:start-device-flow`,
  `auth:cancel`, `auth:logout`, `auth:is-configured`, `auth:event` (main → renderer).
- `src/preload/index.ts` — exponiert `window.t4sd.auth.{isConfigured, getStatus, startDeviceFlow,
  cancel, logout, onEvent}`.
- `src/renderer/src/screens/LoginScreen.tsx` — Phasen `idle | starting | awaiting | error | not-configured`,
  QR-Code via `qrcode`-Lib, Countdown, Cancel-Button.
- `src/renderer/src/App.tsx` — Statusbasiertes Routing (`logged-out` → LoginScreen,
  `logged-in` → Platzhalter mit Logout-Button).
- `src/renderer/src/types/t4sd.d.ts` — globale Window-Typen (manuell synchron zu Preload).
- `.env.example` — Vorlage für `MAIN_VITE_TWITCH_CLIENT_ID`.
- **Status:** ✅ End-to-End vom User verifiziert (2026-04-07). Login, Token-Persistenz nach Neustart funktionieren. Logout noch nicht getestet (kommt später).

---

### ✅ Phase 2 — Twitch Helix-Client + Sidebar-Layout (2026-04-07, code-complete)
- `src/main/twitch/types.ts`, `helixClient.ts` — Helix-Wrapper: eigener User, followed channels (paginiert), live streams (batched), Avatare
- IPC `twitch:get-followed` in `handlers.ts`, `index.ts` (HelixClient-Instanz)
- Preload + `t4sd.d.ts` um `window.t4sd.twitch.getFollowed` erweitert
- **Sidebar-Layout:** `AppShell.tsx` als Post-Auth-Container mit `Sidebar.tsx` (Heart / Compass / User icons)
  - Tabs: "Du folgst" (Default), "Durchsuchen" (Placeholder), "Mein Account" (Placeholder + Logout)
  - Region-basierte Spatial-Navigation (`sidebar` ↔ `main`), Arrow-Left am linken Card-Grid-Rand springt in Sidebar
- `FollowingScreen.tsx` — Karten-Grid, live-first Sortierung, [Y] Refresh
- `FocusableCard.tsx` — **Block-Layout** (kein flex → kein overlap), Thumbnail/Avatar, LIVE-Badge, Viewer-Badge unten-links, Avatar+Name-Zeile, Titel, Spiel
- `Icons.tsx` — inline SVG-Icons
- `gamepad.ts` — Gamepad-Polling → synthetische KeyboardEvents (DPad + linker Stick + A/B)
- CSS komplett überarbeitet: `.app-layout` (Grid 260px / 1fr), `.sidebar`, `.screen`, `.card-grid` mit `grid-auto-rows: max-content`, `.card` mit Block-Layout
- **Entfernt:** alte `HomeScreen.tsx` (ersetzt durch FollowingScreen)
- **Status:** ✅ End-to-End vom User verifiziert (2026-04-07). Karten-Grid sauber, Tastatur-Navigation funktioniert, Sidebar-Switching ok.

**Offener Rest aus Phase 2 (nicht blockierend):**
- Logout-Test (`userData/twitch-tokens.bin` wird gelöscht) — kommt später beim nächsten vollständigen Durchlauf
- Gamepad-Test mit echtem Steam-Deck-Controller steht noch aus (Dev auf Windows)

---

## Wo wir gerade stehen — Start Phase 3

**Ziel Phase 3:** Live-Wiedergabe werbefrei via `streamlink | mpv` starten, vom `FollowingScreen` aus
per Kanal-Karte → `ChannelScreen` (Detail) → Button „Live ansehen" → externes mpv-Fenster.

### Was morgen zuerst passieren muss

**1. Dev-Tooling verifizieren (User-Aktion nötig):**
Wir entwickeln auf Windows, deployen später nach Linux/Flatpak. Für Phase 3 muss der User lokal:
- `mpv` installieren: `winget install mpv` (danach `mpv --version` in neuer Shell prüfen)
- `streamlink` installieren: `winget install streamlink` oder `pip install streamlink`
- **Baseline-Test** ohne unseren Code:
  ```
  streamlink --twitch-disable-ads twitch.tv/<live-kanal> best --player mpv
  ```
  → öffnet mpv-Fenster mit dem Stream. Wenn das klappt, wissen wir, dass die Pipeline auf der
  Windows-Dev-Umgebung grundsätzlich funktioniert und wir können im Code darauf aufbauen.

**Wenn der Baseline-Test scheitert**, haben wir entweder:
- fehlende Binaries (nicht im PATH)
- Twitch hat `--twitch-disable-ads` gebrochen → Fallback auf `streamlink-ttvlol`-Plugin
- Region-/Geo-Blocking

→ In diesem Fall **erst den Baseline fixen**, bevor Code geschrieben wird.

**2. Architektur-Entscheidung bestätigen (kurz abfragen):**
- Direkter Sprung von Karte → mpv **oder** dazwischen `ChannelScreen` als Detail-View?
- Plan sagt: `ChannelScreen` mit Detail + „Live ansehen"-Button. Das ist auch sinnvoll, weil
  in Phase 4 derselbe Screen die VOD-Liste hostet. Default: so umsetzen.
- Quality-Picker im MVP erstmal mit Fixed-Default `best`, UI-Dropdown nachziehen wenn Rest steht.

**3. Dateien, die in Phase 3 neu entstehen (siehe `todo.md` Phase 3 für Details):**

Main-Prozess:
- `src/main/playback/types.ts`
- `src/main/playback/streamlink.ts` — `spawnStreamlink({channelLogin, quality, oauthToken})`
- `src/main/playback/mpvController.ts` — Plattform-Weiche Named Pipe / Unix Socket, JSON-IPC
- `src/main/playback/playbackService.ts` — orchestriert streamlink + mpv, räumt auf
- Erweiterung `src/main/ipc/handlers.ts`: `playback:start-live`, `playback:stop`, `playback:event`

Renderer:
- `src/renderer/src/screens/ChannelScreen.tsx` — Detail-Screen mit „Live ansehen"-Button
- Erweiterung `AppShell.tsx`: `selectedChannel`-State, Routing FollowingScreen ↔ ChannelScreen
- Erweiterung Preload + `t4sd.d.ts`: `window.t4sd.playback.{startLive, stop, onEvent}`
- `FocusableCard.onSelect` verkabeln (aktuell nur `console.log`)

### Windows-spezifische Stolpersteine, die Claude morgen wissen muss

- **mpv IPC-Socket:** auf Windows Named Pipe im Format `\\.\pipe\twitch4sd-mpv-<pid>`, NICHT
  `/tmp/...sock`. In `mpvController.ts` mit `process.platform === 'win32'` verzweigen.
- **`net.createConnection` unter Windows mit Named Pipes:** funktioniert, erwartet aber den Pfad
  als `{path: '\\\\.\\pipe\\twitch4sd-mpv-...'}`.
- **hwdec-Flag:** auf Windows `--hwdec=auto` oder `--hwdec=d3d11va`, nicht `vaapi` (das ist Linux).
- **Pipe streamlink → mpv:** funktioniert unter Windows mit Node `spawn` und `stdio: ['pipe', ...]`
  und `streamlink.stdout.pipe(mpv.stdin)`. Oder alternativ: streamlink mit `--player mpv
  --player-args "..."` aufrufen und mpv selbst die Pipe machen lassen. Variante 1 gibt uns mehr
  Kontrolle, Variante 2 ist einfacher — **Vorschlag: mit Variante 2 starten**, später
  refactoren falls wir mpv-IPC direkt aus unserem Code brauchen.
- **Achtung bei Variante 2:** mpv-IPC-Socket muss als `--player-args` durchgereicht werden,
  z. B. `--player-args="--input-ipc-server=\\\\.\\pipe\\twitch4sd-mpv --fullscreen"`.
- **Prozess-Cleanup:** Beim App-Quit alle spawned Subprozesse killen (sonst Zombie-mpv-Fenster).
  `app.on('before-quit', () => playbackService.stopAll())`.

### Technische Baseline aus Phase 0–2 (Wiederholung für Sanity-Check)

- Electron 33, electron-vite, TypeScript 5.5, React 18
- Auth: `authService.getValidAccessToken()` liefert einen frischen OAuth-Token
  (Auto-Refresh via Refresh-Token, 60s Safety-Margin) — für `--twitch-api-header` direkt nutzbar
- HelixClient liefert `FollowedChannelInfo[]` mit `broadcasterLogin`, was als Channel-Name für
  `twitch.tv/<login>` passt
- IPC-Pattern: `ipcMain.handle` im Main, `ipcRenderer.invoke` im Preload, `contextBridge` exponiert
  `window.t4sd.*`. Main → Renderer Events via `webContents.send` + `ipcRenderer.on`

### Wichtiges Projekt-Memo

- Bei **allen Architekturänderungen** `plan.md` updaten (nicht nur `~/.claude/plans/...`).
- Nach **jeder Subaufgabe** Checkbox in `todo.md` setzen und 1-Zeilen-Update in dieser Datei.
- Dev-Host ist **Windows** (siehe Shell bash/Unix-Syntax in `/dev/null` etc.), Target ist
  **Steam Deck (Linux / Flatpak)** — plattform-spezifische Weichen einbauen, wo es um Pfade,
  Sockets und Hardware-Decoding geht.
- User akzeptiert „gut genug für MVP"-Entscheidungen (Quality-Picker später, kein Chat, etc.).
  **Nicht** mit Speculative Abstractions aufblähen.

---

## Erste Anweisung morgen an Claude (copy-paste)

> „Lies CLAUDE_PROGRESS.md, todo.md und plan.md. Wir wollen Phase 3 (Live-Wiedergabe via
> streamlink + mpv) starten. Frag mich zuerst, ob ich streamlink und mpv lokal installiert habe
> und ob der Baseline-Test aus CLAUDE_PROGRESS.md funktioniert, dann leg los."
