import type { ServiceDefinition, AdvancedServiceConfig } from './types.js';
import { BASE_OAUTH_SCOPES } from './service-registry.js';
import { getProxyFile } from './proxy-files.js';

const INIT_WINDOW_MS = 300000; // 5 minutes — allows time for first-time OAuth authorization

/**
 * Generate a Router.gs with SERVICE_REGISTRY_ containing only the selected services.
 */
export function generateRouterGs(services: ServiceDefinition[]): string {
  const template = getProxyFile('Router.gs');

  const entries = services
    .map(s => `  '${s.key}': ${s.handlerFunction}`)
    .join(',\n');

  // Proxy admin is always included (health, config, logs, IP management)
  const adminEntry = `  'admin': handleAdmin`;
  const allEntries = services.some(s => s.key === 'admin')
    ? entries
    : [adminEntry, entries].filter(Boolean).join(',\n');

  const registryBlock = `var SERVICE_REGISTRY_ = {\n${allEntries}\n};`;

  return template.replace(
    /var SERVICE_REGISTRY_ = \{[\s\S]*?\};/,
    registryBlock,
  );
}

/**
 * Generate appsscript.json manifest based on selected services and timezone.
 */
export function generateManifest(
  services: ServiceDefinition[],
  timezone: string,
): string {
  const scopes = collectScopes(services);
  const advancedServices = collectAdvancedServices(services);

  const manifest: Record<string, unknown> = {
    timeZone: timezone,
    dependencies: {
      enabledAdvancedServices: advancedServices.map(as => ({
        userSymbol: as.userSymbol,
        serviceId: as.serviceId,
        version: as.version,
      })),
    },
    oauthScopes: scopes,
    exceptionLogging: 'STACKDRIVER',
    runtimeVersion: 'V8',
    webapp: {
      executeAs: 'USER_DEPLOYING',
      access: 'ANYONE_ANONYMOUS',
    },
  };

  return JSON.stringify(manifest, null, 2) + '\n';
}

/**
 * Generate a Code.gs with a time-limited init window.
 * During the window (60s after deploy), unauthenticated POST requests
 * to service="_init", action="setSecret" are accepted.
 * After the window closes or the secret is set, init requests are rejected.
 */
export function generateInitCodeGs(deployTimestamp: number): string {
  const original = getProxyFile('Code.gs');

  // Insert init check right after the body is parsed, before JWT verification
  const initBlock = `
    // ── Init window: accept unauthenticated secret setup for ${INIT_WINDOW_MS / 1000}s after deploy ──
    var _DEPLOY_TS_ = ${deployTimestamp};
    var _INIT_WINDOW_ = ${INIT_WINDOW_MS};
    if (body.service === '_init' && body.action === 'setSecret') {
      var now = new Date().getTime();
      var windowExpired = (now - _DEPLOY_TS_) > _INIT_WINDOW_;
      if (isConfigured()) {
        return jsonResponse({
          ok: false,
          error: { code: 'INIT_REJECTED', message: 'Already configured', retryable: false },
          requestId: requestId
        });
      }
      if (windowExpired) {
        return jsonResponse({
          ok: false,
          error: { code: 'INIT_EXPIRED', message: 'Init window has expired', retryable: false },
          requestId: requestId
        });
      }
      if (!body.params || !body.params.secret || body.params.secret.length < 32) {
        return jsonResponse({
          ok: false,
          error: { code: 'INVALID_REQUEST', message: 'Secret must be at least 32 characters', retryable: false },
          requestId: requestId
        });
      }
      setConfig('JWT_SECRET', body.params.secret);
      return jsonResponse({
        ok: true,
        data: { message: 'JWT_SECRET configured successfully' },
        requestId: requestId
      });
    }
    // ── End init window ──
`;

  // Insert after "var jwt = body.jwt;" line (before JWT verification)
  return original.replace(
    /var jwt = body\.jwt;\n/,
    `var jwt = body.jwt;\n${initBlock}\n`,
  );
}

function collectScopes(services: ServiceDefinition[]): string[] {
  const scopeSet = new Set<string>(BASE_OAUTH_SCOPES);
  for (const svc of services) {
    for (const scope of svc.oauthScopes) {
      scopeSet.add(scope);
    }
  }
  return [...scopeSet].sort();
}

function collectAdvancedServices(services: ServiceDefinition[]): AdvancedServiceConfig[] {
  const seen = new Map<string, AdvancedServiceConfig>();
  for (const svc of services) {
    if (svc.advancedService && !seen.has(svc.advancedService.serviceId)) {
      seen.set(svc.advancedService.serviceId, svc.advancedService);
    }
  }
  return [...seen.values()].sort((a, b) => a.userSymbol.localeCompare(b.userSymbol));
}
