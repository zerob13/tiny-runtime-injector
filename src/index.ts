import path from "path";
import fs from "fs-extra";
import os from "os";
import { promisify } from "util";
import { exec } from "child_process";
import axios from "axios";
import { createWriteStream } from "fs";
import { pipeline } from "node:stream/promises";
import * as tar from "tar";
import {
  RuntimeOptions,
  RuntimeInfo,
  CleanupConfig,
  CleanupRule,
  RuntimeType,
  RuntimeConfig,
} from "./types.js";
import { glob } from "glob";

const execAsync = promisify(exec);

// Platform configuration for ripgrep
const RIPGREP_PLATFORM: Record<string, { target: string; ext: "tar.gz" | "zip" }> = {
  "x64-win32": { target: "x86_64-pc-windows-msvc", ext: "zip" },
  "arm64-win32": { target: "aarch64-pc-windows-msvc", ext: "zip" },
  "x64-linux": { target: "x86_64-unknown-linux-musl", ext: "tar.gz" },
  "arm64-linux": { target: "aarch64-unknown-linux-gnu", ext: "tar.gz" },
  "x64-darwin": { target: "x86_64-apple-darwin", ext: "tar.gz" },
  "arm64-darwin": { target: "aarch64-apple-darwin", ext: "tar.gz" },
};

// Default versions for each runtime
const DEFAULT_VERSIONS = {
  node: "v24.12.0",
  bun: "v1.3.5",
  uv: "0.9.18",
  ripgrep: "14.1.1",
  python: "3.12.12+20251217",
};

