// Quick server debug script
const http = require('http');

async function checkServer() {
  console.log('🔍 Checking if server is running on port 3000...\n');

  const testPaths = [
    '/',
    '/api',
    '/api/',
    '/swagger',
    '/docs',
    '/health', // Many NestJS apps have a health endpoint
  ];

  for (const path of testPaths) {
    try {
      const result = await new Promise((resolve, reject) => {
        const req = http.get(
          {
            hostname: 'localhost',
            port: 3000,
            path: path,
            timeout: 2000,
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              resolve({
                path,
                status: res.statusCode,
                contentType: res.headers['content-type'],
                dataPreview: data.substring(0, 100),
              });
            });
          },
        );

        req.on('error', reject);
        req.on('timeout', () => reject(new Error('Timeout')));
      });

      console.log(` ${result.path}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Content-Type: ${result.contentType}`);
      console.log(
        `   Preview: ${result.dataPreview.replace(/\n/g, ' ').substring(0, 80)}...`,
      );
      console.log('');
    } catch (error) {
      console.log(`❌ ${path} - ${error.message}`);
    }
  }
}

checkServer();
