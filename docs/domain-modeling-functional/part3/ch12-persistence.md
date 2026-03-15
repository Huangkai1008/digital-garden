# 第12章：持久化

> 本书中，我们一直将领域模型设计为「持久化无关（persistence-ignorant）」——不让存储数据或与其他服务交互等实现问题扭曲设计。但在大多数应用中，总会有某些状态需要比进程或工作流的生命周期更长。此时，我们不得不借助某种持久化机制，如文件系统或数据库。遗憾的是，从我们完美的领域迁移到混乱的基础设施世界时，几乎总会出现某种不匹配。本章旨在帮助你应对与持久化领域驱动数据模型相关的问题。我们将先讨论一些高层原则，如命令查询分离，然后深入实现细节，包括与文档数据库和关系数据库协作的具体方法。

---

## 12.1 将持久化推到边缘（Pushing Persistence to the Edges）

在函数式设计中，任何从外部世界读取或向外部世界写入的代码都不可能是纯函数，因此在设计工作流时，我们希望避免在工作流内部出现任何 I/O 或持久化相关逻辑。这通常意味着将工作流分为两部分：

- **领域中心部分**：包含业务逻辑
- **边缘部分**：包含 I/O 相关代码

例如，假设我们有一个实现发票支付逻辑的工作流。在混合了领域逻辑与 I/O 的模型中，实现可能被设计成这样：

- 从数据库加载发票
- 应用支付
- 若发票已全额支付，在数据库中标记为已全额支付，并发布 `InvoicePaid` 事件
- 若发票未全额支付，在数据库中标记为部分支付，不发布任何事件

更好的做法是将领域逻辑与 I/O 分离。首先，我们创建一个**纯函数**，接收所有需要的数据作为参数，并返回一个选择类型表示决策，而不是直接执行 I/O：

```fsharp
// 纯领域函数：不执行任何 I/O
let applyPayment unpaidInvoice payment =
    let updatedInvoice = ...
    // 根据不同结果进行处理
    if isFullyPaid updatedInvoice then
        FullyPaid
    else
        PartiallyPaid updatedInvoice
    // 返回 PartiallyPaid 或 FullyPaid
```

该函数完全纯。它不加载任何数据——所需数据都通过参数传入。它也不保存任何数据。它做出决策，但以选择类型返回该决策，而不是立即执行。因此，很容易测试该函数中的逻辑是否正确。

一旦写好该函数，我们将在限界上下文的边界处将其用作命令处理器的一部分，在那里允许 I/O：

```fsharp
type PayInvoiceCommand = {
    InvoiceId : ...
    Payment : ...
}

// 限界上下文边缘的命令处理器
let payInvoice payInvoiceCommand =
    // 从 DB 加载
    let invoiceId = payInvoiceCommand.InvoiceId
    let unpaidInvoice =
        loadInvoiceFromDatabase invoiceId  // I/O
    // 调用纯领域逻辑
    let payment =
        payInvoiceCommand.Payment  // 纯
    let paymentResult =
        applyPayment unpaidInvoice payment  // 纯
    // 处理结果
    match paymentResult with
    | FullyPaid ->
        markAsFullyPaidInDb invoiceId  // I/O
        postInvoicePaidEvent invoiceId  // I/O
    | PartiallyPaid updatedInvoice ->
        updateInvoiceInDb updatedInvoice  // I/O
```

注意，该函数本身不做任何决策，它只是处理内部领域中心函数做出的决策。因此，该函数其实不需要用单元测试来测，因为持久化逻辑通常很琐碎。当然，这不意味着不该测，但作为端到端集成测试的一部分来测可能更合适。

你可以把这个组合函数想象成三明治——边缘是 I/O，中心是纯代码，如下图所示：

```text
┌─────────────────────────────────────────┐
│  纯代码 (Pure Code)  │  I/O  │   I/O    │
│                     │       │          │
│    领域边界         └───────┴──────────┘
└─────────────────────────────────────────┘
```

### 12.1.1 隔离测试命令处理器

若我们确实想单独测试该函数，只需为其添加额外的函数参数来表示所有调用的 I/O 操作：

```fsharp
// 限界上下文边缘的命令处理器
let payInvoice
    loadUnpaidInvoiceFromDatabase  // 依赖
    markAsFullyPaidInDb            // 依赖
    updateInvoiceInDb              // 依赖
    payInvoiceCommand =
    // 从 DB 加载
    let invoiceId = payInvoiceCommand.InvoiceId
    let unpaidInvoice =
        loadUnpaidInvoiceFromDatabase invoiceId
    // 调用纯领域逻辑
    let payment =
        payInvoiceCommand.Payment
    let paymentResult =
        applyPayment unpaidInvoice payment
    // 处理结果
    match paymentResult with
    | FullyPaid ->
        markAsFullyPaidInDb(invoiceId)
        postInvoicePaidEvent(invoiceId)
    | PartiallyPaid updatedInvoice ->
        updateInvoiceInDb updatedInvoice
```

这样，你就可以通过为参数提供桩（stub）来轻松测试该函数。

