import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { CreateMessageResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { pdf } from "pdf-parse";

const server = new McpServer({
  name: "docs-manager",
  version: "1.0.0",
  description: "A server for managing documents",
  capabilities: {
    resources: {},
    tools: { listChanged: true },
    prompts: {},
  },
});

server.resource(
  "users",
  "users://all",
  {
    description: "Get all users",
    title: "Users",
    mimeType: "application/json",
  }, async uri => {
    const users = await import("./data/users.json", {
      with: { type: "json" },
    }).then((m) => m.default);

    return {
      contents: [{ 
        uri: uri.href,
        text: JSON.stringify(users),
        mimeType: "application/json" }]
    }
  }
)

server.resource("user-details", new ResourceTemplate("users://{userId}/profile", { list: undefined}), {
  description: "Get a user's details",
  title: "Users",
  mimeType: "application/json",
  },
  async (uri, { userId })=> {    
    const users = await import("./data/users.json", {
    with: { type: "json" },
  }).then((m) => m.default)
  const user = users.find(u => u.id === parseInt(userId as string))

  if (user == null) {
    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify({ error: "User not found" }),
          mimeType: "application/json"
        }
      ]
    }
  }

  return {
    contents: [{ 
      uri: uri.href,
      text: JSON.stringify(user),
      mimeType: "application/json" }]
  }})

// PDF Documents Resources
server.resource(
  "documents",
  "documents://all",
  {
    description: "List all available PDF documents",
    title: "PDF Documents",
    mimeType: "application/json",
  },
  async (uri) => {
    try {
      const documentsDir = path.join(process.cwd(), "src", "data", "documents");
      const files = await fs.readdir(documentsDir);
      const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
      
      const documents = pdfFiles.map(file => ({
        name: file,
        path: path.join(documentsDir, file),
        uri: `documents://${file}`,
        type: "pdf"
      }));

      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(documents, null, 2),
          mimeType: "application/json"
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({ error: "Failed to list documents", details: error instanceof Error ? error.message : String(error) }),
          mimeType: "application/json"
        }]
      };
    }
  }
);

server.resource(
  "document-content",
  new ResourceTemplate("documents://{filename}", { list: undefined }),
  {
    description: "Get the text content of a PDF document",
    title: "PDF Document Content",
    mimeType: "text/plain",
  },
  async (uri, { filename }) => {
    try {
      const documentsDir = path.join(process.cwd(), "src", "data", "documents");
      const filePath = path.join(documentsDir, filename as string);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return {
          contents: [{
            uri: uri.href,
            text: `Error: Document '${filename}' not found`,
            mimeType: "text/plain"
          }]
        };
      }

      // Read and parse PDF
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdf(dataBuffer);
      
      return {
        contents: [{
          uri: uri.href,
          text: pdfData.text,
          mimeType: "text/plain"
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `Error reading PDF: ${error instanceof Error ? error.message : String(error)}`,
          mimeType: "text/plain"
        }]
      };
    }
  }
);

