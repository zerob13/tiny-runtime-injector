#!/usr/bin/env node

import { RuntimeInjector } from './dist/index.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configurations for different platforms and architectures
const testConfigs = [
  // Node.js configurations
  {
    type: 'node',
    platforms: [
      { platform: 'win32', arch: 'x64' },
      { platform: 'win32', arch: 'x86' },
      { platform: 'win32', arch: 'arm64' },
      { platform: 'darwin', arch: 'x64' },
      { platform: 'darwin', arch: 'arm64' },
      { platform: 'linux', arch: 'x64' },
      { platform: 'linux', arch: 'arm64' },
      { platform: 'linux', arch: 'armv7l' },
      { platform: 'linux', arch: 'ppc64le' },
      { platform: 'linux', arch: 's390x' },
    ]
  },
  // Bun configurations
  {
    type: 'bun',
    platforms: [
      { platform: 'win32', arch: 'x64' },
      { platform: 'darwin', arch: 'x64' },
      { platform: 'darwin', arch: 'arm64' },
      { platform: 'linux', arch: 'x64' },
      { platform: 'linux', arch: 'arm64' },
    ]
  },
  // uv configurations
  {
    type: 'uv',
    platforms: [
      { platform: 'win32', arch: 'x64' },
      { platform: 'win32', arch: 'x86' },
      { platform: 'win32', arch: 'arm64' },
      { platform: 'darwin', arch: 'x64' },
      { platform: 'darwin', arch: 'arm64' },
      { platform: 'linux', arch: 'x64' },
      { platform: 'linux', arch: 'x86' },
      { platform: 'linux', arch: 'arm64' },
      { platform: 'linux', arch: 'armv7l' },
      { platform: 'linux', arch: 'ppc64' },
      { platform: 'linux', arch: 'ppc64le' },
      { platform: 'linux', arch: 's390x' },
      { platform: 'linux', arch: 'riscv64' },
      // MUSL variants
      { platform: 'linux', arch: 'x64-musl' },
      { platform: 'linux', arch: 'x86-musl' },
      { platform: 'linux', arch: 'arm64-musl' },
      { platform: 'linux', arch: 'arm-musl' },
      { platform: 'linux', arch: 'armv7-musl' },
    ]
  }
];

const testRootDir = path.join(__dirname, 'test-runtimes');
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`${message}`, 'bright');
  log(`${'='.repeat(60)}`, 'cyan');
}

function logSection(message) {
  log(`\n${'-'.repeat(40)}`, 'blue');
  log(`${message}`, 'blue');
  log(`${'-'.repeat(40)}`, 'blue');
}

async function testDownload(type, platform, arch, version) {
  const testId = `${type}-${platform}-${arch}`;
  const targetDir = path.join(testRootDir, testId);
  
  try {
    log(`Testing: ${testId}`, 'yellow');
    
    const injector = new RuntimeInjector({
      type,
      platform,
      arch,
      version,
      targetDir,
      cleanup: false // 不清理，便于测试
    });

    // 只测试到下载步骤，不实际运行可执行文件（因为跨平台问题）
    await injector.inject();
    
    log(`✓ ${testId} - SUCCESS`, 'green');
    results.passed++;
    return true;
  } catch (error) {
    log(`✗ ${testId} - FAILED: ${error.message}`, 'red');
    results.failed++;
    results.errors.push({
      testId,
      error: error.message,
      stack: error.stack
    });
    return false;
  }
}

// 直接实现URL生成逻辑用于测试
function generateDownloadUrl(type, platform, arch, version) {
  if (type === 'node') {
    const platformId = getNodePlatformIdentifier(platform, arch);
    const fileExtension = platform === "win32" ? "zip" : "tar.gz";
    const fileName = `node-${version}-${platformId}.${fileExtension}`;
    return `https://nodejs.org/dist/${version}/${fileName}`;
  } else if (type === 'bun') {
    const platformId = getBunPlatformIdentifier(platform, arch);
    const fileName = `bun-${platformId}.zip`;
    return `https://github.com/oven-sh/bun/releases/download/bun-${version}/${fileName}`;
  } else if (type === 'uv') {
    const platformId = getUvPlatformIdentifier(platform, arch);
    const fileExtension = platform === "win32" ? "zip" : "tar.gz";
    const fileName = `uv-${platformId}.${fileExtension}`;
    return `https://github.com/astral-sh/uv/releases/download/${version}/${fileName}`;
  }
  throw new Error(`Unknown runtime type: ${type}`);
}

