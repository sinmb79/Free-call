import { execFile, spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const currentDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(currentDir, "../../../../");
const runtimeDir = resolve(projectRoot, "output/runtime");
const processFile = resolve(runtimeDir, "processes.json");
const stopScriptPath = resolve(projectRoot, "scripts/dev-stop.ps1");
const childPidFile = resolve(runtimeDir, "dev-stop-child-pid.txt");
const cleanScriptPath = resolve(projectRoot, "scripts/dev-clean.ps1");

const parameterizedScripts = [
  "scripts/dev-stack-up.ps1",
  "scripts/dev-start-apps.ps1",
  "scripts/dev-smoke.ps1",
  "scripts/dev-clean.ps1"
];

async function stopRuntimeProcesses() {
  try {
    await execFileAsync(
      "powershell",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        stopScriptPath
      ],
      {
        cwd: projectRoot
      }
    );
  } catch {
    // Best-effort cleanup for tests that intentionally break startup.
  }
}

async function waitForFileText(path: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      return await readFile(path, "utf8");
    } catch {
      await new Promise((resolvePromise) => {
        setTimeout(resolvePromise, 100);
      });
    }
  }

  throw new Error(`Timed out waiting for ${path}`);
}

afterEach(async () => {
  await stopRuntimeProcesses();
  await rm(processFile, {
    force: true
  });
  await rm(childPidFile, {
    force: true
  });
});

