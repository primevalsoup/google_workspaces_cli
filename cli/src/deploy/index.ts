import crypto from 'node:crypto';
import { Command } from 'commander';
import chalk from 'chalk';
import { confirm, select } from '@inquirer/prompts';
import type { DeployOptions, DeploymentMetadata } from './types.js';
import { runPreflight } from './preflight.js';
import { collectDeployConfig } from './prompts.js';
import { createStagingDir, populateStagingDir } from './staging.js';
import fs from 'node:fs';
import path from 'node:path';
import { claspCreate, claspPush, claspDeploy, claspList, writeClaspJson } from './clasp-runner.js';
import { saveDeployment, loadDeployments } from './deployment-store.js';
import { runHealthCheck } from './health-check.js';
import { saveConfig } from '../config.js';
import { generateManifest, generateRouterGs, generateInitCodeGs } from './generators.js';
import { getProxyFile } from './proxy-files.js';
import { openUrl } from '../open-url.js';

async function postInitSecret(webAppUrl: string, secret: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: '_init',
        action: 'setSecret',
        params: { secret },
      }),
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      // Got HTML (likely authorization page) — not authorized yet
      return false;
    }

    const data = await response.json() as { ok?: boolean; error?: { code?: string; message?: string } };
    if (data.ok) {
      return true;
    }

    if (data.error) {
      process.stderr.write(chalk.dim(`  Init response: ${data.error.code} — ${data.error.message}\n`));
    }
    return false;
  } catch {
    return false;
  }
}

function banner() {
  process.stderr.write('\n');
  process.stderr.write(chalk.bold('  GProxy Deploy\n'));
  process.stderr.write(chalk.dim('  Automated Apps Script proxy installer\n'));
  process.stderr.write('\n');
}

function step(n: number, total: number, msg: string) {
  process.stderr.write(chalk.bold(`\n[${n}/${total}] ${msg}\n`));
}

