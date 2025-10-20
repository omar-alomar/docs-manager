import { NextRequest, NextResponse } from 'next/server';
import { mcpClient } from '@/lib/mcp-client';

export async function GET() {
  try {
    const [resources, resourceTemplates] = await Promise.all([
      mcpClient.getResources(),
      mcpClient.getResourceTemplates()
    ]);
    
    return NextResponse.json({
      resources: resources.resources,
      resourceTemplates: resourceTemplates.resourceTemplates
    });
  } catch (error) {
    console.error('Error fetching resources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resources' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { uri } = await request.json();
    const result = await mcpClient.readResource(uri);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error reading resource:', error);
    return NextResponse.json(
      { error: 'Failed to read resource' },
      { status: 500 }
    );
  }
}


