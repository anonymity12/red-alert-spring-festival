# 游戏坐标系统文档

## 概述

本游戏使用**等距投影 (Isometric Projection)** 来呈现 2.5D 视觉效果。这种投影方式将 2D 网格坐标转换为 3D 世界坐标，在屏幕上呈现为菱形网格。

## 坐标系统类型

游戏中存在三种坐标系统：

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Grid Position  │ ──► │ World Position  │ ──► │Screen Position  │
│   (row, col)    │     │    (x, y, z)    │     │   (clientX, Y)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     网格坐标              Three.js 世界坐标          屏幕像素坐标
```

### 1. 网格坐标 (Grid Position)

- **类型**: `{ row: number, col: number }`
- **范围**: `row: 0-19`, `col: 0-19` (20x20 网格)
- **用途**: 游戏逻辑、实体位置、寻路算法

```
       col →
    0   1   2   3  ...  19
  ┌───┬───┬───┬───┬───┬───┐
0 │   │   │   │   │   │   │
  ├───┼───┼───┼───┼───┼───┤
1 │   │   │   │   │   │   │  row
  ├───┼───┼───┼───┼───┼───┤   ↓
2 │   │ ★ │   │   │   │   │  ← 例: (row=2, col=1)
  ├───┼───┼───┼───┼───┼───┤
  ...
```

### 2. 世界坐标 (World Position)

- **类型**: `{ x: number, y: number, z: number }`
- **坐标轴**:
  - `x`: 左右方向（正值向右）
  - `y`: 上下方向（垂直高度，地面为 0）
  - `z`: 前后方向（正值向摄像机方向）
- **用途**: Three.js 渲染、物理位置

### 3. 屏幕坐标 (Screen Position)

- **类型**: `{ clientX: number, clientY: number }`
- **范围**: 取决于浏览器窗口和 canvas 大小
- **用途**: 鼠标点击检测、UI 交互

---

## 坐标转换公式

### Grid → World (网格到世界)

```typescript
// constants.ts
export const TILE_SIZE = 64; // 每个格子的像素大小

export function gridToWorld(grid: GridPosition): Position {
  const x = (grid.col - grid.row) * (TILE_SIZE / 2);
  const z = (grid.col + grid.row) * (TILE_SIZE / 4);
  return { x, y: 0, z };
}
```

**计算示例**:

| 网格坐标 (row, col) | 世界坐标 (x, z) | 说明 |
|---------------------|-----------------|------|
| (0, 0) | (0, 0) | 网格原点 |
| (0, 19) | (608, 304) | 右下角 |
| (19, 0) | (-608, 304) | 左下角 |
| (19, 19) | (0, 608) | 正下方 |
| (10, 10) | (0, 320) | 中心 |

### World → Grid (世界到网格)

```typescript
// constants.ts
export function worldToGrid(pos: Position): GridPosition {
  const col = Math.round((pos.x / (TILE_SIZE / 2) + pos.z / (TILE_SIZE / 4)) / 2);
  const row = Math.round((pos.z / (TILE_SIZE / 4) - pos.x / (TILE_SIZE / 2)) / 2);
  return { row, col };
}
```

**推导过程**:
```
已知:
  x = (col - row) * (TILE_SIZE / 2)
  z = (col + row) * (TILE_SIZE / 4)

设 A = TILE_SIZE / 2 = 32
   B = TILE_SIZE / 4 = 16

则:
  x = (col - row) * A  →  x/A = col - row  ... (1)
  z = (col + row) * B  →  z/B = col + row  ... (2)

