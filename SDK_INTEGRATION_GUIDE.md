# Ocean Ads SDK Integration Guide

This guide explains how to properly connect your separate `ocean-ads-sdk-v2` project with the backend CDN system for both local development and production deployment.

## Architecture Overview

Your current architecture with separate SDK and backend projects is **CORRECT** and follows industry best practices:

```
ocean-ads-platform/
├── programmatic_adtech_backend/    # NestJS Backend (Current Project)
│   ├── src/cdn/                   # CDN Generation Services
│   └── cdn-files/                 # Generated CDN Files
└── ocean-ads-sdk-v2/              # TypeScript SDK Project
    ├── src/                       # SDK Source Code
    ├── dist/                      # Built SDK Files
    └── ocean-ads.min.js           # Final Compiled SDK
```

## Configuration Setup

### 1. Environment Variables

The backend now supports flexible SDK path configuration through these environment variables:

```bash
# SDK Build Path - where to find the compiled SDK file
SDK_BUILD_PATH=../ocean-ads-sdk-v2/dist/ocean-ads.min.js

# CDN Storage Configuration
CDN_STORAGE_PATH=./cdn-files
CDN_BASE_URL=https://cdn.oceanads.com

# Development Settings
CDN_INCLUDE_DEBUG=true
CDN_MINIFY=false
SDK_WATCH_MODE=true
CDN_VERBOSE_LOGGING=true
```

### 2. Local Development Setup

#### Option A: Direct Path Reference (Recommended for Development)

Create `.env.development`:

```bash
NODE_ENV=development
SDK_BUILD_PATH=../ocean-ads-sdk-v2/dist/ocean-ads.min.js
CDN_STORAGE_PATH=./cdn-files
CDN_BASE_URL=http://localhost:3000/cdn
CDN_INCLUDE_DEBUG=true
CDN_MINIFY=false
CDN_COMPRESSION=false
SDK_WATCH_MODE=true
CDN_VERBOSE_LOGGING=true
CDN_HOT_RELOAD=true
```

#### Option B: Symlink Approach

```bash
# Create a symlink to the SDK file
mkdir -p dist/sdk
ln -s ../../ocean-ads-sdk-v2/dist/ocean-ads.min.js dist/sdk/ocean-ads.min.js

# Use default path
SDK_BUILD_PATH=./dist/sdk/ocean-ads.min.js
```

### 3. Docker Development Setup

Update `docker-compose.dev.yml`:

```yaml
version: '3.8'
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - ./src:/app/src
      - ../ocean-ads-sdk-v2/dist:/app/shared/sdk # Mount SDK directory
    environment:
      - SDK_BUILD_PATH=/app/shared/sdk/ocean-ads.min.js
      - CDN_STORAGE_PATH=/app/cdn-files
```

## Production Deployment Strategies

### Strategy 1: NPM Package (Recommended)

1. **Publish SDK as NPM Package**:

```bash
cd ocean-ads-sdk-v2
npm version patch
npm publish --access public
```

2. **Install in Backend**:

```bash
cd programmatic_adtech_backend
npm install @ocean-ads/sdk@latest
```

3. **Production Environment**:

```bash
NODE_ENV=production
SDK_BUILD_PATH=./node_modules/@ocean-ads/sdk/dist/ocean-ads.min.js
CDN_STORAGE_PATH=/var/cdn/files
CDN_BASE_URL=https://cdn.oceanads.com
CDN_INCLUDE_DEBUG=false
CDN_MINIFY=true
CDN_COMPRESSION=true
```

### Strategy 2: Docker Multi-Stage Build

Create `Dockerfile.prod`:

```dockerfile
# Stage 1: Build SDK
FROM node:18-alpine as sdk-builder
WORKDIR /sdk
COPY ocean-ads-sdk-v2/package*.json ./
RUN npm ci
COPY ocean-ads-sdk-v2/src ./src
COPY ocean-ads-sdk-v2/tsconfig.json ./
RUN npm run build

# Stage 2: Build Backend
FROM node:18-alpine as backend-builder
WORKDIR /app
COPY programmatic_adtech_backend/package*.json ./
RUN npm ci
COPY programmatic_adtech_backend/src ./src
COPY programmatic_adtech_backend/tsconfig.json ./
RUN npm run build

# Stage 3: Production
FROM node:18-alpine
WORKDIR /app
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=sdk-builder /sdk/dist ./sdk-dist
ENV SDK_BUILD_PATH=./sdk-dist/ocean-ads.min.js
```

