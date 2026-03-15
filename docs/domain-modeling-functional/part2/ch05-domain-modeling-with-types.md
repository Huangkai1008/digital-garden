# 第5章：用类型建模领域

> 第一章讨论共享心智模型的重要性时，我们强调代码也必须反映这一共享模型，开发者不应在领域模型与源代码之间做有损的「翻译」。理想情况下，我们希望源代码本身就能充当文档，这意味着领域专家和其他非开发者应当能够审阅代码并检查设计。这现实吗？能否直接这样使用源代码，从而省去 UML 图之类的东西？答案是肯定的。本章将学习如何用 F# 类型系统准确捕获领域模型，使其既能作为可编译代码，又能被领域专家和非开发者阅读理解。我们将看到类型可以取代大部分文档，这一能力带来强大好处：实现永远不会与设计脱节，因为设计就体现在代码本身之中。

---

## 5.1 回顾领域模型

先回顾我们在第 36 页创建的领域模型：

```text
context: Order-Taking
// ----------------------
// Simple types
// ----------------------
// Product codes
data ProductCode = WidgetCode OR GizmoCode
data WidgetCode = string starting with "W" then 4 digits
data GizmoCode = ...
// Order Quantity
data OrderQuantity = UnitQuantity OR KilogramQuantity
data UnitQuantity = ...
data KilogramQuantity = ...
// ----------------------
// Order life cycle
// ----------------------
// ----- unvalidated state -----
data UnvalidatedOrder =
  UnvalidatedCustomerInfo
  AND UnvalidatedShippingAddress
  AND UnvalidatedBillingAddress
  AND list of UnvalidatedOrderLine
data UnvalidatedOrderLine =
  UnvalidatedProductCode
  AND UnvalidatedOrderQuantity
// ----- validated state -----
data ValidatedOrder = ...
data ValidatedOrderLine = ...
// ----- priced state -----
data PricedOrder = ...
data PricedOrderLine = ...
// ----- output events -----
data OrderAcknowledgmentSent = ...
data OrderPlaced = ...
data BillableOrderPlaced = ...
// ----------------------
// Workflows
// ----------------------
workflow "Place Order" =
  input: UnvalidatedOrder
  output (on success):
    OrderAcknowledgmentSent
    AND OrderPlaced (to send to shipping)
    AND BillableOrderPlaced (to send to billing)
  output (on error):
    InvalidOrder
// etc
```

本章的目标是将这一模型转化为代码。

## 5.2 发现领域模型中的模式

虽然每个领域模型各不相同，但许多模式会反复出现。下面看看典型领域中的一些模式，以及如何将模型中的组件与之对应。

- **简单值（Simple values）**：由字符串、整数等原始类型表示的基本构建块。但要注意，它们本质上并不是 `string` 或 `int`。领域专家不会用 `int` 和 `string` 思考，而是用 `OrderId`、`ProductCode` 等通用语言中的概念。
- **AND 组合的值**：紧密关联的数据组。在纸质世界里，通常是文档或文档的子组件：姓名、地址、订单等。
- **OR 选择**：表示领域中的选择：`Order` 或 `Quote`，`UnitQuantity` 或 `KilogramQuantity`。
- **工作流（Workflows）**：有输入和输出的业务流程。

接下来几节将学习如何用 F# 类型表示这些不同模式。

## 5.3 建模简单值

先看领域的构建块：简单值。

在收集需求时（第 33 页）我们发现，领域专家通常不会用 `int` 和 `string` 思考，而是用 `OrderId`、`ProductCode` 等领域概念。此外，重要的是 `OrderId` 和 `ProductCode` 不能混用。即便两者都用 `int` 表示，也不意味着可以互换。因此，为了明确这些类型是互不相同的，我们会创建「包装类型」（wrapper type）——包裹原始表示的类型。

如前所述，在 F# 中创建包装类型最简单的方式是使用「单例联合类型」（single-case union type），即只有一个选项的选择类型。例如：

```fsharp
type CustomerId =
| CustomerId of int
```

由于只有一个分支，通常会把整个类型定义写在一行：

```fsharp
type CustomerId = CustomerId of int
```

我们将这类包装类型称为「简单类型」（simple types），以区别于复合类型（如记录）和它们所包含的原始类型（如 `string`、`int`）。

在我们的领域中，简单类型可以这样建模：

```fsharp
type WidgetCode = WidgetCode of string
type UnitQuantity = UnitQuantity of int
type KilogramQuantity = KilogramQuantity of decimal
```

单例联合的定义有两部分：类型名和「分支」标签：

```fsharp
type CustomerId = CustomerId of int
// ^类型名   ^分支标签
```

从上面的例子可以看出，分支标签通常与类型名相同。这样在使用类型时，构造和解构可以用同一个名字，如下所示。

### 5.3.1 使用单例联合

要创建单例联合的值，我们把分支名当作构造函数使用：

```fsharp
type CustomerId = CustomerId of int
// ^这个分支名将成为构造函数

let customerId = CustomerId 42
// ^这是一个以 int 为参数的函数
```

这样创建简单类型可以确保不会意外混淆不同类型。例如，如果创建了 `CustomerId` 和 `OrderId` 并尝试比较，会得到编译错误：

