import EmbeddingService from './embeddings.js';

class VectorDatabase {
  constructor() {
    this.documents = new Map(); // docId -> document
    this.embeddings = new Map(); // docId -> embedding
    this.embeddingService = new EmbeddingService();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }
    
    console.log('Initializing vector database...');
    try {
      await this.embeddingService.initialize();
      this.initialized = true;
      console.log('✅ Vector database initialized');
    } catch (error) {
      console.error('❌ Vector database initialization failed:', error);
      // Mark as initialized but without embedding capabilities
      this.initialized = true;
      this.embeddingDisabled = true;
      console.log('⚠️ Vector database initialized in fallback mode (no embeddings)');
    }
  }

  async addDocument(docId, content, metadata = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Generate embedding for the document
      let embedding;
      if (this.embeddingDisabled) {
        console.log('Embeddings disabled, using fallback for document:', docId);
        // Create a simple hash-based embedding as fallback
        embedding = this.createFallbackEmbedding(content);
      } else {
        embedding = await this.embeddingService.generateEmbedding(content);
      }
      
      // Store document and embedding
      this.documents.set(docId, {
        content,
        metadata,
        embedding,
        createdAt: new Date().toISOString()
      });
      
      this.embeddings.set(docId, embedding);
      
      console.log(`Added document ${docId} with embedding length: ${embedding.length}`);
      return docId;
    } catch (error) {
      console.error(`Error adding document ${docId}:`, error);
      throw error;
    }
  }

  async addDocuments(documents) {
    const results = [];
    
    for (const doc of documents) {
      const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      try {
        const result = await this.addDocument(docId, doc.content, doc.metadata);
        results.push({ docId, ...doc });
      } catch (error) {
        console.error(`Failed to add document:`, error);
      }
    }
    
    return results;
  }

  // BM25 keyword scoring
  calculateBM25Score(query, document, termFrequency = new Map()) {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
    const docTerms = document.toLowerCase().split(/\s+/);
    
    let score = 0;
    const docLength = docTerms.length;
    
    queryTerms.forEach(queryTerm => {
      const termFreq = termFrequency.get(queryTerm) || 1;
      
      // Calculate term frequency in document
      const docTermFreq = docTerms.filter(term => term === queryTerm).length;
      
      // IDF (simplified)
      const idf = Math.log(1 + (this.documents.size || 1)) / (1 + docTermFreq);
      
      // BM25 score components
      const tf = docTermFreq / docLength;
      const bm25 = tf * idf * 1.2; // k1 = 1.2 for BM25
      
      score += bm25 * termFreq;
    });
    
    return score;
  }

  // Cosine similarity
  calculateCosineSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
      return 0;
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }
    
    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);
    
    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }
    
    return dotProduct / (norm1 * norm2);
  }

  async search(query, options = {}) {
    const {
      maxResults = 10,
      semanticWeight = 0.6,
      keywordWeight = 0.4,
      similarityThreshold = 0.7,
      includeBM25 = true
    } = options;

    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log(`Searching for: "${query}" with semantic weight: ${semanticWeight}, keyword weight: ${keywordWeight}`);
      
      // Generate query embedding
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      
      // Calculate term frequencies for BM25
      const termFrequency = new Map();
      Array.from(this.documents.values()).forEach(doc => {
        const terms = doc.content.toLowerCase().split(/\s+/);
        const termCounts = {};
        terms.forEach(term => {
          termCounts[term] = (termCounts[term] || 0) + 1;
        });
        
        Object.entries(termCounts).forEach(([term, count]) => {
          termFrequency.set(term, (termFrequency.get(term) || 0) + count);
        });
      });
      
      const results = [];
      
      // Calculate scores for all documents
      for (const [docId, document] of this.documents.entries()) {
        const docEmbedding = this.embeddings.get(docId);
        
        // Semantic similarity score
        const semanticScore = this.calculateCosineSimilarity(queryEmbedding, docEmbedding);
        
        // BM25 keyword score
        const keywordScore = includeBM25 ? this.calculateBM25Score(query, document.content, termFrequency) : 0;
        
        // Combined hybrid score
        const hybridScore = semanticScore * semanticWeight + keywordScore * keywordWeight;
        
        console.log(`Doc ${docId}: semantic=${semanticScore.toFixed(3)}, keyword=${keywordScore.toFixed(3)}, hybrid=${hybridScore.toFixed(3)}`);
        
        if (hybridScore >= similarityThreshold) {
          results.push({
            docId,
            document,
            score: hybridScore,
            semanticScore,
            keywordScore,
            similarity: semanticScore
          });
        }
      }
      
      // Sort by combined score (highest first)
      results.sort((a, b) => b.score - a.score);
      
      // Return top results
      const topResults = results.slice(0, maxResults);
      
      console.log(`Found ${topResults.length} results above threshold ${similarityThreshold}`);
      
      return topResults;
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  // Get document by ID
  getDocument(docId) {
    return this.documents.get(docId);
  }

  // Get all documents
  getAllDocuments() {
    return Array.from(this.documents.entries()).map(([id, doc]) => ({
      id,
      ...doc
    }));
  }

  // Clear database
  clear() {
    this.documents.clear();
    this.embeddings.clear();
    console.log('Vector database cleared');
  }

  // Statistics
  createFallbackEmbedding(content) {
    // Create a simple hash-based embedding as fallback
    const hash = this.simpleHash(content);
    const embedding = new Array(384).fill(0); // Standard embedding size
    
    // Use hash to fill embedding with pseudo-random values
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] = ((hash * (i + 1)) % 1000) / 1000.0;
    }
    
    return embedding;
  }
  
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  getStats() {
    return {
      totalDocuments: this.documents.size,
      totalEmbeddings: this.embeddings.size,
      embeddingDimensions: this.embeddingService.initialized ? 'initialized' : 'not initialized',
      embeddingDisabled: this.embeddingDisabled || false,
      memoryUsage: process.memoryUsage()
    };
  }
}

export default VectorDatabase;