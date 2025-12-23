#!/usr/bin/env node

/**
 * Ocean Ads CDN Debug Script
 *
 * This script helps diagnose CDN corruption issues.
 * Run: node scripts/debug-cdn.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

class CDNDebugger {
  constructor() {
    this.publisherId = '02912083-a026-4c61-8df7-0fd68ab4ad93';
    this.websiteId = '87690135-4199-4b1f-a960-93beb240759e';
    this.cdnPath = path.join(
      __dirname,
      '..',
      'cdn-files',
      'p',
      this.publisherId,
      'init.js',
    );
    this.sdkPath = 'C:\\DevProjects\\ocean-ads-sdk-v2\\dist\\ocean-ads.min.js';
    this.baseUrl = 'https://programmatic-adtech-backend.atharvajadhav.dev';
  }

  async run() {
    console.log('🔍 Ocean Ads CDN Debug Analysis');
    console.log('================================\n');

    try {
      // Step 1: Check source SDK
      await this.checkSourceSDK();

      // Step 2: Check CDN file
      await this.checkCDNFile();

      // Step 3: Check HTTP serving
      await this.checkHTTPServing();

      // Step 4: Check CDN generation endpoint
      await this.checkCDNGeneration();

      console.log('\n✅ Debug analysis complete!');
    } catch (error) {
      console.error(`\n❌ Debug failed: ${error.message}`);
      process.exit(1);
    }
  }

  async checkSourceSDK() {
    console.log('📦 Step 1: Checking Source SDK');
    console.log('-------------------------------');

    try {
      if (!fs.existsSync(this.sdkPath)) {
        throw new Error(`Source SDK not found at: ${this.sdkPath}`);
      }

      const stats = fs.statSync(this.sdkPath);
      console.log(`✅ Source SDK: ${this.sdkPath}`);
      console.log(`   Size: ${stats.size} bytes`);
      console.log(`   Modified: ${stats.mtime.toISOString()}`);

      // Validate syntax
      const content = fs.readFileSync(this.sdkPath, 'utf8');
      try {
        new Function(content);
        console.log(`   ✅ JavaScript syntax: Valid`);
      } catch (syntaxError) {
        throw new Error(`Source SDK has syntax errors: ${syntaxError.message}`);
      }

      // Check for required components
      if (content.includes('OceanAds')) {
        console.log(`   ✅ SDK components: Found`);
      } else {
        console.log(`   ⚠️  SDK components: Missing (may be minified)`);
      }

      if (content.length < 10000) {
        console.log(
          `   ⚠️  SDK seems unusually small: ${content.length} bytes`,
        );
      }
    } catch (error) {
      console.log(`❌ Source SDK issue: ${error.message}`);
      throw error;
    }
  }

  async checkCDNFile() {
    console.log('\n📁 Step 2: Checking CDN File');
    console.log('-----------------------------');

    try {
      if (!fs.existsSync(this.cdnPath)) {
        console.log(`❌ CDN file not found: ${this.cdnPath}`);
        console.log(`   This is expected if CDN generation failed`);
        return;
      }

      const stats = fs.statSync(this.cdnPath);
      console.log(`✅ CDN file exists: ${this.cdnPath}`);
      console.log(`   Size: ${stats.size} bytes`);
      console.log(`   Modified: ${stats.mtime.toISOString()}`);

      const content = fs.readFileSync(this.cdnPath, 'utf8');

      // Check if truncated
      if (content.length < 1000) {
        console.log(`❌ File too small: ${content.length} bytes`);
        console.log(`   Last 200 characters:`);
        console.log(content.slice(-200));
        return;
      }

      // Check syntax
      try {
        new Function(content);
        console.log(`   ✅ JavaScript syntax: Valid`);
      } catch (syntaxError) {
        console.log(`   ❌ JavaScript syntax: ${syntaxError.message}`);
        console.log(`   📄 Last 200 characters:`);
        console.log(content.slice(-200));
        return;
      }

      // Check for required components
      if (content.includes('window.__OCEAN_CONFIG__')) {
        console.log(`   ✅ Configuration: Found`);
      } else {
        console.log(`   ❌ Configuration: Missing`);
      }

      if (content.includes('OceanAds')) {
        console.log(`   ✅ SDK content: Found`);
      } else {
        console.log(`   ❌ SDK content: Missing`);
      }

      // Check file ending
      const lastChars = content.slice(-50);
      if (lastChars.includes('}') || lastChars.includes(';')) {
        console.log(`   ✅ File ending: Proper`);
      } else {
        console.log(`   ⚠️  File ending: May be truncated`);
        console.log(`   Last 50 characters: ${lastChars}`);
      }

      console.log(`\n✅ CDN file appears to be valid!`);
    } catch (error) {
      console.log(`❌ CDN file issue: ${error.message}`);
    }
  }

  async checkHTTPServing() {
    console.log('\n🌐 Step 3: Checking HTTP Serving');
    console.log('--------------------------------');

    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}/cdn/p/${this.publisherId}/init.js`;

      console.log(`📡 Testing: ${url}`);

      const req = http.get(url, (res) => {
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Content-Type: ${res.headers['content-type']}`);
        console.log(
          `   Content-Length: ${res.headers['content-length'] || 'Not set'}`,
        );

        let data = '';
        res.on('data', (chunk) => (data += chunk));

        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log(`   ✅ HTTP serving: Success`);
            console.log(`   📦 Downloaded size: ${data.length} bytes`);

            // Check if content is truncated
            if (data.length < 1000) {
              console.log(
                `   ❌ Downloaded content too small: ${data.length} bytes`,
              );
            } else {
              // Validate syntax
              try {
                new Function(data);
                console.log(`   ✅ Downloaded content: Valid JavaScript`);
              } catch (syntaxError) {
                console.log(
                  `   ❌ Downloaded content: Syntax error - ${syntaxError.message}`,
                );
                console.log(`   📄 Last 200 characters:`);
                console.log(data.slice(-200));
              }
            }
          } else {
            console.log(`   ❌ HTTP serving: Failed (${res.statusCode})`);
            console.log(`   Response: ${data}`);
          }
          resolve();
        });
      });

      req.on('error', (error) => {
        console.log(`   ❌ HTTP request failed: ${error.message}`);
        resolve(); // Don't fail on network issues
      });

      req.setTimeout(5000, () => {
        req.destroy();
        console.log(`   ⚠️  HTTP request timeout`);
        resolve();
      });
    });
  }

  async checkCDNGeneration() {
    console.log('\n🔧 Step 4: Checking CDN Generation Endpoint');
    console.log('--------------------------------------------');

    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        forceRebuild: true,
        includeDebug: true,
        environment: 'development',
      });

      const req = http.request(
        {
          hostname: 'localhost',
          port: 3001,
          path: `/api/publishers/${this.publisherId}/websites/${this.websiteId}/generate-cdn`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));

          res.on('end', () => {
            console.log(`   Status: ${res.statusCode}`);

            if (res.statusCode === 200 || res.statusCode === 201) {
              try {
                const response = JSON.parse(data);
                console.log(`   ✅ CDN generation: Success`);
                console.log(`   📦 Build ID: ${response.buildId || 'Unknown'}`);
                console.log(`   🔗 CDN URL: ${response.cdnUrl || 'Unknown'}`);
              } catch (error) {
                console.log(
                  `   ✅ CDN generation: Success (response parse error: ${error.message})`,
                );
              }
            } else if (res.statusCode === 401) {
              console.log(
                `   ❌ CDN generation: Unauthorized (authentication required)`,
              );
              console.log(
                `   💡 This is expected - the endpoint requires authentication`,
              );
            } else {
              console.log(`   ❌ CDN generation: Failed (${res.statusCode})`);
              console.log(`   Response: ${data}`);
            }
            resolve();
          });
        },
      );

      req.on('error', (error) => {
        console.log(`   ❌ CDN generation request failed: ${error.message}`);
        resolve(); // Don't fail on network issues
      });

      req.setTimeout(10000, () => {
        req.destroy();
        console.log(`   ⚠️  CDN generation request timeout`);
        resolve();
      });

      req.write(postData);
      req.end();
    });
  }
}

// Run the debugger
const debuggerInstance = new CDNDebugger();
debuggerInstance.run().catch((error) => {
  console.error('❌ Debug script failed:', error.message);
  process.exit(1);
});
