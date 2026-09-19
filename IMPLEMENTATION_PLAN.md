# POESTASH Implementation Plan

> Master implementation roadmap for evolving the current PoE Quick Price Checker into a local Path of Exile companion with a desktop bridge, in-game quick inspect, and Exile-UI-inspired item analysis.

---

## 1. Target Product Vision

The project should evolve from a browser-based PoE market checker into a local companion application:

```text
POESTASH
├── Market / poe.ninja
├── Quick Inspect from inside the game
├── Item Analyzer inspired by Exile-UI Item-info
├── Desktop Bridge / Launcher
└── Web UI as the main interface
```

The key design rule is:

> Do not build the new desktop/item-analysis features on top of the current data-integrity and concurrency bugs.

Therefore, Phase 0 is mandatory before the new features.

---

# 2. Final Architecture

```text
                         PATH OF EXILE
                              │
                    hover item + hotkey
                              │
                       one Ctrl+C
                              │
                              ↓
┌─────────────────────────────────────────────────────┐
│               POESTASH DESKTOP                     │
│                 C# / .NET                          │
│                                                     │
│ • System tray                                      │
│ • Global hotkeys                                   │
│ • Detect PoE                                       │
│ • Clipboard capture                                │
│ • Start/stop Node                                  │
│ • Port management                                  │
│ • Open/focus web UI                                │
└───────────────────────┬─────────────────────────────┘
                        │ localhost only
                        ↓
┌─────────────────────────────────────────────────────┐
│                    NODE BACKEND                     │
│                                                     │
│ Market Engine                                       │
│ • poe.ninja                                         │
│ • cache                                             │
│ • conversions                                       │
│                                                     │
│ Item Analyzer                                       │
│ • item parser                                       │
│ • base recognition                                  │
│ • affix matching                                    │
│ • mod tiers                                         │
│ • roll ranges                                       │
│ • DPS / defence                                     │
│ • unique info                                       │
│                                                     │
│ Bridge                                              │
│ • desktop events                                    │
│ • SSE                                               │
│ • latest inspection                                 │
└───────────────────────┬─────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────┐
│                       WEB UI                        │
│                                                     │
│ Market                                              │
│ Item Inspector                                      │
│ Price + Item Info                                   │
│ Compare                                             │
│ Alerts                                              │
│ Settings                                            │
│ Desktop connection status                           │
└─────────────────────────────────────────────────────┘
```

The web UI remains the primary interface.

The desktop application acts as:

- launcher
- process manager
- game detector
- global hotkey bridge
- clipboard capture layer

It should **not** contain pricing logic.

---

# PHASE 0 — Stabilise the Existing Codebase

This phase is mandatory before Desktop Bridge or Item Analyzer work begins.

## 0.1 Fix stale-cache destruction

### File

```text
services/cacheManager.js
```

### Current issue

The current merge flow removes previous category items before knowing whether the new fetch succeeded.

Current pattern:

```js
const keptItems = existingItems.filter(
    it => !typesSet.has(it.sourceType)
);
```

This means a transient API failure can wipe valid cached data.

### Correct architecture

Do not use:

```text
delete old
→ fetch
→ maybe fail
```

Use:

```text
fetch
↓
classify response

SUCCESS + DATA
→ replace category

SUCCESS + EMPTY confirmed
→ update according to category semantics

TRANSIENT ERROR
→ preserve old category
→ mark stale

404 / unsupported
→ mark unsupported
```

Create a helper such as:

```js
mergeCategoryResult({
    existingItems,
    sourceType,
    normalizedItems,
    fetchStatus
})
```

### Required regression tests

```text
HTTP 500 + previous cached data
→ previous data remains

network exception
→ previous data remains

HTTP 429
→ previous data remains

valid successful response
→ category is replaced

confirmed unsupported / 404
→ category marked unsupported
```

---

## 0.2 Fix Mirror rate corruption

### File

```text
services/cacheManager.js
```

### Current issue

A loose check such as:

```js
item.name.toLowerCase().includes('mirror')
```

can incorrectly match items such as:

```text
House of Mirrors
```

and overwrite the actual Mirror of Kalandra market rate.

### Fix

Only the `Currency` source is allowed to update Mirror rate.

```js
if (type === 'Currency') {
    // exact Mirror of Kalandra lookup
}
```

Use exact identity:

```text
Mirror of Kalandra
```

not substring matching.

### Regression test

Given:

```text
Currency:
Mirror of Kalandra = 50,000 chaos

DivinationCard:
House of Mirrors = 20,000 chaos
```

after the card refresh:

```text
mirrorPriceInChaos
```

must still equal:

```text
50,000
```

---

## 0.3 Remove fake market rates

### Files to audit

```text
public/js/app.js
public/js/modules/render.js
public/js/modules/modals.js
services/cacheManager.js
```

### Current problem

The frontend currently contains hard-coded market fallbacks such as:

```js
|| 366
```

and:

```js
|| 120
```

A market application must never fabricate a current rate.

### Replace with explicit status

```js
{
    value: 368.2,
    status: 'live' | 'stale' | 'unavailable',
    updatedAt: '...',
    staleReason: null
}
```

Unavailable UI:

```text
1 Divine = N/A
Waiting for market rate
```

---

## 0.4 Restrict the local server security boundary

### File

```text
server.js
```

### Current problem

The current server uses:

```js
app.use(cors());
```

and:

```js
app.listen(PORT)
```

without explicitly binding to loopback.

### Target

```js
const HOST = process.env.HOST || '127.0.0.1';
```

and:

```js
app.listen(PORT, HOST)
```

If the frontend is served from the same Express application, remove unrestricted CORS.

The entire application should communicate through:

```text
http://127.0.0.1:<port>
```

This becomes more important once endpoints such as these are added:

```text
/api/bridge/inspect
/api/analyze-item
```

---

## 0.5 Add a real health endpoint

The desktop launcher must determine whether an occupied port belongs to POESTASH.

Add:

```http
GET /api/health
```

Example response:

```json
{
  "app": "poestash",
  "version": "1.1.0",
  "status": "ok",
  "pid": 12345,
  "instanceId": "..."
}
```

---

## 0.6 Make full refresh single-flight

Use:

```text
game + league
```

as the job identity.

```js
refreshJobs = new Map();
```

Key:

```text
poe1:Allflame
```

If a refresh already exists, `/api/refresh` should either:

- return `409 refresh_already_running`, or
- attach to the existing Promise.

---

## 0.7 Replace `activeFetches` Set with single-flight Promises

Target:

```js
Map<fetchKey, Promise>
```

If a category fetch is already running:

```js
return await activeFetches.get(fetchKey);
```

---

## 0.8 Add request timeout and 429 handling

Use:

```js
AbortSignal.timeout(...)
```

Suggested range:

```text
10–15 seconds
```

Transient statuses:

```text
429
500
502
503
504
network timeout
```

should be retried with controlled backoff.

Respect `Retry-After` when available.

---

## 0.9 Fix PoEDB callback key mismatch

Use an event object instead of a composite string:

```js
{
    game: 'poe1',
    itemName: "Maven's Writ",
    description
}
```

---

## 0.10 Fix PoEDB listener leak

Use a `Set` and unsubscribe function:

```js
subscribe(callback) {
    this.callbacks.add(callback);

    return () => {
        this.callbacks.delete(callback);
    };
}
```

---

## 0.11 Fix Compare context

Compare entries must contain:

```js
{
    game,
    league,
    id,
    ...
}
```

For MVP, clear compare items when game or league changes.

Also fix:

```js
state.compareList.length
```

to:

```js
state.compareList.size
```

---

## 0.12 Make Price Alerts update with live data

Target:

```text
backend market refresh finishes
↓
marketUpdated SSE event
↓
frontend fetches new market data
↓
checkPriceAlerts()
```

Persist trigger state to avoid repeated toast spam.

---

