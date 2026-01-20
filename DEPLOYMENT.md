# 部署指南 (Deployment Guide)

## 生产环境部署

### 选项 1: 传统服务器部署

#### 1. 构建前端
```bash
npm run build
```

这会在 `dist/` 目录生成优化后的静态文件。

#### 2. 配置 Web 服务器

**使用 Nginx:**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/red-alert-spring-festival/dist;
        try_files $uri $uri/ /index.html;
    }

    # Socket.io 代理
    location /socket.io {
        proxy_pass http://localhost:6101;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

#### 3. 启动后端服务器

使用 PM2 管理 Node.js 进程：

```bash
npm install -g pm2
pm2 start server/index.js --name spring-festival-server
pm2 save
pm2 startup
```

### 选项 2: Docker 部署

#### 创建 Dockerfile

```dockerfile
# 前端构建阶段
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 生产阶段
FROM node:18-alpine
WORKDIR /app

# 安装生产依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制构建产物和服务器代码
COPY --from=build /app/dist ./dist
COPY server ./server

EXPOSE 6101

CMD ["node", "server/index.js"]
```

#### 创建 docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "6101:6101"
    environment:
      - NODE_ENV=production
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./dist:/usr/share/nginx/html
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - app
    restart: unless-stopped
```

#### 运行 Docker

```bash
docker-compose up -d
```

### 选项 3: Vercel 部署（前端）

#### 1. 安装 Vercel CLI
```bash
npm install -g vercel
```

#### 2. 部署
```bash
vercel
```

#### 3. 配置 vercel.json
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**注意**: 后端需要单独部署到支持 WebSocket 的平台（如 Heroku, Railway）

### 选项 4: Heroku 部署（全栈）

#### 1. 创建 Procfile
```
web: node server/index.js
```

#### 2. 添加 package.json 脚本
```json
{
  "scripts": {
    "start": "node server/index.js",
    "heroku-postbuild": "npm run build"
  }
}
```

#### 3. 修改服务器以提供静态文件
```javascript
// server/index.js
const express = require('express');
const path = require('path');

app.use(express.static(path.join(__dirname, '../dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});
```

#### 4. 部署到 Heroku
```bash
heroku create your-app-name
git push heroku main
```

### 选项 5: Railway 部署

Railway 自动检测配置，只需：

```bash
# 安装 Railway CLI
npm install -g @railway/cli

# 登录
railway login

# 初始化项目
railway init

# 部署
railway up
```

## 环境变量

创建 `.env` 文件（不要提交到 Git）：

```env
# 服务器端口
PORT=6101

# CORS 允许的源
ALLOWED_ORIGINS=https://your-domain.com

# Gemini API Key（可选，用于资源生成）
GEMINI_API_KEY=your_api_key_here
```

## 性能优化

### 前端优化
1. **代码分割**: 使用动态导入
```typescript
const Game = lazy(() => import('./components/Game'));
```

2. **压缩资源**: Vite 自动处理，但可以调整
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true
      }
    }
  }
})
```

3. **CDN**: 使用 CDN 托管 Three.js
```html
<script src="https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.min.js"></script>
```

### 后端优化
1. **启用压缩**
```javascript
const compression = require('compression');
app.use(compression());
```

2. **设置速率限制**
```javascript
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);
```

3. **使用 Redis 管理会话**（可选）
```javascript
const redis = require('redis');
const redisAdapter = require('socket.io-redis');

io.adapter(redisAdapter({ host: 'localhost', port: 6379 }));
```

## 监控和日志

### 使用 PM2 日志
```bash
pm2 logs spring-festival-server
```

### 集成 Sentry（错误追踪）
```bash
npm install @sentry/react @sentry/node
```

```typescript
// client/src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
});
```

## 安全建议

1. **HTTPS**: 使用 Let's Encrypt 免费 SSL 证书
2. **环境变量**: 不要在代码中硬编码敏感信息
3. **CORS**: 限制允许的源
4. **输入验证**: 验证所有客户端输入
5. **速率限制**: 防止 DDoS 攻击

## 备份策略

1. **代码**: 使用 Git 版本控制
2. **数据库**（如果使用）: 定期备份
3. **配置**: 备份环境变量和配置文件

## 回滚计划

使用 PM2：
```bash
pm2 save
pm2 resurrect  # 恢复上次保存的状态
```

使用 Docker：
```bash
docker-compose down
docker-compose up -d --build  # 重新构建
```

## 健康检查

添加健康检查端点：
```javascript
// server/index.js
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});
```

## 故障排除

### 常见问题

1. **WebSocket 连接失败**
   - 检查防火墙设置
   - 确保支持 WebSocket 协议
   - 验证 CORS 配置

2. **静态文件 404**
   - 检查构建输出目录
   - 验证服务器静态文件配置

3. **内存泄漏**
   - 使用 `clinic` 工具分析
   - 监控 PM2 内存使用

## 扩展

### 水平扩展（多实例）

使用 Redis 适配器支持多个 Socket.io 实例：

```javascript
const redisAdapter = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const pubClient = createClient({ url: 'redis://localhost:6379' });
const subClient = pubClient.duplicate();

io.adapter(redisAdapter(pubClient, subClient));
```

### 负载均衡

使用 Nginx 作为负载均衡器：

```nginx
upstream socketio_backend {
    ip_hash;
    server localhost:6101;
    server localhost:6102;
    server localhost:6103;
}

server {
    location /socket.io {
        proxy_pass http://socketio_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

部署愉快！🚀