```fsharp
// 定义一些类型
type CustomerId = CustomerId of int
type OrderId = OrderId of int
// 定义一些值
let customerId = CustomerId 42
let orderId = OrderId 42
// 尝试比较它们 —— 编译错误！
printfn "%b" (orderId = customerId)
// ^ 此表达式期望类型为 'OrderId'
```

如果定义了接受 `CustomerId` 的函数，传入 `OrderId` 也会导致编译错误：

```fsharp
// 定义使用 CustomerId 的函数
let processCustomerId (id:CustomerId) = ...
// 用 OrderId 调用 —— 编译错误！
processCustomerId orderId
// ^ 此表达式期望类型为 'CustomerId'，但此处为 'OrderId'
```

要解构或解包单例联合，可以用分支标签做模式匹配：

```fsharp
// 构造
let customerId = CustomerId 42
// 解构
let (CustomerId innerValue) = customerId
// ^ innerValue 被设为 42
printfn "%i" innerValue // 输出 "42"
```

在函数定义的参数中直接解构很常见。这样做不仅能立即访问内部值，F# 编译器还会为我们推断正确的类型。例如，下面代码中编译器会推断输入参数是 `CustomerId`：

```fsharp
// 解构
let processCustomerId (CustomerId innerValue) =
    printfn "innerValue is %i" innerValue
// 函数签名
// val processCustomerId: CustomerId -> unit
```

### 5.3.2 约束值

简单类型几乎总是有某种约束，例如必须在某个范围内或匹配某种模式。真实领域里很少有无界的整数或字符串。

我们将在下一章（第 104 页的「简单值的完整性」）讨论如何强制这些约束。

### 5.3.3 避免简单类型的性能问题

将原始类型包装成简单类型是确保类型安全、在编译期防止多种错误的好方法，但会带来内存和效率上的代价。对典型的业务应用来说，小幅性能下降通常不是问题，但对于科学计算或实时等需要高性能的领域，可能需要更谨慎。例如，遍历大量 `UnitQuantity` 的数组会比遍历原始 `int` 数组更慢。

不过，有几种方式可以兼顾两者。

首先，可以用类型别名代替简单类型来记录领域。这样没有额外开销，但会失去类型安全：

```fsharp
type UnitQuantity = int
```

其次，从 F# 4.1 起，可以使用值类型（struct）而不是引用类型。包装仍有开销，但存储在数组中时内存是连续的，因而更利于缓存：

```fsharp
[<Struct>]
type UnitQuantity = UnitQuantity of int
```

最后，如果处理大型数组，可以考虑将整个原始值集合定义为单一类型，而不是简单类型的集合：

```fsharp
type UnitQuantities = UnitQuantities of int[]
```

这样可以两全其美：既能高效处理原始数据（如矩阵乘法），又能在高层保持类型安全。进一步延伸这种方法会导向数据导向设计（data-oriented design），如现代游戏开发中所用。

你甚至可能发现通用语言中有描述这类「作为整体处理」的集合的词汇，如「DataSample」或「Measurements」。如果有，就用它！

性能始终是复杂话题，取决于具体代码和环境。通常最好先用最直接的方式建模领域，再考虑调优和优化。

## 5.4 建模复杂数据

在第 31 页记录领域时，我们用 AND 和 OR 表示更复杂的模型。在「理解类型」一章中，我们学习了 F# 的代数类型系统，它同样用 AND 和 OR 从简单类型构建复杂类型。

现在自然要用代数类型系统来建模我们的领域。

### 5.4.1 用记录类型建模

在领域中，我们看到许多数据结构由 AND 关系构建。例如，我们最初的简单 `Order` 定义如下：

```text
data Order =
  CustomerInfo
  AND ShippingAddress
  AND BillingAddress
  AND list of OrderLines
  AND AmountToBill
```

这可以直接翻译成 F# 记录结构：

```fsharp
type Order = {
    CustomerInfo : CustomerInfo
    ShippingAddress : ShippingAddress
    BillingAddress : BillingAddress
    OrderLines : OrderLine list
    AmountToBill : ...
}
```

我们为每个字段指定了名称（如 `CustomerInfo`、`ShippingAddress`）和类型（`CustomerInfo`、`ShippingAddress`）。

这样做会暴露出许多尚未回答的领域问题——我们还不知道这些类型具体是什么。`ShippingAddress` 和 `BillingAddress` 是同一类型吗？`AmountToBill` 应该用什么类型？理想情况下，可以请领域专家帮忙。例如，如果专家把账单地址和收货地址当作不同事物讨论，最好在逻辑上分开，即使结构相同。随着对领域的理解加深或需求变化，它们可能朝不同方向演进。

### 5.4.2 建模未知类型

在设计早期，往往对某些建模问题还没有确定答案。例如，你会知道要建模的类型名称（来自通用语言），但不知道其内部结构。

这不是问题——可以用最佳猜测表示未知结构的类型，或者将其建模为显式未定义的类型，作为占位符，直到在设计过程中有更好理解。

在 F# 中表示未定义类型时，可以使用异常类型 `exn` 并别名为 `Undefined`：

```fsharp
type Undefined = exn
```

