#!/usr/bin/env node

/**
 * Asset Generation Script using Gemini API
 * This script generates Spring Festival themed game assets
 *
 * Usage:
 *   node generate-assets.js [API_KEY]
 *   node generate-assets.js --list              # 列出所有资源
 *   node generate-assets.js --asset=base        # 只生成指定资源
 *   node generate-assets.js --help              # 显示帮助
 *
 * Environment Variables:
 *   GEMINI_API_KEY - Gemini API 密钥
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

// 尝试加载 sharp 库（用于移除黑色背景）
let sharp = null;
try {
  sharp = require("sharp");
} catch {
  // sharp 未安装，将跳过背景移除
}

// 解析命令行参数
const args = process.argv.slice(2);
const flags = {
  help: args.includes("--help") || args.includes("-h"),
  list: args.includes("--list") || args.includes("-l"),
  asset: args.find((a) => a.startsWith("--asset="))?.split("=")[1],
  dryRun: args.includes("--dry-run"),
};

// API Key: 从参数或环境变量获取
const API_KEY =
  args.find((a) => !a.startsWith("-")) || process.env.GEMINI_API_KEY;

// Gemini API 配置
const GEMINI_API_BASE = "generativelanguage.googleapis.com";
const GEMINI_MODEL = "gemini-3-pro-image-preview";

// 资源定义
const ASSET_DEFINITIONS = {
  // 建筑类
  base: {
    category: "buildings",
    description:
      "A Chinese New Year themed fortress base building, isometric pixel art style, red and gold colors, with lanterns and decorations, solid black background",
    size: { width: 256, height: 256 },
    frames: 1,
  },
  tower: {
    category: "buildings",
    description:
      "A defensive tower with Spring Festival decorations, isometric pixel art, red walls with golden roof, firecrackers hanging, solid black background",
    size: { width: 128, height: 192 },
    frames: 1,
  },
  barracks: {
    category: "buildings",
    description:
      "A military barracks building with Chinese New Year theme, isometric view, traditional Chinese architecture with red pillars, solid black background",
    size: { width: 256, height: 256 },
    frames: 1,
  },
  factory: {
    category: "buildings",
    description:
      "A Spring Festival themed factory building, isometric pixel art, producing fireworks and decorations, smoke coming out, solid black background",
    size: { width: 256, height: 256 },
    frames: 1,
  },

  // 单位类
  collector: {
    category: "units",
    description:
      "A small cute character unit carrying New Year goods, chibi pixel art style, isometric view, wearing traditional Chinese clothing, solid black background",
    size: { width: 64, height: 64 },
    frames: 4,
    animated: true,
  },
  firecracker_soldier: {
    category: "units",
    description:
      "A soldier character holding firecrackers as weapons, Spring Festival theme, pixel art, isometric view, red and gold armor, solid black background",
    size: { width: 64, height: 64 },
    frames: 4,
    animated: true,
  },
  nian_beast: {
    category: "units",
    description:
      "A mythical Nian beast character, Chinese New Year monster, pixel art style, isometric perspective, red fur with golden mane, solid black background",
    size: { width: 96, height: 96 },
    frames: 4,
    animated: true,
  },
  dragon_dancer: {
    category: "units",
    description:
      "A dragon dance performer unit, carrying part of a dragon puppet, festive colors, pixel art, isometric view, solid black background",
    size: { width: 64, height: 64 },
    frames: 4,
    animated: true,
  },

  // 资源类
  resource_gold: {
    category: "resources",
    description:
      "A pile of golden ingots and coins, Chinese New Year treasure, pixel art icon, glowing effect, solid black background",
    size: { width: 64, height: 64 },
    frames: 1,
  },
  resource_firework: {
    category: "resources",
    description:
      "A bundle of fireworks and firecrackers, colorful Spring Festival items, pixel art icon, solid black background",
    size: { width: 64, height: 64 },
    frames: 1,
  },
  hongbao: {
    category: "resources",
    description:
      "A red envelope (hongbao) with golden decorations, Chinese New Year lucky money, pixel art, solid black background",
    size: { width: 48, height: 48 },
    frames: 1,
  },

  // 特效类
  explosion: {
    category: "effects",
    description:
      "Firework explosion effect, colorful sparks, Spring Festival celebration, pixel art animation frame, solid black background",
    size: { width: 128, height: 128 },
    frames: 6,
    animated: true,
  },
  smoke: {
    category: "effects",
    description:
      "Festive red and gold smoke effect, pixel art, celebration theme, solid black background",
    size: { width: 64, height: 64 },
    frames: 4,
    animated: true,
  },

  // UI 元素
  ui_button: {
    category: "ui",
    description:
      "Game UI button with Spring Festival theme, red background with golden border, pixel art style",
    size: { width: 120, height: 40 },
    frames: 1,
  },
  ui_panel: {
    category: "ui",
    description:
      "Game UI panel background, Chinese New Year decorative border, red and gold colors, traditional patterns",
    size: { width: 300, height: 200 },
    frames: 1,
  },

  // 地图元素
  tile_grass: {
    category: "tiles",
    description:
      "Isometric grass tile with subtle Spring Festival decorations, green with small red flowers, pixel art",
    size: { width: 64, height: 32 },
    frames: 1,
  },
  tile_path: {
    category: "tiles",
    description:
      "Isometric stone path tile, traditional Chinese garden style, pixel art",
    size: { width: 64, height: 32 },
    frames: 1,
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
${colors.bright}Spring Festival Battle - Asset Generation Script${colors.reset}

${colors.yellow}Usage:${colors.reset}
  node generate-assets.js [API_KEY] [options]

${colors.yellow}Options:${colors.reset}
  --help, -h        显示帮助信息
  --list, -l        列出所有可生成的资源
  --asset=NAME      只生成指定的资源
  --dry-run         模拟运行，不实际调用 API

${colors.yellow}Examples:${colors.reset}
  node generate-assets.js YOUR_API_KEY
  node generate-assets.js --list
  node generate-assets.js YOUR_API_KEY --asset=base
  node generate-assets.js --dry-run

${colors.yellow}Environment Variables:${colors.reset}
  GEMINI_API_KEY    设置 Gemini API 密钥

${colors.yellow}Get API Key:${colors.reset}
  https://makersuite.google.com/app/apikey

${colors.yellow}Dependencies (optional):${colors.reset}
  npm install sharp    # 用于自动移除黑色背景
`);
}

// 列出所有资源
function listAssets() {
  logSection("Available Assets");

  const categories = {};
  for (const [name, def] of Object.entries(ASSET_DEFINITIONS)) {
    if (!categories[def.category]) {
      categories[def.category] = [];
    }
    categories[def.category].push({ name, ...def });
  }

  for (const [category, assets] of Object.entries(categories)) {
    log(`\n📁 ${category.toUpperCase()}`, "yellow");
    for (const asset of assets) {
      const animatedTag = asset.animated ? " [animated]" : "";
      const sizeInfo = `${asset.size.width}x${asset.size.height}`;
      const framesInfo = asset.frames > 1 ? `, ${asset.frames} frames` : "";
      log(`   • ${asset.name} (${sizeInfo}${framesInfo})${animatedTag}`);
      log(`     ${asset.description.substring(0, 60)}...`, "bright");
    }
  }

  console.log(`\n总计: ${Object.keys(ASSET_DEFINITIONS).length} 个资源\n`);
}

// HTTPS 请求封装
function httpsRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });

    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// 调用 Gemini API 生成图片
async function generateImageWithGemini(assetName, assetDef) {
  const prompt = `Generate a game asset image: ${assetDef.description}.
Style: Pixel art, suitable for a 2.5D isometric RTS game.
Size: ${assetDef.size.width}x${assetDef.size.height} pixels.
Requirements: Clear edges, vibrant colors. IMPORTANT: The background MUST be solid pure black (#000000), with no gradients or patterns. The game asset should be clearly visible against the black background.`;

  const requestBody = JSON.stringify({
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseModalities: ["image", "text"],
    },
  });

  const options = {
    hostname: GEMINI_API_BASE,
    path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(requestBody),
    },
  };

  log(`   调用 Gemini API...`, "bright");

  const response = await httpsRequest(options, requestBody);

  if (response.statusCode !== 200) {
    throw new Error(
      `API 请求失败: ${response.statusCode} - ${JSON.stringify(response.data)}`,
    );
  }

  // 解析响应，提取图片数据
  const candidates = response.data.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error("API 未返回有效结果");
  }

  const parts = candidates[0].content?.parts || [];
  const imagePart = parts.find((p) =>
    p.inlineData?.mimeType?.startsWith("image/"),
  );

  if (!imagePart) {
    // 如果没有图片，可能返回了文本描述
    const textPart = parts.find((p) => p.text);
    if (textPart) {
      log(`   API 返回文本: ${textPart.text.substring(0, 100)}...`, "yellow");
    }
    throw new Error("API 未返回图片数据");
  }

  return {
    data: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType,
  };
}

/**
 * 移除黑色背景，将黑色像素转为透明
 * @param {Buffer} inputBuffer - 输入图片的 Buffer
 * @returns {Promise<Buffer>} - 处理后的 PNG Buffer
 */
