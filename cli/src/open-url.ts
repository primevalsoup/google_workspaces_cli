import { execSync } from 'node:child_process';
import chalk from 'chalk';

let headlessResult: boolean | undefined;

/**
 * Detect if running on a headless machine (no display / no desktop).
 */
export function isHeadless(): boolean {
  if (headlessResult !== undefined) return headlessResult;

  if (process.platform === 'darwin') {
    // macOS: headless if no WindowServer process (e.g. SSH-only Mac mini)
    try {
      execSync('pgrep -q WindowServer', { stdio: 'ignore', timeout: 3000 });
      headlessResult = false;
    } catch {
      headlessResult = true;
    }
  } else if (process.platform === 'linux') {
    // Linux: headless if no DISPLAY and no WAYLAND_DISPLAY
    headlessResult = !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY;
  } else {
    headlessResult = false;
  }

  return headlessResult;
}

/**
 * Open a URL in the user's browser, or print it if headless.
 * Returns true if the URL was opened, false if headless (user needs to copy/paste).
 */
export function openUrl(url: string): boolean {
  if (isHeadless()) {
    process.stderr.write(chalk.yellow('\n  Headless environment detected — cannot open browser.\n'));
    process.stderr.write(chalk.bold('  Open this URL in a browser signed into your Google account:\n\n'));
    process.stderr.write(chalk.cyan(`    ${url}\n\n`));
    return false;
  }

  try {
    const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
    execSync(`${cmd} "${url}"`, { stdio: 'ignore' });
    return true;
  } catch {
    // Fall back to showing the URL
    process.stderr.write(chalk.dim(`  Could not open browser. Open this URL manually:\n`));
    process.stderr.write(chalk.cyan(`    ${url}\n\n`));
    return false;
  }
}
