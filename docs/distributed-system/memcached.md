---
title: Facebook 的 Memcache 扩展
description: Nishtala et al. (2013) 论文翻译：Facebook 如何扩展 Memcache 以支持全球最大社交网络，NSDI
---

<!-- markdownlint-disable MD025 MD037 MD036 MD040 MD029 MD034 -->

# Facebook 的 Memcache 扩展

**作者**：Rajesh Nishtala, Hans Fugal, Steven Grimm, Marc Kwiatkowski, Herman Lee, Harry C. Li, Ryan McElroy, Mike Paleczny, Daniel Peek, Paul Saab, David Stafford, Tony Tung, Venkateshwaran Venkataramani  
**机构**：Facebook Inc.  
**年份**：2013  
**来源**：NSDI (USENIX Symposium on Networked Systems Design and Implementation)

---

## 摘要

Memcached 是一种广为人知的、简单的内存缓存方案。本文描述了 Facebook 如何将 memcached 作为构建块，构建并扩展一个分布式键值存储（key-value store），以支持全球最大的社交网络。我们的系统每秒处理数十亿请求，存储数万亿项数据，为全球超过十亿用户提供丰富的体验。

---

## 1 引言

流行且具有吸引力的社交网站带来了重大的基础设施挑战。数亿人每天使用这些网络，施加的计算、网络和 I/O 需求使传统 Web 架构难以满足。社交网络的基础设施需要：(1) 支持近乎实时的通信；(2) 从多个来源即时聚合内容；(3) 能够访问和更新非常热门的共享内容；(4) 扩展以每秒处理数百万用户请求。

我们描述了如何改进开源版本的 memcached [14]，并将其作为构建块来构建全球最大社交网络的分布式键值存储。我们讨论了从单集群服务器扩展到多个地理分布式集群的历程。据我们所知，这是世界上最大的 memcached 部署，每秒处理超过十亿请求，存储数万亿项数据。

本文是一系列认识到分布式键值存储灵活性和实用性的工作 [1, 2, 5, 6, 12, 14, 34, 36] 中的最新一篇。本文聚焦于 memcached——一种内存哈希表（in-memory hash table）的开源实现——因为它能以低成本提供对共享存储池的低延迟访问。这些特性使我们能够构建原本不切实际的数据密集型功能。例如，每个页面请求发出数百次数据库查询的功能可能永远不会走出原型阶段，因为它太慢且成本太高。然而，在我们的应用中，网页 routinely 从 memcached 服务器获取数千个键值对。

我们的目标之一是呈现不同部署规模下出现的重要主题。虽然性能、效率、容错性和一致性在所有规模下都很重要，但我们的经验表明，在特定规模下，某些特性的实现难度高于其他特性。例如，在较小规模下，如果复制较少，维护数据一致性可能更容易；而在较大规模下，复制往往是必要的。此外，随着服务器数量增加、网络成为瓶颈，找到最优通信调度的重要性也随之增加。

本文包含四个主要贡献：(1) 我们描述了 Facebook 基于 memcached 的架构演进。(2) 我们识别了改进 memcached 性能和提高内存效率的增强措施。(3) 我们强调了提高系统大规模运营能力的机制。(4) 我们刻画了施加在系统上的生产工作负载特征。

---

## 2 概述

以下特性极大地影响了我们的设计。首先，用户消费的内容比创建的内容多一个数量级。这种行为导致工作负载以获取数据为主，表明缓存可以带来显著优势。其次，我们的读操作从多种来源获取数据，如 MySQL 数据库、HDFS 安装和后端服务。这种异构性需要灵活的缓存策略，能够存储来自不同来源的数据。

Memcached 提供了一组简单的操作（set、get 和 delete），使其成为大规模分布式系统中具有吸引力的基本组件。我们最初使用的开源版本提供单机内存哈希表。在本文中，我们讨论如何将这个基本构建块变得更高效，并用它构建一个每秒可处理数十亿请求的分布式键值存储。因此，我们用「memcached」指代源代码或运行中的二进制，用「memcache」描述分布式系统。

**查询缓存（Query cache）**：我们依赖 memcache 减轻数据库的读负载。具体而言，我们使用 memcache 作为按需填充的旁路缓存（demand-filled look-aside cache），如图 1 所示。当 Web 服务器需要数据时，它首先通过提供字符串键向 memcache 请求值。如果该键对应的项未缓存，Web 服务器从数据库或其他后端服务获取数据，并用键值对填充缓存。对于写请求，Web 服务器向数据库发出 SQL 语句，然后向 memcache 发送 delete 请求以失效任何过期数据。我们选择删除缓存数据而非更新它，因为 delete 是幂等的。Memcache 不是数据的权威来源，因此允许驱逐缓存数据。

```text
读路径（左侧）:                    写路径（右侧）:
┌─────────────┐                    ┌─────────────┐
│ Web Server  │                    │ Web Server  │
└──────┬──────┘                    └──────┬──────┘
       │ 1. get k                         │ 1. UPDATE ...
       ▼                                  ▼
┌─────────────┐                    ┌─────────────┐
│  Memcache   │                    │  Database   │
└──────┬──────┘                    └──────┬──────┘
       │ cache miss                        │
       ▼                                  │
┌─────────────┐                            │
│  Database   │◄───────────────────────────┘
│ 2. SELECT...│
└──────┬──────┘
       │ 3. set (k,v)
       ▼
┌─────────────┐
│  Memcache   │                    2. delete k
└─────────────┘
```

*图 1：Memcache 作为按需填充的旁路缓存。左半部分说明 Web 服务器在缓存未命中时的读路径。右半部分说明写路径。*

**通用缓存（Generic cache）**：我们还利用 memcache 作为更通用的键值存储。例如，工程师使用 memcache 存储来自复杂机器学习算法的预计算结果，这些结果可被各种其他应用使用。新服务只需很少努力即可利用现有的 memcache 基础设施，而无需承担调优、优化、配置和维护大型服务器机群的负担。

就 memcached 本身而言，它不提供服务器间协调；它是在单台服务器上运行的内存哈希表。在本文其余部分，我们描述如何基于 memcached 构建能够在 Facebook 工作负载下运行的分布式键值存储。我们的系统提供一套配置、聚合和路由服务，将 memcached 实例组织成分布式系统。

