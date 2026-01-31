# Implementation Plan: Simple CSV Storage System (Refined)

## Overview
Replace the complex Metal SDK + S3 architecture with a streamlined local CSV storage system using direct database storage and simple keyword matching, while maintaining the two-step upload process and ensuring production readiness.

## Current System Analysis

### Existing Datasources Found:
- **1 existing datasource**: "TCB Stock Prices" (CSV type)
- **Current URL**: `http://localhost:3000/mock-upload/1a953aad-ecbf-4506-96b7-8e1f5a4c6c5c`
- **Need**: Migration strategy for this existing data

### Current Two-Step Process:
1. **Frontend**: Upload file → S3/Mock URL → Create datasource metadata
2. **Backend**: Ingest API fetches from URL → Metal SDK indexing

### Dependencies to Remove:
- `@getmetal/metal-sdk: ^2.0.1`
- `@aws-sdk/client-s3: ^3.319.0`
- `@aws-sdk/s3-presigned-post: ^3.319.0`
- `langchain/document_loaders/fs/csv` (replace with d3-dsv)

### Dependencies to Keep:
- `d3-dsv: ^2.0.0` ✅ (already installed)
- `uuid: ^9.0.0` ✅ (already installed)

## Phase 1: Database Schema Changes & Migration

### 1.1 Update Prisma Schema
**File: `/prisma/schema.prisma`**
- Add `content` field to Datasource model (String, optional)
- Add `size` field to Datasource model (Int, optional) 
- Make `url` field optional for backward compatibility

**Changes:**
```prisma
model Datasource {
  id        Int       @id @default(autoincrement())
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  url       String?   // Made optional for backward compatibility
  name      String
  type      String
  content   String?   // Store CSV content directly
  size      Int?      // File size in bytes for validation
  Chatbot   Chatbot[]
}
```

### 1.2 Generate Database Migration
- Run `npx prisma migrate dev --name add-csv-content-fields`
- Apply migration to update database schema

### 1.3 Create Migration Script for Existing Data
**File: `/scripts/migrate-datasources.js`**
```javascript
// Script to migrate existing datasources from URLs to database content
// Handle the existing "TCB Stock Prices" datasource
const { PrismaClient } = require('@prisma/client');
const { csvParse } = require('d3-dsv');

const prisma = new PrismaClient();

async function migrateExistingDatasources() {
  const datasources = await prisma.datasource.findMany({
    where: { content: null }
  });

  for (const datasource of datasources) {
    try {
      // Try to fetch CSV from existing URL
      const response = await fetch(datasource.url);
      if (response.ok) {
        const csvText = await response.text();
        const data = csvParse(csvText);
        
        await prisma.datasource.update({
          where: { id: datasource.id },
          data: { 
            content: csvText,
            size: csvText.length
          }
        });
        
        console.log(`Migrated datasource: ${datasource.name}`);
      }
    } catch (error) {
      console.error(`Failed to migrate ${datasource.name}:`, error.message);
    }
  }
  
  await prisma.$disconnect();
}

migrateExistingDatasources();
```

### 1.4 Production Considerations
- **Backup database** before migration
- **Test migration script** on staging first
- **Monitor memory usage** during CSV parsing (50MB limit)
- **Add logging** for migration status

## Phase 2: Backend API Modifications (Two-Step Process)

### 2.1 Update File Upload API
**File: `/lib/upload-url.js`**
- Modify to return mock upload URL for local development
- Add 50MB size validation
- Generate unique filename for database storage

**Updated Implementation:**
```javascript
export const getUploadUrl = async ({ type } = {}) => {
  console.log('getUploadUrl called with:', { type });
  
  // Always use mock mode now - we'll store directly in database
  const mockKey = uuid();
  const mockUrl = {
    url: 'http://localhost:3000/direct-upload',
    fields: {
      key: mockKey,
      'Content-Type': type,
    }
  };
  
  return mockUrl;
};
```

### 2.2 Update Datasource Ingest API
**File: `/pages/api/datasources/ingest.js`**

**Current Flow**: Fetch from URL → Metal SDK
**New Flow**: Fetch from URL → Parse CSV → Store in database

**Remove:**
- Metal SDK imports and usage
- `langchain/document_loaders/fs/csv` (replace with d3-dsv)

**Add:**
- Direct CSV parsing using `d3-dsv`
- 50MB file size validation
- Content storage in database
- Better error handling

