# Tiny Runtime Injector

A library that helps you download a complete, lightweight runtime environment for your project. It supports multiple modern runtimes, including Node.js, Bun, uv, ripgrep, Python, and rtk, making it ideal for bundling lightweight runtimes when building apps like Electron.

## Features

- 🚀 Supports multiple runtimes: Node.js, Bun, uv, ripgrep, Python, rtk
- 📦 Automatically downloads and configures the latest versions
- 🎯 Cross-platform support (Windows, macOS, Linux)
- 🔧 Configurable cleanup options (Node.js)
- 💻 CLI and programmatic API
- 📝 TypeScript support

## Supported Runtimes

| Runtime     | Description                                   | Default Version |
| ----------- | --------------------------------------------- | --------------- |
| **Node.js** | JavaScript runtime environment                | v24.12.0        |
| **Bun**     | Fast JavaScript runtime and toolkit           | v1.3.5          |
| **uv**      | Python package manager and interpreter manager | 0.9.18          |
| **ripgrep** | Fast text search tool (rg)                    | 14.1.1          |
| **Python**  | Python runtime environment                    | 3.12.8+20250117 |
| **rtk**     | rtk command line tool                         | latest release  |

## Installation

```bash
npm install tiny-runtime-injector
```

## Usage

### Command Line Interface

```bash
# Install Node.js
tiny-runtime-injector --type node --runtime-version v24.12.0 --dir ./runtime/node

# Install Bun
tiny-runtime-injector --type bun --runtime-version v1.3.5 --dir ./runtime/bun

# Install uv
tiny-runtime-injector --type uv --runtime-version 0.9.18 --dir ./runtime/uv

# Install ripgrep
tiny-runtime-injector --type ripgrep --runtime-version 14.1.1 --dir ./runtime/ripgrep

# Install Python
tiny-runtime-injector --type python --runtime-version 3.12.8+20250117 --dir ./runtime/python

# Install rtk (latest release)
tiny-runtime-injector --type rtk --dir ./runtime/rtk

# Install rtk (explicit version)
tiny-runtime-injector --type rtk --runtime-version v0.30.0 --dir ./runtime/rtk

# Show all options
tiny-runtime-injector --help
```

### Programmatic API

```javascript
import { RuntimeInjector } from "tiny-runtime-injector";

// Install Node.js
const nodeInjector = new RuntimeInjector({
  type: "node",
  version: "v24.12.0",
  targetDir: "./runtime/node",
  cleanup: true,
});
await nodeInjector.inject();

// Install Bun
const bunInjector = new RuntimeInjector({
  type: "bun",
  version: "v1.3.5",
  targetDir: "./runtime/bun",
});
await bunInjector.inject();

// Install uv
const uvInjector = new RuntimeInjector({
  type: "uv",
  version: "0.9.18",
  targetDir: "./runtime/uv",
});
await uvInjector.inject();

// Install ripgrep
const rgInjector = new RuntimeInjector({
  type: "ripgrep",
  version: "14.1.1",
  targetDir: "./runtime/ripgrep",
});
await rgInjector.inject();

// Install Python
const pythonInjector = new RuntimeInjector({
  type: "python",
  version: "3.12.8+20250117",
  targetDir: "./runtime/python",
});
await pythonInjector.inject();

// Install rtk (latest release)
const rtkInjector = new RuntimeInjector({
  type: "rtk",
  targetDir: "./runtime/rtk",
});
await rtkInjector.inject();
```

## Configuration Options

### RuntimeOptions

```typescript
interface RuntimeOptions {
  type?: "node" | "bun" | "uv" | "ripgrep" | "python" | "rtk"; // Runtime type
  version?: string; // Version
  platform?: string; // Target platform
  arch?: string; // Target architecture
  targetDir: string; // Install directory
  cleanup?: boolean | CleanupConfig; // Cleanup config (Node.js only)
  httpProxy?: string; // HTTP proxy (same as HTTP_PROXY)
  httpsProxy?: string; // HTTPS proxy (same as HTTPS_PROXY)
  noProxy?: string; // Hosts that bypass the proxy (same as NO_PROXY)
}
```