```text
                    ┌─────────────────────────────────────────┐
                    │              Region (区域)               │
                    │  ┌─────────┐  ┌─────────┐  ┌─────────┐  │
                    │  │Cluster A│  │Cluster B│  │Cluster C│  │
                    │  │ Frontend│  │ Frontend│  │ Frontend│  │
                    │  └────┬────┘  └────┬────┘  └────┬────┘  │
                    │       │            │            │        │
                    │       └────────────┼────────────┘        │
                    │                    │                     │
                    │            ┌───────▼───────┐             │
                    │            │Storage Cluster │             │
                    │            │  (Databases)   │             │
                    │            └───────────────┘             │
                    └─────────────────────────────────────────┘
                    Master Region 提供数据流以保持非主区域同步
```

*图 2：整体架构*

我们组织论文以强调在三种不同部署规模下出现的主题。当只有一个服务器集群时，读密集型工作负载和广泛的扇出（fan-out）是主要关注点。当需要扩展到多个前端集群时，我们解决这些集群间的数据复制问题。最后，我们描述在将集群分布到全球时提供一致用户体验的机制。运营复杂性和容错性在所有规模下都很重要。我们呈现支持我们设计决策的显著数据，并请读者参阅 Atikoglu 等人 [8] 的工作以获取我们工作负载的更详细分析。图 2 从高层展示了这一最终架构，其中我们将同址集群组织成区域（region），并指定一个主区域（master region）提供数据流以保持非主区域同步。

在演进系统时，我们优先考虑两个主要设计目标。(1) 任何变更必须影响面向用户或运营的问题。范围有限的优化很少被考虑。(2) 我们将读取瞬时过期数据的概率视为可调参数，类似于响应性。我们愿意以略微过期的数据换取使后端存储服务免受过度负载。

---

## 3 集群内：延迟与负载

我们现在考虑在集群内扩展到数千台服务器的挑战。在此规模下，我们的大部分努力集中在减少获取缓存数据的延迟或缓存未命中造成的负载。

### 3.1 降低延迟

无论数据请求导致缓存命中还是未命中，memcached 响应的延迟都是用户请求响应时间的关键因素。单个用户 Web 请求通常会导致数百次独立的 memcache get 请求。例如，加载我们一个热门页面平均需要从 memcache 获取 521 个不同的项^1^。

我们在集群中配置数百台 memcached 服务器以减轻数据库和其他服务的负载。通过一致性哈希（consistent hashing）[22] 将项分布到 memcached 服务器。因此，Web 服务器通常需要与许多 memcached 服务器通信以满足用户请求。结果是，所有 Web 服务器在短时间内与每台 memcached 服务器通信。这种全对全（all-to-all）通信模式可能导致 incast 拥塞（incast congestion）[30]，或使单台服务器成为许多 Web 服务器的瓶颈。数据复制通常能缓解单服务器瓶颈，但在常见情况下会导致显著的内存效率低下。

我们主要通过关注运行在每个 Web 服务器上的 memcache 客户端来降低延迟。该客户端承担多种功能，包括序列化、压缩、请求路由、错误处理和请求批处理。客户端维护所有可用服务器的映射，通过辅助配置系统更新。

**并行请求与批处理**：我们构建 Web 应用代码以最小化响应页面请求所需的网络往返次数。我们构建表示数据间依赖关系的有向无环图（DAG，Directed Acyclic Graph）。Web 服务器使用此 DAG 最大化可并发获取的项数。平均而言，这些批次每个请求包含 24 个键^2^。

**客户端-服务器通信**：Memcached 服务器彼此不通信。在适当情况下，我们将系统复杂性嵌入无状态客户端而非 memcached 服务器。这大大简化了 memcached，并使我们能够专注于使其在更有限的使用场景下高性能。保持客户端无状态可实现软件的快速迭代并简化部署流程。客户端逻辑以两种组件提供：可嵌入应用的库，或名为 mcrouter 的独立代理。该代理呈现 memcached 服务器接口，并将请求/响应路由到/来自其他服务器。

客户端使用 UDP 和 TCP 与 memcached 服务器通信。我们依赖 UDP 处理 get 请求以降低延迟和开销。由于 UDP 是无连接的，Web 服务器中的每个线程可以直接与 memcached 服务器通信，绕过 mcrouter，无需建立和维护连接，从而减少开销。UDP 实现检测丢失或乱序接收的数据包（使用序列号），并在客户端将其视为错误。它不提供任何恢复机制。在我们的基础设施中，我们发现这一决策是实用的。在峰值负载下，memcache 客户端观察到 0.25% 的 get 请求被丢弃。约 80% 的丢弃是由于延迟或丢失的数据包，其余是由于乱序交付。客户端将 get 错误视为缓存未命中，但 Web 服务器在查询数据后不会将条目插入 memcached，以避免给可能过载的网络或服务器增加额外负载。

为了可靠性，客户端通过与 Web 服务器同机运行的 mcrouter 实例对 set 和 delete 操作使用 TCP。对于需要确认状态变更的操作（更新和删除），TCP 消除了在 UDP 实现中添加重试机制的需要。

Web 服务器依赖高度并行和过度订阅（over-subscription）来实现高吞吐量。开放 TCP 连接的高内存需求使得在每个 Web 线程与 memcached 服务器之间保持开放连接而不通过 mcrouter 进行某种形式的连接合并（connection coalescing）成本过高。合并这些连接通过减少高吞吐量 TCP 连接所需的网络、CPU 和内存资源来提高服务器效率。图 3 显示了生产环境中 Web 服务器通过 UDP 和通过 mcrouter 的 TCP 获取键的平均、中位数和 95 分位延迟。在所有情况下，这些平均值的标准差小于 1%。如数据所示，依赖 UDP 可将请求服务延迟降低约 20%。

^1^ 该页面的 95 分位获取数为 1,740 项。  
^2^ 95 分位为每请求 95 个键。

```text
延迟 (微秒)
0    200   400   600   800   1000  1200  1400
├────┼─────┼─────┼─────┼─────┼─────┼─────┤
│    UDP direct (直接)                         │
│         ████████████████████                  │
│    by mcrouter (TCP)                          │
│              ████████████████████████████████ │
└──────────────────────────────────────────────┘
Average of Medians | Average of 95th Percentiles
```

*图 3：UDP、通过 mcrouter 的 TCP 的 Get 延迟*

**Incast 拥塞**：Memcache 客户端实现流控机制以限制 incast 拥塞。当客户端请求大量键时，如果响应同时到达，可能会压垮机架和集群交换机等组件。因此，客户端使用滑动窗口机制（sliding window）[11] 控制未完成请求的数量。当客户端收到响应时，可以发送下一个请求。类似于 TCP 的拥塞控制，此滑动窗口的大小在成功请求后缓慢增长，在请求无响应时缩小。该窗口独立于目标应用于所有 memcache 请求；而 TCP 窗口仅应用于单个流。图 4 显示了窗口大小对用户请求在 Web 服务器内处于可运行状态但等待调度所花费时间的影响。

