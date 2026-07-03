# Mobile Dark Theme Redesign

Dark theme was applied to the desktop layout on June 27, 2026. This file tracks the remaining work to apply the same scheme to the mobile layout (viewport < 900px).

**Dark palette reference:**
- Background: `#0d1421` / `#141d2e` / `#1e2a3a`
- Borders: `#2a3a54`
- Text: `#ffffff` / `#a0b3cc` / `#6b7fa3`
- Accent: `blue-600`

---

## Phase 1 — Mobile CSS Foundation

- [x] `frontend/src/styles/mobile.css` — Update `.outdoor-text`: flip `color` from `#1f2937` to `#ffffff` and invert the `text-shadow` (currently uses white glow, needs dark glow for light text on dark surfaces)
- [x] `frontend/src/styles/mobile.css` — Review and update any other utility classes that assume light backgrounds

---

## Phase 2 — Core Mobile Shell

- [x] `frontend/src/components/Mobile/MobilePageLayout.tsx` — Dark header background (`#0d1421`), dark page background (`#141d2e`), white title text
- [x] `frontend/src/components/Mobile/BottomNavigationBar.tsx` — Replace `bg-white` with `#0d1421`, `border-gray-*` with `#2a3a54`, inactive icon/label text to `#6b7fa3`, active state to `blue-600`
- [x] `frontend/src/components/Mobile/BottomSheet.tsx` — Replace `bg-white` with `#141d2e`, drag handle to `#2a3a54`, backdrop remains dark semi-transparent
- [x] `frontend/src/components/Mobile/MobileMultiHeightDialog.tsx` — Audit and apply dark surface (`#141d2e`), dark borders, light text

---

## Phase 3 — Mobile Sheets & Overlays

- [x] `frontend/src/components/Mobile/MobileAddSiteSheet.tsx` — Dark sheet surface, dark input fields (`#1e2a3a` bg, `#2a3a54` border), labels to `#a0b3cc`
- [x] `frontend/src/components/Mobile/MobileToolsSheet.tsx` — Dark surface, replace indigo accent with `blue-600`, dark control backgrounds

---

## Phase 4 — Mobile Content Components

- [x] `frontend/src/components/Mobile/SwipeableForecastCards.tsx` — Card surface to `#141d2e`, card borders to `#2a3a54`, text to `#ffffff` / `#a0b3cc`
- [x] `frontend/src/components/Mobile/WeatherStatusBanner.tsx` — Replace `bg-white/95` with dark frosted equivalent, text to `#ffffff`

---

## Phase 5 — Page-Level Mobile Sections

These pages have mobile-specific layout branches (checked via `useIsMobile()` or responsive classes) that still render light-theme elements:

- [x] `frontend/src/pages/MapView.tsx` — Audit mobile map controls, info panels, and any overlays; apply dark theme to mobile-specific sections
- [x] `frontend/src/pages/LogbookPage.tsx` — Mobile table layout (`hidden md:table-cell` pattern); cards/rows need dark surfaces
- [x] `frontend/src/pages/FlightAnalysis.tsx` — Mixed dark/light; audit mobile breakpoints, ensure no light `sky-*` tokens render on mobile
- [x] `frontend/src/pages/FormationView.tsx` — Mixed; dark header present but content area is light — fix for mobile viewports
- [x] `frontend/src/pages/Leaderboards.tsx` — Still fully light theme; apply dark scheme for mobile layout
- [x] `frontend/src/pages/PilotPerformance.tsx` — Still fully light theme; apply dark scheme for mobile layout
- [x] `frontend/src/pages/MissionsPage.tsx` — Audit mobile layout for light-themed elements
- [x] `frontend/src/pages/EquipmentPage.tsx` — Desktop dark theme applied; verify mobile layout inherits correctly (no forced light overrides at narrow widths)

---

## Phase 6 — Auth Pages

Auth pages (`Login`, `Register`, `ResetPassword`, `SetupUsername`) are currently on a light theme across all viewports. These should be moved to the dark scheme:

- [x] `frontend/src/pages/Login.tsx` — Dark background, dark input fields, white labels
- [x] `frontend/src/pages/Register.tsx` — Same dark treatment as Login
- [x] `frontend/src/pages/ResetPassword.tsx` — Dark form layout
- [x] `frontend/src/pages/SetupUsername.tsx` — Dark form layout

---

## Phase 7 — Polish & QA

- [ ] Test on iOS Safari — verify safe-area padding (`pb-safe`, notch insets) still works on dark backgrounds
- [ ] Test on Android Chrome — verify ripple effect is visible on dark surfaces
- [ ] Outdoor visibility check — confirm `.outdoor-text` white text with dark glow is readable in bright sunlight
- [ ] Verify `BottomNavigationBar` iOS frosted-glass variant looks correct on dark background
- [ ] Check `BottomNavigationBar` Android ripple variant on dark surface
- [ ] Regression check — confirm desktop layout (viewport ≥ 900px) is unaffected by all changes above
