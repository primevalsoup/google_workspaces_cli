import crypto from 'node:crypto';
import chalk from 'chalk';
import { input, confirm, checkbox } from '@inquirer/prompts';
import type { DeployConfig, DeployOptions, ServiceDefinition } from './types.js';
import { SERVICE_DEFINITIONS } from './service-registry.js';

export async function collectDeployConfig(options: DeployOptions): Promise<DeployConfig | null> {
  if (options.nonInteractive) {
    return collectNonInteractive(options);
  }
  return collectInteractive(options);
}

async function collectInteractive(options: DeployOptions): Promise<DeployConfig | null> {
  // 1. Project name
  const projectName = await input({
    message: 'Project name',
    default: options.projectName || 'GProxy',
    validate: (v) => v.trim().length > 0 || 'Project name is required',
  });

  // 2. Service selection
  const serviceChoices = SERVICE_DEFINITIONS.map(svc => ({
    name: svc.workspaceOnly
      ? `${svc.displayName} — ${svc.description} ${chalk.yellow('(Workspace only)')}`
      : `${svc.displayName} — ${svc.description}`,
    value: svc.key,
    checked: false,
  }));

  const selectedKeys = await checkbox({
    message: 'Select services to enable (space to toggle, enter to confirm)',
    choices: serviceChoices,
    required: true,
    validate: (selected) => {
      if (selected.length === 0) return 'Select at least one service';
      return true;
    },
  });

  const selectedServices = selectedKeys
    .map(key => SERVICE_DEFINITIONS.find(s => s.key === key)!)
    .filter(Boolean);

  const hasWorkspace = selectedServices.some(s => s.workspaceOnly);
  if (hasWorkspace) {
    process.stderr.write(
      chalk.yellow('\n  Note: You selected Workspace-only services. These require a Google Workspace account.\n\n'),
    );
  }

  // 3. JWT Secret
  const generated = crypto.randomBytes(32).toString('hex');
  const autoGenerate = await confirm({
    message: 'Auto-generate JWT shared secret?',
    default: true,
  });

  let jwtSecret: string;
  if (autoGenerate) {
    jwtSecret = generated;
  } else {
    jwtSecret = await input({
      message: 'Enter JWT shared secret (32+ chars)',
      validate: (v) => v.trim().length >= 32 || 'Secret must be at least 32 characters',
    });
  }

  // 4. Timezone
  const defaultTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezone = await input({
    message: 'Timezone',
    default: options.timezone || defaultTz,
  });

  // 5. Summary & confirmation
  process.stderr.write('\n');
  process.stderr.write(chalk.bold('  Deployment Summary\n'));
  process.stderr.write(chalk.dim('  ─────────────────────────────────\n'));
  process.stderr.write(`  Project:   ${chalk.cyan(projectName)}\n`);
  process.stderr.write(`  Services:  ${chalk.cyan(selectedServices.map(s => s.displayName).join(', '))}\n`);
  process.stderr.write(`  Timezone:  ${chalk.cyan(timezone)}\n`);
  process.stderr.write(`  Secret:    ${chalk.cyan(jwtSecret.slice(0, 8) + '...' + jwtSecret.slice(-4))}\n`);
  process.stderr.write(chalk.dim('  ─────────────────────────────────\n'));
  process.stderr.write('\n');

  const proceed = await confirm({
    message: 'Proceed with deployment?',
    default: true,
  });

  if (!proceed) {
    return null;
  }

  return { projectName, selectedServices, jwtSecret, timezone };
}

function collectNonInteractive(options: DeployOptions): DeployConfig {
  const projectName = options.projectName || 'GProxy';

  if (!options.services) {
    throw new Error('--services is required in non-interactive mode');
  }

  const serviceKeys = options.services.split(',').map(s => s.trim());
  const selectedServices: ServiceDefinition[] = [];

  for (const key of serviceKeys) {
    const svc = SERVICE_DEFINITIONS.find(s => s.key === key);
    if (!svc) {
      throw new Error(`Unknown service: ${key}. Valid: ${SERVICE_DEFINITIONS.map(s => s.key).join(', ')}`);
    }
    selectedServices.push(svc);
  }

  const jwtSecret = options.jwtSecret || crypto.randomBytes(32).toString('hex');
  const timezone = options.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  return { projectName, selectedServices, jwtSecret, timezone };
}