async function removeBlackBackground(inputBuffer) {
  if (!sharp) {
    log(`   ⚠️  sharp 未安装，跳过背景移除`, "yellow");
    return inputBuffer;
  }

  try {
    // 读取图片并获取原始像素数据
    const image = sharp(inputBuffer);
    const metadata = await image.metadata();
    const { width, height, channels } = metadata;

    // 确保图片有 alpha 通道
    const rawBuffer = await image.ensureAlpha().raw().toBuffer();

    // 黑色阈值（0-255），低于此值的 RGB 被视为黑色
    const threshold = 40;

    // 处理每个像素
    const pixelCount = width * height;
    for (let i = 0; i < pixelCount; i++) {
      const offset = i * 4; // RGBA
      const r = rawBuffer[offset];
      const g = rawBuffer[offset + 1];
      const b = rawBuffer[offset + 2];

      // 如果像素接近黑色，设置 alpha 为 0（透明）
      if (r < threshold && g < threshold && b < threshold) {
        rawBuffer[offset + 3] = 0;
      }
    }

    // 将处理后的像素数据转换回 PNG
    const outputBuffer = await sharp(rawBuffer, {
      raw: {
        width,
        height,
        channels: 4,
      },
    })
      .png()
      .toBuffer();

    log(`   🎨 已移除黑色背景`, "green");
    return outputBuffer;
  } catch (error) {
    log(`   ⚠️  背景移除失败: ${error.message}`, "yellow");
    return inputBuffer;
  }
}

