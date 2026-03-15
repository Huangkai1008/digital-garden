---
title: IronFleet：证明实用分布式系统的正确性
description: Hawblitzel et al. (Microsoft Research, 2015) 论文翻译：基于 TLA 精化与 Hoare 逻辑的分布式系统形式化验证方法论，SOSP
---

<!-- markdownlint-disable MD025 MD037 -->

# IronFleet：证明实用分布式系统的正确性

**作者**：Chris Hawblitzel, Jon Howell, Manos Kapritsos, Jacob R. Lorch, Bryan Parno, Michael L. Roberts, Srinath Setty, Brian Zill  
**机构**：Microsoft Research（微软研究院）  
**年份**：2015  
**来源**：SOSP (Symposium on Operating Systems Principles)

---

## 摘要

分布式系统以隐藏微妙缺陷而著称。形式化验证（formal verification）在原则上可以事先消除这些缺陷，但验证历来难以在全程序规模应用，更不用说分布式系统规模。

我们描述了一种基于 **TLA 风格状态机精化**（TLA-style state-machine refinement）与 **Hoare 逻辑**（Hoare-logic）验证独特结合的方法论，用于构建实用且可证明正确的分布式系统。我们在一个复杂的 **Paxos 风格复制状态机**（Paxos-based replicated state machine）库实现以及一个基于租约的分片键值存储上演示了该方法论。我们证明二者均满足简洁的安全性规约，以及期望的活性（liveness）要求。每个实现的性能与参考系统相当。借助我们的方法论和经验教训，我们旨在将分布式系统的标准从「已测试」提升到「正确」。

---

## 1 引言

分布式系统以难以做对而著称（notoriously hard to get right）。协议设计者难以推理多机上的并发执行，导致微妙错误。实现此类协议的工程师面临同样的微妙性，更糟的是，必须在抽象协议描述与实际约束（例如真实日志不能无限增长）之间的空白处即兴发挥。充分测试被视为最佳实践，但其有效性受限于分布式系统组合爆炸的状态空间。

理论上，形式化验证可以彻底消除分布式系统中的错误。然而，由于这些系统的复杂性，先前工作主要集中于对分布式协议进行形式化规约 [4, 13, 27, 41, 48, 64]、验证 [3, 52, 53, 59, 61] 或至少进行缺陷检查 [20, 31, 69]，通常以简化形式进行，而未将形式推理扩展到实现层面。

原则上，可以使用**模型检测**（model checking）来推理协议 [42, 59] 与实现 [46, 47, 69] 的正确性。然而在实践中，模型检测是不完备的——结果的准确性取决于模型的准确性——且无法扩展 [4]。

::: tip 本文贡献
本文提出 **IronFleet**，首个对非平凡分布式系统实现的安全性与活性进行自动化机器检查验证的方法论。IronFleet 方法论是实用的：它支持具有合理性能和可承受证明负担的复杂、功能丰富的实现。
:::

IronFleet 最终保证分布式系统的实现满足高层、集中式规约。例如，分片键值存储的行为如同键值存储，复制状态机的行为如同状态机。这一保证彻底排除了竞态条件、全局不变量违反、整数溢出、分组编码与解码不一致，以及诸如故障恢复等极少执行代码路径中的缺陷 [70]。此外，它不仅排除错误行为，还精确告诉我们分布式系统在所有时刻将如何行为。

IronFleet 方法论支持证明分布式系统实现的安全性与活性性质。**安全性性质**（safety property）表示系统不能执行错误动作；例如，复制状态机的**线性化**（linearizability）表示客户端永远不会看到不一致的结果。**活性性质**（liveness property）表示系统最终会执行有用动作，例如最终响应每个客户端请求。在大规模部署中，确保活性至关重要，因为活性缺陷可能导致整个系统不可用。

IronFleet 在安全性性质验证方面比先前工作走得更远（§9），对两个功能完整的系统进行了机械验证。验证不仅应用于其协议，还应用于实现良好性能的实际命令式实现。我们的证明一路推理到网络上发送的 UDP 分组的字节，保证在分组丢失、重排或重复的情况下仍保持正确性。

关于活性，IronFleet 开辟了新天地：据我们所知，IronFleet 是首个对实用协议（更不用说实现）的活性性质进行机械验证的系统。

IronFleet 通过一种用于组织和编写证明的方法论，以及一组用于实现此类系统的通用验证库，实现对复杂分布式系统的全面验证。在结构上，IronFleet 的方法论使用**并发遏制策略**（concurrency containment strategy）（§3），在同一自动化定理证明框架内融合两种不同的验证风格，防止二者之间出现任何语义鸿沟。我们使用 TLA 风格的状态机精化 [36] 推理协议级并发，忽略实现复杂性；然后使用 **Floyd-Hoare 风格**（Floyd-Hoare-style）的命令式验证 [17, 22] 推理这些复杂性，同时忽略并发。为简化并发推理，我们对实现施加了机器检查的**可归约性义务**（reduction-enabling obligation）（§3.6）。最后，我们使用**始终可执行动作**（always-enabled actions）（§4.2）来组织协议，大大简化了活性证明。

为便于编写分布式系统的证明，我们开发了编写自动化友好的不变量证明的技术（§3.3），以及应对证明器限制的规范和工具改进（§6）。对于活性证明，我们在自动化验证框架中构建了 TLA 的嵌入（§4.1），包含可靠释放自动化证明能力的启发式。

为帮助开发者，我们构建了用于常见任务的通用验证库，例如分组解析与编组（marshalling）、将具体数据结构与其抽象对应物关联，以及推理集合。我们还编写了包含 40 条基本 TLA 规则的验证库，用于编写活性证明。

为说明 IronFleet 的适用性，我们构建并证明了两个相当不同的分布式系统的正确性：**IronRSL**，一个基于 Paxos [35] 的复制状态机库；以及 **IronKV**，一个分片键值存储。所有 IronFleet 代码均可公开获取 [25]。

IronRSL 的实现复杂，包含许多先前工作常省略的细节；例如，它支持状态传输、日志截断、动态视图变更超时、批处理以及回复缓存。我们证明了完整的功能正确性及其关键活性性质：若网络对存活的副本法定人数（quorum）最终同步，则反复提交请求的客户端最终会收到回复。

与 IronRSL 不同，IronRSL 使用分布是为了可靠性，而 IronKV 使用分布是为了通过将「热」键迁移到专用机器来提高吞吐量。对于 IronKV，我们证明了完整的功能正确性以及重要的活性性质：若网络公平，则可靠传输组件最终会交付每条消息。

::: warning 验证的局限性
尽管验证可排除大量问题，但它并非万能药（§8）。IronFleet 的正确性并非绝对；它依赖于若干假设（§2.5）。此外，验证需要更多前期开发投入：我们使用的自动化工具可自动填补许多低级证明步骤（§6.3.1），但仍需要开发者的大量协助（§6.3.2）。最后，我们专注于在验证友好的语言中验证新编写的代码（§2.2），而非验证现有代码。
:::

**本文贡献总结：**

- 我们证明了机械验证实用分布式实现（即功能完整且具有合理性能的系统）与简单、逻辑集中式规约的可行性。
- 我们描述了 IronFleet 在单一自动化验证框架内统一 TLA 风格精化与 Floyd-Hoare 逻辑的新颖方法论。
- 我们提供了首个非平凡分布式系统的机器验证活性证明。
- 我们描述了验证分布式系统的工程规范与经验教训。

---

## 2 背景与假设

我们简要描述 IronFleet 所借鉴的现有验证技术，以及我们的假设。

### 2.1 状态机精化

**状态机精化**（state machine refinement）[1, 18, 34] 常用于推理分布式系统 [4, 27, 41, 48, 52, 64]。开发者将期望系统描述为具有潜在无限状态和非确定性谓词的简单抽象状态机。然后她创建一系列日益复杂（但仍为声明式）的状态机，并证明每个都精化其「上方」的机器（图 1）。

```text
L0  L1  L2  L3  L4
|   |   |   |   |
H0  H1  H2  H3  H4  H5  H6  H7
```

*图 1：状态机精化。低级状态机行为 L0…L4 精化高级行为 H0…H7，因为每个低级状态对应一个高级状态。对于每个对应关系（虚线所示），两个状态必须满足规约的精化条件。典型的低级步骤 L0→L1 映射到一个高级步骤 H0→H1。然而，低级步骤可映射到零个（L2→L3）或多个（L3→L4）高级步骤。*

若状态机 L 的每个可能行为（即机器可能访问的每个（可能无限）状态序列）都对应于 H 的等价行为，则 L 精化 H。为获得该方法提供的抽象收益，开发者必须明智地选择抽象层次，这对每个新上下文都是微妙的选择。

分布式系统上下文中的状态机精化（例如 TLA 风格精化）通常考虑声明式规约，而非命令式代码。PlusCal [37] 尝试弥合这一鸿沟，但仅用于小型程序。

### 2.2 Floyd-Hoare 验证

许多程序验证工具支持 **Floyd-Hoare 风格** [17, 22] 的一阶谓词逻辑对命令式程序的推理。换言之，它们允许程序员用关于程序状态的断言标注程序，验证器检查断言对所有可能的程序输入是否成立。例如，图 2 中的代码通过前置条件断言其输入的条件，通过后置条件断言其输出的条件。

```dafny
method halve(x:int) returns (y:int)
  requires x > 0;
  ensures y < x;
{ y := x / 2; }
```

*图 2：简单的 Floyd-Hoare 验证示例。*