async function runDeploy(opts: DeployOptions): Promise<void> {
  banner();

  const totalSteps = opts.dryRun ? 3 : 5;

  // ── Step 1: Preflight ──────────────────────────────────────────
  step(1, totalSteps, 'Checking prerequisites...');

  const preflight = await runPreflight();
  if (!preflight.ok) {
    for (const err of preflight.errors) {
      process.stderr.write(chalk.red(`\n  ${err}\n`));
    }
    process.exitCode = 1;
    return;
  }
  process.stderr.write(chalk.green('  All checks passed\n'));

  // ── Step 2: Configuration ──────────────────────────────────────
  step(2, totalSteps, 'Configuring deployment...');

  // Check for existing Apps Script projects via clasp
  if (!opts.nonInteractive) {
    const projects = claspList().filter(p =>
      p.name.toLowerCase().startsWith('gproxy') && !p.name.startsWith('gproxy__'),
    );

    if (projects.length > 0) {
      const TAIL_LEN = 12;
      const choices = [
        ...projects.map(p => ({
          name: `${p.name}  ...${p.scriptId.slice(-TAIL_LEN)}`,
          value: p.scriptId,
        })),
        { name: 'Create new deployment', value: '_new' as string },
      ];

      const picked = await select({
        message: 'Update an existing project or create new?',
        choices,
      });

      if (picked !== '_new') {
        // Look up local metadata if it exists; otherwise create minimal entry
        const localDeployments = loadDeployments();
        const existing = localDeployments.find(d => d.scriptId === picked)
          ?? {
            deployedAt: '',
            projectName: projects.find(p => p.scriptId === picked)!.name,
            scriptId: picked,
            deploymentId: '',
            webAppUrl: '',
            services: [],
            secretFingerprint: '',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            cliVersion: '1.0.0',
          } satisfies DeploymentMetadata;
        return await runUpdate(existing, opts, totalSteps);
      }
    }
  }

  const config = await collectDeployConfig(opts);
  if (!config) {
    process.stderr.write(chalk.dim('  Deployment cancelled.\n'));
    return;
  }

  // ── Step 3: Generate files ─────────────────────────────────────
  step(3, totalSteps, 'Generating project files...');

  const staging = createStagingDir();
  try {
    const files = populateStagingDir(staging.dir, config);
    process.stderr.write(chalk.dim(`  Staging directory: ${staging.dir}\n`));
    process.stderr.write(chalk.dim(`  Files: ${files.length}\n`));

    for (const f of files) {
      process.stderr.write(chalk.dim(`    ${f}\n`));
    }

    // ── Dry run exit ───────────────────────────────────────────
    if (opts.dryRun) {
      process.stderr.write(chalk.bold('\n  Dry run — generated files:\n\n'));

      process.stderr.write(chalk.cyan('  === appsscript.json ===\n'));
      const manifest = generateManifest(config.selectedServices, config.timezone);
      for (const line of manifest.split('\n')) {
        process.stderr.write(chalk.dim(`  ${line}\n`));
      }

      process.stderr.write(chalk.cyan('\n  === Router.gs SERVICE_REGISTRY_ ===\n'));
      const router = generateRouterGs(config.selectedServices);
      const registryMatch = router.match(/var SERVICE_REGISTRY_[\s\S]*?};/);
      if (registryMatch) {
        for (const line of registryMatch[0].split('\n')) {
          process.stderr.write(chalk.dim(`  ${line}\n`));
        }
      }

      process.stderr.write(chalk.green('\n  Dry run complete. No changes were made.\n'));
      staging.cleanup();
      return;
    }

    // ── Step 4: Deploy ───────────────────────────────────────────
    step(4, totalSteps, 'Deploying to Apps Script...');

    process.stderr.write(chalk.dim('  Creating Apps Script project...\n'));
    const { scriptId } = claspCreate(config.projectName, staging.dir);
    process.stderr.write(chalk.dim(`  Script ID: ${scriptId}\n`));

    // clasp create overwrites appsscript.json with a default (no webapp block).
    // Re-write our generated manifest to ensure it's deployed as a web app.
    const manifestContent = generateManifest(config.selectedServices, config.timezone);
    fs.writeFileSync(path.join(staging.dir, 'appsscript.json'), manifestContent, 'utf-8');

    // Overwrite Code.gs with init version (time-limited secret setup window)
    const deployTimestamp = Date.now();
    const initCodeGs = generateInitCodeGs(deployTimestamp);
    fs.writeFileSync(path.join(staging.dir, 'Code.gs'), initCodeGs, 'utf-8');

    process.stderr.write(chalk.dim('  Pushing files (init window active)...\n'));
    claspPush(staging.dir);

    process.stderr.write(chalk.dim('  Creating initial deployment...\n'));
    const initDeploy = claspDeploy(staging.dir, `${config.projectName} init`);
    process.stderr.write(chalk.dim(`  Init deployment: ${initDeploy.deploymentId}\n`));

    // Attempt to set JWT_SECRET via the init window
    let secretSetRemotely = false;
    process.stderr.write(chalk.dim('  Setting JWT_SECRET via init endpoint...\n'));
    secretSetRemotely = await postInitSecret(initDeploy.webAppUrl, config.jwtSecret);

    if (!secretSetRemotely && !opts.nonInteractive) {
      // Authorization needed — open the script editor so user can run a function
      const editorUrl = `https://script.google.com/d/${scriptId}/edit`;
      process.stderr.write(chalk.yellow('\n  Authorization required before setting JWT_SECRET.\n'));
      const opened = openUrl(editorUrl);
      if (opened) {
        process.stderr.write(chalk.dim('  Please select the doGet function and click "Run" to trigger authorization.\n'));
        process.stderr.write(chalk.dim('  Then approve the permissions in the popup.\n\n'));
      } else {
        process.stderr.write(chalk.dim('  Select the doGet function and click "Run" to trigger authorization.\n'));
        process.stderr.write(chalk.dim('  Then approve the permissions in the popup.\n\n'));
      }

      const authorized = await confirm({
        message: 'I\'ve authorized the app — continue?',
        default: true,
      });

      if (authorized) {
        process.stderr.write(chalk.dim('  Retrying JWT_SECRET setup...\n'));
        secretSetRemotely = await postInitSecret(initDeploy.webAppUrl, config.jwtSecret);
      }
    }

    if (secretSetRemotely) {
      process.stderr.write(chalk.green('  JWT_SECRET set successfully\n'));
    } else {
      process.stderr.write(chalk.dim('  Could not set JWT_SECRET automatically — will show manual instructions\n'));
    }

    // Push original Code.gs (init window removed) and create final deployment
    const originalCodeGs = getProxyFile('Code.gs');
    fs.writeFileSync(path.join(staging.dir, 'Code.gs'), originalCodeGs, 'utf-8');

    process.stderr.write(chalk.dim('  Pushing final files (init window removed)...\n'));
    claspPush(staging.dir);

    process.stderr.write(chalk.dim('  Creating final deployment...\n'));
    const { deploymentId, webAppUrl } = claspDeploy(
      staging.dir,
      `${config.projectName} v1.0.0`,
    );
    process.stderr.write(chalk.dim(`  Deployment ID: ${deploymentId}\n`));

    // Save CLI config
    const { store } = saveConfig({ proxy_url: webAppUrl, secret: config.jwtSecret });
    if (store === 'keychain') {
      process.stderr.write(chalk.dim('  Credentials saved to OS keychain\n'));
    } else if (store === 'encrypted') {
      process.stderr.write(chalk.dim('  Credentials saved to encrypted store\n'));
    } else {
      process.stderr.write(chalk.dim('  CLI config saved to ~/.gproxy/config.json\n'));
    }

    // Save deployment metadata
    const meta: DeploymentMetadata = {
      deployedAt: new Date().toISOString(),
      projectName: config.projectName,
      scriptId,
      deploymentId,
      webAppUrl,
      services: config.selectedServices.map(s => s.key),
      secretFingerprint: crypto.createHash('sha256').update(config.jwtSecret).digest('hex').slice(0, 8),
      timezone: config.timezone,
      cliVersion: '1.0.0',
    };
    saveDeployment(meta);

    // ── Step 5: Health check ─────────────────────────────────────
    step(5, totalSteps, 'Verifying deployment...');

    if (opts.skipHealthCheck) {
      process.stderr.write(chalk.dim('  Health check skipped\n'));
    } else {
      const healthy = await runHealthCheck(webAppUrl);
      if (!healthy) {
        process.stderr.write(chalk.yellow(
          '  Health check failed — this is normal if authorization hasn\'t been granted yet.\n' +
          '  Open the project to authorize, then test with: gproxy admin health\n',
        ));
      }
    }

    // ── Success summary ──────────────────────────────────────────
    printSuccess(webAppUrl, config.jwtSecret, scriptId, config.projectName, secretSetRemotely);

  } catch (err) {
    process.stderr.write(chalk.red(`\n  Error: ${err instanceof Error ? err.message : String(err)}\n`));
    process.exitCode = 1;
  } finally {
    staging.cleanup();
  }
}