// Runtime configurations
const RUNTIME_CONFIGS: Record<RuntimeType, RuntimeConfig> = {
  node: {
    defaultVersion: DEFAULT_VERSIONS.node,
    getDownloadUrl: (version: string, platform: string, arch: string) => {
      const platformId = getNodePlatformIdentifier(platform, arch);
      const fileExtension = platform === "win32" ? "zip" : "tar.gz";
      const fileName = `node-${version}-${platformId}.${fileExtension}`;
      return `https://nodejs.org/dist/${version}/${fileName}`;
    },
    getFileExtension: (platform: string, arch: string) =>
      platform === "win32" ? "zip" : "tar.gz",
    getExecutablePath: (targetDir: string, platform: string) =>
      path.join(targetDir, platform === "win32" ? "node.exe" : "bin/node"),
    extractFiles: async (
      extractedDir: string,
      targetDir: string,
      version: string,
      platform: string,
      arch: string
    ) => {
      const platformId = getNodePlatformIdentifier(platform, arch);
      const nodeDirName = `node-${version}-${platformId}`;
      const extractedNodeDir = path.join(extractedDir, nodeDirName);

      const files = await fs.readdir(extractedNodeDir);
      for (const file of files) {
        const srcPath = path.join(extractedNodeDir, file);
        const destPath = path.join(targetDir, file);
        await fs.move(srcPath, destPath, { overwrite: true });
      }
    },
  },
  bun: {
    defaultVersion: DEFAULT_VERSIONS.bun,
    getDownloadUrl: (version: string, platform: string, arch: string) => {
      const platformId = getBunPlatformIdentifier(platform, arch);
      const fileName = `bun-${platformId}.zip`;
      return `https://github.com/oven-sh/bun/releases/download/bun-${version}/${fileName}`;
    },
    getFileExtension: (platform: string, arch: string) => "zip",
    getExecutablePath: (targetDir: string, platform: string) =>
      path.join(targetDir, platform === "win32" ? "bun.exe" : "bun"),
    extractFiles: async (
      extractedDir: string,
      targetDir: string,
      version: string,
      platform: string,
      arch: string
    ) => {
      const platformId = getBunPlatformIdentifier(platform, arch);
      const bunDirName = `bun-${platformId}`;
      const extractedBunDir = path.join(extractedDir, bunDirName);

      // Check if bun directory exists, if not, look for the executable directly
      let bunExecutable: string;
      if (await fs.pathExists(extractedBunDir)) {
        bunExecutable = path.join(
          extractedBunDir,
          platform === "win32" ? "bun.exe" : "bun"
        );
      } else {
        // Look for bun executable in the root of extracted directory
        const files = await fs.readdir(extractedDir);
        const execName = platform === "win32" ? "bun.exe" : "bun";
        const foundExec = files.find((f) => f === execName);
        if (foundExec) {
          bunExecutable = path.join(extractedDir, foundExec);
        } else {
          throw new Error(`Could not find bun executable in extracted files`);
        }
      }

      const destPath = path.join(
        targetDir,
        platform === "win32" ? "bun.exe" : "bun"
      );
      await fs.move(bunExecutable, destPath, { overwrite: true });
    },
  },
  uv: {
    defaultVersion: DEFAULT_VERSIONS.uv,
    getDownloadUrl: (version: string, platform: string, arch: string) => {
      const platformId = getUvPlatformIdentifier(platform, arch);
      const fileExtension = platform === "win32" ? "zip" : "tar.gz";
      const fileName = `uv-${platformId}.${fileExtension}`;
      return `https://github.com/astral-sh/uv/releases/download/${version}/${fileName}`;
    },
    getFileExtension: (platform: string, arch: string) => platform === "win32" ? "zip" : "tar.gz",
    getExecutablePath: (targetDir: string, platform: string) =>
      path.join(targetDir, platform === "win32" ? "uv.exe" : "uv"),
    extractFiles: async (
      extractedDir: string,
      targetDir: string,
      version: string,
      platform: string,
      arch: string
    ) => {
      // uv archive contains executables in root or in a subdirectory
      const files = await fs.readdir(extractedDir);

      const execExtension = platform === "win32" ? ".exe" : "";
      const uvExec = `uv${execExtension}`;
      const uvxExec = `uvx${execExtension}`;

      // Look for executables
      const uvPath = files.includes(uvExec)
        ? path.join(extractedDir, uvExec)
        : path.join(extractedDir, files[0], uvExec); // might be in subdirectory

      const uvxPath = files.includes(uvxExec)
        ? path.join(extractedDir, uvxExec)
        : path.join(extractedDir, files[0], uvxExec); // might be in subdirectory

      // Copy both uv and uvx executables
      if (await fs.pathExists(uvPath)) {
        await fs.move(uvPath, path.join(targetDir, uvExec), {
          overwrite: true,
        });
      }
      if (await fs.pathExists(uvxPath)) {
        await fs.move(uvxPath, path.join(targetDir, uvxExec), {
          overwrite: true,
        });
      }
    },
  },
  ripgrep: {
    defaultVersion: DEFAULT_VERSIONS.ripgrep,
    getDownloadUrl: (version: string, platform: string, arch: string) => {
      const platformKey = `${arch}-${platform}`;
      const platformConfig = RIPGREP_PLATFORM[platformKey];

      if (!platformConfig) {
        throw new Error(`Unsupported platform for ripgrep: ${platform}-${arch}`);
      }

      const fileName = `ripgrep-${version}-${platformConfig.target}.${platformConfig.ext}`;
      return `https://github.com/BurntSushi/ripgrep/releases/download/${version}/${fileName}`;
    },
    getFileExtension: (platform: string, arch: string) => {
      const platformKey = `${arch}-${platform}`;
      const platformConfig = RIPGREP_PLATFORM[platformKey];

      if (!platformConfig) {
        throw new Error(`Unsupported platform for ripgrep: ${platform}-${arch}`);
      }

      return platformConfig.ext;
    },
    getExecutablePath: (targetDir: string, platform: string) =>
      path.join(targetDir, platform === "win32" ? "rg.exe" : "rg"),
    extractFiles: async (
      extractedDir: string,
      targetDir: string,
      version: string,
      platform: string,
      arch: string
    ) => {
      const execName = platform === "win32" ? "rg.exe" : "rg";
      const files = await fs.readdir(extractedDir);

      // Find rg executable - it could be in the root or in a subdirectory
      let rgPath: string | undefined;

      // First, try to find it in the root
      if (files.includes(execName)) {
        rgPath = path.join(extractedDir, execName);
      } else {
        // Search in subdirectories
        for (const file of files) {
          const filePath = path.join(extractedDir, file, execName);
          if (await fs.pathExists(filePath)) {
            rgPath = filePath;
            break;
          }
        }
      }

      if (!rgPath) {
        throw new Error(`Could not find ${execName} in extracted files`);
      }

      const destPath = path.join(targetDir, execName);
      await fs.move(rgPath, destPath, { overwrite: true });
    },
  },
  python: {
    defaultVersion: DEFAULT_VERSIONS.python,
    getDownloadUrl: (version: string, platform: string, arch: string) => {
      const platformTarget = getPythonPlatformIdentifier(platform, arch);
      const releaseDate = version.includes("+") ? version.split("+")[1] : "20250117";
      const pythonVersion = version.includes("+") ? version.split("+")[0] : version;
      const fileName = `cpython-${pythonVersion}+${releaseDate}-${platformTarget}-install_only.tar.gz`;
      return `https://github.com/astral-sh/python-build-standalone/releases/download/${releaseDate}/${fileName}`;
    },
    getFileExtension: (platform: string, arch: string) => "tar.gz",
    getExecutablePath: (targetDir: string, platform: string) =>
      path.join(targetDir, "bin", platform === "win32" ? "python.exe" : "python3"),
    extractFiles: async (
      extractedDir: string,
      targetDir: string,
      version: string,
      platform: string,
      arch: string
    ) => {
      const files = await fs.readdir(extractedDir);

      // Python standalone tarball extracts to a python directory
      const pythonDir = files.find((f) => f === "python");

      if (!pythonDir) {
        throw new Error(`Could not find python directory in extracted files`);
      }

      const extractedPythonDir = path.join(extractedDir, pythonDir);

      // Move all contents from python directory to target directory
      const pythonFiles = await fs.readdir(extractedPythonDir);
      for (const file of pythonFiles) {
        const srcPath = path.join(extractedPythonDir, file);
        const destPath = path.join(targetDir, file);
        await fs.move(srcPath, destPath, { overwrite: true });
      }
    },
  },
};

