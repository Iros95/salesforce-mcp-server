# Salesforce MCP Server

This project implements a Model Context Protocol (MCP) server that integrates with Salesforce, allowing Claude Desktop to interact with Salesforce data. Currently, it supports querying Account information from a Salesforce organization.

## Prerequisites

- Node.js v16 or later
- Salesforce CLI (sf)
- Claude Desktop application
- Access to a Salesforce organization (sandbox or production)

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd salesforce-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the project root:
```
SF_LOGIN_URL=https://test.salesforce.com
SF_API_VERSION=59.0
SF_ORG_ALIAS=your-sandbox-alias
```

4. Authenticate with Salesforce:
```bash
# Login to your sandbox
sf org login web --alias your-sandbox-alias --instance-url https://test.salesforce.com
```

## Configuration

### Configure Claude Desktop

1. Open the Claude Desktop configuration file:
```bash
# On Windows
code "%APPDATA%\Claude\claude_desktop_config.json"

# On macOS
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

2. Add the following configuration:
```json
{
  "mcpServers": {
    "salesforce": {
      "command": "npm",
      "args": ["run", "dev"],
      "cwd": "path/to/your/salesforce-mcp-server"
    }
  }
}
```

Replace `path/to/your/salesforce-mcp-server` with the actual path to your project directory.

## Running the Server

1. Start the server:
```bash
npm run dev
```

2. Open Claude Desktop
3. Look for the "⚡" button in the bottom right corner
4. Click it to access Salesforce data through the MCP server

## Available Features

### Resources
- `accounts/list`: Returns a list of Salesforce accounts

### Tools
- `refresh_accounts`: Manually refresh the account data

## Development

### Project Structure
```
salesforce-mcp-server/
├── src/
│   └── index.ts         # Main server implementation
├── package.json         # Project dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── .env                 # Environment variables
└── README.md           # This file
```

### Scripts
- `npm run dev`: Start the server in development mode
- `npm run build`: Build the TypeScript code
- `npm start`: Run the built version
- `npm run clean`: Clean the build directory

## Troubleshooting

### Common Issues

1. Connection Issues:
   - Verify Salesforce authentication with `sf org display`
   - Check Claude Desktop configuration path is correct
   - Ensure .env file has correct values

2. Authentication Issues:
   - Re-authenticate with Salesforce using `sf org login web`
   - Verify your org alias in .env matches the authenticated org

3. Server Issues:
   - Check Claude Desktop logs:
     ```bash
     # On Windows
     type "%APPDATA%\Claude\logs\claude\mcp.log"
     
     # On macOS
     tail -f ~/Library/Logs/Claude/mcp.log
     ```

## License

[Your License]

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request