// 保存图片
async function saveImage(assetName, assetDef, imageData) {
  const assetsDir = path.join(__dirname, "../public/assets", assetDef.category);

  // 确保目录存在
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // 解码 base64
  let buffer = Buffer.from(imageData.data, "base64");

  // 移除黑色背景
  buffer = await removeBlackBackground(buffer);

  // 始终保存为 PNG（支持透明度）
  const filePath = path.join(assetsDir, `${assetName}.png`);
  fs.writeFileSync(filePath, buffer);

  return filePath;
}

// 生成单个资源
async function generateAsset(assetName, assetDef) {
  log(`\n🎨 生成资源: ${assetName}`, "green");
  log(`   类别: ${assetDef.category}`);
  log(`   尺寸: ${assetDef.size.width}x${assetDef.size.height}`);

  if (flags.dryRun) {
    log(`   [DRY RUN] 跳过实际生成`, "yellow");
    log(`   Prompt: ${assetDef.description.substring(0, 80)}...`);
    return true;
  }

  try {
    const imageData = await generateImageWithGemini(assetName, assetDef);
    const filePath = await saveImage(assetName, assetDef, imageData);
    log(`   ✅ 已保存: ${path.relative(process.cwd(), filePath)}`, "green");
    return true;
  } catch (error) {
    log(`   ❌ 生成失败: ${error.message}`, "red");
    return false;
  }
}

// 生成资源清单文件
function generateManifest(generatedAssets) {
  const manifestPath = path.join(__dirname, "../public/assets/manifest.json");
  const manifest = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    assets: {},
  };

  for (const [name, def] of Object.entries(ASSET_DEFINITIONS)) {
    manifest.assets[name] = {
      category: def.category,
      path: `assets/${def.category}/${name}.png`,
      size: def.size,
      frames: def.frames,
      animated: def.animated || false,
      generated: generatedAssets.includes(name),
    };
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  log(
    `\n📋 资源清单已更新: ${path.relative(process.cwd(), manifestPath)}`,
    "cyan",
  );
}

