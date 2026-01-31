import { csvParse } from 'd3-dsv';
import VectorDatabase from './vector-database.js';

class DatasourceIndexer {
  constructor() {
    this.vectorDB = new VectorDatabase();
    this.cache = new Map(); // datasourceId -> indexed data
  }

  async indexDatasource(datasource) {
    if (!datasource || !datasource.content) {
      console.log('No datasource content to index');
      return { success: false, error: 'No content available' };
    }

    try {
      console.log(`Starting indexing for datasource: ${datasource.name} (${datasource.content.length} chars)`);
      
      // Initialize vector database before indexing
      await this.vectorDB.initialize();
      console.log('Vector database initialized successfully');
      
      // Parse CSV content
      const data = csvParse(datasource.content);
      console.log(`Parsed ${data.length} rows from CSV`);
      
      if (data.length === 0) {
        return { success: false, error: 'CSV contains no data' };
      }

      // Create documents for indexing
      const documents = [];
      const batchSize = 10; // Process in batches to avoid memory issues
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        // Convert row to text for embedding
        const rowText = Object.entries(row)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        
        // Create document with metadata
        const document = {
          content: rowText,
          metadata: {
            datasourceId: datasource.id,
            datasourceName: datasource.name,
            rowIndex: i,
            rowData: row,
            contentType: 'csv_row',
            indexedAt: new Date().toISOString()
          }
        };
        
        documents.push(document);
        
        // Process in batches
        if (documents.length >= batchSize) {
          console.log(`Processing batch ${Math.floor(i / batchSize) + 1}, documents: ${documents.length}`);
          await this.vectorDB.addDocuments(documents);
          documents.length = 0; // Clear batch
        }
      }
      
      // Process remaining documents
      if (documents.length > 0) {
        console.log(`Processing final batch, remaining documents: ${documents.length}`);
        await this.vectorDB.addDocuments(documents);
      }
      
      // Cache the indexed data
      this.cache.set(datasource.id, {
        datasource,
        indexedAt: new Date().toISOString(),
        totalRows: data.length,
        vectorDBStats: this.vectorDB.getStats()
      });
      
      console.log(`✅ Successfully indexed ${data.length} rows from datasource: ${datasource.name}`);
      
      return {
        success: true,
        indexedRows: data.length,
        vectorDBStats: this.vectorDB.getStats()
      };
      
    } catch (error) {
      console.error(`Error indexing datasource ${datasource.name}:`, error);
      return { success: false, error: error.message };
    }
  }

  async searchDatasources(query, datasources = []) {
    try {
      console.log(`Searching across ${datasources.length} datasources for: "${query}"`);
      
      // Ensure all datasources are indexed
      const indexingPromises = datasources.map(async (datasource) => {
        if (!this.cache.has(datasource.id)) {
          console.log(`Indexing datasource: ${datasource.name}`);
          return this.indexDatasource(datasource);
        }
        return Promise.resolve({ success: true });
      });
      
      await Promise.all(indexingPromises);
      
      // Get search options from user preferences
      const searchOptions = {
        maxResults: 8, // 5-10 results as requested
        semanticWeight: 0.6, // Hybrid approach
        keywordWeight: 0.4,
        similarityThreshold: 0.7, // Balanced threshold
        includeBM25: true
      };
      
      // Search across all indexed datasources
      const allResults = await this.vectorDB.search(query, searchOptions);
      
      // Group results by datasource
      const resultsByDatasource = new Map();
      allResults.forEach(result => {
        const metadata = result.document.metadata;
        const datasourceId = metadata.datasourceId;
        
        if (!resultsByDatasource.has(datasourceId)) {
          resultsByDatasource.set(datasourceId, []);
        }
        
        resultsByDatasource.get(datasourceId).push({
          ...result,
          datasourceName: metadata.datasourceName,
          rowIndex: metadata.rowIndex,
          rowData: metadata.rowData
        });
      });
      
      // Format results
      const formattedResults = [];
      
      for (const [datasourceId, results] of resultsByDatasource.entries()) {
        const datasource = datasources.find(ds => ds.id === datasourceId);
        if (datasource && results.length > 0) {
          formattedResults.push({
            datasource,
            matches: results.slice(0, 5), // Limit per datasource
            totalMatches: results.length,
            avgScore: results.reduce((sum, r) => sum + r.score, 0) / results.length
          });
        }
      }
      
      console.log(`Found matches in ${formattedResults.length} datasources`);
      
      return {
        success: true,
        query,
        results: formattedResults,
        totalMatches: allResults.length,
        searchStats: {
          datasourcesSearched: datasources.length,
          resultsFound: formattedResults.length,
          searchOptions
        }
      };
      
    } catch (error) {
      console.error('Search error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get indexing status
  getIndexingStatus(datasourceId) {
    return this.cache.get(datasourceId);
  }

  // Get all cached datasources
  getCachedDatasources() {
    return Array.from(this.cache.entries()).map(([id, data]) => ({
      datasourceId: id,
      ...data
    }));
  }

  // Clear cache and vector DB
  clear() {
    this.cache.clear();
    this.vectorDB.clear();
    console.log('Datasource indexer cleared');
  }

  // Statistics
  getStats() {
    return {
      cachedDatasources: this.cache.size,
      vectorDBStats: this.vectorDB.getStats(),
      totalMemory: process.memoryUsage()
    };
  }
}

export default DatasourceIndexer;