(1) + (2): x/A + z/B = 2*col  →  col = (x/A + z/B) / 2
(2) - (1): z/B - x/A = 2*row  →  row = (z/B - x/A) / 2
```

### Screen → World (屏幕到世界)

使用 Three.js 的 Raycaster 进行射线检测：

```typescript
// GameRenderer.ts
screenToWorld(x: number, y: number, container: HTMLElement): GridPosition | null {
  const rect = container.getBoundingClientRect();
  
  // 1. 将屏幕坐标转换为标准化设备坐标 (NDC: -1 到 1)
  const ndcX = ((x - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((y - rect.top) / rect.height) * 2 + 1;
  
  // 2. 从相机发射射线
  this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
  
  // 3. 与地面平面 (y=0) 求交点
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersectPoint = new THREE.Vector3();
  this.raycaster.ray.intersectPlane(groundPlane, intersectPoint);
  
  // 4. 将世界坐标转换为网格坐标
  const { row, col } = worldToGrid(intersectPoint);
  
  // 5. 验证边界
  if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
    return { row, col };
  }
  return null;
}
```

---

## 等距网格的几何形状

### 地图在屏幕上的呈现

等距投影将正方形网格变换为**菱形**：

```
                    (0,0)
                      ◆
                    ╱   ╲
                  ╱       ╲
                ╱           ╲
              ╱               ╲
            ╱                   ╲
    (19,0) ◆                     ◆ (0,19)
            ╲                   ╱
              ╲               ╱
                ╲           ╱
                  ╲       ╱
                    ╲   ╱
                      ◆
                    (19,19)
```

### 世界坐标范围

根据坐标转换公式计算出的实际范围：

```
X 轴范围 (由 col - row 决定):
  最小: col=0, row=19  →  x = (0 - 19) * 32 = -608
  最大: col=19, row=0  →  x = (19 - 0) * 32 = +608

Z 轴范围 (由 col + row 决定):
  最小: col=0, row=0   →  z = (0 + 0) * 16 = 0
  最大: col=19, row=19 →  z = (19 + 19) * 16 = 608
```

**结论**: 等距网格在世界坐标中覆盖一个菱形区域：
- X: -608 到 +608
- Z: 0 到 608

---

## 已知问题：地图右上角无法点击

### 问题描述

用户反馈地图右上角（红色圈出区域）无法点击选择单位或发出移动命令。

### 根本原因

地面平面 (Ground Plane) 与等距网格的位置不匹配：

```
              ┌─────────────────────┐
              │                     │
              │   Ground Plane      │  ← 正方形地面
              │   中心: (0, 0)      │     x: [-640, 640]
              │   大小: 1280x1280   │     z: [-640, 640]
              │                     │
              └─────────────────────┘
                        vs.

                      ◆ (0,0)
                    ╱   ╲
                  ╱       ╲
                ╱  菱形    ╲          ← 等距网格
              ◆   网格      ◆            x: [-608, 608]
                ╲         ╱              z: [0, 608]
                  ╲     ╱
                    ╲ ╱
                      ◆ (19,19)
```

**问题**:
1. 地面平面中心在 `z=0`，但等距网格的 Z 范围是 `0 到 608`
2. 点击地面 `z < 0` 的区域（屏幕上方）时，转换出的网格坐标超出有效范围
3. `screenToWorld()` 返回 `null`，导致无法交互

### 视觉说明

```
        屏幕显示:

    ┌─────────────────────────────────┐
    │                                 │
    │   ╔═══════════════════╗        │  ← 棕色边框
    │   ║ × × × × × × × × × ║        │
    │   ║ × × ◆─────────◆ × ║        │  × = 无法点击的区域
    │   ║ × ╱             ╲ ×║        │
    │   ║ ╱   可点击区域    ╲║        │  ◆ = 菱形网格边界
    │   ╠◆                  ◆╣        │
    │   ║ ╲                ╱ ║        │
    │   ║   ╲            ╱   ║        │
    │   ║     ╲        ╱     ║        │
    │   ║       ╲    ╱       ║        │
    │   ║         ◆          ║        │
    │   ╚═══════════════════╝        │
    │                                 │
    └─────────────────────────────────┘
```

---

## 解决方案

### 方案 1: 调整地面平面位置 ✅ 已实施

将地面平面的中心移动到等距网格的几何中心：

```typescript
// 等距网格的几何中心
const gridCenterX = 0;                    // (-608 + 608) / 2 = 0
const gridCenterZ = (GRID_SIZE - 1) * (TILE_SIZE / 4);  // 19 * 16 = 304

// 调整地面位置
ground.position.set(gridCenterX, 0, gridCenterZ);
gridHelper.position.set(gridCenterX, 1, gridCenterZ);

// 调整相机位置，使其看向网格中心
this.camera.position.set(gridCenterX + 500, 700, gridCenterZ + 500);
this.camera.lookAt(gridCenterX, 0, gridCenterZ);

// 调整边框位置
this.createBorder(gridWidth, gridHeight, gridCenterX, gridCenterZ);
```

**修复文件**: `client/src/game/GameRenderer.ts`

**修复内容**:
1. 计算等距网格的几何中心 `(0, 304)`
2. 将地面平面移动到网格中心
3. 将网格辅助线移动到网格中心
4. 将相机对准网格中心
5. 将边框移动到网格中心
6. 在窗口 resize 时保持相机对准网格中心

### 方案 2: 扩大有效点击区域 (备选)

在边界检查时添加容错范围，并将超出范围的点钳制到最近的有效位置：

```typescript
screenToWorld(x: number, y: number, container: HTMLElement): GridPosition | null {
  // ... 获取交点 ...
  
  // 钳制到有效范围而不是返回 null
  const row = Math.max(0, Math.min(GRID_SIZE - 1, calculatedRow));
  const col = Math.max(0, Math.min(GRID_SIZE - 1, calculatedCol));
  
  return { row, col };
}
```

### 方案 3: 重新设计网格原点 (备选)

将网格 (0,0) 放在网格中心而不是角落：

```typescript
// 新的转换公式，以网格中心为原点
function gridToWorld(grid: GridPosition): Position {
  const centerOffset = (GRID_SIZE - 1) / 2; // 9.5
  const adjustedRow = grid.row - centerOffset;
  const adjustedCol = grid.col - centerOffset;
  
  const x = (adjustedCol - adjustedRow) * (TILE_SIZE / 2);
  const z = (adjustedCol + adjustedRow) * (TILE_SIZE / 4);
  return { x, y: 0, z };
}
```

---

## 调试工具

### 添加坐标显示

在鼠标移动时显示当前坐标，便于调试：

```typescript
container.addEventListener('mousemove', (event) => {
  const worldPos = renderer.screenToWorld(event.clientX, event.clientY, container);
  if (worldPos) {
    console.log(`Grid: (${worldPos.row}, ${worldPos.col})`);
  } else {
    console.log('Out of bounds');
  }
});
```

### 可视化网格边界

添加辅助线显示等距网格的实际边界：

```typescript
function createIsometricBoundary() {
  const corners = [
    gridToWorld({ row: 0, col: 0 }),       // 顶点
    gridToWorld({ row: 0, col: GRID_SIZE - 1 }),   // 右
    gridToWorld({ row: GRID_SIZE - 1, col: GRID_SIZE - 1 }), // 底
    gridToWorld({ row: GRID_SIZE - 1, col: 0 }),   // 左
  ];
  
  const points = corners.map(p => new THREE.Vector3(p.x, 2, p.z));
  points.push(points[0]); // 闭合
  
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const line = new THREE.Line(geometry, material);
  scene.add(line);
}
```

---

## 常见问题 FAQ

### Q: 为什么使用等距投影而不是透视投影？

A: 等距投影具有以下优势：
- 物体大小不随距离变化，便于视觉判断
- 更适合策略游戏的俯视视角
- 经典 RTS 游戏（如红警、星际争霸）的标准呈现方式

### Q: 为什么 TILE_SIZE 要除以 2 和 4？

A: 这是为了产生正确的等距比例：
- 除以 2 控制 X 方向（水平）的间距
- 除以 4 控制 Z 方向（深度）的间距
- 2:1 的比例产生标准的等距菱形（约 26.57° 倾斜）

### Q: 如何添加高度支持（如建筑物高度）？

A: 在 `gridToWorld` 中添加 y 参数：

```typescript
function gridToWorld(grid: GridPosition, height: number = 0): Position {
  const x = (grid.col - grid.row) * (TILE_SIZE / 2);
  const z = (grid.col + grid.row) * (TILE_SIZE / 4);
  return { x, y: height, z };
}
```

---

## 修复历史

| 日期 | 问题 | 解决方案 |
|------|------|----------|
| 2024 | 地图右上角无法点击 | 方案 1: 调整地面平面和相机位置到等距网格中心 |

---

## 参考资料

- [Isometric Projection - Wikipedia](https://en.wikipedia.org/wiki/Isometric_projection)
- [Three.js Raycaster Documentation](https://threejs.org/docs/#api/en/core/Raycaster)
- [Game Programming Patterns - Spatial Partition](https://gameprogrammingpatterns.com/spatial-partition.html)