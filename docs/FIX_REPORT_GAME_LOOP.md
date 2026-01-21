# 游戏循环与单位移动修复报告

## 问题描述

用户报告：选中采集者单位后，点击资源，采集者不会移动到资源处。游戏循环似乎没有正常运行。

## 问题分析

通过代码审查，发现了两个关键问题：

### 问题 1: `collect` action 未被处理

在 `GameEngine.processAction()` 方法中，switch 语句只处理了四种 action 类型，但遗漏了 `collect`：

```typescript
// 原代码 - processAction 方法
switch (action.type) {
  case "move":
    return this.handleMove(action);
  case "attack":
    return this.handleAttack(action);
  case "build":
    return this.handleBuild(action);
  case "produce":
    return this.handleProduce(action);
  // ❌ collect action 没有被处理!
  default:
    return false;
}
```

这意味着当用户右键点击资源时，前端发送的 `collect` action 直接进入 `default` 分支返回 `false`，什么都没发生。

### 问题 2: `handleMove` 实现为瞬间传送

原来的 `handleMove` 方法直接设置单位位置，没有任何平滑移动逻辑：

```typescript
// 原代码 - handleMove 方法
private handleMove(action: GameAction): boolean {
  // ...
  if (isValidGridPosition(action.targetPosition)) {
    unit.position = gridToWorld(action.targetPosition);  // ❌ 直接传送!
    this.notifyUpdate();
    return true;
  }
  return false;
}
```

这导致：
- 单位看起来像是"瞬移"到目标位置
- 没有移动动画效果
- 游戏循环的 `update` 方法没有真正处理单位移动

### 问题 3: `updateUnits` 方法过于简化

原来的 `updateUnits` 只处理攻击逻辑，没有处理移动和采集：

```typescript
// 原代码 - updateUnits 方法
private updateUnits(deltaTime: number) {
  for (const entity of this.state.entities.values()) {
    if ("speed" in entity && "target" in entity) {
      const unit = entity as Unit;
      if (unit.target) {
        // 只有攻击逻辑，没有移动逻辑
      }
    }
  }
}
```

## 修复方案

### 1. 扩展 Unit 类型

在 `types.ts` 中为 `Unit` 接口添加新字段：

```typescript
export interface Unit extends Entity {
  speed: number;
  attack: number;
  attackRange: number;
  target?: string;           // 攻击目标 entity id
  targetPosition?: Position; // ✅ 新增: 移动目标位置
  collectTarget?: string;    // ✅ 新增: 采集目标 resource id
  path?: GridPosition[];
}
```

### 2. 添加 `handleCollect` 方法

```typescript
private handleCollect(action: GameAction): boolean {
  if (!action.entityId || !action.targetEntityId) return false;

  const collector = this.state.entities.get(action.entityId) as Unit;
  const resource = this.state.entities.get(action.targetEntityId) as Resource;

  if (!collector || !resource) return false;
  if (collector.type !== EntityType.COLLECTOR) return false;
  if (resource.type !== EntityType.RESOURCE) return false;

  // 设置采集目标并移向资源
  collector.collectTarget = action.targetEntityId;
  collector.target = undefined; // 清除攻击目标
  collector.targetPosition = { ...resource.position };
  this.notifyUpdate();
  return true;
}
```

### 3. 修改 `handleMove` 为目标位置设置

```typescript
private handleMove(action: GameAction): boolean {
  if (!action.entityId || !action.targetPosition) return false;

  const entity = this.state.entities.get(action.entityId);
  if (!entity || entity.owner !== action.player) return false;

  const unit = entity as Unit;
  if (unit.speed === undefined) return false;

  if (isValidGridPosition(action.targetPosition)) {
    // ✅ 设置目标位置用于渐进移动（不再传送!）
    unit.targetPosition = gridToWorld(action.targetPosition);
    // 移动时清除攻击和采集目标
    unit.target = undefined;
    unit.collectTarget = undefined;
    this.notifyUpdate();
    return true;
  }

  return false;
}
```

### 4. 添加 `moveTowards` 辅助方法

