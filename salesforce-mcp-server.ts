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

// Load environment variables
dotenv.config();

// Salesforce Configuration
const SF_CONFIG = {
  apiVersion: process.env.SF_API_VERSION || '59.0',
  loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com',
  username: process.env.SF_USERNAME,
  password: process.env.SF_PASSWORD,
  securityToken: process.env.SF_SECURITY_TOKEN,
  clientId: process.env.SF_CLIENT_ID,
  clientSecret: process.env.SF_CLIENT_SECRET,
  instanceUrl: process.env.SF_INSTANCE_URL,
  orgAlias: process.env.SF_ORG_ALIAS
};

interface SalesforceAccount {
  Id: string;
  Name: string;
  Type: string;
  Industry: string;
  BillingCity?: string;
  BillingCountry?: string;
  Phone?: string;
  Website?: string;
}

class SalesforceServer {
  private server: Server;
  private accounts: SalesforceAccount[] = [];
  private isAuthenticated: boolean = false;

  constructor() {
    this.server = new Server({
      name: "salesforce-server",
      version: "0.1.0",
      capabilities: {
        resources: {},
        tools: {},
      }
    });

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private async authenticate(): Promise<void> {
    try {
      // Check if already authenticated
      const { stdout: orgInfo } = await execAsync('sf org display --json');
      const orgData = JSON.parse(orgInfo);
      
      if (orgData.result.connectedStatus === 'Connected') {
        this.isAuthenticated = true;
        return;
      }

      // If not authenticated and credentials are provided, attempt login
      if (SF_CONFIG.username && (SF_CONFIG.password || SF_CONFIG.orgAlias)) {
        let loginCommand = 'sf org login web';
        
        if (SF_CONFIG.orgAlias) {
          loginCommand += ` --alias ${SF_CONFIG.orgAlias}`;
        }
        if (SF_CONFIG.loginUrl) {
          loginCommand += ` --instance-url ${SF_CONFIG.loginUrl}`;
        }

        await execAsync(loginCommand);
        this.isAuthenticated = true;
      } else {
        throw new Error('Salesforce credentials not provided');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      throw new McpError(ErrorCode.InternalError, "Failed to authenticate with Salesforce");
    }
  }

  private setupHandlers(): void {
    this.setupResourceHandlers();
    this.setupToolHandlers();
  }

  private setupResourceHandlers(): void {
    // Handler for listing available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      await this.ensureAuthenticated();
      return {
        resources: [{
          uri: "accounts/list",
          name: "Salesforce Accounts",
          mimeType: "application/json",
          description: "List of all Salesforce accounts"
        }]
      };
    });

    // Handler for reading resources
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      await this.ensureAuthenticated();
      
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
      throw new McpError(ErrorCode.InvalidRequest, "Unknown re