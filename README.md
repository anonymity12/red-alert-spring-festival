# 春节攻防战 (Spring Festival Battle)

一个使用 React + Three.js 构建的 2.5D 实时策略游戏，具有春节主题。

A 2.5D Real-Time Strategy (RTS) game built with React and Three.js, featuring a Spring Festival theme.

![Game Type](https://img.shields.io/badge/Type-RTS%20Game-red)
![Tech Stack](https://img.shields.io/badge/React-Three.js-blue)
![Status](https://img.shields.io/badge/Status-Playable%20MVP-green)

## 🎮 游戏特色 (Game Features)

- **2.5D 等距视角**: 使用 Three.js 实现的经典 RTS 游戏视角
- **春节主题**: 所有单位、建筑和资源都采用春节元素
- **实时策略**: 资源采集、建筑建造、单位生产和战斗
- **双人对战**: 通过 Socket.io 实现的实时多人对战（规划中）

## 🏗️ 技术栈 (Tech Stack)

### 前端 (Frontend)
- **React 19** - UI 框架
- **TypeScript** - 类型安全
- **Three.js** - 3D 渲染和等距视角
- **Vite** - 构建工具
- **Socket.io Client** - 实时通信

### 后端 (Backend)
- **Node.js + Express** - Web 服务器
- **Socket.io** - WebSocket 实时通信服务器

### 资源生成 (Asset Generation)
- **Gemini API** - AI 图片生成，自动生成春节主题游戏素材
- **Spritesmith** - 雪碧图合成，将动画帧合成为单张图片
- **自动化脚本** - 批量生成、分类管理、清单生成

## 🚀 快速开始 (Quick Start)

### 安装依赖 (Install Dependencies)

```bash
npm install
```

### 运行开发服务器 (Run Development Servers)

同时启动前端和后端服务器：
```bash
npm start
```

或者分别启动：

```bash
# 启动前端开发服务器 (端口 6100)
npm run dev

# 启动后端游戏服务器 (端口 6101)
npm run server
```

### 构建生产版本 (Build for Production)

```bash
npm run build
npm run preview
```

## 🎯 游戏玩法 (Gameplay)

### 核心目标
摧毁对方的基地！

### 资源系统
- 收集地图上的 **年货** (New Year Goods) 资源
- 使用资源建造建筑和生产单位

### 建筑类型
1. **基地 (Base)** - 主建筑，被摧毁即失败
2. **防御塔 (Tower)** - 自动攻击范围内的敌人 (成本: 150)
3. **兵营 (Barracks)** - 生产战斗单位 (成本: 200)

### 单位类型
1. **采集者 (Collector)** - 收集资源
2. **小鞭炮兵 (Firecracker Soldier)** - 远程攻击单位 (成本: 75)
3. **小年兽 (Nian Beast)** - 近战强力单位 (成本: 120)

### 操作说明
- **选择单位**: 点击己方单位进行选择
- **建造建筑**: 使用右侧控制面板的按钮
- **生产单位**: 建造兵营后可以生产战斗单位

## 📁 项目结构 (Project Structure)

```
red-alert-spring-festival/
├── client/                 # 前端代码
│   ├── src/
│   │   ├── components/    # React 组件
│   │   │   ├── Game.tsx   # 主游戏组件
│   │   │   └── Game.css   # 游戏样式
│   │   ├── game/          # 游戏引擎
│   │   │   ├── types.ts         # 类型定义
│   │   │   ├── constants.ts     # 游戏常量
│   │   │   ├── GameEngine.ts    # 游戏逻辑引擎
│   │   │   └── GameRenderer.ts  # Three.js 渲染器
│   │   ├── App.tsx        # 根组件
│   │   ├── main.tsx       # 入口文件
│   │   └── index.css      # 全局样式
│   └── index.html         # HTML 模板
├── server/                # 后端服务器
│   └── index.js          # Socket.io 服务器
├── scripts/              # 工具脚本
│   ├── generate-assets.js     # AI 资源生成脚本
│   └── generate-spritesheet.js # 雪碧图合成脚本
├── public/               # 静态资源
│   └── assets/          # 游戏资源
├── vite.config.ts       # Vite 配置
├── tsconfig.json        # TypeScript 配置
└── package.json         # 项目配置
```

## 🎨 资源生成 (Asset Generation)

项目包含完整的资源生成工具链，支持 AI 图片生成和雪碧图合成。

### 资源类别

| 类别 | 说明 | 示例 |
|------|------|------|
| **buildings** | 建筑资源 | 基地、塔楼、兵营、工厂 |
| **units** | 单位资源 | 采集者、鞭炮兵、年兽、舞龙人 |
| **resources** | 资源图标 | 金币、烟花、红包 |
| **effects** | 特效动画 | 爆炸、烟雾 |
| **ui** | 界面元素 | 按钮、面板 |
| **tiles** | 地图瓦片 | 草地、道路 |

### 使用 Gemini API 生成图片

```bash
# 设置 API Key 并生成所有资源
npm run generate-assets YOUR_GEMINI_API_KEY

# 或使用环境变量
export GEMINI_API_KEY=your_key_here
npm run generate-assets

# 只生成指定资源
node scripts/generate-assets.js YOUR_API_KEY --asset=base

# 查看所有可用资源
node scripts/generate-assets.js --list

# 模拟运行（不调用 API）
node scripts/generate-assets.js --dry-run
```

**获取 API Key**: https://makersuite.google.com/app/apikey

### 雪碧图合成

对于动画资源（单位、特效），需要将多帧图片合成为雪碧图：

```bash
# 安装 spritesmith（首次使用）
npm install --save-dev spritesmith

# 生成所有雪碧图
npm run generate-spritesheet

# 只处理指定资源
node scripts/generate-spritesheet.js --asset=nian_beast
```

### 生成的文件

运行脚本后会生成：

```
public/assets/
├── manifest.json           # 资源总清单
├── spritesheets.json       # 雪碧图清单
├── buildings/              # 建筑资源
│   ├── base.png
│   ├── tower.png
│   └── ...
├── units/                  # 单位资源
│   ├── collector.png
│   ├── collector_spritesheet.png
│   ├── collector_spritesheet.json
│   └── ...
├── effects/                # 特效资源
└── ui/                     # UI 资源
```

### 手动添加资源

如需手动添加资源：

1. 使用透明背景 PNG 格式
2. 遵循像素艺术风格
3. 使用春节主题配色（红、金、绿）
4. 放置到 `public/assets/{category}/` 目录
5. 更新 `manifest.json`

## 🔧 开发计划 (Development Roadmap)

- [x] 基础项目结构
- [x] Three.js 等距视角渲染
- [x] 游戏引擎和状态管理
- [x] 实体系统（单位、建筑、资源）
- [x] 基础 UI 和控制
- [x] Socket.io 服务器框架
- [ ] 完整的多人对战功能
- [ ] 单位移动和寻路系统
- [ ] 完善的战斗系统
- [ ] 春节主题美术资源
- [ ] 音效和背景音乐
- [ ] 游戏平衡和优化

## 🎮 游戏截图 (Screenshots)

*(开发中 - 当前使用几何体作为占位符)*

## 🤝 贡献 (Contributing)

欢迎提交 Issue 和 Pull Request！

## 📄 许可证 (License)

ISC

## 🎊 致谢 (Acknowledgments)

- 灵感来源于经典 RTS 游戏如《红色警戒》
- 春节主题致敬中国传统文化
- 使用 Three.js 社区的优秀资源和示例

---

**新年快乐！Happy Chinese New Year! 🧧🎆**