使用 I/O 的组合函数当然应位于应用的顶层——要么在「组合根（composition root）」中，要么在控制器中。

### 12.1.2 基于查询做决策（Making Decisions Based on Queries）

上面的例子假设所有数据都可以在领域函数外部加载，然后传入。但如果你需要根据从数据库读取的数据在「纯」代码中间做决策，该怎么办？

解决方案是保持纯函数不变，但用不纯的 I/O 函数将它们夹在中间，像这样：

```text
┌─────────────────────────────────────────────────────┐
│  纯代码  │  I/O  │  纯代码  │  I/O                  │
│         │       │          │                        │
│         └───────┴──────────┴────────────────────────┘
│              领域边界                                │
└─────────────────────────────────────────────────────┘
```

纯函数包含业务逻辑并做出决策，I/O 函数负责读写数据。

例如，假设我们需要扩展工作流：支付后，计算应付总额，若金额过大则向客户发送警告消息。有了这些额外需求，管道中的步骤大致如下：

```text
--- I/O ---
从 DB 加载发票
--- 纯 ---
执行支付逻辑
--- I/O ---
对输出选择类型进行模式匹配：
  若 "FullyPaid" -> 在 DB 中标记发票为已支付
  若 "PartiallyPaid" -> 将更新后的发票保存到 DB
--- I/O ---
从 DB 加载所有未付发票的金额
--- 纯 ---
将金额相加，判断是否过大
--- I/O ---
对输出选择类型进行模式匹配：
  若 "OverdueWarningNeeded" -> 向客户发送消息
  若 "NoActionNeeded" -> 不做任何事
```

若 I/O 与逻辑混合过多，简单的「三明治」可能变成「千层糕」。此时，你可能希望将工作流拆成更短的迷你工作流（参见第 140 页《长运行工作流》），这样每个工作流都能保持为小而简单的三明治。

### 12.1.3 仓储模式去哪了？（Where's the Repository Pattern?）

在《领域驱动设计》原书中，有一种访问数据库的模式叫**仓储模式（Repository pattern）**。若你熟悉该书，可能会好奇该模式如何与函数式方法契合。

答案是：**不契合**。仓储模式是在依赖可变性的面向对象设计中隐藏持久化的一种好方式。但当我们将一切建模为函数并把持久化推到边缘时，仓储模式就不再需要了。

这种做法在可维护性上也有好处：我们不再有一个包含数十个方法、在给定工作流中大多用不到的单一 I/O 接口，而是为每次具体的 I/O 访问定义独立的函数，仅在需要时使用。

---

## 12.2 命令查询分离（Command-Query Separation）

接下来要看的原理是**命令查询分离（Command-Query Separation，CQS）**。

在函数式领域建模中，所有对象都被设计为不可变。我们不妨把存储系统也看作某种不可变对象。也就是说，每次改变存储系统中的数据时，它都会转变为自身的新版本。

例如，若要以函数式方式建模插入记录，我们可以把插入函数看作有两个参数：要插入的数据和数据存储的原始状态。插入完成后，函数的输出是添加了数据的数据存储新版本。

```text
DataStore ──[Insert data]──> DataStore
  (插入前状态)   (要插入的数据)   (插入后状态)
```

在代码中，可以这样建模类型签名：

```fsharp
type InsertData = DataStoreState -> Data -> NewDataStoreState
```

与数据存储交互有四种基本方式：「创建（Create）」或「插入（Insert）」、「读取（Read）」或「查询（Query）」、「更新（Update）」和「删除（Delete）」。我们刚看了「插入」——其他几种也画一下：

```text
    插入          更新
      │            │
      ▼            ▼
DataStore ◄──── DataStore
      │            │
      ▲            ▲
    读取          删除
```

或用代码表示：

```fsharp
type InsertData = DataStoreState -> Data -> NewDataStoreState
type ReadData = DataStoreState -> Query -> Data
type UpdateData = DataStoreState -> Data -> NewDataStoreState
type DeleteData = DataStoreState -> Key -> NewDataStoreState
```

其中有一个与众不同。显然，我们有两类不同的操作：

- **插入、更新和删除**会改变数据库状态，且（通常）不返回有用数据
- **读取或查询**则不改变数据库状态，且是四种操作中唯一返回有用结果的

命令查询分离是基于这些区分的设计原则。它规定：返回数据的代码（「查询」）不应与更新数据的代码（「命令」）混在一起。换句话说：**提问不应改变答案**。

应用于函数式编程，CQS 原则提出：

- 返回数据的函数不应有副作用
- 有副作用的函数（更新状态）不应返回数据——即应为返回 `Unit` 的函数

这并不新鲜——我们在整个设计中一直在这么做——但现在让我们专门针对数据库应用它。

对函数签名稍作调整：

- 在输入侧，可以用某种数据存储句柄（如 `DbConnection`）替代 `DataStoreState`
- 输出（`NewDataStoreState`）对真实世界的数据存储无关紧要，因为数据存储是可变的，不会返回新状态。因此可以用 `Unit` 类型替代