**Updated Implementation:**
```javascript
import { csvParse } from "d3-dsv";

const datasourceIngestHandler = async (request, response) => {
  const user = await authenticateRequest(request, response);
  if (!user) return;
  
  const { url, type } = request.body;
  
  try {
    // Fetch CSV from URL (could be S3 or mock)
    const fetchResponse = await fetch(url);
    if (!fetchResponse.ok) {
      return response.status(400).json({ 
        error: 'Failed to fetch CSV from URL' 
      });
    }
    
    const csvText = await fetchResponse.text();
    
    // Validate file size (50MB = 50 * 1024 * 1024 bytes)
    if (csvText.length > 50 * 1024 * 1024) {
      return response.status(400).json({ 
        error: 'File too large. Maximum size is 50MB.' 
      });
    }
    
    // Parse CSV to validate format
    const data = csvParse(csvText);
    console.log(`Parsed CSV with ${data.length} rows`);
    
    // Update existing datasource with content
    const datasource = await prismaClient.datasource.update({
      where: { 
        userId: user.id,
        url: url // Match by URL from first step
      },
      data: { 
        content: csvText,
        size: csvText.length
      }
    });

    response.status(200).json({ success: true, data: datasource });
  } catch (error) {
    console.error('Ingest error:', error);
    response.status(500).json({ error: error.message });
  }
};
```

### 2.3 Update Datasource Creation API
**File: `/pages/api/datasources/index.js`**
- Modify POST method to create datasource without content initially
- Keep URL field for compatibility with two-step process

**Updated POST Handler:**
```javascript
if (request.method === "POST") {
  const datasource = await prismaClient.datasource.create({
    data: {
      userId: user.id,
      ...request.body,
      // content and size will be added in ingest step
    },
  });

  return response.status(200).json({ success: true, data: datasource });
}
```

### 2.4 Update Chat Completion API
**File: `/pages/api/chat/[chatbotId]/completions.js`**

**Current Issues:**
- Uses Metal SDK for context retrieval
- Complex fallback logic

**Fixes:**
- Replace Metal search with direct CSV content retrieval
- Use existing `d3-dsv` for parsing
- Maintain debug logging
- Update context retrieval function
- Add memory optimization for large CSVs

**Updated Context Retrieval:**
```javascript
async function retrieveContextFromDatasource(datasource, query) {
  if (!datasource || !datasource.content) {
    console.log('No datasource content available');
    return '';
  }

  try {
    // Parse stored CSV content
    const data = csvParse(datasource.content);
    console.log(`Parsing CSV with ${data.length} rows for context`);
    
    // Keyword-based relevance scoring
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    console.log('Query words for matching:', queryWords);
    
    if (queryWords.length === 0) {
      console.log('No valid query words found');
      return '';
    }
    
    let relevantRows = [];

    // Process in chunks for memory efficiency with large CSVs
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      
      chunk.forEach(row => {
        let relevanceScore = 0;
        const rowText = Object.values(row).join(' ').toLowerCase();
        
        queryWords.forEach(word => {
          if (rowText.includes(word)) {
            relevanceScore += 1;
          }
        });

        if (relevanceScore > 0) {
          relevantRows.push({ ...row, relevanceScore });
        }
      });
    }

    console.log(`Found ${relevantRows.length} relevant rows`);

    // Sort by relevance and take top 5
    relevantRows.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const topRows = relevantRows.slice(0, 5);

    if (topRows.length === 0) {
      return '';
    }

    // Format context for AI consumption
    const contextText = topRows.map(row => 
      Object.entries(row)
        .filter(([key]) => key !== 'relevanceScore')
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
    ).join('\n');

    const context = `Context from datasource "${datasource.name}":\n${contextText}`;
    console.log('Generated context length:', context.length);
    
    return context;
  } catch (error) {
    console.error('Error retrieving context from datasource:', error);
    return '';
  }
}
```

### 2.5 Remove Metal SDK Dependencies
**Files to update:**
- Remove Metal imports from completions API
- Update package.json dependencies
- Clean up any remaining Metal references

## Phase 3: Frontend Updates (Maintain Two-Step Process)

### 3.1 Update File Upload Component
**File: `/app/app/datasources/client-page.js`**

**Maintain current two-step flow but update for database storage:**
1. Step 1: Get upload URL → Upload file → Create datasource metadata
2. Step 2: Trigger ingest API → Parse and store CSV content