## 0.13 Make disk cache loading resilient

Catch errors per file rather than around the entire load loop.

One corrupt cache file must not prevent the rest from loading.

---

## 0.14 Remove synchronous disk writes from hot paths

Introduce a write queue or debounced persistence layer for:

```text
cacheManager
poedbService
```

---

## 0.15 Prevent scheduler overlap

Avoid uncontrolled:

```js
setInterval(async () => ...)
```

Use `run → finish → setTimeout(next)` or an explicit scheduler lock.

---

## 0.16 Miscellaneous audit fixes

Fix:

- `>5d` boundary logic
- malformed sparkline/chart numeric input
- PoEDB cache directory inconsistency
- apostrophe fallback not being cached
- version drift between package/server/app/HTML
- stale diagnostics
- `lastAttemptAt` vs `lastSuccessAt`
- localStorage parsing resilience
- tooltip pointer-events behaviour
- stale compare objects after refresh
- `start.bat` launch ordering if retained

---

## 0.17 Make tests deterministic

Create:

```text
test/
├── fixtures/
│   ├── poe1/
│   ├── poe2/
│   ├── clipboard/
│   └── api/
```

Normal:

```bash
npm test
```

must require:

```text
NO internet
NO runtime cache
NO running PoE
NO PoEDB
```

Move live tests to:

```bash
npm run test:live
```

---

# PHASE 1 — Refactor Node Server Lifecycle

Suggested structure:

```text
server/
├── createApp.js
└── lifecycle.js
```

`createApp()` constructs Express without listening.

`server.js` becomes the executable entry point.

Add graceful `SIGTERM` and `SIGINT` handling.

---

# PHASE 2 — Build the Desktop Host

Recommended stack:

```text
C#
.NET 8
WinForms infrastructure
```

Suggested project:

```text
desktop/
└── Poestash.Desktop/
    ├── Poestash.Desktop.csproj
    ├── Program.cs
    ├── AppController.cs
    │
    ├── Server/
    │   ├── ServerManager.cs
    │   ├── PortResolver.cs
    │   └── HealthClient.cs
    │
    ├── Game/
    │   ├── PoeDetector.cs
    │   └── PoeWindowService.cs
    │
    ├── Input/
    │   ├── HotkeyManager.cs
    │   ├── ClipboardService.cs
    │   └── InputSender.cs
    │
    ├── Bridge/
    │   └── BridgeClient.cs
    │
    ├── UI/
    │   ├── TrayManager.cs
    │   └── SettingsForm.cs
    │
    └── Settings/
        └── SettingsStore.cs
```

---

# PHASE 3 — Desktop Launcher Behaviour

Launch flow:

```text
POESTASH.exe
↓
single-instance check
↓
find existing POESTASH server
↓
reuse or start Node
↓
wait for /api/health
↓
start tray
↓
register hotkeys
↓
open web UI
```

## 3.1 Single instance

Use a named mutex:

```text
POESTASH_DESKTOP_SINGLE_INSTANCE
```

## 3.2 Port resolution

```text
try configured port
↓
occupied?
├── no → use
└── yes
     ↓
 GET /api/health
     ↓
 POESTASH?
 ├── yes → reuse
 └── no → next port
```

Suggested range:

```text
3000–3010
```

## 3.3 Bundle Node

Release package:

```text
POESTASH/
├── POESTASH.exe
├── runtime/
│   └── node.exe
├── app/
│   ├── server.js
│   ├── services/
│   └── public/
```

## 3.4 Tray UI

```text
POESTASH
────────────────────
● Server running
● PoE detected
● Web connected

Quick Inspect     Ctrl+Shift+D

Open POESTASH
Settings
Restart Server
Exit
```

---

# PHASE 4 — Desktop ↔ Web Bridge

Backend:

```text
services/bridge/
├── bridgeState.js
└── quickInspectBroker.js
```

Routes:

```text
routes/bridgeRoutes.js
```

## 4.1 Desktop sends item