### Strategy 3: Shared Volume Deployment

For Kubernetes or Docker Swarm:

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  sdk-builder:
    build: ./ocean-ads-sdk-v2
    volumes:
      - sdk-files:/output
    command: npm run build && cp dist/* /output/

  backend:
    build: ./programmatic_adtech_backend
    depends_on:
      - sdk-builder
    volumes:
      - sdk-files:/app/shared/sdk
    environment:
      - SDK_BUILD_PATH=/app/shared/sdk/ocean-ads.min.js

volumes:
  sdk-files:
```

## CI/CD Integration

### GitHub Actions Example

`.github/workflows/deploy.yml`:

```yaml
name: Deploy Ocean Ads Platform

on:
  push:
    branches: [main]

jobs:
  build-sdk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Build SDK
        run: |
          cd ocean-ads-sdk-v2
          npm ci
          npm run build
      - name: Upload SDK artifacts
        uses: actions/upload-artifact@v3
        with:
          name: sdk-dist
          path: ocean-ads-sdk-v2/dist/

  build-backend:
    needs: build-sdk
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Download SDK artifacts
        uses: actions/download-artifact@v3
        with:
          name: sdk-dist
          path: ./dist/sdk/
      - name: Build Backend
        run: |
          cd programmatic_adtech_backend
          npm ci
          npm run build
        env:
          SDK_BUILD_PATH: ./dist/sdk/ocean-ads.min.js
```

## Development Workflow

### 1. SDK Development

```bash
cd ocean-ads-sdk-v2
npm run dev         # Watch mode for SDK development
npm run build       # Build optimized version
```

### 2. Backend Development

```bash
cd programmatic_adtech_backend
npm run start:dev   # NestJS development mode
```

### 3. Testing Integration

```bash
# Test CDN generation with new SDK
curl -X POST http://localhost:3000/api/publishers/{publisherId}/websites/{websiteId}/generate-cdn \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Monitoring and Debugging

### SDK File Validation

The CDN generator service includes built-in validation:

```typescript
// Check if SDK file exists and is valid
const validation = await cdnGeneratorService.validateSdkFile();
if (!validation.isValid) {
  console.error('SDK file validation failed:', validation.error);
}
```

### Debug Mode

Enable debug mode to see detailed SDK integration logs:

```bash
CDN_VERBOSE_LOGGING=true
CDN_INCLUDE_DEBUG=true
```

### Cache Management

Clear SDK cache when updating:

```typescript
// Clear SDK cache to force reload
cdnGeneratorService.clearSdkCache();
```

## Best Practices

1. **Version Management**: Always version your SDK releases
2. **Cache Invalidation**: Clear CDN cache when updating SDK
3. **Testing**: Test CDN generation after SDK updates
4. **Monitoring**: Monitor SDK file size and performance
5. **Rollback**: Keep previous SDK versions for rollback capability

## Troubleshooting

### Common Issues

1. **SDK File Not Found**:

   - Check `SDK_BUILD_PATH` environment variable
   - Verify SDK build completed successfully
   - Check file permissions

2. **CDN Generation Fails**:

   - Enable verbose logging
   - Check SDK file integrity
   - Verify configuration syntax

3. **Performance Issues**:
   - Enable compression in production
   - Monitor SDK file size
   - Use CDN caching

### Commands for Testing

```bash
# Test SDK path resolution
echo $SDK_BUILD_PATH

# Check SDK file exists
ls -la $SDK_BUILD_PATH

# Test CDN generation
npm run test:cdn

# Clear CDN cache
npm run cdn:clear-cache
```

This integration approach allows you to maintain separate repositories while ensuring seamless deployment and development workflows.