```text
等待调度时间 (毫秒)
40 ┤                    ●
30 ┤              ●
20 ┤        ●
10 ┤  ●
 0 ┼───┬────┬────┬────┬────
    100  200  300  400  500  Window Size
    95th Percentile  ●  Median
```

*图 4：Web 请求等待被调度的平均时间*

### 3.2 降低负载

我们使用 memcache 减少沿更昂贵路径（如数据库查询）获取数据的频率。当所需数据未缓存时，Web 服务器会回退到这些路径。以下小节描述三种减少负载的技术。

#### 3.2.1 租约（Leases）

我们引入一种称为租约（leases）的新机制来解决两个问题：过期 set（stale sets）和惊群效应（thundering herds）。当 Web 服务器在 memcache 中设置的值不能反映应缓存的最新值时，会发生过期 set。当对 memcache 的并发更新被重排序时可能发生这种情况。当特定键经历大量读写活动时会发生惊群效应。随着写活动反复使最近设置的值失效，许多读会回退到更昂贵的路径。我们的租约机制解决了这两个问题。

直观地说，当客户端经历缓存未命中时，memcached 实例会向客户端发放租约以将数据设置回缓存。租约是与客户端最初请求的特定键绑定的 64 位令牌。客户端在缓存中设置值时提供租约令牌。有了租约令牌，memcached 可以验证并确定是否应存储数据，从而仲裁并发写入。如果 memcached 因收到该项的 delete 请求而使租约令牌失效，验证可能失败。租约以类似于 load-link/store-conditional [20] 的方式防止过期 set。

对租约的轻微修改也能缓解惊群效应。每台 memcached 服务器调节其返回令牌的速率。默认情况下，我们将这些服务器配置为每个键每 10 秒仅返回一次令牌。在令牌发放后 10 秒内对该键值的请求会导致特殊通知，告诉客户端等待一小段时间。通常，持有租约的客户端会在几毫秒内成功设置数据。因此，当等待的客户端重试请求时，数据通常已在缓存中。

为说明这一点，我们收集了一周内特别容易发生惊群效应的一组键的所有缓存未命中数据。没有租约时，所有缓存未命中导致数据库查询峰值率为 17K/s。使用租约后，峰值数据库查询率为 1.3K/s。由于我们根据峰值负载配置数据库，我们的租约机制转化为显著的效率提升。

**过期值（Stale values）**：使用租约，我们可以在某些用例中最小化应用的等待时间。我们还可以通过识别返回略微过期数据可接受的情况来进一步减少此时间。当键被删除时，其值被转移到保存最近删除项的数据结构，在短暂存在后被刷新。get 请求可以返回租约令牌或标记为过期的数据。能够使用过期数据继续前进的应用无需等待从数据库获取最新值。我们的经验表明，由于缓存值往往是数据库的单调递增快照，大多数应用可以在不做任何更改的情况下使用过期值。

#### 3.2.2 Memcache 池（Memcache Pools）

将 memcache 用作通用缓存层需要不同访问模式、内存占用和服务质量要求的工作负载共享基础设施。不同应用的工作负载可能产生负面干扰，导致命中率下降。

为适应这些差异，我们将集群的 memcached 服务器划分为独立的池（pool）。我们指定一个池（名为 wildcard）作为默认池，并为在 wildcard 中存在问题键配置单独的池。例如，我们可能为访问频繁但缓存未命中成本低的键配置小池。我们也可能为访问不频繁但缓存未命中成本极高的键配置大池。图 5 显示了两种不同项集的工作集（working set），一种是低周转（low-churn）的，另一种是高周转（high-churn）的。

```text
工作集 (TB)
80 ┤     ▓▓▓
60 ┤   ▓▓▓▓▓▓▓
40 ┤ ▓▓▓▓▓▓▓▓▓▓▓
20 ┤▓▓▓▓▓▓▓▓▓▓▓▓▓▓
 0 ┼────────────────────
    Daily  Weekly  Daily  Weekly
    Low-churn      High-churn
    Min Mean Max
```

*图 5：高周转和低周转键族（key family）的日度和周度工作集*

#### 3.2.3 池内复制（Replication Within Pools）

在某些池内，我们使用复制来提高 memcached 服务器的延迟和效率。当 (1) 应用通常同时获取许多键，(2) 整个数据集适合一两台 memcached 服务器，且 (3) 请求率远高于单台服务器可处理时，我们选择在池内复制某类键。

在这种情况下，我们倾向于复制而非进一步划分键空间。考虑一台 memcached 服务器持有 100 项并能以每秒 500k 请求响应。每个请求请求 100 个键。每请求检索 100 个键与 1 个键相比，memcached 开销差异很小。要将系统扩展到处理 1M 请求/秒，假设我们添加第二台服务器并在两者之间平均划分键空间。客户端现在需要将每请求 100 个键拆分为两个并行请求，每个约 50 个键。因此，两台服务器仍须处理每秒 1M 请求。然而，如果我们将所有 100 个键复制到多台服务器，客户端对 100 个键的请求可以发送到任何副本。这将每台服务器的负载降至每秒 500k 请求。每个客户端根据自己的 IP 地址选择副本。此方法需要将失效（invalidation）传递到所有副本以保持一致性。

### 3.3 故障处理

无法从 memcache 获取数据会导致后端服务负载过大，可能引发进一步的级联故障。我们必须在两个规模上解决故障：(1) 少量主机因网络或服务器故障而不可访问，或 (2) 影响集群内相当比例服务器的广泛中断。如果整个集群必须下线，我们将用户 Web 请求转移到其他集群，从而有效移除该集群内 memcache 的所有负载。

对于小规模中断，我们依赖自动化修复系统 [3]。这些操作不是即时的，可能需要几分钟。这段时间足够长，足以导致前述级联故障，因此我们引入机制进一步隔离后端服务免受故障影响。我们专用一小批名为 Gutter 的机器，接管少量故障服务器的职责。Gutter 约占集群中 memcached 服务器的 1%。

当 memcached 客户端对其 get 请求未收到响应时，客户端假定服务器已故障，并再次向特殊的 Gutter 池发出请求。如果第二次请求未命中，客户端将在查询数据库后将适当的键值对插入 Gutter 机器。Gutter 中的条目快速过期以避免 Gutter 失效。Gutter 以略微过期数据为代价限制后端服务的负载。

::: tip 设计说明
此设计不同于客户端在剩余 memcached 服务器间重新哈希键的方法。此类方法由于键访问频率不均匀而存在级联故障风险。例如，单个键可能占服务器请求的 20%。负责此热键的服务器可能也会过载。通过将负载转移到空闲服务器，我们限制了该风险。
:::

