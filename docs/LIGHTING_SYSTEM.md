# 游戏光照系统文档

## 概述

本游戏使用 Three.js 的三层光照系统，模拟自然的户外阳光环境，同时保持经典 RTS 游戏的视觉风格。

## 光照架构

```
┌─────────────────────────────────────────────────────────────┐
│                        游戏场景                              │
│                                                              │
│   ☀️ 平行光 (Directional Light)                             │
│      ╲  45°角斜射                                           │
│       ╲                                                      │
│        ╲    ☁️ 半球光 (Hemisphere Light)                    │
│         ╲      天空色 ↓                                      │
│          ╲                                                   │
│           ▼                                                  │
│   ┌─────────────────────┐                                   │
│   │     游戏地图        │  ← 💡 环境光 (Ambient Light)       │
│   │   🏠  🧍  🌾        │       均匀照亮所有表面              │
│   │  ▓▓▓▓▓▓▓▓▓▓▓▓▓     │  ← 阴影区域                        │
│   └─────────────────────┘                                   │
│           ↑                                                  │
│      地面色反射                                              │
└─────────────────────────────────────────────────────────────┘
```

## 三层光照详解

### 1. 环境光 (Ambient Light)

**作用**: 提供场景的基础照明，确保所有物体都可见，阴影区域不会全黑。

```typescript
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
```

| 参数 | 值 | 说明 |
|------|-----|------|
| 颜色 | `0xffffff` | 纯白色 |
| 强度 | `0.5` | 50% 强度，保留阴影对比度 |

**特点**:
- 无方向性，均匀照亮所有表面
- 不产生阴影
- 用于填充阴影区域，防止全黑

### 2. 平行光 (Directional Light)

**作用**: 模拟太阳光，是场景的主光源，产生阴影。

```typescript
const lightDistance = 800;
const lightAngle = (20 * Math.PI) / 180; // 20度转弧度
const lightHeight = lightDistance * Math.tan(lightAngle); // 20度角高度

const directionalLight = new THREE.DirectionalLight(0xfffaf0, 0.9);
directionalLight.position.set(
  -lightDistance,   // X: 从左侧
  lightHeight,      // Y: 高度 (20度角)
  0,                // Z: 侧面
);
```

| 参数 | 值 | 说明 |
|------|-----|------|
| 颜色 | `0xfffaf0` | 暖白色 (Floral White)，模拟阳光 |
| 强度 | `0.9` | 90% 强度，作为主光源 |
| 角度 | 20° | 与地面成 20 度角，低角度斜射 |

#### 20 度角计算原理

```
                                        光源位置
                                           ☀️
                                          ╱│
                                        ╱  │ height = distance × tan(20°)
                                      ╱    │        = distance × 0.364
                                    ╱ 20°  │
                                  ╱────────┘
                               地图中心
```

**数学公式**:
```
tan(20°) = 对边 / 邻边 = height / distance ≈ 0.364

因此: height = distance × 0.364
```

当 `lightDistance = 800` 时:
- `lightHeight = 800 × tan(20°) = 800 × 0.364 ≈ 291`
- 光源位置: `(-800, 291, 0)` （从屏幕左侧照射）

#### 光照方向

```
        屏幕上方 (Z-)
             ↑
             │
             │
   ☀️ ───────┼───────→ 屏幕右侧 (X+)
  20°╲       │
      ╲      │
       ▼     │
      地图中心
      
   光源从屏幕左侧 (X-) 照射
```

光源从**屏幕左侧**以 20 度低角度照向地图，产生向**右侧**的长阴影。

低角度光照特点：
- 阴影更长，更有戏剧性
- 模拟清晨或傍晚的阳光效果
- 增强地形和物体的立体感

### 3. 半球光 (Hemisphere Light)

**作用**: 模拟天空和地面的环境反射，增加场景的自然感。

```typescript
const hemisphereLight = new THREE.HemisphereLight(
  0x87ceeb,  // 天空色 (Sky Blue)
  0x3d5c3d,  // 地面色 (Grass Green)
  0.4
);
```

| 参数 | 值 | 说明 |
|------|-----|------|
| 天空色 | `0x87ceeb` | 天蓝色 |
| 地面色 | `0x3d5c3d` | 草绿色 |
| 强度 | `0.4` | 40% 强度，辅助光源 |