如我们先前工作 [21] 所示，我们使用 **Dafny** [39]，一种通过 Z3 [11] SMT 求解器自动化验证的高级语言。这使其能自动填补许多低级证明；例如，它无需任何协助即可轻松验证图 2 中程序对所有可能输入 x 的正确性。

然而，许多命题类在一般情况下是不可判定的，因此 Z3 使用启发式。例如，涉及全称量词（∀）和存在量词（∃）的命题是不可判定的。因此，可能写出在 Dafny 中正确但求解器无法自动证明的代码。开发者可插入标注来引导验证器的启发式。例如，开发者可编写触发器（trigger）以提示验证器将量词变量实例化为何值 [12]。

程序验证通过后，Dafny 将其编译为 C#，并由 .NET 编译器生成可执行文件。其他语言（如 C++）目前不受支持，但将 Dafny 编译到这些语言可能可行。我们先前工作 [21] 展示了如何将 Dafny 编译为可验证汇编，以避免依赖 Dafny 编译器、.NET 和 Windows。

与大多数验证工具一样，Dafny 仅考虑单个单线程程序，而非并发执行的宿主集合。事实上，一些验证专家估计并发程序验证的最先进水平落后于顺序验证十年 [51]。

### 2.3 归约

给定来自真实并发系统的细粒度行为，我们可以使用**归约**（reduction）[40] 将其转换为等效的粗粒度步骤行为，从而简化验证。关键在于，若交换两个步骤对执行结果无影响，则它们可以在行为中交换位置。

归约通常用于共享内存并发程序 [9, 14, 33] 和同步原语 [65] 的上下文。应用归约需要识别系统中的所有步骤，证明它们之间的交换关系，并应用这些关系创建更有用的等效行为。我们在 §3.6 中处理分布式系统上下文中的这些挑战。

### 2.4 动作时序逻辑（TLA）

**时序逻辑**（temporal logic）[54] 及其扩展 **TLA** [34] 是推理安全性与活性的标准工具。时序逻辑公式是关于系统当前和未来状态的谓词。最简单的公式类型忽略未来；例如，在锁系统中，公式 P 可以是「宿主 h 当前持有锁」。其他公式涉及未来；例如，♦P 表示 P 最终成立，□P 表示 P 现在成立且永远成立。例如，性质 ∀h ∈ Hosts : □♦P 表示对于任何宿主，h 最终会持有锁总是成立。

TLA 通常考虑抽象规约，而非命令式代码。此外，TLA 的朴素嵌入往往会给自动化验证带来问题。毕竟，每个 □ 涉及全称量词，每个 ♦ 涉及存在量词。由于 Z3 需要启发式来判定带量词的命题（§2.2），可能因开发者标注不足而失败。我们在 §4.1 中解决这一问题。

### 2.5 假设

我们的保证依赖于以下假设。

我们的一小部分代码是假设而非证明正确的。因此，要信任系统，用户必须阅读这些代码。具体而言，每个系统的规约是可信的，§3.7 中描述的简要主事件循环也是可信的。

我们不假设分组可靠交付，因此网络可以任意延迟、丢弃或重复分组。我们假设网络不会篡改分组，且分组头中的地址是可信的。这些关于消息完整性的假设在数据中心或 VPN 内易于强制执行，可通过建模必要的密码原语来讨论密钥而非地址来放宽 [21]。

我们假设 Dafny、.NET 编译器和运行时以及底层 Windows OS 的正确性。先前工作 [21] 展示了如何将 Dafny 代码编译为可验证汇编代码以避免这些依赖。我们还依赖底层硬件的正确性。

我们的活性性质依赖于进一步假设。对于 IronRSL，我们假设存在一个副本法定人数 Q、最小调度频率 F、最大网络延迟 Δ、最大突发大小 B 和最大时钟误差 E（实现可能均未知），使得 (1) 最终，Q 中每个副本的调度器以至少 F 的频率运行，且永不耗尽内存；(2) 最终，Q 中副本之间和/或客户端之间发送的任何消息在 Δ 内到达；(3) 最终，Q 中任何副本不会以过高速率接收分组，即每 10B/F + 1 时间单位接收不超过 B 个分组；(4) 每当 Q 中副本读取其时钟时，读数与真实全局时间的偏差不超过 E；(5) Q 中任何副本都不会因达到溢出防护限制而停止进展。对于 IronKV，我们假设每个宿主的主循环无限次执行，且网络公平，即无限次发送的消息最终会交付。

---

## 3 IronFleet 验证方法论

IronFleet 将分布式系统的实现与证明组织成层次（图 3），以避免微妙的分布式协议与实现复杂性之间的交织。

```text
I0  I1  I2  I3
|   |   |   |
P0  P1  P2  P3
|   |   |   |
H0  H1  H2  H3  H4

高层规约 (§3.1)
分布式协议 (§3.2)
实现 (§3.4)
    ↑ 精化 (§3.3)
    ↑ 精化 (§3.5)
```

*图 3：验证概览。IronFleet 将分布式系统划分为精心选择的层次。我们使用 TLA 风格验证证明协议层（如 P0…P3）的任何行为精化高层规约（如 H0…H4）的某种行为。然后我们使用 Floyd-Hoare 风格证明实现（如 I0…I3）的任何行为精化协议层的某种行为。*

在顶层（§3.1），我们编写系统行为的简单规约。然后我们编写抽象分布式协议层（§3.2），并使用 TLA 风格技术证明其精化规约层（§3.3）。接着我们编写在每个宿主上运行的命令式实现层（§3.4），并证明尽管编写真实系统代码时引入了复杂性，实现仍正确精化协议层（§3.5）。

为避免对多宿主低级操作的交错执行进行复杂推理，我们使用并发遏制策略：上述证明假设每个实现步骤执行一个原子协议步骤。由于真实实现的执行并非原子，我们使用「归约」论证（§2.3）证明假设原子性的证明对真实系统同样有效。该论证需要实现的一个机械验证性质，以及关于该性质含义的小型纸面证明。§4 将这一方法论扩展到证明活性性质。

### 3.1 高层规约层

系统正确意味着什么？可以非正式地列举一组性质并希望它们足以提供正确性。更严谨的方式是定义**规约**（spec），即系统所有允许行为的简洁描述，并证明实现总是生成与规约一致的输出。

在 IronFleet 中，开发者将系统的规约编写为状态机：从某个初始状态开始，规约简洁地描述该状态如何可被转换。规约通过三个谓词（即返回真或假的函数）定义状态机。**SpecInit** 描述可接受的起始状态，**SpecNext** 描述从旧状态到新状态的可接受方式，**SpecRelation** 描述实现状态与其对应抽象状态之间所需关系的条件。例如，在图 3 中，SpecInit 约束 H0 可为何，SpecNext 约束 H0→H1 和 H1→H2 等步骤，SpecRelation 约束 (I1, H1) 和 (I2, H4) 等对应状态对。为避免对规约实现的不必要约束，SpecRelation 应仅讨论实现的外部可见行为，例如其迄今发送的消息集合。

作为玩具示例，图 4 中的规约描述了一个简单的分布式锁服务，其中单个锁在宿主之间传递。它将系统状态定义为历史：宿主 ID 的序列，使得序列中第 n 个宿主在 epoch n 持有锁。最初，该历史包含一个有效宿主。系统可通过将有效宿主追加到历史来从旧状态步进到新状态。若所有 epoch n 的锁消息都来自历史中第 n 个宿主，则实现与规约一致。

```dafny
datatype SpecState = SpecState(history:seq<HostId>)
predicate SpecInit(ss:SpecState)
  { |ss.history|==1 && ss.history[0] in AllHostIds() }
predicate SpecNext(ss_old:SpecState,ss_new:SpecState)
  { exists new_holder :: new_holder in AllHostIds() &&
    ss_new.history == ss_old.history + [new_holder] }
predicate SpecRelation(is:ImplState,ss:SpecState)
  { forall p :: p in is.sentPackets && p.msg.lock? ==>
    p.src == ss.history[p.msg.epoch] }
```

*图 4：玩具锁规约。*

通过保持规约简单，怀疑者可以研究规约以理解系统性质。在我们的示例中，她可以轻松得出结论：锁永远不会被多个宿主同时持有。由于规约捕获了所有允许的系统行为，她随后可以仅通过验证它们由规约蕴含来验证实现的额外性质。

### 3.2 分布式协议层

在不可信的分布式协议层，IronFleet 方法论引入了仅通过网络消息通信的独立宿主概念。为管理这一新复杂性，我们保持该层简单且抽象。

更详细地，我们在 Dafny（§2.2）中形式化指定分布式系统状态机。该状态机由 N 个宿主状态机和网络分组集合组成。在分布式系统状态机的每一步中，一个宿主的状态机执行一步，允许其原子地读取网络消息、更新其状态并向网络发送消息；§3.6 放宽了这一原子性假设。

开发者必须指定每个宿主的状态机：宿主本地状态的结构、该状态如何初始化（**HostInit**）以及如何更新（**HostNext**）。IronFleet 通过以下三种方式减少开发者的负担。

首先，我们对宿主状态和网络接口使用简单、抽象的风格；例如，状态使用无界数学整数（忽略溢出问题）、无界值序列（例如跟踪所有已发送或接收的消息）和不可变类型（忽略内存管理和堆别名）。网络允许宿主发送和接收高层、结构化的分组，从而排除该层的编组和解析挑战。

其次，我们使用声明式谓词风格。换言之，HostNext 仅描述宿主状态在每一步如何可变化；它不给出如何实现这些变化的细节，更不用说如何以良好性能实现。

