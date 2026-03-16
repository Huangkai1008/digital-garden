# 设计数据密集型应用

> **Designing Data-Intensive Applications: The Big Ideas Behind Reliable, Scalable, and Maintainable Systems**
>
> Martin Kleppmann, 2017, O'Reilly Media

---

## 章节路线图

```mermaid
flowchart TB
    subgraph P1["Part I — 数据系统基础"]
        C1["Ch1 可靠、可扩展与可维护"]
        C2["Ch2 数据模型与查询语言"]
        C3["Ch3 存储与检索"]
        C4["Ch4 编码与演化"]
    end
    subgraph P2["Part II — 分布式数据"]
        C5["Ch5 复制"]
        C6["Ch6 分区"]
        C7["Ch7 事务"]
        C8["Ch8 分布式系统的麻烦"]
        C9["Ch9 一致性与共识"]
    end
    subgraph P3["Part III — 派生数据"]
        C10["Ch10 批处理"]
        C11["Ch11 流处理"]
        C12["Ch12 数据系统的未来"]
    end

    C1 --> C2 --> C3 --> C4
    C4 --> C5 --> C6 --> C7 --> C8 --> C9
    C9 --> C10 --> C11 --> C12
```

---

## 目录

### Part I — 数据系统基础

| # | 章节 | 链接 |
|---|------|------|
| 1 | 可靠、可扩展与可维护的应用 | [→ 阅读](part1/ch01.md) |
| 2 | 数据模型与查询语言 | [→ 阅读](part1/ch02.md) |
| 3 | 存储与检索 | [→ 阅读](part1/ch03.md) |
| 4 | 编码与演化 | [→ 阅读](part1/ch04.md) |

### Part II — 分布式数据

| # | 章节 | 链接 |
|---|------|------|
| 5 | 复制 | [→ 阅读](part2/ch05.md) |
| 6 | 分区 | [→ 阅读](part2/ch06.md) |
| 7 | 事务 | [→ 阅读](part2/ch07.md) |
| 8 | 分布式系统的麻烦 | [→ 阅读](part2/ch08.md) |
| 9 | 一致性与共识 | [→ 阅读](part2/ch09.md) |

### Part III — 派生数据

| # | 章节 | 链接 |
|---|------|------|
| 10 | 批处理 | [→ 阅读](part3/ch10.md) |
| 11 | 流处理 | [→ 阅读](part3/ch11.md) |
| 12 | 数据系统的未来 | [→ 阅读](part3/ch12.md) |