function getNodePlatformIdentifier(platform: string, arch: string): string {
  const archStr = String(arch);

  if (platform === "darwin") {
    return archStr === "arm64" ? "darwin-arm64" : "darwin-x64";
  } else if (platform === "linux") {
    if (archStr === "arm64") return "linux-arm64";
    if (archStr === "arm" || archStr === "armv7l") return "linux-armv7l";
    if (archStr === "ppc64" || archStr === "ppc64le") return "linux-ppc64le";
    if (archStr === "s390" || archStr === "s390x") return "linux-s390x";
    return "linux-x64";
  } else if (platform === "win32") {
    if (archStr === "arm64") return "win-arm64";
    if (archStr === "ia32" || archStr === "x86") return "win-x86";
    return "win-x64";
  }

  throw new Error(`Unsupported platform: ${platform}-${archStr}`);
}

function getBunPlatformIdentifier(platform: string, arch: string): string {
  // Bun uses platform-arch naming
  if (platform === "darwin") {
    return arch === "arm64" ? "darwin-aarch64" : "darwin-x64";
  } else if (platform === "linux") {
    return arch === "arm64" ? "linux-aarch64" : "linux-x64";
  } else if (platform === "win32") {
    return arch === "arm64" ? "windows-aarch64" : "windows-x64";
  }

  throw new Error(`Unsupported platform for Bun: ${platform}-${arch}`);
}