第三，从协议的角度来看，上述定义的每一步都是原子发生的，大大简化了协议精化规约层的证明（§3.3）。在 §3.6 中，我们将这一假设原子性的证明连接至真实执行。

继续我们的锁示例，协议层可能定义宿主状态机如图 5 所示。在分布式系统通过 HostInit 初始化每个宿主期间，恰好一个宿主通过 held 参数获得锁。HostNext 谓词然后说，若新状态是两种动作之一的结果，宿主可以执行一步，每种动作由其自己的谓词表示。这两种动作是放弃锁（**HostGrant**）和从另一宿主接收锁（**HostAccept**）。若在旧状态宿主持有锁，且在新状态不再持有，且出站分组（spkt）表示向另一宿主的传输消息，则宿主可以授予锁。接受锁类似。

```dafny
datatype Host = Host(held:bool,epoch:int)
predicate HostInit(s:Host,id:HostId,held:bool)
  { s.held==held && s.epoch==0 }
predicate HostGrant(s_old:Host,s_new:Host, spkt:Packet) {
  { s_old.held && !s_new.held && spkt.msg.transfer?
    && spkt.msg.epoch == s_old.epoch+1 }
predicate HostAccept(s_old:Host,s_new:Host, rpkt:Packet,spkt:Packet)
  { !s_old.held && s_new.held && rpkt.msg.transfer?
    && s_new.epoch == rpkt.msg.epoch == spkt.msg.epoch
    && spkt.msg.lock? }
predicate HostNext(s_old:Host,s_new:Host, rpkt:Packet,spkt:Packet)
  { HostGrant(s_old,s_new,spkt) || HostAccept(s_old,s_new,rpkt,spkt) }
```

*图 5：锁服务的简化宿主状态机。*

### 3.3 连接协议层与规约层

我们证明的每个系统的第一个主要定理是：分布式协议层精化高层规约层。换言之，给定 IronFleet 分布式系统中 N 个宿主执行由 HostNext 谓词定义的原子协议步骤的行为，我们提供高层状态机规约的对应行为。

我们使用证明精化的标准方法，如图 3 所示。首先，我们定义精化函数 **PRef**，它接受分布式协议状态机的状态并返回集中式规约的对应状态。我们可以使用关系而非函数，但使用函数证明更简单 [1]。其次，我们证明分布式协议初始状态的 PRef 满足 SpecInit。第三，我们证明若协议步骤将状态从 ps_old 变为 ps_new，则存在从 PRef(ps_old) 到 PRef(ps_new) 的合法高层规约步骤序列。

与先前基于精化的工作（§2.1）不同，我们使用为自动化定理证明设计的语言 Dafny [39]。这减少但未消除所需的人工证明投入（§6.3）。由于我们也在 Dafny 中验证实现（§3.5），我们避免了实现对协议的视图与我们所证明正确的协议之间的任何语义鸿沟。

证明协议到规约定理的挑战来自对分布式系统全局性质的推理。一个关键工具是建立**不变量**（invariants）：应在分布式协议执行过程中始终成立的谓词。在锁示例中，我们可能使用不变量：锁要么恰好被一个宿主持有，要么由一条在途锁传输消息授予。我们可以通过证明每个协议步骤保持它来归纳证明这一不变量。然后证明规约的精化就很简单了。

为给定协议识别正确的不变量需要对协议有深入理解，但这是可以通过经验发展的技能（§6）。

**不变量量词隐藏**。许多有用的不变量，如「对于每条发送的回复消息，存在对应的请求消息」，涉及量词。不幸的是，此类量词给验证器带来问题（§2.2）。因此我们采用了一种称为**不变量量词隐藏**（invariant quantifier hiding）的风格：我们证明涉及量词但未显式将这些量词暴露给验证器的不变量。关键是建立不变量时，证明显式实例化所有绑定变量。对于不变量中不接在存在量词之后的每个全称量词，量词变量是证明的输入参数。对于每个存在量词，量词变量是输出参数。例如，本段开头的不变量可以用图 6 证明。编写此证明很容易，因为我们只需证明特定回复消息，而非全部。如上所示，只需考虑两种情况：(1) 回复消息刚生成，此时我们只需考虑最后执行的动作；或 (2) 回复消息已存在于上一步，此时我们可以通过对步骤归纳完成证明。

使用此证明也很容易，因为与其陈述关于请求消息存在的事实，不如显式提供该存在的见证。通常，开发者只需证明特定回复消息的不变量；这种形式让她精确建立该事实。若开发者需要全称量词版本，她可以通过在循环中调用不变量证明来建立。

```dafny
lemma ReplyToReq(reply:MessageReply, behavior:map<int,HostState>, step:nat)
  returns (req:MessageRequest)
  requires IsValidBehaviorUpTo(behavior, step);
  requires reply in behavior[step].network;
  ensures req in behavior[step].network;
  ensures Matches(req, reply);
{
  assert step > 0; // because a packet was sent
  if !(reply in behavior[step-1].network) {
    req := OnlyExecReplies(behavior, step-1);
  } else { // apply induction
    req := ReplyToReq(behavior, step-1, reply);
  }
}
```

*图 6：用隐式量词建立不变量。*

### 3.4 实现层

与声明式协议层不同，在实现层开发者编写在每个宿主上运行的单线程命令式代码。该代码必须处理我们在协议层抽象掉的所有丑陋实践。例如，它必须处理宿主交互的真实约束：由于网络分组必须是有界大小的字节数组，我们需要证明将高层数据结构编组为字节以及解析这些字节的例程的正确性。我们还以性能为目标编写实现，例如使用可变数组而非不可变序列，使用 uint64 而非无限精度整数。后者要求我们证明系统在存在整数溢出潜在可能的情况下仍正确。

Dafny 本身不支持网络，因此我们使用可信的 UDP 规约扩展语言，暴露 Init、Send 和 Receive 方法。例如，Send 期望目标 IP 地址和端口以及消息体的字节数组。编译时，对这些 Dafny 方法的调用会调用 .NET UDP 网络栈。Send 还会自动插入宿主的正确 IP 地址，满足 §2.5 中关于分组头的假设。

网络接口维护一个**幽灵变量**（ghost variable）（即仅用于验证、不用于执行的变量），记录每次 Send 和 Receive 的「日志」，包括所有参数和返回值。我们在证明实现性质时使用此日志（§3.5）。

### 3.5 连接实现与协议

我们证明的每个 IronFleet 系统的第二个主要定理是：实现层正确精化协议。为此，我们证明尽管实现操作具体本地状态（使用堆依赖、有界表示），它仍是协议层的精化（协议层使用抽象类型和无界表示）。

首先，我们证明宿主实现精化协议层中描述的宿主状态机。该精化证明与 §3.3 中的类似，但简化为实现的每一步恰好对应宿主状态机的一步。我们定义精化函数 **HRef**，将宿主的实现状态映射到宿主协议状态。我们证明宿主状态初始化的代码 ImplInit 确保 HostInit(HRef(hs))，执行一步宿主的代码 ImplNext 确保 HostNext(HRef(hs_old), HRef(hs_new))。

然后，我们用它证明由 N 个宿主实现组成的分布式系统（即我们实际打算运行的）精化 N 个宿主的分布式协议。我们使用精化函数 **IRef**，将分布式实现的状态映射到分布式协议的状态。精化证明基本直接，因为每个宿主执行 ImplNext 的分布式实现步骤对应一个宿主执行 HostNext 步骤的分布式协议步骤。

困难的部分是证明分布式系统实现中的网络状态精化协议层中的网络状态。具体而言，我们必须证明每个 UDP 分组的发送或接收对应抽象分组的发送或接收。这涉及证明：当宿主 A 将数据结构编组为字节数组并发送给宿主 B 时，B 解析出相同的数据结构。

我们证明的最后一个主要定理是：分布式实现精化抽象集中式规约。为此，我们使用两个主要精化定理的精化函数，将它们组合形成最终精化函数 PRef(IRef(·))。该证明的关键部分是建立指定的关系条件，即对于所有实现状态 is，SpecRelation(is, IRef(PRef(is))) 成立。

### 3.6 通过归约抽象非原子性

§3.1–3.5 描述了假设每个实现步骤执行原子协议步骤的机械验证证明结构。然而，实现的事件处理器并非原子：当一个宿主接收分组、本地计算并发送分组时，其他宿主也会并发执行相同操作，导致这些低级操作的任意交错。为弥合这一鸿沟，我们使用「归约」论证（§2.3）。归约通常用于推理共享单机的线程和进程，但我们将其应用于推理分布式系统。尽管 Dafny 不提供推理归约的通用机制，我们仍能使用 Dafny 对实现施加使归约可用的义务。该义务使归约可用的机械验证证明是未来工作；我们在此仅概述非正式论证。

宿主无法直接观察其他宿主的状态，只能通过观察它们发送的分组间接观察。因此，可以取系统的行为（表示事件实际发生的顺序），并假设另一种顺序，其中 (1) 每个宿主以相同顺序接收相同分组，(2) 分组发送顺序保持，(3) 分组永远不会在发送前被接收，(4) 任何单个宿主上的操作顺序保持。任何假设这种顺序的正确性证明都意味着对原始行为的证明，因为只有系统的外部化行为、发送的消息内容和顺序才重要。

图 7 显示了此类重排序的示例。我们从底部的真实行为开始，重排序直到到达顶部的行为。例如，我们可以将 A 的第一次发送重排到 B 的第一次接收之前，因为我们知道其内容不可能依赖于 B 的接收。顶部行为在不同宿主的 HostNext 步骤之间没有交错，因此是我们在其中证明了正确性的合法行为。因此，正确性证明也适用于真实行为。

