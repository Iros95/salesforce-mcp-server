"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const dotenv_1 = __importDefault(require("dotenv"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
// Load environment variables
dotenv_1.default.config();
class SalesforceServer {
    constructor() {
        this.accounts = [];
        this.server = new index_js_1.Server({
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
    setupHandlers() {
        this.setupResourceHandlers();
        this.setupToolHandlers();
    }
    setupResourceHandlers() {
        // Handler for listing available resources
        this.server.setRequestHandler(types_js_1.ListResourcesRequestSchema, () => __awaiter(this, void 0, void 0, function* () {
            return {
                resources: [{
                        uri: "accounts/list",
                        name: "Salesforce Accounts",
                        mimeType: "application/json",
                        description: "List of all Salesforce accounts"
                    }]
            };
        }));
        // Handler for reading resources
        this.server.setRequestHandler(types_js_1.ReadResourceRequestSchema, (request) => __awaiter(this, void 0, void 0, function* () {
            if (request.params.uri === "accounts/list") {
                yield this.fetchAccounts();
                return {
                    contents: [{
                            uri: request.params.uri,
                            mimeType: "application/json",
                            text: JSON.stringify(this.accounts, null, 2)
                        }]
                };
            }
            throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, "Unknown resource");
        }));
    }
    setupToolHandlers() {
        // Handler for listing available tools
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, () => __awaiter(this, void 0, void 0, function* () {
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
        }));
        // Handler for tool calls
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, (request) => __awaiter(this, void 0, void 0, function* () {
            if (request.params.name === "refresh_accounts") {
                yield this.fetchAccounts();
                return {
                    contents: [{
                            type: "text",
                            text: `Successfully refreshed ${this.accounts.length} accounts`
                        }]
                };
            }
            throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, "Unknown tool");
        }));
    }
    setupErrorHandling() {
        this.server.onerror = (error) => {
            console.error("MCP Error:", error);
        };
        process.on("SIGINT", () => __awaiter(this, void 0, void 0, function* () {
            yield this.server.close();
            process.exit(0);
        }));
    }
    fetchAccounts() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Execute SF CLI command to query accounts
                const { stdout } = yield execAsync('sf data query --query "SELECT Id, Name, Type, Industry FROM Account" --json');
                const result = JSON.parse(stdout);
                if (result.result && result.result.records) {
                    this.accounts = result.result.records;
                }
            }
            catch (error) {
                console.error('Error fetching accounts:', error);
                throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Failed to fetch accounts from Salesforce");
            }
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const transport = new stdio_js_1.StdioServerTransport();
            yield this.server.connect(transport);
            console.error("Salesforce MCP server running on stdio");
        });
    }
}
const server = new SalesforceServer();
server.run().catch(console.error);
