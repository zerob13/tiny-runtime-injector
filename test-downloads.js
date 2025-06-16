#!/usr/bin/env node

import { RuntimeInjector } from './dist/index.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configurations for different platforms and architectures
const testConfigs = [
  // Node.js configurations
  {
    type: 'node',
    platforms: [
      { platform: 'win32', arch: 'x64' },
      { platform: 'win32', arch: 'arm64' },
      { platform: 'darwin', arch: 'x64' },
      { platform: 'darwin', arch: 'arm64' },
      { platform: 'linux', arch: 'x64' },
      { platform: 'linux', arch: 'arm64' },
    ]
  },
  // Bun configurations
  {
    type: 'bun',
    platforms: [
      { platform: 'win32', arch: 'x64' },
      { platform: 'win32', arch: 'arm64' },
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
      { platform: 'win32', arch: 'arm64' },
      { platform: 'darwin', arch: 'x64' },
      { platform: 'darwin', arch: 'arm64' },
      { platform: 'linux', arch: 'x64' },
      { platform: 'linux', arch: 'arm64' },
      // MUSL variants
      { platform: 'linux', arch: 'x64-musl' },
      { platform: 'linux', arch: 'arm64-musl' },
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

async function validateDownloadUrl(type, platform, arch, version) {
  const testId = `${type}-${platform}-${arch}`;
  
  try {
    const downloadUrl = generateDownloadUrl(type, platform, arch, version);
    const fileExtension = platform === "win32" ? (type === 'node' ? 'zip' : (type === 'uv' ? 'zip' : 'zip')) : 'tar.gz';
    
    log(`${testId}: ${downloadUrl}`, 'cyan');
    
    // 简单验证URL格式
    if (!downloadUrl.startsWith('https://')) {
      throw new Error('URL should start with https://');
    }
    
    if (!downloadUrl.includes(version)) {
      throw new Error('URL should contain version');
    }
    
    return { testId, downloadUrl, fileExtension, valid: true };
  } catch (error) {
    log(`✗ ${testId} - Invalid URL: ${error.message}`, 'red');
    return { testId, error: error.message, valid: false };
  }
}

async function runUrlValidationTests() {
  logHeader('URL VALIDATION TESTS');
  
  const urlResults = [];
  
  for (const config of testConfigs) {
    logSection(`Testing ${config.type.toUpperCase()} URLs`);
    
    for (const { platform, arch } of config.platforms) {
      const result = await validateDownloadUrl(config.type, platform, arch, getDefaultVersion(config.type));
      urlResults.push(result);
    }
  }
  
  const validUrls = urlResults.filter(r => r.valid);
  const invalidUrls = urlResults.filter(r => !r.valid);
  
  log(`\nURL Validation Summary:`, 'bright');
  log(`✓ Valid URLs: ${validUrls.length}`, 'green');
  log(`✗ Invalid URLs: ${invalidUrls.length}`, 'red');
  
  if (invalidUrls.length > 0) {
    log(`\nInvalid URLs:`, 'red');
    invalidUrls.forEach(r => {
      log(`  - ${r.testId}: ${r.error}`, 'red');
    });
  }
  
  return urlResults;
}

async function runDownloadTests() {
  logHeader('DOWNLOAD TESTS');
  
  // 确保测试目录存在
  await fs.ensureDir(testRootDir);
  
  // 只测试当前平台的一些组合，避免跨平台问题
  const currentPlatform = process.platform;
  const currentArch = process.arch;
  
  log(`Current platform: ${currentPlatform}-${currentArch}`, 'blue');
  
  const downloadTests = [
    // 测试当前平台
    { type: 'node', platform: currentPlatform, arch: currentArch },
    { type: 'bun', platform: currentPlatform, arch: currentArch },
    { type: 'uv', platform: currentPlatform, arch: currentArch },
    
    // 测试一些跨平台组合（只下载，不运行）
    { type: 'uv', platform: 'linux', arch: 'x64' },
    { type: 'uv', platform: 'win32', arch: 'x64' },
    { type: 'node', platform: 'linux', arch: 'arm64' },
  ];
  
  for (const testConfig of downloadTests) {
    results.total++;
    await testDownload(
      testConfig.type,
      testConfig.platform,
      testConfig.arch,
      getDefaultVersion(testConfig.type)
    );
  }
}

function getDefaultVersion(type) {
  const defaultVersions = {
    node: 'v22.9.0',
    bun: 'v1.2.16',
    uv: '0.7.13'
  };
  return defaultVersions[type];
}

async function cleanup() {
  logHeader('CLEANUP');
  
  try {
    if (await fs.pathExists(testRootDir)) {
      log('Removing test directory...', 'yellow');
      await fs.remove(testRootDir);
      log('✓ Test directory removed', 'green');
    }
  } catch (error) {
    log(`✗ Cleanup failed: ${error.message}`, 'red');
  }
}

async function printSummary() {
  logHeader('TEST SUMMARY');
  
  log(`Total tests: ${results.total}`, 'bright');
  log(`✓ Passed: ${results.passed}`, 'green');
  log(`✗ Failed: ${results.failed}`, 'red');
  log(`Success rate: ${results.total > 0 ? Math.round((results.passed / results.total) * 100) : 0}%`, 'blue');
  
  if (results.errors.length > 0) {
    log(`\nError Details:`, 'red');
    results.errors.forEach((error, index) => {
      log(`\n${index + 1}. ${error.testId}:`, 'red');
      log(`   ${error.error}`, 'red');
    });
  }
}

async function main() {
  logHeader('TINY RUNTIME INJECTOR - COMPREHENSIVE TESTS');
  
  try {
    // 1. 验证所有URL
    await runUrlValidationTests();
    
    // 2. 运行实际下载测试
    await runDownloadTests();
    
    // 3. 打印总结
    await printSummary();
    
  } catch (error) {
    log(`\nFatal error: ${error.message}`, 'red');
    console.error(error.stack);
  } finally {
    // 4. 清理
    await cleanup();
  }
  
  // 5. 退出状态
  process.exit(results.failed > 0 ? 1 : 0);
}

// 导出测试函数以便单独使用
export { runUrlValidationTests, runDownloadTests, cleanup };

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
} 