```text
      AR  AP  BR  AS  BP  AP  AR  BP  BS  AS  ← 实际执行
      AR  AP  AS  BR  AS  BP  BP  AR  BS  AP  AS
      AR  AP  AS  AS  BR  BP  BP  BS  AR  AP  AS  ← 等效执行

      HostNext A  HostNext A  HostNext B
```

*图 7：归约。在真实执行行为中，宿主 A 和 B 的发送(S)、接收(R)和本地处理(P)步骤完全交错。然而，某些步骤可交换以产生等效行为。由于我们对实现事件处理器的结构施加约束（图 8），我们可以交换步骤直到给定宿主事件处理器中所有实现级步骤（圈出）连续。然后该归约行为允许直接精化到分布式协议层。*

因此，若我们约束实现在任何给定步骤中先执行所有接收再执行所有发送，我们总能通过此类重排序将真实执行行为归约为原子步骤序列。我们称此为**可归约性义务**（reduction-enabling obligation），我们用 Dafny 强制执行（§3.7）。有了这一义务，我们确保假设原子性的正确性证明对真实系统同样有效。

一个复杂之处是：当宿主执行依赖时间的操作（如读取时钟）时，即使没有与其他宿主通信，也会产生因果约束。这是因为时钟表示来自全局共享现实的非完美样本。因此，可归约性义务扩展如下：一步最多执行一个依赖时间的操作，即最多一次时钟读取、阻塞接收或返回空分组的非阻塞接收。该步骤必须在此依赖时间的操作之前执行所有接收，之后执行所有发送。

### 3.7 可信代码

几乎所有 IronFleet 代码都使用上述方法论验证，因此只有少数几行代码和证明断言需要用户阅读以获得对系统的信心。首先，她必须阅读高层集中式规约以理解所保证的内容。其次，她必须阅读断言（而非其证明）：若分布式系统中每个宿主运行 ImplInit 后跟 ImplNext 的循环，则存在集中式规约的对应抽象行为。第三，她必须阅读顶层主宿主例程（图 8）以说服自己每个宿主运行 ImplInit 和 ImplNext。该代码还通过使用 §3.4 中外部可见事件的日志，确保每个宿主步骤满足其可归约性约束。

```dafny
method Main() {
  var s := ImplInit();
  while (true)
    invariant ImplInvariant(s);
  {
    ghost var journal_old := get_event_journal();
    ghost var ios_performed:seq<IoEvent>;
    s, ios_performed := ImplNext(s);
    assert get_event_journal() == journal_old + ios_performed;
    assert ReductionObligation(ios_performed);
  }
}
```

*图 8：强制宿主事件处理器循环。*

---

## 4 验证活性

§3 将高层规约描述为状态机。此类规约说明实现**不得**做什么：它绝不能偏离状态机的行为。然而，指定实现**必须**做什么也很有用；这种形式的性质称为**活性性质**（liveness properties）。例如，我们可能指定锁实现最终将锁授予每个宿主（图 9）。因此，规约通常不仅包括状态机，还包括活性性质。

一些研究者提出了检测和消除可能活性违反来源的启发式 [31, 66]，但明确证明其不存在更好。有了这样的证明，我们不必推理死锁或活锁等；此类条件以及任何阻止系统进展的其他条件都会被证明排除。

活性性质比安全性性质更难验证。安全性证明只需推理两个系统状态：若每两步之间的步骤保持系统的安全不变量，则我们可以归纳得出结论：所有行为都是安全的。相比之下，活性需要推理无限系列的系统状态。这种推理给自动化定理证明器带来挑战（§2.4），往往导致证明器超时而非返回成功验证或有用错误消息。

在 IronFleet 中，我们通过 Dafny 中的自定义 TLA 嵌入来解决这些挑战，将证明器的努力集中在富有成效的方向。然后我们使用 TLA 嵌入构建从第一性原理验证的基本 TLA 证明规则库。该库是证明任意分布式系统活性性质的有用工具：其规则允许人类开发者和 Dafny 通过单次调用库中的引理以大步推理在高层次操作。最后，通过使用始终可执行动作来组织协议，我们大大简化了证明活性性质的任务。

```dafny
predicate LockBehaviorFair(b:map<int,SpecState>)
  { forall h:Host, i:int :: h in AllHostIds() && i >= 0
    ==> exists j :: j >= i && h == last(b[j].history) }
```

*图 9：锁服务的期望活性性质。*

### 4.1 TLA 嵌入与库

如 §2.4 所述，TLA [34] 是推理活性的标准工具。IronFleet 通过在 Dafny 中建模 TLA 行为（系统状态的无限序列）为从整数到状态的映射 B 来嵌入 TLA，其中 B[0] 是初始状态，B[i] 是第 i 个后续状态。活性性质是状态机行为的约束。例如，图 9 表示对于每个宿主 h，总存在更晚的时刻 h 将持有锁。

我们的嵌入在真正需要之前对证明器隐藏关键定义，而是提供将它们相互关联的验证引理。例如，我们将时序逻辑公式表示为不透明对象（即 Dafny 一无所知的对象）类型 temporal，将 □ 等 TLA 变换表示为将 temporal 对象转换为 temporal 对象的函数。

当然，在某些上下文中我们确实需要推理 □ 和 ♦ 的内部含义。Z3 等最先进的 SMT 求解器尚未直接提供 □ 和 ♦ 等时序算子的判定过程。然而，我们可以使用对步骤的显式量词来编码这些算子（□ 对所有未来步骤全称量词，♦ 对某个未来步骤存在量词）。然后我们可以使用求解器对触发器的支持为 SMT 求解器提供这些量词的控制启发式 [12]，如 §2.2 所述。一个简单的启发式在许多情况下被证明有效：当求解器考虑一个公式（如 ♦Q）的未来步骤 j 时，该启发式请求求解器也将 j 作为其他以 □ 或 ♦ 开头的公式（如 □P 和 ♦(P ∧ Q)）的候选步骤。这允许求解器自动证明 (♦Q) ∧ (□P) ⟹ ♦(P ∧ Q) 等公式。

该启发式足够有效，可以自动证明 40 条基本 TLA 证明规则，即从其他公式推导一个公式的规则 [34]。该启发式允许我们高效证明复杂规则；例如，我们仅用 27 行 Dafny 陈述并证明了 Lamport 关于不变量的 INV1 规则，关于公平性的 WF1 规则仅用 16 行。

我们的活性证明使用这些基本证明规则引理来证明时序公式变换。例如，如 §4.4 所述，活性证明通常可以通过反复调用 WF1 规则证明其大部分步骤。

### 4.2 始终可执行动作

为实现活性，我们的协议必须满足公平性性质。即，它必须确保每个动作（如 HostGrant 或 HostAccept）及时发生。Lamport [36] 建议此类性质采取「若动作 A 变得始终可执行（即始终可做），实现必须最终执行它」的形式。然而，在验证代码中持有这种形式的项是有问题的。若公平性性质是复杂公式，可能难以刻画动作可执行的状态集合。这种困难既使证明公平性性质足以确保活性性质变得复杂，也使证明协议具有公平性性质变得复杂。

因此，我们改用**始终可执行动作**（always-enabled actions）；即，我们只使用始终可执行的动作。例如，我们不会使用图 5 中的 HostGrant，因为若不持有锁则无法执行。相反，我们可能使用「若持有锁，则将其授予下一个宿主；否则，什么都不做」，这总是可以执行。

我们的方法偏离了 Lamport 的标准公平性公式，这意味着它可能接受非**机器封闭**（machine closed）的规约 [36]。机器封闭确保活性条件与安全条件结合不会产生不可实现的规约，例如实现必须既授予锁（为公平）又不授予锁（为安全，因为不持有锁）。幸运的是，机器封闭在 IronFleet 中不是问题：满足公平性性质的实现的存在本身就是该性质不阻止实现的证明！

### 4.3 证明公平性性质

遵循 IronFleet 让实现层仅处理实现复杂性的总体哲学，我们将满足公平性性质的负担放在协议层。实现自动满足这些性质，因为其主方法实现了 HostNext。图 8 中的强制结构确保 HostNext 无限次运行。因此，我们只需证明：若 HostNext 无限次运行，则每个动作无限次发生。我们通过让 HostNext 成为保证每个动作定期发生的调度器来实现。

一种方法是使用简单的轮询调度器。我们库中目前有证明：若 HostNext 是无限次运行的轮询调度器，则每个动作无限次运行。此外，若主宿主方法以频率 F 运行（例如以每秒次数表示），则其 n 个动作中的每一个以频率 F/n 发生。

### 4.4 活性证明策略

活性证明的大部分涉及证明：若某条件 Ci 成立则最终另一条件 Ci+1 成立。通过将此类证明链接起来，我们可以证明：若某假设的初始条件 C0 成立则最终某有用条件 Cn 成立。例如，在 IronRSL 中，我们证明：若副本收到客户端请求，它最终会怀疑其当前视图；若怀疑当前视图，它最终会向后续视图的潜在领导者发送消息；若潜在领导者收到法定人数的怀疑，它最终会启动下一个视图。

该链中的大多数步骤需要应用 Lamport WF1 规则的变体 [34]。该变体涉及起始条件 Ci、结束条件 Ci+1 和始终可执行动作谓词 Action。它陈述：若满足以下三个要求，则 Ci 导致 Ci+1：