---

## 4 区域内：复制

随着需求增长，购买更多 Web 和 memcached 服务器来扩展集群很诱人。然而，naïvely 扩展系统并不能消除所有问题。热门请求的项只会随着添加更多 Web 服务器以应对增加的用户流量而变得更受欢迎。随着 memcached 服务器数量增加，incast 拥塞也会恶化。因此，我们将 Web 和 memcached 服务器拆分为多个前端集群。这些集群与包含数据库的存储集群一起定义了一个区域（region）。此区域架构还允许更小的故障域和可管理的网络配置。我们以数据复制换取更多独立故障域、可管理的网络配置和 incast 拥塞的减少。

本节分析共享同一存储集群的多个前端集群的影响。具体而言，我们解决允许这些集群间数据复制的后果，以及禁止此复制的潜在内存效率。

### 4.1 区域失效（Regional Invalidations）

虽然区域内的存储集群持有数据的权威副本，但用户需求可能将该数据复制到前端集群。存储集群负责失效缓存数据，使前端集群与权威版本保持一致。作为优化，修改数据的 Web 服务器也向其自己的集群发送失效，以提供单用户请求的读后写语义（read-after-write semantics），并减少本地缓存中过期数据的存留时间。

修改权威状态的 SQL 语句被修改为包含事务提交后需要失效的 memcache 键 [7]。我们在每台数据库上部署失效守护进程（名为 mcsqueal）。每个守护进程检查其数据库提交的 SQL 语句，提取任何 delete，并将这些 delete 广播到该区域每个前端集群的 memcache 部署。图 6 说明了此方法。我们认识到大多数失效不会删除数据；事实上，只有 4% 发出的 delete 会导致实际缓存数据失效。

```text
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   MySQL    │────►│  McSqueal   │────►│  Mcrouter   │
│  Storage   │     │ Commit Log  │     │ (Frontend)  │
└─────────────┘     └─────────────┘     └──────┬──────┘
       │                      │                 │
       │ Update Operations    │ Keys to delete  │
       └──────────────────────┴─────────────────┘
```

*图 6：显示需通过守护进程（mcsqueal）删除的键的失效管道*

**降低包速率**：虽然 mcsqueal 可以直接联系 memcached 服务器，但由此产生的从后端集群到前端集群的包发送速率将高得不可接受。此包速率问题是许多数据库与许多 memcached 服务器跨集群边界通信的结果。失效守护进程将 delete 批处理成更少的包，并发送到每个前端集群中运行 mcrouter 实例的一组专用服务器。这些 mcrouter 然后从每批中解包单个 delete，并将这些失效路由到前端集群内同址的正确 memcached 服务器。批处理使每包 delete 的中位数提高了 18 倍。

**通过 Web 服务器失效**：让 Web 服务器向所有前端集群广播失效更简单。不幸的是，此方法有两个问题。首先，由于 Web 服务器在批处理失效方面不如 mcsqueal 管道有效，会产生更多包开销。其次，当出现系统性失效问题时（如因配置错误导致的 delete 错误路由），几乎没有补救措施。过去，这通常需要滚动重启整个 memcache 基础设施，这是一个缓慢且破坏性的过程，我们希望避免。相比之下，将失效嵌入 SQL 语句（数据库提交并存储在可靠日志中）允许 mcsqueal 简单地重放可能丢失或错误路由的失效。

### 4.2 区域池（Regional Pools）

每个集群根据发送给它的用户请求组合独立缓存数据。如果用户请求被随机路由到所有可用前端集群，则各前端集群的缓存数据将大致相同。这使我们能够在维护时使集群下线而不会遭受命中率下降。过度复制数据可能内存效率低下，特别是对于大型、很少访问的项。我们可以通过让多个前端集群共享同一组 memcached 服务器来减少副本数。我们称之为区域池（regional pool）。

跨集群边界会产生更多延迟。此外，我们的网络在集群边界上的平均可用带宽比单集群内少 40%。复制以更多 memcached 服务器换取更少的集群间带宽、更低延迟和更好容错。对于某些数据，放弃复制数据的优势而每区域保留单副本更具成本效益。在区域内扩展 memcache 的主要挑战之一是决定键是需要跨所有前端集群复制还是每区域保留单副本。当区域池中的服务器故障时也使用 Gutter。

|  | A（集群） | B（区域） |
|---|---|---|
| 中位数用户数 | 30 | 1 |
| 每秒 Gets | 3.26 M | 458 K |
| 中位数值大小 | 10.7 kB | 4.34 kB |

*表 1：两类项族（item family）的集群或区域复制决定因素*

### 4.3 冷集群预热（Cold Cluster Warmup）

当我们使新集群上线、现有集群故障或执行计划维护时，缓存命中率会非常差，削弱隔离后端服务的能力。名为冷集群预热（Cold Cluster Warmup）的系统通过允许「冷集群」（即缓存为空的 frontend 集群）中的客户端从「热集群」（即具有正常命中率缓存的集群）而非持久存储获取数据来缓解此问题。这利用了前述跨前端集群发生的数据复制。有了此系统，冷集群可以在几小时内而非几天内恢复到满容量。

必须注意避免竞态条件导致的不一致。例如，如果冷集群中的客户端进行数据库更新，而另一个客户端的后续请求在热集群收到失效之前从热集群检索到过期值，则该项将在冷集群中无限期不一致。Memcached 的 delete 支持非零保持时间（hold-off times），在指定保持时间内拒绝 add 操作。默认情况下，对冷集群的所有 delete 都以两秒保持时间发出。当在冷集群中检测到未命中时，客户端从热集群重新请求该键并将其加入冷集群。add 失败表明数据库上有更新数据，因此客户端将从数据库重新获取值。虽然理论上仍有可能 delete 延迟超过两秒，但这在绝大多数情况下不成立。冷集群预热的运营收益远超罕见缓存一致性问题成本。一旦冷集群命中率稳定且收益减少，我们将其关闭。

---

## 5 跨区域：一致性

数据中心更广泛的地理分布有几个优势。首先，将 Web 服务器放在更靠近最终用户的位置可以显著降低延迟。其次，地理多样性可以缓解自然灾害或大规模停电等事件的影响。第三，新位置可以提供更便宜的电力和其他经济激励。我们通过部署到多个区域获得这些优势。每个区域由存储集群和若干前端集群组成。我们指定一个区域持有主数据库，其他区域包含只读副本；我们依赖 MySQL 的复制机制使副本数据库与主库保持同步。在此设计中，Web 服务器在访问本地 memcached 服务器或本地数据库副本时体验低延迟。在跨多个区域扩展时，保持 memcache 与持久存储间数据的一致性成为主要技术挑战。这些挑战源于单一问题：副本数据库可能落后于主数据库。

