#!/usr/bin/env node

/**
 * Ocean Ads CDN Fix Script
 * 
 * This script performs immediate fixes for CDN corruption issues.
 * Run: node scripts/fix-cdn.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

class CDNFixer {
  constructor() {
    this.publisherId = '02912083-a026-4c61-8df7-0fd68ab4ad93';
    this.websiteId = '87690135-4199-4b1f-a960-93beb240759e';
    this.cdnPath = path.join(__dirname, '..', 'cdn-files', 'p', this.publisherId, 'init.js');
    this.baseUrl = 'http://localhost:3001';
  }

  async run() {
    console.log('🔧 Ocean Ads CDN Fix Utility');
    console.log('============================\n');

    try {
      console.log('Step 1: Backing up current CDN file...');
      await this.backupCDN();

      console.log('Step 2: Clearing CDN cache...');
      await this.clearCache();

      console.log('Step 3: Deleting corrupted CDN file...');
      await this.deleteCorruptedFile();

      console.log('Step 4: Force regenerating CDN...');
      await this.regenerateCDN();

      console.log('Step 5: Validating new CDN...');
      await this.validateNewCDN();

      console.log('\n✅ CDN Fix Complete!');
      console.log('\nYour CDN should now be working correctly.');
      console.log('Test with: node scripts/debug-cdn.js');

    } catch (error) {
      console.error(`\n❌ Fix failed: ${error.message}`);
      console.log('\n🔧 Manual fix commands:');
      console.log('1. Clear cache: curl -X DELETE "http://localhost:3001/api/cdn/cache/clear"');
      console.log('2. Delete file: rm -f "' + this.cdnPath + '"');
      console.log('3. Regenerate: curl -X POST "http://localhost:3001/api/publishers/.../generate-cdn"');
      process.exit(1);
    }
  }

  async backupCDN() {
    const backupPath = this.cdnPath + '.backup.' + Date.now();
    
    try {
      if (fs.existsSync(this.cdnPath)) {
        const content = fs.readFileSync(this.cdnPath, 'utf8');
        fs.writeFileSync(backupPath, content);
        console.log(`   ✅ Backup created: ${backupPath}`);
      } else {
        console.log('   ℹ️  No existing CDN file to backup');
      }
    } catch (error) {
      console.log(`   ⚠️  Backup failed: ${error.message}`);
    }
  }

  async clearCache() {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: '/api/cdn/cache/clear',
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      }, (res) => {
        if (res.statusCode === 200 || res.statusCode === 404) {
          console.log('   ✅ Cache cleared successfully');
          resolve();
        } else {
          console.log(`   ⚠️  Cache clear returned ${res.statusCode} (may not exist)`);
          resolve(); // Don't fail on cache clear issues
        }
      });

      req.on('error', (error) => {
        console.log(`   ⚠️  Cache clear failed: ${error.message}`);
        resolve(); // Don't fail on cache clear issues
      });

      req.setTimeout(5000, () => {
        req.destroy();
        console.log('   ⚠️  Cache clear timeout');
        resolve(); // Don't fail on cache clear issues
      });

      req.end();
    });
  }

  async deleteCorruptedFile() {
    try {
      if (fs.existsSync(this.cdnPath)) {
        fs.unlinkSync(this.cdnPath);
        console.log('   ✅ Corrupted CDN file deleted');
      } else {
        console.log('   ℹ️  No CDN file to delete');
      }

      // Also delete metadata file if exists
      const metadataPath = path.join(path.dirname(this.cdnPath), 'metadata.json');
      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
        console.log('   ✅ Metadata file deleted');
      }
    } catch (error) {
      console.log(`   ⚠️  File deletion failed: ${error.message}`);
    }
  }

  async regenerateCDN() {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        forceRebuild: true,
        includeDebug: true,
        environment: 'development'
      });

      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: `/api/publishers/${this.publisherId}/websites/${this.websiteId}/generate-cdn`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            try {
              const response = JSON.parse(data);
              console.log('   ✅ CDN regenerated successfully');
              console.log(`   📦 Build ID: ${response.data?.buildId || response.buildId || 'Unknown'}`);
              resolve();
            } catch (error) {
              console.log(`   ✅ CDN regenerated (response parse error: ${error.message})`);
              resolve();
            }
          } else {
            console.log(`   ❌ CDN regeneration failed: ${res.statusCode}`);
            console.log(`   Response: ${data}`);
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        console.log(`   ❌ CDN regeneration request failed: ${error.message}`);
        reject(error);
      });

      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('CDN regeneration timeout'));
      });

      req.write(postData);
      req.end();
    });
  }

  async validateNewCDN() {
    // Wait a moment for file to be written
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      if (!fs.existsSync(this.cdnPath)) {
        throw new Error('CDN file was not created');
      }

      const stats = fs.statSync(this.cdnPath);
      console.log(`   ✅ New CDN file exists: ${stats.size} bytes`);

      if (stats.size === 0) {
        throw new Error('New CDN file is empty');
      }

      if (stats.size < 1000) {
        throw new Error(`New CDN file seems too small: ${stats.size} bytes`);
      }

      // Quick syntax check
      const content = fs.readFileSync(this.cdnPath, 'utf8');
      
      try {
        new Function(content);
        console.log('   ✅ New CDN has valid JavaScript syntax');
      } catch (syntaxError) {
        throw new Error(`New CDN has syntax errors: ${syntaxError.message}`);
      }

      // Check for required components
      if (!content.includes('window.__OCEAN_CONFIG__')) {
        throw new Error('New CDN is missing configuration');
      }

      if (!content.includes('OceanAds')) {
        throw new Error('New CDN is missing SDK content');
      }

      console.log('   ✅ New CDN validation passed');

    } catch (error) {
      console.log(`   ❌ New CDN validation failed: ${error.message}`);
      throw error;
    }
  }

  async testHTTPServing() {
    console.log('\nStep 6: Testing HTTP serving...');
    
    return new Promise((resolve, reject) => {
      const req = http.get(`${this.baseUrl}/cdn/p/${this.publisherId}/init.js`, (res) => {
        if (res.statusCode === 200) {
          console.log('   ✅ CDN HTTP serving works');
          resolve();
        } else {
          console.log(`   ❌ CDN HTTP serving failed: ${res.statusCode}`);
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });

      req.on('error', (error) => {
        console.log(`   ❌ CDN HTTP test failed: ${error.message}`);
        reject(error);
      });

      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('HTTP test timeout'));
      });
    });
  }
}

// Run the fixer
const fixer = new CDNFixer();
fixer.run().then(() => {
  fixer.testHTTPServing().catch(() => {
    console.log('\n⚠️  HTTP serving test failed, but file was created successfully.');
    console.log('This might be due to backend caching. Try restarting the backend.');
  });
});