1. 若 Ci 成立，只要 Ci+1 不成立，Ci 继续成立。
2. 若满足 Action 的转换在 Ci 成立时发生，则导致 Ci+1 成立。
3. 满足 Action 的转换无限次发生。

我们在 Dafny 中如下使用。假设我们需要一个引理证明 Ci 导致 Ci+1。我们首先找到旨在导致此的动作转换 Action。然后我们通过仅考虑相邻步骤对的不变量证明建立要求 1 和 2。然后我们调用 §4.3 的证明：每个动作转换无限次发生，以建立要求 3。最后，在建立我们验证库中 WF1 引理的三个前提后，我们调用该引理。

在某些情况下，我们需要库中证明 WF1 证明规则其他变体可靠的引理。例如，我们通常必须证明 Ci 不仅最终导致 Ci+1，而且在有界时间内。为此，我们有一个 WF1 变体，证明 Ci+1 在 Action 频率的倒数内成立。它使用修改的要求 3：Action 以最小频率发生。

另一个有用的 WF1 变体是**延迟、有界时间 WF1**。它适用于 Action 仅在某个时间 t 之后才诱导 Ci+1；这在为性能原因对某些动作进行限速的系统中很常见。例如，为分摊共识成本，IronRSL 中提出一批请求的动作有一个计时器，防止在上次批处理之后太早发送不完整的批。延迟、有界时间 WF1 使用修改的要求 2：「若 Action 在 Ci 成立且时间 ≥ t 时发生，则导致 Ci+1 成立。」该变体证明 Ci+1 在 t 加上动作频率的倒数之后最终成立。

有时，活性证明需要的不仅仅是条件链：它必须证明多个条件最终同时成立。例如，在 IronRSL 中，我们必须证明潜在领导者最终同时知道法定人数中每个副本的怀疑。为此，我们使用时序启发式证明证明规则可靠：「若条件集合中的每个条件最终永远成立，则最终集合中所有条件同时永远成立。」我们也有并使用该规则的有界时间变体。

---

## 5 系统实现

我们使用 IronFleet 方法论实现两个实用分布式系统并证明其正确性：基于 Paxos 的复制状态机库和基于租约的分片键值存储。所有 IronFleet 代码均可公开获取 [25]。

### 5.1 IronRSL：复制状态机库

IronRSL 在多台机器上复制确定性应用，使该应用具有容错能力。此类复制常用于 Chubby 和 ZooKeeper [5, 24] 等许多其他服务依赖的服务。由于这些依赖，复制中的正确性缺陷可能导致级联问题，活性缺陷可能导致所有依赖服务的广泛中断。

IronRSL 在不牺牲运行真实工作负载所需的复杂实现特性的情况下保证安全性与活性。例如，它使用批处理分摊共识成本、日志截断约束内存使用、响应式视图变更超时避免关于时间的硬编码假设、状态传输让节点从长时间网络断开中恢复，以及回复缓存避免不必要工作。

#### 5.1.1 高层规约

IronRSL 的规约是简单的**线性化**（linearizability）：它必须生成与在单节点上顺序运行应用的系统相同的输出。我们的实现以典型复制状态机库相同的方式实现：它在多个节点上运行应用，并使用 **MultiPaxos** [35] 共识协议以相同顺序向每个副本提供相同请求。

#### 5.1.2 分布式协议层

**协议**。在协议层，每个宿主的状态由基于 Lamport 对 Paxos [35] 描述的四个组件组成：提议者（proposer）、接受者（acceptor）、学习者（learner）和执行者（executor）。宿主的动作谓词包括，例如，提出一批请求（图 10）或向落后的宿主发送本地应用状态。

**协议不变量**。协议的关键不变量，称为**一致性**（agreement），是两个学习者永远不会对同一槽位决定不同的请求批。建立该不变量需要建立关于早期协议动作的若干更多不变量。例如，我们证明 ProposeValue（图 10）不能提出可能已被学习的不同的批。该动作的谓词陈述：仅当宿主收到至少 f + 1 个接受者的 1b 消息时才能提出批。我们用它证明该接受者法定人数与任何其他可能在先前 ballot 中接受批的法定人数相交。

**协议精化**。建立协议不变量后，我们证明执行已决定的请求批序列等价于在高层状态机中执行步骤。一个挑战是多个副本执行相同的请求批，但对应的高层步骤必须只执行一次。我们通过将分布式系统精化为抽象状态机来解决这一问题，该状态机不是在副本执行请求批时推进，而是在副本法定人数就下一请求批投票时推进。

```dafny
predicate ExistsProposal(m_set:set<Msg1b>, op:Op)
  { exists p :: p in m_set && op in p.msg.votes }
predicate ProposeBatch(s:Proposer,s':Proposer)
  { if |s.1bMsgs| < quorumSize then no_op()
    else if ExistsProposal(s.1bMsgs,s.nextOp) then
      var new_batches := s.proposedBatches[s.nextOp :=
        BatchFromHighestBallot(s.1bMsgs, s.nextOp)];
      s' == s[nextOp := s.nextOp + 1][proposedBatches := new_batches]
    else ... }
```

*图 10：IronRSL 中的步骤谓词示例（简化）。*

#### 5.1.3 实现层

通常，编写实现协议动作的方法最困难的部分是证明该方法对精化状态有适当效果。为此，IronRSL 依赖我们的通用精化库（§5.3），通过证明常见数据结构精化的有用性质来减轻程序员的负担。

另一个困难是协议有时以非构造方式描述宿主动作前后状态之间的关系。例如，它说日志截断点应设置为某集合中第 n 高的数。它描述如何测试一个数是否为集合中第 n 高的数，但不描述如何实际计算这样的量。因此，实现者必须编写方法来执行此操作并证明其正确。

在实现中编写和维护不变量也很有用。大多数 IronRSL 方法需要对其开始时的具体状态有一些约束。例如，若没有对日志大小的某种约束，我们无法证明序列化它的方法可以将结果放入 UDP 分组。我们将此约束（以及许多其他）纳入具体状态的不变量。每个方法在进入时学习这些性质，并在返回前必须证明它们。

不变量也是性能优化的关键部分。例如，考虑 ProposeBatch 中的 ExistsProposal 方法。朴素实现总是遍历所有 1b 消息中的所有投票，这是昂贵的过程。相反，我们使用额外变量 maxOpn 增加宿主状态，并证明没有 1b 消息超过它的不变量。因此，在 s.nextOp ≥ maxOpn 的常见情况下，实现无需扫描任何 1b 消息。

#### 5.1.4 IronRSL 活性

我们还证明实现是活的：若客户端反复向所有副本发送请求，它最终会收到回复。没有共识协议可以在任意条件下存活 [16]，因此该性质必须由假设限定。我们假设存在副本法定人数 Q、最小调度频率 F、最大网络延迟 Δ、最大突发大小 B 和最大时钟误差 E（实现可能均未知），使得 (1) 最终，Q 中每个副本的调度器以至少 F 的频率运行，永不耗尽内存；(2) 最终，Q 中副本之间和/或客户端之间发送的任何消息在 Δ 内到达；(3) 最终，Q 中任何副本不会以过高速率接收分组；(4) 每当 Q 中副本读取其时钟时，读数与真实全局时间的偏差不超过 E；(5) Q 中任何副本都不会因达到溢出防护限制而停止进展。

我们的证明策略如下。首先，我们使用库的轮询调度器证明证明协议公平调度每个动作（§4.3）。接下来，我们证明最终 Q 中副本的队列中没有积压分组，因此此后在 Q 中副本之间发送消息会在某界限内导致接收者对该消息采取行动。接下来，使用 WF1（§4.4），我们证明：若客户端请求从未被执行，则对于任何时间周期 T，最终 Q 中副本成为该周期内的无争议领导者。最后，使用有界时间 WF1 变体（§4.4），我们证明存在 T 使得无争议领导者可以确保请求在 T 内被执行并响应。

### 5.2 IronKV：分片键值存储

我们还应用 IronFleet 方法论构建 IronKV，一个使用分布实现完全不同目的的系统：通过在一组节点上动态分片键值存储来扩展其吞吐量。

IronKV 状态机的高层规约是简洁的：它就是一个哈希表，如图 11 所示。

```dafny
type Hashtable = map<Key,Value>
type OptValue = ValuePresent(v:Value) | ValueAbsent
predicate SpecInit(h:Hashtable) { h == map [] }
predicate Set(h:Hashtable,h':Hashtable, k:Key, ov:OptValue)
  { h' == if ov.ValuePresent? then h[k := ov.v]
    else map ki | ki in h && ki!=k :: h[ki] }
predicate Get(h:Hashtable,h':Hashtable, k:Key, ov:OptValue)
  { h' == h && ov == if k in h then ValuePresent(h[k])
    else ValueAbsent() }
predicate SpecNext(h:Hashtable,h':Hashtable)
  { exists k, ov :: Set(h,h',k,ov) || Get(h,h',k,ov) }
```

*图 11：IronKV 状态机的完整高层规约。*

#### 5.2.1 分布式协议层

每个宿主的状态由存储键空间子集的哈希表和将每个键映射到负责它的宿主的「委托映射」（delegation map）组成。在协议初始化时，一个指定宿主负责整个键空间；因此，每个宿主的委托映射将每个键映射到该宿主。

为提高吞吐量并缓解热点，IronKV 允许管理员将顺序键范围（分片）委托给其他宿主。当宿主收到此类命令时，它向预期接收者发送相应的键值对，并更新其委托映射以反映新所有者。

