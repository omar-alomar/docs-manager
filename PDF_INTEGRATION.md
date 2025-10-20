# PDF Document Integration with MCP

This guide explains how to add and work with PDF documents in your MCP-enabled Next.js application.

## 🚀 Quick Start

### 1. Add PDF Documents
Place your PDF files in the `src/data/documents/` directory:
```bash
# Example: Add a PDF document
cp your-document.pdf src/data/documents/
```

### 2. Start the MCP Server
```bash
npm run mcp-server
```

### 3. Start the Next.js App
```bash
npm run dev
```

### 4. Access the Web Interface
Open `http://localhost:3000` in your browser.

## 📋 Available Resources

### Document Listing
- **URI**: `documents://all`
- **Description**: Lists all available PDF documents
- **Returns**: JSON array of document metadata

### Document Content
- **URI**: `documents://{filename}`
- **Description**: Extracts text content from a specific PDF
- **Parameters**: `filename` - The PDF filename (e.g., "document.pdf")

## 🛠️ Available Tools

### 1. Search Documents
- **Name**: `search-documents`
- **Description**: Search for text within PDF documents
- **Parameters**:
  - `query` (required): Search term
  - `filename` (optional): Specific PDF to search in

**Example Usage**:
```javascript
// Search all documents
await mcpClient.callTool("search-documents", { 
  query: "machine learning" 
});

// Search specific document
await mcpClient.callTool("search-documents", { 
  query: "artificial intelligence",
  filename: "ai-research.pdf"
});
```

### 2. Summarize Document
- **Name**: `summarize-document`
- **Description**: Generate AI-powered summary of a PDF
- **Parameters**:
  - `filename` (required): PDF filename to summarize

**Example Usage**:
```javascript
await mcpClient.callTool("summarize-document", { 
  filename: "research-paper.pdf" 
});
```

### 3. Upload PDF Document
- **Name**: `upload-pdf`
- **Description**: Upload a PDF document to the documents directory
- **Parameters**:
  - `filename` (required): Name for the uploaded PDF file
  - `content` (required): Base64 encoded PDF content

**Example Usage**:
```javascript
const fileBuffer = fs.readFileSync('document.pdf');
const base64Content = fileBuffer.toString('base64');

await mcpClient.callTool("upload-pdf", { 
  filename: "my-document.pdf",
  content: base64Content
});
```

### 4. Delete PDF Document
- **Name**: `delete-pdf`
- **Description**: Delete a PDF document from the documents directory
- **Parameters**:
  - `filename` (required): Name of the PDF file to delete

**Example Usage**:
```javascript
await mcpClient.callTool("delete-pdf", { 
  filename: "old-document.pdf" 
});
```

## 🎯 Available Prompts

### Document Analysis
- **Name**: `analyze-document`
- **Description**: Analyze a PDF document with different analysis types
- **Parameters**:
  - `filename` (required): PDF filename
  - `analysisType` (optional): Type of analysis (summary, key-points, questions, custom)

**Example Usage**:
```javascript
await mcpClient.getPrompt("analyze-document", { 
  filename: "contract.pdf",
  analysisType: "key-points"
});
```

## 🌐 Web Interface Usage

### Query Tab
Ask natural language questions about your documents:
- "What documents do I have?"
- "Search for 'machine learning' in all documents"
- "Summarize the contract.pdf document"

### Tools Tab
Directly call MCP tools:
1. Select "Search PDF Documents" or "Summarize PDF Document"
2. Fill in the required parameters
3. Click "Call Tool" to execute

### Resources Tab
Access document content:
1. Select a document from the dropdown
2. Click "Read Resource" to extract text content

### Upload Tab
Upload and manage PDF documents:
1. Select a PDF file from your computer
2. Optionally specify a custom filename
3. Click "Upload PDF" to add it to your document collection
4. Use the Tools tab to delete documents if needed

### Prompts Tab
Use AI-powered document analysis:
1. Select "analyze-document" prompt
2. Enter filename and analysis type
3. Click "Get Prompt" to generate analysis instructions

## 📁 File Structure

```
src/
├── data/
│   └── documents/          # Place PDF files here
│       ├── document1.pdf
│       ├── contract.pdf
│       └── research.pdf
├── app/
│   └── api/mcp/           # MCP API endpoints
├── components/
│   └── MCPInterface.tsx   # Web interface
└── lib/
    └── mcp-client.ts      # MCP client service
```

## 🔧 Technical Details

### PDF Processing
- Uses `pdf-parse` library for text extraction
- Supports standard PDF files
- Extracts plain text content (no formatting preserved)

### Error Handling
- File not found errors
- PDF parsing errors
- Invalid filename handling

### Performance Considerations
- Large PDFs may take time to process
- Text extraction is done on-demand
- Consider file size limits for production use

## 🚨 Troubleshooting

### Common Issues

1. **"Document not found" error**
   - Ensure PDF file is in `src/data/documents/` directory
   - Check filename spelling and case sensitivity

2. **PDF parsing errors**
   - Verify PDF is not corrupted
   - Check if PDF is password-protected (not supported)

3. **Empty search results**
   - Check search query spelling
   - Ensure PDF contains the search term

### Debug Mode
Enable debug logging by setting environment variable:
```bash
DEBUG=mcp:* npm run mcp-server
```

## 🔮 Future Enhancements

- Support for other document formats (DOCX, TXT, etc.)
- PDF metadata extraction
- Document categorization
- Full-text search indexing
- Document versioning
- Batch processing capabilities

## 📝 Example Workflows

### Research Paper Analysis
1. Add research papers to `src/data/documents/`
2. Use "Search Documents" to find specific topics
3. Use "Summarize Document" for quick overviews
4. Use "Analyze Document" prompt for detailed analysis

### Contract Review
1. Upload contracts as PDFs
2. Search for specific clauses or terms
3. Generate summaries for quick review
4. Use analysis prompts to identify key points

### Knowledge Base
1. Create a collection of PDF documents
2. Use natural language queries to find information
3. Generate summaries and insights
4. Build a searchable knowledge base

---

**Happy Document Processing! 📄✨**
