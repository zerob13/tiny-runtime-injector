# tiny-runtime-injector

A library that helps you download complete, small runtimes like Node.js. It's particularly useful for including a minimal runtime when building applications like Electron.

[中文文档](README.zh.md)

## Features

- Download Node.js runtime of specified version
- Multi-platform support (Windows, macOS, Linux)
- Multi-architecture support (x64, arm64, armv7l, etc.)
- Automatic cleanup of unnecessary files (docs, dev files, etc.)
- Configurable cleanup rules
- Support for JSON configuration files

## Installation

```bash
npm install tiny-runtime-injector
```

## Usage

### As a Library

```typescript
import { RuntimeInjector } from 'tiny-runtime-injector';

const injector = new RuntimeInjector({
  version: 'v22.9.0',  // Optional, defaults to v22.9.0
  targetDir: './runtime/node'  // Required, specify target directory
});

await injector.inject();
```

### As a CLI Tool

```bash
# Install globally
npm install -g tiny-runtime-injector

# Or use npx
npx tiny-runtime-injector
```

### CLI Options

```bash
tiny-runtime-injector [options]

Options:
  -v, --version <version>        Node.js version (default: "v22.9.0")
  -d, --dir <directory>         Target directory (default: "./runtime/node")
  -p, --platform <platform>     Target platform
  -a, --arch <architecture>     Target architecture
  -c, --config <config>         Path to configuration file
  --no-cleanup                  Disable cleanup
  --no-docs                     Keep documentation files
  --no-dev                      Keep development files
  --no-sourcemaps               Keep source map files
  --custom-rules <rules>        Custom cleanup rules (JSON string)
  -h, --help                    Display help information
  -V, --version                 Display version number
```

### Configuration File

You can also use a JSON configuration file:

```json
{
  "version": "v22.9.0",
  "targetDir": "./runtime/node",
  "platform": "linux",
  "arch": "arm64",
  "cleanup": {
    "removeDocs": true,
    "removeDevFiles": true,
    "removeSourceMaps": true,
    "customRules": [
      {
        "pattern": "**/*.txt",
        "description": "Remove all text files"
      }
    ]
  }
}
```

Then use it with the CLI:

```bash
tiny-runtime-injector --config config.json
```

## Configuration Options

### RuntimeOptions

| Option    | Type                     | Default          | Description                 |
| --------- | ------------------------ | ---------------- | --------------------------- |
| version   | string                   | 'v22.9.0'        | Node.js version             |
| platform  | string                   | process.platform | Target platform             |
| arch      | string                   | process.arch     | Target architecture         |
| targetDir | string                   | -                | Target directory (required) |
| cleanup   | boolean \| CleanupConfig | true             | Cleanup configuration       |

### CleanupConfig

| Option           | Type          | Default | Description                |
| ---------------- | ------------- | ------- | -------------------------- |
| removeDocs       | boolean       | true    | Remove documentation files |
| removeDevFiles   | boolean       | true    | Remove development files   |
| removeSourceMaps | boolean       | true    | Remove source map files    |
| customRules      | CleanupRule[] | []      | Custom cleanup rules       |

### CleanupRule

| Option      | Type   | Description                 |
| ----------- | ------ | --------------------------- |
| pattern     | string | glob pattern                |
| description | string | Rule description (optional) |

## License

MIT