然后在设计模型中这样使用 `Undefined` 别名：

```fsharp
type CustomerInfo = Undefined
type ShippingAddress = Undefined
type BillingAddress = Undefined
type OrderLine = Undefined
type BillingAmount = Undefined
type Order = {
    CustomerInfo : CustomerInfo
    ShippingAddress : ShippingAddress
    BillingAddress : BillingAddress
    OrderLines : OrderLine list
    AmountToBill : BillingAmount
}
```

这种方式意味着可以继续用类型建模领域并编译代码。但当编写处理这些类型的函数时，将被迫用更好的东西替换 `Undefined`。

### 5.4.3 用选择类型建模

在领域中，我们还看到许多表示「在若干事物之间选择」的类型，例如：

```text
data ProductCode =
  WidgetCode
  OR GizmoCode
data OrderQuantity =
  UnitQuantity
  OR KilogramQuantity
```

如何用 F# 类型系统表示这些选择？显然用选择类型：

```fsharp
type ProductCode =
| Widget of WidgetCode
| Gizmo of GizmoCode
type OrderQuantity =
| Unit of UnitQuantity
| Kilogram of KilogramQuantity
```

同样，每个分支需要两部分：「标签」或分支名（`of` 之前）以及与该分支关联的数据类型。上面的例子表明，分支标签（如 `Widget`）不必与关联类型名（`WidgetCode`）相同。

## 5.5 用函数建模工作流

现在我们已经有了建模所有数据结构——通用语言中的「名词」——的方法。但「动词」、即业务流程呢？

在本书中，我们将把工作流和其他流程建模为函数类型。例如，如果有一个验证订单表单的工作流步骤，可以这样记录：

```fsharp
type ValidateOrder = UnvalidatedOrder -> ValidatedOrder
```

从这段代码可以清楚看出，`ValidateOrder` 流程将未验证订单转换为已验证订单。

### 5.5.1 处理复杂输入和输出

每个函数只有一个输入和一个输出，但有些工作流可能有多个输入和输出。如何建模？先从输出开始。如果工作流有 `outputA` 和 `outputB`，可以创建记录类型来存储两者。我们在下单工作流中见过：输出需要三种不同事件，因此创建一个复合类型将它们存为一个记录：

```fsharp
type PlaceOrderEvents = {
    AcknowledgmentSent : AcknowledgmentSent
    OrderPlaced : OrderPlaced
    BillableOrderPlaced : BillableOrderPlaced
}
```

采用这种方式，下单工作流可以写成函数类型，以原始 `UnvalidatedOrder` 为输入，返回 `PlaceOrderEvents` 记录：

```fsharp
type PlaceOrder = UnvalidatedOrder -> PlaceOrderEvents
```

另一方面，如果工作流的输出是 `outputA` 或 `outputB`，可以创建选择类型来存储两者。例如，第 33 页我们简要讨论过将入站邮件分类为报价单或订单。该流程至少有两种不同的输出选择：

```text
workflow "Categorize Inbound Mail" =
  input: Envelope contents
  output:
    QuoteForm (put on appropriate pile)
    OR OrderForm (put on appropriate pile)
    OR ...
```

建模这一工作流很容易：只需创建一个新类型（如 `CategorizedMail`）表示这些选择，然后让 `CategorizeInboundMail` 返回该类型。模型可能如下：

```fsharp
type EnvelopeContents = EnvelopeContents of string
type CategorizedMail =
| Quote of QuoteForm
| Order of OrderForm
// etc
type CategorizeInboundMail = EnvelopeContents -> CategorizedMail
```

现在看输入建模。如果工作流有不同输入的选择（OR），可以创建选择类型。但如果流程有多个全部必需的输入（AND），例如下面的「Calculate Prices」：

```text
"Calculate Prices" =
  input: OrderForm, ProductCatalog
  output: PricedOrder
```

有两种可能做法。

第一种最简单：将每个输入作为单独参数传递：

```fsharp
type CalculatePrices = OrderForm -> ProductCatalog -> PricedOrder
```

另一种是创建新记录类型包含两者，例如 `CalculatePricesInput`：

```fsharp
type CalculatePricesInput = {
    OrderForm : OrderForm
    ProductCatalog : ProductCatalog
}
```

这样函数变成：

```fsharp
type CalculatePrices = CalculatePricesInput -> PricedOrder
```

哪种更好？在上面这种情况下，`ProductCatalog` 是依赖而非「真正」的输入，我们应使用单独参数的方式。这样可以使用函数式等效的依赖注入。我们将在第 180 页「注入依赖」实现订单处理管道时详细讨论。

另一方面，如果两个输入始终需要且彼此强关联，用记录类型会更清晰。（某些情况下可以用元组代替简单记录类型，但通常最好使用命名类型。）

### 5.5.2 在函数签名中记录效果

我们刚看到 `ValidateOrder` 流程可以这样写：

```fsharp
type ValidateOrder = UnvalidatedOrder -> ValidatedOrder
```

但这假设验证总是成功，总是返回 `ValidatedOrder`。实践中当然不成立，因此最好在函数签名中通过返回 `Result` 类型（第 70 页介绍）来表明这种情况：

