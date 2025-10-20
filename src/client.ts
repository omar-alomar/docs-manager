import "dotenv/config";
import { input, select, confirm } from "@inquirer/prompts";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Prompt, PromptMessage, Tool } from "@modelcontextprotocol/sdk/types.js";
import OpenAI from "openai";
import { CreateMessageRequestSchema, CreateMessageResult } from "@modelcontextprotocol/sdk/types.js";


const mcp = new Client({
    name: "text-client-docs-manager",
    version: "1.0.0",
    },
    { capabilities: { sampling: {} } }
)

const MODEL = "gpt-4.1-mini";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "src/server.ts"],
    stderr: "ignore"
})

mcp.setRequestHandler(CreateMessageRequestSchema, async (req): Promise<CreateMessageResult> => {
    console.log("[sampling] request:", JSON.stringify(req.params ?? {}, null, 2));
  
    const prompt = (req.params?.messages ?? [])
      .map((m: any) => (m?.content?.type === "text" ? m.content.text : ""))
      .join("\n");
  
    const r = await openai.responses.create({
      model: MODEL,
      input: prompt,                                // ← this is fine for OpenAI Responses API
      max_output_tokens: req.params?.maxTokens ?? 512,
    });
  
    const text = r.output_text ?? "";
    console.log("[sampling] LLM text:", text.slice(0, 120));
  
    return {
      model: MODEL,                                  // REQUIRED by CreateMessageResult
      role: "assistant",
      content: { type: "text", text },
    };
  });
  

async function main() {
    await mcp.connect(transport)
    const [{tools}, {resources}, {resourceTemplates}, {prompts}] =
     await Promise.all([
        mcp.listTools(),
        mcp.listResources(),
        mcp.listResourceTemplates(),
        mcp.listPrompts(),
    ])
    console.log("You are connected!")
    while (true) {
        const option = await select({
            message: "What would you like to do?",
            choices: ["Query", "Tools", "Resources", "Prompts"]
        })
        switch (option) {
            case "Tools":
                const toolName = await select({
                    message: "Select a tool",
                    choices: tools.map(tool => ({
                        name: tool.annotations?.title || tool.name,
                        value: tool.name,
                        description: tool.description,
                    }))
                })
                const tool = tools.find(t => t.name === toolName)
                if (tool == null) {
                    console.error("Tool not found")
                } else {
                    await handleTool(tool)
                }
            break
            case "Resources":
                const resourceUri = await select({
                message: "Select a resource",
                choices: [
                    ...resources.map(resource => ({
                    name: resource.name,
                    value: resource.uri,
                    description: resource.description,
                    })),
                    ...resourceTemplates.map(template => ({
                    name: template.name,
                    value: template.uriTemplate,
                    description: template.description,
                    })),
                ],
                })
                const uri =
                resources.find(r => r.uri === resourceUri)?.uri ??
                resourceTemplates.find(r => r.uriTemplate === resourceUri)
                    ?.uriTemplate
                if (uri == null) {
                console.error("Resource not found.")
                } else {
                await handleResource(uri)
                }
            break
            case "Prompts":
                const promptName = await select({
                    message: "Select a prompt",
                    choices: prompts.map(prompt => ({
                        name: prompt.name,
                        value: prompt.name,
                        description: prompt.description,
                    }))
                })
                const prompt = prompts.find(p => p.name === promptName)
                if (prompt == null) {
                    console.error("Prompt not found")
                } else {
                    await handlePrompt(prompt)
                }
            break
            case "Query":
                await handleQuery(tools)
            break
        }
    }
}

async function handleTool(tool: Tool) {
    const args: Record<string, string> = {}
    for (const [key, value] of Object.entries(tool.inputSchema.properties ?? {})) {
        args[key] = await input({
            message: `Enter value for ${key} (${(value as {type: string}).type}):`
        })
    }

    const res = await mcp.callTool({
        name: tool.name,
        arguments: args
    })
    console.log((res.content as [{ text: string }])[0].text)
}