For `rtk`, omitting `version` defaults to the latest GitHub release. It also accepts `latest`, `0.30.0`, and `v0.30.0`.
For `rtk` latest lookups in CI, set `GITHUB_TOKEN` (preferred) or `GH_TOKEN` to avoid GitHub API rate limits.

### Cleanup Configuration (Node.js only)

```typescript
interface CleanupConfig {
  removeDocs?: boolean; // Remove documentation files
  removeDevFiles?: boolean; // Remove development files
  removeSourceMaps?: boolean; // Remove source maps
  customRules?: CleanupRule[]; // Custom rules
}
```

## Examples

### Using in an Electron Project

```javascript
import { RuntimeInjector } from "tiny-runtime-injector";
import path from "path";

async function setupRuntimes() {
  const runtimeDir = path.join(__dirname, "resources", "runtimes");

  // Set up Node.js for backend processing
  const nodeInjector = new RuntimeInjector({
    type: "node",
    version: "v24.12.0",
    targetDir: path.join(runtimeDir, "node"),
    cleanup: {
      removeDocs: true,
      removeDevFiles: true,
      removeSourceMaps: true,
    },
  });

  // Set up Bun for fast script execution
  const bunInjector = new RuntimeInjector({
    type: "bun",
    version: "v1.3.5",
    targetDir: path.join(runtimeDir, "bun"),
  });

  // Set up uv for Python package management
  const uvInjector = new RuntimeInjector({
    type: "uv",
    version: "0.9.18",
    targetDir: path.join(runtimeDir, "uv"),
  });

  const rgInjector = new RuntimeInjector({
    type: "ripgrep",
    version: "14.1.1",
    targetDir: path.join(runtimeDir, "ripgrep"),
  });

  const rtkInjector = new RuntimeInjector({
    type: "rtk",
    targetDir: path.join(runtimeDir, "rtk"),
  });

  await Promise.all([
    nodeInjector.inject(),
    bunInjector.inject(),
    uvInjector.inject(),
    rgInjector.inject(),
    rtkInjector.inject(),
  ]);

  console.log("All runtimes are ready!");
}

setupRuntimes().catch(console.error);
```

### Configuration File Support

Create `runtime-config.json`:

```json
{
  "type": "node",
  "version": "v24.12.0",
  "targetDir": "./runtime/node",
  "cleanup": {
    "removeDocs": true,
    "removeDevFiles": true,
    "removeSourceMaps": true,
    "customRules": [
      {
        "pattern": "**/*.test.js",
        "description": "Remove test files"
      }
    ]
  },
  "httpProxy": "http://127.0.0.1:7890",
  "httpsProxy": "http://127.0.0.1:7890",
  "noProxy": "localhost,127.0.0.1"
}
```

Use the config file:

```bash
tiny-runtime-injector --config runtime-config.json
```

## Proxy Settings

### Environment Variables

```bash
export HTTP_PROXY="http://127.0.0.1:7890"
export HTTPS_PROXY="http://127.0.0.1:7890"
export NO_PROXY="localhost,127.0.0.1"
```

### Command Line Arguments

```bash
tiny-runtime-injector --type node --http-proxy http://127.0.0.1:7890 --no-proxy "localhost,127.0.0.1"
```

## GitHub Authentication for rtk Latest

When `type` is `rtk` and `version` is omitted or set to `latest`, `tiny-runtime-injector` resolves the latest release through the GitHub Releases API. Anonymous requests can hit GitHub rate limits in shared CI environments.

Set `GITHUB_TOKEN` (preferred) or `GH_TOKEN` before running the installer:

```bash
export GITHUB_TOKEN="github_pat_xxx"
tiny-runtime-injector --type rtk --dir ./runtime/rtk
```

Example for GitHub Actions:

```yaml
- name: Install rtk runtime
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: npx tiny-runtime-injector --type rtk --dir ./runtime/rtk
```