async function runUpdate(
  existing: DeploymentMetadata,
  opts: DeployOptions,
  totalSteps: number,
): Promise<void> {
  const config = await collectDeployConfig(opts);
  if (!config) {
    process.stderr.write(chalk.dim('  Update cancelled.\n'));
    return;
  }

  step(3, totalSteps, 'Generating project files...');
  const staging = createStagingDir();

  try {
    const files = populateStagingDir(staging.dir, config);
    process.stderr.write(chalk.dim(`  Files: ${files.length}\n`));

    if (opts.dryRun) {
      process.stderr.write(chalk.green('\n  Dry run complete. No changes were made.\n'));
      staging.cleanup();
      return;
    }

    step(4, totalSteps, 'Updating Apps Script project...');

    // Write .clasp.json with existing scriptId
    writeClaspJson(staging.dir, existing.scriptId);

    process.stderr.write(chalk.dim('  Pushing updated files...\n'));
    claspPush(staging.dir);

    process.stderr.write(chalk.dim('  Creating new deployment version...\n'));
    const { deploymentId, webAppUrl } = claspDeploy(
      staging.dir,
      `${config.projectName} update ${new Date().toISOString().slice(0, 10)}`,
    );

    // Update CLI config and deployment store
    saveConfig({ proxy_url: webAppUrl, secret: config.jwtSecret });

    const meta: DeploymentMetadata = {
      deployedAt: new Date().toISOString(),
      projectName: config.projectName,
      scriptId: existing.scriptId,
      deploymentId,
      webAppUrl,
      services: config.selectedServices.map(s => s.key),
      secretFingerprint: crypto.createHash('sha256').update(config.jwtSecret).digest('hex').slice(0, 8),
      timezone: config.timezone,
      cliVersion: '1.0.0',
    };
    saveDeployment(meta);

    step(5, totalSteps, 'Verifying deployment...');
    if (!opts.skipHealthCheck) {
      const healthy = await runHealthCheck(webAppUrl);
      if (!healthy) {
        process.stderr.write(chalk.yellow('  Health check failed — authorize the project and retry.\n'));
      }
    }

    printSuccess(webAppUrl, config.jwtSecret, existing.scriptId, config.projectName, false);

  } catch (err) {
    process.stderr.write(chalk.red(`\n  Error: ${err instanceof Error ? err.message : String(err)}\n`));
    process.exitCode = 1;
  } finally {
    staging.cleanup();
  }
}

