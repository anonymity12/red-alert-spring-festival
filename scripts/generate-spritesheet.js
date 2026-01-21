#!/usr/bin/env node

/**
 * Spritesheet Generation Script
 * 将动画帧图片合成为雪碧图 (Spritesheet)
 *
 * Usage:
 *   node generate-spritesheet.js                  # 生成所有雪碧图
 *   node generate-spritesheet.js --asset=nian_beast  # 只生成指定资源的雪碧图
 *   node generate-spritesheet.js --help           # 显示帮助
 *
 * Dependencies:
 *   npm install --save-dev spritesmith
 */

const fs = require("fs");
const path = require("path");

// 解析命令行参数
const args = process.argv.slice(2);
const flags = {
  help: args.includes("--help") || args.includes("-h"),
  asset: args.find((a) => a.startsWith("--asset="))?.split("=")[1],
  verbose: args.includes("--verbose") || args.includes("-v"),
};

// 动画资源定义
const ANIMATED_ASSETS = {
  collector: {
    category: "units",
    frameSize: { width: 64, height: 64 },
    frames: 4,
    animations: {
      idle: { start: 0, end: 0 },
      walk: { start: 0, end: 3 },
    },
  },
  firecracker_soldier: {
    category: "units",
    frameSize: { width: 64, height: 64 },
    frames: 4,
    animations: {
      idle: { start: 0, end: 0 },
      walk: { start: 0, end: 3 },
      attack: { start: 0, end: 3 },
    },
  },
  nian_beast: {
    category: "units",
    frameSize: { width: 96, height: 96 },
    frames: 4,
    animations: {
      idle: { start: 0, end: 0 },
      walk: { start: 0, end: 3 },
      attack: { start: 0, end: 3 },
    },
  },
  dragon_dancer: {
    category: "units",
    frameSize: { width: 64, height: 64 },
    frames: 4,
    animations: {
      idle: { start: 0, end: 0 },
      walk: { start: 0, end: 3 },
    },
  },
  explosion: {
    category: "effects",
    frameSize: { width: 128, height: 128 },
    frames: 6,
    animations: {
      explode: { start: 0, end: 5, loop: false },
    },
  },
  smoke: {
    category: "effects",
    frameSize: { width: 64, height: 64 },
    frames: 4,
    animations: {
      puff: { start: 0, end: 3, loop: true },
    },
  },
};

// 颜色输出
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log();
  log(`═══ ${title} ═══`, "cyan");
}

// 显示帮助
function showHelp() {
  console.log(`
${colors.bright}Spring Festival Battle - Spritesheet Generation${colors.reset}

${colors.yellow}Usage:${colors.reset}
  node generate-spritesheet.js [options]

${colors.yellow}Options:${colors.reset}
  --help, -h        显示帮助信息
  --asset=NAME      只生成指定资源的雪碧图
  --verbose, -v     显示详细信息

${colors.yellow}Prerequisites:${colors.reset}
  1. 安装 spritesmith: npm install --save-dev spritesmith
  2. 确保动画帧图片存在于 public/assets/{category}/{name}_frame_*.png

${colors.yellow}Examples:${colors.reset}
  node generate-spritesheet.js
  node generate-spritesheet.js --asset=nian_beast

${colors.yellow}Animated Assets:${colors.reset}
  ${Object.keys(ANIMATED_ASSETS).join(", ")}
`);
}

// 检查 spritesmith 是否安装
async function checkSpritesmith() {
  try {
    require.resolve("spritesmith");
    return true;
  } catch {
    return false;
  }
}

// 查找帧图片
function findFrameImages(assetName, assetDef) {
  const assetsDir = path.join(
    __dirname,
    "../public/assets",
    assetDef.category,
  );
  const frames = [];

  // 查找格式: {name}_frame_0.png, {name}_frame_1.png, ...
  for (let i = 0; i < assetDef.frames; i++) {
    const framePath = path.join(assetsDir, `${assetName}_frame_${i}.png`);
    if (fs.existsSync(framePath)) {
      frames.push(framePath);
    }
  }

  // 如果没有帧图片，尝试查找单张图片并复制为多帧
  if (frames.length === 0) {
    const singlePath = path.join(assetsDir, `${assetName}.png`);
    if (fs.existsSync(singlePath)) {
      log(`   ⚠️  只找到单张图片，将复制为 ${assetDef.frames} 帧`, "yellow");
      // 复制单张图片为多帧
      for (let i = 0; i < assetDef.frames; i++) {
        const framePath = path.join(assetsDir, `${assetName}_frame_${i}.png`);
        fs.copyFileSync(singlePath, framePath);
        frames.push(framePath);
      }
    }
  }

  return frames;
}

// 使用 spritesmith 生成雪碧图
async function generateWithSpritesmith(assetName, assetDef, frameImages) {
  const Spritesmith = require("spritesmith");

  return new Promise((resolve, reject) => {
    Spritesmith.run(
      {
        src: frameImages,
        algorithm: "left-right", // 水平排列
        padding: 0,
      },
      (err, result) => {
        if (err) {
          reject(err);
          return;
        }

        const assetsDir = path.join(
          __dirname,
          "../public/assets",
          assetDef.category,
        );
        const spritesheetPath = path.join(
          assetsDir,
          `${assetName}_spritesheet.png`,
        );

        // 保存雪碧图
        fs.writeFileSync(spritesheetPath, result.image);

        // 生成雪碧图元数据
        const metadata = {
          name: assetName,
          image: `assets/${assetDef.category}/${assetName}_spritesheet.png`,
          frameWidth: assetDef.frameSize.width,
          frameHeight: assetDef.frameSize.height,
          totalFrames: frameImages.length,
          spritesheet: {
            width: result.properties.width,
            height: result.properties.height,
          },
          animations: assetDef.animations,
          frames: Object.entries(result.coordinates).map(([file, coords]) => ({
            file: path.basename(file),
            x: coords.x,
            y: coords.y,
            width: coords.width,
            height: coords.height,
          })),
        };

        const metadataPath = path.join(assetsDir, `${assetName}_spritesheet.json`);
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

        resolve({
          spritesheetPath,
          metadataPath,
          metadata,
        });
      },
    );
  });
}

