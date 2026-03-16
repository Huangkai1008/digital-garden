import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(
  defineConfig({
    title: 'Digital Garden',
    description: '个人学习笔记与读书翻译',
    lang: 'zh-CN',
    lastUpdated: true,
    ignoreDeadLinks: true,

    markdown: {
      math: true,
      lineNumbers: true,
    },

    themeConfig: {
      nav: [
        { text: '首页', link: '/' },
        {
          text: '架构与设计',
          items: [
            { text: 'DDIA 数据密集型应用', link: '/ddia/' },
            { text: '构建微服务', link: '/building-microservices/' },
            { text: '软件架构基础', link: '/software-architecture/' },
            { text: 'DDD', link: '/learning-ddd/' },
            { text: 'DDD 函数式', link: '/domain-modeling-functional/' },
          ],
        },
        {
          text: '数据与分布式',
          items: [
            { text: '分布式系统论文', link: '/distributed-system/' },
            { text: '数据库内幕', link: '/database-internals/' },
            { text: '流处理系统', link: '/streaming-systems/' },
            { text: '数据工程基础', link: '/data-engineering/' },
          ],
        },
        {
          text: '系统与算法',
          items: [
            { text: '计算机组成与设计', link: '/computer-organization/' },
            { text: 'xv6 操作系统', link: '/xv6/' },
            { text: '21 世纪 C', link: '/21st-century-c/' },
            { text: '算法设计手册', link: '/algorithm-design/' },
          ],
        },
        { text: '单元测试', link: '/unit-testing-patterns/' },
      ],

      sidebar: {
        '/learning-ddd/': [
          {
            text: 'Part I — 战略设计',
            collapsed: false,
            items: [
              { text: '第1章 分析业务领域', link: '/learning-ddd/part1/ch01-analyzing-business-domains' },
              { text: '第2章 发现领域知识', link: '/learning-ddd/part1/ch02-discovering-domain-knowledge' },
              { text: '第3章 管理领域复杂性', link: '/learning-ddd/part1/ch03-managing-domain-complexity' },
              { text: '第4章 集成限界上下文', link: '/learning-ddd/part1/ch04-integrating-bounded-contexts' },
            ],
          },
          {
            text: 'Part II — 战术设计',
            collapsed: false,
            items: [
              { text: '第5章 实现简单业务逻辑', link: '/learning-ddd/part2/ch05-implementing-simple-business-logic' },
              { text: '第6章 处理复杂业务逻辑', link: '/learning-ddd/part2/ch06-tackling-complex-business-logic' },
              { text: '第7章 建模时间维度', link: '/learning-ddd/part2/ch07-modeling-dimension-of-time' },
              { text: '第8章 架构模式', link: '/learning-ddd/part2/ch08-architectural-patterns' },
              { text: '第9章 通信模式', link: '/learning-ddd/part2/ch09-communication-patterns' },
            ],
          },
          {
            text: 'Part III — 实践应用',
            collapsed: false,
            items: [
              { text: '第10章 设计启发式', link: '/learning-ddd/part3/ch10-design-heuristics' },
              { text: '第11章 演进设计决策', link: '/learning-ddd/part3/ch11-evolving-design-decisions' },
              { text: '第12章 EventStorming', link: '/learning-ddd/part3/ch12-eventstorming' },
              { text: '第13章 真实世界中的DDD', link: '/learning-ddd/part3/ch13-ddd-in-real-world' },
            ],
          },
          {
            text: 'Part IV — 与其他方法论的关系',
            collapsed: false,
            items: [
              { text: '第14章 微服务', link: '/learning-ddd/part4/ch14-microservices' },
              { text: '第15章 事件驱动架构', link: '/learning-ddd/part4/ch15-event-driven-architecture' },
              { text: '第16章 Data Mesh', link: '/learning-ddd/part4/ch16-data-mesh' },
            ],
          },
        ],

        '/domain-modeling-functional/': [
          {
            text: 'Part I — 理解领域',
            collapsed: false,
            items: [
              { text: '第1章 领域驱动设计简介', link: '/domain-modeling-functional/part1/ch01-introducing-ddd' },
              { text: '第2章 理解领域', link: '/domain-modeling-functional/part1/ch02-understanding-the-domain' },
              { text: '第3章 函数式架构', link: '/domain-modeling-functional/part1/ch03-functional-architecture' },
            ],
          },
          {
            text: 'Part II — 领域建模',
            collapsed: false,
            items: [
              { text: '第4章 理解类型', link: '/domain-modeling-functional/part2/ch04-understanding-types' },
              { text: '第5章 用类型建模领域', link: '/domain-modeling-functional/part2/ch05-domain-modeling-with-types' },
              { text: '第6章 完整性与一致性', link: '/domain-modeling-functional/part2/ch06-integrity-and-consistency' },
              { text: '第7章 将工作流建模为管道', link: '/domain-modeling-functional/part2/ch07-modeling-workflows-as-pipelines' },
            ],
          },
          {
            text: 'Part III — 实现模型',
            collapsed: false,
            items: [
              { text: '第8章 理解函数', link: '/domain-modeling-functional/part3/ch08-understanding-functions' },
              { text: '第9章 组合管道', link: '/domain-modeling-functional/part3/ch09-composing-a-pipeline' },
              { text: '第10章 处理错误', link: '/domain-modeling-functional/part3/ch10-working-with-errors' },
              { text: '第11章 序列化', link: '/domain-modeling-functional/part3/ch11-serialization' },
              { text: '第12章 持久化', link: '/domain-modeling-functional/part3/ch12-persistence' },
              { text: '第13章 演进设计', link: '/domain-modeling-functional/part3/ch13-evolving-design' },
            ],
          },
        ],

        '/ddia/': [
          {
            text: 'Part I — 数据系统基础',
            collapsed: false,
            items: [
              { text: '第1章 可靠、可扩展与可维护', link: '/ddia/part1/ch01' },
              { text: '第2章 数据模型与查询语言', link: '/ddia/part1/ch02' },
              { text: '第3章 存储与检索', link: '/ddia/part1/ch03' },
              { text: '第4章 编码与演化', link: '/ddia/part1/ch04' },
            ],
          },
          {
            text: 'Part II — 分布式数据',
            collapsed: false,
            items: [
              { text: '第5章 复制', link: '/ddia/part2/ch05' },
              { text: '第6章 分区', link: '/ddia/part2/ch06' },
              { text: '第7章 事务', link: '/ddia/part2/ch07' },
              { text: '第8章 分布式系统的麻烦', link: '/ddia/part2/ch08' },
              { text: '第9章 一致性与共识', link: '/ddia/part2/ch09' },
            ],
          },
          {
            text: 'Part III — 派生数据',
            collapsed: false,
            items: [
              { text: '第10章 批处理', link: '/ddia/part3/ch10' },
              { text: '第11章 流处理', link: '/ddia/part3/ch11' },
              { text: '第12章 数据系统的未来', link: '/ddia/part3/ch12' },
            ],
          },
        ],

        '/building-microservices/': [
          {
            text: 'Part I — 基础',
            collapsed: false,
            items: [
              { text: '第1章 什么是微服务', link: '/building-microservices/part1/ch01' },
              { text: '第2章 如何建模微服务', link: '/building-microservices/part1/ch02' },
              { text: '第3章 拆分单体', link: '/building-microservices/part1/ch03' },
              { text: '第4章 微服务通信风格', link: '/building-microservices/part1/ch04' },
            ],
          },
          {
            text: 'Part II — 实现',
            collapsed: false,
            items: [
              { text: '第5章 实现通信', link: '/building-microservices/part2/ch05' },
              { text: '第6章 工作流', link: '/building-microservices/part2/ch06' },
              { text: '第7章 构建', link: '/building-microservices/part2/ch07' },
              { text: '第8章 部署', link: '/building-microservices/part2/ch08' },
              { text: '第9章 测试', link: '/building-microservices/part2/ch09' },
              { text: '第10章 可观测性', link: '/building-microservices/part2/ch10' },
              { text: '第11章 安全', link: '/building-microservices/part2/ch11' },
              { text: '第12章 弹性', link: '/building-microservices/part2/ch12' },
              { text: '第13章 扩展', link: '/building-microservices/part2/ch13' },
            ],
          },
          {
            text: 'Part III — 人',
            collapsed: false,
            items: [
              { text: '第14章 用户界面', link: '/building-microservices/part3/ch14' },
              { text: '第15章 组织结构', link: '/building-microservices/part3/ch15' },
              { text: '第16章 演进式架构师', link: '/building-microservices/part3/ch16' },
            ],
          },
        ],

        '/database-internals/': [
          {
            text: 'Part I — 存储引擎',
            collapsed: false,
            items: [
              { text: '第1章 简介与概览', link: '/database-internals/part1/ch01' },
              { text: '第2章 B-Tree 基础', link: '/database-internals/part1/ch02' },
              { text: '第3章 文件格式', link: '/database-internals/part1/ch03' },
              { text: '第4章 实现 B-Tree', link: '/database-internals/part1/ch04' },
              { text: '第5章 事务处理与恢复', link: '/database-internals/part1/ch05' },
              { text: '第6章 B-Tree 变体', link: '/database-internals/part1/ch06' },
              { text: '第7章 日志结构存储', link: '/database-internals/part1/ch07' },
            ],
          },
          {
            text: 'Part II — 分布式系统',
            collapsed: false,
            items: [
              { text: '第8章 简介与概览', link: '/database-internals/part2/ch08' },
              { text: '第9章 故障检测', link: '/database-internals/part2/ch09' },
              { text: '第10章 领导者选举', link: '/database-internals/part2/ch10' },
              { text: '第11章 复制与一致性', link: '/database-internals/part2/ch11' },
              { text: '第12章 反熵与传播', link: '/database-internals/part2/ch12' },
              { text: '第13章 分布式事务', link: '/database-internals/part2/ch13' },
              { text: '第14章 共识', link: '/database-internals/part2/ch14' },
            ],
          },
        ],

        '/software-architecture/': [
          {
            text: 'Part I — 基础',
            collapsed: false,
            items: [
              { text: '第1章 简介', link: '/software-architecture/part1/ch01' },
              { text: '第2章 架构思维', link: '/software-architecture/part1/ch02' },
              { text: '第3章 模块化', link: '/software-architecture/part1/ch03' },
              { text: '第4章 架构特性定义', link: '/software-architecture/part1/ch04' },
              { text: '第5章 识别架构特性', link: '/software-architecture/part1/ch05' },
              { text: '第6章 度量与治理', link: '/software-architecture/part1/ch06' },
              { text: '第7章 架构特性范围', link: '/software-architecture/part1/ch07' },
              { text: '第8章 组件思维', link: '/software-architecture/part1/ch08' },
            ],
          },
          {
            text: 'Part II — 架构风格',
            collapsed: false,
            items: [
              { text: '第9章 基础', link: '/software-architecture/part2/ch09' },
              { text: '第10章 分层架构', link: '/software-architecture/part2/ch10' },
              { text: '第11章 管道架构', link: '/software-architecture/part2/ch11' },
              { text: '第12章 微内核架构', link: '/software-architecture/part2/ch12' },
              { text: '第13章 基于服务的架构', link: '/software-architecture/part2/ch13' },
              { text: '第14章 事件驱动架构', link: '/software-architecture/part2/ch14' },
              { text: '第15章 基于空间的架构', link: '/software-architecture/part2/ch15' },
              { text: '第16章 编排式 SOA', link: '/software-architecture/part2/ch16' },
              { text: '第17章 微服务架构', link: '/software-architecture/part2/ch17' },
              { text: '第18章 选择架构风格', link: '/software-architecture/part2/ch18' },
            ],
          },
          {
            text: 'Part III — 技巧与软技能',
            collapsed: false,
            items: [
              { text: '第19章 架构决策', link: '/software-architecture/part3/ch19' },
              { text: '第20章 架构风险分析', link: '/software-architecture/part3/ch20' },
              { text: '第21章 图示与演示', link: '/software-architecture/part3/ch21' },
              { text: '第22章 高效团队', link: '/software-architecture/part3/ch22' },
              { text: '第23章 谈判与领导力', link: '/software-architecture/part3/ch23' },
              { text: '第24章 职业发展', link: '/software-architecture/part3/ch24' },
            ],
          },
        ],

        '/streaming-systems/': [
          {
            text: 'Part I — Beam 模型',
            collapsed: false,
            items: [
              { text: '第1章 Streaming 101', link: '/streaming-systems/part1/ch01' },
              { text: '第2章 What/Where/When/How', link: '/streaming-systems/part1/ch02' },
              { text: '第3章 水位线', link: '/streaming-systems/part1/ch03' },
              { text: '第4章 高级窗口', link: '/streaming-systems/part1/ch04' },
              { text: '第5章 精确一次与副作用', link: '/streaming-systems/part1/ch05' },
            ],
          },
          {
            text: 'Part II — 流与表',
            collapsed: false,
            items: [
              { text: '第6章 流与表', link: '/streaming-systems/part2/ch06' },
              { text: '第7章 持久化状态', link: '/streaming-systems/part2/ch07' },
              { text: '第8章 流式 SQL', link: '/streaming-systems/part2/ch08' },
              { text: '第9章 流式 Join', link: '/streaming-systems/part2/ch09' },
              { text: '第10章 数据处理演进', link: '/streaming-systems/part2/ch10' },
            ],
          },
        ],

        '/data-engineering/': [
          {
            text: 'Part I — 基础与构建块',
            collapsed: false,
            items: [
              { text: '第1章 数据工程概述', link: '/data-engineering/part1/ch01' },
              { text: '第2章 生命周期', link: '/data-engineering/part1/ch02' },
              { text: '第3章 数据架构设计', link: '/data-engineering/part1/ch03' },
              { text: '第4章 技术选型', link: '/data-engineering/part1/ch04' },
            ],
          },
          {
            text: 'Part II — 生命周期深入',
            collapsed: false,
            items: [
              { text: '第5章 数据生成', link: '/data-engineering/part2/ch05' },
              { text: '第6章 存储', link: '/data-engineering/part2/ch06' },
              { text: '第7章 摄取', link: '/data-engineering/part2/ch07' },
              { text: '第8章 查询与转换', link: '/data-engineering/part2/ch08' },
              { text: '第9章 数据服务', link: '/data-engineering/part2/ch09' },
            ],
          },
          {
            text: 'Part III — 安全与未来',
            collapsed: false,
            items: [
              { text: '第10章 安全与隐私', link: '/data-engineering/part3/ch10' },
              { text: '第11章 未来展望', link: '/data-engineering/part3/ch11' },
            ],
          },
        ],

        '/21st-century-c/': [
          {
            text: 'Part I — 环境',
            collapsed: false,
            items: [
              { text: '第1章 编译环境搭建', link: '/21st-century-c/part1/ch01' },
              { text: '第2章 调试、测试、文档', link: '/21st-century-c/part1/ch02' },
              { text: '第3章 项目打包', link: '/21st-century-c/part1/ch03' },
              { text: '第4章 版本控制', link: '/21st-century-c/part1/ch04' },
              { text: '第5章 与他人协作', link: '/21st-century-c/part1/ch05' },
            ],
          },
          {
            text: 'Part II — 语言',
            collapsed: false,
            items: [
              { text: '第6章 你的好朋友——指针', link: '/21st-century-c/part2/ch06' },
              { text: '第7章 教科书花大量篇幅讲的非必要语法', link: '/21st-century-c/part2/ch07' },
              { text: '第8章 教科书常常不讲的重要语法', link: '/21st-century-c/part2/ch08' },
              { text: '第9章 更简单的文本处理', link: '/21st-century-c/part2/ch09' },
              { text: '第10章 更好的结构体', link: '/21st-century-c/part2/ch10' },
              { text: '第11章 C 语言中的面向对象编程', link: '/21st-century-c/part2/ch11' },
              { text: '第12章 并行线程', link: '/21st-century-c/part2/ch12' },
              { text: '第13章 库', link: '/21st-century-c/part2/ch13' },
            ],
          },
        ],

        '/xv6/': [
          {
            text: 'xv6 操作系统',
            collapsed: false,
            items: [
              { text: '第1章 操作系统接口', link: '/xv6/ch01' },
              { text: '第2章 操作系统组织', link: '/xv6/ch02' },
              { text: '第3章 页表', link: '/xv6/ch03' },
              { text: '第4章 陷阱与系统调用', link: '/xv6/ch04' },
              { text: '第5章 中断与设备驱动', link: '/xv6/ch05' },
              { text: '第6章 锁', link: '/xv6/ch06' },
              { text: '第7章 调度', link: '/xv6/ch07' },
              { text: '第8章 文件系统', link: '/xv6/ch08' },
              { text: '第9章 并发回顾', link: '/xv6/ch09' },
              { text: '第10章 总结', link: '/xv6/ch10' },
            ],
          },
        ],

        '/computer-organization/': [
          {
            text: '计算机组成与设计',
            collapsed: false,
            items: [
              { text: '第1章 计算机抽象与技术', link: '/computer-organization/ch01' },
              { text: '第2章 指令', link: '/computer-organization/ch02' },
              { text: '第3章 计算机算术', link: '/computer-organization/ch03' },
              { text: '第4章 处理器', link: '/computer-organization/ch04' },
              { text: '第5章 存储器层次结构', link: '/computer-organization/ch05' },
              { text: '第6章 并行处理器', link: '/computer-organization/ch06' },
              { text: '附录A 逻辑设计基础', link: '/computer-organization/appendix-a' },
            ],
          },
        ],

        '/algorithm-design/': [
          {
            text: 'Part I — 实用算法设计',
            collapsed: false,
            items: [
              { text: '第1章 导论', link: '/algorithm-design/part1/ch01' },
              { text: '第2章 算法分析', link: '/algorithm-design/part1/ch02' },
              { text: '第3章 数据结构', link: '/algorithm-design/part1/ch03' },
              { text: '第4章 排序', link: '/algorithm-design/part1/ch04' },
              { text: '第5章 分治', link: '/algorithm-design/part1/ch05' },
              { text: '第6章 哈希与随机化', link: '/algorithm-design/part1/ch06' },
              { text: '第7章 图遍历', link: '/algorithm-design/part1/ch07' },
              { text: '第8章 加权图算法', link: '/algorithm-design/part1/ch08' },
              { text: '第9章 组合搜索', link: '/algorithm-design/part1/ch09' },
              { text: '第10章 动态规划', link: '/algorithm-design/part1/ch10' },
              { text: '第11章 NP 完全性', link: '/algorithm-design/part1/ch11' },
              { text: '第12章 处理困难问题', link: '/algorithm-design/part1/ch12' },
              { text: '第13章 如何设计算法', link: '/algorithm-design/part1/ch13' },
            ],
          },
          {
            text: 'Part II — 算法问题目录',
            collapsed: false,
            items: [
              { text: '第14章 问题目录', link: '/algorithm-design/part2/ch14' },
              { text: '第15章 数据结构', link: '/algorithm-design/part2/ch15' },
              { text: '第16章 数值问题', link: '/algorithm-design/part2/ch16' },
              { text: '第17章 组合问题', link: '/algorithm-design/part2/ch17' },
              { text: '第18章 图：多项式时间', link: '/algorithm-design/part2/ch18' },
              { text: '第19章 图：NP-Hard', link: '/algorithm-design/part2/ch19' },
              { text: '第20章 计算几何', link: '/algorithm-design/part2/ch20' },
              { text: '第21章 集合与字符串', link: '/algorithm-design/part2/ch21' },
            ],
          },
        ],

        '/distributed-system/': [
          {
            text: '基础设施与计算',
            collapsed: false,
            items: [
              { text: 'MapReduce (2004)', link: '/distributed-system/mapreduce' },
              { text: 'GFS (2003)', link: '/distributed-system/gfs' },
            ],
          },
          {
            text: '共识与一致性',
            collapsed: false,
            items: [
              { text: 'Paxos (1998)', link: '/distributed-system/paxos' },
              { text: 'Raft (2014)', link: '/distributed-system/raft' },
              { text: 'Linearizability (1990)', link: '/distributed-system/linearizability' },
            ],
          },
          {
            text: '协调与事务',
            collapsed: false,
            items: [
              { text: 'ZooKeeper (2010)', link: '/distributed-system/zookeeper' },
              { text: 'Spanner (2012)', link: '/distributed-system/spanner' },
            ],
          },
          {
            text: '复制与缓存',
            collapsed: false,
            items: [
              { text: 'Chain Replication (2004)', link: '/distributed-system/chain-replication' },
              { text: 'FaRM (2015)', link: '/distributed-system/farm' },
              { text: 'Memcached@FB (2013)', link: '/distributed-system/memcached' },
            ],
          },
          {
            text: '验证',
            collapsed: false,
            items: [
              { text: 'IronFleet (2015)', link: '/distributed-system/ironfleet' },
            ],
          },
          {
            text: '现代系统',
            collapsed: false,
            items: [
              { text: 'AWS Lambda (2023)', link: '/distributed-system/lambda' },
              { text: 'Ray (2021)', link: '/distributed-system/ray' },
            ],
          },
          {
            text: '安全与去中心化',
            collapsed: false,
            items: [
              { text: 'SUNDR (2004)', link: '/distributed-system/sundr' },
              { text: 'Bitcoin (2008)', link: '/distributed-system/bitcoin' },
              { text: 'PBFT (1999)', link: '/distributed-system/pbft' },
            ],
          },
        ],

        '/unit-testing-patterns/': [
          {
            text: 'Part 1 — 宏观视角',
            collapsed: false,
            items: [
              { text: '第1章 单元测试的目标', link: '/unit-testing-patterns/part1/ch01-goal-of-unit-testing' },
              { text: '第2章 什么是单元测试', link: '/unit-testing-patterns/part1/ch02-what-is-unit-test' },
              { text: '第3章 单元测试的解剖', link: '/unit-testing-patterns/part1/ch03-anatomy-of-unit-test' },
            ],
          },
          {
            text: 'Part 2 — 让测试为你服务',
            collapsed: false,
            items: [
              { text: '第4章 好单元测试的四大支柱', link: '/unit-testing-patterns/part2/ch04-four-pillars' },
              { text: '第5章 Mock 与测试脆弱性', link: '/unit-testing-patterns/part2/ch05-mocks-and-fragility' },
              { text: '第6章 单元测试的三种风格', link: '/unit-testing-patterns/part2/ch06-styles-of-unit-testing' },
              { text: '第7章 重构迈向高价值测试', link: '/unit-testing-patterns/part2/ch07-refactoring-toward-valuable-tests' },
            ],
          },
          {
            text: 'Part 3 — 集成测试',
            collapsed: false,
            items: [
              { text: '第8章 为什么需要集成测试', link: '/unit-testing-patterns/part3/ch08-why-integration-testing' },
              { text: '第9章 Mock 最佳实践', link: '/unit-testing-patterns/part3/ch09-mocking-best-practices' },
              { text: '第10章 数据库测试', link: '/unit-testing-patterns/part3/ch10-database-testing' },
            ],
          },
          {
            text: 'Part 4 — 单元测试反模式',
            collapsed: false,
            items: [
              { text: '第11章 单元测试反模式', link: '/unit-testing-patterns/part4/ch11-unit-testing-anti-patterns' },
            ],
          },
        ],
      },

      outline: { level: [2, 3], label: '目录' },
      search: { provider: 'local' },
      lastUpdated: { text: '最后更新' },
      docFooter: { prev: '上一篇', next: '下一篇' },
      darkModeSwitchLabel: '主题',
      sidebarMenuLabel: '菜单',
      returnToTopLabel: '回到顶部',

      socialLinks: [
        { icon: 'github', link: 'https://github.com/huangkai' },
      ],
    },

    mermaid: {},
  })
)
