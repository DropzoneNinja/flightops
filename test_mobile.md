# Mobile UI Testing Checklist

## Access the App
- URL: http://localhost:5173/
- Test at: < 900px width for mobile, > 900px for desktop

## ✅ Phase 1-4 Implementation Tests

### Desktop Mode (> 900px)
- [ ] Header visible with all buttons
- [ ] Add Site panel slides from right
- [ ] Airspace filters in bottom-right
- [ ] Plot controls in top-right
- [ ] No mobile components visible

### Mobile Mode (< 900px)

#### Bottom Navigation
- [ ] Bottom nav bar appears (56px height)
- [ ] 4 tabs visible: Map, Sites, Logout, Tools
- [ ] Active tab highlighted in blue
- [ ] Logout button logs user out when tapped

#### Weather Banner
- [ ] Hidden when no site selected
- [ ] Appears when site selected (tap takeoff icon)
- [ ] Collapsed shows: site name + score (48px height)
- [ ] Tap to expand (180px height) shows 3-day forecast bars
- [ ] Tap forecast bar opens swipeable cards

#### Swipeable Forecast Cards
- [ ] Opens full-screen (90vh)
- [ ] Shows daily summary at top
- [ ] Swipe left/right changes day
- [ ] Swipe indicators (dots) at top
- [ ] Hourly rows are touch-friendly (60px)
- [ ] Close button works (top-right)

#### Sites Tab (Add Site Sheet)
- [ ] Tap "Sites" tab opens bottom sheet
- [ ] Sheet slides up from bottom
- [ ] "Add Flight Site" title shown
- [ ] Form fields are full-width
- [ ] "Select from Map" buttons work
- [ ] Can scroll through form
- [ ] Close button returns to map

#### Tools Tab
- [ ] Tap "Tools" tab opens bottom sheet
- [ ] 3 sub-tabs: Airspace, Plot, Settings
- [ ] **Airspace sub-tab:**
  - [ ] Toggle airspace ON/OFF
  - [ ] Checkboxes for each class (A, C, CTR, D, G, Q, R, RMZ)
  - [ ] Touch-friendly (56px height)
- [ ] **Plot sub-tab:**
  - [ ] Shows "Select a site" when no plot active
  - [ ] When plotting: shows all controls
  - [ ] Buttons are large (56px height)
- [ ] **Settings sub-tab:**
  - [ ] Shows "Fetch Weather" for admins
  - [ ] "Open Settings" button navigates
  - [ ] Shows "Admin access required" for non-admins

### Responsive Behavior
- [ ] Resize from 1200px → 800px triggers mobile UI
- [ ] Resize from 800px → 1200px returns to desktop UI
- [ ] No layout flicker or errors during resize
- [ ] Mobile components unmount when switching to desktop

### Touch Optimization
- [ ] All buttons are >= 44px (tap with finger test)
- [ ] Bottom nav tabs >= 56px
- [ ] No accidental taps between buttons
- [ ] Text is readable (16px+ minimum)
- [ ] High contrast for outdoor visibility

## Known Issues to Check

### Potential Issues:
1. **AddSitePanel double wrapper** - Panel has fixed positioning, may conflict with bottom sheet
2. **Weather banner positioning** - Should not overlap map controls
3. **Z-index conflicts** - Bottom sheet (1600) vs other overlays
4. **Forecast cards empty** - Need site selected first
5. **Desktop overlays on mobile** - Should all be hidden

## Testing Steps

1. **Open browser at desktop width (1200px)**
   - Verify desktop UI is unchanged
   - Login if needed (test@example.com)

2. **Resize to mobile (400px width)**
   - Desktop header should disappear
   - Bottom nav should appear
   - Test each tab

3. **Select a site**
   - Tap a takeoff icon on map
   - Weather banner should appear
   - Weather tab should become enabled

4. **Test weather flow**
   - Tap weather banner to expand
   - Tap a forecast bar
   - Swipe between days
   - Close and reopen

5. **Test add site**
   - Tap Sites tab
   - Try to select location from map
   - Fill in form
   - Test cancel

6. **Test tools**
   - Tap Tools tab
   - Toggle airspace
   - Check/uncheck classes
   - Try plot controls (needs site selected first)

## Success Criteria
- ✅ No console errors
- ✅ Smooth animations
- ✅ All features accessible on mobile
- ✅ Desktop unchanged
- ✅ Easy one-handed use
