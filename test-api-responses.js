const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load inventory data from external JSON file
function loadInventoryData() {
  try {
    const inventoryPath = path.join(__dirname, './bid-request-data.json');

    if (!fs.existsSync(inventoryPath)) {
      console.error('❌ Error: inventory-data.json file not found!');
      console.log(
        '📝 Please create inventory-data.json with the following structure:',
      );
      console.log(
        JSON.stringify(
          [
            {
              inventoryId: 'your-inventory-id',
              publisherId: 'your-publisher-id',
              websiteId: 'your-website-id',
              width: 300,
              height: 250,
              format: 'BANNER',
              position: 'HEADER',
            },
          ],
          null,
          2,
        ),
      );
      process.exit(1);
    }

    const rawData = fs.readFileSync(inventoryPath, 'utf8');
    const inventoryData = JSON.parse(rawData);

    if (!Array.isArray(inventoryData) || inventoryData.length === 0) {
      throw new Error('Inventory data must be a non-empty array');
    }

    // Validate required fields
    const requiredFields = [
      'inventoryId',
      'publisherId',
      'websiteId',
      'width',
      'height',
      'format',
      'position',
    ];
    for (let i = 0; i < inventoryData.length; i++) {
      const item = inventoryData[i];
      for (const field of requiredFields) {
        if (!item[field]) {
          throw new Error(
            `Missing required field '${field}' in inventory item ${i + 1}`,
          );
        }
      }
    }

    console.log(
      ` Loaded ${inventoryData.length} inventory items from inventory-data.json`,
    );
    return inventoryData;
  } catch (error) {
    console.error('❌ Error loading inventory data:', error.message);

    if (error instanceof SyntaxError) {
      console.log(
        '💡 Tip: Check if your inventory-data.json has valid JSON syntax',
      );
    }

    process.exit(1);
  }
}

// Load inventory data at startup
const inventoryData = loadInventoryData();

// Configuration
const CONFIG = {
  endpoint: 'http://localhost:3000/rtb/bid-request',
  numberOfRequests: 120, // You can change this between 20-30
  concurrentRequests: 20, // Number of parallel requests
  delayBetweenBatches: 100, // ms delay between batches
};

// Device types for variety
const deviceTypes = ['MOBILE', 'DESKTOP', 'TABLET'];
const browserTypes = ['chrome', 'firefox', 'safari', 'edge'];
const osTypes = ['windows', 'macos', 'android', 'ios'];
const countries = ['IN', 'US', 'UK', 'CA'];
const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Pune'];
const regions = [
  'Maharashtra',
  'Karnataka',
  'Tamil Nadu',
  'Delhi',
  'Uttar Pradesh',
];