```fsharp
type ValidateOrder =
    UnvalidatedOrder -> Result<ValidatedOrder,ValidationError list>
and ValidationError = {
    FieldName : string
    ErrorDescription : string
}
```

这个签名表明输入是 `UnvalidatedOrder`，成功时输出是 `ValidatedOrder`。但若验证失败，结果是 `ValidationError` 列表，其中包含错误描述及适用的字段。

函数式编程中用 **效果**（effects）一词描述函数除主要输出之外所做的其他事情。通过在这里使用 `Result`，我们已经在类型签名中记录了 `ValidateOrder` 可能有「错误效果」。这清楚表明不能假设函数总是成功，应准备好处理错误。

类似地，我们可能想记录某个流程是异步的——不会立即返回。如何做到？当然是用另一种类型！在 F# 中，我们用 `Async` 类型表示函数会有「异步效果」。因此，如果 `ValidateOrder` 既有异步效果又有错误效果，函数类型应这样写：

```fsharp
type ValidateOrder =
    UnvalidatedOrder -> Async<Result<ValidatedOrder,ValidationError list>>
```

这个类型签名现在记录了：(a) 尝试获取返回值内容时，代码不会立即返回；(b) 返回时，结果可能是错误。

像这样显式列出所有效果很有用，但会让类型签名变得冗长复杂，因此通常会为此创建类型别名使其更易读：

```fsharp
type ValidationResponse<'a> = Async<Result<'a,ValidationError list>>
```

然后函数可以这样记录：

```fsharp
type ValidateOrder =
    UnvalidatedOrder -> ValidationResponse<ValidatedOrder>
```

## 5.6 身份问题：值对象

我们已经对如何建模领域类型和工作流有了基本理解，接下来看一种重要的数据分类方式：根据是否具有持久身份来区分。

在 DDD 术语中，具有持久身份的对象称为**实体**（Entities），不具有持久身份的对象称为**值对象**（Value Objects）。我们先讨论值对象。

在许多情况下，我们处理的数据对象没有身份——它们可以互换。例如，值为 `"W1234"` 的 `WidgetCode` 实例与任何其他值为 `"W1234"` 的 `WidgetCode` 相同。我们不需要区分哪个是哪个——它们彼此相等。

在 F# 中可以这样演示：

```fsharp
let widgetCode1 = WidgetCode "W1234"
let widgetCode2 = WidgetCode "W1234"
printfn "%b" (widgetCode1 = widgetCode2) // 输出 "true"
```

「无身份的值」这一概念在领域模型中经常出现，对复杂类型和简单类型都是如此。例如，`PersonalName` 记录类型可能有两个字段——`FirstName` 和 `LastName`——因此比简单字符串更复杂；但它也是值对象，因为两个字段相同的个人姓名可以互换。可以用以下 F# 代码看出：

```fsharp
let name1 = {FirstName="Alex"; LastName="Adams"}
let name2 = {FirstName="Alex"; LastName="Adams"}
printfn "%b" (name1 = name2) // 输出 "true"
```

「地址」类型也是值对象。如果两个值的街道、城市和邮编相同，它们就是同一地址：

```fsharp
let address1 = {StreetAddress="123 Main St"; City="New York"; Zip="90001"}
let address2 = {StreetAddress="123 Main St"; City="New York"; Zip="90001"}
printfn "%b" (address1 = address2) // 输出 "true"
```

在领域讨论中，你可以通过表述判断这些是值对象。例如会说「Chris 和我同名」——尽管 Chris 和我是不同的人，我们的名字相同。它们没有唯一身份。同样，「Pat 和我有相同的邮寄地址」意味着我的地址和 Pat 的地址内容相同，因而相等。

### 5.6.1 为值对象实现相等性

当我们用 F# 代数类型系统建模领域时，创建的类型默认会实现这种基于字段的相等性测试。我们不需要自己写任何特殊的相等性代码，这很方便。

准确地说，两个（同类型的）记录值在 F# 中相等当且仅当它们的所有字段都相等；两个选择类型相等当且仅当它们有相同的分支且该分支关联的数据也相等。这称为**结构相等**（structural equality）。

## 5.7 身份问题：实体

然而，我们经常建模的事物在现实世界中确实具有唯一身份，即使其组成部分会变化。例如，即使我改了名字或地址，我仍然是同一个人。

在 DDD 术语中，我们称这类事物为**实体**（Entities）。

在业务语境中，实体通常是某种文档：订单、报价单、发票、客户档案、产品清单等。它们有生命周期，通过各种业务流程从一种状态转变为另一种状态。

「值对象」与「实体」的区分取决于语境。例如，考虑手机的生命周期。在制造阶段，每部手机被赋予唯一序列号——唯一身份——因此在该语境下，手机会被建模为实体。但在销售时，序列号无关紧要——相同规格的手机可以互换——可以建模为值对象。然而，一旦某部手机卖给某位客户，身份又变得相关，应建模为实体：客户认为即使换了屏幕或电池，仍是同一部手机。

### 5.7.1 实体的标识符

实体需要具有稳定的身份，无论发生什么变化。因此，建模时需要给它们唯一标识符或键，如「Order ID」或「Customer ID」。

