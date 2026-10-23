import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";

import { dirname, extname, join, resolve } from "node:path";

import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const failures = [];
const passes = [];

function check(condition, message) {
  (condition ? passes : failures).push(message);
}

function read(relativePath) {
  const absolutePath = join(root, relativePath);

  if (!existsSync(absolutePath)) {
    failures.push(`Missing required file: ${relativePath}`);
    return "";
  }

  return readFileSync(absolutePath, "utf8");
}

function walk(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory).flatMap((name) => {
    const fullPath = join(directory, name);

    return statSync(fullPath).isDirectory() ? walk(fullPath) : [fullPath];
  });
}

const packageJson = JSON.parse(read("package.json"));
const gitignore = read(".gitignore");
const envExample = read(".env.example");
const apiClient = read("src/lib/api-client.ts");
const router = read("src/app/router.tsx");
const dashboard = read("src/pages/DashboardPage.tsx");

// 1. Required project scripts.
check(
  Boolean(packageJson.scripts?.build),
  "Production build script is configured.",
);

check(Boolean(packageJson.scripts?.lint), "Lint script is configured.");

check(
  Boolean(packageJson.scripts?.["verify:release"]),
  "Release verification script is configured.",
);

// 2. Git exclusions.
const ignoredEntries = gitignore.split(/\r?\n/).map((line) => line.trim());

check(ignoredEntries.includes(".env"), ".env is ignored by Git.");

check(
  ignoredEntries.includes("node_modules"),
  "node_modules is ignored by Git.",
);

check(
  ignoredEntries.includes("dist"),
  "Production build output is ignored by Git.",
);

// 3. Environment configuration.
check(
  /^VITE_API_BASE_URL=https?:\/\/\S+/m.test(envExample),
  ".env.example documents VITE_API_BASE_URL.",
);

check(
  apiClient.includes("VITE_API_BASE_URL"),
  "API client reads the API base URL from environment configuration.",
);

// 4. Protected application routes.
check(
  router.includes("ProtectedRoute") && router.includes("AppLayout"),
  "Router includes protected application routes.",
);

// 5. Dashboard module integration.
check(
  dashboard.includes("<BudgetPerformanceSection />") &&
    dashboard.includes("<RecurringPerformanceSection />") &&
    dashboard.includes("<CashFlowAnalyticsSection />"),
  "Dashboard includes budget, recurring, and cash-flow modules.",
);

// 6. Relative source import integrity.
const sourceFiles = walk(join(root, "src")).filter((file) =>
  /\.(ts|tsx|js|jsx)$/.test(file),
);

let importCount = 0;

for (const sourceFile of sourceFiles) {
  const content = readFileSync(sourceFile, "utf8");

  const importPattern = /(?:from\s*|import\s*)["'](\.[^"']+)["']/g;

  let match;

  while ((match = importPattern.exec(content)) !== null) {
    importCount += 1;

    const specifier = match[1];
    const basePath = resolve(dirname(sourceFile), specifier);

    const candidates = [
      basePath,
      `${basePath}.ts`,
      `${basePath}.tsx`,
      `${basePath}.js`,
      `${basePath}.jsx`,
      `${basePath}.css`,
      `${basePath}.json`,
      join(basePath, "index.ts"),
      join(basePath, "index.tsx"),
    ];

    if (!candidates.some((candidate) => existsSync(candidate))) {
      failures.push(
        `Unresolved relative import: ${specifier} in ${sourceFile.slice(
          root.length + 1,
        )}`,
      );
    }
  }
}

check(
  importCount > 0,
  `Checked ${importCount} relative imports for missing files.`,
);

/**
 * 7. Check environment files tracked by Git.
 *
 * Local ignored .env files are allowed to exist on the developer's
 * machine. They must not be tracked or committed to the repository.
 */
let trackedFiles = [];
let gitAvailable = true;

try {
  trackedFiles = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  )
    .split(/\r?\n/)
    .filter(Boolean);
} catch {
  gitAvailable = false;
}

check(gitAvailable, "Git is available to verify repository environment files.");

const trackedEnvFiles = trackedFiles.filter((file) => {
  const normalizedPath = file.replace(/\\/g, "/");
  const name = normalizedPath.split("/").pop() ?? "";

  return /^\.env(?:$|\.)/.test(name) && name !== ".env.example";
});

check(
  trackedEnvFiles.length === 0,
  trackedEnvFiles.length === 0
    ? "No real environment files are tracked by Git."
    : `Real environment files are tracked by Git: ${trackedEnvFiles.join(", ")}`,
);

// 8. Report results.
for (const message of passes) {
  console.log(`PASS  ${message}`);
}

for (const message of failures) {
  console.error(`FAIL  ${message}`);
}

console.log(
  `\nRelease source audit: ${passes.length} passed, ${failures.length} failed.`,
);

if (failures.length > 0) {
  process.exitCode = 1;
}
