# 等距网格与相机视角修复报告

## 问题描述

用户反馈游戏地图上的网格大小不一致，看起来变形。

## 问题截图分析

修复前的截图显示：
- 网格线在不同区域间距不同
- 地图边缘是正方形，与等距视角不匹配
- 整体视觉效果不协调

## 根本原因

### 1. 使用了错误的网格类型

原代码使用 `THREE.GridHelper` 创建网格：

```typescript
const gridHelper = new THREE.GridHelper(
  gridWidth,
  GRID_SIZE,
  0x2d5a27,
  0x3d7a37,
);
```

**问题**: `THREE.GridHelper` 创建的是**正交网格**（正方形），它在 XZ 平面上绘制等间距的垂直和水平线。

但游戏使用的是**等距投影 (Isometric Projection)**，网格坐标通过以下公式转换：

```typescript
x = (col - row) * (TILE_SIZE / 2)
z = (col + row) * (TILE_SIZE / 4)
```

这个公式将正方形网格变换为**菱形**，但 `GridHelper` 不会自动适应这种变换。

### 2. 视角透视变形

当从等距相机角度观看正方形网格时：
- 不同区域的网格线在屏幕上投影长度不同
- 导致视觉上网格大小不一致

### 3. 地面形状不匹配

原来使用 `PlaneGeometry` 创建正方形地面：

```typescript
const groundGeometry = new THREE.PlaneGeometry(gridWidth, gridHeight);
ground.rotation.x = -Math.PI / 2;
```

但等距网格在世界空间中是**菱形**的：

```
        (0,0)         ← 网格原点
          ◆
        ╱   ╲
      ╱       ╲
    ◆           ◆     ← row=0 或 col=0 的边
  (19,0)     (0,19)
    ╲           ╱
      ╲       ╱
        ╲   ╱
          ◆
        (19,19)       ← 网格对角
```

---

## 解决方案

### 1. 创建自定义等距网格

用 `LineSegments` 手动绘制与坐标系统匹配的网格线：

```typescript
private createIsometricGrid() {
  const gridMaterial = new THREE.LineBasicMaterial({
    color: 0x3d7a37,
    transparent: true,
    opacity: 0.5,
  });

  const points: THREE.Vector3[] = [];

  // 沿 row 方向的线（固定 col，row 从 0 到 GRID_SIZE）
  for (let col = 0; col <= GRID_SIZE; col++) {
    const start = this.gridToWorldPos(0, col);
    const end = this.gridToWorldPos(GRID_SIZE, col);
    points.push(new THREE.Vector3(start.x, 1, start.z));
    points.push(new THREE.Vector3(end.x, 1, end.z));
  }

  // 沿 col 方向的线（固定 row，col 从 0 到 GRID_SIZE）
  for (let row = 0; row <= GRID_SIZE; row++) {
    const start = this.gridToWorldPos(row, 0);
    const end = this.gridToWorldPos(row, GRID_SIZE);
    points.push(new THREE.Vector3(start.x, 1, start.z));
    points.push(new THREE.Vector3(end.x, 1, end.z));
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const gridLines = new THREE.LineSegments(geometry, gridMaterial);
  this.scene.add(gridLines);
}
```

**原理**: 

使用与游戏逻辑相同的坐标转换函数 `gridToWorldPos()` 计算每条网格线的起点和终点，确保网格线与实际的格子边界完全对齐。

### 2. 创建菱形地面

用四个顶点定义菱形平面：

```typescript
private createGround() {
  // 获取等距网格的四个角点
  const corners = [
    this.gridToWorldPos(0, 0),           // 顶点 (屏幕上方)
    this.gridToWorldPos(0, GRID_SIZE),   // 右侧
    this.gridToWorldPos(GRID_SIZE, GRID_SIZE), // 底部
    this.gridToWorldPos(GRID_SIZE, 0),   // 左侧
  ];

  // 用两个三角形构建菱形
  const vertices = new Float32Array([
    // 三角形 1: 顶 → 右 → 底
    corners[0].x, 0, corners[0].z,
    corners[1].x, 0, corners[1].z,
    corners[2].x, 0, corners[2].z,
    // 三角形 2: 顶 → 底 → 左
    corners[0].x, 0, corners[0].z,
    corners[2].x, 0, corners[2].z,
    corners[3].x, 0, corners[3].z,
  ]);
  
  const groundGeometry = new THREE.BufferGeometry();
  groundGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  groundGeometry.computeVertexNormals();
  
  // ... 创建材质和网格
}
```

**原理**:

直接使用游戏网格的四个角点作为地面的顶点，确保地面形状与等距网格完全匹配。

### 3. 创建菱形边框

边框沿着等距网格的四条边绘制：