若此类消息丢失，协议层无法证明精化高层规约，因为相应的键值对会消失。为避免此，我们设计了基于序列号的可靠传输组件，要求每个宿主确认收到的消息、跟踪其自己的未确认消息集合并定期重发。我们证明的活性性质是：若网络公平（即无限次发送的任何分组最终会交付），则提交给可靠传输组件的任何分组最终会被接收。

IronKV 证明最重要的不变量是：每个键要么被恰好一个宿主声明，要么在途分组中。使用该不变量以及我们证明的可靠传输组件的恰好一次交付语义，我们证明协议层精化高层规约。

#### 5.2.2 实现层

与 IronRSL 一样，我们证明对宿主具体状态的修改精化协议层状态的变化。然而，委托映射给 IronKV 带来独特挑战。协议层使用对每个可能键都有条目的无限映射。然而，实现层必须使用有界大小和合理性能的具体数据类型。因此，我们实现并证明了一个高效数据结构的正确性，其中每个宿主仅保留键范围的紧凑列表和每个范围负责宿主的身份。我们为性能引入的这种复杂性创造了 bug 机会。然而，通过建立关于数据结构的不变量（例如范围保持有序），我们证明它精化协议层使用的抽象无限映射。这让我们可以引入这种复杂数据结构而不冒数据丢失或任何其他错误的风险。

### 5.3 通用库

在开发 IronRSL 和 IronKV 时，我们编写并验证了若干对分布式系统有用的通用库。

**通用精化**。常见任务是证明对具体实现层对象的操作精化对协议层对象的对应操作。例如，IronRSL 的实现使用从 uint64 到 IP 地址的映射，而协议使用从数学整数到抽象节点标识符的映射。在证明中，我们必须证明从具体映射中删除元素对抽象版本有相同效果。为简化此类任务，我们构建了通用库，用于推理常见数据结构（如序列和映射）之间的精化。给定具体类型与抽象类型之间关系的基本性质（例如，将具体映射键映射到抽象映射键的函数是单射的），该库证明各种具体映射操作（如元素查找、添加和删除）精化对应的抽象操作。

**编组与解析**。所有分布式系统都需要编组和解析网络分组，这是繁琐且容易出错的任务。两项任务都必然涉及与堆的显著交互，因为分组最终表示为字节数组。不幸的是，即使最先进的验证工具也难以验证堆操作（§6.2）。因此，我们编写并验证了基于语法的通用解析器和编组器，将这种痛苦从开发者隐藏。对于每个分布式系统，开发者为其消息指定高层语法。要编组或解编组，开发者只需在其高层结构与匹配其语法的通用数据结构之间映射。该库处理与字节数组的转换。

作为该库实用性的证据，我们最初编写了 IronRSL 专用库。这花了一个人月，而且相对很少的代码会用于其他上下文。不满意后，我们构建了通用库。这花了更多几周，但有了通用库后，添加 IronRSL 专用部分仅需两小时；IronKV 专用部分甚至更少。

**集合性质**。分布式系统的另一个常见任务是推理序列、集合、映射等的性质。例如，许多 IronRSL 操作需要推理一组节点是否形成法定人数。因此，我们开发了证明此类集合之间许多有用关系的库。例如，一个引理证明：若两个集合由单射函数关联，则它们的大小相同。

---

## 6 经验教训

我们总结除使用不变量量词隐藏（§3.3）和始终可执行动作（§4.2）之外，对未来验证系统开发者有用的额外经验教训。

### 6.1 在不变量中使用已发送消息集合

IronFleet 网络模型是**单调的**（monotonic）：一旦消息被发送，它永远保存在幽灵状态变量中。这对于证明即使网络任意延迟交付消息系统仍正确行为是必要的。由于消息集合只能增长，证明关于它的不变量通常很容易。相比之下，推理可变宿主状态的不变量更难证明。因此，在可能的情况下，让不变量仅为迄今发送消息集合的性质是有用的，正如密码协议安全性证明中常做的那样 [8]。本质上，系统的网络模型提供了这种集合作为免费的「历史变量」[1]。

### 6.2 以函数式方式建模命令式代码

与验证纯函数式代码相比，验证命令式代码具有挑战性，即使使用 Dafny 等为命令式程序设计的最先进工具（§2.2）。因此，我们发现分两阶段实现系统是有益的。首先，我们使用不可变值（函数式）类型开发实现，并证明它精化协议层。避免堆推理简化了精化证明，但产生了慢实现，因为它无法利用堆引用的性能。在第二阶段，我们用可变堆类型替换值类型，在仅解决狭窄验证问题的同时提高性能。

我们在构建 IronRSL 和 IronKV 时应用此模式；例如，函数式实现将 IP 地址作为值类型操作，而高性能实现使用 OS 句柄的引用。该策略利用了 Dafny 对混合函数式和命令式编程风格的支持：我们可以先运行函数式代码并测量其性能，然后根据需要将性能关键部分优化为命令式基于堆的代码。使用没有良好函数式编程支持的语言（如 C）会使追求此策略变得困难。

### 6.3 审慎使用自动化

自动化验证工具减少了完成证明所需的人工投入，但往往需要开发者的额外指导才能找到证明，或同样重要的是，在合理时间内找到证明。

#### 6.3.1 自动化成功

在许多情况下，Dafny 的自动化推理允许开发者编写很少或无需证明标注。例如，Dafny 擅长自动证明关于线性算术的陈述。此外，其处理量词的启发式虽然不完美，但往往自动产生证明。

Dafny 还可以自动证明更复杂的陈述。例如，证明 IronRSL 的 ImplNext 总是满足可归约性义务的引理仅由两行组成：一行用于前置条件，一行用于后置条件。Dafny 自动枚举所有 10 个可能动作及其所有子情况，并观察到它们都产生满足该性质的 I/O 序列。

类似地，自动化推理允许许多不变量证明相当简短，推理如下：若关于宿主状态的不变量在步骤 i 成立但在 i + 1 不成立，宿主必须执行了某动作。然而，没有任何动作会导致不变量停止成立。通常，最后一部分不需要证明标注，因为验证器可以在内部枚举所有情况，即使对于具有许多复杂动作的 IronRSL。有时验证器无法自动处理棘手情况，此时开发者必须插入证明标注。然而，即使在这种情况下，开发者也不需要提及，更不用说枚举其他情况。

#### 6.3.2 自动化挑战

即使最快的自动化验证工具也可能需要很长时间探索庞大的搜索空间。默认情况下，Dafny 向 SMT 求解器 Z3 暴露所有谓词定义，可能给 Z3 带来大量搜索空间。例如，每个分布式协议的 HostNext 传递性地包含协议中几乎每个其他定义。类似地，消息解析代码引用可能消息类型的大型树。在作用域中有如此大的树会向 SMT 求解器暴露有界但仍然巨大的搜索空间，例如，任何对状态的提及都会调用关于状态的每个谓词。

为保持验证时间可管理并避免验证器超时，我们使用 Dafny 的 `opaque` 属性和 `reveal` 指令选择性地对 SMT 求解器隐藏无关定义，仅在需要完成证明时暴露它们 [21]。这导致更模块化的验证风格。

除了隐藏大型定义外，我们还使用 opaque 隐藏难以自动化的逻辑特性。例如，我们将递归谓词定义标记为 opaque，以防止求解器盲目地过多展开定义。为提供更大灵活性，我们修改 Dafny 以支持函数的 `fuel` 属性。Fuel 控制 SMT 求解器可以展开函数定义的次数。给函数零 fuel 等价于将函数标记为 opaque，而给五的 fuel 允许求解器展开递归函数最多五次。通过允许程序员在语句、方法、类、模块或程序的作用域指定函数的 fuel，我们允许代码的不同部分或多或少积极地暴露函数定义。

大量使用量词（forall 和 exists）的公式也可能导致超时，因为 SMT 求解器可以根据其选择控制实例化的触发器，比需要更多地实例化量词。在许多地方，我们采用避免量词的编码风格（§3.3）。在其他地方，当我们发现 Dafny 中的默认触发器过于宽松，导致过多实例化时，我们修改 Dafny 使用更谨慎的触发器。在某些情况下，我们还用手动触发器标注 Dafny 代码以减少实例化。在特别有问题的公式中，如交替量词链（例如 for all X there exists a Y such that for all Z...）和集合理解，我们将包含谓词标记为 opaque。时序逻辑公式容易导致交替量词，因此我们默认将 □ 和 ♦ 定义为 opaque。

---

## 7 评估

IronFleet 的前提是：自动化验证是一种可行的工程方法，已准备好用于开发真实分布式系统。我们通过回答以下问题来评估该假设：(1) 验证如何影响分布式系统的开发？(2) 验证系统的性能与未验证系统相比如何？

### 7.1 开发者体验

为评估实用性，我们评估了开发者体验以及产生验证系统所需的投入。

产生验证软件的经验与产生未验证软件的经验有一些相似之处。Dafny 提供近实时的 IDE 集成反馈。因此，当开发者编写给定方法或证明时，她通常会在 1–10 秒内看到反馈，表明验证器是否满意。为确保整个系统验证，我们的构建系统跟踪跨文件依赖，并并行将每个文件的验证外包给云虚拟机。因此，虽然串行完整集成构建需要约六小时，但在实践中，开发者很少等待超过 6–8 分钟，这与任何其他大型系统集成构建相当。

