# 游戏渲染问题修复报告

**项目**: Spring Festival Battle (春节攻防战)  
**日期**: 2025年1月  
**问题**: 游戏画面显示黑屏，无法看到游戏场景  

---

## 问题描述

启动前端开发服务器后，游戏界面左侧的 Canvas 区域显示为纯黑色，无法看到任何游戏内容。控制台最初显示多个资源加载失败的警告。

### 症状表现
- 游戏 Canvas 区域完全黑色
- 控制台显示 "Failed to load texture" 警告
- UI 控制面板正常显示
- 无 JavaScript 错误

---

## 问题分析

经过逐步排查，发现存在以下多个问题：

### 问题 1: 静态资源路径配置错误

**原因**: Vite 配置中 `root` 设置为 `./client`，导致静态资源目录 `public` 的查找路径错误。

Vite 默认会在 `root` 目录下查找 `public` 文件夹，即 `client/public`，但实际资源位于项目根目录的 `public` 文件夹中。

**修复**: 在 `vite.config.ts` 中添加 `publicDir` 配置：

```typescript
export default defineConfig({
  plugins: [react()],
  root: "./client",
  publicDir: "../public",  // 新增：指向正确的 public 目录
  // ...
});
```

### 问题 2: 相机位置和视角配置不当

**原因**: 正交相机的初始配置存在多个问题：

1. 相机位置 `(0, 1000, 0)` 直接从正上方往下看
2. `up` 向量设置为 `(0, 0, -1)` 导致渲染方向异常
3. `frustumSize` 计算可能与实际场景大小不匹配

**修复**: 调整相机为标准等距视角：

```typescript
// 修复前
this.camera.position.set(0, 1000, 0);
this.camera.lookAt(0, 0, 0);
this.camera.up.set(0, 0, -1);

// 修复后
this.camera.position.set(500, 700, 500);
this.camera.lookAt(0, 0, 0);
// 使用默认 up 向量 (0, 1, 0)
```

### 问题 3: React StrictMode 导致双重初始化

**原因**: React 18 的 StrictMode 在开发模式下会故意执行两次 `useEffect`，导致：

1. 创建两个 WebGL 渲染器
2. 两个 Canvas 元素叠加
3. 可能的资源竞争和内存泄漏

**修复**: 在 `Game.tsx` 的 useEffect 中添加清理逻辑：

```typescript
useEffect(() => {
  const container = canvasRef.current;
  
  // 清理已存在的 canvas 元素
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  
  // 初始化渲染器...
  
  return () => {
    // 完整的清理逻辑
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (rendererRef.current) {
      rendererRef.current.dispose();
    }
    // 清理 DOM
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  };
}, []);
```

### 问题 4: Canvas 容器样式问题

**原因**: `.game-canvas` 容器可能在初始化时尺寸为 0，或者缺少必要的样式属性。

**修复**: 更新 CSS 确保容器有最小尺寸：

```css
.game-canvas {
    flex: 1;
    min-width: 600px;
    min-height: 400px;
    background: #1a1a2e;
    border-radius: 10px;
    overflow: hidden;
}
```

同时在渲染器中确保 canvas 填充容器：

```typescript
this.renderer.domElement.style.width = "100%";
this.renderer.domElement.style.height = "100%";
this.renderer.domElement.style.display = "block";
```

---

## 修改的文件清单

| 文件路径 | 修改内容 |
|---------|---------|
| `vite.config.ts` | 添加 `publicDir: "../public"` 配置 |
| `client/src/game/GameRenderer.ts` | 修复相机位置和视角配置 |
| `client/src/components/Game.tsx` | 添加 StrictMode 兼容的清理逻辑 |
| `client/src/components/Game.css` | 添加容器最小尺寸样式 |

---

## 调试过程

### 添加的调试信息

在排查过程中添加了以下调试输出，帮助定位问题：

```typescript
// GameRenderer.ts
console.log("🎮 GameRenderer initialized:");
console.log(`   Container size: ${container.clientWidth}x${container.clientHeight}`);
console.log(`   World size: ${GRID_SIZE * TILE_SIZE}`);
console.log(`   Camera position:`, this.camera.position);

// debugScene() 方法
console.log("🔍 Scene debug info:");
console.log(`   Children count: ${this.scene.children.length}`);
console.log(`   Entity meshes: ${this.entityMeshes.size}`);
```

### 关键调试发现

1. **Container size: 1560x932** - 容器尺寸正常
2. **Children count: 21** - 场景中有对象
3. **Entity meshes: 12** - 实体已创建
4. 问题出在相机看不到这些对象

---

## 验证结果

修复后的游戏画面正常显示：

- ✅ 绿色草地背景
- ✅ 棕色边框
- ✅ 网格线
- ✅ 红色方块（玩家1基地）
- ✅ 蓝色方块（玩家2基地）
- ✅ 金色八面体（资源点）
- ✅ 光照和阴影效果

---

## 经验教训

### 1. Vite 项目的静态资源配置
当使用非默认的 `root` 目录时，需要显式配置 `publicDir` 指向正确的静态资源目录。

### 2. Three.js 相机配置
正交相机的配置需要考虑：
- frustum 大小与场景匹配
- 相机位置能够看到场景中心
- up 向量通常保持默认 `(0, 1, 0)`

### 3. React StrictMode 与 WebGL
在 React 18+ 中使用 WebGL/Canvas 时，必须：
- 在 useEffect 中正确清理资源
- 处理可能的双重初始化
- 使用 ref 跟踪实例状态

### 4. 渐进式调试
添加详细的调试日志可以快速定位问题：
- 容器尺寸
- 场景内容
- 相机参数
- WebGL 上下文状态

---

## 后续建议

1. **移除调试代码**: 问题修复后，可以移除或注释掉调试日志
2. **添加错误边界**: 使用 React Error Boundary 捕获渲染错误
3. **资源加载状态**: 添加加载指示器，在资源加载完成前显示加载动画
4. **性能优化**: 考虑使用 `requestAnimationFrame` 的节流优化

---

*报告生成时间: 2025年1月*