签名现在变成：

```fsharp
type InsertData = DbConnection -> Data -> Unit
type ReadData = DbConnection -> Query -> Data
type UpdateData = DbConnection -> Data -> Unit
type DeleteData = DbConnection -> Key -> Unit
```

`DbConnection` 类型针对特定数据存储，因此我们希望通过部分应用或类似技术（参见第 153 页《部分应用》）向调用方隐藏该依赖，这意味着从领域代码视角看到的持久化相关函数将与数据库无关，签名如下：

```fsharp
type InsertData = Data -> Unit
type ReadData = Query -> Data
type UpdateData = Data -> Unit
type DeleteData = Key -> Unit
```

这正是我们在前面章节看到的。当然，由于涉及 I/O 和可能的错误，实际签名需要包含一些效果。通常可以创建诸如 `DataStoreResult` 或 `DbResult` 的别名，包含 `Result` 类型以及可能的 `Async`，于是签名变成：

```fsharp
type DbError = ...
type DbResult<'a> = AsyncResult<'a,DbError>
type InsertData = Data -> DbResult<Unit>
type ReadData = Query -> DbResult<Data>
type UpdateData = Data -> DbResult<Unit>
type DeleteData = Key -> DbResult<Unit>
```

### 12.2.1 命令查询职责分离（Command-Query Responsibility Segregation）

我们常常会想复用同一对象进行读写。例如，若有 `Customer` 记录，可能用这些有副作用的函数保存到数据库并加载：

```fsharp
type SaveCustomer = Customer -> DbResult<Unit>
type LoadCustomer = CustomerId -> DbResult<Customer>
```

但出于多种原因，复用同一类型进行读写并不是好主意。

首先，查询返回的数据往往与写入时需要的不同。例如，查询可能返回反规范化数据或计算值，但写入时不会用到这些。同样，创建新记录时，生成的 ID 或版本等字段不会用到，但查询会返回。与其让一个数据类型服务多种用途，不如为每种具体用途单独设计数据类型。在 F# 中，按需创建任意多数据类型很容易。

其次，查询和命令往往独立演进，因此不应耦合。例如，随着时间推移，你可能发现需要对同一数据做三四种不同查询，但只有一种更新命令。若强制查询类型与命令类型相同，会变得很别扭。

最后，出于性能考虑，某些查询可能需要一次返回多个实体。例如，加载订单时，你可能还想加载关联的客户数据，而不是再访问一次数据库获取客户。当然，将订单保存到 DB 时，你只会使用客户的引用（`CustomerId`），而不是整个客户对象。

基于这些观察，从领域建模角度看，查询和命令几乎总是不同的，因此应使用不同类型建模。查询类型与命令类型的这种分离，自然会导致它们被隔离到不同模块中，从而真正解耦、独立演进。一个模块负责查询（称为**读模型（read model）**），另一个负责命令（**写模型（write model）**），即**命令查询职责分离（CQRS）**。

例如，若想为客户分离读写模型，可以定义 `WriteModel.Customer` 类型和 `ReadModel.Customer` 类型，数据访问函数如下：

```fsharp
type SaveCustomer = WriteModel.Customer -> DbResult<Unit>
type LoadCustomer = CustomerId -> DbResult<ReadModel.Customer>
```

### 12.2.2 CQRS 与数据库分离（CQRS and Database Segregation）

CQRS 原则也可以应用于数据库。此时，你会有两个不同的数据存储：一个针对写入优化（无索引、事务性等），一个针对查询优化（反规范化、大量索引等）。

```text
写存储 ──[数据/命令]──> 处理命令
                        │
读存储 <──[查询]──────── 处理查询
```

当然，这是「逻辑」视图——你不一定需要两个物理数据库。例如，在关系数据库中，「写」模型可以只是表，「读」模型可以是这些表上的预定义视图。

若确实有物理上分离的数据存储，必须实现一个特殊进程，将数据从「写存储」复制到「读存储」。这是额外工作，因此你必须判断分离数据存储的设计收益是否值得。更重要的是，读侧的数据可能比写侧落后，意味着读存储是「最终一致（eventually consistent）」而非立即一致。这可能是问题，也可能不是，取决于你的领域（另见第 114 页关于一致性的讨论）。

然而，一旦你承诺分离读写，就可以灵活使用多种不同的读存储，每种针对特定领域优化。特别是，可以有一个读存储包含来自多个限界上下文的聚合数据，这对做报表或分析非常有用。

### 12.2.3 事件溯源（Event Sourcing）

CQRS 常与**事件溯源（event sourcing）**关联。在事件溯源方法中，当前状态不是作为单一对象持久化的。相反，每次状态发生变化时，都会持久化一个表示该变化的事件（如 `InvoicePaid`）。这样，旧状态与新状态之间的每个差异都被捕获，有点像版本控制系统。要在工作流开始时恢复当前状态，需要重放所有先前事件。这种方法有很多优点，尤其是它符合许多需要全面审计的领域模型。正如他们所说：「会计师不用橡皮擦。」事件溯源是个大话题，此处无法详述。

