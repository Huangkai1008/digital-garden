# Digital Garden

个人学习笔记与读书翻译。使用 VitePress 构建静态站点，多子项目共享渲染。

## 项目结构

```
digital-garden/
├── package.json                # Node 依赖 (VitePress)
├── pyproject.toml              # Python 工具依赖 (uv)
├── docs/                       # VitePress 文档根目录
│   ├── .vitepress/config.ts    # VitePress 配置（导航、侧边栏）
│   ├── index.md                # 首页
│   ├── learning-ddd/           # 子项目：学习领域驱动设计
│   │   ├── index.md
│   │   ├── part1/ ~ part4/
│   └── unit-testing-patterns/  # 子项目：单元测试
│       ├── index.md
│       ├── part1/ ~ part4/
├── learning-ddd/pdf/           # DDD 书籍 PDF
├── unit-testing-patterns/pdf/  # 单元测试书籍 PDF
└── scripts/                    # 工具脚本
```

新增子项目时，在 `docs/` 下创建对应目录，然后在 `docs/.vitepress/config.ts` 中添加侧边栏与导航条目。

## 快速开始

```bash
# 安装 Node 依赖
npm install

# 本地预览（热更新）
npm run dev

# 构建静态站点
npm run build

# 预览构建产物
npm run preview
```

## 子项目

| 子项目 | 说明 |
|--------|------|
| [learning-ddd](docs/learning-ddd/index.md) | 《Learning Domain-Driven Design》全书中文翻译 |
| [unit-testing-patterns](docs/unit-testing-patterns/index.md) | 《Unit Testing: Principles, Practices, and Patterns》全书中文翻译 |
