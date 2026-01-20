# 开发指南 (Development Guide)

欢迎为《春节攻防战》做贡献！

## 开发环境设置

### 前置要求
- Node.js 16+ 
- npm 或 yarn
- 现代浏览器（Chrome, Firefox, Safari）

### 安装步骤

1. 克隆仓库
```bash
git clone https://github.com/anonymity12/red-alert-spring-festival.git
cd red-alert-spring-festival
```

2. 安装依赖
```bash
npm install
```

3. 启动开发服务器
```bash
npm start  # 同时启动前端和后端
```

或分别启动：
```bash
npm run dev     # 前端开发服务器 (端口 6100)
npm run server  # 后端游戏服务器 (端口 6101)
```

## 项目架构

### 前端 (Client)
- **React** - UI 框架
- **TypeScript** - 类型系统
- **Three.js** - 3D 渲染引擎
- **Vite** - 构建工具

### 核心模块

#### 1. Game Engine (`client/src/game/GameEngine.ts`)
游戏逻辑核心，处理：
- 游戏状态管理
- 实体创建和销毁
- 玩家行动处理
- 胜负判定

#### 2. Game Renderer (`client/src/game/GameRenderer.ts`)
Three.js 渲染系统，负责：
- 等距视角相机设置
- 3D 场景管理
- 实体网格创建
- 健康条渲染
- 鼠标拾取（点击检测）

#### 3. Types (`client/src/game/types.ts`)
TypeScript 类型定义：
- 实体类型枚举
- 游戏状态接口
- 行动类型定义

#### 4. Constants (`client/src/game/constants.ts`)
游戏常量和工具函数：
- 实体统计数据
- 网格和世界坐标转换
- 游戏平衡参数

### 后端 (Server)
- **Express** - HTTP 服务器
- **Socket.io** - WebSocket 实时通信

## 代码规范

### TypeScript
- 使用严格模式
- 所有函数必须有类型标注
- 优先使用接口而非类型别名

### React
- 函数组件 + Hooks
- 使用 TypeScript FC 类型
- Props 必须定义接口

### 命名规范
- 组件：PascalCase (`GameEngine`, `GameRenderer`)
- 函数：camelCase (`handleClick`, `updateEntities`)
- 常量：UPPER_SNAKE_CASE (`GRID_SIZE`, `TILE_SIZE`)
- 文件：与导出内容匹配

## 添加新实体类型

### 1. 更新类型定义
```typescript
// client/src/game/types.ts
export enum EntityType {
  // ... 现有类型
  NEW_UNIT = 'new_unit'
}
```

### 2. 添加统计数据
```typescript
// client/src/game/constants.ts
export const ENTITY_STATS = {
  // ... 现有统计
  [EntityType.NEW_UNIT]: {
    maxHealth: 100,
    speed: 2,
    attack: 15,
    attackRange: 3,
    cost: 100
  }
}
```

### 3. 添加渲染逻辑
```typescript
// client/src/game/GameRenderer.ts
private createEntityMesh(entity: Entity): THREE.Mesh {
  switch (entity.type) {
    // ... 现有案例
    case EntityType.NEW_UNIT:
      geometry = new THREE.BoxGeometry(30, 30, 30);
      material = new THREE.MeshLambertMaterial({ color: 0xff00ff });
      break;
  }
}
```

### 4. 添加 UI 按钮
```typescript
// client/src/components/Game.tsx
<button onClick={() => handleProduceUnit(EntityType.NEW_UNIT)}>
  🎯 New Unit (100)
</button>
```

## 测试

### 手动测试
1. 启动开发服务器
2. 在浏览器中打开 http://localhost:6100
3. 测试各项功能：
   - 建造建筑
   - 生产单位
   - 选择实体
   - 资源消耗

### 构建测试
```bash
npm run build
npm run preview
```

## 调试技巧

### Three.js 调试
在浏览器控制台中：
```javascript
// 访问场景
window.scene = scene;

// 查看所有实体
console.log(Array.from(gameEngine.getState().entities.values()));
```

### 性能分析
- 使用 Chrome DevTools Performance 面板
- 监控帧率（目标 60 FPS）
- 检查内存泄漏

## 资源生成

### 使用 AI 生成图片
```bash
npm run generate-assets
```

查看 `public/assets/README.md` 获取详细说明。

### 创建雪碧图
1. 准备动画帧图片
2. 安装 spritesmith：`npm install --save-dev spritesmith`
3. 配置构建脚本合成雪碧图

## 提交代码

### 分支策略
- `main` - 稳定版本
- `develop` - 开发版本
- `feature/*` - 新功能
- `fix/*` - Bug 修复

### Commit 信息格式
```
<type>: <subject>

<body>
```

类型：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式
- `refactor`: 重构
- `test`: 测试
- `chore`: 构建/工具

### Pull Request
1. Fork 仓库
2. 创建功能分支
3. 提交更改
4. 推送到 Fork
5. 创建 Pull Request

## 常见问题

### Q: Three.js 场景是黑色的
A: 检查灯光设置和相机位置。确保实体在相机视野内。

### Q: Socket.io 连接失败
A: 确保后端服务器在 6101 端口运行。检查 CORS 设置。

### Q: 性能问题
A: 减少实体数量，优化网格复杂度，使用实例化渲染。

## 资源

- [Three.js 文档](https://threejs.org/docs/)
- [React 文档](https://react.dev/)
- [Socket.io 文档](https://socket.io/docs/)
- [TypeScript 手册](https://www.typescriptlang.org/docs/)

## 联系方式

如有问题，请：
1. 查看现有 Issues
2. 创建新 Issue
3. 在 Discussions 中讨论

感谢你的贡献！🎊
