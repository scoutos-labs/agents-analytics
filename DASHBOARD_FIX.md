# Dashboard Blank Screen Fix

## Most likely cause: Browser is caching the old JS

### Fix 1: Hard refresh
- **Chrome/Edge:** `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- Or open DevTools (`F12`), right-click the refresh button → "Empty Cache and Hard Reload"

### Fix 2: Open in incognito/private window
```
# Open this URL in an incognito window:
http://localhost:4444/view/dash_550e87a8f70a?token=sess_599ca961e692a27ed4abbfcdf166f2cf582ddf9fc91eef1680b46a6fb2755cfc
```

### Fix 3: Check browser console
1. Open DevTools (`F12`)
2. Go to **Console** tab
3. You should see:
   - `Loading dashboard...` — good
   - `Workspace: ws_...` in the subtitle — good
   - **Red errors** — that's the problem

## If it's NOT caching — check the data flow

### Step 1: Verify the server has data
```bash
# The dashboard should show "Workspace: ws_..." in the header.
# If it says "Entity: ent_...", you have old code.
```

### Step 2: Test API directly
```bash
# Replace with your actual token from the demo output:
curl "http://localhost:4444/v1/analytics/timeseries?workspace_id=ws_YOUR_ID\&event_name=tool.invoke\&from=2026-04-23T00:00:00Z\&to=2026-04-27T00:00:00Z\&interval=3600" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

This should return ~2000+ points. If it does but the dashboard is still blank, it's 100% a frontend/browser issue.

### Step 3: Full clean restart
```bash
# Kill everything
pkill -9 -f "node dist/index.js"
lsof -ti:4444 | xargs kill -9 2>/dev/null

# Fresh data directory
rm -f data/*.db data/*.db-shm data/*.db-wal

# Rebuild (must do both)
npm run build
cd dashboard && npm run build && cd ..

# Start
PORT=4444 node dist/index.js

# Generate demo on port 4444
PORT=4444 node scripts/generate-workspace-demo.mjs

# Open the URL in a NEW incognito window
```

## What changed recently
The dashboard frontend needed to be rebuilt to understand `workspace_id`. If you're running old `public/dashboard/assets/*.js` files, they won't send the workspace parameter and will get empty results.

After pulling latest commits, always run:
```bash
cd dashboard && npm run build && cd ..
```