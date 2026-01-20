#!/usr/bin/env node

/**
 * PNG Compression Script
 * 压缩 public/assets 文件夹下的所有 PNG 图片
 * 保持原有比例，宽或高不超过 128 像素
 *
 * Usage:
 *   node scripts/compress_png.js                    # 压缩所有图片
 *   node scripts/compress_png.js --dry-run          # 预览模式，不实际修改
 *   node scripts/compress_png.js --max-size=256     # 自定义最大尺寸
 *   node scripts/compress_png.js --quality=80       # 设置压缩质量 (1-100)
 *   node scripts/compress_png.js --backup           # 压缩前备份原文件
 *
 * Requirements:
 *   npm install sharp
 */

const fs = require("fs");
const path = require("path");

// 尝试加载 sharp 库
let sharp = null;
try {
  sharp = require("sharp");
} catch {
  console.error("❌ 错误: 需要安装 sharp 库");
  console.error("   请运行: npm install sharp");
  process.exit(1);
}

// 解析命令行参数
const args = process.argv.slice(2);
const flags = {
  help: args.includes("--help") || args.includes("-h"),
  dryRun: args.includes("--dry-run"),
  backup: args.includes("--backup"),
  maxSize: parseInt(
    args.find((a) => a.startsWith("--max-size="))?.split("=")[1] || "128",
    10
  ),
  quality: parseInt(
    args.find((a) => a.startsWith("--quality="))?.split("=")[1] || "90",
    10
  ),
};

// 帮助信息
if (flags.help) {
  console.log(`
PNG 压缩工具 - 压缩 public/assets 下的所有 PNG 图片

用法:
  node scripts/compress_png.js [选项]

选项:
  --help, -h          显示帮助信息
  --dry-run           预览模式，不实际修改文件
  --backup            压缩前备份原文件（添加 .backup.png 后缀）
  --max-size=N        设置最大尺寸（默认 128 像素）
  --quality=N         设置 PNG 压缩质量 1-100（默认 90）

示例:
  node scripts/compress_png.js                    # 使用默认设置压缩
  node scripts/compress_png.js --max-size=64      # 最大 64 像素
  node scripts/compress_png.js --dry-run          # 预览不修改
  node scripts/compress_png.js --backup           # 压缩并备份原文件
`);
  process.exit(0);
}

// 项目根目录
const ROOT_DIR = path.join(__dirname, "..");
const ASSETS_DIR = path.join(ROOT_DIR, "public", "assets");

// 统计信息
const stats = {
  total: 0,
  processed: 0,
  skipped: 0,
  errors: 0,
  savedBytes: 0,
};

/**
 * 递归查找所有 PNG 文件
 * @param {string} dir - 目录路径
 * @returns {string[]} PNG 文件路径数组
 */
function findPngFiles(dir) {
  const pngFiles = [];

  if (!fs.existsSync(dir)) {
    console.error(`❌ 目录不存在: ${dir}`);
    return pngFiles;
  }

  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      // 递归进入子目录
      pngFiles.push(...findPngFiles(fullPath));
    } else if (item.isFile() && item.name.toLowerCase().endsWith(".png")) {
      // 跳过备份文件
      if (!item.name.includes(".backup.")) {
        pngFiles.push(fullPath);
      }
    }
  }

  return pngFiles;
}

/**
 * 计算保持比例的新尺寸
 * @param {number} width - 原始宽度
 * @param {number} height - 原始高度
 * @param {number} maxSize - 最大尺寸
 * @returns {{width: number, height: number}} 新尺寸
 */
