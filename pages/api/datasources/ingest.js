import { authenticateRequest } from "../auth-helper";
import { prismaClient } from "@/lib/prisma";
import { csvParse } from "d3-dsv";
import DatasourceIndexer from "@/lib/datasource-indexer";

const datasourceIngestHandler = async (request, response) => {
  const user = await authenticateRequest(request, response);
  if (!user) return; // Response already handled by authenticateRequest
  
  let url, type, csvText;
  
  try {
    // Get the request body - in Next.js API routes, it's already parsed as JSON if content-type is application/json
    const body = request.body;
    url = body.url;
    type = body.type;
    csvText = body.csvContent; // Client will send CSV content as text
    
    console.log('Ingesting datasource:', { url, type, hasContent: !!csvText, userId: user.id });
    
    // If no CSV content, try to fetch from URL (fallback)
    if (!csvText) {
      console.log('No CSV content provided, fetching from URL:', url);
      const fetchResponse = await fetch(url);
      if (!fetchResponse.ok) {
        console.error('Failed to fetch CSV:', url, 'Status:', fetchResponse.status);
        return response.status(400).json({ 
          error: 'Failed to fetch CSV from URL',
          details: `HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`
        });
      }
      csvText = await fetchResponse.text();
      console.log('Downloaded CSV length:', csvText.length);
    }
    console.log('Downloaded CSV length:', csvText.length);
    
    // Validate file size (50MB = 50 * 1024 * 1024 bytes)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (csvText.length > MAX_SIZE) {
      console.error('File too large:', csvText.length, 'Max allowed:', MAX_SIZE);
      return response.status(400).json({ 
        error: 'File too large. Maximum size is 50MB.',
        details: `File size: ${(csvText.length / 1024 / 1024).toFixed(2)}MB, Max: 50MB`
      });
    }
    
    // Parse CSV to validate format
    const data = csvParse(csvText);
    console.log(`Parsed CSV with ${data.length} rows and ${data.length > 0 ? Object.keys(data[0]).length : 0} columns`);
    
    if (data.length === 0) {
      console.warn('CSV appears to be empty or invalid');
      return response.status(400).json({ 
        error: 'CSV file appears to be empty or invalid',
        details: 'Please check that your CSV file contains data in the correct format'
      });
    }
    
    // Find existing datasource first
    console.log('Looking for datasource with:', { userId: user.id, url });
    
    const existingDatasource = await prismaClient.datasource.findFirst({
      where: { 
        userId: user.id,
        url: url
      }
    });
    
    if (!existingDatasource) {
      console.error('Datasource not found:', { userId: user.id, url });
      return response.status(404).json({ 
        error: 'Datasource not found',
        details: 'The datasource was not found in the database'
      });
    }
    
    console.log('Found datasource:', { id: existingDatasource.id, name: existingDatasource.name });
    
    // Update existing datasource with content
    const datasource = await prismaClient.datasource.update({
      where: { 
        id: existingDatasource.id
      },
      data: { 
        content: csvText,
        size: csvText.length
      }
    });
    
    console.log('Updated datasource:', { id: datasource.id, name: datasource.name });

    // Generate embeddings and store in vector database
    console.log('🔄 Creating embeddings for semantic search...');
    try {
      // Create datasource object with content for indexing
      const datasourceForIndexing = {
        ...existingDatasource,
        content: csvText
      };
      
      const indexer = new DatasourceIndexer();
      const indexingResult = await indexer.indexDatasource(datasourceForIndexing);
      
      if (indexingResult.success) {
        console.log('✅ Embeddings created and stored successfully', indexingResult);
      } else {
        console.error('⚠️ Embedding indexing failed:', indexingResult.error);
      }
    } catch (embeddingError) {
      console.error('⚠️ Failed to create embeddings:', embeddingError);
      // Don't fail the entire process, but log the error
      // The datasource is still usable for basic keyword search
    }

    console.log('✅ Successfully ingested datasource:', datasource.name);
    
    response.status(200).json({ 
      success: true, 
      data: {
        id: datasource.id,
        name: datasource.name,
        rows: data.length,
        columns: data.length > 0 ? Object.keys(data[0]).length : 0,
        size: csvText.length
      }
    });
    
  } catch (error) {
    console.error('Ingest error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    response.status(500).json({ 
      error: 'Failed to process CSV file',
      details: error.message 
    });
  }
};

export default datasourceIngestHandler;