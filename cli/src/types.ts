export interface CommandResult {
  ok: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface ProxyRequest {
  jwt: string;
  service: string;
  action: string;
  params: Record<string, any>;
  clientIp?: string;
}

export interface ProxyResponse {
  ok: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface GProxyConfig {
  proxy_url: string;
  secret: string;
}

export type OutputMode = 'json' | 'human' | 'plain';

export interface GlobalOptions {
  json?: boolean;
  plain?: boolean;
  proxyUrl?: string;
  secret?: string;
  verbose?: boolean;
  timeout?: number;
  retry?: number;
}