function getUvPlatformIdentifier(platform: string, arch: string): string {
  if (platform === "darwin") {
    return arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin";
  } else if (platform === "linux") {
    // Standard Linux builds
    if (arch === "arm64") return "aarch64-unknown-linux-gnu";
    if (arch === "x64" || arch === "x86_64") return "x86_64-unknown-linux-gnu";
    if (arch === "x86" || arch === "ia32") return "i686-unknown-linux-gnu";
    if (arch === "arm" || arch === "armv7l") return "armv7-unknown-linux-gnueabihf";
    if (arch === "ppc64") return "powerpc64-unknown-linux-gnu";
    if (arch === "ppc64le") return "powerpc64le-unknown-linux-gnu";
    if (arch === "s390x") return "s390x-unknown-linux-gnu";
    if (arch === "riscv64") return "riscv64gc-unknown-linux-gnu";
    
    // MUSL builds
    if (arch === "arm64-musl") return "aarch64-unknown-linux-musl";
    if (arch === "x64-musl" || arch === "x86_64-musl") return "x86_64-unknown-linux-musl";
    if (arch === "x86-musl" || arch === "ia32-musl") return "i686-unknown-linux-musl";
    if (arch === "arm-musl") return "arm-unknown-linux-musleabihf";
    if (arch === "armv7-musl") return "armv7-unknown-linux-musleabihf";
    
    // Default to standard x64 GNU build for unknown architectures
    return "x86_64-unknown-linux-gnu";
  } else if (platform === "win32") {
    if (arch === "arm64") return "aarch64-pc-windows-msvc";
    if (arch === "x86" || arch === "ia32") return "i686-pc-windows-msvc";
    return "x86_64-pc-windows-msvc";
  }

  throw new Error(`Unsupported platform for uv: ${platform}-${arch}`);
}

function getRipgrepPlatformIdentifier(platform: string, arch: string): string {
  const platformKey = `${arch}-${platform}`;

  if (platformKey in RIPGREP_PLATFORM) {
    return RIPGREP_PLATFORM[platformKey].target;
  }

  throw new Error(`Unsupported platform for ripgrep: ${platform}-${arch}`);
}

function getPythonPlatformIdentifier(platform: string, arch: string): string {
  const archStr = String(arch);

  if (platform === "darwin") {
    return archStr === "arm64"
      ? "aarch64-apple-darwin"
      : "x86_64-apple-darwin";
  } else if (platform === "linux") {
    // Linux only supports x64 and arm64 (as per requirements)
    if (archStr === "arm64") return "aarch64-unknown-linux-gnu";
    if (archStr === "x64" || archStr === "x86_64") return "x86_64-unknown-linux-gnu";

    // Other Linux architectures are not supported as per requirements
    throw new Error(
      `Unsupported platform for Python: ${platform}-${archStr}. Only x64 and arm64 are supported for Linux.`
    );
  } else if (platform === "win32") {
    // Windows only supports x64 (as per requirements)
    if (archStr === "x64" || archStr === "x86_64") return "x86_64-pc-windows-msvc";
    if (archStr === "arm64") return "aarch64-pc-windows-msvc";

    // Windows x86 is not supported by python-build-standalone
    throw new Error(
      `Unsupported platform for Python: ${platform}-${archStr}. Only x64 and arm64 are supported for Windows.`
    );
  }

  throw new Error(
    `Unsupported platform for Python: ${platform}-${archStr}`
  );
}

const PROXY_ENV_KEYS = {
  httpProxy: ["HTTP_PROXY", "http_proxy"],
  httpsProxy: ["HTTPS_PROXY", "https_proxy"],
  noProxy: ["NO_PROXY", "no_proxy"],
} as const;

type ProxyConfig = {
  protocol: string;
  host: string;
  port: number;
  auth?: {
    username: string;
    password: string;
  };
};

function getEnvValue(keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value) {
      return value;
    }
  }
  return undefined;
}