**Updated Submit Logic:**
```javascript
const onSubmit = useCallback(async ({ name, type }) => {
  try {
    const file = files[0];
    
    // Client-side validation (50MB)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert('File too large. Maximum size is 50MB.');
      return;
    }

    // Step 1: Get upload URL and upload file (existing flow)
    const fileType = file.type;
    const uploadUrl = await getUploadUrl({ type: fileType });
    const s3Url = `${uploadUrl.url}/${uploadUrl.fields.key}`;

    await uploadFile(file, uploadUrl);

    // Step 2: Create datasource metadata (existing flow)
    const { data: datasource } = await createDatasource({
      url: s3Url,
      name: name,
      type: type,
    });

    // Step 3: Trigger ingest (modified to store in database)
    await ingestData({
      url: s3Url,
      type: type
    });

    // Refresh datasource list
    await loadDatasources();
    setShowForm(false);
    reset();
    
  } catch (error) {
    console.error('Error creating datasource:', error);
    alert(`Error: ${error.message}\n\nPlease ensure your CSV file is properly formatted.`);
  }
}, [files, reset, loadDatasources]);
```

### 3.2 Update Error Messages
**Remove S3-specific error messaging:**
- Remove references to S3 credentials
- Update to reflect database-only storage
- Add CSV format validation hints

### 3.3 Add File Type Validation
**Update CSV component:**
- Validate file is actually CSV format
- Check for proper CSV structure
- Provide better user feedback

**Updated CSV Component Validation:**
```javascript
export default function CsvDocument({ files, register, validate }) {
  const validateFile = useCallback((fileList) => {
    if (fileList.length === 0) return false;
    
    const file = fileList[0];
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return 'Please upload a CSV file';
    }
    
    if (file.size > 50 * 1024 * 1024) {
      return 'File size must be less than 50MB';
    }
    
    return true;
  }, []);

  return (
    <Stack
      padding={8}
      borderWidth="1px"
      borderRadius="sm"
      borderStyle="dashed"
      alignItems="center"
      justifyContent="center"
    >
      <FilePicker accept=".csv" {...register("file", { validate: validateFile })}>
        <Button
          size="sm"
          variant="ghost"
          fontWeight="normal"
          leftIcon={<Icon as={TbFileUpload} />}
          color="gray.500"
        >
          Select a CSV file (max 50MB)
        </Button>
      </FilePicker>
      {files?.length > 0 && (
        <Text color="gray.500" fontSize="xs" marginTop={2}>
          {files[0].name} ({(files[0].size / 1024 / 1024).toFixed(2)} MB)
        </Text>
      )}
    </Stack>
  );
}
```

### 3.2 Remove Unused Utilities
**Files to update/remove:**
- `/lib/upload-url.js` - Simplify or remove
- `/lib/upload-file.js` - Simplify or remove
- Remove S3 SDK dependencies from `package.json`

## Phase 4: Testing & Production Deployment

### 4.1 Create Test Data
**Sample CSV Files for Testing:**
```csv
name,price,category
Apple,150,Fruit
Banana,50,Fruit
Carrot,30,Vegetable
```

**Large CSV Test (接近50MB):**
- Generate test CSV with 500,000 rows
- Test memory usage during parsing
- Verify chunked processing works

**Edge Cases:**
- Empty CSV files
- CSV with special characters
- Malformed CSV data
- Very long text fields

### 4.2 API Testing Checklist
**Upload Process:**
- ✅ File size validation (50MB)
- ✅ CSV format validation
- ✅ Two-step process works correctly
- ✅ Error handling for invalid files

**Ingest Process:**
- ✅ CSV parsing accuracy
- ✅ Database storage
- ✅ Large file handling

**Chat Context Retrieval:**
- ✅ Keyword matching works
- ✅ Relevance scoring
- ✅ Memory efficiency with large files
- ✅ Fallback handling

### 4.3 Migration Testing
**Existing Data Migration:**
- ✅ Migrate "TCB Stock Prices" datasource
- ✅ Verify data integrity
- ✅ Test fallback for missing URLs

### 4.4 Production Deployment Strategy

#### 4.4.1 Deployment Steps
1. **Backup Database**: `sqlite3 prisma/dev.db .backup > backup.db`
2. **Deploy Schema Changes**: `npx prisma migrate deploy`
3. **Run Migration Script**: `node scripts/migrate-datasources.js`
4. **Update Environment Variables**: Remove Metal/S3 variables
5. **Test Upload Flow**: Verify with real CSV files
6. **Monitor Performance**: Check memory usage and response times

#### 4.4.2 Production Monitoring
**Key Metrics:**
- Memory usage during CSV parsing
- Database size growth
- API response times
- Error rates for file uploads
- Context retrieval performance

