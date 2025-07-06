# Ocean Ads CDN Debug & Fix Scripts

This directory contains utility scripts to help diagnose and fix CDN corruption issues.

## Scripts Available

### 1. `debug-cdn.js` - Comprehensive CDN Diagnostics
Performs a complete analysis of your CDN generation pipeline:

```bash
# Run diagnostics
node scripts/debug-cdn.js

# Run with automatic fix attempt
node scripts/debug-cdn.js --fix
```

**What it checks:**
- ✅ SDK source file exists and is valid
- ✅ CDN file exists and has correct size
- ✅ JavaScript syntax validation
- ✅ Configuration injection verification
- ✅ HTTP serving functionality

### 2. `fix-cdn.js` - Automatic CDN Fix
Performs immediate fixes for corrupted CDN files:

```bash
# Run automatic fix
node scripts/fix-cdn.js
```

**What it does:**
1. Creates backup of current CDN file
2. Clears CDN cache
3. Deletes corrupted CDN file
4. Force regenerates new CDN
5. Validates the new CDN file

## Common Issues & Solutions

### Issue 1: SyntaxError: Unexpected end of input
**Symptoms:**
- Browser console shows `SyntaxError: Unexpected end of input`
- SDK fails to load
- No RTB requests made

**Fix:**
```bash
node scripts/fix-cdn.js
```

### Issue 2: SDK file not found
**Symptoms:**
- Backend logs show "SDK file not accessible"
- CDN generation fails

**Fix:**
```bash
# Build the SDK first
cd C:\DevProjects\ocean-ads-sdk-v2
npm run build:dev

# Then regenerate CDN
node scripts/fix-cdn.js
```

### Issue 3: Empty or corrupted CDN file
**Symptoms:**
- CDN file exists but is very small
- File doesn't end properly
- Browser loads CDN but nothing happens

**Fix:**
```bash
# Diagnose the issue
node scripts/debug-cdn.js

# Apply fix
node scripts/fix-cdn.js
```

## Manual Commands

If scripts don't work, try these manual commands:

### Clear Cache
```bash
curl -X DELETE "http://localhost:3001/api/cdn/cache/clear"
```

### Delete Corrupted File
```bash
rm -f "C:\DevProjects\programmatic_adtech_backend\cdn-files\p\02912083-a026-4c61-8df7-0fd68ab4ad93\init.js"
```

### Force Regenerate CDN
```bash
curl -X POST "http://localhost:3001/api/publishers/02912083-a026-4c61-8df7-0fd68ab4ad93/websites/87690135-4199-4b1f-a960-93beb240759e/generate-cdn" \
  -H "Content-Type: application/json" \
  -d '{"forceRebuild": true, "includeDebug": true}'
```

### Validate CDN File
```bash
# Check if file exists and has content
ls -la "C:\DevProjects\programmatic_adtech_backend\cdn-files\p\02912083-a026-4c61-8df7-0fd68ab4ad93\init.js"

# Test JavaScript syntax
node -c "C:\DevProjects\programmatic_adtech_backend\cdn-files\p\02912083-a026-4c61-8df7-0fd68ab4ad93\init.js"

# Test HTTP serving
curl -I "http://localhost:3001/cdn/p/02912083-a026-4c61-8df7-0fd68ab4ad93/init.js"
```

## Troubleshooting

### Backend Not Running
```bash
# Check if backend is running
curl http://localhost:3001/health

# Start backend if needed
cd C:\DevProjects\programmatic_adtech_backend
docker compose -f docker-compose.dev.yml up -d
```

### SDK Not Built
```bash
# Build the SDK
cd C:\DevProjects\ocean-ads-sdk-v2
npm run clean
npm run build:dev

# Verify build output
ls -la dist/ocean-ads.min.js
```

### Permission Issues
```bash
# Check file permissions
ls -la cdn-files/p/02912083-a026-4c61-8df7-0fd68ab4ad93/

# Fix permissions if needed (Linux/Mac)
chmod 755 cdn-files/p/02912083-a026-4c61-8df7-0fd68ab4ad93/
chmod 644 cdn-files/p/02912083-a026-4c61-8df7-0fd68ab4ad93/init.js
```

## Success Indicators

After running the fix scripts, you should see:

### In Debug Output:
```
✅ SDK file validated successfully
✅ File exists: [size] bytes
✅ JavaScript syntax: Valid
✅ Has configuration: true
✅ Has SDK content: true
✅ HTTP Status: 200
```

### In Browser Console:
```
✅ Configuration loaded successfully
✅ Publisher ID: 02912083-a026-4c61-8df7-0fd68ab4ad93
✅ Ocean Ads SDK loaded
✅ Ad slots found: 2-4
✅ RTB connection successful
```

### In Network Tab:
- CDN script loads with 200 status
- init.js file has reasonable size (>10KB)
- RTB requests are made to `/rtb/bid-request`
- SSE connections open to `/rtb/stream/[id]`

## Getting Help

If the scripts don't resolve your issue:

1. **Run full diagnostics**: `node scripts/debug-cdn.js`
2. **Check backend logs**: `docker compose logs -f api`
3. **Verify SDK build**: `ls -la ../ocean-ads-sdk-v2/dist/`
4. **Test manually**: Open browser DevTools and check Network/Console tabs

The most common issue is corrupted CDN files due to incomplete writes. The fix scripts address this by implementing atomic file operations and validation at every step.