server.tool(
  "create-user",
  "Create a new user in the database",
  {
    name: z.string(),
    email: z.string(),
  },
  {
    title: "Create User",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  async (params) => {
    try {
      const id = await createUser(params);
      return {
        content: [{ type: "text", text: "User created successfully" }],
      };
    } catch {
      return {
        content: [{ type: "text", text: "Failed to save user" }],
      };
    }
  }
);

server.tool("create-random-user", "Create a random user with fake data", {
  title: "Create Random user",
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
}, async () => {
  const res = await server.server.request({
    method: "sampling/createMessage",
    params: {
      messages:[{
        role: "user",
        content: {
          type: "text",
          text: "Generate fake user data. The user should have a realistic name, email and a unique id. Return this data as a JSON object with no other text or formatter so it can be used with JSON.parse()"
        }
      }],
      maxTokens: 1024
    }
  }, CreateMessageResultSchema)

  if (res.content.type !== "text") {
    return {
      content: [{ type: "text", text: "Failed to generate user data" }]
    }
  }

  try {
    const fakeUser = JSON.parse(res.content.text.trim().replace(/^```json/, "").replace(/```$/, "").trim())

    const id = await createUser(fakeUser);
    return {
      content: [{ type: "text", text: `User ${id} created successfully`}]
    }
  } catch {
    return {
      content: [{ type: "text", text: "Failed to generate user data" }]
    }
  }
})

// PDF Document Tools
server.tool(
  "search-documents",
  "Search for text within PDF documents",
  {
    query: z.string().describe("Search query to find in documents"),
    filename: z.string().optional().describe("Specific PDF filename to search in (optional)")
  },
  {
    title: "Search PDF Documents",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  async (params) => {
    try {
      const documentsDir = path.join(process.cwd(), "src", "data", "documents");
      const files = await fs.readdir(documentsDir);
      const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
      
      if (params.filename && !pdfFiles.includes(params.filename)) {
        return {
          content: [{ type: "text", text: `Document '${params.filename}' not found` }]
        };
      }

      const filesToSearch = params.filename ? [params.filename] : pdfFiles;
      const results = [];

      for (const file of filesToSearch) {
        const filePath = path.join(documentsDir, file);
        const dataBuffer = await fs.readFile(filePath);
        const pdfData = await pdf(dataBuffer);
        
        const lines = pdfData.text.split('\n');
        const matchingLines = lines.filter((line: string) => 
          line.toLowerCase().includes(params.query.toLowerCase())
        );

        if (matchingLines.length > 0) {
          results.push({
            filename: file,
            matches: matchingLines.length,
            preview: matchingLines.slice(0, 3).join(' | ')
          });
        }
      }

      if (results.length === 0) {
        return {
          content: [{ type: "text", text: `No matches found for "${params.query}"` }]
        };
      }

      return {
        content: [{ 
          type: "text", 
          text: `Found ${results.length} document(s) with matches:\n\n${results.map(r => 
            `📄 ${r.filename} (${r.matches} matches)\n   ${r.preview}`
          ).join('\n\n')}`
        }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error searching documents: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  }
);

server.tool(
  "summarize-document",
  "Generate a summary of a PDF document",
  {
    filename: z.string().describe("PDF filename to summarize")
  },
  {
    title: "Summarize PDF Document",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  async (params) => {
    try {
      const documentsDir = path.join(process.cwd(), "src", "data", "documents");
      const filePath = path.join(documentsDir, params.filename);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return {
          content: [{ type: "text", text: `Document '${params.filename}' not found` }]
        };
      }

      // Read and parse PDF
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdf(dataBuffer);
      
      // Use AI to generate summary
      const res = await server.server.request({
        method: "sampling/createMessage",
        params: {
          messages: [{
            role: "user",
            content: {
              type: "text",
              text: `Please provide a concise summary of the following document content:\n\n${pdfData.text.substring(0, 4000)}`
            }
          }],
          maxTokens: 500
        }
      }, CreateMessageResultSchema);

      if (res.content.type !== "text") {
        return {
          content: [{ type: "text", text: "Failed to generate summary" }]
        };
      }

      return {
        content: [{ 
          type: "text", 
          text: `Summary of ${params.filename}:\n\n${res.content.text}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error summarizing document: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  }
);

server.tool(
  "upload-pdf",
  "Upload a PDF document to the documents directory",
  {
    filename: z.string().describe("Name for the uploaded PDF file"),
    content: z.string().describe("Base64 encoded PDF content")
  },
  {
    title: "Upload PDF Document",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  async (params) => {
    try {
      const documentsDir = path.join(process.cwd(), "src", "data", "documents");
      
      // Ensure documents directory exists
      await fs.mkdir(documentsDir, { recursive: true });
      
      // Validate filename
      const filename = params.filename.endsWith('.pdf') ? params.filename : `${params.filename}.pdf`;
      const filePath = path.join(documentsDir, filename);
      
      // Check if file already exists
      try {
        await fs.access(filePath);
        return {
          content: [{ type: "text", text: `File '${filename}' already exists. Use a different name or delete the existing file first.` }]
        };
      } catch {
        // File doesn't exist, which is what we want
      }
      
      // Decode base64 content
      let pdfBuffer;
      try {
        pdfBuffer = Buffer.from(params.content, 'base64');
      } catch (error) {
        return {
          content: [{ type: "text", text: "Invalid base64 content provided" }]
        };
      }
      
      // Validate that it's actually a PDF by trying to parse it
      try {
        await pdf(pdfBuffer);
      } catch (error) {
        return {
          content: [{ type: "text", text: "Invalid PDF content provided" }]
        };
      }
      
      // Write the file
      await fs.writeFile(filePath, pdfBuffer);
      
      return {
        content: [{ 
          type: "text", 
          text: `PDF document '${filename}' uploaded successfully!` 
        }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error uploading PDF: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  }
);

server.tool(
  "delete-pdf",
  "Delete a PDF document from the documents directory",
  {
    filename: z.string().describe("Name of the PDF file to delete")
  },
  {
    title: "Delete PDF Document",
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
  async (params) => {
    try {
      const documentsDir = path.join(process.cwd(), "src", "data", "documents");
      const filename = params.filename.endsWith('.pdf') ? params.filename : `${params.filename}.pdf`;
      const filePath = path.join(documentsDir, filename);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return {
          content: [{ type: "text", text: `File '${filename}' not found` }]
        };
      }
      
      // Delete the file
      await fs.unlink(filePath);
      
      return {
        content: [{ 
          type: "text", 
          text: `PDF document '${filename}' deleted successfully!` 
        }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error deleting PDF: ${error instanceof Error ? error.message : String(error)}` }]
      };
    }
  }
);

server.prompt(
  "generate-fake-user",
  "Generate a fake user based on a given name",
  {
    name: z.string(),
  },
  ({ name }) => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Generate a fake user based the following name: ${name}. The user should have a realistic email and a unique id.`
          }
        }
      ]
    }
  }
)

server.prompt(
  "analyze-document",
  "Analyze a PDF document and provide insights",
  {
    filename: z.string(),
    analysisType: z.string().optional().describe("Type of analysis: summary, key-points, questions, or custom")
  },
  ({ filename, analysisType = "summary" }) => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please analyze the PDF document "${filename}" and provide a ${analysisType}. 
            
            First, read the document content using the documents://${filename} resource, then provide your analysis based on the content.`
          }
        }
      ]
    }
  }
)

async function createUser(user: { name: string; email: string }) {
  const users = await import("./data/users.json", {
    with: { type: "json" },
  }).then((m) => m.default);

  const id = users.length + 1;
  users.push({ id, ...user });

  await fs.writeFile("./src/data/users.json", JSON.stringify(users, null, 2));

  return id;
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
