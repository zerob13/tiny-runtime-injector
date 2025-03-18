#!/usr/bin/env node

import { program } from "commander";
import { RuntimeInjector } from "./index.js";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

program
  .name("tiny-runtime-injector")
  .description("下载并配置最小化的 Node.js 运行时")
  .version("1.0.0")
  .option("-n, --node-version <version>", "Node.js 版本", "v22.9.0")
  .option("-d, --dir <directory>", "目标目录", "./runtime/node")
  .option("-p, --platform <platform>", "目标平台")
  .option("-a, --arch <architecture>", "目标架构")
  .option("-c, --config <config>", "配置文件路径")
  .option("--no-cleanup", "禁用清理功能")
  .option("--no-docs", "保留文档文件")
  .option("--no-dev", "保留开发文件")
  .option("--no-sourcemaps", "保留源码映射文件")
  .option("--custom-rules <rules>", "自定义清理规则 (JSON 字符串)")
  .parse();

const options = program.opts();

async function main() {
  try {
    let config = {};

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

    // 合并命令行参数和配置文件
    const runtimeOptions = {
      ...config,
      version: options.nodeVersion,
      targetDir: options.dir,
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
    };

    const injector = new RuntimeInjector(runtimeOptions);
    await injector.inject();
    console.log("安装完成！");
  } catch (error) {
    console.error("安装失败:", error);
    process.exit(1);
  }
}

// 直接执行主函数
main();
