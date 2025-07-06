const axios = require('axios');

// Your inventory data
const inventoryData = [
  {
    inventoryId: '0001609b-5234-434c-9fc5-22fb960322c3',
    publisherId: '1bc2bcb8-08f7-4910-be9c-727603e2afd3',
    websiteId: '1a2ab6ea-35ad-423b-907d-4cc8a2e7d6cb',
    width: 320,
    height: 50,
    format: 'BANNER',
    position: 'HEADER',
  },
  {
    inventoryId: '01899f41-9f7b-497e-8005-b2766eca712d',
    publisherId: '31ec645d-59a1-4600-9bfd-e9f30c51308d',
    websiteId: 'cb633138-ea9d-4948-94c4-aeb18355bad9',
    width: 320,
    height: 50,
    format: 'BANNER',
    position: 'HEADER',
  },
  {
    inventoryId: '021fd96f-e922-488d-8c77-8014baf07f9a',
    publisherId: '2974130b-65f8-45f1-b330-7c15d45367a3',
    websiteId: '9c5c88ae-ada4-4287-bff5-7d60c65b1f97',
    width: 728,
    height: 90,
    format: 'BANNER',
    position: 'HEADER',
  },
  {
    inventoryId: '02b15396-ab8d-44d8-9f91-8a994968f360',
    publisherId: 'c77f0795-6ee2-4957-a30e-bcce5e5e0195',
    websiteId: 'def10596-2b53-4950-8dc4-6e8bc6c5a359',
    width: 800,
    height: 600,
    format: 'INTERSTITIAL',
    position: 'ABOVE_FOLD',
  },
  {
    inventoryId: '035a9948-683d-4e11-9baa-9b31a51b67b2',
    publisherId: '731e97dd-7f86-4519-9b62-79b5dfc7bc4b',
    websiteId: 'e38e76c3-6e61-4b34-a306-426cbc635da7',
    width: 320,
    height: 480,
    format: 'REWARDED',
    position: 'ABOVE_FOLD',
  },
  {
    inventoryId: '043f9bd1-5bcc-45c4-9d5a-aa65d720b504',
    publisherId: '543ba291-f834-4787-b008-0a1afb43183e',
    websiteId: '90756f2c-14e7-45d9-bdc7-1976dd251838',
    width: 320,
    height: 480,
    format: 'REWARDED',
    position: 'ABOVE_FOLD',
  },
  {
    inventoryId: '04cb43a7-f055-4adb-9c8b-29bc9d03dd81',
    publisherId: '750dbf6d-ffc2-452a-bfa2-63b62c78c348',
    websiteId: 'c35a86d1-e60b-4d9e-8a77-1747b7ace3e6',
    width: 320,
    height: 50,
    format: 'BANNER',
    position: 'HEADER',
  },
  {
    inventoryId: '06668006-32d4-4bcf-9f85-247b2e02d2b7',
    publisherId: '458e4598-0b5e-42ba-b906-8f2174e55f7e',
    websiteId: '3424eec7-ccd7-4aa9-ab93-63068427c94a',
    width: 300,
    height: 250,
    format: 'NATIVE',
    position: 'IN_CONTENT',
  },
  {
    inventoryId: '07748873-55d2-4a41-8794-5b305addbcad',
    publisherId: 'c569adbe-afc3-40ed-a7a4-eab48d858c21',
    websiteId: '084824b1-2397-46f8-9a2c-415d859a6ed1',
    width: 160,
    height: 600,
    format: 'BANNER',
    position: 'SIDEBAR',
  },
  {
    inventoryId: '0a067905-80ff-4e38-b988-bdc37a813aae',
    publisherId: '6540b482-6418-439a-b702-f4269ce3b69a',
    websiteId: 'b7f5f271-888c-41b0-b634-73a7fb5e4cac',
    width: 728,
    height: 90,
    format: 'BANNER',
    position: 'HEADER',
  },
];

