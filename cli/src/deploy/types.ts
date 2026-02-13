export interface AdvancedServiceConfig {
  userSymbol: string;
  serviceId: string;
  version: string;
}

export interface ServiceDefinition {
  key: string;
  displayName: string;
  handlerFunction: string;
  files: string[];
  oauthScopes: string[];
  advancedService: AdvancedServiceConfig | null;
  workspaceOnly: boolean;
  description: string;
}

export interface DeployOptions {
  nonInteractive: boolean;
  dryRun: boolean;
  projectName?: string;
  services?: string;
  jwtSecret?: string;
  timezone?: string;
  skipHealthCheck?: boolean;
}

export interface DeployConfig {
  projectName: string;
  selectedServices: ServiceDefinition[];
  jwtSecret: string;
  timezone: string;
}

export interface DeploymentMetadata {
  deployedAt: string;
  projectName: string;
  scriptId: string;
  deploymentId: string;
  webAppUrl: string;
  services: string[];
  secretFingerprint: string;
  timezone: string;
  cliVersion: string;
}

export interface StagingContext {
  dir: string;
  cleanup: () => void;
}

export interface ClaspResult {
  success: boolean;
  stdout: string;
  stderr: string;
}
