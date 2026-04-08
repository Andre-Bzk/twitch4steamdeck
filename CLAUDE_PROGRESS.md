# Twitch4SteamDeck — Fortschritts-Snapshot

> Stand: **Ende 2026-04-07 (Session 2)**. Diese Datei dient als Übergabe zwischen Sessions.
> **Lies zuerst:** diese Datei + `todo.md` + `plan.md`.
> Architekturplan-Quelle: `C:\Users\andre\.claude\plans\smooth-shimmying-parasol.md` (im Repo gespiegelt).
>
> **Aktueller Stand:** Phase 0–2 abgeschlossen & verifiziert. Phase 3 Code-complete, noch NICHT verifiziert (mpv PATH-Problem beim ersten Start).

---

## Bereits abgeschlossen

### ✅ Phase 0 — Projekt-Skelett
Siehe vorherige Sessions.

### ✅ Phase 1 — Twitch OAuth Device Code Flow
Siehe vorherige Sessions. End-to-End verifiziert 2026-04-07.

### ✅ Phase 2 — Twitch Helix-Client + Sidebar-Layout
Siehe vorherige Sessions. End-to-End verifiziert 2026-04-07.

---

### 🔄 Phase 3 — Streamlink + mpv (Live-Wiedergabe) — Code complete, nicht verifiziert

#### Neu erstellte Dateien (Session 2, 2026-04-07):

