import { pipeline, featureExtraction } from '@xenova/transformers';
import * as tf from '@tensorflow/tfjs-node';

class EmbeddingService {
  constructor() {
    this.model = null;
    this.tokenizer = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      console.log('Initializing embedding model...');
      
      // Use a lightweight, fast model for embeddings
      // sentence-transformers/all-MiniLM-L6-v2 is good balance of speed/quality
      const modelId = 'sentence-transformers/all-MiniLM-L6-v2';
      
      console.log(`Loading model: ${modelId}`);
      
      // Load the model and tokenizer
      this.model = await pipeline('feature-extraction', modelId, {
        quantized: true,
        device: 'cpu',
        dtype: 'fp32',
        progress_callback: (progress) => {
          console.log(`Model loading progress: ${Math.round(progress.progress * 100)}%`);
        }
      });
      
      this.initialized = true;
      console.log('✅ Embedding model initialized successfully');
      console.log(`Model info:`, {
        model: modelId,
        quantized: true,
        device: 'cpu'
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize embedding model:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        code: error.code
      });
      // Fallback to simpler approach
      this.initialized = false;
    }
  }

  async generateEmbedding(text) {
    if (!this.initialized) {
      console.log('Embedding model not initialized, using fallback');
      return this.fallbackEmbedding(text);
    }

    try {
      const startTime = Date.now();
      
      // Generate embedding
      const result = await this.model(text, {
        pooling: 'mean',
        normalize: true
      });
      
      // Extract the embedding vector
      let embedding;
      if (Array.isArray(result)) {
        embedding = result[0].data;
      } else if (result && result.data) {
        embedding = result.data;
      } else {
        embedding = result;
      }
      
      const duration = Date.now() - startTime;
      console.log(`Generated embedding in ${duration}ms for text length: ${text.length}`);
      
      // Ensure embedding is a flat array
      if (embedding && Array.isArray(embedding)) {
        return embedding.flat();
      }
      
      return embedding || [];
    } catch (error) {
      console.error('Error generating embedding:', error);
      return this.fallbackEmbedding(text);
    }
  }

  fallbackEmbedding(text) {
    // Simple fallback: create hash-based embedding
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(384).fill(0); // Standard embedding size
    
    words.forEach((word, index) => {
      // Simple hash function
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(i);
        hash = hash & hash;
      }
      
      // Map to embedding dimensions
      const startIndex = Math.abs(hash) % (384 - words.length);
      for (let i = 0; i < Math.min(words.length, 10); i++) {
        embedding[startIndex + i] = Math.sin(hash + i) * 0.1;
      }
    });
    
    console.log('Using fallback embedding generation');
    return embedding;
  }

  async batchGenerateEmbeddings(texts) {
    const embeddings = [];
    const batchSize = 5; // Process in small batches
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchEmbeddings = await Promise.all(
        batch.map(text => this.generateEmbedding(text))
      );
      embeddings.push(...batchEmbeddings);
      
      // Small delay to prevent overwhelming
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    return embeddings;
  }

  isInitialized() {
    return this.initialized;
  }
}

export default EmbeddingService;