'use client';

import { useState, useEffect } from 'react';
import { Tool, Prompt, Resource } from '@modelcontextprotocol/sdk/types.js';

interface MCPInterfaceProps {}

interface ToolResult {
  content: Array<{ text: string }>;
}

interface ResourceResult {
  contents: Array<{ text: string; mimeType: string }>;
}

interface PromptResult {
  messages: Array<{ content: { text: string } }>;
}

export default function MCPInterface() {
  const [activeTab, setActiveTab] = useState<'query' | 'tools' | 'resources' | 'prompts' | 'upload'>('query');
  const [tools, setTools] = useState<Tool[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceTemplates, setResourceTemplates] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [queryResult, setQueryResult] = useState<string>('');
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [toolArgs, setToolArgs] = useState<Record<string, string>>({});
  const [toolResult, setToolResult] = useState<string>('');
  const [selectedResource, setSelectedResource] = useState<string>('');
  const [resourceParams, setResourceParams] = useState<Record<string, string>>({});
  const [resourceResult, setResourceResult] = useState<string>('');
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [promptArgs, setPromptArgs] = useState<Record<string, string>>({});
  const [promptResult, setPromptResult] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFilename, setUploadFilename] = useState<string>('');
  const [uploadResult, setUploadResult] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [toolsRes, resourcesRes, promptsRes] = await Promise.all([
        fetch('/api/mcp/tools'),
        fetch('/api/mcp/resources'),
        fetch('/api/mcp/prompts')
      ]);

      if (!toolsRes.ok || !resourcesRes.ok || !promptsRes.ok) {
        throw new Error('Failed to load MCP data');
      }

      const [toolsData, resourcesData, promptsData] = await Promise.all([
        toolsRes.json(),
        resourcesRes.json(),
        promptsRes.json()
      ]);

      setTools(toolsData.tools || []);
      setResources(resourcesData.resources || []);
      setResourceTemplates(resourcesData.resourceTemplates || []);
      setPrompts(promptsData.prompts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuery = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/mcp/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error('Failed to process query');
      }

      const result = await response.json();
      setQueryResult(result.content || 'No response');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleToolCall = async () => {
    if (!selectedTool) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/mcp/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedTool.name, arguments: toolArgs })
      });

      if (!response.ok) {
        throw new Error('Failed to call tool');
      }

      const result: ToolResult = await response.json();
      setToolResult(result.content?.[0]?.text || 'No result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleResourceRead = async () => {
    if (!selectedResource) return;
    
    setLoading(true);
    setError(null);
    
    try {
      let finalUri = selectedResource;
      
      // Replace template parameters
      const paramMatches = selectedResource.match(/{([^}]+)}/g);
      if (paramMatches) {
        for (const paramMatch of paramMatches) {
          const paramName = paramMatch.replace('{', '').replace('}', '');
          const paramValue = resourceParams[paramName] || '';
          finalUri = finalUri.replace(paramMatch, paramValue);
        }
      }

      const response = await fetch('/api/mcp/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri: finalUri })
      });

      if (!response.ok) {
        throw new Error('Failed to read resource');
      }

      const result: ResourceResult = await response.json();
      const content = result.contents[0];
      
      // Handle different MIME types appropriately
      if (content.mimeType === 'application/json') {
        try {
          setResourceResult(JSON.stringify(JSON.parse(content.text), null, 2));
        } catch {
          setResourceResult(content.text);
        }
      } else {
        // For text/plain and other types, display as-is
        setResourceResult(content.text);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handlePromptGet = async () => {
    if (!selectedPrompt) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/mcp/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedPrompt.name, arguments: promptArgs })
      });

      if (!response.ok) {
        throw new Error('Failed to get prompt');
      }

      const result: PromptResult = await response.json();
      setPromptResult(result.messages?.[0]?.content?.text || 'No prompt generated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!uploadFile) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      if (uploadFilename) {
        formData.append('filename', uploadFilename);
      }

      const response = await fetch('/api/mcp/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload file');
      }

      const result = await response.json();
      setUploadResult(result.content?.[0]?.text || 'Upload successful');
      
      // Refresh the resources list to show the new file
      await loadData();
      
      // Clear the form
      setUploadFile(null);
      setUploadFilename('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadFile(file);
      // Set default filename if not already set
      if (!uploadFilename) {
        setUploadFilename(file.name);
      }
    }
  };

  const renderToolInputs = (tool: Tool) => {
    const properties = tool.inputSchema?.properties || {};
    return Object.entries(properties).map(([key, value]: [string, any]) => (
      <div key={key} className="mb-4">
        <label className="block text-sm font-medium mb-2">
          {key} ({value.type})
        </label>
        <input
          type="text"
          value={toolArgs[key] || ''}
          onChange={(e) => setToolArgs({ ...toolArgs, [key]: e.target.value })}
          className="w-full p-2 border border-gray-300 rounded-md"
          placeholder={`Enter ${key}`}
        />
      </div>
    ));
  };

  const renderPromptInputs = (prompt: Prompt) => {
    const args = prompt.arguments || [];
    return args.map((arg) => (
      <div key={arg.name} className="mb-4">
        <label className="block text-sm font-medium mb-2">
          {arg.name}
        </label>
        <input
          type="text"
          value={promptArgs[arg.name] || ''}
          onChange={(e) => setPromptArgs({ ...promptArgs, [arg.name]: e.target.value })}
          className="w-full p-2 border border-gray-300 rounded-md"
          placeholder={`Enter ${arg.name}`}
        />
      </div>
    ));
  };

  const renderResourceParams = (uri: string) => {
    const paramMatches = uri.match(/{([^}]+)}/g);
    if (!paramMatches) return null;

    return paramMatches.map((paramMatch) => {
      const paramName = paramMatch.replace('{', '').replace('}', '');
      return (
        <div key={paramName} className="mb-4">
          <label className="block text-sm font-medium mb-2">
            {paramName}
          </label>
          <input
            type="text"
            value={resourceParams[paramName] || ''}
            onChange={(e) => setResourceParams({ ...resourceParams, [paramName]: e.target.value })}
            className="w-full p-2 border border-gray-300 rounded-md"
            placeholder={`Enter ${paramName}`}
          />
        </div>
      );
    });
  };

  if (loading && tools.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading MCP data...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">MCP Interface</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="flex space-x-1 mb-6">
        {(['query', 'tools', 'resources', 'prompts', 'upload'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md font-medium ${
              activeTab === tab
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'query' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Query</label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md h-24"
              placeholder="Enter your query..."
            />
            <button
              onClick={handleQuery}
              disabled={loading || !query.trim()}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Query'}
            </button>
          </div>
          {queryResult && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Result:</h3>
              <pre className="bg-gray-100 p-4 rounded-md overflow-auto">
                {queryResult}
              </pre>
            </div>
          )}
        </div>
      )}

      {activeTab === 'tools' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Tool</label>
            <select
              value={selectedTool?.name || ''}
              onChange={(e) => {
                const tool = tools.find(t => t.name === e.target.value);
                setSelectedTool(tool || null);
                setToolArgs({});
              }}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">Choose a tool...</option>
              {tools.map((tool) => (
                <option key={tool.name} value={tool.name}>
                  {tool.annotations?.title || tool.name} - {tool.description}
                </option>
              ))}
            </select>
          </div>

          {selectedTool && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-md">
                <h3 className="font-semibold mb-2">Tool Arguments:</h3>
                {renderToolInputs(selectedTool)}
                <button
                  onClick={handleToolCall}
                  disabled={loading}
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
                >
                  {loading ? 'Calling...' : 'Call Tool'}
                </button>
              </div>
              
              {toolResult && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Result:</h3>
                  <pre className="bg-gray-100 p-4 rounded-md overflow-auto">
                    {toolResult}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'resources' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Resource</label>
            <select
              value={selectedResource}
              onChange={(e) => {
                setSelectedResource(e.target.value);
                setResourceParams({});
              }}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">Choose a resource...</option>
              {resources.map((resource) => (
                <option key={resource.uri} value={resource.uri}>
                  {resource.name} - {resource.description}
                </option>
              ))}
              {resourceTemplates.map((template) => (
                <option key={template.uriTemplate} value={template.uriTemplate}>
                  {template.name} - {template.description} (Template)
                </option>
              ))}
            </select>
          </div>

          {selectedResource && (
            <div className="space-y-4">
              {renderResourceParams(selectedResource) && (
                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="font-semibold mb-2">Template Parameters:</h3>
                  {renderResourceParams(selectedResource)}
                </div>
              )}
              
              <button
                onClick={handleResourceRead}
                disabled={loading}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
              >
                {loading ? 'Reading...' : 'Read Resource'}
              </button>
              
              {resourceResult && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Result:</h3>
                  <pre className="bg-gray-100 p-4 rounded-md overflow-auto">
                    {resourceResult}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'prompts' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Prompt</label>
            <select
              value={selectedPrompt?.name || ''}
              onChange={(e) => {
                const prompt = prompts.find(p => p.name === e.target.value);
                setSelectedPrompt(prompt || null);
                setPromptArgs({});
              }}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">Choose a prompt...</option>
              {prompts.map((prompt) => (
                <option key={prompt.name} value={prompt.name}>
                  {prompt.name} - {prompt.description}
                </option>
              ))}
            </select>
          </div>

          {selectedPrompt && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-md">
                <h3 className="font-semibold mb-2">Prompt Arguments:</h3>
                {renderPromptInputs(selectedPrompt)}
                <button
                  onClick={handlePromptGet}
                  disabled={loading}
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
                >
                  {loading ? 'Generating...' : 'Get Prompt'}
                </button>
              </div>
              
              {promptResult && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Generated Prompt:</h3>
                  <pre className="bg-gray-100 p-4 rounded-md overflow-auto">
                    {promptResult}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="space-y-4">
          <div className="bg-gray-50 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Upload PDF Document</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Select PDF File
                </label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Only PDF files are allowed. Maximum size: 10MB
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Filename (optional)
                </label>
                <input
                  type="text"
                  value={uploadFilename}
                  onChange={(e) => setUploadFilename(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="Leave empty to use original filename"
                />
                <p className="text-sm text-gray-500 mt-1">
                  If not provided, the original filename will be used
                </p>
              </div>

              <button
                onClick={handleFileUpload}
                disabled={loading || !uploadFile}
                className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Uploading...' : 'Upload PDF'}
              </button>
            </div>
          </div>

          {uploadResult && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Upload Result:</h3>
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                {uploadResult}
              </div>
            </div>
          )}

          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">📋 Available Documents</h3>
            <p className="text-sm text-gray-600 mb-2">
              After uploading, your document will appear in the Resources tab where you can:
            </p>
            <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
              <li>Read the document content</li>
              <li>Search for specific text</li>
              <li>Generate summaries</li>
              <li>Use AI analysis prompts</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