```http
POST /api/bridge/inspect
```

```json
{
  "requestId": "uuid",
  "game": "poe1",
  "source": "clipboard",
  "rawText": "Item Class: ...",
  "capturedAt": "..."
}
```

## 4.2 Browser SSE

```http
GET /api/bridge/events
```

## 4.3 Cold-start recovery

```http
GET /api/bridge/latest
```

## 4.4 Bridge status

```http
GET /api/bridge/status
```

---

# PHASE 5 — Quick Inspect Global Hotkey

Default:

```text
Ctrl + Shift + D
```

Flow:

```text
hotkey pressed
↓
is PoE foreground?
├── no → ignore
└── yes
     ↓
 clear clipboard
     ↓
 send Ctrl+C
     ↓
 wait for clipboard
     ↓
 validate PoE item
     ↓
 POST backend
```

No continuous scanning, automatic clicking, or input spam.

---

# PHASE 6 — Canonical Item Model

Create:

```text
services/itemAnalyzer/
├── itemTextParser.js
├── itemClassifier.js
├── itemAnalyzer.js
├── modMatcher.js
├── rollAnalyzer.js
├── baseAnalyzer.js
├── dpsAnalyzer.js
├── uniqueAnalyzer.js
└── marketResolver.js
```

Example canonical item:

```js
{
  game: 'poe1',

  identity: {
    rarity: 'Rare',
    name: 'Doom Veil',
    baseType: 'Hubris Circlet',
    itemClass: 'Helmets'
  },

  properties: {
    itemLevel: 86,
    quality: 20,
    armour: null,
    evasion: null,
    energyShield: 284,
    ward: null,
    physicalDamage: null,
    elementalDamage: null,
    criticalChance: null,
    attacksPerSecond: null
  },

  requirements: {
    level: 69,
    str: null,
    dex: null,
    int: 154
  },

  sockets: [],

  modifiers: {
    enchants: [],
    implicits: [],
    explicits: [],
    fractured: [],
    crafted: []
  },

  flags: {
    corrupted: false,
    synthesised: false,
    mirrored: false,
    unidentified: false
  },

  rawText: "..."
}
```

---

# PHASE 7 — Integrate Exile-UI Item-info Data

Vendor useful datasets:

```text
data/vendor/exile-ui/
├── LICENSE.md
├── poe1/
│   ├── item-bases.json
│   ├── item-mods.json
│   └── item-drop-tiers.json
└── poe2/
    ├── item-bases.json
    ├── item-mods.json
    └── item-drop-tiers.json
```

Add:

```text
THIRD_PARTY_NOTICES.md
```

Do not mechanically port the full AHK `item-checker.ahk`.

Use the algorithms/data as reference and write a clean JS implementation.

---

# PHASE 8 — Item Classification

Possible classes:

```text
currency
fragment
divination_card
gem
map
unique_gear
rare_gear
magic_gear
normal_gear
jewel
flask
unknown
```

---

# PHASE 9 — Modifier Matching Engine

Input:

```text
+89 to maximum Life
```

Normalize:

```text
+# to maximum Life
```

Match using:

- item class
- base tags
- mod family
- numeric arity
- affix eligibility
- item level

Output:

```js
{
  text: '+89 to maximum Life',
  type: 'prefix',
  tier: 1,
  values: [
    {
      value: 89,
      min: 80,
      max: 89
    }
  ],
  requiredItemLevel: 64,
  confidence: 1
}
```

Ambiguous match:

```js
{
    confidence: 0.58,
    status: 'ambiguous',
    candidates: [...]
}
```

Never silently guess.

---

# PHASE 10 — Roll Analyzer

Formula:

```text
(value - min)
─────────────
(max - min)
```

Example:

```text
84 in range 80–89
≈ 44%
```

Output:

```js
{
  percentile: 0.444,
  display: '44%'
}
```

UI:

```text
T1  +84 Maximum Life

80 ├████░░░░░░┤ 89
        44%
```

Later support:

- inverted rolls
- multi-value mods
- negative ranges
- hybrid modifiers

Unsupported cases return `null`.

---

# PHASE 11 — Base Analyzer

Use base type, item class, and base tags to determine:

- base defence
- weapon base values
- requirements
- base percentile
- best-in-class comparison where useful

---

# PHASE 12 — DPS Analyzer

Parse:

```text
Physical Damage
Elemental Damage
Attacks per Second
```

Calculate:

```text
Physical DPS
Elemental DPS
Total DPS
```

Quality scaling needs dedicated tests.

---

# PHASE 13 — Unique Analyzer

Combine:

```text
clipboard
+
Exile-UI item data
+
poe.ninja market
```

Example:

```text
HEADHUNTER
Leather Belt

DROP INFO
Tier ...

ROLL QUALITY
Strength     84%
Dexterity    91%
Life         72%

MARKET
124 Divine

TREND
+3.4%
```

---

# PHASE 14 — Item Analyzer API

```http
POST /api/analyze-item
```

Request:

```json
{
  "game": "poe1",
  "rawText": "...",
  "source": "clipboard"
}
```

Response:

```json
{
  "success": true,
  "item": {},
  "classification": {
    "kind": "rare_gear"
  },
  "analysis": {
    "base": {},
    "mods": [],
    "dps": null,
    "unique": null
  },
  "market": null
}
```

---

# PHASE 15 — One Smart Hotkey

Main hotkey:

```text
Ctrl + Shift + D
```

Routing:

```text
Currency
→ Market Inspector

Unique
→ Market + Item Analyzer

Rare/Magic/Normal
→ Item Analyzer

Map
→ Map info + mods
```

Desktop captures. Backend decides behaviour.

---

# PHASE 16 — Web Item Inspector

Add:

```text
TOOLS
├── Item Inspector
├── Compare
└── Alerts
```

Frontend modules:

```text
public/js/modules/
├── bridge.js
├── itemInspector.js
└── itemInspectorRender.js
```

Example UI:

```text
DOOM VEIL
Hubris Circlet

Rare Helmet     Item Level 86

──────────────────────────────

DEFENCES

Energy Shield
284

──────────────────────────────

PREFIXES                    3 / 3

T1  +89 Maximum Life
80 ─────────────── 89
███████████████████ 100%

──────────────────────────────

SUFFIXES                    2 / 3

T2  +42 Fire Resistance

T1  +48 Cold Resistance

──────────────────────────────

CRAFTING

1 suffix available
```

Future tabs:

```text
Overview
Mods
Base
Market
Raw
```

---

# PHASE 17 — Manual Paste Uses the Same Analyzer

Existing:

```text
Ctrl+C in PoE
Alt+Tab
Ctrl+V in browser
```

should become:

```text
paste
↓
POST /api/analyze-item
↓
same Item Inspector
```

The backend analyzer is the canonical detailed parser.

---

# PHASE 18 — Bridge Connection UI

Show:

```text
Desktop Bridge ● Connected
```

or:

```text
Desktop Bridge ○ Offline
```

Settings:

```text
Quick Inspect
Hotkey        Ctrl + Shift + D

After inspect
● Focus POESTASH
○ Stay in game

☑ Open inspection automatically
☑ Restore previous clipboard
```

---

# PHASE 19 — Game Detection

Desktop should detect:

- PoE running
- PoE foreground
- PoE1 vs PoE2

Bridge payload:

```json
{
  "game": "poe2"
}
```

If needed, the browser automatically switches game context before showing the inspection.

---

# PHASE 20 — Market Resolver

Add:

```text
services/itemAnalyzer/marketResolver.js
```

Strategies:

```text
Currency
→ exact name

Divination Card
→ exact name

Unique
→ name + base when needed

Rare
→ no fake market price
```

Response:

```js
{
  strategy: 'exact_name',
  matched: true,
  confidence: 1,
  marketItem
}
```

---

# PHASE 21 — Complete Quick Inspect Event Flow

