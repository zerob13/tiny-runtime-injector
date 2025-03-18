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
} from "./types.js";
import { glob } from "glob";

const execAsync = promisify(exec);

const DEFAULT_NODE_VERSION = "v22.9.0";

export class RuntimeInjector {
  private options: RuntimeOptions;
  private runtimeInfo: RuntimeInfo;

  constructor(options: RuntimeOptions) {
    this.options = {
      version: options.version || DEFAULT_NODE_VERSION,
      platform: options.platform || process.platform,
      arch: options.arch || process.arch,
      targetDir: options.targetDir,
      cleanup: options.cleanup ?? true,
    };

    this.runtimeInfo = {
      version: this.options.version!,
      platform: this.options.platform!,
      arch: this.options.arch!,
      targetDir: this.options.targetDir,
      nodePath: path.join(
        this.options.targetDir,
        this.options.platform === "win32" ? "node.exe" : "bin/node"
      ),
    };
  }

  private getPlatformIdentifier(platform: string, arch: string): string {
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

  private async isAlreadyInstalled(): Promise<boolean> {
    try {
      const markerFile = path.join(
        this.runtimeInfo.targetDir,
        `${this.runtimeInfo.platform}_${this.runtimeInfo.arch}`
      );

      if (await fs.pathExists(markerFile)) {
        const installedVersion = await fs.readFile(markerFile, "utf8");

        if (installedVersion.trim() === this.runtimeInfo.version) {
          if (await fs.pathExists(this.runtimeInfo.nodePath)) {
            try {
              const nodePath = this.runtimeInfo.nodePath.replace(
                /(\s+)/g,
                "\\$1"
              );
              const { stdout } = await execAsync(`"${nodePath}" -v`);
              return stdout.trim() === this.runtimeInfo.version;
            } catch (err: unknown) {
              if (err instanceof Error) {
                console.log(
                  `Node.js execution test failed, will redownload: ${err.message}`
                );
              } else {
                console.log("Node.js execution test failed, will redownload");
              }
            }
          }
        }
      }
      return false;
    } catch (error) {
      console.error("Failed to check Node.js installation:", error);
      return false;
    }
  }

  private async downloadFile(url: string, destination: string): Promise<void> {
    console.log(`Downloading: ${url}`);
    await fs.ensureDir(path.dirname(destination));

    const writer = createWriteStream(destination);
    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
    });

    await pipeline(response.data, writer);
    console.log(`File downloaded to: ${destination}`);
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
    const {
      removeDocs = true,
      removeDevFiles = true,
      removeSourceMaps = true,
      customRules = [],
    } = cleanupConfig;

    const patterns = [
      ...(removeDocs ? ["**/*.md", "**/docs/**", "**/doc/**"] : []),
      ...(removeDevFiles ? ["**/*.h", "**/*.cc", "**/*.cpp", "**/*.c"] : []),
      ...(removeSourceMaps ? ["**/*.map"] : []),
      ...customRules.map((rule: CleanupRule) => rule.pattern),
    ];

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: this.runtimeInfo.targetDir,
      });
      for (const file of files) {
        await fs.remove(path.join(this.runtimeInfo.targetDir, file));
      }
    }
  }

  public async inject(): Promise<void> {
    try {
      console.log(
        `Checking Node.js ${this.runtimeInfo.version} for ${this.runtimeInfo.platform}-${this.runtimeInfo.arch}`
      );

      await fs.ensureDir(this.runtimeInfo.targetDir);

      if (await this.isAlreadyInstalled()) {
        console.log("Node.js already installed, skipping download");
        return;
      }

      const platformId = this.getPlatformIdentifier(
        this.runtimeInfo.platform,
        this.runtimeInfo.arch
      );
      const fileExtension =
        this.runtimeInfo.platform === "win32" ? "zip" : "tar.gz";
      const fileName = `node-${this.runtimeInfo.version}-${platformId}.${fileExtension}`;
      const downloadUrl = `https://nodejs.org/dist/${this.runtimeInfo.version}/${fileName}`;

      const tempDir = path.join(os.tmpdir(), "tiny-runtime-injector-temp");
      const downloadPath = path.join(tempDir, fileName);
      await fs.ensureDir(tempDir);

      await this.downloadFile(downloadUrl, downloadPath);
      await fs.emptyDir(this.runtimeInfo.targetDir);

      const extractedDir = path.join(tempDir, "extracted");
      await fs.ensureDir(extractedDir);

      if (this.runtimeInfo.platform === "win32") {
        await this.extractZip(downloadPath, extractedDir);
      } else {
        await this.extractTarGz(downloadPath, extractedDir);
      }

      const nodeDirName = `node-${this.runtimeInfo.version}-${platformId}`;
      const extractedNodeDir = path.join(extractedDir, nodeDirName);

      const files = await fs.readdir(extractedNodeDir);
      for (const file of files) {
        const srcPath = path.join(extractedNodeDir, file);
        const destPath = path.join(this.runtimeInfo.targetDir, file);
        await fs.move(srcPath, destPath, { overwrite: true });
      }

      if (this.runtimeInfo.platform !== "win32") {
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

      const markerFile = path.join(
        this.runtimeInfo.targetDir,
        `${this.runtimeInfo.platform}_${this.runtimeInfo.arch}`
      );
      await fs.writeFile(markerFile, this.runtimeInfo.version);
      console.log(this.options.cleanup);
      if (this.options.cleanup) {
        const cleanupConfig =
          typeof this.options.cleanup === "boolean"
            ? { removeDocs: true, removeDevFiles: true, removeSourceMaps: true }
            : this.options.cleanup;
        await this.cleanupRuntime(cleanupConfig);
      }

      await fs.remove(tempDir);
      console.log(
        `Node.js ${this.runtimeInfo.version} successfully installed to ${this.runtimeInfo.targetDir}`
      );
    } catch (error) {
      console.error("Installation failed:", error);
      throw error;
    }
  }
}
