import chalk from 'chalk';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runHealthCheck(webAppUrl: string): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(webAppUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        process.stderr.write(chalk.dim(`  Attempt ${attempt}/${MAX_RETRIES}: HTTP ${response.status}\n`));
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        return false;
      }

      const data = await response.json() as { ok?: boolean; data?: { status?: string; version?: string } };
      if (data.ok) {
        const version = data.data?.version || 'unknown';
        process.stderr.write(chalk.green(`  Proxy is healthy (v${version})\n`));
        return true;
      }

      process.stderr.write(chalk.dim(`  Attempt ${attempt}/${MAX_RETRIES}: unexpected response\n`));
    } catch {
      process.stderr.write(chalk.dim(`  Attempt ${attempt}/${MAX_RETRIES}: connection failed\n`));
    }

    if (attempt < MAX_RETRIES) {
      process.stderr.write(chalk.dim(`  Retrying in ${RETRY_DELAY_MS / 1000}s (cold start may take a moment)...\n`));
      await sleep(RETRY_DELAY_MS);
    }
  }

  return false;
}