If you prefer to avoid the latest release lookup entirely, pin the version explicitly:

```bash
tiny-runtime-injector --type rtk --runtime-version v0.30.0 --dir ./runtime/rtk
```

## Platform Support

### Node.js

- ✅ Windows (x64, x86, ARM64)
- ✅ macOS (x64, ARM64)
- ✅ Linux (x64, ARM64, ARMv7, PPC64LE, s390x)

### Bun

- ✅ Windows (x64, ARM64)
- ✅ macOS (x64, ARM64)
- ✅ Linux (x64, ARM64)

### uv

- ✅ Windows (x64, x86, ARM64)
- ✅ macOS (x64, ARM64)
- ✅ Linux (x64, x86, ARM64, ARMv7, PPC64, PPC64LE, s390x, RISCV64)
- ✅ Linux MUSL (x64, x86, ARM64, ARM, ARMv7)

### ripgrep

- ✅ Windows (x64, ARM64)
- ✅ macOS (x64, ARM64)
- ✅ Linux (x64, ARM64)

### Python

- ✅ Windows (x64, ARM64)
- ✅ macOS (x64, ARM64)
- ✅ Linux (x64, ARM64)
- ⚠️ Note: Only x64 and ARM64 are supported for Linux (other architectures not supported)
- ⚠️ Note: Windows x86 is not supported

### rtk

- ✅ Windows (x64)
- ✅ macOS (x64, ARM64)
- ✅ Linux (x64, ARM64)

## Runtime-Specific Notes

### Node.js

- Includes the full Node.js runtime and npm
- Supports cleanup options to reduce file size
- Executable: `node.exe` (Windows) or `bin/node` (Unix)

### Bun

- Single executable with runtime and package manager
- No extra cleanup required; already lightweight
- Executable: `bun.exe` (Windows) or `bun` (Unix)

### uv

- Includes `uv` and `uvx` executables
- `uv`: Python package manager
- `uvx`: tool runner
- Executable: `uv.exe`/`uvx.exe` (Windows) or `uv`/`uvx` (Unix)

### ripgrep

- Single executable for fast text search
- Executable: `rg.exe` (Windows) or `rg` (Unix)

### Python

- Self-contained Python runtime from python-build-standalone project
- Includes pip for package management
- Executable: `python.exe` (Windows) or `bin/python3` (Unix)
- Version format: `{python_version}+{release_date}`, e.g., `3.12.8+20250117`
⚠️ Note: Only x64 and ARM64 architectures are supported

### rtk

- Single executable command line tool
- Executable: `rtk.exe` (Windows) or `rtk` (Unix)
- Version accepts `latest`, `0.30.0`, or `v0.30.0`
- Omitting `version` resolves the latest GitHub release at install time
- `GITHUB_TOKEN` or `GH_TOKEN` can be used for authenticated latest release lookups in CI

## API Reference

### RuntimeInjector Class

#### Constructor

```typescript
constructor(options: RuntimeOptions)
```

#### Methods

```typescript
async inject(): Promise<void>
```

Downloads and sets up the specified runtime environment.

## Troubleshooting

### Common Issues

1. **Download failed**

   - Check network connectivity
   - Verify the version number is correct
   - Ensure the target directory is writable

2. **Executable won't run**

   - On Unix systems, check file permissions (should be 755)
   - Verify architecture compatibility

3. **Version mismatch**
   - Use the correct version formats:
    - Node.js: `v24.12.0`
    - Bun: `v1.3.5`
    - uv: `0.9.18`
    - ripgrep: `14.1.1`
    - Python: `3.12.8+20250117`
    - rtk: `latest`, `0.30.0`, or `v0.30.0`

## Contributing

Contributions are welcome! Please see our contribution guide.

## License

MIT

## Changelog

### v1.0.0

- ✨ Add support for Bun and uv
- 🔧 Refactor to support a multi-runtime architecture
- 📝 Update documentation and examples
- 🐛 Fix cross-platform compatibility issues
