# tiny-runtime-injector

这是一个帮助下载完整、小型运行时的库，比如 Node.js。它在构建 Electron 等应用程序时特别有用，可以帮助包含一个最小化的运行时。

[English Documentation](README.md)

## 功能特点

- 下载指定版本的 Node.js 运行时
- 支持多平台（Windows、macOS、Linux）
- 支持多架构（x64、arm64、armv7l 等）
- 自动清理不必要的文件（文档、开发文件等）
- 可配置的清理规则
- 支持通过 JSON 配置文件指定规则

## 安装

```bash
npm install tiny-runtime-injector
```

## 使用方法

### 作为库使用

```typescript
import { RuntimeInjector } from 'tiny-runtime-injector';

const injector = new RuntimeInjector({
  version: 'v22.9.0',  // 可选，默认为 v22.9.0
  targetDir: './runtime/node'  // 必需，指定目标目录
});

await injector.inject();
```

### 作为命令行工具使用

```bash
# 全局安装
npm install -g tiny-runtime-injector

# 或使用 npx
npx tiny-runtime-injector
```

### 命令行选项

```bash
tiny-runtime-injector [选项]

选项：
  -v, --version <版本>          Node.js 版本 (默认: "v22.9.0")
  -d, --dir <目录>            目标目录 (默认: "./runtime/node")
  -p, --platform <平台>       目标平台
  -a, --arch <架构>           目标架构
  -c, --config <配置>         配置文件路径
  --no-cleanup                禁用清理功能
  --no-docs                   保留文档文件
  --no-dev                    保留开发文件
  --no-sourcemaps             保留源码映射文件
  --custom-rules <规则>       自定义清理规则 (JSON 字符串)
  -h, --help                  显示帮助信息
  -V, --version               显示版本号
```

### 配置文件

你也可以使用 JSON 配置文件：

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
        "description": "移除所有文本文件"
      }
    ]
  }
}
```

然后通过命令行使用：

```bash
tiny-runtime-injector --config config.json
```

## 配置选项

### RuntimeOptions

| 选项      | 类型                     | 默认值           | 描述             |
| --------- | ------------------------ | ---------------- | ---------------- |
| version   | string                   | 'v22.9.0'        | Node.js 版本     |
| platform  | string                   | process.platform | 目标平台         |
| arch      | string                   | process.arch     | 目标架构         |
| targetDir | string                   | -                | 目标目录（必需） |
| cleanup   | boolean \| CleanupConfig | true             | 清理配置         |

### CleanupConfig

| 选项             | 类型          | 默认值 | 描述                 |
| ---------------- | ------------- | ------ | -------------------- |
| removeDocs       | boolean       | true   | 是否移除文档文件     |
| removeDevFiles   | boolean       | true   | 是否移除开发相关文件 |
| removeSourceMaps | boolean       | true   | 是否移除源码映射文件 |
| customRules      | CleanupRule[] | []     | 自定义清理规则       |

### CleanupRule

| 选项        | 类型   | 描述             |
| ----------- | ------ | ---------------- |
| pattern     | string | glob 模式        |
| description | string | 规则描述（可选） |

## 许可证

MIT 