```text
USER
hover Headhunter
↓
Ctrl+Shift+D

DESKTOP
PoE active?
↓
Ctrl+C
↓
clipboard text
↓
POST /api/bridge/inspect

BACKEND
parse
↓
classify
↓
analyze
↓
market resolve
↓
store latest
↓
SSE event

WEB
receive
↓
switch game if required
↓
route result
↓
open Item Inspector
```

---

# PHASE 22 — Item Analyzer Test Fixtures

Create:

```text
test/fixtures/items/poe1/
├── currency-divine.txt
├── unique-headhunter.txt
├── rare-helmet.txt
├── magic-ring.txt
├── fractured-item.txt
├── crafted-item.txt
├── corrupted-item.txt
├── synthesised-item.txt
├── weapon.txt
└── map.txt
```

Create equivalent PoE2 fixtures.

Test:

- rarity
- name
- base
- class
- item level
- quality
- properties
- requirements
- sockets
- implicits
- explicits
- crafted
- fractured
- corrupted
- mod tier
- roll ranges
- roll percentile
- DPS

---

# PHASE 23 — Bridge Tests

Test:

```http
POST /api/bridge/inspect
```

Expected:

```text
analyzer called
latest inspection updated
SSE emitted
```

Also test:

```text
malformed clipboard → 400 invalid_item_text
duplicate requestId → do not process twice
```

---

# PHASE 24 — Desktop Tests

Unit-test:

```text
PortResolver
HealthClient
BridgeClient
SettingsStore
```

Do not require real PoE in CI.

---

# PHASE 25 — CI

GitHub Actions:

```text
Node tests
↓
Analyzer tests
↓
API integration
↓
Frontend syntax
↓
.NET build
↓
.NET tests
```

Normal CI:

```text
NO poe.ninja
NO PoEDB
NO PoE process
NO runtime cache
```

---

# PHASE 26 — Logging

Desktop:

```text
logs/desktop.log
```

Backend:

```text
logs/server.log
```

Suggested events:

```text
quick_inspect_received
analysis_completed
market_match
server_started
server_stopped
```

Do not log raw clipboard text by default.

---

# PHASE 27 — Error-State UX

Clipboard failure:

```text
No item detected
```

Backend unavailable:

```text
POESTASH server unavailable
```

Unsupported item:

```text
Item detected, but detailed analysis is not yet supported.
```

Market unavailable:

```text
Item information available
Market data unavailable
```

---

# PHASE 28 — Release Packaging

```text
POESTASH/
│
├── POESTASH.exe
├── runtime/
│   └── node.exe
│
├── app/
│   ├── server.js
│   ├── server/
│   ├── services/
│   ├── routes/
│   ├── public/
│   └── data/
│
├── THIRD_PARTY_NOTICES.md
└── LICENSE
```

User only launches:

```text
POESTASH.exe
```

No manual Node, npm, AHK, or browser startup required.

---

# PHASE 29 — Exit Lifecycle

If Desktop owns the Node process:

```text
Exit POESTASH
↓
graceful shutdown Node
```

If it reused an existing backend:

```text
do not kill external server process
```

Track:

```text
ownsProcess = true / false
```

---

# PHASE 30 — Versioning

Use one source of truth:

```text
package.json
```

Expose through:

```http
GET /api/health
```

Example:

```json
{
  "version": "1.1.0"
}
```

Web UI and desktop release version should derive from the same version.

---

# PHASE 31 — Recommended Final Repository Structure