// 生成简单的雪碧图（不使用 spritesmith）
async function generateSimpleSpritesheet(assetName, assetDef, frameImages) {
  log(`   ⚠️  spritesmith 未安装，生成元数据文件`, "yellow");

  const assetsDir = path.join(
    __dirname,
    "../public/assets",
    assetDef.category,
  );

  // 只生成元数据，描述如何使用帧图片
  const metadata = {
    name: assetName,
    type: "frame-sequence",
    frameWidth: assetDef.frameSize.width,
    frameHeight: assetDef.frameSize.height,
    totalFrames: frameImages.length,
    animations: assetDef.animations,
    frames: frameImages.map((file, index) => ({
      index,
      file: `assets/${assetDef.category}/${path.basename(file)}`,
    })),
  };

  const metadataPath = path.join(assetsDir, `${assetName}_animation.json`);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  return {
    metadataPath,
    metadata,
  };
}

// 生成单个资源的雪碧图
async function generateSpritesheet(assetName, assetDef, hasSpritesmith) {
  log(`\n🎬 处理动画资源: ${assetName}`, "green");
  log(`   类别: ${assetDef.category}`);
  log(`   帧尺寸: ${assetDef.frameSize.width}x${assetDef.frameSize.height}`);
  log(`   帧数: ${assetDef.frames}`);

  // 查找帧图片
  const frameImages = findFrameImages(assetName, assetDef);

  if (frameImages.length === 0) {
    log(`   ⏭️  未找到帧图片，跳过`, "yellow");
    log(`   提示: 请先运行 npm run generate-assets 生成资源`);
    return null;
  }

  log(`   找到 ${frameImages.length} 帧图片`);

  try {
    let result;
    if (hasSpritesmith) {
      result = await generateWithSpritesmith(assetName, assetDef, frameImages);
      log(
        `   ✅ 雪碧图: ${path.relative(process.cwd(), result.spritesheetPath)}`,
        "green",
      );
    } else {
      result = await generateSimpleSpritesheet(assetName, assetDef, frameImages);
    }
    log(
      `   ✅ 元数据: ${path.relative(process.cwd(), result.metadataPath)}`,
      "green",
    );
    return result;
  } catch (error) {
    log(`   ❌ 生成失败: ${error.message}`, "red");
    return null;
  }
}

// 生成总览清单
function generateSpritesheetManifest(results) {
  const manifestPath = path.join(
    __dirname,
    "../public/assets/spritesheets.json",
  );

  const manifest = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    spritesheets: {},
  };

  for (const [name, result] of Object.entries(results)) {
    if (result && result.metadata) {
      manifest.spritesheets[name] = result.metadata;
    }
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  log(
    `\n📋 雪碧图清单: ${path.relative(process.cwd(), manifestPath)}`,
    "cyan",
  );
}

// 主函数
async function main() {
  console.log();
  log("🎬 Spring Festival Battle - Spritesheet Generation", "bright");
  log("═".repeat(50), "cyan");

  // 处理命令行选项
  if (flags.help) {
    showHelp();
    return;
  }

  // 检查 spritesmith
  const hasSpritesmith = await checkSpritesmith();
  if (!hasSpritesmith) {
    log("\n⚠️  spritesmith 未安装", "yellow");
    log("   安装命令: npm install --save-dev spritesmith");
    log("   将使用备用方案生成元数据\n");
  } else {
    log("\n✅ spritesmith 已安装", "green");
  }

  // 确定要处理的资源
  let assetsToProcess = Object.entries(ANIMATED_ASSETS);

  if (flags.asset) {
    if (!ANIMATED_ASSETS[flags.asset]) {
      log(`\n❌ 未知动画资源: ${flags.asset}`, "red");
      log(`   可用资源: ${Object.keys(ANIMATED_ASSETS).join(", ")}\n`);
      return;
    }
    assetsToProcess = [[flags.asset, ANIMATED_ASSETS[flags.asset]]];
  }

  logSection(`处理 ${assetsToProcess.length} 个动画资源`);

  // 生成雪碧图
  const results = {};
  let successCount = 0;
  let skipCount = 0;

  for (const [name, def] of assetsToProcess) {
    const result = await generateSpritesheet(name, def, hasSpritesmith);
    results[name] = result;
    if (result) {
      successCount++;
    } else {
      skipCount++;
    }
  }

  // 生成清单
  if (successCount > 0) {
    generateSpritesheetManifest(results);
  }

  // 输出统计
  logSection("完成");
  log(`\n📊 统计:`, "bright");
  log(`   ✅ 成功: ${successCount}`, "green");
  if (skipCount > 0) {
    log(`   ⏭️  跳过: ${skipCount}`, "yellow");
  }

  log(`\n💡 使用雪碧图:`, "yellow");
  log("   1. 加载 spritesheets.json 获取所有动画信息");
  log("   2. 使用 Three.js TextureLoader 加载雪碧图");
  log("   3. 根据 animation 定义更新 UV 坐标实现动画\n");

  if (!hasSpritesmith) {
    log(`📦 安装 spritesmith 获得更好的雪碧图支持:`, "cyan");
    log(`   npm install --save-dev spritesmith\n`);
  }
}

// 运行
main().catch((error) => {
  log(`\n❌ 发生错误: ${error.message}`, "red");
  process.exit(1);
});
