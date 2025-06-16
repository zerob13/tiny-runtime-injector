export type RuntimeType = "node" | "bun" | "uv";

export interface RuntimeOptions {
  type?: RuntimeType;
  version?: string;
  platform?: string;
  arch?: string;
  targetDir: string;
  cleanup?: boolean | CleanupConfig;
}

export interface CleanupConfig {
  removeDocs?: boolean;
  removeDevFiles?: boolean;
  removeSourceMaps?: boolean;
  customRules?: CleanupRule[];
}

export interface CleanupRule {
  pattern: string;
  description?: string;
}

export interface RuntimeInfo {
  type: RuntimeType;
  version: string;
  platform: string;
  arch: string;
  targetDir: string;
  executablePath: string;
}

export interface RuntimeConfig {
  defaultVersion: string;
  getDownloadUrl: (version: string, platform: string, arch: string) => string;
  getFileExtension: (platform: string) => string;
  getExecutablePath: (targetDir: string, platform: string) => string;
  extractFiles?: (
    extractedDir: string,
    targetDir: string,
    version: string,
    platform: string,
    arch: string
  ) => Promise<void>;
}