例如，下面的 `Contact` 类型有 `ContactId`，即使 `PhoneNumber` 或 `EmailAddress` 字段变化，它也保持不变：

```fsharp
type ContactId = ContactId of int
type Contact = {
    ContactId : ContactId
    PhoneNumber : ...
    EmailAddress: ...
}
```

这些标识符从何而来？有时标识符由现实领域本身提供——纸质订单和发票历来都有某种参考编号——但有时我们需要自己创建人工标识符，使用 UUID、自增数据库表或 ID 生成服务等技术。这是复杂话题，本书中我们假设所有标识符都由客户提供。

### 5.7.2 在数据定义中添加标识符

既然已识别出某领域对象是实体，如何在其定义中添加标识符？

在记录类型中添加标识符很简单——只需添加字段——但选择类型呢？应该把标识符放在「内部」（与每个分支关联）还是「外部」（不与任何分支关联）？

例如，假设 `Invoice` 有两种选择：已付和未付。如果用「外部」方式建模，会有一个包含 `InvoiceId` 的记录，记录内有一个选择类型 `InvoiceInfo`，包含每种发票的信息。代码大致如下：

```fsharp
// 未付分支的信息（无 id）
type UnpaidInvoiceInfo = ...
// 已付分支的信息（无 id）
type PaidInvoiceInfo = ...
// 组合信息（无 id）
type InvoiceInfo =
| Unpaid of UnpaidInvoiceInfo
| Paid of PaidInvoiceInfo
// 发票的 id
type InvoiceId = ...
// 顶层发票类型
type Invoice = {
    InvoiceId : InvoiceId  // 在两个子分支「外部」
    InvoiceInfo : InvoiceInfo
}
```

这种方式的问题在于，要轻松处理某一分支的数据很困难，因为数据分散在不同组件中。

实践中更常见的是用「内部」方式存储 ID，即每个分支都有自己的标识符副本。应用到我们的例子，会创建两个独立类型，分别对应每种情况（`UnpaidInvoice` 和 `PaidInvoice`），两者都有自己的 `InvoiceId`，然后顶层 `Invoice` 类型是它们之间的选择。代码大致如下：

```fsharp
type UnpaidInvoice = {
    InvoiceId : InvoiceId  // id 存储在「内部」
    // 以及未付情况的其他信息
}
type PaidInvoice = {
    InvoiceId : InvoiceId  // id 存储在「内部」
    // 以及已付情况的其他信息
}
// 顶层发票类型
type Invoice =
| Unpaid of UnpaidInvoice
| Paid of PaidInvoice
```

这种方式的好处是，在做模式匹配时，所有数据（包括 ID）都在一处可访问：

```fsharp
let invoice = Paid {InvoiceId = ...}
match invoice with
| Unpaid unpaidInvoice ->
    printfn "The unpaid invoiceId is %A" unpaidInvoice.InvoiceId
| Paid paidInvoice ->
    printfn "The paid invoiceId is %A" paidInvoice.InvoiceId
```

### 5.7.3 为实体实现相等性

前面看到，F# 中默认的相等性测试使用记录的所有字段。但比较实体时，我们只想使用一个字段——标识符。这意味着要在 F# 中正确建模实体，必须改变默认行为。

一种做法是重写相等性测试，使其只使用标识符。要改变默认行为，需要：

1. 重写 `Equals` 方法
2. 重写 `GetHashCode` 方法
3. 在类型上添加 `CustomEquality` 和 `NoComparison` 属性，告诉编译器我们要改变默认行为

对 `Contact` 类型做这些后，得到：

```fsharp
[<CustomEquality; NoComparison>]
type Contact = {
    ContactId : ContactId
    PhoneNumber : PhoneNumber
    EmailAddress: EmailAddress
}
with
    override this.Equals(obj) =
        match obj with
        | :? Contact as c -> this.ContactId = c.ContactId
        | _ -> false
    override this.GetHashCode() =
        hash this.ContactId
```

::: info 关于语法
这是我们尚未见过的新语法：F# 的面向对象语法。我们仅在此处用它演示相等性重写，面向对象的 F# 超出本书范围，因此不会在别处使用。
:::

定义好类型后，可以创建一个联系人：

```fsharp
let contactId = ContactId 1
let contact1 = {
    ContactId = contactId
    PhoneNumber = PhoneNumber "123-456-7890"
    EmailAddress = EmailAddress "bob@example.com"
}
```

再创建一个 `ContactId` 相同但不同的联系人：

```fsharp
// 同一联系人，不同邮箱地址
let contact2 = {
    ContactId = contactId
    PhoneNumber = PhoneNumber "123-456-7890"
    EmailAddress = EmailAddress "robert@example.com"
}
```

最后，用 `=` 比较时，结果为 `true`：

```fsharp
// 即使邮箱地址不同也为 true
printfn "%b" (contact1 = contact2)
```

这是面向对象设计中的常见做法，但通过静默改变默认相等性行为，有时会带来困扰。因此，另一种（通常更可取）做法是添加 `NoEquality` 类型注解，完全禁止对该对象进行相等性测试：

```fsharp
[<NoEquality; NoComparison>]
type Contact = {
    ContactId : ContactId
    PhoneNumber : PhoneNumber
    EmailAddress: EmailAddress
}
```

