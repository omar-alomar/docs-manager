import { NextRequest, NextResponse } from 'next/server';
import { mcpClient } from '@/lib/mcp-client';

export async function GET() {
  try {
    const prompts = await mcpClient.getPrompts();
    return NextResponse.json(prompts);
  } catch (error) {
    console.error('Error fetching prompts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prompts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, arguments: args } = await request.json();
    const result = await mcpClient.getPrompt(name, args);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting prompt:', error);
    return NextResponse.json(
      { error: 'Failed to get prompt' },
      { status: 500 }
    );
  }
}