我们的系统只是广泛的一致性-性能权衡谱系中的一个点。一致性模型与系统其余部分一样，多年来不断演进以适应站点规模。它混合了在不牺牲我们高性能要求的情况下可实际构建的内容。系统管理的大量数据意味着任何增加网络或存储需求的微小变更都有与之相关的非平凡成本。提供更严格语义的大多数想法很少走出设计阶段，因为它们变得成本过高。与许多针对现有用例定制的系统不同，memcache 和 Facebook 是一起发展的。这使应用和系统工程师能够共同找到对应用工程师足够容易理解、同时高性能且足够简单以可靠大规模工作的模型。我们提供尽力而为的最终一致性（best-effort eventual consistency），但强调性能和可用性。因此，该系统在实践中对我们非常有效，我们认为已找到可接受的权衡。

**来自主区域的写**：我们先前要求存储集群通过守护进程失效数据的决定在多区域架构中有重要后果。具体而言，它避免了失效在数据从主区域复制之前到达的竞态条件。考虑主区域中已完成数据库修改并寻求失效现已过期数据的 Web 服务器。在主区域内发送失效是安全的。然而，让 Web 服务器失效副本区域中的数据可能为时过早，因为变更可能尚未传播到副本数据库。副本区域对数据的后续查询将与复制流竞争，从而增加将过期数据设置到 memcache 的概率。历史上，我们在扩展到多个区域后实现了 mcsqueal。

**来自非主区域的写**：现在考虑当复制延迟过大时从非主区域更新其数据的用户。如果用户最近的变更缺失，其下一次请求可能导致困惑。只有在复制流赶上后，才应允许从副本数据库进行缓存重填。否则，后续请求可能导致获取并缓存副本的过期数据。

我们采用远程标记机制（remote marker mechanism）以最小化读取过期数据的概率。标记的存在表明本地副本数据库中的数据可能过期，查询应重定向到主区域。当 Web 服务器希望更新影响键 k 的数据时，该服务器 (1) 在区域内设置远程标记 rk，(2) 向主库执行写，在 SQL 语句中嵌入 k 和 rk 以失效，(3) 在本地集群中删除 k。在随后对 k 的请求中，Web 服务器将无法找到缓存数据，检查 rk 是否存在，并根据 rk 的存在将查询定向到主区域或本地区域。在这种情况下，我们明确地在缓存未命中时以额外延迟换取读取过期数据概率的降低。

我们通过使用区域池实现远程标记。注意，此机制在对同一键进行并发修改时可能暴露过期信息，因为一个操作可能删除另一个进行中操作应保留的远程标记。值得强调的是，我们将 memcache 用于远程标记的用法在微妙之处不同于缓存结果。作为缓存，删除或驱逐键始终是安全操作；它可能增加数据库负载，但不会损害一致性。相比之下，远程标记的存在有助于区分非主数据库是否持有过期数据。在实践中，我们发现远程标记的驱逐和并发修改情况都很罕见。

**运营考虑**：区域间通信成本高昂，因为数据必须穿越很长的地理距离（例如横跨美国大陆）。通过将 delete 流与数据库复制共享同一通信通道，我们在较低带宽连接上获得网络效率。第 4.1 节中所述的 delete 管理系统也与副本数据库一起部署，以将 delete 广播到副本区域的 memcached 服务器。当下游组件无响应时，数据库和 mcrouter 会缓冲 delete。任何组件的故障或延迟都会增加读取过期数据的概率。一旦这些下游组件再次可用，缓冲的 delete 会被重放。替代方案涉及在检测到问题时使集群下线或过度失效前端集群中的数据。鉴于我们的工作负载，这些方法造成的破坏多于收益。

---

## 6 单服务器改进

全对全通信模式意味着单台服务器可能成为集群的瓶颈。本节描述 memcached 中的性能优化和内存效率提升，使集群内更好地扩展。改进单服务器缓存性能是一个活跃的研究领域 [9, 10, 28, 25]。

### 6.1 性能优化

我们从一个使用固定大小哈希表的单线程 memcached 开始。首批主要优化是：(1) 允许哈希表自动扩展以避免查找时间漂移到 O(n)，(2) 使用全局锁保护多个数据结构使服务器多线程化，(3) 为每个线程提供自己的 UDP 端口以减少发送响应时的争用，并随后分散中断处理开销。前两项优化已贡献回开源社区。本节其余部分探讨尚未在开源版本中提供的进一步优化。

我们的实验主机配备 Intel Xeon CPU (X5650)，运行在 2.67GHz（12 核和 12 超线程），Intel 82574L 千兆以太网控制器和 12GB 内存。生产服务器有更多内存。更多细节先前已发布 [4]。性能测试设置由 15 个客户端向单台 24 线程 memcached 服务器生成 memcache 流量组成。客户端和服务器同机架放置，通过千兆以太网连接。这些测试在持续负载两分钟内测量 memcached 响应的延迟。

**Get 性能**：我们首先研究用细粒度锁（fine-grained locking）替换我们原始的多线程单锁实现的效果。我们通过在发出每请求 10 个键的 memcached 请求之前用 32 字节值预填充缓存来测量命中。图 7 显示了不同版本 memcached 在亚毫秒平均响应时间下可维持的最大请求率。第一组柱是我们的 memcached 在细粒度锁之前，第二组是我们当前的 memcached，最后一组是开源版本 1.4.10，它独立实现了我们锁策略的更粗粒度版本。

```text
最大可持续 items/秒
6M ┤
5M ┤
4M ┤         ████
3M ┤         ████  misses
2M ┤  ████   ████   ████
1M ┤  ████   ████   ████  hits
0M ┼────────────────────────────
   Facebook  Facebook-μlocks  1.4.10
```

*图 7：按 memcached 版本的多 get 命中和未命中性能比较*

采用细粒度锁将命中的峰值 get 率从 600k 提高到 1.8M 项/秒。未命中的性能也从 2.7M 提高到 4.5M 项/秒。命中更昂贵，因为需要构建和传输返回值，而未命中只需整个 multiget 的单个静态响应（END），表明所有键都未命中。

我们还研究了使用 UDP 而非 TCP 的性能效果。图 8 显示了在单 get 和 10 键 multiget 的平均延迟小于一毫秒下我们可维持的峰值请求率。我们发现我们的 UDP 实现在单 get 上比 TCP 实现快 13%，在 10 键 multiget 上快 8%。由于 multiget 比单 get 在每个请求中打包更多数据，它们用更少的包完成相同工作。图 8 显示 10 键 multiget 比单 get 约快四倍。