添加此注解后，尝试比较时会得到编译错误：

```fsharp
// 编译错误！
printfn "%b" (contact1 = contact2)
// ^ Contact 类型不支持相等性
```

当然，我们仍然可以直接比较 `ContactId` 字段：

```fsharp
// 无编译错误
printfn "%b" (contact1.ContactId = contact2.ContactId) // true
```

「NoEquality」方式的好处是消除了对象层面相等性含义的任何歧义，迫使我们显式表达。

最后，在某些情况下，可能有多个字段用于相等性测试。此时可以轻松暴露一个组合它们的合成 `Key` 属性：

```fsharp
[<NoEquality;NoComparison>]
type OrderLine = {
    OrderId : OrderId
    ProductId : ProductId
    Qty : int
}
with
    member this.Key =
        (this.OrderId,this.ProductId)
```

需要比较时，可以使用 `Key` 字段：

```fsharp
printfn "%b" (line1.Key = line2.Key)
```

### 5.7.4 不可变性与身份

如「理解类型」一章所述，F# 等函数式语言中的值默认是不可变的，这意味着到目前为止定义的所有对象在初始化后都不能被修改。

这对设计有何影响？

- **对于值对象**，不可变性是必需的。想想日常用语：如果我们改变个人姓名的任何部分，我们会说那是新的、不同的名字，而不是同一名字的不同数据。
- **对于实体**，情况不同。我们期望与实体相关的数据会随时间变化；这正是拥有恒定标识符的意义所在。那么不可变数据结构如何做到这一点？答案是：在保留身份的同时，制作一份带有变更数据的实体副本。所有这些复制看似工作量很大，但实践中不是问题。事实上，本书中我们将处处使用不可变数据，你会看到不可变性很少成为问题。

下面是在 F# 中更新实体的例子。首先从初始值开始：

```fsharp
let initialPerson = {PersonId=PersonId 42; Name="Joseph"}
```

要在只改变部分字段的情况下复制记录，F# 使用 `with` 关键字：

```fsharp
let updatedPerson = {initialPerson with Name="Joe"}
```

复制后，`updatedPerson` 的 `Name` 不同，但 `PersonId` 与 `initialPerson` 相同。

使用不可变数据结构的一个好处是，任何变更都必须在类型签名中显式体现。例如，如果要写一个改变 `Person` 中 `Name` 字段的函数，不能使用这样的签名：

```fsharp
type UpdateName = Person -> Name -> unit
```

该函数没有输出，意味着什么都没变（或 Person 被作为副作用修改了）。相反，我们的函数必须有以 `Person` 类型为输出的签名：

```fsharp
type UpdateName = Person -> Name -> Person
```

这清楚表明：给定 `Person` 和 `Name`，会返回某种原始 `Person` 的变体。

## 5.8 聚合

我们更仔细地看看与设计特别相关的两种数据类型：`Order` 和 `OrderLine`。

首先，`Order` 是实体还是值对象？显然是实体——订单的细节可能随时间变化，但仍是同一订单。

那 `OrderLine` 呢？如果我们改变某订单行的数量，它还是同一订单行吗？在大多数设计中，说「是」是合理的——即使数量或价格随时间变化，仍是同一订单行。所以 `OrderLine` 也是实体，有自己的标识符。

但问题是：如果你改变了一个订单行，是否也改变了它所属的订单？

在这种情况下，答案显然是肯定的：改变一行也就改变了整个订单。事实上，使用不可变数据结构使这不可避免。如果我有一个包含不可变 `OrderLine` 的不可变 `Order`，那么只复制其中一个订单行并不会同时复制 `Order`。要修改 `Order` 中包含的 `OrderLine`，必须在 `Order` 层面做变更，而不是在 `OrderLine` 层面。

例如，下面是更新订单行价格的伪代码：

```fsharp
/// 我们传入三个参数：
/// * 顶层订单
/// * 要修改的订单行 id
/// * 新价格
let changeOrderLinePrice order orderLineId newPrice =
    // 1. 用 orderLineId 找到要修改的行
    let orderLine = order.OrderLines |> findOrderLine orderLineId
    // 2. 用新价格创建 OrderLine 的新版本
    let newOrderLine = {orderLine with Price = newPrice}
    // 3. 创建新行列表，用新行替换旧行
    let newOrderLines =
        order.OrderLines |> replaceOrderLine orderLineId newOrderLine
    // 4. 创建整个订单的新版本，用新行替换所有旧行
    let newOrder = {order with OrderLines = newOrderLines}
    // 5. 返回新订单
    newOrder
```

最终结果、函数的输出，是一个包含新行列表的新 `Order`，其中一行有新价格。可以看到，不可变性在数据结构中产生连锁反应：改变一个低层组件会迫使高层组件也随之改变。

因此，即使我们只是改变其「子实体」之一（`OrderLine`），也必须始终在 `Order` 本身层面操作。

这是非常常见的情况：我们有一组实体，每个都有自己的 ID，还有一个包含它们的「顶层」实体。在 DDD 术语中，这样的实体集合称为**聚合**（aggregate），顶层实体称为**聚合根**（aggregate root）。在本例中，聚合包括 `Order` 和 `OrderLine` 集合，聚合根是 `Order` 本身。