function printSuccess(
  webAppUrl: string,
  jwtSecret: string,
  scriptId: string,
  projectName: string,
  secretSetRemotely: boolean,
) {
  process.stderr.write('\n');
  process.stderr.write(chalk.green.bold('  Deployment successful!\n'));
  process.stderr.write('\n');
  process.stderr.write(chalk.bold('  Web App URL:\n'));
  process.stderr.write(chalk.cyan(`  ${webAppUrl}\n`));
  process.stderr.write('\n');
  process.stderr.write(chalk.bold('  JWT Secret:\n'));
  process.stderr.write(chalk.cyan(`  ${jwtSecret}\n`));
  process.stderr.write('\n');

  if (secretSetRemotely) {
    process.stderr.write(chalk.green('  JWT_SECRET has been set in Script Properties automatically.\n'));
    process.stderr.write('\n');
    process.stderr.write(chalk.bold('  Verify the deployment:\n'));
    process.stderr.write(chalk.cyan('    gproxy admin health\n'));
    process.stderr.write('\n');
  } else {
    const settingsUrl = `https://script.google.com/d/${scriptId}/edit`;
    process.stderr.write(chalk.bold.yellow('  Action required: Set Script Properties\n'));
    process.stderr.write('\n');
    process.stderr.write(`  1. Open: ${chalk.cyan(settingsUrl)}\n`);
    process.stderr.write(`  2. Click the gear icon (Project Settings)\n`);
    process.stderr.write(`  3. Under "Script Properties", click "Add script property"\n`);
    process.stderr.write(`  4. Set ${chalk.bold('JWT_SECRET')} = ${chalk.dim(jwtSecret.slice(0, 16) + '...')}\n`);
    process.stderr.write('\n');
    process.stderr.write(chalk.dim('  The full secret is saved in ~/.gproxy/config.json and shown above.\n'));
    process.stderr.write('\n');
    process.stderr.write(chalk.bold('  First-time authorization:\n'));
    process.stderr.write('  The first request will trigger OAuth consent. Run:\n');
    process.stderr.write(chalk.cyan('    gproxy admin health\n'));
    process.stderr.write('  and authorize in the browser when prompted.\n');
    process.stderr.write('\n');
  }
}

export function registerDeployCommand(program: Command): void {
  program
    .command('deploy')
    .description('Deploy the GProxy Apps Script proxy (interactive installer)')
    .option('--non-interactive', 'Run without prompts (requires --services)')
    .option('--dry-run', 'Generate files and show plan without deploying')
    .option('--project-name <name>', 'Apps Script project name (default: GProxy)')
    .option('--services <list>', 'Comma-separated service keys (e.g., gmail,calendar,drive)')
    .option('--jwt-secret <secret>', 'JWT shared secret (auto-generated if omitted)')
    .option('--timezone <tz>', 'Timezone (default: system timezone)')
    .option('--skip-health-check', 'Skip post-deployment health check')
    .action(async (rawOpts: Record<string, unknown>) => {
      const opts: DeployOptions = {
        nonInteractive: !!rawOpts.nonInteractive,
        dryRun: !!rawOpts.dryRun,
        projectName: rawOpts.projectName as string | undefined,
        services: rawOpts.services as string | undefined,
        jwtSecret: rawOpts.jwtSecret as string | undefined,
        timezone: rawOpts.timezone as string | undefined,
        skipHealthCheck: !!rawOpts.skipHealthCheck,
      };
      await runDeploy(opts);
    });
}