**Main-Prozess:**
- `src/main/playback/types.ts` — `PlaybackEvent`, `Quality`
- `src/main/playback/streamlink.ts` — `spawnStreamlink()` mit `resolveStreamlinkBin()` (sucht
  `.exe` in `%LOCALAPPDATA%\Programs\Streamlink\bin\` usw., Fallback `streamlink`)
- `src/main/playback/mpvController.ts` — `getMpvIpcPath()`, `MpvController` (Named Pipe Win32
  / Unix Socket), connect mit Retry, `quit()`, `disconnect()`
- `src/main/playback/playbackService.ts` — orchestriert streamlink + mpv, `startLive()`, `stop()`,
  `stopAll()`, emittiert `'playback-event'`
- `src/main/ipc/handlers.ts` — erweitert um `playback:start-live`, `playback:stop`,
  `playback:event` (main→renderer); `registerIpcHandlers` nimmt jetzt `PlaybackService` als 3. Arg
- `src/main/index.ts` — instanziiert `PlaybackService`, registriert
  `app.on('before-quit', () => playback.stopAll())`

**Preload + Typen:**
- `src/preload/index.ts` — `window.t4sd.playback.{startLive, stop, onEvent}` hinzugefügt
- `src/renderer/src/types/t4sd.d.ts` — `PlaybackEvent`-Typ + `playback`-API hinzugefügt

**Renderer:**
- `src/renderer/src/screens/ChannelScreen.tsx` — Detail-Screen: Thumbnail/Avatar/Name/Titel/Spiel/
  Viewer, Button „▶ Live ansehen", Zustandsanzeige (idle/starting/playing/error),
  Escape/B → Stop oder Zurück
- `src/renderer/src/screens/AppShell.tsx` — `selectedChannel`-State, Routing zu `ChannelScreen`,
  `onSelectChannel` an `FollowingScreen` weitergegeben
- `src/renderer/src/screens/FollowingScreen.tsx` — `onSelectChannel`-Prop verkabelt,
  `onSelect` der Karte ruft jetzt `onSelectChannel(ch)` auf (nicht mehr nur `console.log`)
- `src/renderer/src/styles/global.css` — `.channel-screen` + alle Unter-Klassen ergänzt

#### Architektur-Entscheidungen in Phase 3:
- **Variante 2:** streamlink spawnt mpv selbst via `--player mpv --player-args "..."`.
  Node steuert nur den streamlink-Prozess direkt.
- **mpv IPC** via Named Pipe (Win32) oder Unix Socket (Linux), verbunden nach `spawn` im Hintergrund
  (nicht blockierend, nicht kritisch für MVP). Wird für `quit()` beim Stop genutzt.
- **`resolveStreamlinkBin()`** sucht die `.exe` unter bekannten Windows-Installationspfaden,
  da Electron den User-PATH nicht vollständig erbt.

---

## Offener Punkt beim Start morgen — mpv PATH-Problem

### Was passiert ist:
Streamlink startet (ENOENT behoben via `resolveStreamlinkBin()`), aber streamlink
kann mpv nicht finden, weil **mpv nicht im PATH ist, den streamlink von Electron erbt**.

Fehlerbild: `[streamlink] exit code 1`, kein mpv-Fenster.

### Wahrscheinlichste Lösung (zuerst probieren):
**VS Code (und damit das Electron-Dev-Fenster) neu starten.** Nach dem `setx PATH ...`
für mpv muss VS Code neu gestartet werden, damit es den neuen PATH erbt.

```
1. VS Code schließen
2. VS Code neu öffnen
3. npm run dev
4. Kanal auswählen → "Live ansehen"
```

### Falls das nicht reicht — Fallback:
mpv-Pfad ebenfalls resolven wie streamlink. In `streamlink.ts` eine `resolveMpvBin()`-Funktion
ergänzen und den vollen Pfad an `--player` übergeben:

```typescript
// In streamlink.ts hinzufügen:
function resolveMpvBin(): string {
  if (process.platform === 'win32') {
    const candidates = [
      join(process.env.LOCALAPPDATA ?? '', 'Programs', 'mpv', 'mpv.exe'),
      // shinchiro winget installiert nach: %LOCALAPPDATA%\Microsoft\WinGet\Packages\...
      // Dort nach mpv.exe suchen wenn oben nicht gefunden
    ]
    for (const p of candidates) {
      if (existsSync(p)) return p
    }
  }
  return 'mpv'
}
```

Dann in `spawnStreamlink()`:
```typescript
'--player', resolveMpvBin(),   // statt '--player', 'mpv'
```

**Wichtig:** `where mpv` in der Shell ausführen um den exakten Pfad zu kennen, bevor
du `resolveMpvBin()` implementierst.

### Falls auch das nicht reicht:
streamlink selbst via `--player-args` testen ohne `--input-ipc-server` (vereinfachter Test),
um zu isolieren ob das Problem mpv-start oder IPC-Argument ist.

---

## Verifikations-Checkliste Phase 3 (noch offen)

- [ ] 5 min Live-Stream ohne Werbe-Unterbrechung auf Windows (Dev-Setup)
- [ ] Beim Stop: mpv-Fenster schließt sich sauber, streamlink-Prozess terminiert
- [ ] Keine Zombie-Prozesse im Task-Manager nach Stop
- [ ] Logout/Login und erneutes Starten funktioniert ohne App-Neustart

---

## Erste Anweisung morgen an Claude (copy-paste)

> „Lies CLAUDE_PROGRESS.md, todo.md und plan.md. Phase 3 ist code-complete. Das mpv
> PATH-Problem war der letzte offene Punkt — ich habe VS Code neugestartet (oder den
> Fallback umgesetzt). Sag mir ob der Stream jetzt läuft."

---

## Technische Baseline (Sanity-Check)

- Electron 33, electron-vite, TypeScript 5.5, React 18
- streamlink 8.2.1 installiert unter `%LOCALAPPDATA%\Programs\Streamlink\bin\streamlink.exe`
- mpv v0.41.0 installiert, via `setx` zum PATH hinzugefügt (VS Code-Neustart nötig!)
- IPC-Pattern: `ipcMain.handle` → `ipcRenderer.invoke` → `contextBridge` → `window.t4sd.*`
- Main→Renderer Events via `webContents.send` + `ipcRenderer.on`

### Wichtiges Projekt-Memo
- Bei **allen Architekturänderungen** `plan.md` updaten.
- Nach **jeder Subaufgabe** Checkbox in `todo.md` setzen und Update hier.
- Dev-Host: **Windows**. Target: **Steam Deck (Linux / Flatpak)**.
- **Nicht** mit Speculative Abstractions aufblähen.
