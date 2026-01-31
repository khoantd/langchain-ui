const { PrismaClient } = require('@prisma/client');
const { csvParse } = require('d3-dsv');
const fs = require('fs');

const prisma = new PrismaClient();

async function migrateExistingDatasources() {
  console.log('Starting migration of existing datasources...');
  
  try {
    const datasources = await prisma.datasource.findMany({
      where: { content: null }
    });

    console.log(`Found ${datasources.length} datasources to migrate`);

    for (const datasource of datasources) {
      console.log(`\nMigrating datasource: ${datasource.name}`);
      console.log(`URL: ${datasource.url}`);
      
      try {
        // Skip mock URLs or localhost URLs for now
        if (datasource.url.includes('mock-upload') || datasource.url.includes('localhost')) {
          console.log('Skipping mock/localhost URL - would need manual file upload');
          continue;
        }

        // Try to fetch CSV from existing URL
        const response = await fetch(datasource.url);
        if (!response.ok) {
          console.error(`Failed to fetch from URL: ${datasource.url} - Status: ${response.status}`);
          continue;
        }
        
        const csvText = await response.text();
        console.log(`Downloaded CSV text length: ${csvText.length}`);
        
        // Validate CSV format
        const data = csvParse(csvText);
        console.log(`Parsed CSV with ${data.length} rows and ${data.length > 0 ? Object.keys(data[0]).length : 0} columns`);
        
        // Update datasource with content
        await prisma.datasource.update({
          where: { id: datasource.id },
          data: { 
            content: csvText,
            size: csvText.length
          }
        });
        
        console.log(`✅ Successfully migrated: ${datasource.name}`);
        
        // Save a backup of the migrated CSV
        const backupFile = `migrated-datasource-${datasource.id}-${datasource.name.replace(/[^a-zA-Z0-9]/g, '-')}.csv`;
        fs.writeFileSync(backupFile, csvText);
        console.log(`📁 Saved backup to: ${backupFile}`);
        
      } catch (error) {
        console.error(`❌ Failed to migrate ${datasource.name}:`, error.message);
      }
    }
    
    // Show final state
    const allDatasources = await prisma.datasource.findMany();
    console.log(`\n📊 Final state:`);
    console.log(`Total datasources: ${allDatasources.length}`);
    const withContent = allDatasources.filter(ds => ds.content).length;
    console.log(`Datasources with content: ${withContent}`);
    const withoutContent = allDatasources.filter(ds => !ds.content).length;
    console.log(`Datasources without content: ${withoutContent}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateExistingDatasources();