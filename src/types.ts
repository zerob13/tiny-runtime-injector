export interface RuntimeOptions {
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
  version: string;
  platform: string;
  arch: string;
  targetDir: string;
  nodePath: string;
}
