import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
dotenv.config();

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
    this.server = new Server(
      {
        name: "salesforce-server",
        version: "0.1.0"
      },
      {
        capabilities: {
          resources: {
            listChanged: true,
            subscribe: true
          },
          tools: {
            listChanged: true
          },
          experimental: {}
        }
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List Resources Handler
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
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

    // Error handling
    this.server.onerror = (error) => {
      console.error("MCP Error:", error);
    };

    // Graceful shutdown
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private async fetchAccounts(): Promise<void> {
    try {
      const query = "SELECT Id, Name, Type, Industry FROM Account LIMIT 10";
      console.error('Executing Salesforce query:', query);
      
      const orgAlias = process.env.SF_ORG_ALIAS;
      if (!orgAlias) {
        throw new Error('SF_ORG_ALIAS not set in environment variables');
      }
      
      console.error('Using org alias:', orgAlias);
      
      const { stdout, stderr } = await execAsync(`sf data query --query "${query}" --target-org ${orgAlias} --json`);
      
      if (stderr) {
        console.error('Salesforce CLI stderr:', stderr);
      }
      
      console.error('Salesforce raw response:', stdout);
      
      const result = JSON.parse(stdout);
      
      if (result.result && result.result.records) {
        this.accounts = result.result.records;
        console.error(`Successfully fetched ${this.accounts.length} accounts`);
      } else {
        console.error('No records found in response:', result);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      throw new McpError(ErrorCode.InternalError, "Failed to fetch accounts from Salesforce");
    }
  }

  public async run(): Promise<void> {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error("Salesforce MCP server running on stdio");
    } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
  }
}

// Start server
const server = new SalesforceServer();
server.run().catch(console.error);