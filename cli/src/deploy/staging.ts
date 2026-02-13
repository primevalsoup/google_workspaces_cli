import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { DeployConfig, StagingContext } from './types.js';
import { CORE_FILES } from './service-registry.js';
import { getProxyFile } from './proxy-files.js';
import { generateRouterGs, generateManifest } from './generators.js';

export function createStagingDir(): StagingContext {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gproxy-'));

  const cleanup = () => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  };

  // Register cleanup on unexpected exit
  const exitHandler = () => cleanup();
  process.on('exit', exitHandler);
  process.on('SIGINT', exitHandler);
  process.on('SIGTERM', exitHandler);

  return {
    dir,
    cleanup: () => {
      process.removeListener('exit', exitHandler);
      process.removeListener('SIGINT', exitHandler);
      process.removeListener('SIGTERM', exitHandler);
      cleanup();
    },
  };
}

export function populateStagingDir(dir: string, config: DeployConfig): string[] {
  const writtenFiles: string[] = [];

  // 1. Write core proxy files (always included)
  for (const filename of CORE_FILES) {
    const content = getProxyFile(filename);
    fs.writeFileSync(path.join(dir, filename), content, 'utf-8');
    writtenFiles.push(filename);
  }

  // 2. Write selected service files
  for (const service of config.selectedServices) {
    for (const filename of service.files) {
      // Avoid duplicates (e.g., if contacts and people both listed)
      if (!writtenFiles.includes(filename)) {
        const content = getProxyFile(filename);
        fs.writeFileSync(path.join(dir, filename), content, 'utf-8');
        writtenFiles.push(filename);
      }
    }
  }

  // 3. Write generated Router.gs (overwrites the core copy)
  const routerContent = generateRouterGs(config.selectedServices);
  fs.writeFileSync(path.join(dir, 'Router.gs'), routerContent, 'utf-8');

  // 4. Write generated appsscript.json
  const manifestContent = generateManifest(config.selectedServices, config.timezone);
  fs.writeFileSync(path.join(dir, 'appsscript.json'), manifestContent, 'utf-8');
  writtenFiles.push('appsscript.json');

  return writtenFiles;
}
