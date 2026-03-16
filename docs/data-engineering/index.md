# 数据工程基础

> **Fundamentals of Data Engineering: Plan and Build Robust Data Systems**
>
> Joe Reis, Matt Housley, 2022, O'Reilly Media

---

## 章节路线图

```mermaid
flowchart TB
    subgraph P1["Part I — 基础与构建块"]
        C1["Ch1 数据工程概述"]
        C2["Ch2 数据工程生命周期"]
        C3["Ch3 设计良好的数据架构"]
        C4["Ch4 技术选型"]
    end
    subgraph P2["Part II — 生命周期深入"]
        C5["Ch5 源系统中的数据生成"]
        C6["Ch6 存储"]
        C7["Ch7 摄取"]
        C8["Ch8 查询、建模与转换"]
        C9["Ch9 数据服务"]
    end
    subgraph P3["Part III — 安全、隐私与未来"]
        C10["Ch10 安全与隐私"]
        C11["Ch11 数据工程的未来"]
    end

    C1 --> C2 --> C3 --> C4
    C4 --> C5 --> C6 --> C7 --> C8 --> C9
    C9 --> C10 --> C11
```

---

## 目录

### Part I — 基础与构建块

| # | 章节 | 链接 |
|---|------|------|
| 1 | 数据工程概述 | [→ 阅读](part1/ch01.md) |
| 2 | 数据工程生命周期 | [→ 阅读](part1/ch02.md) |
| 3 | 设计良好的数据架构 | [→ 阅读](part1/ch03.md) |
| 4 | 跨生命周期的技术选型 | [→ 阅读](part1/ch04.md) |

### Part II — 数据工程生命周期深入

| # | 章节 | 链接 |
|---|------|------|
| 5 | 源系统中的数据生成 | [→ 阅读](part2/ch05.md) |
| 6 | 存储 | [→ 阅读](part2/ch06.md) |
| 7 | 摄取 | [→ 阅读](part2/ch07.md) |
| 8 | 查询、建模与转换 | [→ 阅读](part2/ch08.md) |
| 9 | 数据服务：分析、ML 与反向 ETL | [→ 阅读](part2/ch09.md) |

### Part III — 安全、隐私与未来

| # | 章节 | 链接 |
|---|------|------|
| 10 | 安全与隐私 | [→ 阅读](part3/ch10.md) |
| 11 | 数据工程的未来 | [→ 阅读](part3/ch11.md) |
