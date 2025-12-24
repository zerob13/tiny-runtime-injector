#!/usr/bin/env node

import { program } from "commander";
import { RuntimeInjector } from "./index.js";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { RuntimeType, RuntimeOptions } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

program
  .name("tiny-runtime-injector")
  .description("下载并配置最小化的运行时环境 (Node.js, Bun, uv, ripgrep)")
  .version("1.0.0")
  .option("-t, --type <type>", "运行时类型 (node, bun, uv, ripgrep)", "node")
  .option(
    "-r, --runtime-version <version>",
    "运行时版本 (例如: v24.12.0 for node, v1.3.5 for bun, 0.9.18 for uv)"
  )
  .option("-d, --dir <directory>", "目标目录", "./runtime")
  .option("-p, --platform <platform>", "目标平台")
  .option("-a, --arch <architecture>", "目标架构")
  .option("-c, --config <config>", "配置文件路径")
  .option("--no-cleanup", "禁用清理功能 (仅对 Node.js 有效)")
  .option("--no-docs", "保留文档文件 (仅对 Node.js 有效)")
  .option("--no-dev", "保留开发文件 (仅对 Node.js 有效)")
  .option("--no-sourcemaps", "保留源码映射文件 (仅对 Node.js 有效)")
  .option("--http-proxy <url>", "HTTP 代理 (同 HTTP_PROXY)")
  .option("--https-proxy <url>", "HTTPS 代理 (同 HTTPS_PROXY)")
  .option("--no-proxy <list>", "不走代理的主机列表 (同 NO_PROXY)")
  .option(
    "--custom-rules <rules>",
    "自定义清理规则 (JSON 字符串, 仅对 Node.js 有效)"
  )
  .parse();

const options = program.opts();

async function main() {
  try {
    let config = {};

    // Validate runtime type
    const validTypes: RuntimeType[] = ["node", "bun", "uv", "ripgrep"];
    if (!validTypes.includes(options.type as RuntimeType)) {
      console.error(
        `错误: 不支持的运行时类型 "${
          options.type
        }". 支持的类型: ${validTypes.join(", ")}`
      );
      process.exit(1);
    }

    // Set default directory based on runtime type
    const defaultDir =
      options.dir === "./runtime" ? `./runtime/${options.type}` : options.dir;

    // 如果指定了配置文件，则读取配置
    if (options.config) {
      const configPath = path.resolve(process.cwd(), options.config);
      if (await fs.pathExists(configPath)) {
        config = await fs.readJson(configPath);
      } else {
        console.error(`配置文件不存在: ${configPath}`);
        process.exit(1);
      }
    }

    // Display runtime-specific help
    if (options.type === "node") {
      console.log("正在安装 Node.js 运行时...");
      console.log("默认版本: v24.12.0");
      console.log("支持清理选项以减小运行时大小");
    } else if (options.type === "bun") {
      console.log("正在安装 Bun 运行时...");
      console.log("默认版本: v1.3.5");
      console.log("将安装单个 bun 可执行文件");
    } else if (options.type === "uv") {
      console.log("正在安装 uv 运行时...");
      console.log("默认版本: 0.9.18");
      console.log("将安装 uv 和 uvx 可执行文件");
    } else if (options.type === "ripgrep") {
      console.log("正在安装 ripgrep 运行时...");
      console.log("默认版本: 14.1.1");
      console.log("将安装单个 rg 可执行文件");
    }

    // 合并命令行参数和配置文件
    const runtimeOptions: RuntimeOptions = {
      ...config,
      type: options.type as RuntimeType,
      version: options.runtimeVersion,
      targetDir: defaultDir,
      platform: options.platform,
      arch: options.arch,
      cleanup: options.cleanup
        ? {
            removeDocs: options.docs,
            removeDevFiles: options.dev,
            removeSourceMaps: options.sourcemaps,
            customRules: options.customRules
              ? JSON.parse(options.customRules)
              : undefined,
          }
        : false,
    } as RuntimeOptions;

    if (options.httpProxy !== undefined) {
      runtimeOptions.httpProxy = options.httpProxy;
    }
    if (options.httpsProxy !== undefined) {
      runtimeOptions.httpsProxy = options.httpsProxy;
    }
    if (options.noProxy !== undefined) {
      runtimeOptions.noProxy = options.noProxy;
    }

    const injector = new RuntimeInjector(runtimeOptions);
    await injector.inject();
    console.log("安装完成！");

    // Display post-installation info
    if (options.type === "node") {
      console.log(
        `Node.js 可执行文件位置: ${path.join(
          defaultDir,
          process.platform === "win32" ? "node.exe" : "bin/node"
        )}`
      );
    } else if (options.type === "bun") {
      console.log(
        `Bun 可执行文件位置: ${path.join(
          defaultDir,
          process.platform === "win32" ? "bun.exe" : "bun"
        )}`
      );
    } else if (options.type === "uv") {
      console.log(
        `uv 可执行文件位置: ${path.join(
          defaultDir,
          process.platform === "win32" ? "uv.exe" : "uv"
        )}`
      );
      console.log(
        `uvx 可执行文件位置: ${path.join(
          defaultDir,
          process.platform === "win32" ? "uvx.exe" : "uvx"
        )}`
      );
    } else if (options.type === "ripgrep") {
      console.log(
        `ripgrep 可执行文件位置: ${path.join(
          defaultDir,
          process.platform === "win32" ? "rg.exe" : "rg"
        )}`
      );
    }
  } catch (error) {
    console.error("安装失败:", error);
    process.exit(1);
  }
}

// Add examples to help
program.on("--help", () => {
  console.log("");
  console.log("使用示例:");
  console.log(
    "  $ tiny-runtime-injector --type node --runtime-version v24.12.0 --dir ./runtime/node"
  );
  console.log(
    "  $ tiny-runtime-injector --type bun --runtime-version v1.3.5 --dir ./runtime/bun"
  );
  console.log(
    "  $ tiny-runtime-injector --type uv --runtime-version 0.9.18 --dir ./runtime/uv"
  );
  console.log(
    "  $ tiny-runtime-injector --type ripgrep --runtime-version 14.1.1 --dir ./runtime/ripgrep"
  );
  console.log("");
  console.log("支持的运行时:");
  console.log("  node     - Node.js JavaScript运行时");
  console.log("  bun      - Bun JavaScript运行时和工具包");
  console.log("  uv       - Python包管理器和解释器管理工具");
  console.log("  ripgrep  - 快速的文本搜索工具");
  console.log("");
});

// 直接执行主函数
main();