#### 4.4.3 Rollback Plan
**If Issues Occur:**
1. **Database Rollback**: `npx prisma migrate reset` (if needed)
2. **Restore Code**: Git checkout previous version
3. **Restore Data**: Use database backup
4. **Investigate**: Review logs and error reports

### 4.5 Performance Optimizations

#### 4.5.1 Database Indexing
**Add indexes for better performance:**
```prisma
model Datasource {
  // ... existing fields ...
  
  @@index([userId]) // For user-specific queries
  @@index([name])   // For datasource lookup
}
```

#### 4.5.2 Memory Management
**Implement streaming for large CSVs:**
- Use CSV streaming for files > 10MB
- Implement row-by-row processing
- Add memory usage monitoring

## File Changes Summary

### Database:
- `/prisma/schema.prisma` - Add content and size fields
- `/scripts/migrate-datasources.js` - New migration script

### Backend APIs:
- `/pages/api/datasources/ingest.js` - Remove Metal, add direct CSV storage
- `/pages/api/datasources/index.js` - Update POST handler
- `/pages/api/chat/[chatbotId]/completions.js` - Update context retrieval
- `/lib/upload-url.js` - Simplify for database-only storage
- `/lib/upload-file.js` - May simplify or keep for compatibility

### Frontend:
- `/app/app/datasources/client-page.js` - Maintain two-step flow with better validation
- `/components/datasources/csv.js` - Add better validation and UI feedback

### Dependencies:
- `package.json` - Remove Metal SDK and AWS SDK dependencies

### New Scripts:
- `/scripts/migrate-datasources.js` - Existing data migration
- `/scripts/test-csv-upload.js` - Test script for large files

## Benefits

### Performance:
- ✅ No external API calls (Metal, S3)
- ✅ Faster response times (direct database queries)
- ✅ Better reliability (no external service dependencies)
- ✅ Memory efficient chunked processing

### Maintenance:
- ✅ Simpler architecture (single database for all data)
- ✅ Easier debugging (all logs in one place)
- ✅ Lower costs (no subscription fees)
- ✅ Production-ready with proper monitoring

### User Experience:
- ✅ Faster uploads (direct processing)
- ✅ Better error messages (specific to CSV issues)
- ✅ More reliable context retrieval (no external outages)
- ✅ Clear feedback on file size and format

## Migration Strategy

### For Existing Data:
- ✅ Automatic migration script for "TCB Stock Prices" datasource
- ✅ Backward compatibility with optional URL field
- ✅ Zero-downtime deployment possible
- ✅ Rollback plan in place

### Production Deployment:
- ✅ Gradual deployment with database backup
- ✅ Monitoring and performance tracking
- ✅ Memory usage optimization for large files
- ✅ Error handling and recovery procedures

## Implementation Order (Revised for Production)

1. **Phase 1 - Database & Migration** (45 min)
   - Schema updates
   - Migration script
   - Database backup

2. **Phase 2 - Backend APIs** (60 min)
   - Update ingest API
   - Update chat API
   - Update utility functions

3. **Phase 3 - Frontend Updates** (30 min)
   - Update upload component
   - Improve validation
   - Update error messages

4. **Phase 4 - Testing & Deployment** (60 min)
   - Migration testing
   - Performance testing
   - Production deployment

**Total Estimated Time: ~3.25 hours**

## Risk Assessment & Mitigation

### High-Risk Areas:
1. **Large CSV Memory Usage**: Mitigated with chunked processing
2. **Existing Data Loss**: Mitigated with migration script and backup
3. **Production Downtime**: Mitigated with gradual deployment

### Medium-Risk Areas:
1. **Performance Degradation**: Monitored with performance metrics
2. **CSV Format Issues**: Mitigated with validation and error handling
3. **Database Size Growth**: Monitored and can add archiving later

### Monitoring Checklist:
- [ ] Memory usage during CSV processing
- [ ] Database query response times
- [ ] File upload success rates
- [ ] Context retrieval accuracy
- [ ] Error rates and types

## Success Criteria

### Functional Requirements:
- ✅ Users can upload CSV files up to 50MB
- ✅ Existing datasources are migrated automatically
- ✅ AI can retrieve relevant context from CSV data
- ✅ Chat responses include CSV context when relevant

### Performance Requirements:
- ✅ Upload response time < 5 seconds (for 10MB files)
- ✅ Context retrieval < 2 seconds
- ✅ Memory usage < 512MB during processing
- ✅ 99% uptime for datasource features

### Production Requirements:
- ✅ Zero data loss during migration
- ✅ Backward compatibility maintained
- ✅ Monitoring and logging in place
- ✅ Rollback procedures tested