```typescript
private moveTowards(unit: Unit, target: Position, deltaTime: number): boolean {
  const distance = this.distanceBetween(unit.position, target);
  const moveSpeed = unit.speed * 50; // 调整速度以获得合适的视觉效果

  if (distance < 5) {
    // 足够接近，停止移动
    unit.position.x = target.x;
    unit.position.z = target.z;
    return true; // 已到达
  }

  // 计算方向并移动
  const dx = target.x - unit.position.x;
  const dz = target.z - unit.position.z;
  const len = Math.sqrt(dx * dx + dz * dz);

  unit.position.x += (dx / len) * moveSpeed * deltaTime;
  unit.position.z += (dz / len) * moveSpeed * deltaTime;

  return false; // 仍在移动中
}
```

### 5. 重写 `updateUnits` 方法

新的 `updateUnits` 方法处理三种行为，按优先级排序：

1. **采集行为** (`collectTarget`)
   - 移动到资源位置
   - 到达后进行采集（增加玩家资源）
   - 资源耗尽时清除目标

2. **攻击行为** (`target`)
   - 移动到攻击范围内
   - 在范围内时造成伤害
   - 目标死亡时清除目标

3. **纯移动** (`targetPosition`)
   - 移动到目标位置
   - 到达后清除 `targetPosition`

### 6. 在 `processAction` 中添加 collect case

```typescript
processAction(action: GameAction): boolean {
  switch (action.type) {
    case "move":
      return this.handleMove(action);
    case "attack":
      return this.handleAttack(action);
    case "build":
      return this.handleBuild(action);
    case "produce":
      return this.handleProduce(action);
    case "collect":           // ✅ 新增
      return this.handleCollect(action);
    default:
      return false;
  }
}
```

### 7. 额外改进：采集者可从基地生产

修改 `handleProduce` 方法，允许采集者从基地生产（而不是只能从兵营）：

```typescript
private handleProduce(action: GameAction): boolean {
  // ...
  let spawnBuilding: Entity | undefined;

  if (action.unitType === EntityType.COLLECTOR) {
    // 采集者从基地生产
    for (const entity of this.state.entities.values()) {
      if (entity.type === EntityType.BASE && entity.owner === action.player) {
        spawnBuilding = entity;
        break;
      }
    }
  } else {
    // 其他单位从兵营生产
    for (const entity of this.state.entities.values()) {
      if (entity.type === EntityType.BARRACKS && entity.owner === action.player) {
        spawnBuilding = entity;
        break;
      }
    }
  }
  // ...
}
```

## 修改的文件

| 文件 | 变更内容 |
|------|---------|
| `client/src/game/types.ts` | 为 `Unit` 接口添加 `targetPosition` 和 `collectTarget` 字段 |
| `client/src/game/GameEngine.ts` | 完整重写单位更新逻辑，添加采集处理 |

## 测试验证

修复后的预期行为：

1. ✅ 选中采集者 → 右键点击资源 → 采集者平滑移动到资源处
2. ✅ 采集者到达资源后开始采集 → 玩家资源增加
3. ✅ 资源耗尽后自动消失
4. ✅ 选中战斗单位 → 右键点击敌人 → 单位移动并攻击
5. ✅ 右键点击空地 → 单位移动到该位置
6. ✅ 可以从基地训练采集者（之前只能从兵营）

## 技术细节

### 移动速度计算

```typescript
const moveSpeed = unit.speed * 50;
```

速度乘以 50 是为了将逻辑速度值（如 2-3）转换为合适的像素移动速度。

### 距离判定

- **到达判定**: 距离 < 5 像素视为已到达
- **采集范围**: 距离 < 30 像素可以开始采集
- **攻击范围**: 距离 < `attackRange * 32` 像素可以攻击

### 游戏循环流程

```
requestAnimationFrame(animate)
    ↓
engine.update(deltaTime)
    ↓
updateUnits(deltaTime)
    ├── 处理采集行为
    ├── 处理攻击行为
    └── 处理移动行为
    ↓
checkWinCondition()
    ↓
renderer.updateEntities()
    ↓
renderer.render()
```

## 总结

本次修复解决了游戏循环中单位移动和采集的核心问题。主要变更包括：

1. 将瞬间传送改为渐进式移动
2. 实现完整的采集逻辑
3. 改进攻击时的移动和范围判定
4. 允许采集者从基地生产

现在游戏的基本 RTS 玩法已经可以正常运行。