// Configuration
const CONFIG = {
  endpoint: 'http://localhost:3000/rtb/bid-request',
  numberOfRequests: 25, // You can change this between 20-30
  concurrentRequests: 5, // Number of parallel requests
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

    console.log(`✅ Bid-request ${index + 1} SUCCESS (${responseTime}ms):`, {
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

    console.log(`✅ Bid-response ${index + 1} SUCCESS (${responseTime}ms):`, {
      status: response.status,
      requestId: requestId.substring(0, 12) + '...',
      responseStatus: response.data?.status,
      hasWinner: !!response.data?.winningBid,
      message: response.data?.message,
    });

    return {
      index: index + 1,
      success: true,
      responseTime,
      requestId: requestId,
      status: response.status,
      bidResponseStatus: response.data?.status,
      hasWinningBid: !!response.data?.winningBid,
      auctionData: response.data?.auctionData,
      message: response.data?.message,
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

// Generate summary statistics
function generateSummary(bidRequestResults, bidResponseResults, totalTime) {
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
  ];
  const minResponseTime =
    allResponseTimes.length > 0 ? Math.min(...allResponseTimes) : 0;
  const maxResponseTime =
    allResponseTimes.length > 0 ? Math.max(...allResponseTimes) : 0;

  const totalRequests = bidRequestResults.length + bidResponseResults.length;
  const totalSuccessful =
    successfulBidRequests.length + successfulBidResponses.length;
  const throughput = (totalSuccessful / (totalTime / 1000)).toFixed(2);

  return {
    // Overall
    totalRequests,
    totalSuccessful,
    totalFailed:
      bidRequestResults.length + bidResponseResults.length - totalSuccessful,
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

    // Auction Analysis
    auctionAnalysis: {
      completed: completedAuctions.length,
      processing: processingAuctions.length,
      noBids: noBidsAuctions.length,
      withWinners: auctionsWithWinners.length,
      winRate:
        bidResponseResults.length > 0
          ? (
              (auctionsWithWinners.length / bidResponseResults.length) *
              100
            ).toFixed(1)
          : '0.0',
    },

    // Performance
    performance: {
      minResponseTime,
      maxResponseTime,
      avgOverallResponseTime: Math.round(
        (avgBidRequestTime + avgBidResponseTime) / 2,
      ),
    },
  };
}

// Main execution function
async function runLoadTest() {
  console.log('🎯 Starting RTB Bid Request + Response Load Test');
  console.log('='.repeat(60));
  console.log(`📊 Configuration:`);
  console.log(`   • Bid Request Endpoint: ${CONFIG.endpoint}`);
  console.log(
    `   • Bid Response Endpoint: http://localhost:3000/rtb/bid-response/{requestId}`,
  );
  console.log(`   • Total Requests: ${CONFIG.numberOfRequests}`);
  console.log(`   • Concurrent Requests: ${CONFIG.concurrentRequests}`);
  console.log(`   • Delay Between Batches: ${CONFIG.delayBetweenBatches}ms`);
  console.log(`   • Available Inventory Slots: ${inventoryData.length}`);
  console.log('='.repeat(60));

  const startTime = Date.now();

  // Generate request payloads
  console.log('🔧 Generating request payloads...');
  const requests = [];

  for (let i = 0; i < CONFIG.numberOfRequests; i++) {
    const inventory = inventoryData[i % inventoryData.length]; // Cycle through inventory
    const payload = createBidRequestPayload(inventory, i);
    requests.push({ payload, index: i });
  }

  console.log(`✅ Generated ${requests.length} unique request payloads\n`);

  // PHASE 1: Send bid requests
  console.log('🚀 PHASE 1: Starting bid-request execution...');
  const bidRequestResults = await sendBatchRequests(requests);

  // Extract successful request IDs
  const successfulRequestIds = bidRequestResults
    .filter((result) => result.success && result.requestId)
    .map((result) => result.requestId);

  console.log(
    `\n✅ Phase 1 Complete: ${successfulRequestIds.length}/${bidRequestResults.length} bid-requests successful`,
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

  const totalTime = Date.now() - startTime;

  // Generate and display comprehensive summary
  console.log('\n' + '='.repeat(80));
  console.log('📈 COMPREHENSIVE LOAD TEST SUMMARY');
  console.log('='.repeat(80));

  const summary = generateSummary(
    bidRequestResults,
    bidResponseResults,
    totalTime,
  );

  console.log(`📊 Overall Statistics:`);
  console.log(
    `   • Total API Calls: ${summary.totalRequests} (${summary.bidRequestResults.total} bid-requests + ${summary.bidResponseResults.total} bid-responses)`,
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

  console.log(`\n🎯 Auction Analysis:`);
  console.log(`   • Completed Auctions: ${summary.auctionAnalysis.completed}`);
  console.log(`   • Still Processing: ${summary.auctionAnalysis.processing}`);
  console.log(`   • No Bids: ${summary.auctionAnalysis.noBids}`);
  console.log(
    `   • Auctions with Winners: ${summary.auctionAnalysis.withWinners} (${summary.auctionAnalysis.winRate}% win rate)`,
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

  // Show sample successful auction results
  const auctionsWithWinners = bidResponseResults
    .filter((r) => r.success && r.hasWinningBid)
    .slice(0, 3);
  if (auctionsWithWinners.length > 0) {
    console.log(`\n🏆 Sample Successful Auctions with Winners:`);
    auctionsWithWinners.forEach((auction) => {
      console.log(
        `   • Request ${auction.index}: ${auction.requestId?.substring(0, 20)}... (${auction.responseTime}ms)`,
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

  console.log('\n🎉 Complete RTB load test finished!');
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