// Generate random user agent
function generateUserAgent(deviceType, browserType, osType) {
  const userAgents = {
    MOBILE: {
      chrome:
        'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Mobile Safari/537.36',
      firefox: 'Mozilla/5.0 (Mobile; rv:89.0) Gecko/89.0 Firefox/89.0',
      safari:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    },
    DESKTOP: {
      chrome:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36',
      firefox:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
      safari:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    },
    TABLET: {
      chrome:
        'Mozilla/5.0 (Linux; Android 11; SM-T870) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36',
      safari:
        'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    },
  };

  return userAgents[deviceType]?.[browserType] || userAgents.DESKTOP.chrome;
}

// Generate random IP address
function generateRandomIP() {
  return `${Math.floor(Math.random() * 255) + 1}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

// Generate unique external request ID
function generateExternalRequestId(index) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}_${index}_${random}`;
}

// Create bid request payload with variations
function createBidRequestPayload(inventory, index) {
  const deviceType =
    deviceTypes[Math.floor(Math.random() * deviceTypes.length)];
  const browserType =
    browserTypes[Math.floor(Math.random() * browserTypes.length)];
  const osType = osTypes[Math.floor(Math.random() * osTypes.length)];
  const country = countries[Math.floor(Math.random() * countries.length)];
  const city = cities[Math.floor(Math.random() * cities.length)];
  const region = regions[Math.floor(Math.random() * regions.length)];

  return {
    externalRequestId: generateExternalRequestId(index),
    inventoryId: inventory.inventoryId,
    publisherId: inventory.publisherId,
    websiteId: inventory.websiteId,
    userContext: {
      userId: `user_${index}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userAgent: generateUserAgent(deviceType, browserType, osType),
      ipAddress: generateRandomIP(),
      deviceType: deviceType,
      browserType: browserType,
      osType: osType,
      country: country,
      region: region,
      city: city,
      additionalData: {
        interests: ['tech', 'sports', 'finance', 'travel'][
          Math.floor(Math.random() * 4)
        ],
        ageGroup: ['18-24', '25-34', '35-44', '45-54'][
          Math.floor(Math.random() * 4)
        ],
      },
    },
    adSlotContext: {
      width: inventory.width,
      height: inventory.height,
      format: inventory.format,
      position: inventory.position,
      pageUrl: `https://example${index}.com/article/content-${index}`,
      pageCategory: [
        'technology',
        'sports',
        'finance',
        'travel',
        'entertainment',
      ][Math.floor(Math.random() * 5)],
      referrerUrl: [
        'https://google.com/search',
        'https://facebook.com',
        'https://twitter.com',
        'direct',
      ][Math.floor(Math.random() * 4)],
      pageKeywords: [
        ['technology', 'innovation', 'AI'],
        ['sports', 'football', 'cricket'],
        ['finance', 'investment', 'banking'],
        ['travel', 'vacation', 'adventure'],
        ['entertainment', 'movies', 'music'],
      ][Math.floor(Math.random() * 5)],
    },
    floorPrice: Number((Math.random() * 2 + 0.1).toFixed(2)), // Random floor price between 0.1 and 2.1
    auctionType: 'SECOND_PRICE',
    timeout: 200,
  };
}

// Send single bid request
async function sendBidRequest(payload, index) {
  const startTime = Date.now();

  try {
    console.log(
      `🚀 Sending bid-request ${index + 1} for inventory: ${payload.inventoryId.substring(0, 8)}...`,
    );

    const response = await axios.post(CONFIG.endpoint, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RTB-Load-Test/1.0',
      },
      timeout: 10000, // 10 second timeout
    });

    const responseTime = Date.now() - startTime;

    // Extract requestId from the nested response structure
    const requestId =
      response.data?.data?.requestId || response.data?.requestId;
    const auctionId =
      response.data?.data?.auctionId || response.data?.auctionId;
    const message = response.data?.data?.message || response.data?.message;

    console.log(` Bid-request ${index + 1} SUCCESS (${responseTime}ms):`, {
      status: response.status,
      requestId: requestId?.substring(0, 12) + '...',
      auctionId: auctionId?.substring(0, 12) + '...',
      message: message,
    });

    return {
      index: index + 1,
      success: true,
      responseTime,
      requestId: requestId,
      auctionId: auctionId,
      status: response.status,
      inventoryId: payload.inventoryId,
      message: message,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    console.log(`❌ Bid-request ${index + 1} FAILED (${responseTime}ms):`, {
      error: error.response?.data?.message || error.message,
      status: error.response?.status || 'NO_RESPONSE',
      inventoryId: payload.inventoryId.substring(0, 8) + '...',
    });

    return {
      index: index + 1,
      success: false,
      responseTime,
      error: error.response?.data?.message || error.message,
      status: error.response?.status || 'ERROR',
      inventoryId: payload.inventoryId,
    };
  }
}

// Send bid response request
async function sendBidResponseRequest(requestId, index) {
  const startTime = Date.now();
  const bidResponseEndpoint = `http://localhost:3000/rtb/bid-response/${requestId}`;

  try {
    console.log(
      `🔍 Fetching bid-response ${index + 1} for requestId: ${requestId.substring(0, 12)}...`,
    );

    const response = await axios.get(bidResponseEndpoint, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RTB-Load-Test/1.0',
      },
      timeout: 10000, // 10 second timeout
    });

    const responseTime = Date.now() - startTime;

    // Extract data from nested response structure
    const responseData = response.data?.data || response.data;
    const hasWinningBid = !!responseData?.winningBid;
    const impressionUrls = responseData?.winningBid?.impressionUrls || [];

    console.log(` Bid-response ${index + 1} SUCCESS (${responseTime}ms):`, {
      status: response.status,
      requestId: requestId.substring(0, 12) + '...',
      responseStatus: responseData?.status,
      hasWinner: hasWinningBid,
      impressionUrls: impressionUrls.length,
      message: responseData?.message,
    });

    return {
      index: index + 1,
      success: true,
      responseTime,
      requestId: requestId,
      status: response.status,
      bidResponseStatus: responseData?.status,
      hasWinningBid: hasWinningBid,
      impressionUrls: impressionUrls,
      auctionData: responseData?.auctionData,
      message: responseData?.message,
      responseData: responseData, // Keep full response for impression tracking
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    console.log(`❌ Bid-response ${index + 1} FAILED (${responseTime}ms):`, {
      error: error.response?.data?.message || error.message,
      status: error.response?.status || 'NO_RESPONSE',
      requestId: requestId.substring(0, 12) + '...',
    });

    return {
      index: index + 1,
      success: false,
      responseTime,
      error: error.response?.data?.message || error.message,
      status: error.response?.status || 'ERROR',
      requestId: requestId,
      impressionUrls: [],
    };
  }
}