```text
最大可持续 items/秒
2M ┤     ████  ████
1M ┤ ████ ████ ████ ████
0M ┼────────────────────────
    Get  10-key  Get  10-key
         multiget
    TCP          UDP
```

*图 8：TCP 和 UDP 上单 get 和 10 键 multiget 的 Get 命中性能比较*

### 6.2 自适应 Slab 分配器（Adaptive Slab Allocator）

Memcached 使用 slab 分配器（slab allocator）管理内存。分配器将内存组织成 slab 类（slab classes），每个类包含预分配的、统一大小的内存块。Memcached 将项存储在能容纳项元数据、键和值的最小 slab 类中。Slab 类从 64 字节开始，以 1.07 的因子指数增长到 1 MB，在 4 字节边界对齐^3^。每个 slab 类维护可用块的空闲列表，当其空闲列表为空时以 1MB slab 请求更多内存。一旦 memcached 服务器无法再分配空闲内存，新项的存储通过在该 slab 类内驱逐最近最少使用（LRU，Least Recently Used）的项完成。当工作负载变化时，最初分配给每个 slab 类的内存可能不再足够，导致命中率差。

^3^ 此缩放因子确保我们同时拥有 64 和 128 字节项，它们更适应硬件缓存行。

我们实现了周期性重新平衡 slab 分配以匹配当前工作负载的自适应分配器。如果 slab 类当前正在驱逐项，且下一个待驱逐项的使用时间比其他 slab 类中最近最少使用项的平均值至少新 20%，则将其识别为需要更多内存。如果找到此类，则释放持有最近最少使用项的 slab 并转移到需要的类。注意，开源社区已独立实现了类似的分配器，在 slab 类间平衡驱逐率，而我们的算法专注于平衡类间最旧项的年龄。平衡年龄为整个服务器提供了比调整驱逐率更好的单全局 LRU 驱逐策略近似，驱逐率可能深受访问模式影响。

### 6.3 临时项缓存（The Transient Item Cache）

虽然 memcached 支持过期时间，但条目可能在过期后仍在内存中存留很长时间。Memcached 通过在该项的 get 请求服务时或当它们到达 LRU 末端时检查过期时间来惰性驱逐（lazily evict）此类条目。虽然对常见情况高效，但此方案允许经历单次突发活动的短生命周期键浪费内存直到它们到达 LRU 末端。

因此，我们引入一种混合方案，对大多数键依赖惰性驱逐，并在短生命周期键过期时主动驱逐它们。我们将短生命周期项放入基于项过期时间的链表循环缓冲区（按到期前秒数索引）——称为临时项缓存（Transient Item Cache）。每秒，缓冲区头部桶中的所有项被驱逐，头部前进一。当我们为一组 heavily 使用的、项具有短有用生命周期的键添加短过期时间时；该键族使用的 memcache 池比例从 6% 降至 0.3%，而不影响命中率。

### 6.4 软件升级

频繁的软件变更可能需要用于升级、错误修复、临时诊断或性能测试。memcached 服务器可在几小时内达到其峰值命中率的 90%。因此，升级一组 memcached 服务器可能需要我们超过 12 小时，因为需要仔细管理由此产生的数据库负载。我们修改 memcached 将其缓存值和主要数据结构存储在 System V 共享内存区域中，以便数据可以在软件升级期间保持存活，从而最小化中断。

---

## 7 Memcache 工作负载

我们现在使用生产环境中运行的服务器的数据刻画 memcache 工作负载特征。

### 7.1 Web 服务器测量

我们记录一小部分用户请求的所有 memcache 操作，并讨论我们工作负载的扇出、响应大小和延迟特征。

**扇出（Fanout）**：图 9 显示了 Web 服务器在响应页面请求时可能需要联系的不同 memcached 服务器的分布。如图所示，56% 的页面请求联系少于 20 台 memcached 服务器。按量计，用户请求往往请求少量缓存数据。然而，此分布有长尾。该图还描绘了我们一个更热门页面的分布，更好地展示了全对全通信模式。此类请求的大多数将访问超过 100 台不同服务器；访问数百台 memcached 服务器并不罕见。

```text
请求百分位
100 ┤                    ████████████
 80 ┤              ██████
 60 ┤        ██████
 40 ┤   █████
 20 ┤ ██
  0 ┼──┬────┬────┬────┬────┬────
    20 100 200 300 400 500 600  distinct memcached servers
    All requests ─  A popular data intensive page
```

*图 9：访问的不同 memcached 服务器数量的累积分布*

**响应大小**：图 10 显示了 memcache 请求的响应大小。中位数（135 字节）与平均值（954 字节）的差异意味着缓存项的大小存在很大差异。此外，在约 200 字节和 600 字节处似乎有三个不同的峰值。较大的项往往存储数据列表，而较小的项往往存储单块内容。

```text
请求百分位
100 ┤
 80 ┤        ████████
 60 ┤    ████
 40 ┤  ██
 20 ┤ █
  0 ┼──┬────┬────┬────
    0  200  400  600  Bytes
```

*图 10：获取值的累积分布*

**延迟**：我们测量从 memcache 请求数据的往返延迟，包括路由请求和接收响应的成本、网络传输时间以及反序列化和解压缩的成本。7 天内中位数请求延迟为 333 微秒，75 和 95 分位（p75 和 p95）分别为 475μs 和 1.135ms。空闲 Web 服务器的中位数端到端延迟为 178μs，p75 和 p95 分别为 219μs 和 374μs。p95 延迟间的较大差异源于处理大响应和等待可运行线程被调度，如第 3.1 节所述。

### 7.2 池统计

我们现在讨论四个 memcache 池的关键指标。这些池是 wildcard（默认池）、app（专用于特定应用的池）、用于频繁访问数据的复制池和用于很少访问信息的区域池。在每个池中，我们每 4 分钟收集平均统计，并在表 2 中报告一个月收集期内最高的平均值。此数据近似这些池看到的峰值负载。该表显示了不同池的 get、set 和 delete 率的广泛差异。表 3 显示了每个池的响应大小分布。同样，不同的特征促使我们希望将这些工作负载彼此隔离。

如第 3.2.3 节所述，我们在池内复制数据并利用批处理处理高请求率。注意，复制池具有最高的 get 率（约为次高的约 2.7 倍）以及最高的字节与包比，尽管项大小最小。此数据与我们的设计一致，我们利用复制和批处理实现更好性能。在 app 池中，更高的数据周转导致自然更高的未命中率。该池往往具有被访问几小时然后热度消退让位于更新内容的内容。区域池中的数据往往大且访问不频繁，如请求率和值大小分布所示。