---

## 12.3 限界上下文必须拥有其数据存储（Bounded Contexts Must Own Their Data Storage）

持久化的另一条关键准则是：每个限界上下文在数据存储方面必须与其他上下文隔离。这意味着：

- 限界上下文必须**拥有**自己的数据存储及关联模式，并可在任何时候修改它们，而无需与其他限界上下文协调
- 其他系统**不能**直接访问该限界上下文拥有的数据。相反，客户端应使用限界上下文的公共 API，或使用某种数据存储的副本

一如既往，目标是确保限界上下文保持解耦、能独立演进。若系统 A 访问系统 B 的数据存储，即使代码库完全独立，两个系统在实践中仍因共享数据而耦合。

「隔离」的实现方式可根据设计需求和运维团队要求而变化。在一端，每个限界上下文可能有物理上独立的数据库或数据存储，与所有其他存储完全分开部署。在另一端，所有上下文的数据可以存储在一个物理数据库中（便于部署），但使用某种命名空间机制使每个上下文的数据在逻辑上分离。

### 12.3.1 使用多领域数据（Working with Data from Multiple Domains）

报表和业务分析系统怎么办？它们需要访问多个上下文的数据，但我们刚说过这是坏主意。

解决方案是将「报表」或「商业智能」视为独立领域，并将其他限界上下文拥有的数据复制到专为报表设计的独立系统。这种方法虽然工作量更大，但确实能让源系统和报表系统独立演进，各自针对自身关注点优化。当然，这种方法并不新鲜——OLTP 与 OLAP 系统的区分已有数十年历史。

有各种方式将数据从其他限界上下文传到商业智能（BI）上下文。「纯粹」的做法是让它订阅其他系统发出的事件。例如，每次创建订单时都会触发事件，商业智能上下文可以监听该事件，并在自己的数据存储中插入对应记录。这种做法的优点是商业智能上下文只是另一个领域，不需要在设计上做任何特殊处理。

```text
下单上下文 ──[订单已下单]──> 商业智能上下文
开票上下文 ──[订单已发货]──> 商业智能上下文
物流上下文 ──[发票已支付]──> 商业智能上下文
```

另一种方式是使用传统的 **ETL 流程**将数据从源系统复制到 BI 系统。这种方式的优点是初期实现更容易，但可能带来额外维护负担，因为源系统修改数据库模式时，ETL 很可能也需要调整。

注意，在商业智能领域内，对正式领域模型的需求很少。更重要的是开发一个多维数据库（俗称「立方体」），高效支持即席查询和多种访问路径。

我们可以用类似方式处理运营所需的数据。将「运营智能」视为独立领域，然后将日志、指标和其他数据发送给它进行分析和报表。

---

## 12.4 使用文档数据库（Working with Document Databases）

我们已讨论了一些持久化的通用原则。现在完全换个角度，深入一些实现示例，先从所谓的「文档数据库」开始——设计用于以 JSON 或 XML 格式存储半结构化数据。

持久化到文档数据库很简单。我们使用上一章（第 221 页《第 11 章：序列化》）讨论的技术，将领域对象转换为 DTO，再转为 JSON 字符串（或 XML 字符串等），然后通过存储系统的 API 存储和加载。

例如，若使用 Azure Blob 存储保存 `PersonDto` 对象，可以这样设置存储：

```fsharp
open Microsoft.WindowsAzure
open Microsoft.WindowsAzure.Storage
open Microsoft.WindowsAzure.Storage.Blob

let connString = "... Azure connection string ..."
let storageAccount = CloudStorageAccount.Parse(connString)
let blobClient = storageAccount.CreateCloudBlobClient()
let container = blobClient.GetContainerReference("Person");
container.CreateIfNotExists()
```

然后用几行代码将 DTO 保存到 blob：

```fsharp
type PersonDto = {
    PersonId : int
    ...
}

let savePersonDtoToBlob personDto =
    let blobId = sprintf "Person%i" personDto.PersonId
    let blob = container.GetBlockBlobReference(blobId)
    let json = Json.serialize personDto
    blob.UploadText(json)
```

仅此而已。同样，我们可以用上一章的反序列化技术创建从存储加载的代码。

---

## 12.5 使用关系数据库（Working with Relational Databases）

关系数据库的模型与大多数代码非常不同，传统上这一直是大量痛苦的根源——所谓的对象与数据库之间的**阻抗不匹配（impedance mismatch）**。

使用函数式编程原则开发的数据模型往往与关系数据库更兼容，主要是因为函数式模型不混合数据与行为，因此记录的保存和检索更直接。尽管如此，我们仍需要解决一些问题。

先看看关系数据库模型与函数式模型的对比。

好消息是：关系数据库中的表与函数式模型中的记录集合对应得很好。数据库中的集合导向操作（`SELECT`、`WHERE`）与函数式语言中的列表导向操作（`map`、`filter`）类似。

因此，我们的策略是使用上一章的序列化技术，设计能直接映射到表的记录类型。例如，假设有这样一个领域类型：