### 5.8.1 聚合保证一致性和不变量

聚合在数据更新时扮演重要角色。聚合充当**一致性边界**（consistency boundary）：当聚合的一部分被更新时，其他部分可能也需要更新以确保一致性。

例如，我们可能扩展设计，在顶层 `Order` 中存储额外的「总价」。显然，如果某行价格变化，总额也必须更新以保持数据一致。这会在上面的 `changeOrderLinePrice` 函数中完成。显然，唯一「知道」如何保持一致性的组件是顶层 `Order`——聚合根——因此这是所有更新在订单层面而非行层面进行的另一个原因。

聚合也是强制执行任何**不变量**（invariants）的地方。假设有一条规则：每个订单至少有一行。那么如果尝试删除多行，当只剩一行时，聚合会确保产生错误。

我们将在第 6 章「领域中的完整性与一致性」（第 103 页）进一步讨论。

### 5.8.2 聚合引用

假设需要将客户信息与 `Order` 关联。可能会想把 `Customer` 作为 `Order` 的字段添加：

```fsharp
type Order = {
    OrderId : OrderId
    Customer : Customer  // 关联客户的信息
    OrderLines : OrderLine list
    // etc
}
```

但想想不可变性的连锁反应。如果我改变客户的任何部分，也必须改变订单。这真的是我们想要的吗？

更好的设计是只存储对客户的引用，而不是整个客户记录。也就是说，只在 `Order` 类型中存储 `CustomerId`：

```fsharp
type Order = {
    OrderId : OrderId
    CustomerId : CustomerId  // 关联客户的引用
    OrderLines : OrderLine list
    // etc
}
```

采用这种方式，当需要客户的完整信息时，我们从 `Order` 获取 `CustomerId`，然后单独从数据库加载相关客户数据，而不是作为订单的一部分加载。

换句话说，`Customer` 和 `Order` 是独立的不同聚合。它们各自负责自己的内部一致性，它们之间的唯一联系是通过其根对象的标识符。

这引出聚合的另一个重要方面：它们是**持久化的基本单位**。如果要从数据库加载或保存对象，应该加载或保存整个聚合。每个数据库事务应只处理一个聚合，不应包含多个聚合或跨越聚合边界。更多信息见第 262 页的「事务」。

同样，如果要序列化对象以通过网络发送，总是发送整个聚合，而不是其部分。

需要澄清的是，聚合不仅仅是实体的任意集合。例如，`Customer` 列表是实体集合，但不是 DDD 意义上的「聚合」，因为它没有作为根的顶层实体，也不是一致性边界。

以下是聚合在领域模型中重要作用的总结：

- 聚合是可以作为单一单元处理的领域对象集合，顶层实体充当「根」。
- 对聚合内对象的所有变更必须通过顶层应用到根，聚合充当一致性边界，确保聚合内所有数据同时正确更新。
- 聚合是持久化、数据库事务和数据传输的原子单位。

如你所见，定义聚合是设计过程的重要部分。有时一起使用的实体属于同一聚合（`OrderLine` 和 `Order`），有时不是（`Customer` 和 `Order`）。这正是与领域专家协作的关键所在：只有他们能帮助你理解实体之间的关系和一致性边界。

在建模过程中我们会看到很多聚合，从现在起将使用这一术语。

## 5.9 更多领域驱动设计词汇

以下是本章引入的新 DDD 术语：

- **值对象**（Value Object）是没有身份的领域对象。包含相同数据的两个值对象被视为相同。值对象必须不可变：任何部分改变，就变成不同的值对象。值对象的例子有姓名、地址、位置、金额和日期。
- **实体**（Entity）是具有内在身份的领域对象，即使其属性变化身份也持续存在。实体对象通常有 ID 或键字段，具有相同 ID/键的两个实体被视为同一对象。实体通常表示有生命周期和变更历史的领域对象，如文档。实体的例子有客户、订单、产品和发票。
- **聚合**（aggregate）是相关对象的集合，既作为单一组件确保领域一致性，又作为数据事务的原子单位使用。其他实体应仅通过聚合的标识符引用它，该标识符是聚合「顶层」成员的 ID，称为「根」。

## 5.10 整合在一起

本章创建了很多类型，让我们退一步看看它们如何作为一个完整的领域模型组合在一起。

首先，将所有类型放在名为 `OrderTaking.Domain` 的命名空间中，用于将这些类型与其他命名空间分开。换句话说，我们使用 F# 的命名空间来表示 DDD 的限界上下文，至少目前如此。

```fsharp
namespace OrderTaking.Domain
// 类型紧随其后
```

然后添加简单类型：

```fsharp
// 产品代码相关
type WidgetCode = WidgetCode of string
// 约束：以 "W" 开头后跟 4 位数字
type GizmoCode = GizmoCode of string
// 约束：以 "G" 开头后跟 3 位数字
type ProductCode =
| Widget of WidgetCode
| Gizmo of GizmoCode
// 订单数量相关
type UnitQuantity = UnitQuantity of int
type KilogramQuantity = KilogramQuantity of decimal
type OrderQuantity =
| Unit of UnitQuantity
| Kilos of KilogramQuantity
```

