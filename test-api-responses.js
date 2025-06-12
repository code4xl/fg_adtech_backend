// Test API responses to ensure they return JSON instead of HTML
const http = require('http');

async function testAPIResponse(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          // Try to parse as JSON
          const parsed = JSON.parse(data);
          resolve({
            path: path,
            status: res.statusCode,
            contentType: res.headers['content-type'],
            isJSON: true,
            data: parsed,
            success: true,
          });
        } catch (error) {
          // Not valid JSON
          resolve({
            path: path,
            status: res.statusCode,
            contentType: res.headers['content-type'],
            isJSON: false,
            data: data.substring(0, 200) + '...', // First 200 chars
            success: false,
            error: 'Not valid JSON',
          });
        }
      });
    });

    req.on('error', (err) => {
      reject({
        path: path,
        error: err.message,
        success: false,
      });
    });

    req.on('timeout', () => {
      reject({
        path: path,
        error: 'Request timeout',
        success: false,
      });
    });

    req.end();
  });
}

async function testAllEndpoints() {
  const endpoints = [
    '/api/adslot-templates',
    '/api/content-categories',
    '/docs', // This should return HTML (documentation)
    '/swagger', // This should return HTML (Swagger UI)
  ];

  console.log('🧪 Testing API endpoint responses...\n');

  for (const endpoint of endpoints) {
    try {
      const result = await testAPIResponse(endpoint);

      if (endpoint === '/docs' || endpoint === '/swagger') {
        // Documentation endpoints should return HTML
        const status = !result.isJSON ? '✅' : '⚠️';
        console.log(`${status} ${endpoint}`);
        console.log(`   Status: ${result.status}`);
        console.log(`   Content-Type: ${result.contentType}`);
        console.log(`   Expected: HTML documentation`);
      } else {
        // API endpoints should return JSON
        const status = result.isJSON ? '✅' : '❌';
        console.log(`${status} ${endpoint}`);
        console.log(`   Status: ${result.status}`);
        console.log(`   Content-Type: ${result.contentType}`);
        console.log(`   Is JSON: ${result.isJSON}`);

        if (result.isJSON && result.data) {
          console.log(
            `   Response structure: ${Object.keys(result.data).join(', ')}`,
          );
        } else if (!result.isJSON) {
          console.log(`   Response preview: ${result.data}`);
        }
      }
      console.log('');
    } catch (error) {
      console.log(`❌ ${endpoint}`);
      console.log(`   Error: ${error.error || error.message}`);
      console.log('');
    }
  }
}

// Wait a moment for server to start, then test
console.log('Waiting 3 seconds for server to start...');
setTimeout(testAllEndpoints, 3000);