IronFleet 开发者必须编写形式可信规约、分布式协议层和帮助验证器看到它们之间精化的证明标注。图 12 通过报告系统每层所需的证明标注量来量化这一投入。我们将所有非规约、非可执行代码计为证明标注；这包括，例如，requires 和 ensures 子句、循环不变量以及所有引理及其调用。注意，IronRSL 的高层可信规约仅 85 行源代码（SLOC），IronKV 仅 34 行，使它们易于检查正确性。在实现层，我们的证明标注与可执行代码之比为 3.6 比 1。我们将这一相对较低的比率归因于我们的证明编写技术（§3.3、§4.1、§6）和我们的自动化工具（§6.3.1）。

| 组件 | 规约 | 实现 | 证明 | 验证时间（分钟） |
|------|------|------|------|----------------|
| **高层规约** | | | | |
| IronRSL | 85 | – | – | – |
| IronKV | 34 | – | – | – |
| 时序逻辑 | 208 | – | – | – |
| **分布式协议** | | | | |
| IronRSL 协议 | – | – | 1202 | 4 |
| 精化 | 35 | – | 3379 | 26 |
| 活性 | 167 | – | 7869 | 115 |
| IronKV 协议 | – | – | 726 | 2 |
| 精化 | 36 | – | 3998 | 12 |
| 活性 | 98 | – | 2093 | 23 |
| TLA 库 | – | – | 1824 | 2 |
| **实现** | | | | |
| IO/原生接口 | 591 | – | – | – |
| 通用库 | 134 | 833 | 7690 | 13 |
| IronRSL | 6 | 2941 | 7535 | 152 |
| IronKV | 6 | 1340 | 2937 | 42 |
| **总计** | 1400 | 5114 | 39253 | 395 |

*图 12：代码规模和验证时间（源代码行数）。*

总计，开发 IronFleet 方法论并将其应用于构建和验证两个真实系统需要约 3.7 人年。

作为这一投入的回报，IronFleet 产生了具有期望活性性质的可证明正确实现。事实上，除了 C# 客户端等未验证组件外，IronRSL（包括复制、视图变更、日志截断、批处理等）和 IronKV（包括委托和可靠交付）在我们第一次运行它们时就能工作。

### 7.2 验证分布式系统的性能

对任何专注于验证的新工具链的合理批评是，其结构可能损害运行时效率。虽然我们将大部分精力用于克服验证负担，我们也努力产生可行的实现。

我们的 IronRSL 实验在三台独立机器上运行三个副本，每台配备 Intel Xeon L5630 2.13 GHz 处理器和 12 GB RAM，通过 1 Gbps 网络连接。我们的 IronKV 实验使用两台此类机器，通过 10 Gbps 网络连接。

**IronRSL**。工作负载由 1–256 个并行客户端线程提供，每个发出串行请求流并测量延迟。作为未验证基线，我们使用来自 EPaxos 代码库 [15, 45] 的基于 Go 的 MultiPaxos 实现。对于两个系统，我们使用相同的应用状态机：它维护一个计数器，并为每个客户端请求递增计数器。图 13 总结了我们的结果。我们发现 IronRSL 的峰值吞吐量在基线的 2.4× 以内。

**IronKV**。为测量 IronKV 的吞吐量和延迟，我们预加载服务器 1000 个键，然后运行具有 1–256 个并行线程的客户端；每个线程在闭环中生成 Get（或 Set）请求流。作为未验证基线，我们使用 Redis [57]，一个用 C 和 C++ 编写的流行键/值存储，禁用客户端写缓冲。对于两个系统，我们使用 64 位无符号整数作为键，不同大小的字节数组作为值。图 14 总结了我们的结果。我们发现 IronKV 的性能与 Redis 相当。

作为最后说明，在我们所有实验中，瓶颈是 CPU（而非内存、磁盘或网络）。

---

## 8 讨论与未来工作

§7.1 表明，作为强保证（取决于 §2.5 中的若干假设）的回报，IronFleet 需要相当多的开发者投入。此外，根据我们的经验，在让不熟悉编写验证代码的开发者加入时，存在明显的学习曲线。大多数开发者更愿意使用 C++ 等语言，因此实现这一点是未来工作的重要主题。

§7.2 表明，虽然我们的系统实现了可观的性能，但它们尚未匹配未验证基线。部分差距直接来自我们对验证的使用。验证可变数据结构具有挑战性（§6.2），我们的测量表明这是我们代码的显著瓶颈。我们比较的基线已经高度优化；我们也优化了代码，但每次优化都必须证明正确。因此，给定固定时间预算，IronFleet 可能会产生更少的优化。IronFleet 还因编译到 C# 而付出代价，C# 对不需要它的代码施加运行时开销以强制执行类型安全。

更根本的是，追求完全验证使得重用现有库（例如用于优化的分组序列化）具有挑战性。在我们先前 [21] 和当前工作（§5.3）之前，Dafny 没有标准库，需要大量工作来构建它们；更多此类工作仍在前面。

虽然我们的系统比先前工作（§9）功能更完整，但它们仍缺乏未验证基线提供的许多标准特性。某些特性，如 IronRSL 中的重新配置，仅需要额外的开发者时间。其他特性需要额外的验证技术；例如，崩溃后恢复需要推理擦除内存但不擦除磁盘的机器崩溃的影响。

在未来工作中，我们旨在机械验证我们的归约论证，并证明我们的实现在合理条件下（例如，若它从未执行超过 2^64 次操作）有界时间内运行其主循环 [2]、永不耗尽内存且从不达到其溢出防护限制。

---

## 9 相关工作

### 9.1 协议验证

分布式系统协议众所周知难以正确设计。因此，系统设计通常伴随着形式化的英文正确性证明，通常 relegated 到技术报告或论文。例如包括 Paxos [55]、拜占庭容错（Byzantine fault tolerance）的 BFT 协议 [6, 7]、SMART [23, 41] 中的重新配置算法、Raft [49, 50]、ZooKeeper 的一致广播协议 Zab [28, 29]、平等 Paxos（Egalitarian Paxos）[44, 45] 和 Chord DHT [62, 63]。

然而，无论多么形式化，纸面证明都可能包含错误。Zave 表明，当经受 Alloy 抽象模型检测时，「可证明正确」的 Chord 协议不保持其任何已发布的不变量 [71]。因此，一些研究者更进一步，生成了机器可检查的证明。Kellomäki 在 PVS 中创建了 Paxos 共识协议的证明 [30]。Lamport 的 TLAPS 证明系统已被用于证明 BFT 协议的安全性，但非活性性质 [38]。在所有此类情况下，被证明正确的协议都比我们的规模小得多、简单得多。例如，Kellomäki 和 Lamport 的证明涉及单实例 Paxos 和 BFT，它们总共只做一个决定。

### 9.2 模型检测

模型检测穷举探索系统的状态空间，测试安全性性质是否在每个可达状态中成立。这种组合探索要求系统用有限、通常微小的参数实例化。因此，正面结果仅提供信心而非安全性的证明；此外，该信心取决于建模者在参数选择上的智慧。模型检测已应用于无数系统，包括 Python 实现的 Paxos [26]、各种分布式系统的 Mace 实现 [31]，以及通过 MODIST [69] 的 Berkeley DB、MPS Paxos 和 PacificA 主备复制系统的未修改二进制。

模型检测对复杂分布式规约扩展性差 [4]。抽象解释可以帮助此类扩展，但无法从根本上消除模型检测的局限性。例如，Zave 对 Chord 的修正使用 Alloy 模型检测器，但仅用于部分自动化单个必要不变量的证明 [72]。

### 9.3 系统验证

软件验证能力的最近增长使多个研究组敢于使用它来证明整个系统实现的正确性。seL4 是用 C 编写的微内核 [32]，使用 Isabelle/HOL 定理证明器证明了完整功能正确性。mCertiKOS-hyp [19] 是一个小型验证虚拟机监控程序，其在 Coq 交互式证明助手中的验证强调模块化和抽象。ExpressOS [43] 使用 Dafny 对微内核的策略管理器进行健全性检查。我们的 Ironclad 项目 [21] 展示了如何完全验证敏感服务的安全性，一直到汇编。IronFleet 的不同之处在于验证分布式实现而非单机运行的代码，并验证活性以及安全性性质。

研究者也开始将软件验证应用于分布式系统。Ridge [58] 证明了用 OCaml 编写的持久消息队列的正确性；然而，他的系统在规模上比我们的小得多，且没有已证明的活性性质。

Schiper 等人 [60] 通过在 EventML [56] 中构建 Paxos 实现并在 NuPRL 证明器 [10] 中证明正确性（但非活性）来验证 Paxos 实现的正确性。然而，他们不验证该 Paxos 实现的状态机复制层，仅验证共识算法，忽略了状态传输等复杂性。他们还对网络行为做了不明确的假设。与我们的方法论相比，我们的方法论利用多重抽象和精化层次，EventML 方法假设语言之下所有代码生成都是自动的，之上人类可以产生一一对应的精化。尚不清楚该方法是否将扩展到更复杂和多样的分布式系统。

在并发工作中，Wilcox 等人 [67, 68] 提出了 Verdi，一种受编译器启发的方法来构建验证分布式系统实现。使用 Verdi，开发者在 Coq 中使用简化环境（例如具有完美可靠网络的单机系统）编写并证明其系统正确。Verdi 的验证系统转换器然后将开发者的实现转换为在更 hostile 环境中稳健的等效实现；他们最大的系统转换器是添加容错的 Raft 实现。与 IronFleet 相比，Verdi 提供了更清晰的组合方法。与 IronRSL 不同，目前 Verdi 的 Raft 实现不支持验证的编组和解析、状态传输、日志截断、动态视图变更超时、回复缓存或批处理。此外，Verdi 不证明任何活性性质。