| pool | miss rate | gets/s | sets/s | deletes/s | packets/s | outbound bandwidth (MB/s) |
|------|-----------|--------|--------|-----------|-----------|---------------------------|
| wildcard | 1.76% | 262k | 8.26k | 21.2k | 236k | 57.4 |
| app | 7.85% | 96.5k | 11.9k | 6.28k | 83.0k | 31.0 |
| replicated | 0.053% | 710k | 1.75k | 3.22k | 44.5k | 30.1 |
| regional | 6.35% | 9.1k | 0.79k | 35.9k | 47.2k | 10.8 |

*表 2：选定 memcache 池上每台服务器的流量，7 天平均*

| pool | mean | std dev | p5 | p25 | p50 | p75 | p95 | p99 |
|------|------|---------|-----|-----|-----|-----|------|-------|
| wildcard | 1.11 K | 8.28 K | 77 | 102 | 169 | 363 | 3.65 K | 18.3 K |
| app | 881 | 7.70 K | 103 | 247 | 269 | 337 | 1.68K | 10.4 K |
| replicated | 66 | 2 | 62 | 68 | 68 | 68 | 68 | 68 |
| regional | 31.8 K | 75.4 K | 231 | 824 | 5.31 K | 24.0 K | 158 K | 381 K |

*表 3：各池项大小分布（字节）*

### 7.3 失效延迟

我们认识到失效的及时性是决定暴露过期数据概率的关键因素。为监控此健康度，我们抽样百万分之一的 delete 并记录 delete 发出的时间。我们随后定期在所有前端集群的 memcache 内容中查询抽样键，如果项在应有 delete 失效后仍被缓存则记录错误。在图 11 中，我们使用此监控机制报告 30 天内的失效延迟。我们将此数据分为两个不同部分：(1) delete 源自主区域的 Web 服务器并目标为主区域的 memcached 服务器，(2) delete 源自副本区域并目标为另一副本区域。如数据所示，当 delete 的源和目标与主区域同址时，我们的成功率更高，在 1 秒内达到四个 9 的可靠性，一小时后达到五个 9。然而，当 delete 源自并前往主区域外的位置时，我们的可靠性在一秒内降至三个 9，10 分钟内降至四个 9。根据我们的经验，我们发现如果失效在仅几秒后缺失，最常见的原因是首次尝试失败，后续重试将解决问题。

```text
失败 delete 的比例
1e-03 ┤
1e-04 ┤
1e-05 ┤
1e-06 ┼──┬────┬────┬────┬────┬────
      1s 10s 1m 10m 1h 1d  seconds of delay
      master region  |  replica region
```

*图 11：Delete 管道的延迟*

---

## 8 相关工作

其他几个大型网站已认识到键值存储的实用性。DeCandia 等人 [12] 提出了 Amazon.com 上各种应用服务使用的高可用键值存储。虽然他们的系统针对写密集型工作负载优化，我们的针对读主导的工作负载。同样，LinkedIn 使用 Voldemort [5]，一个受 Dynamo 启发的系统。其他键值缓存解决方案的主要部署包括 Github、Digg 和 Blizzard 的 Redis [6]，以及 Twitter [33] 和 Zynga 的 memcached。Lakshman 等人 [1] 开发了 Cassandra，一个基于模式的分布式键值存储。我们选择部署和扩展 memcached，因其设计更简单。

我们在扩展 memcache 方面的工作建立在分布式数据结构的广泛工作之上。Gribble 等人 [19] 提出了用于 Internet 规模服务的有用键值存储系统的早期版本。Ousterhout 等人 [29] 也提出了大规模内存键值存储系统的案例。与这两种解决方案不同，memcache 不保证持久性。我们依赖其他系统处理持久数据存储。Ports 等人 [31] 提供了管理事务数据库查询缓存结果的库。我们的需求需要更灵活的缓存策略。我们对租约 [18] 和过期读 [23] 的使用利用了高性能系统中缓存一致性和读操作的先前研究。Ghandeharizadeh 和 Yap [15] 的工作也提出了基于时间戳而非显式版本号解决过期 set 问题的算法。虽然软件路由器更容易定制和编程，但它们通常比硬件对应物性能差。Dobrescu 等人 [13] 通过利用多核、多内存控制器、多队列网络接口和通用服务器上的批处理来解决这些问题。将这些技术应用于 mcrouter 的实现仍是未来工作。Twitter 也独立开发了类似 mcrouter 的 memcache 代理 [32]。在 Coda [35] 中，Satyanarayanan 等人展示了因断开操作而分歧的数据集如何可以重新同步。Glendenning 等人 [17] 利用 Paxos [24] 和 quorum [16] 构建 Scatter，一个具有可线性化语义 [21] 的分布式哈希表，对 churn 具有弹性。Lloyd 等人 [27] 在 COPS（一个广域存储系统）中研究了因果一致性。TAO [37] 是另一个 heavily 依赖缓存服务大量低延迟查询的 Facebook 系统。TAO 与 memcache 在两个根本方面不同。(1) TAO 实现了图数据模型，其中节点由固定长度持久标识符（64 位整数）标识。(2) TAO 编码其图模型到持久存储的特定映射，并负责持久性。许多组件，如我们的客户端库和 mcrouter，被两个系统共同使用。

---

## 9 结论

在本文中，我们展示了如何扩展基于 memcached 的架构以满足 Facebook 不断增长的需求。讨论的许多权衡并非根本性的，而是源于在持续产品开发下演进实时系统时平衡工程资源的现实。在构建、维护和演进系统的过程中，我们学到了以下经验。(1) 分离缓存和持久存储系统使我们能够独立扩展它们。(2) 改善监控、调试和运营效率的功能与性能同样重要。(3) 管理有状态组件在运营上比无状态组件更复杂。因此，将逻辑保留在无状态客户端中有助于迭代功能并最小化中断。(4) 系统必须支持新功能的渐进式推出和回滚，即使这会导致功能集的临时异构性。(5) 简单性至关重要。

---

## 致谢

我们要感谢 Philippe Ajoux、Nathan Bronson、Mark Drayton、David Fetterman、Alex Gartrell、Andrii Grynenko、Robert Johnson、Sanjeev Kumar、Anton Likhtarov、Mark Marchukov、Scott Marlette、Ben Maurer、David Meisner、Konrad Michels、Andrew Pope、Jeff Rothschild、Jason Sobel 和 Yee Jiun Song 的贡献。我们还要感谢匿名审稿人、我们的 shepherd Michael Piatek、Tor M. Aamodt、Remzi H. Arpaci-Dusseau 和 Tayler Hetherington 对论文早期草稿的宝贵反馈。最后，我们要感谢 Facebook 的工程师同事的建议、错误报告和支持，使 memcache 成为今天的样子。