```fsharp
type CustomerId = CustomerId of int
type String50 = String50 of string
type Birthdate = Birthdate of DateTime
type Customer = {
    CustomerId : CustomerId
    Name : String50
    Birthdate : Birthdate option
}
```

对应的表设计很直接：

```sql
CREATE TABLE Customer (
    CustomerId int NOT NULL,
    Name NVARCHAR(50) NOT NULL,
    Birthdate DATETIME NULL,
    CONSTRAINT PK_Customer PRIMARY KEY (CustomerId)
)
```

坏消息是：关系数据库只存储字符串或整数等基本类型，这意味着我们必须「解包」我们漂亮的领域类型，如 `ProductCode` 或 `OrderId`。

更糟的是，关系表无法很好地映射选择类型。这需要更详细地讨论。

### 12.5.1 将选择类型映射到表（Mapping Choice Types to Tables）

我们应如何在关系数据库中建模选择类型？若将选择类型视为单层继承层次，可以借鉴将对象层次映射到关系模型的一些方法。

映射选择类型最常用的两种方式是：

- **所有分支在同一张表**
- **每个分支一张表**

例如，假设有 `Contact` 类型（如下），包含选择类型，要存储到数据库：

```fsharp
type Contact = {
    ContactId : ContactId
    Info : ContactInfo
}
and ContactInfo =
    | Email of EmailAddress
    | Phone of PhoneNumber
and EmailAddress = EmailAddress of string
and PhoneNumber = PhoneNumber of string
and ContactId = ContactId of int
```

第一种方式（「所有分支在一张表」）类似于第 232 页讨论的方法。我们只用一张表存储所有分支的数据，这意味着 (a) 需要一个或多个标志表示正在使用哪个分支，(b) 必须有仅用于部分分支的可空列。

```sql
CREATE TABLE ContactInfo (
    -- 共享数据
    ContactId int NOT NULL,
    -- 分支标志
    IsEmail bit NOT NULL,
    IsPhone bit NOT NULL,
    -- "Email" 分支的数据
    EmailAddress NVARCHAR(100),  -- 可空
    -- "Phone" 分支的数据
    PhoneNumber NVARCHAR(25),    -- 可空
    CONSTRAINT PK_ContactInfo PRIMARY KEY (ContactId)
)
```

我们为每个分支使用 bit 字段标志，而不是单一的 `Tag VARCHAR` 字段，因为更紧凑、更易索引。

第二种方式（每个分支一张表）意味着除了主表外，还要为每个分支创建子表。所有表共享相同主键。主表存储 ID 和表示哪个分支活跃的标志，子表存储各分支的数据。换取更多复杂度，我们在数据库中获得了更好的约束（如子表中的 `NOT NULL` 列）。

```sql
-- 主表
CREATE TABLE ContactInfo (
    ContactId int NOT NULL,
    IsEmail bit NOT NULL,
    IsPhone bit NOT NULL,
    CONSTRAINT PK_ContactInfo PRIMARY KEY (ContactId)
)

-- "Email" 分支的子表
CREATE TABLE ContactEmail (
    ContactId int NOT NULL,
    EmailAddress NVARCHAR(100) NOT NULL,
    CONSTRAINT PK_ContactEmail PRIMARY KEY (ContactId)
)

-- "Phone" 分支的子表
CREATE TABLE ContactPhone (
    ContactId int NOT NULL,
    PhoneNumber NVARCHAR(25) NOT NULL,
    CONSTRAINT PK_ContactPhone PRIMARY KEY (ContactId)
)
```

当分支关联的数据很大且共同点很少时，「多表」方式可能更好；否则默认使用第一种「单表」方式。

### 12.5.2 将嵌套类型映射到表（Mapping Nested Types to Tables）

若类型包含其他类型，应如何处理？一般建议是：

- 若内部类型是**实体（Entity）**，有自身标识，应存储在单独表中
- 若内部类型是**值对象（Value Object）**，无自身标识，应「内联」存储在父数据中

例如，我们的 `Order` 类型包含 `OrderLine` 列表。`OrderLine` 是实体，因此应存储在单独表中，并带有指向父对象的指针（外键）：

```sql
CREATE TABLE Order (
    OrderId int NOT NULL,
    -- 其他列
)
CREATE TABLE OrderLine (
    OrderLineId int NOT NULL,
    OrderId int NOT NULL,
    -- 其他列
)
```

另一方面，`Order` 类型包含两个 `Address` 值，它们是值对象。因此对应的 `Order` 表应直接包含所有 `Address` 列：

```sql
CREATE TABLE Order (
    OrderId int NOT NULL,
    -- 内联发货地址值对象
    ShippingAddress1 varchar(50),
    ShippingAddress2 varchar(50),
    ShippingAddressCity varchar(50),
    -- 等等
    -- 内联账单地址值对象
    BillingAddress1 varchar(50),
    BillingAddress2 varchar(50),
    BillingAddressCity varchar(50),
    -- 等等
    -- 其他列
)
```