```typescript
private createIsometricBorder() {
  const corners = [
    this.gridToWorldPos(0, 0),
    this.gridToWorldPos(0, GRID_SIZE),
    this.gridToWorldPos(GRID_SIZE, GRID_SIZE),
    this.gridToWorldPos(GRID_SIZE, 0),
  ];

  for (let i = 0; i < 4; i++) {
    const start = corners[i];
    const end = corners[(i + 1) % 4];
    
    // 计算边的长度和角度
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dx, dz);
    
    // 创建边框盒子并旋转到正确角度
    const geometry = new THREE.BoxGeometry(borderWidth, borderHeight, length);
    const border = new THREE.Mesh(geometry, borderMaterial);
    border.position.set((start.x + end.x) / 2, borderHeight / 2, (start.z + end.z) / 2);
    border.rotation.y = angle;
    this.scene.add(border);
  }
}
```

### 4. 调整相机位置

相机需要正确定位才能让菱形地图看起来协调：

```typescript
// 计算等距网格中心
const gridCenterX = 0;
const gridCenterZ = (GRID_SIZE - 1) * (TILE_SIZE / 4); // = 304

// 相机位置：在地图后上方
this.camera.position.set(gridCenterX, 900, gridCenterZ + 500);
this.camera.lookAt(gridCenterX, 0, gridCenterZ);
```

**原理**:

- **Y = 900**: 相机高度，值越大越"俯视"
- **Z = gridCenterZ + 500**: 相机在地图中心的后方（Z 正方向）
- 相机看向地图中心 `(0, 0, 304)`

这样设置使得：
- 网格 (0, 0) 点（菱形顶点，Z=0）显示在屏幕上方
- 网格 (19, 19) 点（菱形底部，Z=608）显示在屏幕下方
- 整体呈现经典的等距RTS游戏视角

---

## 坐标系统可视化

### 世界坐标与网格坐标的关系

```
                    网格 (0, 0)
                    世界 (0, 0)
                        ◆
                      ╱   ╲
                    ╱       ╲
                  ╱           ╲
    网格 (19, 0) ◆               ◆ 网格 (0, 19)
    世界 (-608, 304)             世界 (608, 304)
                  ╲           ╱
                    ╲       ╱
                      ╲   ╱
                        ◆
                    网格 (19, 19)
                    世界 (0, 608)
```

### 相机视角示意图

```
                      相机位置
                    (0, 900, 804)
                         │
                         │ 俯视
                         ▼
    ┌─────────────────────────────────────┐
    │                 ◆ (0, 0)            │  ← 屏幕上方
    │               ╱   ╲                 │
    │             ╱       ╲               │
    │           ◆     ●     ◆             │  ← ● = 地图中心 (0, 0, 304)
    │             ╲       ╱               │
    │               ╲   ╱                 │
    │                 ◆ (19, 19)          │  ← 屏幕下方
    └─────────────────────────────────────┘
```

---

## 修改的文件

| 文件 | 修改内容 |
|------|----------|
| `client/src/game/GameRenderer.ts` | 替换 GridHelper 为自定义等距网格，替换正方形地面为菱形，调整边框和相机位置 |

## 新增的方法

| 方法 | 功能 |
|------|------|
| `createIsometricGrid()` | 创建与游戏坐标系统匹配的菱形网格线 |
| `gridToWorldPos(row, col)` | 将网格坐标转换为世界坐标（辅助方法） |
| `createIsometricBorder()` | 创建沿菱形边缘的边框 |

---

## 效果对比

### 修复前

- ❌ 正方形网格，与等距投影不匹配
- ❌ 网格线间距在不同区域看起来不一致
- ❌ 地面是正方形，超出游戏有效区域

### 修复后

- ✅ 菱形网格，与游戏坐标系统完全匹配
- ✅ 所有格子大小一致
- ✅ 地面、边框、网格线都是正确的菱形
- ✅ 相机视角使菱形顶点朝上，符合经典RTS游戏风格

---

## 技术要点总结

1. **等距投影的本质**: 将 2D 正方形网格映射到 3D 空间中的菱形
2. **一致性原则**: 所有可视化元素（地面、网格线、边框）都必须使用相同的坐标转换函数
3. **相机定位**: 正交相机的位置决定了地图在屏幕上的方向，需要精心调整以获得理想的视觉效果
4. **避免使用预制帮助类**: `THREE.GridHelper` 等工具类假设正交坐标系，不适用于等距投影

---

## 参考

- [Isometric Projection Mathematics](https://en.wikipedia.org/wiki/Isometric_projection)
- [Three.js BufferGeometry](https://threejs.org/docs/#api/en/core/BufferGeometry)
- [Three.js OrthographicCamera](https://threejs.org/docs/#api/en/cameras/OrthographicCamera)