// 更新 README
function updateAssetsReadme() {
  const readmePath = path.join(__dirname, "../public/assets/README.md");

  const categoryDescriptions = {
    buildings: "建筑资源 - 基地、塔楼、兵营等",
    units: "单位资源 - 士兵、收集者、年兽等",
    resources: "资源图标 - 金币、烟花、红包等",
    effects: "特效资源 - 爆炸、烟雾等",
    ui: "UI 元素 - 按钮、面板等",
    tiles: "地图瓦片 - 草地、道路等",
  };

  let content = `# 游戏资源 (Game Assets)

本目录包含 Spring Festival Battle 游戏的所有视觉资源。

## 资源生成

### 使用 Gemini API 生成

1. 获取 API Key: https://makersuite.google.com/app/apikey

2. 运行生成脚本:
   \`\`\`bash
   # 生成所有资源
   npm run generate-assets YOUR_API_KEY

   # 只生成指定资源
   node scripts/generate-assets.js YOUR_API_KEY --asset=base

   # 查看所有可用资源
   node scripts/generate-assets.js --list
   \`\`\`

3. 或设置环境变量:
   \`\`\`bash
   export GEMINI_API_KEY=your_key_here
   npm run generate-assets
   \`\`\`

## 资源列表

`;

  // 按类别组织资源
  const categories = {};
  for (const [name, def] of Object.entries(ASSET_DEFINITIONS)) {
    if (!categories[def.category]) {
      categories[def.category] = [];
    }
    categories[def.category].push({ name, ...def });
  }

  for (const [category, assets] of Object.entries(categories)) {
    content += `### ${categoryDescriptions[category] || category}\n\n`;
    content += `| 资源名称 | 尺寸 | 动画帧数 | 描述 |\n`;
    content += `|---------|------|---------|------|\n`;

    for (const asset of assets) {
      const size = `${asset.size.width}x${asset.size.height}`;
      const frames = asset.frames > 1 ? asset.frames : "-";
      const desc = asset.description.substring(0, 50) + "...";
      content += `| ${asset.name} | ${size} | ${frames} | ${desc} |\n`;
    }
    content += "\n";
  }

  content += `## 雪碧图生成 (Spritesheet)

对于动画资源，可以使用 spritesmith 合成雪碧图:

\`\`\`bash
npm run generate-spritesheet
\`\`\`

详见 \`scripts/generate-spritesheet.js\`。

## 手动添加资源

如果需要手动添加资源:

1. 确保图片尺寸符合上表规格
2. 使用透明背景 PNG 格式
3. 遵循像素艺术风格
4. 使用春节主题配色（红、金、绿）
5. 放置到对应类别目录下
6. 更新 \`manifest.json\`

## 占位符

当前使用 Three.js 几何图形作为占位符。
生成实际资源后会自动替换。
`;

  fs.writeFileSync(readmePath, content);
  log(`📄 README 已更新: ${path.relative(process.cwd(), readmePath)}`, "cyan");
}

// 主函数
async function main() {
  console.log();
  log("🎊 Spring Festival Battle - Asset Generation", "bright");
  log("═".repeat(50), "cyan");

  // 处理命令行选项
  if (flags.help) {
    showHelp();
    return;
  }

  if (flags.list) {
    listAssets();
    return;
  }

  // 检查 API Key
  if (!API_KEY && !flags.dryRun) {
    log("\n⚠️  未提供 API Key!", "yellow");
    log("   使用方法: node generate-assets.js YOUR_API_KEY");
    log("   或设置环境变量: export GEMINI_API_KEY=your_key");
    log("\n   使用 --dry-run 可以模拟运行查看效果\n");

    // 仍然更新文档
    updateAssetsReadme();
    return;
  }

  // 确定要生成的资源
  let assetsToGenerate = Object.entries(ASSET_DEFINITIONS);

  if (flags.asset) {
    if (!ASSET_DEFINITIONS[flags.asset]) {
      log(`\n❌ 未知资源: ${flags.asset}`, "red");
      log("   使用 --list 查看所有可用资源\n");
      return;
    }
    assetsToGenerate = [[flags.asset, ASSET_DEFINITIONS[flags.asset]]];
  }

  logSection(`生成 ${assetsToGenerate.length} 个资源`);

  if (flags.dryRun) {
    log("🔍 模拟运行模式 (不会实际调用 API)", "yellow");
  }

  // 生成资源
  const generated = [];
  const failed = [];

  for (const [name, def] of assetsToGenerate) {
    const success = await generateAsset(name, def);
    if (success) {
      generated.push(name);
    } else {
      failed.push(name);
    }

    // 添加延迟避免 API 限流
    if (!flags.dryRun && assetsToGenerate.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // 生成清单和更新文档
  logSection("完成");

  generateManifest(generated);
  updateAssetsReadme();

  // 输出统计
  log(`\n📊 生成统计:`, "bright");
  log(`   ✅ 成功: ${generated.length}`, "green");
  if (failed.length > 0) {
    log(`   ❌ 失败: ${failed.length} (${failed.join(", ")})`, "red");
  }

  log(`\n💡 提示:`, "yellow");
  log("   • 生成的资源保存在 public/assets/ 目录");
  log("   • 动画资源需要运行 npm run generate-spritesheet 合成雪碧图");
  log("   • 如遇 API 限流，请稍后重试或使用 --asset 逐个生成\n");
}

// 运行
main().catch((error) => {
  log(`\n❌ 发生错误: ${error.message}`, "red");
  process.exit(1);
});