// NEW: Send impression tracking request
async function sendImpressionTrackingRequest(impressionUrl, index, requestId) {
  const startTime = Date.now();

  try {
    console.log(
      `👁️  Tracking impression ${index + 1} for requestId: ${requestId.substring(0, 12)}...`,
    );

    const response = await axios.get(impressionUrl, {
      headers: {
        'User-Agent': 'RTB-Load-Test/1.0',
        Accept: 'image/png,image/jpeg,image/gif,image/webp,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 5000, // 5 second timeout for tracking
      validateStatus: () => true, // Accept any status code
    });

    const responseTime = Date.now() - startTime;

    console.log(` Impression ${index + 1} TRACKED (${responseTime}ms):`, {
      status: response.status,
      requestId: requestId.substring(0, 12) + '...',
      url: impressionUrl.substring(0, 80) + '...',
    });

    return {
      index: index + 1,
      success: true,
      responseTime,
      requestId: requestId,
      status: response.status,
      impressionUrl: impressionUrl,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    console.log(`❌ Impression ${index + 1} FAILED (${responseTime}ms):`, {
      error: error.message,
      status: error.response?.status || 'NO_RESPONSE',
      requestId: requestId.substring(0, 12) + '...',
    });

    return {
      index: index + 1,
      success: false,
      responseTime,
      error: error.message,
      status: error.response?.status || 'ERROR',
      requestId: requestId,
      impressionUrl: impressionUrl,
    };
  }
}

// Send requests in batches
async function sendBatchRequests(
  requests,
  batchSize = CONFIG.concurrentRequests,
) {
  const results = [];

  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    console.log(
      `\n📦 Processing bid-request batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(requests.length / batchSize)} (${batch.length} requests)`,
    );

    const batchPromises = batch.map((request, batchIndex) =>
      sendBidRequest(request.payload, request.index),
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Add delay between batches (except for the last batch)
    if (i + batchSize < requests.length) {
      console.log(
        `⏳ Waiting ${CONFIG.delayBetweenBatches}ms before next batch...`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, CONFIG.delayBetweenBatches),
      );
    }
  }

  return results;
}

// Send bid response requests for all successful bid requests
async function sendBatchBidResponseRequests(
  requestIds,
  batchSize = CONFIG.concurrentRequests,
) {
  const results = [];

  console.log(
    `\n🔍 Starting bid-response requests for ${requestIds.length} request IDs...`,
  );

  for (let i = 0; i < requestIds.length; i += batchSize) {
    const batch = requestIds.slice(i, i + batchSize);
    console.log(
      `\n📦 Processing bid-response batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(requestIds.length / batchSize)} (${batch.length} requests)`,
    );

    const batchPromises = batch.map((requestId, batchIndex) =>
      sendBidResponseRequest(requestId, i + batchIndex),
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Add delay between batches (except for the last batch)
    if (i + batchSize < requestIds.length) {
      console.log(
        `⏳ Waiting ${CONFIG.delayBetweenBatches}ms before next batch...`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, CONFIG.delayBetweenBatches),
      );
    }
  }

  return results;
}

// NEW: Send impression tracking requests for successful bid responses with winners
async function sendBatchImpressionRequests(
  bidResponseResults,
  batchSize = CONFIG.concurrentRequests,
) {
  const impressionRequests = [];

  // Extract impression URLs from successful bid responses with winners
  bidResponseResults.forEach((result) => {
    if (
      result.success &&
      result.hasWinningBid &&
      result.impressionUrls.length > 0
    ) {
      impressionRequests.push({
        impressionUrl: result.impressionUrls[0], // Use first impression URL
        requestId: result.requestId,
        index: result.index,
      });
    }
  });

  if (impressionRequests.length === 0) {
    console.log('\n👁️  No impression URLs to track');
    return [];
  }

  const results = [];
  console.log(
    `\n👁️  Starting impression tracking for ${impressionRequests.length} impression URLs...`,
  );

  for (let i = 0; i < impressionRequests.length; i += batchSize) {
    const batch = impressionRequests.slice(i, i + batchSize);
    console.log(
      `\n📦 Processing impression batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(impressionRequests.length / batchSize)} (${batch.length} requests)`,
    );

    const batchPromises = batch.map((request, batchIndex) =>
      sendImpressionTrackingRequest(
        request.impressionUrl,
        i + batchIndex,
        request.requestId,
      ),
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Add delay between batches (except for the last batch)
    if (i + batchSize < impressionRequests.length) {
      console.log(
        `⏳ Waiting ${CONFIG.delayBetweenBatches}ms before next batch...`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, CONFIG.delayBetweenBatches),
      );
    }
  }

  return results;
}

// Generate summary statistics
function generateSummary(
  bidRequestResults,
  bidResponseResults,
  impressionResults,
  totalTime,
) {
  // Bid Request Summary
  const successfulBidRequests = bidRequestResults.filter((r) => r.success);
  const failedBidRequests = bidRequestResults.filter(
    (r) => r.success === false,
  );

  const bidRequestResponseTimes = successfulBidRequests.map(
    (r) => r.responseTime,
  );
  const avgBidRequestTime =
    bidRequestResponseTimes.length > 0
      ? Math.round(
          bidRequestResponseTimes.reduce((a, b) => a + b, 0) /
            bidRequestResponseTimes.length,
        )
      : 0;

  // Bid Response Summary
  const successfulBidResponses = bidResponseResults.filter((r) => r.success);
  const failedBidResponses = bidResponseResults.filter(
    (r) => r.success === false,
  );

  const bidResponseResponseTimes = successfulBidResponses.map(
    (r) => r.responseTime,
  );
  const avgBidResponseTime =
    bidResponseResponseTimes.length > 0
      ? Math.round(
          bidResponseResponseTimes.reduce((a, b) => a + b, 0) /
            bidResponseResponseTimes.length,
        )
      : 0;

  // Impression Summary
  const successfulImpressions = impressionResults.filter((r) => r.success);
  const failedImpressions = impressionResults.filter(
    (r) => r.success === false,
  );

  const impressionResponseTimes = successfulImpressions.map(
    (r) => r.responseTime,
  );
  const avgImpressionTime =
    impressionResponseTimes.length > 0
      ? Math.round(
          impressionResponseTimes.reduce((a, b) => a + b, 0) /
            impressionResponseTimes.length,
        )
      : 0;

  // Auction Results Analysis
  const completedAuctions = successfulBidResponses.filter(
    (r) => r.bidResponseStatus === 'completed',
  );
  const processingAuctions = successfulBidResponses.filter(
    (r) => r.bidResponseStatus === 'processing',
  );
  const noBidsAuctions = successfulBidResponses.filter(
    (r) => r.bidResponseStatus === 'no_bids',
  );
  const auctionsWithWinners = successfulBidResponses.filter(
    (r) => r.hasWinningBid,
  );

  const allResponseTimes = [
    ...bidRequestResponseTimes,
    ...bidResponseResponseTimes,
    ...impressionResponseTimes,
  ];
  const minResponseTime =
    allResponseTimes.length > 0 ? Math.min(...allResponseTimes) : 0;
  const maxResponseTime =
    allResponseTimes.length > 0 ? Math.max(...allResponseTimes) : 0;

  const totalRequests =
    bidRequestResults.length +
    bidResponseResults.length +
    impressionResults.length;
  const totalSuccessful =
    successfulBidRequests.length +
    successfulBidResponses.length +
    successfulImpressions.length;
  const throughput = (totalSuccessful / (totalTime / 1000)).toFixed(2);

  return {
    // Overall
    totalRequests,
    totalSuccessful,
    totalFailed: totalRequests - totalSuccessful,
    overallSuccessRate: ((totalSuccessful / totalRequests) * 100).toFixed(1),
    totalTime: (totalTime / 1000).toFixed(2),
    throughput,

    // Bid Requests
    bidRequestResults: {
      total: bidRequestResults.length,
      successful: successfulBidRequests.length,
      failed: failedBidRequests.length,
      successRate: (
        (successfulBidRequests.length / bidRequestResults.length) *
        100
      ).toFixed(1),
      avgResponseTime: avgBidRequestTime,
      minResponseTime:
        bidRequestResponseTimes.length > 0
          ? Math.min(...bidRequestResponseTimes)
          : 0,
      maxResponseTime:
        bidRequestResponseTimes.length > 0
          ? Math.max(...bidRequestResponseTimes)
          : 0,
    },

    // Bid Responses
    bidResponseResults: {
      total: bidResponseResults.length,
      successful: successfulBidResponses.length,
      failed: failedBidResponses.length,
      successRate: (
        (successfulBidResponses.length / bidResponseResults.length) *
        100
      ).toFixed(1),
      avgResponseTime: avgBidResponseTime,
      minResponseTime:
        bidResponseResponseTimes.length > 0
          ? Math.min(...bidResponseResponseTimes)
          : 0,
      maxResponseTime:
        bidResponseResponseTimes.length > 0
          ? Math.max(...bidResponseResponseTimes)
          : 0,
    },

    // Impression Tracking
    impressionResults: {
      total: impressionResults.length,
      successful: successfulImpressions.length,
      failed: failedImpressions.length,
      successRate:
        impressionResults.length > 0
          ? (
              (successfulImpressions.length / impressionResults.length) *
              100
            ).toFixed(1)
          : '0.0',
      avgResponseTime: avgImpressionTime,
      minResponseTime:
        impressionResponseTimes.length > 0
          ? Math.min(...impressionResponseTimes)
          : 0,
      maxResponseTime:
        impressionResponseTimes.length > 0
          ? Math.max(...impressionResponseTimes)
          : 0,
    },

    // Auction Analysis
    auctionAnalysis: {
      completed: completedAuctions.length,
      processing: processingAuctions.length,
      noBids: noBidsAuctions.length,
      withWinners: auctionsWithWinners.length,
      impressionsTracked: successfulImpressions.length,
      winRate:
        bidResponseResults.length > 0
          ? (
              (auctionsWithWinners.length / bidResponseResults.length) *
              100
            ).toFixed(1)
          : '0.0',
      impressionTrackingRate:
        auctionsWithWinners.length > 0
          ? (
              (successfulImpressions.length / auctionsWithWinners.length) *
              100
            ).toFixed(1)
          : '0.0',
    },

    // Performance
    performance: {
      minResponseTime,
      maxResponseTime,
      avgOverallResponseTime: Math.round(
        (avgBidRequestTime + avgBidResponseTime + avgImpressionTime) / 3,
      ),
    },
  };
}

// Main execution function
async function runLoadTest() {
  console.log(
    '🎯 Starting Enhanced RTB Load Test (Bid Request + Response + Impression Tracking)',
  );
  console.log('='.repeat(80));
  console.log(`📊 Configuration:`);
  console.log(`   • Bid Request Endpoint: ${CONFIG.endpoint}`);
  console.log(
    `   • Bid Response Endpoint: http://localhost:3000/rtb/bid-response/{requestId}`,
  );
  console.log(`   • Impression Tracking: Automatic for winning bids`);
  console.log(`   • Total Requests: ${CONFIG.numberOfRequests}`);
  console.log(`   • Concurrent Requests: ${CONFIG.concurrentRequests}`);
  console.log(`   • Delay Between Batches: ${CONFIG.delayBetweenBatches}ms`);
  console.log(`   • Available Inventory Slots: ${inventoryData.length}`);
  console.log('='.repeat(80));

  const startTime = Date.now();

  // Generate request payloads
  console.log('🔧 Generating request payloads...');
  const requests = [];

  for (let i = 0; i < CONFIG.numberOfRequests; i++) {
    const inventory = inventoryData[i % inventoryData.length]; // Cycle through inventory
    const payload = createBidRequestPayload(inventory, i);
    requests.push({ payload, index: i });
  }

  console.log(` Generated ${requests.length} unique request payloads\n`);

  // PHASE 1: Send bid requests
  console.log('🚀 PHASE 1: Starting bid-request execution...');
  const bidRequestResults = await sendBatchRequests(requests);

  // Extract successful request IDs
  const successfulRequestIds = bidRequestResults
    .filter((result) => result.success && result.requestId)
    .map((result) => result.requestId);

  console.log(
    `\n Phase 1 Complete: ${successfulRequestIds.length}/${bidRequestResults.length} bid-requests successful`,
  );

  if (successfulRequestIds.length === 0) {
    console.log('❌ No successful bid-requests found. Stopping load test.');
    return;
  }

  // Add delay before Phase 2 to allow auctions to process
  console.log('⏳ Waiting 2 seconds for auctions to process...');
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // PHASE 2: Send bid response requests
  console.log('\n🔍 PHASE 2: Starting bid-response execution...');
  const bidResponseResults =
    await sendBatchBidResponseRequests(successfulRequestIds);

  console.log(
    `\n Phase 2 Complete: ${bidResponseResults.filter((r) => r.success).length}/${bidResponseResults.length} bid-responses successful`,
  );

  // PHASE 3: Track impressions for winning bids
  console.log('\n👁️  PHASE 3: Starting impression tracking...');
  const impressionResults =
    await sendBatchImpressionRequests(bidResponseResults);

  const totalTime = Date.now() - startTime;

  console.log(
    `\n Phase 3 Complete: ${impressionResults.filter((r) => r.success).length}/${impressionResults.length} impressions tracked`,
  );

  // Generate and display comprehensive summary
  console.log('\n' + '='.repeat(80));
  console.log('📈 COMPREHENSIVE LOAD TEST SUMMARY');
  console.log('='.repeat(80));

  const summary = generateSummary(
    bidRequestResults,
    bidResponseResults,
    impressionResults,
    totalTime,
  );

  console.log(`📊 Overall Statistics:`);
  console.log(
    `   • Total API Calls: ${summary.totalRequests} (${summary.bidRequestResults.total} bid-requests + ${summary.bidResponseResults.total} bid-responses + ${summary.impressionResults.total} impressions)`,
  );
  console.log(
    `   • Overall Success: ${summary.totalSuccessful}/${summary.totalRequests} (${summary.overallSuccessRate}%)`,
  );
  console.log(`   • Total Time: ${summary.totalTime}s`);
  console.log(`   • Throughput: ${summary.throughput} requests/second`);

  console.log(`\n🚀 Bid Request Performance:`);
  console.log(
    `   • Success Rate: ${summary.bidRequestResults.successful}/${summary.bidRequestResults.total} (${summary.bidRequestResults.successRate}%)`,
  );
  console.log(
    `   • Avg Response Time: ${summary.bidRequestResults.avgResponseTime}ms`,
  );
  console.log(
    `   • Min/Max: ${summary.bidRequestResults.minResponseTime}ms / ${summary.bidRequestResults.maxResponseTime}ms`,
  );

  console.log(`\n🔍 Bid Response Performance:`);
  console.log(
    `   • Success Rate: ${summary.bidResponseResults.successful}/${summary.bidResponseResults.total} (${summary.bidResponseResults.successRate}%)`,
  );
  console.log(
    `   • Avg Response Time: ${summary.bidResponseResults.avgResponseTime}ms`,
  );
  console.log(
    `   • Min/Max: ${summary.bidResponseResults.minResponseTime}ms / ${summary.bidResponseResults.maxResponseTime}ms`,
  );

  console.log(`\n👁️  Impression Tracking Performance:`);
  console.log(
    `   • Success Rate: ${summary.impressionResults.successful}/${summary.impressionResults.total} (${summary.impressionResults.successRate}%)`,
  );
  console.log(
    `   • Avg Response Time: ${summary.impressionResults.avgResponseTime}ms`,
  );
  console.log(
    `   • Min/Max: ${summary.impressionResults.minResponseTime}ms / ${summary.impressionResults.maxResponseTime}ms`,
  );

  console.log(`\n🎯 Auction Analysis:`);
  console.log(`   • Completed Auctions: ${summary.auctionAnalysis.completed}`);
  console.log(`   • Still Processing: ${summary.auctionAnalysis.processing}`);
  console.log(`   • No Bids: ${summary.auctionAnalysis.noBids}`);
  console.log(
    `   • Auctions with Winners: ${summary.auctionAnalysis.withWinners} (${summary.auctionAnalysis.winRate}% win rate)`,
  );
  console.log(
    `   • Impressions Tracked: ${summary.auctionAnalysis.impressionsTracked} (${summary.auctionAnalysis.impressionTrackingRate}% tracking rate)`,
  );

  console.log(`\n⚡ Overall Performance:`);
  console.log(
    `   • Fastest Response: ${summary.performance.minResponseTime}ms`,
  );
  console.log(
    `   • Slowest Response: ${summary.performance.maxResponseTime}ms`,
  );
  console.log(
    `   • Average Response: ${summary.performance.avgOverallResponseTime}ms`,
  );

  // Show failed requests details
  const allFailedRequests = [
    ...bidRequestResults
      .filter((r) => !r.success)
      .map((r) => ({ ...r, type: 'bid-request' })),
    ...bidResponseResults
      .filter((r) => !r.success)
      .map((r) => ({ ...r, type: 'bid-response' })),
    ...impressionResults
      .filter((r) => !r.success)
      .map((r) => ({ ...r, type: 'impression' })),
  ];

  if (allFailedRequests.length > 0) {
    console.log(`\n❌ Failed Requests Details:`);
    allFailedRequests.slice(0, 5).forEach((req) => {
      console.log(
        `   • ${req.type} ${req.index}: ${req.error} (${req.status})`,
      );
    });
    if (allFailedRequests.length > 5) {
      console.log(`   ... and ${allFailedRequests.length - 5} more failures`);
    }
  }

  // Show sample successful auction results with impressions tracked
  const auctionsWithTrackedImpressions = impressionResults
    .filter((r) => r.success)
    .slice(0, 3);
  if (auctionsWithTrackedImpressions.length > 0) {
    console.log(`\n🏆 Sample Successful Auctions with Tracked Impressions:`);
    auctionsWithTrackedImpressions.forEach((impression) => {
      console.log(
        `   • Request ${impression.index}: ${impression.requestId?.substring(0, 20)}... (${impression.responseTime}ms tracking)`,
      );
    });
  }

  // Show sample successful auction results
  const auctionsWithWinners = bidResponseResults
    .filter((r) => r.success && r.hasWinningBid)
    .slice(0, 3);
  if (auctionsWithWinners.length > 0) {
    console.log(`\n🏆 Sample Successful Auctions with Winners:`);
    auctionsWithWinners.forEach((auction) => {
      const hasTrackedImpression = impressionResults.some(
        (imp) => imp.requestId === auction.requestId && imp.success,
      );
      console.log(
        `   • Request ${auction.index}: ${auction.requestId?.substring(0, 20)}... (${auction.responseTime}ms) ${hasTrackedImpression ? '👁️ ' : '👁️ ❌'}`,
      );
    });
  }

  // Show sample processing auctions
  const processingAuctions = bidResponseResults
    .filter((r) => r.success && r.bidResponseStatus === 'processing')
    .slice(0, 3);
  if (processingAuctions.length > 0) {
    console.log(`\n⏳ Sample Still Processing Auctions:`);
    processingAuctions.forEach((auction) => {
      console.log(
        `   • Request ${auction.index}: ${auction.requestId?.substring(0, 20)}... (${auction.responseTime}ms)`,
      );
    });
  }

  // Show funnel analysis
  console.log(`\n📊 RTB Funnel Analysis:`);
  console.log(`   • Bid Requests Sent: ${bidRequestResults.length}`);
  console.log(
    `   • Bid Requests Successful: ${bidRequestResults.filter((r) => r.success).length} (${((bidRequestResults.filter((r) => r.success).length / bidRequestResults.length) * 100).toFixed(1)}%)`,
  );
  console.log(
    `   • Bid Responses Received: ${bidResponseResults.filter((r) => r.success).length} (${((bidResponseResults.filter((r) => r.success).length / bidRequestResults.filter((r) => r.success).length) * 100).toFixed(1)}%)`,
  );
  console.log(
    `   • Auctions with Winners: ${summary.auctionAnalysis.withWinners} (${summary.auctionAnalysis.winRate}%)`,
  );
  console.log(
    `   • Impressions Tracked: ${summary.auctionAnalysis.impressionsTracked} (${summary.auctionAnalysis.impressionTrackingRate}%)`,
  );

  const conversionRate =
    bidRequestResults.length > 0
      ? (
          (summary.auctionAnalysis.impressionsTracked /
            bidRequestResults.length) *
          100
        ).toFixed(2)
      : '0.00';
  console.log(
    `   • End-to-End Conversion: ${conversionRate}% (bid-request → impression tracked)`,
  );

  console.log('\n🎉 Enhanced RTB load test finished!');
  console.log('='.repeat(80));
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Run the load test
if (require.main === module) {
  runLoadTest().catch((error) => {
    console.error('❌ Load test failed:', error);
    process.exit(1);
  });
}

module.exports = { runLoadTest, createBidRequestPayload };
