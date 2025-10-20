import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CreateMessageRequestSchema, CreateMessageResult } from "@modelcontextprotocol/sdk/types.js";
import OpenAI from "openai";

const MODEL = "gpt-4o-mini";

// Singleton MCP client instance
class MCPClientService {
  private client: Client | null = null;
  private openai: OpenAI | null = null;
  private isConnected = false;

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    this.client = new Client(
      {
        name: "nextjs-client-docs-manager",
        version: "1.0.0",
      },
      { capabilities: { sampling: {} } }
    );

    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY! 
    });

    // Set up the sampling request handler
    this.client.setRequestHandler(CreateMessageRequestSchema, async (req): Promise<CreateMessageResult> => {
      if (!this.openai) {
        throw new Error("OpenAI client not initialized");
      }

      const prompt = (req.params?.messages ?? [])
        .map((m: any) => (m?.content?.type === "text" ? m.content.text : ""))
        .join("\n");

      const r = await this.openai.chat.completions.create({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: req.params?.maxTokens ?? 512,
      });

      const text = r.choices[0]?.message?.content ?? "";
      
      return {
        model: MODEL,
        role: "assistant",
        content: { type: "text", text },
      };
    });
  }

  async connect() {
    if (this.isConnected || !this.client) return;

    const transport = new StdioClientTransport({
      command: "npx",
      args: ["tsx", "src/server.ts"],
      stderr: "ignore"
    });

    await this.client.connect(transport);
    this.isConnected = true;
  }

  async getTools() {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }
    return await this.client!.listTools();
  }

  async getResources() {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }
    return await this.client!.listResources();
  }

  async getResourceTemplates() {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }
    return await this.client!.listResourceTemplates();
  }

  async getPrompts() {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }
    return await this.client!.listPrompts();
  }

  async callTool(name: string, args: Record<string, any>) {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }
    return await this.client!.callTool({ name, arguments: args });
  }

  async readResource(uri: string) {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }
    return await this.client!.readResource({ uri });
  }

  async getPrompt(name: string, args: Record<string, any>) {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }
    return await this.client!.getPrompt({ name, arguments: args });
  }

  async queryWithTools(query: string) {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }

    const tools = await this.getTools();
    
    // Map MCP tools -> OpenAI chat tools
    const oaTools = tools.tools.map(t => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description ?? t.name,
        parameters: (t.inputSchema as any) ?? { type: "object", properties: {} },
      },
    }));

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: "You can call tools when helpful. Keep outputs concise." },
      { role: "user", content: query },
    ];

    while (true) {
      const resp = await this.openai!.chat.completions.create({
        model: MODEL,
        messages,
        tools: oaTools,
        tool_choice: "auto",
      });

      const msg = resp.choices[0]?.message;
      if (!msg) { 
        return { content: "No response." }; 
      }

      // Did the model request tool calls?
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // record assistant turn that requested tools
        messages.push({
          role: "assistant",
          content: msg.content ?? "",
          tool_calls: msg.tool_calls,
        });

        for (const call of msg.tool_calls) {
          let name = "unknown_tool";
          let argsStr = "{}";

          if (call.type === "function" && "function" in call) {
            name = call.function.name;
            argsStr = call.function.arguments ?? "{}";
          }

          const args = this.safeJson(argsStr);

          let output: string;
          try {
            const res = await this.callTool(name, args);
            output = this.extractMcpText(res) || JSON.stringify(res);
          } catch (err: any) {
            output = `ERROR calling ${name}: ${err?.message ?? String(err)}`;
          }

          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: output,
          });
        }

        // Loop so the model can integrate tool results and produce final text
        continue;
      }

      // No tool calls => final answer
      return { content: msg.content ?? "No text generated." };
    }
  }

  private safeJson(maybe: any) {
    if (maybe == null) return {};
    if (typeof maybe !== "string") return maybe;
    try { return JSON.parse(maybe); } catch { return {}; }
  }

  private extractMcpText(res: any): string {
    const c = res?.content;
    if (!Array.isArray(c)) return "";
    for (const part of c) if (typeof part?.text === "string") return part.text;
    try { return JSON.stringify(c); } catch { return ""; }
  }
}

// Export singleton instance
export const mcpClient = new MCPClientService();