### 12.5.3 从关系数据库读取（Reading from a Relational Database）

在 F# 中，我们倾向于不使用对象关系映射器（ORM），而是直接使用原始 SQL 命令。最方便的方式是使用 F# SQL 类型提供程序。有几个可用——本例使用 FSharp.Data.SqlClient 类型提供程序。

使用类型提供程序而非典型运行时库的特殊之处在于：SQL 类型提供程序会在**编译时**创建与 SQL 查询或 SQL 命令匹配的类型。若 SQL 查询有误，你会得到编译时错误，而非运行时错误。若 SQL 正确，它会生成与 SQL 输出完全匹配的 F# 记录类型。

假设要用 `CustomerId` 读取单个 `Customer`。使用类型提供程序可以这样做。

首先定义编译时使用的连接字符串，通常引用本地数据库：

```fsharp
open FSharp.Data

[<Literal>]
let CompileTimeConnectionString =
    @"Data Source=(localdb)\MsSqlLocalDb; Initial Catalog=DomainModelingExample;"
```

然后将查询定义为名为 `ReadOneCustomer` 的类型：

```fsharp
type ReadOneCustomer = SqlCommandProvider<"""
    SELECT CustomerId, Name, Birthdate
    FROM Customer
    WHERE CustomerId = @customerId
""", CompileTimeConnectionString>
```

编译时，类型提供程序会在本地数据库上运行该查询并生成表示它的类型。这类似于 SqlMetal 或 EdmGenerator 工具，但不会生成单独文件——类型就地创建。稍后使用该类型时，我们会提供与编译时不同的「生产」连接。

接下来，正如上一章序列化示例那样，应创建 `toDomain` 函数。该函数验证数据库中的字段，然后用 result 表达式组装它们。

也就是说，我们将数据库视为需要验证的不可信数据源，就像任何其他数据源一样，因此 `toDomain` 函数需要返回 `Result<Customer,_>` 而非普通 `Customer`。代码如下：

```fsharp
let toDomain (dbRecord:ReadOneCustomer.Record) : Result<Customer,_> =
    result {
        let! customerId =
            dbRecord.CustomerId
            |> CustomerId.create
        let! name =
            dbRecord.Name
            |> String50.create "Name"
        let! birthdate =
            dbRecord.Birthdate
            |> Result.bindOption Birthdate.create
        let customer = {
            CustomerId = customerId
            Name = name
            Birthdate = birthdate
        }
        return customer
    }
```

这里有一个新增：数据库中的 `Birthdate` 列可空，因此类型提供程序将 `dbRecord.Birthdate` 字段设为 `Option` 类型。但 `Birthdate.create` 函数不接受 option。为解决此问题，我们创建一个小辅助函数 `bindOption`，让「切换」函数能处理 option：

```fsharp
let bindOption f xOpt =
    match xOpt with
    | Some x -> f x |> Result.map Some
    | None -> Ok None
```

像这样编写自定义 `toDomain` 函数并处理所有 `Result` 有点复杂，但一旦写好，就能确保不会有未处理的错误。

另一方面，若我们非常确信数据库永远不会包含坏数据，并愿意在出现时 panic，则可以对无效数据抛出异常。此时，可以将代码改为使用 `panicOnError` 辅助函数（将错误的 `Result` 转为异常），这意味着 `toDomain` 的输出是普通 `Customer`，无需包装在 `Result` 中：

```fsharp
let toDomain (dbRecord:ReadOneCustomer.Record) : Customer =
    let customerId =
        dbRecord.CustomerId
        |> CustomerId.create
        |> panicOnError "CustomerId"
    let name =
        dbRecord.Name
        |> String50.create "Name"
        |> panicOnError "Name"
    let birthdate =
        dbRecord.Birthdate
        |> Result.bindOption Birthdate.create
        |> panicOnError "Birthdate"
    { CustomerId = customerId; Name = name; Birthdate = birthdate }
```

其中 `panicOnError` 辅助函数大致如下：

```fsharp
exception DatabaseError of string
let panicOnError columnName result =
    match result with
    | Ok x -> x
    | Error err ->
        let msg = sprintf "%s: %A" columnName err
        raise (DatabaseError msg)
```

无论哪种方式，一旦有了 `toDomain` 函数，就可以编写从数据库读取并返回领域类型的代码。例如，下面是执行 `ReadOneCustomer` 查询并转换为领域类型的 `readOneCustomer` 函数：

```fsharp
type DbReadError =
    | InvalidRecord of string
    | MissingRecord of string

let readOneCustomer (productionConnection:SqlConnection) (CustomerId customerId) =
    use cmd = new ReadOneCustomer(productionConnection)
    let records = cmd.Execute(customerId = customerId) |> Seq.toList
    match records with
    | [] ->
        let msg = sprintf "Not found. CustomerId=%A" customerId
        Error (MissingRecord msg)
    | [dbCustomer] ->
        dbCustomer
        |> toDomain
        |> Result.mapError InvalidRecord
    | _ ->
        let msg = sprintf "Multiple records found for CustomerId=%A" customerId
        raise (DatabaseError msg)
```