function normalizeProxyUrl(proxyUrl: string, fallbackProtocol: string): string {
  if (/^[a-z]+:\/\//i.test(proxyUrl)) {
    return proxyUrl;
  }
  const protocol = fallbackProtocol.endsWith(":")
    ? fallbackProtocol
    : `${fallbackProtocol}:`;
  return `${protocol}//${proxyUrl}`;
}

function getDefaultPort(protocol: string): number {
  return protocol === "https:" ? 443 : 80;
}

function parseNoProxyEntry(entry: string): { host: string; port?: string } {
  let value = entry.trim();
  if (!value) {
    return { host: "" };
  }

  if (value.includes("://")) {
    try {
      value = new URL(value).host;
    } catch {
      value = value.split("://")[1] || value;
    }
  }

  value = value.split("/")[0];

  if (value.startsWith("[") && value.includes("]")) {
    const endIndex = value.indexOf("]");
    const host = value.slice(1, endIndex);
    const portValue = value.slice(endIndex + 1);
    if (portValue.startsWith(":")) {
      return { host, port: portValue.slice(1) };
    }
    return { host };
  }

  const lastColon = value.lastIndexOf(":");
  if (lastColon > -1 && value.indexOf(":") === lastColon) {
    return {
      host: value.slice(0, lastColon),
      port: value.slice(lastColon + 1),
    };
  }

  return { host: value };
}

