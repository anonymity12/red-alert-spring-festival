# 游戏资源 (Game Assets)

本目录包含 Spring Festival Battle 游戏的所有视觉资源。

## 资源生成

### 使用 Gemini API 生成

1. 获取 API Key: https://makersuite.google.com/app/apikey

2. 运行生成脚本:
   ```bash
   # 生成所有资源
   npm run generate-assets YOUR_API_KEY

   # 只生成指定资源
   node scripts/generate-assets.js YOUR_API_KEY --asset=base

   # 查看所有可用资源
   node scripts/generate-assets.js --list
   ```

3. 或设置环境变量:
   ```bash
   export GEMINI_API_KEY=your_key_here
   npm run generate-assets
   ```

## 资源列表

### 建筑资源 - 基地、塔楼、兵营等

| 资源名称 | 尺寸 | 动画帧数 | 描述 |
|---------|------|---------|------|
| base | 256x256 | - | A Chinese New Year themed fortress base building, ... |
| tower | 128x192 | - | A defensive tower with Spring Festival decorations... |
| barracks | 256x256 | - | A military barracks building with Chinese New Year... |
| factory | 256x256 | - | A Spring Festival themed factory building, isometr... |

### 单位资源 - 士兵、收集者、年兽等

| 资源名称 | 尺寸 | 动画帧数 | 描述 |
|---------|------|---------|------|
| collector | 64x64 | 4 | A small cute character unit carrying New Year good... |
| firecracker_soldier | 64x64 | 4 | A soldier character holding firecrackers as weapon... |
| nian_beast | 96x96 | 4 | A mythical Nian beast character, Chinese New Year ... |
| dragon_dancer | 64x64 | 4 | A dragon dance performer unit, carrying part of a ... |

### 资源图标 - 金币、烟花、红包等

| 资源名称 | 尺寸 | 动画帧数 | 描述 |
|---------|------|---------|------|
| resource_gold | 64x64 | - | A pile of golden ingots and coins, Chinese New Yea... |
| resource_firework | 64x64 | - | A bundle of fireworks and firecrackers, colorful S... |
| hongbao | 48x48 | - | A red envelope (hongbao) with golden decorations, ... |

### 特效资源 - 爆炸、烟雾等

| 资源名称 | 尺寸 | 动画帧数 | 描述 |
|---------|------|---------|------|
| explosion | 128x128 | 6 | Firework explosion effect, colorful sparks, Spring... |
| smoke | 64x64 | 4 | Festive red and gold smoke effect, pixel art, cele... |

### UI 元素 - 按钮、面板等

| 资源名称 | 尺寸 | 动画帧数 | 描述 |
|---------|------|---------|------|
| ui_button | 120x40 | - | Game UI button with Spring Festival theme, red bac... |
| ui_panel | 300x200 | - | Game UI panel background, Chinese New Year decorat... |

### 地图瓦片 - 草地、道路等

| 资源名称 | 尺寸 | 动画帧数 | 描述 |
|---------|------|---------|------|
| tile_grass | 64x32 | - | Isometric grass tile with subtle Spring Festival d... |
| tile_path | 64x32 | - | Isometric stone path tile, traditional Chinese gar... |

## 雪碧图生成 (Spritesheet)

对于动画资源，可以使用 spritesmith 合成雪碧图:

```bash
npm run generate-spritesheet
```

详见 `scripts/generate-spritesheet.js`。

## 手动添加资源

如果需要手动添加资源:

1. 确保图片尺寸符合上表规格
2. 使用透明背景 PNG 格式
3. 遵循像素艺术风格
4. 使用春节主题配色（红、金、绿）
5. 放置到对应类别目录下
6. 更新 `manifest.json`

## 占位符

当前使用 Three.js 几何图形作为占位符。
生成实际资源后会自动替换。