function getNodePlatformIdentifier(platform, arch) {
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

function getBunPlatformIdentifier(platform, arch) {
  if (platform === "darwin") {
    return arch === "arm64" ? "darwin-aarch64" : "darwin-x64";
  } else if (platform === "linux") {
    return arch === "arm64" ? "linux-aarch64" : "linux-x64";
  } else if (platform === "win32") {
    return arch === "arm64" ? "windows-aarch64" : "windows-x64";
  }

  throw new Error(`Unsupported platform for Bun: ${platform}-${arch}`);
}

function getUvPlatformIdentifier(platform, arch) {
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

// 检查URL是否可访问（不下载文件内容）
async function checkUrlAccessibility(url, testId) {
  try {
    const response = await axios.head(url, {
      timeout: 10000, // 10秒超时
      maxRedirects: 5,
      validateStatus: (status) => status < 400 // 只要不是4xx或5xx错误就算成功
    });
    
    const contentLength = response.headers['content-length'];
    const sizeInfo = contentLength ? ` (${Math.round(contentLength / 1024 / 1024 * 100) / 100}MB)` : '';
    
    log(`✓ ${testId} - HTTP ${response.status}${sizeInfo} - ${url}`, 'green');
    return { success: true, status: response.status, size: contentLength };
  } catch (error) {
    if (error.response) {
      // 服务器响应了错误状态码
      log(`✗ ${testId} - HTTP ${error.response.status} - ${url}`, 'red');
      return { 
        success: false, 
        status: error.response.status, 
        error: `HTTP ${error.response.status}` 
      };
    } else {
      // 网络错误或其他错误
      log(`✗ ${testId} - ${error.message} - ${url}`, 'red');
      return { 
        success: false, 
        error: error.message 
      };
    }
  }
}

async function validateDownloadUrl(type, platform, arch, version) {
  const testId = `${type}-${platform}-${arch}`;
  
  try {
    const downloadUrl = generateDownloadUrl(type, platform, arch, version);
    
    // 使用HEAD请求检查URL可访问性
    const result = await checkUrlAccessibility(downloadUrl, testId);
    
    return {
      testId,
      downloadUrl,
      valid: result.success,
      status: result.status,
      error: result.error,
      size: result.size
    };
  } catch (error) {
    log(`✗ ${testId} - Invalid URL: ${error.message}`, 'red');
    return { 
      testId, 
      error: error.message, 
      valid: false 
    };
  }
}

async function runUrlValidationTests() {
  logHeader('下载链接可用性测试');
  
  const urlResults = [];
  let totalChecked = 0;
  
  for (const config of testConfigs) {
    logSection(`测试 ${config.type.toUpperCase()} 下载链接`);
    
    // 并发检查所有URL以提高速度
    const promises = config.platforms.map(({ platform, arch }) => {
      totalChecked++;
      return validateDownloadUrl(config.type, platform, arch, getDefaultVersion(config.type));
    });
    
    const results = await Promise.all(promises);
    urlResults.push(...results);
  }
  
  const validUrls = urlResults.filter(r => r.valid);
  const invalidUrls = urlResults.filter(r => !r.valid);
  
  // 按状态分组统计
  const statusCounts = {};
  validUrls.forEach(r => {
    const status = r.status || 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  
  logHeader('测试结果统计');
  log(`总共检查: ${totalChecked} 个下载链接`, 'bright');
  log(`✓ 可用链接: ${validUrls.length}`, 'green');
  log(`✗ 不可用链接: ${invalidUrls.length}`, 'red');
  log(`成功率: ${Math.round((validUrls.length / totalChecked) * 100)}%`, 'blue');
  
  if (Object.keys(statusCounts).length > 0) {
    log(`\nHTTP状态码统计:`, 'cyan');
    Object.entries(statusCounts).forEach(([status, count]) => {
      log(`  HTTP ${status}: ${count} 个`, 'cyan');
    });
  }
  
  if (invalidUrls.length > 0) {
    log(`\n不可用的下载链接:`, 'red');
    invalidUrls.forEach(r => {
      log(`  - ${r.testId}: ${r.error || 'Unknown error'}`, 'red');
      if (r.downloadUrl) {
        log(`    URL: ${r.downloadUrl}`, 'yellow');
      }
    });
  }
  
  // 显示一些有效链接作为示例
  if (validUrls.length > 0) {
    log(`\n有效链接示例:`, 'green');
    validUrls.slice(0, 5).forEach(r => {
      const sizeInfo = r.size ? ` (${Math.round(r.size / 1024 / 1024 * 100) / 100}MB)` : '';
      log(`  ✓ ${r.testId}${sizeInfo}`, 'green');
      log(`    ${r.downloadUrl}`, 'cyan');
    });
    if (validUrls.length > 5) {
      log(`  ... 还有 ${validUrls.length - 5} 个有效链接`, 'green');
    }
  }
  
  results.total = totalChecked;
  results.passed = validUrls.length;
  results.failed = invalidUrls.length;
  results.errors = invalidUrls.map(r => ({
    testId: r.testId,
    error: r.error || 'Unknown error',
    url: r.downloadUrl
  }));
  
  return urlResults;
}

function getDefaultVersion(type) {
  const defaultVersions = {
    node: 'v22.9.0',
    bun: 'v1.2.16',
    uv: '0.7.13'
  };
  return defaultVersions[type];
}

async function printSummary() {
  logHeader('最终总结');
  
  log(`测试完成！`, 'bright');
  log(`✓ 成功: ${results.passed}`, 'green');
  log(`✗ 失败: ${results.failed}`, 'red');
  log(`总计: ${results.total}`, 'blue');
  log(`成功率: ${results.total > 0 ? Math.round((results.passed / results.total) * 100) : 0}%`, 'bright');
  
  if (results.errors.length > 0) {
    log(`\n失败详情:`, 'red');
    results.errors.forEach((error, index) => {
      log(`\n${index + 1}. ${error.testId}:`, 'red');
      log(`   错误: ${error.error}`, 'red');
      if (error.url) {
        log(`   链接: ${error.url}`, 'yellow');
      }
    });
  }
}

async function main() {
  logHeader('TINY RUNTIME INJECTOR - 下载链接验证测试');
  
  const startTime = Date.now();
  
  try {
    log('开始检查所有运行时的下载链接...', 'blue');
    log('注意: 此测试只检查链接可用性，不下载实际文件\n', 'yellow');
    
    // 运行URL验证测试
    await runUrlValidationTests();
    
    // 打印总结
    await printSummary();
    
  } catch (error) {
    log(`\n致命错误: ${error.message}`, 'red');
    console.error(error.stack);
  }
  
  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);
  
  log(`\n测试耗时: ${duration} 秒`, 'blue');
  
  // 退出状态
  process.exit(results.failed > 0 ? 1 : 0);
}

// 导出测试函数以便单独使用
export { runUrlValidationTests };

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
} 
