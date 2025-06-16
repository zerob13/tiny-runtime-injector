# Tiny Runtime Injector

一个帮助您为项目下载完整、轻量级运行时环境的库。它支持多种现代运行时，包括 Node.js、Bun 和 uv，非常适合在构建 Electron 等应用程序时包含轻量级运行时。

## 特性

- 🚀 支持多种运行时：Node.js、Bun、uv
- 📦 自动下载和配置最新版本
- 🎯 跨平台支持 (Windows, macOS, Linux)
- 🔧 可配置的清理选项（Node.js）
- 💻 命令行界面和编程 API
- 📝 TypeScript 支持

## 支持的运行时

| 运行时      | 描述                             | 默认版本 |
| ----------- | -------------------------------- | -------- |
| **Node.js** | JavaScript 运行时环境            | v22.9.0  |
| **Bun**     | 快速的 JavaScript 运行时和工具包 | v1.2.16  |
| **uv**      | Python 包管理器和解释器管理工具  | 0.7.13   |

## 安装

```bash
npm install tiny-runtime-injector
```

## 使用方法

### 命令行界面

```bash
# 安装 Node.js
tiny-runtime-injector --type node --version v22.9.0 --dir ./runtime/node

# 安装 Bun
tiny-runtime-injector --type bun --version v1.2.16 --dir ./runtime/bun

# 安装 uv
tiny-runtime-injector --type uv --version 0.7.13 --dir ./runtime/uv

# 查看所有选项
tiny-runtime-injector --help
```

### 编程 API

```javascript
import { RuntimeInjector } from "tiny-runtime-injector";

// 安装 Node.js
const nodeInjector = new RuntimeInjector({
  type: "node",
  version: "v22.9.0",
  targetDir: "./runtime/node",
  cleanup: true,
});
await nodeInjector.inject();

// 安装 Bun
const bunInjector = new RuntimeInjector({
  type: "bun",
  version: "v1.2.16",
  targetDir: "./runtime/bun",
});
await bunInjector.inject();

// 安装 uv
const uvInjector = new RuntimeInjector({
  type: "uv",
  version: "0.7.13",
  targetDir: "./runtime/uv",
});
await uvInjector.inject();
```

## 配置选项

### RuntimeOptions

```typescript
interface RuntimeOptions {
  type?: "node" | "bun" | "uv"; // 运行时类型
  version?: string; // 版本号
  platform?: string; // 目标平台
  arch?: string; // 目标架构
  targetDir: string; // 安装目录
  cleanup?: boolean | CleanupConfig; // 清理配置（仅 Node.js）
}
```

### 清理配置（仅 Node.js）

```typescript
interface CleanupConfig {
  removeDocs?: boolean; // 移除文档文件
  removeDevFiles?: boolean; // 移除开发文件
  removeSourceMaps?: boolean; // 移除源码映射
  customRules?: CleanupRule[]; // 自定义规则
}
```

## 使用示例

### 在 Electron 项目中使用

```javascript
import { RuntimeInjector } from "tiny-runtime-injector";
import path from "path";

async function setupRuntimes() {
  const runtimeDir = path.join(__dirname, "resources", "runtimes");

  // 设置 Node.js 用于后端处理
  const nodeInjector = new RuntimeInjector({
    type: "node",
    version: "v22.9.0",
    targetDir: path.join(runtimeDir, "node"),
    cleanup: {
      removeDocs: true,
      removeDevFiles: true,
      removeSourceMaps: true,
    },
  });

  // 设置 Bun 用于快速脚本执行
  const bunInjector = new RuntimeInjector({
    type: "bun",
    version: "v1.2.16",
    targetDir: path.join(runtimeDir, "bun"),
  });

  // 设置 uv 用于 Python 包管理
  const uvInjector = new RuntimeInjector({
    type: "uv",
    version: "0.7.13",
    targetDir: path.join(runtimeDir, "uv"),
  });

  await Promise.all([
    nodeInjector.inject(),
    bunInjector.inject(),
    uvInjector.inject(),
  ]);

  console.log("所有运行时设置完成！");
}

setupRuntimes().catch(console.error);
```

### 配置文件支持

创建 `runtime-config.json`：

```json
{
  "type": "node",
  "version": "v22.9.0",
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
  }
}
```

使用配置文件：

```bash
tiny-runtime-injector --config runtime-config.json
```

## 平台支持

### Node.js

- ✅ Windows (x64, x86, ARM64)
- ✅ macOS (x64, ARM64)
- ✅ Linux (x64, ARM64, ARMv7, PPC64LE, s390x)

### Bun

- ✅ Windows (x64, ARM64)
- ✅ macOS (x64, ARM64)
- ✅ Linux (x64, ARM64)

### uv

- ✅ Windows (x64, ARM64)
- ✅ macOS (x64, ARM64)
- ✅ Linux (x64, ARM64)

## 运行时特定说明

### Node.js

- 包含完整的 Node.js 运行时和 npm
- 支持清理选项以减少文件大小
- 可执行文件：`node.exe` (Windows) 或 `bin/node` (Unix)

### Bun

- 单个可执行文件，包含运行时和包管理器
- 无需额外清理，已经很轻量
- 可执行文件：`bun.exe` (Windows) 或 `bun` (Unix)

### uv

- 包含 `uv` 和 `uvx` 两个可执行文件
- `uv`：Python 包管理器
- `uvx`：工具执行器
- 可执行文件：`uv.exe`/`uvx.exe` (Windows) 或 `uv`/`uvx` (Unix)

## API 参考

### RuntimeInjector 类

#### 构造函数

```typescript
constructor(options: RuntimeOptions)
```

#### 方法

```typescript
async inject(): Promise<void>
```

下载并设置指定的运行时环境。

## 故障排除

### 常见问题

1. **下载失败**

   - 检查网络连接
   - 验证版本号是否正确
   - 确保目标目录有写入权限

2. **可执行文件无法运行**

   - 在 Unix 系统上，检查文件权限（应该是 755）
   - 验证架构兼容性

3. **版本不匹配**
   - 使用正确的版本格式：
     - Node.js: `v22.9.0`
     - Bun: `v1.2.16`
     - uv: `0.7.13`

## 贡献

欢迎贡献！请查看我们的贡献指南。

## 许可证

MIT

## 更新日志

### v1.0.0

- ✨ 添加对 Bun 和 uv 的支持
- 🔧 重构为支持多运行时架构
- 📝 更新文档和示例
- 🐛 修复跨平台兼容性问题
