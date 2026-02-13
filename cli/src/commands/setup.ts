import { Command } from 'commander';
import crypto from 'node:crypto';
import { createInterface } from 'node:readline';
import { saveConfig } from '../config.js';
import { executeCommand } from '../client.js';
import chalk from 'chalk';

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function registerSetupCommand(program: Command): void {
  program
    .command('setup')
    .description('Interactive setup wizard — configure CLI to connect to the proxy')
    .action(async () => {
      process.stderr.write(chalk.bold('\nGProxy Setup\n'));
      process.stderr.write(chalk.dim('Configure your CLI to connect to the Apps Script proxy.\n\n'));

      // Step 1: Generate a random secret
      const generatedSecret = crypto.randomBytes(32).toString('hex');
      process.stderr.write(chalk.cyan('Generated shared secret:\n'));
      process.stderr.write(chalk.bold(`  ${generatedSecret}\n\n`));
      process.stderr.write(chalk.dim('Copy this into your Apps Script project\'s Script Properties as JWT_SECRET.\n\n'));

      // Step 2: Prompt for Apps Script URL
      const proxy_url = await prompt('Apps Script Web App URL: ');
      if (!proxy_url) {
        process.stderr.write(chalk.red('URL is required.\n'));
        process.exitCode = 1;
        return;
      }
      if (!proxy_url.startsWith('https://script.google.com')) {
        process.stderr.write(chalk.yellow('Warning: URL does not start with https://script.google.com\n'));
        const proceed = await prompt('Continue anyway? (y/N): ');
        if (proceed.toLowerCase() !== 'y') {
          process.stderr.write('Setup cancelled.\n');
          process.exitCode = 1;
          return;
        }
      }
      if (!proxy_url.startsWith('https://')) {
        process.stderr.write(chalk.red('URL must start with https://\n'));
        process.exitCode = 1;
        return;
      }

      // Step 3: Prompt for secret (or use generated)
      const secretInput = await prompt(`Shared secret (Enter to use generated): `);
      const secret = secretInput || generatedSecret;

      // Step 4: Save config
      const { store } = saveConfig({ proxy_url, secret });
      if (store === 'keychain') {
        process.stderr.write(chalk.green('\nCredentials saved to OS keychain (service: gproxy)\n\n'));
      } else if (store === 'encrypted') {
        process.stderr.write(chalk.green('\nCredentials saved to encrypted store (~/.gproxy/credentials.enc)\n\n'));
      } else {
        process.stderr.write(chalk.green('\nConfiguration saved to ~/.gproxy/config.json\n\n'));
      }

      // Step 5: Test connectivity
      process.stderr.write('Testing connection...\n');
      try {
        const result = await executeCommand('admin', 'health', {}, { proxy_url, secret }, {
          timeout: 15000,
          maxRetries: 1,
        });

        if (result.ok) {
          process.stderr.write(chalk.green('Connection successful!\n'));
          if (result.data?.version) {
            process.stderr.write(chalk.dim(`  Proxy version: ${result.data.version}\n`));
          }
          if (result.data?.services) {
            process.stderr.write(chalk.dim(`  Services: ${result.data.services.join(', ')}\n`));
          }
        } else {
          process.stderr.write(chalk.yellow('Connection test failed: ' + (result.error?.message || 'unknown error') + '\n'));
          process.stderr.write(chalk.dim('Config was saved. Check your URL and secret, then retry with: gproxy admin health\n'));
        }
      } catch {
        process.stderr.write(chalk.yellow('Could not reach proxy. Config was saved.\n'));
        process.stderr.write(chalk.dim('Verify your URL and secret, then test with: gproxy admin health\n'));
      }
    });
}