首先注意，我们显式传入 `SqlConnection` 作为「生产」连接。

其次，有三种情况需要处理：未找到记录、恰好找到一条、找到多条。我们需要决定哪些情况应作为领域的一部分处理，哪些不应发生（可作为 panic 处理）。这里，缺失记录视为可能并作为 `Result.Error` 处理，多条记录视为 panic。

处理这些各种情况似乎很繁琐，但好处是你明确对可能的错误做出决策（并在代码中记录），而不是假设一切正常，然后在某处遇到 `NullReferenceException`。

当然，我们可以遵循「参数化一切」原则，创建通用函数 `convertSingleDbRecord`，将表名、ID、记录和 `toDomain` 转换器都作为参数传入，使代码更简洁：

```fsharp
let convertSingleDbRecord tableName idValue records toDomain =
    match records with
    | [] ->
        let msg = sprintf "Not found. Table=%s Id=%A" tableName idValue
        Error msg
    | [dbRecord] ->
        dbRecord
        |> toDomain
        |> Ok
    | _ ->
        let msg = sprintf "Multiple records found. Table=%s Id=%A" tableName idValue
        raise (DatabaseError msg)
```

有了这个通用辅助函数，代码可以简化为几行：

```fsharp
let readOneCustomer (productionConnection:SqlConnection) (CustomerId customerId) =
    use cmd = new ReadOneCustomer(productionConnection)
    let tableName = "Customer"
    let records = cmd.Execute(customerId = customerId) |> Seq.toList
    convertSingleDbRecord tableName customerId records toDomain
```

### 12.5.4 从关系数据库读取选择类型（Reading Choice Types from a Relational Database）

读取选择类型的方式相同，只是稍复杂。假设使用单表方式存储 `ContactInfo` 记录，要用 `ContactId` 读取单个 `ContactInfo`。和之前一样，将查询定义为类型：

```fsharp
type ReadOneContact = SqlCommandProvider<"""
    SELECT ContactId,IsEmail,IsPhone,EmailAddress,PhoneNumber
    FROM ContactInfo
    WHERE ContactId = @contactId
""", CompileTimeConnectionString>
```

然后创建 `toDomain` 函数。该函数检查数据库中的标志（`IsEmail`）以确定创建 `ContactInfo` 的哪个分支，然后用子 result 表达式为每个分支组装数据（组合性的好处！）：

```fsharp
let toDomain (dbRecord:ReadOneContact.Record) : Result<Contact,_> =
    result {
        let! contactId =
            dbRecord.ContactId
            |> ContactId.create
        let! contactInfo =
            if dbRecord.IsEmail then
                result {
                    let! emailAddressString =
                        dbRecord.EmailAddress
                        |> Result.ofOption "Email expected to be non null"
                    let! emailAddress =
                        emailAddressString |> EmailAddress.create
                    return (Email emailAddress)
                }
            else
                result {
                    let! phoneNumberString =
                        dbRecord.PhoneNumber
                        |> Result.ofOption "PhoneNumber expected to be non null"
                    let! phoneNumber =
                        phoneNumberString |> PhoneNumber.create
                    return (Phone phoneNumber)
                }
        let contact = {
            ContactId = contactId
            Info = contactInfo
        }
        return contact
    }
```

例如，在 `Email` 分支中，数据库中的 `EmailAddress` 列可空，因此类型提供程序创建的 `dbRecord.EmailAddress` 是 `Option` 类型。所以首先必须用 `Result.ofOption` 将 `Option` 转为 `Result`（以防缺失），然后创建 `EmailAddress` 类型，再将其提升为 `ContactInfo` 的 `Email` 分支。

这比之前的 `Customer` 示例更复杂，但同样，我们对不会有意外错误很有信心。

顺便，若你想知道 `Result.ofOption` 函数的代码，如下：

```fsharp
module Result =
    /// 将 Option 转为 Result
    let ofOption errorValue opt =
        match opt with
        | Some v -> Ok v
        | None -> Error errorValue
```

和之前一样，一旦有了 `toDomain` 函数，就可以与之前创建的 `convertSingleDbRecord` 辅助函数配合使用：

```fsharp
let readOneContact (productionConnection:SqlConnection) (ContactId contactId) =
    use cmd = new ReadOneContact(productionConnection)
    let tableName = "ContactInfo"
    let records = cmd.Execute(contactId = contactId) |> Seq.toList
    convertSingleDbRecord tableName contactId records toDomain
```

可以看到，创建 `toDomain` 函数是难点。一旦完成，实际数据库访问代码相对简单。

你可能会想：这不是很多工作吗？不能用 Entity Framework 或 NHibernate 之类自动完成所有映射吗？答案是：**不能**，若你想确保领域完整性的话。像这些 ORM 无法验证邮箱地址和订单数量、处理嵌套选择类型等。是的，编写这类数据库代码很繁琐，但过程是机械且直接的，并非应用中最难的部分！

### 12.5.5 写入关系数据库（Writing to a Relational Database）