**工作原理**:
- 物体朝上的表面接收天空色光照
- 物体朝下的表面接收地面色光照
- 创造户外自然光照效果

```
        天空 (蓝色光 ↓)
    ════════════════════
           ↓ ↓ ↓
         ┌─────┐
         │ 物体 │  ← 顶面偏蓝
         └─────┘  ← 底面偏绿
           ↑ ↑ ↑
    ════════════════════
        地面 (绿色反射 ↑)
```

---

## 阴影系统

### 阴影配置

```typescript
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 100;
directionalLight.shadow.camera.far = 2000;

const shadowSize = 800;
directionalLight.shadow.camera.left = -shadowSize;
directionalLight.shadow.camera.right = shadowSize;
directionalLight.shadow.camera.top = shadowSize;
directionalLight.shadow.camera.bottom = -shadowSize;

directionalLight.shadow.bias = -0.001;
```

### 阴影参数说明

| 参数 | 值 | 说明 |
|------|-----|------|
| `mapSize` | 2048×2048 | 阴影贴图分辨率，越高越清晰 |
| `camera.near/far` | 100-2000 | 阴影相机的近远裁剪面 |
| `camera.left/right/top/bottom` | ±800 | 阴影覆盖范围 |
| `bias` | -0.001 | 阴影偏移，防止自阴影失真 |

### 阴影相机可视化

```
          阴影相机视锥体
    ┌─────────────────────┐  ← top = 800
    │                     │
    │    ┌───────────┐    │
    │    │  可见区域  │    │  ← 地图范围
    │    │   (阴影)   │    │
    │    └───────────┘    │
    │                     │
    └─────────────────────┘  ← bottom = -800
    ↑                     ↑
 left=-800            right=800
```

### 阴影失真 (Shadow Acne) 问题

当 `bias = 0` 时，可能出现条纹状阴影失真：

```
正常阴影          阴影失真 (Shadow Acne)
┌────────┐       ┌────────┐
│████████│       │▓░▓░▓░▓░│  ← 条纹状失真
│████████│       │░▓░▓░▓░▓│
└────────┘       └────────┘
```

设置 `bias = -0.001` 可以消除这种失真。

---

## 光照强度调节

### 不同场景的光照配置建议

#### 明亮白天 (当前设置)
```typescript
ambientLight.intensity = 0.5;
directionalLight.intensity = 0.9;
hemisphereLight.intensity = 0.4;
```

#### 黄昏
```typescript
ambientLight.intensity = 0.3;
directionalLight.intensity = 0.6;
directionalLight.color.setHex(0xffa500); // 橙色
hemisphereLight.intensity = 0.3;
```

#### 夜晚
```typescript
ambientLight.intensity = 0.2;
directionalLight.intensity = 0.3;
directionalLight.color.setHex(0x4444ff); // 月光蓝
hemisphereLight.intensity = 0.1;
```

---

## 性能优化

### 阴影贴图分辨率权衡

| 分辨率 | 质量 | 性能影响 |
|--------|------|----------|
| 512×512 | 低 | 最快 |
| 1024×1024 | 中 | 推荐移动端 |
| 2048×2048 | 高 | 当前设置 |
| 4096×4096 | 极高 | 性能开销大 |

### 优化建议

1. **移动端**: 降低 `shadow.mapSize` 到 1024
2. **减少阴影对象**: 只对重要物体启用 `castShadow`
3. **静态阴影**: 对于不移动的建筑，可以使用烘焙阴影

---

## 代码位置

光照系统代码位于:
```
client/src/game/GameRenderer.ts
├── setupLights() 方法
│   ├── AmbientLight 创建
│   ├── DirectionalLight 创建和配置
│   └── HemisphereLight 创建
```

---

## 参考资料

- [Three.js Lights Documentation](https://threejs.org/docs/#api/en/lights/Light)
- [Three.js Shadows](https://threejs.org/docs/#api/en/lights/shadows/DirectionalLightShadow)
- [Understanding 3-Point Lighting](https://en.wikipedia.org/wiki/Three-point_lighting)
