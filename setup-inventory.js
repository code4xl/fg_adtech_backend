const { PrismaClient } = require('@prisma/client');

async function setupInventory() {
  console.log('🔧 Initializing Prisma Client...');

  let prisma;
  try {
    prisma = new PrismaClient();
    console.log('✅ Prisma Client initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Prisma Client:', error.message);
    return;
  }

  try {
    console.log(
      '🔧 Setting up inventory for website: 87690135-4199-4b1f-a960-93beb240759e',
    );

    const websiteId = '87690135-4199-4b1f-a960-93beb240759e';

    // Test basic connection
    console.log('🔍 Testing database connection...');
    const testQuery = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database connection successful:', testQuery);

    // First, let's check if inventory already exists
    console.log('📦 Checking existing inventory...');
    const existingInventory = await prisma.adInventory.findMany({
      where: { websiteId },
    });

    console.log(`📦 Existing inventory: ${existingInventory.length}`);

    // Define the inventory items we need
    const inventoryItems = [
      {
        id: '15fb5073-c093-4595-b0bf-e4ec34e2e6c1',
        name: 'Desktop Interstitial',
        websiteId: websiteId,
        adSlotTemplateId: '66b83cfa-831c-45c3-9a87-1a1ebdc9350d',
        width: 800,
        height: 600,
        adFormat: 'INTERSTITIAL',
        position: 'ABOVE_FOLD',
        isActive: true,
      },
      {
        id: '814c4b35-ed6a-49b6-bb4d-bac19399f659',
        name: 'Mobile Video',
        websiteId: websiteId,
        adSlotTemplateId: '10016b27-57a5-484f-95c6-37535ecbd7a8',
        width: 320,
        height: 180,
        adFormat: 'VIDEO',
        position: 'ABOVE_FOLD',
        isActive: true,
      },
    ];

    // First, let's check if the adSlotTemplates exist
    for (const item of inventoryItems) {
      console.log(`🔍 Checking adSlotTemplate: ${item.adSlotTemplateId}`);
      const template = await prisma.adSlotTemplate.findUnique({
        where: { id: item.adSlotTemplateId },
      });

      if (!template) {
        console.log(`🔧 Creating adSlotTemplate: ${item.adSlotTemplateId}`);
        await prisma.adSlotTemplate.create({
          data: {
            id: item.adSlotTemplateId,
            name: item.name,
            width: item.width,
            height: item.height,
            format: item.adFormat,
            position: item.position,
            isActive: true,
          },
        });
      } else {
        console.log(`✅ AdSlotTemplate exists: ${item.adSlotTemplateId}`);
      }
    }

    // Now create or update inventory items
    for (const item of inventoryItems) {
      console.log(`🔍 Checking inventory: ${item.id}`);
      const existing = await prisma.adInventory.findUnique({
        where: { id: item.id },
      });

      if (!existing) {
        console.log(`🔧 Creating inventory: ${item.name} (${item.id})`);
        await prisma.adInventory.create({
          data: item,
        });
      } else {
        console.log(`✅ Inventory exists: ${item.name} (${item.id})`);
        // Update to make sure it's active
        await prisma.adInventory.update({
          where: { id: item.id },
          data: { isActive: true },
        });
      }
    }

    // Verify the setup
    console.log('🔍 Verifying final inventory...');
    const finalInventory = await prisma.adInventory.findMany({
      where: {
        websiteId: websiteId,
        isActive: true,
      },
      include: {
        adSlotTemplate: true,
      },
    });

    console.log(`\n✅ Final active inventory count: ${finalInventory.length}`);
    finalInventory.forEach((item, index) => {
      console.log(`${index + 1}. ${item.name} (${item.id})`);
      console.log(
        `   Format: ${item.adFormat}, Size: ${item.width}x${item.height}`,
      );
      console.log(`   Template: ${item.adSlotTemplate?.name || 'None'}`);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (prisma) {
      await prisma.$disconnect();
      console.log('🔌 Prisma Client disconnected');
    }
  }
}

setupInventory();
