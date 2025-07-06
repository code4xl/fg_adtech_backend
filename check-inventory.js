const { PrismaClient } = require('@prisma/client');

async function checkInventory() {
  const prisma = new PrismaClient();

  try {
    console.log('🔍 Starting inventory check...');

    // First check if the website exists
    const website = await prisma.website.findUnique({
      where: {
        id: '87690135-4199-4b1f-a960-93beb240759e',
      },
      include: {
        publisher: true,
      },
    });

    if (!website) {
      console.log('❌ Website not found!');
      return;
    }

    console.log('✅ Website found:');
    console.log(`   ID: ${website.id}`);
    console.log(`   Name: ${website.name}`);
    console.log(`   Domain: ${website.domain}`);
    console.log(`   Active: ${website.isActive}`);
    console.log(`   Publisher: ${website.publisher.email}`);

    console.log('\n🔍 Checking inventory for website:', website.id);

    const inventory = await prisma.inventory.findMany({
      where: {
        websiteId: '87690135-4199-4b1f-a960-93beb240759e',
      },
      include: {
        adSlotTemplate: true,
      },
    });

    console.log('📦 Found inventory items:', inventory.length);

    if (inventory.length === 0) {
      console.log('❌ No inventory items found for this website!');

      // Let's check all inventory to see what's there
      const allInventory = await prisma.inventory.findMany({
        include: {
          website: true,
          adSlotTemplate: true,
        },
        take: 5,
      });

      console.log('\n📋 Sample inventory from database:');
      allInventory.forEach((item, index) => {
        console.log(
          `${index + 1}. ${item.name} (Website: ${item.website?.domain || 'Unknown'}, ID: ${item.websiteId})`,
        );
      });

      return;
    }

    inventory.forEach((item, index) => {
      console.log(`\n${index + 1}. ${item.name}`);
      console.log(`   ID: ${item.id}`);
      console.log(`   Active: ${item.isActive}`);
      console.log(`   Format: ${item.adFormat}`);
      console.log(`   Size: ${item.width}x${item.height}`);
      console.log(`   Position: ${item.position}`);
      console.log(`   AdSlot Template: ${item.adSlotTemplate?.id || 'None'}`);
    });

    // Also check active inventory
    const activeInventory = await prisma.inventory.findMany({
      where: {
        websiteId: '87690135-4199-4b1f-a960-93beb240759e',
        isActive: true,
      },
    });

    console.log(`\n✅ Active inventory items: ${activeInventory.length}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkInventory();
