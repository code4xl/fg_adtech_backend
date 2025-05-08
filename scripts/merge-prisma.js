const fs = require('fs');
const path = require('path');
const baseSchemaPath = path.join(__dirname, '../prisma/schema/schema.prisma');
const outputSchemaPath = path.join(
  __dirname,
  '../prisma/schema/schema.generated.prisma',
);
const prismaDir = path.join(__dirname, '../prisma');

function getAllPrismaFiles(dirPath, collected = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      getAllPrismaFiles(fullPath, collected);
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.prisma') &&
      entry.name !== 'schema.prisma' &&
      entry.name !== 'schema.generated.prisma'
    ) {
      collected.push(fullPath);
    }
  }
  return collected;
}

// Read the base schema containing generator and datasource blocks
const base = fs.readFileSync(baseSchemaPath, 'utf-8');

// Get all model files
const allPrismaFiles = getAllPrismaFiles(prismaDir);

// Read and concatenate model definitions
const modelContents = allPrismaFiles.map((file) =>
  fs.readFileSync(file, 'utf-8'),
);
const parts = modelContents.join('\n\n');

// Write the final schema
fs.writeFileSync(outputSchemaPath, base + '\n\n' + parts);

console.log(
  `✅ schema.generated.prisma built from ${allPrismaFiles.length} files.`,
);
