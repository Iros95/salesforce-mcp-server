import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
  InitializeRequestSchema,
  InitializedNotificationSchema
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
dotenv.config();

console.error('Starting Salesforce MCP Server...');

interface SalesforceAccount {
  Id: string;
  Name: string;
  Type?: string;
  Industry?: string;
}

class SalesforceServer {
  private server: Server;
  private accounts: SalesforceAccount[] = [];

  constructor() {
    console.error('Initializing SalesforceServer...');
    try {
      this.server = new Server(
        {
          name: "salesforce-server",
          version: "0.1.0"
        }
      );
      console.error('Server instance created successfully');
      this.setupHandlers();
    } catch (error) {
      console.error('Error in constructor:', error);
      throw error;
    }
  }

  private setupHandlers(): void {
    console.error('Setting up handlers...');
    try {
      // Initialize Handler
      this.server.setRequestHandler(InitializeRequestSchema, async (request) => {
        console.error('Handling Initialize request:', request);
        return {
          protocolVersion: request.params.protocolVersion,
          capabilities: {
            resources: {
              listChanged: true,
              subscribe: true
            },
            tools: {
              listChanged: true
            }
          },
          serverInfo: {
            name: "salesforce-server",
            version: "0.1.0"
          }
        };
      });

      // Initialized Notification Handler
      this.server.setNotificationHandler(InitializedNotificationSchema, () => {
        console.error('Received Initialized notification');
      });

      // List Resources Handler
      this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
        console.error('Handling ListResources request');
        return {
          resources: [{
            uri: "accounts/list",
            name: "Salesforce Accounts",
            mimeType: "application/json",
            description: "List of all Salesforce accounts"
          }]
        };
      });

      // Read Resource Handler
      this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        console.error('Handling ReadResource request:', request.params.uri);
        if (request.params.uri === "accounts/list") {
          await this.fetchAccounts();
          return {
            contents: [{
              uri: request.params.uri,
              mimeType: "application/json",
              text: JSON.stringify(this.accounts, null, 2)
            }]
          };
        }
        throw new McpError(ErrorCode.InvalidRequest, "Unknown resource");
      });

      // List Tools Handler
      this.server.setRequestHandler(ListToolsRequestSchema, async () => {
        console.error('Handling ListTools request');
        return {
          tools: [{
            name: "refresh_accounts",
            description: "Refresh the list of Salesforce accounts",
            inputSchema: {
              type: "object",
              properties: {}
            }
          }]
        };
      });

      // Call Tool Handler
      this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
        console.error('Handling CallTool request:', request.params.name);
        if (request.params.name === "refresh_accounts") {
          await this.fetchAccounts();
          return {
            contents: [{
              type: "text",
              text: `Successfully refreshed ${this.accounts.length} accounts`
            }]
          };
        }
        throw new McpError(ErrorCode.InvalidRequest, "Unknown tool");
      });

      console.error('All handlers set up successfully');
    } catch (error) {
      console.error('Error setting up handlers:', error);
      throw error;
    }
  }

  private async fetchAccounts(): Promise<void> {
    try {
      console.error('Fetching accounts from Salesforce...');
      const orgAlias = process.env.SF_ORG_ALIAS;
      const query = "SELECT Id, Name, Type, Industry FROM Account LIMIT 10";
      
      console.error('Using org alias:', orgAlias);
      console.error('Executing query:', query);
      
      const { stdout, stderr } = await execAsync(`sf data query --target-org ${orgAlias} --query "${query}" --json`);
      
      if (stderr) {
        console.error('Salesforce CLI stderr:', stderr);
      }
      
      console.error('Raw Salesforce response:', stdout);
      
      const result = JSON.parse(stdout);
      
      if (result.result && result.result.records) {
        this.accounts = result.result.records;
        console.error(`Successfully fetched ${this.accounts.length} accounts`);
      } else {
        console.error('Unexpected response format:', result);
        throw new Error('Unexpected response format from Salesforce');
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to fetch accounts from Salesforce: ${error.message}`);
    }
  }

  public async run(): Promise<void> {
    try {
      console.error('Starting server...');
      const transport = new StdioServerTransport();
      
      // Set up error handler before connecting
      this.server.onerror = (error) => {
        console.error('Server error:', error);
      };

      await this.server.connect(transport);
      console.error('Server connected successfully');

      // Keep the process alive
      process.stdin.resume();

      // Handle shutdown
      process.on('SIGINT', async () => {
        console.error('Received SIGINT, shutting down...');
        await this.server.close();
        process.exit(0);
      });

    } catch (error) {
      console.error('Error running server:', error);
      process.exit(1);
    }
  }
}

// Start server with error handling
console.error('Creating server instance...');
const server = new SalesforceServer();
server.run().catch(error => {
  console.error('Fatal error running server:', error);
  process.exit(1);
});