const { PrismaClient } = require('@prisma/client');

async function checkFloorPrices() {
  const prisma = new PrismaClient();

  try {
    console.log('🔍 Checking floor prices for inventory...');

    const inventory = await prisma.adInventory.findMany({
      where: {
        websiteId: '87690135-4199-4b1f-a960-93beb240759e',
        isActive: true,
      },
      include: {
        adSlotTemplate: true,
        floorPrices: {
          where: {
            AND: [
              {
                OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
              },
              { startDate: { lte: new Date() } },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    console.log(`📦 Found ${inventory.length} active inventory items:`);

    inventory.forEach((item, index) => {
      console.log(`\n${index + 1}. ${item.name} (${item.id})`);
      console.log(
        `   Template: ${item.adSlotTemplate?.name} (${item.adSlotTemplate?.width}x${item.adSlotTemplate?.height})`,
      );
      console.log(`   Format: ${item.adSlotTemplate?.format}`);
      console.log(`   Position: ${item.adSlotTemplate?.position}`);
      console.log(`   Floor Prices: ${item.floorPrices?.length || 0}`);

      if (item.floorPrices?.length > 0) {
        const floorPrice = item.floorPrices[0];
        console.log(
          `     Price: ₹${floorPrice.basePrice} ${floorPrice.currency}`,
        );
        console.log(`     Start: ${floorPrice.startDate}`);
        console.log(`     End: ${floorPrice.endDate || 'Never'}`);
      } else {
        console.log(
          `     ❌ NO FLOOR PRICES - This will be skipped in SDK config!`,
        );
      }
    });

    // Check if we need to create floor prices
    const itemsWithoutFloorPrices = inventory.filter(
      (item) => !item.floorPrices || item.floorPrices.length === 0,
    );

    if (itemsWithoutFloorPrices.length > 0) {
      console.log(
        `\n🔧 Creating default floor prices for ${itemsWithoutFloorPrices.length} items...`,
      );

      for (const item of itemsWithoutFloorPrices) {
        const floorPrice = await prisma.floorPrice.create({
          data: {
            inventoryId: item.id,
            basePrice: 8.5, // Default ₹8.50 CPM (roughly $0.10)
            currency: 'INR',
            startDate: new Date(),
            endDate: null,
          },
        });

        console.log(
          `✅ Created floor price for ${item.name}: ₹${floorPrice.basePrice} ${floorPrice.currency}`,
        );
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkFloorPrices();
