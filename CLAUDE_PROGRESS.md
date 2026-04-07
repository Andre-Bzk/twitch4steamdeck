# Twitch4SteamDeck — Fortschritts-Snapshot

> Stand: 2026-04-07. Diese Datei dient als Übergabe zwischen Sessions.
> **Lies zuerst:** diese Datei + `todo.md`. Der vollständige Architekturplan liegt unter
> `C:\Users\andre\.claude\plans\smooth-shimmying-parasol.md` (im Repo gespiegelt als `plan.md`).

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
- **Status:** noch nicht vom User getestet

## Wo wir gerade stehen

**Mitten in:** Phase 2 ist code-complete, wartet auf Verifikation durch den User.

**Konkret offen:**
1. User muss eine Twitch-App auf https://dev.twitch.tv/console/apps registrieren
   (Public Client, Redirect `http://localhost`) und die Client-ID in `.env` eintragen:
   ```
   MAIN_VITE_TWITCH_CLIENT_ID=<id>
   ```
2. `npm install` muss erneut laufen (neue Deps: `qrcode`, `@types/qrcode`).
3. `npm run dev` starten und den kompletten Login-Flow durchspielen:
   - Button „Mit Twitch verbinden" → QR + Code erscheinen
   - Auf Handy `twitch.tv/activate` öffnen, Code eingeben
   - App sollte automatisch zu „Eingeloggt"-Platzhalter wechseln
   - Neustart der App → sollte eingeloggt bleiben (Tokens in `userData/twitch-tokens.bin`)

**Mögliche Stolpersteine, die morgen früh zu prüfen sind:**
- `import.meta.env.MAIN_VITE_TWITCH_CLIENT_ID` im Main-Prozess: setzt voraus, dass electron-vite die
  `.env` lädt — falls nicht, alternativ `process.env.MAIN_VITE_TWITCH_CLIENT_ID` oder via
  `define`-Plugin in `electron.vite.config.ts` injizieren.
- TypeScript könnte über `import.meta.env` im Main-Prozess meckern. tsconfig.node.json hat
  `"types": ["node", "electron-vite/node"]` — sollte reichen.
- Renderer-Types: `src/renderer/src/types/t4sd.d.ts` muss von `tsconfig.web.json` erfasst werden
  (ist über `src/renderer/**/*.ts` abgedeckt).

---

## Nächster Schritt morgen (in dieser Reihenfolge)

1. **Fragen:** „Hat der Login-Flow gestern durchgelaufen? Falls Fehler, welche Logs?"
2. **Falls Fehler:** Erst diese fixen, bevor neue Features dazukommen.
   - Häufiger Verdächtiger: `import.meta.env`-Loading im Main → Workaround dokumentiert oben.
3. **Falls grün:** Direkt in **Schritt 2: Twitch Helix-Client + Followed-Channels-Home-Screen** einsteigen.
   - Neue Dateien planen: `src/main/twitch/helixClient.ts`, `src/main/twitch/types.ts`,
     IPC-Kanäle `twitch:get-followed`, `twitch:get-live-status`,
     Renderer-Screen `src/renderer/src/screens/HomeScreen.tsx` mit Spatial-Navigation-Karten.
   - Helix-Endpoints für MVP: `GET /users` (own), `GET /channels/followed`, `GET /streams` (batched).

---

## Wie morgen effektiv weiterarbeiten?

**Empfehlung:** Beim Sessionstart **diese drei Dateien in dieser Reihenfolge** lesen lassen:

1. `CLAUDE_PROGRESS.md` (diese Datei) — Snapshot
2. `todo.md` — Checkboxen-Tracker (jeder erledigte Schritt wird dort sofort abgehakt)
3. `plan.md` — gespiegelter Architekturplan (Quelle: `~/.claude/plans/smooth-shimmying-parasol.md`)

**Workflow:**
- Vor jeder Subaufgabe: relevanten Abschnitt in `todo.md` checken.
- Nach Abschluss: Checkbox in `todo.md` setzen + 1-Zeilen-Update in `CLAUDE_PROGRESS.md`
  unter „Bereits abgeschlossen".
- Bei Architekturänderungen: `plan.md` updaten (nicht nur die Kopie im `~/.claude/plans/`).

**Erste Anweisung morgen an Claude (copy-paste):**
> „Lies CLAUDE_PROGRESS.md, todo.md und plan.md. Frag mich, ob der Login-Flow gestern durchgelaufen ist,
> und mach dann mit dem nächsten offenen Schritt weiter."
