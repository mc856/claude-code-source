import type { Tool } from '../../Tool.js';
import type {
  MCPServerConnection,
  McpClaudeAIProxyServerConfig,
  McpHTTPServerConfig,
  McpSSEServerConfig,
  McpStdioServerConfig,
} from '../../services/mcp/types.js';

type BaseServerInfo = {
  name: string;
  client: MCPServerConnection;
  scope: MCPServerConnection['config']['scope'];
};

export type StdioServerInfo = BaseServerInfo & {
  transport: 'stdio';
  config: McpStdioServerConfig;
};

export type SSEServerInfo = BaseServerInfo & {
  transport: 'sse';
  isAuthenticated?: boolean;
  config: McpSSEServerConfig;
};

export type HTTPServerInfo = BaseServerInfo & {
  transport: 'http';
  isAuthenticated?: boolean;
  config: McpHTTPServerConfig;
};

export type ClaudeAIServerInfo = BaseServerInfo & {
  transport: 'claudeai-proxy';
  isAuthenticated?: boolean;
  config: McpClaudeAIProxyServerConfig;
};

export type ServerInfo =
  | StdioServerInfo
  | SSEServerInfo
  | HTTPServerInfo
  | ClaudeAIServerInfo;

export type AgentMcpServerInfo = {
  name: string;
  sourceAgents: string[];
  transport: 'stdio' | 'sse' | 'http' | 'ws';
  needsAuth: boolean;
  isAuthenticated?: boolean;
  url?: string;
  command?: string;
};

export type MCPViewState =
  | {
      type: 'list';
      defaultTab?: string;
    }
  | {
      type: 'server-menu';
      server: ServerInfo;
    }
  | {
      type: 'server-tools';
      server: ServerInfo;
    }
  | {
      type: 'server-tool-detail';
      server: ServerInfo;
      toolIndex: number;
    }
  | {
      type: 'agent-server-menu';
      agentServer: AgentMcpServerInfo;
    };

export type MCPToolSelection = {
  client: MCPServerConnection;
  tool: Tool;
};