function isNoProxyMatch(targetUrl: URL, noProxy: string): boolean {
  const entries = noProxy
    .split(/[,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    return false;
  }

  if (entries.includes("*")) {
    return true;
  }

  const hostname = targetUrl.hostname.toLowerCase();
  const port = targetUrl.port || String(getDefaultPort(targetUrl.protocol));

  for (const entry of entries) {
    if (entry === "*") {
      return true;
    }

    const { host, port: entryPort } = parseNoProxyEntry(entry);
    if (!host) {
      continue;
    }

    if (entryPort && entryPort !== port) {
      continue;
    }

    const normalizedHost = host.toLowerCase();
    if (!normalizedHost) {
      continue;
    }

    if (!/^[.*]/.test(normalizedHost)) {
      if (hostname === normalizedHost) {
        return true;
      }
      continue;
    }

    const matchHost = normalizedHost.startsWith("*")
      ? normalizedHost.slice(1)
      : normalizedHost;
    if (hostname.endsWith(matchHost)) {
      return true;
    }
  }

  return false;
}

function buildProxyConfig(proxyUrl: string, fallbackProtocol: string): ProxyConfig {
  const normalizedUrl = normalizeProxyUrl(proxyUrl, fallbackProtocol);
  let parsed: URL;

  try {
    parsed = new URL(normalizedUrl);
  } catch {
    throw new Error(`Invalid proxy URL: ${proxyUrl}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported proxy protocol: ${parsed.protocol}`);
  }

  const port = parsed.port ? Number(parsed.port) : getDefaultPort(parsed.protocol);
  if (Number.isNaN(port)) {
    throw new Error(`Invalid proxy port in URL: ${proxyUrl}`);
  }

  const proxyConfig: ProxyConfig = {
    protocol: parsed.protocol,
    host: parsed.hostname,
    port,
  };

  if (parsed.username || parsed.password) {
    proxyConfig.auth = {
      username: parsed.username,
      password: parsed.password,
    };
  }

  return proxyConfig;
}

export class RuntimeInjector {
  private options: RuntimeOptions;
  private runtimeInfo: RuntimeInfo;
  private config: RuntimeConfig;

  constructor(options: RuntimeOptions) {
    const runtimeType = options.type || "node";
    this.config = RUNTIME_CONFIGS[runtimeType];

    this.options = {
      type: runtimeType,
      version: options.version || this.config.defaultVersion,
      platform: options.platform || process.platform,
      arch: options.arch || process.arch,
      targetDir: options.targetDir,
      cleanup: options.cleanup ?? true,
      httpProxy: options.httpProxy,
      httpsProxy: options.httpsProxy,
      noProxy: options.noProxy,
    };

    this.runtimeInfo = {
      type: this.options.type!,
      version: this.options.version!,
      platform: this.options.platform!,
      arch: this.options.arch!,
      targetDir: this.options.targetDir,
      executablePath: this.config.getExecutablePath(
        this.options.targetDir,
        this.options.platform!
      ),
    };
  }

  private async isAlreadyInstalled(): Promise<boolean> {
    try {
      const markerFile = path.join(
        this.runtimeInfo.targetDir,
        `${this.runtimeInfo.type}_${this.runtimeInfo.platform}_${this.runtimeInfo.arch}`
      );

      if (await fs.pathExists(markerFile)) {
        const installedVersion = await fs.readFile(markerFile, "utf8");

        if (installedVersion.trim() === this.runtimeInfo.version) {
          if (await fs.pathExists(this.runtimeInfo.executablePath)) {
            try {
              const execPath = this.runtimeInfo.executablePath.replace(
                /(\s+)/g,
                "\\$1"
              );

              let testCommand: string;
              switch (this.runtimeInfo.type) {
                case "node":
                  testCommand = `"${execPath}" -v`;
                  break;
                case "bun":
                  testCommand = `"${execPath}" --version`;
                  break;
                case "uv":
                  testCommand = `"${execPath}" --version`;
                  break;
                case "ripgrep":
                  testCommand = `"${execPath}" --version`;
                  break;
                case "python":
                  testCommand = `"${execPath}" --version`;
                  break;
                default:
                  throw new Error(
                    `Unknown runtime type: ${this.runtimeInfo.type}`
                  );
              }

              const { stdout } = await execAsync(testCommand);
              const actualVersion = stdout.trim();

              // For different runtimes, version formats may vary
              if (this.runtimeInfo.type === "node") {
                return actualVersion === this.runtimeInfo.version;
              } else if (this.runtimeInfo.type === "bun") {
                return actualVersion.includes(
                  this.runtimeInfo.version.replace("v", "")
                );
              } else if (this.runtimeInfo.type === "uv") {
                return actualVersion.includes(this.runtimeInfo.version);
              } else if (this.runtimeInfo.type === "ripgrep") {
                return actualVersion.includes(this.runtimeInfo.version);
              } else if (this.runtimeInfo.type === "python") {
                const pythonVersion = this.runtimeInfo.version.includes("+")
                  ? this.runtimeInfo.version.split("+")[0]
                  : this.runtimeInfo.version;
                return actualVersion.includes(pythonVersion);
              }

              return true;
            } catch (err: unknown) {
              if (err instanceof Error) {
                console.log(
                  `${this.runtimeInfo.type} execution test failed, will redownload: ${err.message}`
                );
              } else {
                console.log(
                  `${this.runtimeInfo.type} execution test failed, will redownload`
                );
              }
            }
          }
        }
      }
      return false;
    } catch (error) {
      console.error(
        `Failed to check ${this.runtimeInfo.type} installation:`,
        error
      );
      return false;
    }
  }

  private async downloadFile(url: string, destination: string): Promise<void> {
    console.log(`Downloading: ${url}`);
    await fs.ensureDir(path.dirname(destination));

    const writer = createWriteStream(destination);
    const proxyConfig = this.getProxyConfigForUrl(url);
    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
      proxy: proxyConfig ?? false,
    });

    await pipeline(response.data, writer);
    console.log(`File downloaded to: ${destination}`);
  }

  private getProxyConfigForUrl(url: string): ProxyConfig | undefined {
    const parsedUrl = new URL(url);
    const noProxy = this.getProxyOption("noProxy");

    if (noProxy && isNoProxyMatch(parsedUrl, noProxy)) {
      return undefined;
    }

    const proxyUrl =
      parsedUrl.protocol === "https:"
        ? this.getProxyOption("httpsProxy")
        : this.getProxyOption("httpProxy");

    if (!proxyUrl) {
      return undefined;
    }

    return buildProxyConfig(proxyUrl, parsedUrl.protocol);
  }

  private getProxyOption(
    key: "httpProxy" | "httpsProxy" | "noProxy"
  ): string | undefined {
    const directValue = this.options[key];
    if (directValue) {
      return directValue;
    }

    return getEnvValue(PROXY_ENV_KEYS[key]);
  }

  private async extractTarGz(
    filePath: string,
    destination: string
  ): Promise<void> {
    console.log(`Extracting: ${filePath}`);
    await fs.ensureDir(destination);
    await tar.extract({
      file: filePath,
      cwd: destination,
    });
    console.log(`Files extracted to: ${destination}`);
  }

  private async extractZip(
    filePath: string,
    destination: string
  ): Promise<void> {
    console.log(`Extracting: ${filePath}`);
    await fs.ensureDir(destination);

    try {
      if (process.platform === "win32") {
        await execAsync(
          `powershell -command "Expand-Archive -Path '${filePath}' -DestinationPath '${destination}' -Force"`
        );
      } else {
        await execAsync(`unzip -o "${filePath}" -d "${destination}"`);
      }
      console.log(`ZIP file extracted to: ${destination}`);
    } catch (error) {
      console.error("Extraction failed:", error);
      throw error;
    }
  }

  private async cleanupRuntime(cleanupConfig: CleanupConfig): Promise<void> {
    const targetDir = this.runtimeInfo.targetDir;

    if (
      this.runtimeInfo.platform === "darwin" ||
      this.runtimeInfo.platform === "linux"
    ) {
      console.log(
        "Cleaning up for macOS/Linux: Removing share and include directories."
      );
      const shareDir = path.join(targetDir, "share");
      const includeDir = path.join(targetDir, "include");

      try {
        if (await fs.pathExists(shareDir)) {
          await fs.remove(shareDir);
          console.log(`Removed directory: ${shareDir}`);
        }
        if (await fs.pathExists(includeDir)) {
          await fs.remove(includeDir);
          console.log(`Removed directory: ${includeDir}`);
        }
      } catch (error) {
        console.error(`Error during directory removal: ${error}`);
      }
    } else {
      const {
        removeDocs = true,
        removeDevFiles = true,
        removeSourceMaps = true,
        customRules = [],
      } = cleanupConfig;

      const patterns = [
        ...(removeDocs
          ? [
              "**/*.md",
              "**/docs/**",
              "**/doc/**",
              "share/doc/**",
              "share/man/**",
            ]
          : []),
        ...(removeDevFiles
          ? ["**/*.h", "**/*.cc", "**/*.cpp", "**/*.c", "include/**"]
          : []),
        ...(removeSourceMaps ? ["**/*.map"] : []),
        ...customRules.map((rule: CleanupRule) => rule.pattern),
      ];

      for (const pattern of patterns) {
        console.log(`Cleaning up based on pattern: ${pattern}`);
        try {
          const files = await glob(pattern, {
            cwd: targetDir,
            absolute: true,
            nodir: true,
          });
          console.log(
            `Found ${files.length} files/items for pattern ${pattern}`
          );
          for (const file of files) {
            if (await fs.pathExists(file)) {
              await fs.remove(file);
            }
          }
        } catch (error) {
          console.error(`Error cleaning up pattern ${pattern}: ${error}`);
        }
      }
    }
  }

  public async inject(): Promise<void> {
    try {
      console.log(
        `Checking ${this.runtimeInfo.type} ${this.runtimeInfo.version} for ${this.runtimeInfo.platform}-${this.runtimeInfo.arch}`
      );

      await fs.ensureDir(this.runtimeInfo.targetDir);

      if (await this.isAlreadyInstalled()) {
        console.log(
          `${this.runtimeInfo.type} already installed, skipping download`
        );
        return;
      }

      const downloadUrl = this.config.getDownloadUrl(
        this.runtimeInfo.version,
        this.runtimeInfo.platform,
        this.runtimeInfo.arch
      );

      const fileExtension = this.config.getFileExtension(
        this.runtimeInfo.platform,
        this.runtimeInfo.arch
      );
      const fileName = `${this.runtimeInfo.type}-${this.runtimeInfo.version}.${fileExtension}`;

      const tempDir = path.join(os.tmpdir(), "tiny-runtime-injector-temp");
      const downloadPath = path.join(tempDir, fileName);
      await fs.ensureDir(tempDir);

      await this.downloadFile(downloadUrl, downloadPath);
      await fs.emptyDir(this.runtimeInfo.targetDir);

      const extractedDir = path.join(tempDir, "extracted");
      await fs.ensureDir(extractedDir);

      if (fileExtension === "zip") {
        await this.extractZip(downloadPath, extractedDir);
      } else {
        await this.extractTarGz(downloadPath, extractedDir);
      }

      // Use runtime-specific extraction logic
      if (this.config.extractFiles) {
        await this.config.extractFiles(
          extractedDir,
          this.runtimeInfo.targetDir,
          this.runtimeInfo.version,
          this.runtimeInfo.platform,
          this.runtimeInfo.arch
        );
      }

      // Set executable permissions for non-Windows platforms
      if (this.runtimeInfo.platform !== "win32") {
        const execPath = this.runtimeInfo.executablePath;
        if (await fs.pathExists(execPath)) {
          await fs.chmod(execPath, 0o755);
        }

        // For uv, also set permissions for uvx
        if (this.runtimeInfo.type === "uv") {
          const uvxPath = path.join(this.runtimeInfo.targetDir, "uvx");
          if (await fs.pathExists(uvxPath)) {
            await fs.chmod(uvxPath, 0o755);
          }
        }

        // For Node.js, set permissions for all binaries
        if (this.runtimeInfo.type === "node") {
          const binDir = path.join(this.runtimeInfo.targetDir, "bin");
          if (await fs.pathExists(binDir)) {
            const binFiles = await fs.readdir(binDir);
            for (const file of binFiles) {
              const filePath = path.join(binDir, file);
              const stats = await fs.stat(filePath);
              if (stats.isFile()) {
                await fs.chmod(filePath, 0o755);
              }
            }
          }
        }

        // For Python, set permissions for all files in bin directory
        if (this.runtimeInfo.type === "python") {
          const binDir = path.join(this.runtimeInfo.targetDir, "bin");
          if (await fs.pathExists(binDir)) {
            const binFiles = await fs.readdir(binDir);
            for (const file of binFiles) {
              const filePath = path.join(binDir, file);
              const stats = await fs.stat(filePath);
              if (stats.isFile()) {
                await fs.chmod(filePath, 0o755);
              }
            }
          }
        }
      }

      const markerFile = path.join(
        this.runtimeInfo.targetDir,
        `${this.runtimeInfo.type}_${this.runtimeInfo.platform}_${this.runtimeInfo.arch}`
      );
      await fs.writeFile(markerFile, this.runtimeInfo.version);

      console.log(this.options.cleanup);
      if (this.options.cleanup && this.runtimeInfo.type === "node") {
        const cleanupConfig =
          typeof this.options.cleanup === "boolean"
            ? { removeDocs: true, removeDevFiles: true, removeSourceMaps: true }
            : this.options.cleanup;
        await this.cleanupRuntime(cleanupConfig);
      }

      await fs.remove(tempDir);
      console.log(
        `${this.runtimeInfo.type} ${this.runtimeInfo.version} successfully installed to ${this.runtimeInfo.targetDir}`
      );
    } catch (error) {
      console.error("Installation failed:", error);
      throw error;
    }
  }
}
