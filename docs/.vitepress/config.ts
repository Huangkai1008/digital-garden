import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(
  defineConfig({
    title: 'Digital Garden',
    description: '个人学习笔记与读书翻译',
    lang: 'zh-CN',
    lastUpdated: true,

    markdown: {
      math: true,
      lineNumbers: true,
    },

    themeConfig: {
      nav: [
        { text: '首页', link: '/' },
        { text: 'DDD', link: '/learning-ddd/' },
        { text: 'DDD 函数式', link: '/domain-modeling-functional/' },
        { text: '单元测试', link: '/unit-testing-patterns/' },
        { text: '分布式系统', link: '/distributed-system/' },
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