describe("PowerShell helper scripts", () => {
  it.each(parameterizedScripts)(
    "parses without syntax errors for %s",
    async (relativeScriptPath) => {
      const scriptPath = resolve(projectRoot, relativeScriptPath);

      const result = await execFileAsync(
        "powershell",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          "& { " +
            "$tokens = $null; " +
            "$errors = $null; " +
            "[System.Management.Automation.Language.Parser]::ParseFile('" +
            scriptPath.replace(/'/g, "''") +
            "', [ref]$tokens, [ref]$errors) | Out-Null; " +
            "if ($errors.Count -gt 0) { " +
            "$errors | ForEach-Object { $_.Message }; " +
            "exit 1 " +
            "} " +
          "}"
        ],
        {
          cwd: projectRoot
        }
      );

      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      expect(combinedOutput.trim()).toBe("");
    }
  );

  it(
    "fails early when required local services are unavailable",
    async () => {
      const scriptPath = resolve(projectRoot, "scripts/dev-start-apps.ps1");

      await expect(
        execFileAsync(
          "powershell",
          [
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            scriptPath,
            "-DatabasePort",
            "39005",
            "-RedisPort",
            "39006",
            "-SkipReadinessCheck",
            "-ApiCommand",
            "Start-Sleep -Seconds 5",
            "-CustomerCommand",
            "Start-Sleep -Seconds 5",
            "-WorkerCommand",
            "Start-Sleep -Seconds 5",
            "-AdminCommand",
            "Start-Sleep -Seconds 5"
          ],
          {
            cwd: projectRoot
          }
        )
      ).rejects.toThrow(/pnpm dev:stack/i);
    },
    30_000
  );

  it(
    "fails when readiness endpoints never become healthy",
    async () => {
      const scriptPath = resolve(projectRoot, "scripts/dev-start-apps.ps1");

      await expect(
        execFileAsync(
          "powershell",
          [
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            scriptPath,
            "-ApiBaseUrl",
            "http://localhost:39001",
            "-CustomerAppUrl",
            "http://localhost:39002",
            "-WorkerAppUrl",
            "http://localhost:39003",
            "-AdminAppUrl",
            "http://localhost:39004",
            "-ReadinessTimeoutSeconds",
            "2",
            "-ApiCommand",
            "Start-Sleep -Seconds 5",
            "-CustomerCommand",
            "Start-Sleep -Seconds 5",
            "-WorkerCommand",
            "Start-Sleep -Seconds 5",
            "-AdminCommand",
            "Start-Sleep -Seconds 5",
            "-SkipDependencyCheck"
          ],
          {
            cwd: projectRoot
          }
        )
      ).rejects.toThrow(/did not become ready/i);

      await expect(stat(processFile)).rejects.toThrow();
    },
    30_000
  );

  it(
    "writes runtime metadata for long-running custom commands",
    async () => {
      const scriptPath = resolve(projectRoot, "scripts/dev-start-apps.ps1");

      const result = await execFileAsync(
        "powershell",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          scriptPath,
          "-SkipReadinessCheck",
          "-StartupGraceSeconds",
          "1",
          "-ApiCommand",
          "Start-Sleep -Seconds 5",
          "-CustomerCommand",
          "Start-Sleep -Seconds 5",
          "-WorkerCommand",
          "Start-Sleep -Seconds 5",
          "-AdminCommand",
          "Start-Sleep -Seconds 5",
          "-SkipDependencyCheck"
        ],
        {
          cwd: projectRoot
        }
      );

      expect(result.stdout).toContain("IwootCall app processes started.");

      const processMetadata = JSON.parse(await readFile(processFile, "utf8")) as Array<{
        name: string;
      }>;

      expect(processMetadata.map((entry) => entry.name)).toEqual([
        "api",
        "customer-app",
        "worker-app",
        "admin-panel"
      ]);
    },
    30_000
  );

  it(
    "dev-stop terminates a recorded process tree",
    async () => {
      const parent = spawn(
        "powershell",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          [
            "$child = Start-Process powershell -ArgumentList '-NoProfile','-Command','Start-Sleep -Seconds 30' -PassThru -WindowStyle Hidden;",
            `Set-Content -Path '${childPidFile.replace(/'/g, "''")}' -Value $child.Id -Encoding ASCII;`,
            "Start-Sleep -Seconds 30"
          ].join(" ")
        ],
        {
          cwd: projectRoot,
          stdio: "ignore",
          windowsHide: true
        }
      );

      const childPid = Number((await waitForFileText(childPidFile, 10_000)).trim());

      await writeFile(
        processFile,
        JSON.stringify([
          {
            name: "tree-test",
            pid: parent.pid,
            stdout: "",
            stderr: ""
          }
        ]),
        "ascii"
      );

      await execFileAsync(
        "powershell",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          stopScriptPath
        ],
        {
          cwd: projectRoot
        }
      );

      const probe = await execFileAsync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `@(Get-Process -Id ${parent.pid},${childPid} -ErrorAction SilentlyContinue).Count`
        ],
        {
          cwd: projectRoot
        }
      );

      expect(probe.stdout.trim()).toBe("0");
    },
    30_000
  );

  it(
    "dev-clean removes local generated outputs but keeps source files",
    async () => {
      const fixtureRoot = await mkdtemp(resolve(tmpdir(), "iwootcall-clean-"));
      const runtimeOutput = resolve(fixtureRoot, "output/runtime/trace.log");
      const turboLog = resolve(fixtureRoot, ".turbo/cache.log");
      const nextBuild = resolve(fixtureRoot, "apps/customer-app/.next/dev/server.log");
      const distFile = resolve(fixtureRoot, "packages/shared/dist/index.js");
      const sourceFile = resolve(fixtureRoot, "apps/customer-app/src/keep.txt");

      await mkdir(resolve(runtimeOutput, ".."), { recursive: true });
      await mkdir(resolve(turboLog, ".."), { recursive: true });
      await mkdir(resolve(nextBuild, ".."), { recursive: true });
      await mkdir(resolve(distFile, ".."), { recursive: true });
      await mkdir(resolve(sourceFile, ".."), { recursive: true });

      await writeFile(runtimeOutput, "runtime log", "utf8");
      await writeFile(turboLog, "turbo log", "utf8");
      await writeFile(nextBuild, "next build", "utf8");
      await writeFile(distFile, "compiled output", "utf8");
      await writeFile(sourceFile, "keep me", "utf8");

      await execFileAsync(
        "powershell",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          cleanScriptPath,
          "-ProjectRoot",
          fixtureRoot
        ],
        {
          cwd: projectRoot
        }
      );

      await expect(stat(resolve(fixtureRoot, "output/runtime"))).rejects.toThrow();
      await expect(stat(resolve(fixtureRoot, ".turbo"))).rejects.toThrow();
      await expect(stat(resolve(fixtureRoot, "apps/customer-app/.next"))).rejects.toThrow();
      await expect(stat(resolve(fixtureRoot, "packages/shared/dist"))).rejects.toThrow();
      await expect(readFile(sourceFile, "utf8")).resolves.toBe("keep me");

      await rm(fixtureRoot, {
        recursive: true,
        force: true
      });
    },
    30_000
  );
});
