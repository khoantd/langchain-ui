import { authenticateRequest } from "@/pages/api/auth-helper";
import { prismaClient } from "@/lib/prisma";
import { csvParse } from "d3-dsv";
import DatasourceIndexer from "@/lib/datasource-indexer";

// Global indexer instance
let globalIndexer = null;

async function getIndexer() {
  if (!globalIndexer) {
    globalIndexer = new DatasourceIndexer();
    await globalIndexer.vectorDB.initialize();
  }
  return globalIndexer;
}

// Context retrieval using semantic search
async function retrieveContextFromDatasource(datasource, query) {
  console.log("retrieveContextFromDatasource called with:", {
    datasourceId: datasource?.id,
    datasourceName: datasource?.name,
    hasContent: !!datasource?.content,
    query: query
  });

  if (!datasource || !datasource.content) {
    console.log("No datasource content available");
    return "";
  }

  try {
    const indexer = await getIndexer();
    
    // Check if datasource is already indexed
    const indexingStatus = indexer.getIndexingStatus(datasource.id);
    
    if (!indexingStatus) {
      console.log("Indexing datasource: " + datasource.name);
      await indexer.indexDatasource(datasource);
    }

    // Perform semantic search
    const searchResults = await indexer.searchDatasources(query, [datasource]);
    
    if (searchResults.success && searchResults.results.length > 0) {
      // Format the best results
      const bestResults = searchResults.results[0].matches.slice(0, 5);
      
      const contextText = bestResults.map((result, index) => {
        const metadata = result.document.metadata;
        const sourceInfo = "[" + metadata.datasourceName + " - Row " + (metadata.rowIndex + 1) + "]";
        const content = Object.entries(metadata.rowData)
          .map(([key, value]) => key + ": " + value)
          .join(", ");
        
        return (index + 1) + ". " + sourceInfo + "\\n   " + content;
      }).join("\\n");

      const context = "Semantic search results from datasource " + datasource.name + " (" + bestResults.length + " matches):\\n" + contextText;
      console.log("Generated context length:", context.length);
      
      return context;
    }

    // Fallback to simple keyword search if semantic search fails
    console.log("Semantic search failed, falling back to keyword matching");
    
    // Parse CSV and do keyword matching as fallback
    const data = csvParse(datasource.content);
    console.log("Fallback: Parsing CSV with " + data.length + " rows");
    
    const queryWords = query.toLowerCase()
      .split(/\\s+/)
      .filter(word => word.length > 1)
      .filter(word => !["the", "and", "or", "but", "in", "on", "at", "to", "for"].includes(word));
    
    // Check for general query patterns
    const generalQueryPatterns = [
      "show", "show me", "what", "tell", "give", "list", "data", 
      "help", "info", "information", "summary"
    ];
    
    const isGeneralQuery = generalQueryPatterns.some(pattern => 
      query.toLowerCase().includes(pattern)
    );
    
    if (isGeneralQuery || queryWords.length === 0) {
      console.log("General query, returning sample rows");
      const sampleRows = data.slice(0, 5);
      const contextText = sampleRows.map((row, index) => 
        (index + 1) + ". " + Object.entries(row)
          .map(([key, value]) => key + ": " + value)
          .join(", ")
      ).join("\\n");

      return "Keyword search from datasource " + datasource.name + " (sample data):\\n" + contextText;
    }
    
    // Keyword-based relevance scoring
    let relevantRows = [];

    // Process in chunks for memory efficiency with large CSVs
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      
      chunk.forEach((row, index) => {
        let relevanceScore = 0;
        const rowText = Object.values(row).join(" ").toLowerCase();
        const originalIndex = i + index;
        
        queryWords.forEach(word => {
          if (rowText.includes(word)) {
            relevanceScore += 1;
          }
          
          // Column matching
          Object.values(row).forEach(value => {
            const valueStr = String(value).toLowerCase();
            if (valueStr.includes(word)) {
              relevanceScore += 2; // Higher score for direct column matches
            }
          });
        });

        if (relevanceScore > 0) {
          relevantRows.push({ ...row, relevanceScore, originalIndex });
        }
      });
    }

    console.log("Found " + relevantRows.length + " relevant rows out of " + data.length + " total");

    // Sort by relevance and take top 5
    relevantRows.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const topRows = relevantRows.slice(0, 5);

    // If no relevant rows found, return sample data
    if (topRows.length === 0) {
      console.log("No relevant rows found, returning sample rows");
      const sampleRows = data.slice(0, 3);
      const contextText = sampleRows.map(row => 
        Object.entries(row)
          .map(([key, value]) => key + ": " + value)
          .join(", ")
      ).join("\\n");

      return "Keyword search from datasource " + datasource.name + " (sample data):\\n" + contextText;
    }

    // Format context for AI consumption
    const contextText = topRows.map((row, index) => 
      Object.entries(row)
        .filter(([key]) => key !== "relevanceScore" && key !== "originalIndex")
        .map(([key, value]) => key + ": " + value)
          .join(", ")
    ).join("\\n");

    const context = "Keyword search from datasource " + datasource.name + " (" + topRows.length + " relevant rows):\\n" + contextText;
    console.log("Generated fallback context length:", context.length);
    
    return context;
  } catch (error) {
    console.error("Error retrieving context from datasource:", error);
    console.error("Error details:", error.message);
    return "";
  }
}

export default retrieveContextFromDatasource;
