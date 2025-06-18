# Quick SDK Integration Setup

This guide will help you connect your `ocean-ads-sdk-v2` project with the backend CDN system.

## ✅ Your Architecture is Correct!

Your separation of SDK and backend projects follows industry best practices (like Google AdSense, Facebook Pixel). This approach provides:

- Independent development cycles
- Better testing and deployment
- Clear separation of concerns
- Easier maintenance

## 🚀 Quick Setup for Local Development

### Step 1: Set Environment Variable

Add this to your `.env` file (create if it doesn't exist):

```bash
# Point to your SDK project
SDK_BUILD_PATH=../ocean-ads-sdk-v2/dist/ocean-ads.min.js

# Development settings
CDN_BASE_URL=http://localhost:3000/cdn
CDN_INCLUDE_DEBUG=true
CDN_VERBOSE_LOGGING=true
```

### Step 2: Build Your SDK

```bash
cd ../ocean-ads-sdk-v2
npm install
npm run build
```

### Step 3: Test Integration

```bash
# Back to backend project
cd ../programmatic_adtech_backend

# Start the server
npm run start:dev

# Test CDN generation (use your actual IDs)
curl -X POST http://localhost:3000/api/publishers/869e6cdc-d689-401a-91b3-faa512e4fd8c/websites/007116e2-c580-4739-90f8-1c62cbe493c4/generate-cdn \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 📋 What Changed

The backend now supports flexible SDK paths through configuration:

1. **Environment-based paths** - Different paths for dev/prod
2. **Automatic configuration** - Reads from your config files
3. **Smart caching** - Caches SDK content for performance
4. **Validation** - Checks SDK file exists and is valid

## 🏗️ Production Deployment Options

### Option 1: NPM Package (Recommended)

1. Publish SDK: `cd ocean-ads-sdk-v2 && npm publish`
2. Install in backend: `npm install @ocean-ads/sdk`
3. Set: `SDK_BUILD_PATH=./node_modules/@ocean-ads/sdk/dist/ocean-ads.min.js`

### Option 2: Docker Volume

```yaml
services:
  backend:
    volumes:
      - ../ocean-ads-sdk-v2/dist:/app/shared/sdk
    environment:
      - SDK_BUILD_PATH=/app/shared/sdk/ocean-ads.min.js
```

### Option 3: Multi-stage Build

```dockerfile
# Copy built SDK from separate build stage
COPY --from=sdk-builder /sdk/dist ./sdk-dist
ENV SDK_BUILD_PATH=./sdk-dist/ocean-ads.min.js
```

## 🔧 Automated Setup

Use the setup script for easy configuration:

```bash
# Setup development environment
node scripts/setup-sdk-integration.js setup development

# Check integration status
node scripts/setup-sdk-integration.js check

# Create symlink (alternative approach)
node scripts/setup-sdk-integration.js symlink
```

## 🐛 Troubleshooting

### SDK File Not Found

```bash
# Check the path
echo $SDK_BUILD_PATH
ls -la ../ocean-ads-sdk-v2/dist/

# Rebuild SDK
cd ../ocean-ads-sdk-v2 && npm run build
```

### CDN Generation Fails

```bash
# Enable debug logging
CDN_VERBOSE_LOGGING=true npm run start:dev

# Check logs for detailed error messages
```

### Cache Issues

```bash
# Clear CDN cache (if implemented)
# The service automatically clears cache when SDK file changes
```

## 📚 Full Documentation

See `SDK_INTEGRATION_GUIDE.md` for comprehensive documentation including:

- Detailed deployment strategies
- CI/CD integration
- Monitoring and debugging
- Best practices
- Advanced configurations

## ✨ Next Steps

1. **Set the environment variable** pointing to your SDK
2. **Build your SDK project**
3. **Test CDN generation** to verify integration
4. **Choose production deployment strategy** from the options above

Your setup is now ready for both development and production! 🎉