function calculateNewSize(width, height, maxSize) {
  // 如果图片已经小于等于最大尺寸，不需要调整
  if (width <= maxSize && height <= maxSize) {
    return { width, height, needsResize: false };
  }

  // 计算缩放比例
  const ratio = Math.min(maxSize / width, maxSize / height);
  const newWidth = Math.round(width * ratio);
  const newHeight = Math.round(height * ratio);

  return { width: newWidth, height: newHeight, needsResize: true };
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 压缩单个 PNG 文件
 * @param {string} filePath - 文件路径
 */
async function compressPng(filePath) {
  const relativePath = path.relative(ROOT_DIR, filePath);

  try {
    // 获取原始文件信息
    const originalStats = fs.statSync(filePath);
    const originalSize = originalStats.size;

    // 读取图片元数据
    const metadata = await sharp(filePath).metadata();
    const { width, height } = metadata;

    // 计算新尺寸
    const newSize = calculateNewSize(width, height, flags.maxSize);

    // 构建状态信息
    const sizeInfo = `${width}x${height}`;
    const newSizeInfo = newSize.needsResize
      ? ` → ${newSize.width}x${newSize.height}`
      : "";

    if (flags.dryRun) {
      // 预览模式
      const action = newSize.needsResize ? "将被压缩" : "无需调整";
      console.log(`  📄 ${relativePath} (${sizeInfo}${newSizeInfo}) - ${action}`);
      stats.processed++;
      return;
    }

    // 备份原文件
    if (flags.backup) {
      const backupPath = filePath.replace(".png", ".backup.png");
      fs.copyFileSync(filePath, backupPath);
    }

    // 压缩图片
    let sharpInstance = sharp(filePath);

    if (newSize.needsResize) {
      sharpInstance = sharpInstance.resize(newSize.width, newSize.height, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    // 优化 PNG
    const outputBuffer = await sharpInstance
      .png({
        quality: flags.quality,
        compressionLevel: 9,
        palette: true, // 使用调色板优化
      })
      .toBuffer();

    // 写入文件
    fs.writeFileSync(filePath, outputBuffer);

    // 计算节省的空间
    const newFileSize = outputBuffer.length;
    const savedBytes = originalSize - newFileSize;
    stats.savedBytes += Math.max(0, savedBytes);

    const savedInfo =
      savedBytes > 0
        ? `节省 ${formatSize(savedBytes)}`
        : savedBytes < 0
        ? `增加 ${formatSize(-savedBytes)}`
        : "大小不变";

    console.log(
      `  ✅ ${relativePath} (${sizeInfo}${newSizeInfo}) - ${formatSize(originalSize)} → ${formatSize(newFileSize)} (${savedInfo})`
    );
    stats.processed++;
  } catch (error) {
    console.error(`  ❌ ${relativePath} - 错误: ${error.message}`);
    stats.errors++;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log("🖼️  PNG 压缩工具");
  console.log("================");
  console.log(`📁 资源目录: ${ASSETS_DIR}`);
  console.log(`📏 最大尺寸: ${flags.maxSize}px`);
  console.log(`🎨 压缩质量: ${flags.quality}`);

  if (flags.dryRun) {
    console.log("⚠️  预览模式 - 不会修改任何文件");
  }
  if (flags.backup) {
    console.log("💾 备份模式 - 将保留原文件");
  }
  console.log("");

  // 查找所有 PNG 文件
  const pngFiles = findPngFiles(ASSETS_DIR);
  stats.total = pngFiles.length;

  if (pngFiles.length === 0) {
    console.log("❌ 未找到任何 PNG 文件");
    return;
  }

  console.log(`📊 找到 ${pngFiles.length} 个 PNG 文件\n`);

  // 按目录分组显示
  const filesByDir = {};
  for (const file of pngFiles) {
    const dir = path.dirname(path.relative(ASSETS_DIR, file));
    if (!filesByDir[dir]) {
      filesByDir[dir] = [];
    }
    filesByDir[dir].push(file);
  }

  // 处理每个目录
  for (const [dir, files] of Object.entries(filesByDir)) {
    const dirName = dir === "." ? "根目录" : dir;
    console.log(`📂 ${dirName}/`);

    for (const file of files) {
      await compressPng(file);
    }
    console.log("");
  }

  // 打印统计信息
  console.log("================");
  console.log("📊 统计信息:");
  console.log(`   总计: ${stats.total} 个文件`);
  console.log(`   处理: ${stats.processed} 个文件`);
  if (stats.errors > 0) {
    console.log(`   错误: ${stats.errors} 个文件`);
  }
  if (!flags.dryRun && stats.savedBytes > 0) {
    console.log(`   节省空间: ${formatSize(stats.savedBytes)}`);
  }
  console.log("");

  if (flags.dryRun) {
    console.log('💡 提示: 移除 --dry-run 参数以实际执行压缩');
  } else {
    console.log("✅ 压缩完成!");
  }
}

// 运行主函数
main().catch((error) => {
  console.error("❌ 发生错误:", error);
  process.exit(1);
});
