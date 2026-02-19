#!/usr/bin/env node

/**
 * Desktop MCP Server Entry Point
 * 
 * Starts the WebRTC-based desktop control MCP server
 */

import { DesktopMCPServer } from './mcp-server.js';

async function main() {
  try {
    const server = new DesktopMCPServer();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down Desktop MCP Server...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down Desktop MCP Server...');
      process.exit(0);
    });

    // Start the server
    await server.start();

  } catch (error) {
    console.error('❌ Failed to start Desktop MCP Server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});