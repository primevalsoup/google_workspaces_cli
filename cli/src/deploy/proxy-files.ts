import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let cachedFiles: Record<string, string> | null = null;

function loadFiles(): Record<string, string> {
  if (cachedFiles) return cachedFiles;

  // Try loading the build-time generated module
  try {
    // Dynamic import not ideal but this is a build-time generated file
    // that may not exist in dev. Use filesystem fallback.
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const generatedPath = path.join(__dirname, 'proxy-files.generated.js');

    if (fs.existsSync(generatedPath)) {
      // Read the generated JS file and extract PROXY_FILES
      const content = fs.readFileSync(generatedPath, 'utf-8');
      const match = content.match(/export const PROXY_FILES\s*=\s*(\{[\s\S]*\});/);
      if (match) {
        // Use Function constructor to evaluate the object literal safely
        cachedFiles = new Function(`return ${match[1]}`)() as Record<string, string>;
        return cachedFiles;
      }
    }
  } catch {
    // Fall through to filesystem fallback
  }

  // Fallback: read from proxy/ directory relative to repo root
  cachedFiles = readFromFilesystem();
  return cachedFiles;
}

function readFromFilesystem(): Record<string, string> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  // From cli/src/deploy/ or cli/dist/deploy/ → repo root → proxy/
  const candidates = [
    path.resolve(__dirname, '..', '..', '..', 'proxy'),     // from src/deploy/
    path.resolve(__dirname, '..', '..', '..', '..', 'proxy'), // from dist/deploy/
  ];

  for (const proxyDir of candidates) {
    if (fs.existsSync(proxyDir) && fs.existsSync(path.join(proxyDir, 'Code.gs'))) {
      return readGsFilesRecursive(proxyDir);
    }
  }

  throw new Error(
    'Could not find proxy source files. Run from the repository root or build with: npm run build',
  );
}

function readGsFilesRecursive(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.gs')) {
      files[entry.name] = fs.readFileSync(path.join(dir, entry.name), 'utf-8');
    }
    if (entry.isDirectory()) {
      Object.assign(files, readGsFilesRecursive(path.join(dir, entry.name)));
    }
  }
  return files;
}

export function getProxyFile(name: string): string {
  const files = loadFiles();
  const content = files[name];
  if (!content) {
    throw new Error(`Proxy file not found: ${name}`);
  }
  return content;
}

export function getAllProxyFiles(): Record<string, string> {
  return { ...loadFiles() };
}