---

## 10 结论

IronFleet 方法论将系统划分为特定层次，使实用分布式系统实现的验证可行。高层规约给出系统行为的最简洁描述。协议层仅处理分布式协议设计；我们使用 TLA+ [36] 风格验证将其连接到规约。在实现层，程序员推理单宿主程序而不必担心并发。归约和精化将这些 individually 可行的组件组合成可扩展到实用规模具体实现的方法论。该方法论允许常规结构的实现，能够处理高达 18,200 请求/秒（IronRSL）和 28,800 请求/秒（IronKV），性能与未验证参考实现相当。

---

## 致谢

我们感谢 Rustan Leino 不仅构建了 Dafny，还愉快地提供了持续指导和支持以改进它。我们感谢 Leslie Lamport 关于精化和形式证明的有益讨论，特别是活性证明。我们感谢 Shaz Qadeer 向我们介绍归约的力量。我们感谢 Andrew Baumann、Ernie Cohen、Galen Hunt、Lidong Zhou 和匿名审稿人的有益反馈。最后，我们感谢我们的 shepherd Jim Larus 的互动反馈，显著改进了本文。

---

## 参考文献

[1] ABADI, M., AND LAMPORT, L. The existence of refinement mappings. Theoretical Computer Science 82, 2 (May 1991).
[2] BLACKHAM, B., et al. Timing analysis of a protected operating system kernel. RTSS 2011.
[3] BOKOR, P., et al. Efficient model checking of fault-tolerant distributed protocols. DSN 2011.
[4] BOLOSKY, W. J., et al. The Farsite project: a retrospective. ACM SIGOPS OSR 41(2) 2007.
[5] BURROWS, M. The Chubby lock service for loosely-coupled distributed systems. OSDI 2006.
[6] CASTRO, M., AND LISKOV, B. A correctness proof for a practical Byzantine-fault-tolerant replication algorithm. MIT/LCS/TM-590, 1999.
[7] CASTRO, M., AND LISKOV, B. Practical Byzantine fault tolerance and proactive recovery. TOCS 20(4) 2002.
[8] COHEN, E. First-order verification of cryptographic protocols. J. Computer Security 11(2) 2003.
[9] COHEN, E., AND LAMPORT, L. Reduction in TLA. CONCUR 1998.
[10] CONSTABLE, R. L., et al. Implementing Mathematics with the Nuprl Proof Development System. Prentice-Hall, 1986.
[11] DE MOURA, L. M., AND BJØRNER, N. Z3: An efficient SMT solver. TACAS 2008.
[12] DETLEFS, D., NELSON, G., AND SAXE, J. B. Simplify: A theorem prover for program checking. J. ACM 2003.
[13] DOUCEUR, J. R., AND HOWELL, J. Distributed directory service in the Farsite file system. OSDI 2006.
[14] ELMAS, T., QADEER, S., AND TASIRAN, S. A calculus of atomic actions. POPL 2009.
[15] EPaxos code. <https://github.com/efficient/epaxos/>, 2013.
[16] FISCHER, M. J., LYNCH, N. A., AND PATERSON, M. S. Impossibility of distributed consensus with one faulty process. JACM 32(2) 1985.
[17] FLOYD, R. Assigning meanings to programs. Symposia in Applied Mathematics 1967.
[18] GARLAND, S. J., AND LYNCH, N. A. Using I/O automata for developing distributed systems. Foundations of Component-Based Systems 2000.
[19] GU, R., et al. Deep specifications and certified abstraction layers. POPL 2015.
[20] GUO, H., et al. Practical software model checking via dynamic interface reduction. SOSP 2011.
[21] HAWBLITZEL, C., et al. Ironclad apps: End-to-end security via automated full-system verification. OSDI 2014.
[22] HOARE, T. An axiomatic basis for computer programming. CACM 12 1969.
[23] HOWELL, J., LORCH, J. R., AND DOUCEUR, J. R. Correctness of Paxos with replica-set-specific views. MSR-TR-2004-45, 2004.
[24] HUNT, P., et al. ZooKeeper: Wait-free coordination for Internet-scale systems. ATC 2010.
[25] IronFleet code. <https://research.microsoft.com/projects/ironclad/>, 2015.
[26] JONES, E. Model checking a Paxos implementation. 2009.
[27] JOSHI, R., et al. Checking cache coherence protocols with TLA+. J. Formal Methods in System Design 22(2) 2003.
[28] JUNQUEIRA, F. P., REED, B. C., AND SERAFINI, M. Dissecting Zab. YL-2010-007, Yahoo! Research, 2010.
[29] JUNQUEIRA, F. P., REED, B. C., AND SERAFINI, M. Zab: High-performance broadcast for primary-backup systems. DSN 2011.
[30] KELLOMÄKI, P. An annotated specification of the consensus protocol of Paxos using superposition in PVS. Tech. Rep. 36, Tampere Univ., 2004.
[31] KILLIAN, C. E., et al. Mace: Language support for building distributed systems. PLDI 2007.
[32] KLEIN, G., et al. Comprehensive formal verification of an OS microkernel. TOCS 32(1) 2014.
[33] LAMPORT, L. A theorem on atomicity in distributed algorithms. SRC-28, DEC SRC, 1988.
[34] LAMPORT, L. The temporal logic of actions. TOPLAS 16(3) 1994.
[35] LAMPORT, L. The part-time parliament. TOCS 16(2) 1998.
[36] LAMPORT, L. Specifying Systems: The TLA+ Language and Tools. Addison-Wesley, 2002.
[37] LAMPORT, L. The PlusCal algorithm language. ICTAC 2009.
[38] LAMPORT, L. Byzantizing Paxos by refinement. DISC 2011.
[39] LEINO, K. R. M. Dafny: An automatic program verifier for functional correctness. LPAR 2010.
[40] LIPTON, R. J. Reduction: A method of proving properties of parallel programs. CACM 18(12) 1975.
[41] LORCH, J. R., et al. The SMART way to migrate replicated stateful services. EuroSys 2006.
[42] LU, T., et al. Model checking the Pastry routing protocol. AVoCS 2010.
[43] MAI, H., et al. Verifying security invariants in ExpressOS. ASPLOS 2013.
[44] MORARU, I., ANDERSEN, D. G., AND KAMINSKY, M. A proof of correctness of Egalitarian Paxos. CMU-PDL-13-111, 2013.
[45] MORARU, I., ANDERSEN, D. G., AND KAMINSKY, M. There is more consensus in egalitarian parliaments. SOSP 2013.
[46] MUSUVATHI, M., et al. CMC: A pragmatic approach to model checking real code. OSDI 2002.
[47] MUSUVATHI, M., et al. Finding and reproducing heisenbugs in concurrent programs. OSDI 2008.
[48] NEWCOMBE, C., et al. How Amazon Web Services uses formal methods. CACM 58(4) 2015.
[49] ONGARO, D. Consensus: Bridging theory and practice. Ph.D. thesis, Stanford, 2014.
[50] ONGARO, D., AND OUSTERHOUT, J. In search of an understandable consensus algorithm. ATC 2014.
[51] PARKINSON, M. The next 700 separation logics. VSTTE 2010.
[52] PARNO, B., et al. Memoir: Practical state continuity for protected modules. IEEE S&P 2011.
[53] PEK, E., AND BOGUNOVIC, N. Formal verification of communication protocols in distributed systems. 2003.
[54] PRIOR, A. N. Papers on Time and Tense. Oxford University Press, 1968.
[55] PRISCO, R. D., AND LAMPSON, B. Revisiting the Paxos algorithm. WDAG 1997.
[56] RAHLI, V. Interfacing with proof assistants for domain specific programming using EventML. UITP 2012.
[57] Redis. <http://redis.io/>. 2015.
[58] RIDGE, T. Verifying distributed systems: The operational approach. POPL 2009.
[59] SAISSI, H., et al. Efficient verification of distributed protocols using stateful model checking. SRDS 2013.
[60] SCHIPER, N., et al. Developing correctly replicated databases using formal tools. DSN 2014.
[61] SCIASCIO, E., et al. Automatic support for verification of secure transactions. 2001.
[62] STOICA, I., et al. Chord: A scalable peer-to-peer lookup service. SIGCOMM 2001.
[63] STOICA, I., et al. Chord: A scalable peer-to-peer lookup service. MIT/LCS/TR-819, 2001.
[64] TASIRAN, S., et al. Using formal specifications to monitor and guide simulation. 2002.
[65] WANG, L., AND STOLLER, S. D. Runtime analysis of atomicity for multithreaded programs. IEEE TSE 32 2006.
[66] WANG, Y., et al. Gadara: Dynamic deadlock avoidance for multithreaded programs. OSDI 2008.
[67] WILCOX, J., et al. UW CSE News: Verdi team completes first full formal verification of Raft. 2015.
[68] WILCOX, J. R., et al. Verdi: A framework for implementing and formally verifying distributed systems. PLDI 2015.
[69] YANG, J., et al. MODIST: Transparent model checking of unmodified distributed systems. NSDI 2009.
[70] YUAN, D., et al. Simple testing can prevent most critical failures. OSDI 2014.
[71] ZAVE, P. Using lightweight modeling to understand Chord. ACM SIGCOMM CCR 42(2) 2012.
[72] ZAVE, P. How to make Chord correct (using a stable base). arXiv 1502.06461, 2015.

---

[← 上一篇：Memcached](memcached.md) | [返回目录](index.md) | [下一篇：AWS Lambda →](lambda.md)