这些都是值对象，不需要标识符。

另一方面，订单在变化时保持身份——它是实体——因此必须用 ID 建模。我们不知道 ID 是 `string`、`int` 还是 `Guid`，但知道需要它，所以暂时用 `Undefined`。其他标识符同样处理。

```fsharp
type OrderId = Undefined
type OrderLineId = Undefined
type CustomerId = Undefined
```

订单及其组件现在可以勾勒出来：

```fsharp
type CustomerInfo = Undefined
type ShippingAddress = Undefined
type BillingAddress = Undefined
type Price = Undefined
type BillingAmount = Undefined
type Order = {
    Id : OrderId  // 实体的 id
    CustomerId : CustomerId  // 客户引用
    ShippingAddress : ShippingAddress
    BillingAddress : BillingAddress
    OrderLines : OrderLine list
    AmountToBill : BillingAmount
}
and OrderLine = {
    Id : OrderLineId  // 实体的 id
    OrderId : OrderId
    ProductCode : ProductCode
    OrderQuantity : OrderQuantity
    Price : Price
}
```

::: info 关于 `and` 关键字
上面的代码片段中，我们使用 `and` 关键字允许对未声明类型的前向引用。说明见第 73 页的「在文件与项目中组织类型」。
:::

现在以工作流本身作结。工作流的输入 `UnvalidatedOrder` 将按原样从订单表单构建，因此只包含 `int`、`string` 等原始类型。

```fsharp
type UnvalidatedOrder = {
    OrderId : string
    CustomerInfo : ...
    ShippingAddress : ...
    ...
}
```

工作流输出需要两种类型。第一种是工作流成功时的事件类型：

```fsharp
type PlaceOrderEvents = {
    AcknowledgmentSent : ...
    OrderPlaced : ...
    BillableOrderPlaced : ...
}
```

第二种是工作流失败时的错误类型：

```fsharp
type PlaceOrderError =
| ValidationError of ValidationError list
| ...  // 其他错误
and ValidationError = {
    FieldName : string
    ErrorDescription : string
}
```

最后，可以定义表示下单工作流的顶层函数：

```fsharp
/// 「Place Order」流程
type PlaceOrder =
    UnvalidatedOrder -> Result<PlaceOrderEvents,PlaceOrderError>
```

显然，许多细节仍需完善，但完善的过程现在应该很清楚了。

不过，我们的接单工作流模型还不完整。例如，如何建模订单的不同状态：已验证、已定价等？

## 5.11 再谈挑战：类型能否取代文档？

本章开头我们给自己设了一个挑战：能否在类型系统中捕获领域需求，并以领域专家和其他非开发者可以审阅的方式呈现？

看看上面列出的领域模型，我们应该感到满意。我们有了完整的领域模型，用 F# 类型而非文本记录，但我们设计的类型与之前用 AND 和 OR 记法开发的领域文档几乎一模一样。

假设你是非开发者。要理解这段代码作为文档，你需要学什么？你需要理解简单类型的语法（单例联合）、AND 类型（花括号记录）、OR 类型（竖杠选择）和「流程」（输入、输出和箭头），仅此而已。它肯定比 C# 或 Java 等传统编程语言更易读。

## 5.12 收尾

本章学习了如何用 F# 类型系统，通过简单类型、记录类型和选择类型来建模领域。我们始终使用领域的通用语言，如 `ProductCode` 和 `OrderQuantity`，而不是以开发者为中心的 `string` 和 `int`。我们一次也没有定义 `Manager` 或 `Handler` 类型！

我们还学习了不同种类的身份，以及如何用类型建模 DDD 的值对象和实体概念。我们引入了「聚合」概念作为确保一致性的方式。

然后我们创建了一组与本章开头的文本文档非常相似的类型。重大区别在于，所有这些类型定义都是可编译的代码，可以与应用其余代码一起包含。这反过来意味着应用代码始终与领域定义同步，如果任何领域定义发生变化，应用将无法编译。我们不需要试图让设计与代码保持同步——设计就是代码！

这种用类型作为文档的方法非常通用，应该清楚如何将其应用到其他领域。由于此时还没有实现，这是在领域专家协作时快速尝试想法的好方法。当然，因为它只是文本，领域专家可以轻松审阅，无需特殊工具，甚至可能自己写一些类型！

不过，我们尚未解决设计的几个方面。如何确保简单类型始终正确约束？如何强制执行聚合的完整性？如何建模订单的不同状态？这些主题将在下一章讨论。

## 本章小结

本章学习了如何用 F# 类型系统建模领域：用**简单类型**（单例联合）表示领域概念如 `ProductCode`、`OrderQuantity`，用**记录类型**表示 AND 组合，用**选择类型**表示 OR 选择，用**函数类型**表示工作流。我们区分了**值对象**（无身份、可互换、不可变）与**实体**（有持久身份、需标识符），并引入了**聚合**作为一致性边界和持久化单位。最终得到的类型定义既是可编译代码，又可被领域专家审阅，设计与实现合二为一。

---

[← 上一章：理解类型](ch04-understanding-types.md) | [返回目录](../index.md) | [下一章：完整性与一致性 →](ch06-integrity-and-consistency.md)