async function handleResource(uri: string) {
    let finalUri = uri
    const paramMatches = uri.match(/{([^}]+)}/g)
  
    if (paramMatches != null) {
      for (const paramMatch of paramMatches) {
        const paramName = paramMatch.replace("{", "").replace("}", "")
        const paramValue = await input({
          message: `Enter value for ${paramName}:`,
        })
        finalUri = finalUri.replace(paramMatch, paramValue)
      }
    }
  
    const res = await mcp.readResource({
      uri: finalUri,
    })
  
    console.log(
      JSON.stringify(JSON.parse(res.contents[0].text as string), null, 2)
    )
}

async function handlePrompt(prompt: Prompt) {
    const args: Record<string, string> = {}
    for (const arg of prompt.arguments ?? []) {
      args[arg.name] = await input({
        message: `Enter value for ${arg.name}:`,
      })
    }
  
    const response = await mcp.getPrompt({
      name: prompt.name,
      arguments: args,
    })
  
    for (const message of response.messages) {
      console.log(await handleServerMessagePrompt(message))
    }
}

async function handleServerMessagePrompt(message: PromptMessage) {
    // Only handle simple text prompts from the server
    if (message.content.type !== "text") return;
  
    console.log(message.content.text);
  
    const run = await confirm({
      message: "Run this prompt with OpenAI?",
      default: true,
    });
    if (!run) return;
  
    try {
      const r = await openai.responses.create({
        model: MODEL,                 // e.g., "gpt-4.1-mini"
        input: message.content.text,  // raw prompt text from the server
        max_output_tokens: 512,
      });
  
      const text = r.output_text ?? "";
      return text;
    } catch (err: any) {
      console.error("OpenAI error:", err?.message ?? err);
      return "Failed to run prompt with OpenAI.";
    }
  }
  
  async function handleQuery(tools: Tool[]) {
    const query = await input({ message: "Enter your query" });
  
    // Map MCP tools -> OpenAI chat tools
    const oaTools = tools.map(t => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description ?? t.name,
        // MCP inputSchema is JSON Schema; pass it through
        parameters: (t.inputSchema as any) ?? { type: "object", properties: {} },
      },
    })) as any;
  
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: "You can call tools when helpful. Keep outputs concise." },
      { role: "user", content: query },
    ];
  
    while (true) {
      const resp = await openai.chat.completions.create({
        model: MODEL,
        messages,
        tools: oaTools,
        tool_choice: "auto",
      });
  
      const msg = resp.choices[0]?.message;
      if (!msg) { console.log("No response."); return; }
  
      // Did the model request tool calls?
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // record assistant turn that requested tools (content can be null/empty)
        messages.push({
          role: "assistant",
          content: msg.content ?? "",
          tool_calls: msg.tool_calls,
        });
  
        for (const call of msg.tool_calls) {
          // --- TYPE-NARROWING: Some variants don't have `.function` ---
          let name = "unknown_tool";
          let argsStr = "{}";
  
          if (call.type === "function" && "function" in call) {
            name = call.function.name;
            argsStr = call.function.arguments ?? "{}";
          } else if ("custom" in (call as any)) {
            // Future/alt providers might use a `custom` payload
            name = (call as any).custom?.name ?? name;
            argsStr = (call as any).custom?.arguments ?? argsStr;
          } else {
            // ultra-safe fallback
            name = (call as any).name ?? name;
            argsStr = (call as any).arguments ?? argsStr;
          }
  
          const args = safeJson(argsStr);
  
          let output: string;
          try {
            const res = await mcp.callTool({ name, arguments: args });
            output = extractMcpText(res) || JSON.stringify(res);
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
      console.log(msg.content ?? "No text generated.");
      return;
    }
  }
  
  // --- helpers ---
  function safeJson(maybe: any) {
    if (maybe == null) return {};
    if (typeof maybe !== "string") return maybe;
    try { return JSON.parse(maybe); } catch { return {}; }
  }
  
  function extractMcpText(res: any): string {
    const c = res?.content;
    if (!Array.isArray(c)) return "";
    for (const part of c) if (typeof part?.text === "string") return part.text;
    try { return JSON.stringify(c); } catch { return ""; }
  }
  
  

main()