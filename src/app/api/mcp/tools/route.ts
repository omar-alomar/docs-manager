import { NextRequest, NextResponse } from 'next/server';
import { mcpClient } from '@/lib/mcp-client';

export async function GET() {
  try {
    const tools = await mcpClient.getTools();
    return NextResponse.json(tools);
  } catch (error) {
    console.error('Error fetching tools:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tools' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, arguments: args } = await request.json();
    const result = await mcpClient.callTool(name, args);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error calling tool:', error);
    return NextResponse.json(
      { error: 'Failed to call tool' },
      { status: 500 }
    );
  }
}