---

## 参考文献

[1] Apache Cassandra. http://cassandra.apache.org/.  
[2] Couchbase. http://www.couchbase.com/.  
[3] Making Facebook Self-Healing. https://www.facebook.com/note.php?note_id=10150275248698920.  
[4] Open Compute Project. http://www.opencompute.org.  
[5] Project Voldemort. http://project-voldemort.com/.  
[6] Redis. http://redis.io/.  
[7] Scaling Out. https://www.facebook.com/note.php?note_id=23844338919.  
[8] ATIKOGLU, B., XU, Y., FRACHTENBERG, E., JIANG, S., AND PALECZNY, M. Workload analysis of a large-scale key-value store. ACM SIGMETRICS Performance Evaluation Review 40, 1 (June 2012), 53–64.  
[9] BEREZECKI, M., FRACHTENBERG, E., PALECZNY, M., AND STEELE, K. Power and performance evaluation of memcached on the tilepro64 architecture. Sustainable Computing: Informatics and Systems 2, 2 (June 2012), 81–90.  
[10] BOYD-WICKIZER, S., et al. An analysis of linux scalability to many cores. In Proceedings of the 9th USENIX Symposium on Operating Systems Design & Implementation (2010), pp. 1–8.  
[11] CERF, V. G., AND KAHN, R. E. A protocol for packet network intercommunication. ACM SIGCOMM Computer Communication Review 35, 2 (Apr. 2005), 71–82.  
[12] DE CANDIA, G., et al. Dynamo: amazon's highly available key-value store. ACM SIGOPS Operating Systems Review 41, 6 (Dec. 2007), 205–220.  
[13] FALL, K., et al. Routebricks: enabling general purpose network infrastructure. ACM SIGOPS Operating Systems Review 45, 1 (Feb. 2011), 112–125.  
[14] FITZPATRICK, B. Distributed caching with memcached. Linux Journal 2004, 124 (Aug. 2004), 5.  
[15] GHANDEHARIZADEH, S., AND YAP, J. Gumball: a race condition prevention technique for cache augmented sql database management systems. In Proceedings of the 2nd ACM SIGMOD Workshop on Databases and Social Networks (2012), pp. 1–6.  
[16] GIFFORD, D. K. Weighted voting for replicated data. In Proceedings of the 7th ACM Symposium on Operating Systems Principles (1979), pp. 150–162.  
[17] GLENDENNING, L., et al. Scalable consistency in Scatter. In Proceedings of the 23rd ACM Symposium on Operating Systems Principles (2011), pp. 15–28.  
[18] GRAY, C., AND CHERITON, D. Leases: An efficient fault-tolerant mechanism for distributed file cache consistency. ACM SIGOPS Operating Systems Review 23, 5 (Nov. 1989), 202–210.  
[19] GRIBBLE, S. D., et al. Scalable, distributed data structures for internet service construction. In Proceedings of the 4th USENIX Symposium on Operating Systems Design & Implementation (2000), pp. 319–332.  
[20] HEINRICH, J. MIPS R4000 Microprocessor User's Manual. MIPS technologies, 1994.  
[21] HERLIHY, M. P., AND WING, J. M. Linearizability: a correctness condition for concurrent objects. ACM Transactions on Programming Languages and Systems 12, 3 (July 1990), 463–492.  
[22] KARGER, D., et al. Consistent Hashing and Random trees: Distributed Caching Protocols for Relieving Hot Spots on the World Wide Web. In Proceedings of the 29th annual ACM Symposium on Theory of Computing (1997), pp. 654–663.  
[23] KEETON, K., et al. Lazybase: freshness vs. performance in information management. ACM SIGOPS Operating Systems Review 44, 1 (Dec. 2010), 15–19.  
[24] LAMPORT, L. The part-time parliament. ACM Transactions on Computer Systems 16, 2 (May 1998), 133–169.  
[25] LIM, H., et al. Silt: a memory-efficient, high-performance key-value store. In Proceedings of the 23rd ACM Symposium on Operating Systems Principles (2011), pp. 1–13.  
[26] LITTLE, J., AND GRAVES, S. Little's law. Building Intuition (2008), 81–100.  
[27] LLOYD, W., et al. Don't settle for eventual: scalable causal consistency for wide-area storage with COPS. In Proceedings of the 23rd ACM Symposium on Operating Systems Principles (2011), pp. 401–416.  
[28] METREVELI, Z., et al. Cphash: A cache-partitioned hash table. In Proceedings of the 17th ACM SIGPLAN symposium on Principles and Practice of Parallel Programming (2012), pp. 319–320.  
[29] OUSTERHOUT, J., et al. The case for ramcloud. Communications of the ACM 54, 7 (July 2011), 121–130.  
[30] PHANISHAYEE, A., et al. Measurement and analysis of tcp throughput collapse in cluster-based storage systems. In Proceedings of the 6th USENIX Conference on File and Storage Technologies (2008), pp. 12:1–12:14.  
[31] PORTS, D. R. K., et al. Transactional consistency and automatic management in an application data cache. In Proceedings of the 9th USENIX Symposium on Operating Systems Design & Implementation (2010), pp. 1–15.  
[32] RAJASHEKHAR, M. Twemproxy: A fast, light-weight proxy for memcached. https://dev.twitter.com/blog/twemproxy.  
[33] RAJASHEKHAR, M., AND YUE, Y. Caching with twemcache. http://engineering.twitter.com/2012/07/caching-with-twemcache.html.  
[34] RATNASAMY, S., et al. A scalable content-addressable network. ACM SIGCOMM Computer Communication Review 31, 4 (Oct. 2001), 161–172.  
[35] SATYANARAYANAN, M., et al. Coda: A highly available file system for a distributed workstation environment. IEEE Transactions on Computers 39, 4 (Apr. 1990), 447–459.  
[36] STOICA, I., et al. Chord: A scalable peer-to-peer lookup service for internet applications. ACM SIGCOMM Computer Communication Review 31, 4 (Oct. 2001), 149–160.  
[37] VENKATARAMANI, V., et al. Tao: how facebook serves the social graph. In Proceedings of the ACM SIGMOD International Conference on Management of Data (2012), pp. 791–792.

---

[← 上一篇：FaRM](farm.md) | [返回目录](index.md) | [下一篇：IronFleet →](ironfleet.md)