```text
Test123/
│
├── desktop/
│   └── Poestash.Desktop/
│       ├── Server/
│       ├── Game/
│       ├── Input/
│       ├── Bridge/
│       ├── UI/
│       └── Settings/
│
├── data/
│   ├── cache/
│   └── vendor/
│       └── exile-ui/
│           ├── poe1/
│           └── poe2/
│
├── routes/
│   ├── marketRoutes.js
│   ├── bridgeRoutes.js
│   └── itemRoutes.js
│
├── server/
│   ├── createApp.js
│   └── lifecycle.js
│
├── services/
│   ├── cacheManager.js
│   ├── categoryRegistry.js
│   ├── conversionMath.js
│   ├── poedbService.js
│   │
│   ├── bridge/
│   │   ├── bridgeState.js
│   │   └── quickInspectBroker.js
│   │
│   └── itemAnalyzer/
│       ├── itemTextParser.js
│       ├── itemClassifier.js
│       ├── itemAnalyzer.js
│       ├── modMatcher.js
│       ├── rollAnalyzer.js
│       ├── baseAnalyzer.js
│       ├── dpsAnalyzer.js
│       ├── uniqueAnalyzer.js
│       └── marketResolver.js
│
├── public/
│   ├── index.html
│   ├── css/
│   └── js/
│       ├── app.js
│       └── modules/
│           ├── state.js
│           ├── api.js
│           ├── bridge.js
│           ├── itemInspector.js
│           ├── itemInspectorRender.js
│           └── ...
│
├── test/
│   ├── fixtures/
│   ├── cache/
│   ├── bridge/
│   ├── analyzer/
│   └── frontend/
│
├── server.js
├── package.json
├── THIRD_PARTY_NOTICES.md
└── LICENSE
```

---

# Recommended PR Order

| PR | Scope |
|---|---|
| PR 1 | Cache integrity + Mirror + market-rate correctness |
| PR 2 | Fetch timeout + 429 + refresh single-flight + schedulers |
| PR 3 | PoEDB callback/cache + compare + alerts + frontend audit fixes |
| PR 4 | Deterministic tests + CI |
| PR 5 | Server lifecycle + `/api/health` + localhost security |
| PR 6 | C# Desktop launcher + tray + Node management |
| PR 7 | Quick Inspect clipboard bridge + SSE |
| PR 8 | Canonical Item Parser |
| PR 9 | Exile-UI dataset integration + attribution |
| PR 10 | Mod/Base/Roll/DPS analyzers |
| PR 11 | Web Item Inspector |
| PR 12 | Smart hotkey market/analyzer routing |
| PR 13 | Packaging + settings + release polish |

---

# Phase Gates

## Before Desktop Bridge

```text
✓ cache does not lose valid data on API failure
✓ Mirror rate is protected
✓ fake market rates removed
✓ server binds to localhost only
✓ refresh jobs deduplicated
✓ npm test succeeds from a clean clone
```

## Before Item Analyzer UI

```text
✓ canonical item parser passes fixtures
✓ modifier matching exposes confidence
✓ unsupported mods are not silently guessed
✓ third-party attribution is included
```

## Before Release

```text
✓ one-click POESTASH.exe
✓ Node runtime bundled
✓ no npm installation requirement
✓ graceful shutdown
✓ web and desktop versions match
✓ test suite green
```

---

# Final User Experience

```text
Open POESTASH.exe
↓
Server starts
↓
Browser opens
↓
Play Path of Exile
```

Currency:

```text
Divine Orb
↓
Ctrl+Shift+D
↓
Market price
```

Unique:

```text
Headhunter
↓
Ctrl+Shift+D
↓
Market price
+ roll quality
+ unique info
+ price trend
```

Rare item:

```text
Rare Hubris Circlet
↓
Ctrl+Shift+D
↓
item level
+ base stats
+ prefixes/suffixes
+ modifier tiers
+ roll ranges
+ roll percentile
+ open affixes
```

---

# Core Design Principles

1. **Do not rewrite the current application unnecessarily.**
2. **Fix data correctness before adding major features.**
3. **Desktop Bridge handles OS/game integration only.**
4. **Node backend remains the source of truth for market and item analysis.**
5. **Web UI remains the main presentation layer.**
6. **Clipboard capture is the primary item-input method.**
7. **Never fabricate market rates or modifier tiers.**
8. **All ambiguous analysis must expose uncertainty.**
9. **Reuse Exile-UI concepts/data responsibly while keeping POESTASH architecture independent and maintainable.**
