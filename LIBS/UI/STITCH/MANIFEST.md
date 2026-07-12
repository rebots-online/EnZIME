# EnZIME Stitch UI artifacts — MANIFEST

Stitch project: `projects/7808089884213645532`
Design system: `assets/e6a4c5bfcd374f5c95a6cfbfea8a12fe` (DESIGN.md frozen here)
Device: DESKTOP unless noted. Each screen dir holds `index.html` (integratable) + `screenshot.png` (review).
Per TC12: these are the UI source-of-truth; CODE-phase wires them in, never re-invents.

| # | Screen | Stitch screen id | dir | status |
|---|---|---|---|---|
| 02 | First-launch onboarding (AI setup) | 717d021f1dcd4fa0a02d6b99a78b7f38 | screens/02-first-launch | saved |
| 04 | Reader (split + co-visible notebook, Chat tab) | e40062bb2bd14aec8b825728e97eef56 | screens/04-reader | saved |
| 03 | Dynamic-Download catalog (Knowledge Packs) | 3d5f962f927f4023bd7714fb05864c76 | screens/03-catalog | saved |

## Remaining to generate (desktop unless noted)
01 Library/home · 05 Search · 07 Annotator (Notes tab/mgmt) · 08 Sidecar share + peer-trust ·
09 Model management (AI Models view) · 10 Settings · 11 Paywall (overlay) · 12 App-update (toast) ·
mobile variants: onboarding, library, catalog, reader(tabbed), chat, search.
| 01 | Library / home | 163ad666b67948d885a9b827b9d3383b | screens/01-library | saved |
| 05 | Global search results | 3c7cc8b3efac40869ba707792b6d6172 | screens/05-search | saved |
| 10 | Settings (model/reading/privacy/trust/storage/sub/about) | 1ff91f6aaa8a4f3b8338ce164db0588d | screens/10-settings | saved |
| 08 | Sidecar share + peer-trust (export/import+verify) | ec77f946888943619b8f7970fc23f1d8 | screens/08-sidecar-share | saved |
| 07 | Notebook / annotations management | eb681073a42946e7ace38df028c95a60 | screens/07-annotator | saved |
| 11 | Paywall overlay (EnZIME Pro, processor-agnostic) | 8cf2146ad9e54860bae02ebc6541dd7f | screens/11-paywall | saved |
| 04b | Reader (MOBILE/Android, tabbed) | 5f2da0aea55d49fd82822268b385f9e5 | screens/04b-reader-mobile | saved |
| 01b | Library / home (MOBILE/Android, bottom-nav) | 66c84849c53145b7a657d6aa68178af5 | screens/01b-library-mobile | saved |

## Navigation workflow (user journeys)

```
[02 First-launch] --device probe--> --pick variant--> --download OR Install-from-media-->
   --load model--> ready
        |
        v
[01 Library/home] <--bottom/side nav--> [03 Dynamic-Download catalog] --install/import--> pack ready
        |  open pack                                    (Knowledge Packs | AI Models toggle = model mgmt)
        v
[04 Reader (split: article + notebook)]
   |-- select text --> Highlight / Note / Ask AI
   |-- Notebook tab = Chat-with-ZIM (stream + voice)  OR  Notes
   |-- [05 Search] (global/in-pack) --AI suggest--> Chat
   |-- annotations flow to --> [07 Notebook/annotations] --Export .zsc--> [08 Sidecar share]
   |                                                      [08] Import .zsc --verify+trust prompt--> merge
   |-- gated action (export/multi-model) --not entitled--> [11 Paywall] --purchase--> entitled
        |
        v
[10 Settings] (AI model / reading / privacy+auto-lock / sharing+trust / storage / subscription / about)
[12 App-update] = desktop UpdateNotification toast (post-v1.0 channel); not a full screen.
```

Mobile (Android): split-view collapses to a tabbed Reader (04b) + bottom-nav shell (01b);
other screens reflow responsively from their desktop forms per DESIGN.md breakpoints.

## Status: COMPLETE — 11 screens elucidated (9 desktop + 2 Android) across all 12 journey areas.
Coverage notes: AI Chat + Notes = Reader notebook tabs (04). Model management = catalog
"AI Models" toggle (03) + Settings "AI Model" (10). App-update = toast, not a screen.