写入关系数据库遵循与读取相同的模式：将领域对象转换为 DTO，然后执行 insert 或 update 命令。

进行数据库插入的最简单方式是让 SQL 类型提供程序生成表示表结构的可变类型，然后只需设置该类型的字段。

演示如下。首先用类型提供程序为所有表设置类型：

```fsharp
type Db = SqlProgrammabilityProvider<CompileTimeConnectionString>
```

现在可以定义 `writeContact` 函数，接收 `Contact` 并设置数据库中对应 `Contact` 的所有字段：

```fsharp
let writeContact (productionConnection:SqlConnection) (contact:Contact) =
    let contactId = contact.ContactId |> ContactId.value
    let isEmail,isPhone,emailAddressOpt,phoneNumberOpt =
        match contact.Info with
        | Email emailAddress ->
            let emailAddressString = emailAddress |> EmailAddress.value
            true, false, Some emailAddressString, None
        | Phone phoneNumber ->
            let phoneNumberString = phoneNumber |> PhoneNumber.value
            false, true, None, Some phoneNumberString
    let contactInfoTable = new Db.dbo.Tables.ContactInfo()
    let newRow = contactInfoTable.NewRow()
    newRow.ContactId <- contactId
    newRow.IsEmail <- isEmail
    newRow.IsPhone <- isPhone
    newRow.EmailAddress <- emailAddressOpt
    newRow.PhoneNumber <- phoneNumberOpt
    contactInfoTable.Rows.Add newRow
    let recordsAffected = contactInfoTable.Update(productionConnection)
    recordsAffected
```

另一种更有控制力的方式是使用手写 SQL 语句。例如，要插入新 `Contact`，首先定义表示 SQL INSERT 语句的类型：

```fsharp
type InsertContact = SqlCommandProvider<"""
    INSERT INTO ContactInfo
    VALUES (@ContactId,@IsEmail,@IsPhone,@EmailAddress,@PhoneNumber)
""", CompileTimeConnectionString>
```

现在可以定义接收 `Contact`、从选择类型提取基本类型并执行命令的 `writeContact` 函数：

```fsharp
let writeContact (productionConnection:SqlConnection) (contact:Contact) =
    let contactId = contact.ContactId |> ContactId.value
    let isEmail,isPhone,emailAddress,phoneNumber =
        match contact.Info with
        | Email emailAddress ->
            let emailAddressString = emailAddress |> EmailAddress.value
            true, false, emailAddressString, null
        | Phone phoneNumber ->
            let phoneNumberString = phoneNumber |> PhoneNumber.value
            false, true, null, phoneNumberString
    use cmd = new InsertContact(productionConnection)
    cmd.Execute(contactId, isEmail, isPhone, emailAddress, phoneNumber)
```

---

## 12.6 事务（Transactions）

到目前为止，所有代码都是「一个聚合 = 一个事务」的形式。但在许多情况下，我们需要原子地一起保存多件事——要么全成功，要么全失败。

某些数据存储在其 API 中支持事务。对服务的多次调用可以加入同一事务：

```fsharp
let connection = new SqlConnection()
let transaction = connection.BeginTransaction()
markAsFullyPaid connection invoiceId
markPaymentCompleted connection paymentId
transaction.Commit()
```

某些数据存储仅在所有操作在同一连接内完成时支持事务。实践中，这意味着必须将多个操作合并为单次调用：

```fsharp
let connection = new SqlConnection()
markAsFullyPaidAndPaymentCompleted connection paymentId invoiceId
```

但有时，你与不同服务通信，无法进行跨服务事务。

第 114 页提到的 Gregor Hohpe 的文章「Starbucks Does Not Use Two-Phase Commit」指出，企业通常不需要跨系统事务，因为开销和协调成本太重、太慢。相反，我们假设大多数情况下一切顺利，然后用对账流程检测不一致，用补偿事务纠正错误。

例如，下面是一个简单的补偿事务演示，用于回滚数据库更新：

```fsharp
markAsFullyPaid connection invoiceId
let result = markPaymentCompleted connection paymentId
match result with
| Error err ->
    unmarkAsFullyPaid connection invoiceId
| Ok _ -> ...
```

---

## 本章小结

本章我们先看了持久化的一些高层原则：将查询与命令分离、将 I/O 保持在边缘、确保限界上下文拥有自己的数据存储。然后深入关系数据库交互的低层机制。

至此，本书第三部分也告一段落。我们现在已具备设计和实现完整限界上下文所需的全部工具：领域内的纯类型和函数（《实现：组合管道》）、错误处理（《实现：处理错误》）、边缘的序列化（《序列化》），以及本章的用于存储状态的数据库。

但我们还没完全结束。正如军事格言所说：「计划一接触敌人就会失效。」那么，当我们学到新东西、需要改变设计时会发生什么？这将是下一章也是最后一章的主题。

---

[← 上一章：序列化](ch11-serialization.md) | [返回目录](../index.md) | [下一章：演进设计 →](ch13-evolving-design.md)
