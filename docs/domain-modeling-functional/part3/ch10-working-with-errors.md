# 第10章：实现：处理错误

> 如果产品代码格式错误、客户名称过长，或地址验证服务超时，会发生什么？任何系统都会有错误，如何处理它们至关重要。一致且透明的错误处理对任何生产级系统都至关重要。上一章我们刻意移除了管道步骤中的错误「效应」（Result 类型），以便专注于组合与依赖。但这一效应很重要！本章我们将把 Result 恢复到类型签名中，并学习如何与之协作。更广泛地说，我们将探索函数式错误处理方法，发展出一种既能优雅地捕获错误，又不会用丑陋的条件判断和 try/catch 污染代码的技术。我们还会看到，为什么应当把某些错误当作领域错误，给予与领域驱动设计中其他部分同等的关注。

---

## 10.1 使用 Result 类型使错误显式

函数式编程技术力求尽可能让事物显式化，错误处理也不例外。我们希望创建的函数能显式表明是否成功，若失败则说明错误情况是什么。

错误在代码中往往被当作二等公民。但若要构建健壮、可投入生产的系统，我们应当把错误当作一等公民。对于属于领域一部分的错误，更应如此。

上一章我们用异常来抛出错误。这很方便，但意味着所有函数签名都具有误导性。例如，检查地址的函数有这样的签名：

```fsharp
type CheckAddressExists =
    UnvalidatedAddress -> CheckedAddress
```

这几乎毫无帮助，因为它没有表明可能出什么问题。我们想要的反而是一个**全函数（total function）**（见第 154 页《全函数》），所有可能的结果都由类型签名显式文档化。

正如我们在第 70 页《建模错误》中已学到的，可以用 `Result` 类型明确表示函数可能成功或失败，此时签名会变成这样：

```fsharp
type CheckAddressExists =
    UnvalidatedAddress -> Result<CheckedAddress,AddressValidationError>

and AddressValidationError =
    | InvalidFormat of string
    | AddressNotFound of string
```

这告诉我们几件重要的事：

- 输入是 `UnvalidatedAddress`
- 若验证成功，输出是（可能不同的）`CheckedAddress`
- 若验证失败，原因是格式无效或地址未找到

这说明函数签名可以充当文档。若其他开发者需要使用这些函数，仅看签名就能了解很多信息。

## 10.2 处理领域错误

软件系统很复杂，我们无法（也不应）用这类类型处理所有可想象的错误。因此，在动手之前，先建立一套一致的错误分类与处理方式。

我们可以把错误分为三类：

- **领域错误（Domain Errors）**：作为业务流程一部分可预期的错误，因此必须纳入领域设计，例如订单被计费拒绝、订单包含无效产品代码等。业务已有处理这类情况的流程，代码需要反映这些流程。
- **恐慌（Panics）**：使系统处于未知状态的错误，例如不可处理的系统错误（如「内存不足」）或由程序员疏忽导致的错误（如「除零」或「空引用」）。
- **基础设施错误（Infrastructure Errors）**：作为架构一部分可预期、但不属于任何业务流程、也不纳入领域的错误，例如网络超时或认证失败。

有时很难判断某件事是否属于领域错误。若不确定，直接问领域专家即可。

::: tip 示例对话
你：嗨，Ollie， quick question：如果访问负载均衡器时连接中断，这是你在乎的事吗？
Ollie：？？？
你：好吧，我们就把它当作基础设施错误，告诉用户稍后再试。
:::

这些不同类型的错误需要不同的实现方式。

领域错误是领域的一部分，与其他事物一样，应纳入领域建模、与领域专家讨论，并尽可能在类型系统中文档化。

恐慌最好通过放弃工作流并抛出异常来处理，异常在最高适当层级（如应用程序的 main 函数或等价入口）被捕获。例如：

```fsharp
/// 收到错误输入时会 panic 的工作流
let workflowPart2 input =
    if input = 0 then
        raise (DivideByZeroException())
    ...

/// 应用程序的顶层函数，捕获工作流中的所有异常
let main() =
    try
        let result1 = workflowPart1()
        let result2 = workflowPart2 result1
        printfn "the result is %A" result2
    with
    | :? OutOfMemoryException ->
        printfn "exited with OutOfMemoryException"
    | :? DivideByZeroException ->
        printfn "exited with DivideByZeroException"
    | ex ->
        printfn "exited with %s" ex.Message
```

基础设施错误可以用上述两种方式之一处理，具体取决于所用架构。若代码由许多小服务组成，异常可能更简洁；若应用更单体化，可能希望让错误处理更显式。事实上，把许多基础设施错误当作领域错误处理往往很有用，因为这会迫使开发者思考可能出什么问题。在某些情况下，这类错误甚至需要上报给领域专家。例如，若远程地址验证服务不可用，业务流程应如何变化？我们应告诉客户什么？这类问题不能仅由开发团队决定，必须由领域专家和产品负责人共同考虑。

本章其余部分只关注我们想显式建模为领域一部分的错误。不想建模的恐慌和错误应直接抛出异常，由顶层函数捕获，如上所示。

### 10.2.1 在类型中建模领域错误

建模领域时，我们避免使用字符串等原始类型，转而创建领域专属的类型，使用领域词汇（通用语言）。

错误理应得到同等对待。若某些错误在领域讨论中出现，就应像领域中的其他事物一样建模。通常我们会把错误建模为**选择类型（choice type）**，为每种需要特别关注的错误设一个单独分支。

例如，我们可以这样建模下单工作流中的错误：

```fsharp
type PlaceOrderError =
    | ValidationError of string
    | ProductOutOfStock of ProductCode
    | RemoteServiceError of RemoteServiceError
    ...
```

- `ValidationError` 分支用于属性验证，如长度或格式错误
- `ProductOutOfStock` 分支用于客户尝试购买缺货产品时，可能有特殊业务流程处理
- `RemoteServiceError` 分支展示了如何处理基础设施错误：与其直接抛异常，不如在放弃前重试若干次

使用这种选择类型的好处是，它充当了代码中所有可能出错之处的显式文档。与错误相关的额外信息也会显式展示。此外，随着需求变化扩展（或收缩）选择类型不仅容易，而且安全，因为编译器会确保任何对其做模式匹配的代码在遗漏分支时收到警告。

我们在第 7 章《将工作流建模为管道》（第 119 页）设计工作流时，知道错误可能发生，但没有深入定义具体有哪些。这是刻意的。设计阶段不必 upfront 定义所有可能的错误。通常错误会在应用开发过程中出现，然后你可以决定是否将其视为领域错误。若某情况是领域错误，再将其加入选择类型。

当然，向选择类型添加新分支可能会在部分代码中引发警告，提示你尚未处理所有分支。这很好，因为现在你被迫与领域专家或产品负责人讨论该情况下的具体处理方式。当选择类型这样使用时，很难意外忽略边界情况。

### 10.2.2 错误处理让代码变丑

异常的一个好处是能让「快乐路径」代码保持简洁。例如，上一章的 `validateOrder` 函数（伪代码）是这样的：

```fsharp
let validateOrder unvalidatedOrder =
    let orderId = ... create order id (or throw exception)
    let customerInfo = ... create info (or throw exception)
    let shippingAddress = ... create and validate shippingAddress...
    // etc
```

若每一步都返回错误，代码会变得丑陋得多。我们通常需要在每个潜在错误后加条件判断，以及 try/catch 块来捕获可能的异常。下面是一些更接近真实情况的伪代码：

```fsharp
let validateOrder unvalidatedOrder =
    let orderIdResult = ... create order id (or return Error)
    if orderIdResult is Error then
        return ...
    let customerInfoResult = ... create name (or return Error)
    if customerInfoResult is Error then
        return ...
    try
        let shippingAddressResult = ... create valid address (or return Error)
        if shippingAddress is Error then
            return ...
        // ...
    with
    | :? TimeoutException -> Error "service timed out"
    | :? AuthenticationException -> Error "bad credentials"
    // etc
```

这种做法的问题是，三分之二的代码现在都在处理错误——原本简单清晰的代码被破坏了。

我们面临一个挑战：如何在引入恰当错误处理的同时，保持管道模型的优雅？

## 10.3 链式调用 Result 生成函数

在解决我们的具体问题之前，先退一步看全局。一般来说，若有一些生成 `Result` 的函数，如何以简洁的方式把它们组合在一起？

下面用图示表示这个问题。普通函数可以看作一段铁轨：

```
输入 ──────────────> 输出
```

但输出为 `Result` 的函数可以看作分岔成两条的铁轨：

```
输入 ─────┬──> 成功 (Success)
         └──> 失败 (Failure)
```

我称这类函数为**开关函数（switch functions）**，沿用铁路类比。它们也常被称为「单子式（monadic）」函数。

那么如何连接两个这样的「开关」函数？若输出成功，我们希望继续执行序列中的下一个函数；若输出是错误，我们希望绕过它，如下图所示：

```
成功时继续
失败时绕过
```

```
    ┌─────────┐      ┌─────────┐
───>│ 步骤 A  │─────>│ 步骤 B  │───>
    └────┬────┘      └────┬────┘
         │ 失败           │ 失败
         └────────────────┴───> 失败轨道
```

如何把这两个开关组合起来，使两条失败轨道都连接起来？答案很明显——像这样：

```
    ┌─────────┐      ┌─────────┐
───>│ 步骤 A  │─────>│ 步骤 B  │───> 成功
    └────┬────┘      └────┬────┘
         │                │
         └────────────────┴───> 失败
```

若以这种方式连接管道中的所有步骤，就得到我所说的错误处理的**双轨模型（two-track model）**，或**铁路导向编程（railway-oriented programming）**：

```
输入 ──> [步骤1] ──> [步骤2] ──> [步骤3] ──> 成功输出
           │            │            │
           └────────────┴────────────┴───> 失败输出
```

在这种方法中，上轨是快乐路径，下轨是失败路径。你从成功轨道出发，若一切顺利就一路走到终点。但若有错误，会被切换到失败轨道，绕过管道中剩余的步骤。

这看起来不错，但有个大问题：我们无法把这些生成 Result 的函数组合在一起，因为双轨输出的类型与单轨输入的类型不同：

```
Result<A, E> 无法直接传给 (A -> Result<B, E>)
```

如何解决？如何把双轨输出接到单轨输入？观察一下：若第二个函数有双轨输入，连接它们就没有问题：

```
Result<A, E> ──> (Result<A, E> -> Result<B, E>) 可以工作
```

因此，我们需要把「开关」函数——一个输入、两个输出——转换为双轨函数。为此，创建一个特殊的「适配器块」，其中有一个槽位放开关函数，将其转换为双轨函数：

```
┌─────────────────────────────────┐
│  适配器块                        │
│  ┌─────────────────────────┐   │
│  │ 槽位：开关函数            │   │
│  │ 输入 ──> 成功/失败        │   │
│  └─────────────────────────┘   │
│  双轨输入 ──> 双轨输出          │
└─────────────────────────────────┘
```

若把所有步骤都转换为双轨函数，转换后就可以很好地组合它们：

```
输入 ──> [适配器+步骤1] ──> [适配器+步骤2] ──> [适配器+步骤3] ──> 双轨输出
```

最终得到一条双轨管道，有「成功」轨和「失败」轨，正是我们想要的。

### 10.3.1 实现适配器块

我们在第 170 页讨论过「函数适配器」的概念。将开关函数转换为双轨函数的适配器是函数式编程工具包中非常重要的一种——在 FP 术语中通常称为 **bind** 或 **flatMap**。实现起来出人意料地简单。逻辑如下：

- 输入是一个「开关」函数。输出是一个新的、仅双轨的函数，表示为一个 lambda，具有双轨输入和双轨输出。
- 若双轨输入是成功，则把该输入传给开关函数。开关函数的输出已是双轨值，无需进一步处理。
- 若双轨输入是失败，则绕过开关函数，直接返回失败。

代码实现如下：

```fsharp
let bind switchFn =
    fun twoTrackInput ->
        match twoTrackInput with
        | Ok success -> switchFn success
        | Error failure -> Error failure
```

另一种等价但更常见的实现是让 `bind` 接受两个输入参数——「开关」函数和一个双轨值（`Result`）——并去掉 lambda：

```fsharp
let bind switchFn twoTrackInput =
    match twoTrackInput with
    | Ok success -> switchFn success
    | Error failure -> Error failure
```

两种实现等价：第二种在柯里化后与第一种相同（见第 152 页《柯里化》）。

另一个有用的适配器块是把单轨函数转换为双轨函数：

```
┌─────────────────────────────────┐
│  适配器块                        │
│  ┌─────────────────────────┐   │
│  │ 槽位：单轨函数            │   │
│  │ A ──> B                  │   │
│  └─────────────────────────┘   │
│  Result<A,E> ──> Result<B,E>    │
└─────────────────────────────────┘
```

在 FP 术语中通常称为 **map**。逻辑如下：

- 输入是一个单轨函数和一个双轨值（`Result`）。
- 若输入 `Result` 是成功，则把输入传给单轨函数，并将输出包装在 `Ok` 中使其再次成为 `Result`（因为输出需要是双轨的）。
- 若输入 `Result` 是失败，则像之前一样绕过函数。

代码实现如下：

```fsharp
let map f aResult =
    match aResult with
    | Ok success -> Ok (f success)
    | Error failure -> Error failure
```

有了 `bind`、`map` 以及少数类似函数，我们就有了强大的工具包，可以组合各种不匹配的函数。

### 10.3.2 组织 Result 函数

这些新函数应放在代码组织的哪里？标准做法是放在与类型同名的模块中，本例中即 `Result`。该模块大致如下：

```fsharp
/// 定义 Result 类型
type Result<'Success,'Failure> =
    | Ok of 'Success
    | Error of 'Failure

/// 与 Result 协作的函数
module Result =
    let bind f aResult = ...
    let map f aResult = ...
```

由于 `Result` 及其相关函数在领域各处使用，我们通常创建一个新的工具模块（如 `Result.fs`），并将其放在项目结构中领域类型之前。

### 10.3.3 组合与类型检查

我们一直专注于通过把「开关」函数转换为「双轨」函数来让函数的「形状」匹配。但类型检查也在进行，因此需要确保类型也匹配，组合才能工作。

在成功分支上，类型可以沿轨道变化，只要某一步的输出类型与下一步的输入类型匹配。例如，下面三个函数可以用 `bind` 在管道中组合，因为 `FunctionA` 的输出（`Bananas`）与 `FunctionB` 的输入匹配，`FunctionB` 的输出（`Cherries`）与 `FunctionC` 的输入匹配：

```fsharp
type FunctionA = Apple -> Result<Bananas,...>
type FunctionB = Bananas -> Result<Cherries,...>
type FunctionC = Cherries -> Result<Lemon,...>
```

`bind` 函数会这样使用：

```fsharp
let functionA : FunctionA = ...
let functionB : FunctionB = ...
let functionC : FunctionC = ...

let functionABC input =
    input
    |> functionA
    |> Result.bind functionB
    |> Result.bind functionC
```

另一方面，`FunctionA` 和 `FunctionC` 无法直接组合，即使用 `bind` 也不行，因为类型不同。

### 10.3.4 转换为通用错误类型

与成功轨道不同——成功轨道的类型在每步可以变化——失败轨道从头到尾具有统一的类型。也就是说，管道中的每个函数必须有相同的错误类型。

在许多情况下，这意味着需要调整错误类型以使它们彼此兼容。为此，创建一个与 `map` 类似、但作用于失败轨道中值的函数。该函数称为 **mapError**，实现如下：

```fsharp
let mapError f aResult =
    match aResult with
    | Ok success -> Ok success
    | Error failure -> Error (f failure)
```

例如，假设我们有 `AppleError` 和 `BananaError`，以及两个使用它们作为错误类型的函数：

```fsharp
type FunctionA = Apple -> Result<Bananas,AppleError>
type FunctionB = Bananas -> Result<Cherries,BananaError>
```

错误类型不匹配意味着 `FunctionA` 和 `FunctionB` 无法组合。我们需要做的是创建一个新类型，使 `AppleError` 和 `BananaError` 都能转换为它——即两者的选择。我们称其为 `FruitError`：

```fsharp
type FruitError =
    | AppleErrorCase of AppleError
    | BananaErrorCase of BananaError
```

然后可以这样把 `functionA` 转换为以 `FruitError` 为结果类型：

```fsharp
let functionA : FunctionA = ...

let functionAWithFruitError input =
    input
    |> functionA
    |> Result.mapError (fun appleError -> AppleErrorCase appleError)
```

可简化为：

```fsharp
let functionAWithFruitError input =
    input
    |> functionA
    |> Result.mapError AppleErrorCase
```

转换的图示如下：

```
AppleError  ──mapError──>  FruitError
```

若比较 `functionA` 和 `functionAWithFruitError` 的签名，可以看到它们在错误情况下现在有不同的类型，正是我们想要的：

```fsharp
// functionA 的类型
Apple -> Result<Bananas,AppleError>

// functionAWithFruitError 的类型
Apple -> Result<Bananas,FruitError>
```

同样，我们也可以把 `functionB` 的错误情况从 `BananaError` 转换为 `FruitError`。组合起来，代码大致如下：

```fsharp
let functionA : FunctionA = ...
let functionB : FunctionB = ...

// 将 functionA 转换为使用 "FruitError"
let functionAWithFruitError input =
    input |> functionA |> Result.mapError AppleErrorCase

// 将 functionB 转换为使用 "FruitError"
let functionBWithFruitError input =
    input |> functionB |> Result.mapError BananaErrorCase

// 现在可以用 "bind" 组合新版本
let functionAB input =
    input
    |> functionAWithFruitError
    |> Result.bind functionBWithFruitError
```

组合后的 `functionAB` 的签名是：

```fsharp
val functionAB : Apple -> Result<Cherries,FruitError>
```

## 10.4 在管道中使用 bind 和 map

概念已经清楚，现在付诸实践。我们将用生成错误的函数组合工作流管道，必要时调整它们以使其契合。

先快速回顾管道的组成部分，暂时只关注 `Result`，忽略 `Async` 效应和服务依赖。

首先，`ValidateOrder` 在输入数据格式不正确时会返回错误，因此是「开关」函数，签名如下：

```fsharp
type ValidateOrder =
    // 暂时忽略额外依赖
    UnvalidatedOrder                    // 输入
    -> Result<ValidatedOrder, ValidationError>  // 输出
```

`PriceOrder` 步骤也可能因多种原因失败，其签名为：

```fsharp
type PriceOrder =
    ValidatedOrder                      // 输入
    -> Result<PricedOrder, PricingError>       // 输出
```

`AcknowledgeOrder` 和 `CreateEvents` 步骤总是成功，其签名为：

```fsharp
type AcknowledgeOrder =
    PricedOrder                         // 输入
    -> OrderAcknowledgmentSent option  // 输出

type CreateEvents =
    PricedOrder                         // 输入
    -> OrderAcknowledgmentSent option  // 输入（上一步的事件）
    -> PlaceOrderEvent list             // 输出
```

先从组合 `ValidateOrder` 和 `PriceOrder` 开始。`ValidateOrder` 的失败类型是 `ValidationError`，`PriceOrder` 的失败类型是 `PricingError`。如上所述，由于错误类型不同，这两个函数不兼容。

需要把两个函数都转换为返回相同的错误类型——管道中使用的通用错误类型，我们称之为 `PlaceOrderError`。`PlaceOrderError` 定义如下：

```fsharp
type PlaceOrderError =
    | Validation of ValidationError
    | Pricing of PricingError
```

现在，通过使用 `mapError`，可以定义可组合的 `validateOrder` 和 `priceOrder` 的新版本，就像上面 `FruitError` 的例子一样：

```fsharp
// 适配为返回 PlaceOrderError
let validateOrderAdapted input =
    input
    |> validateOrder  // 原始函数
    |> Result.mapError PlaceOrderError.Validation

// 适配为返回 PlaceOrderError
let priceOrderAdapted input =
    input
    |> priceOrder  // 原始函数
    |> Result.mapError PlaceOrderError.Pricing
```

完成后，最终可以用 `bind` 链式调用它们：

```fsharp
let placeOrder unvalidatedOrder =
    unvalidatedOrder
    |> validateOrderAdapted   // 适配版本
    |> Result.bind priceOrderAdapted  // 适配版本
```

注意 `validateOrderAdapted` 前面不需要 `bind`，因为它是管道中的第一个。

接下来，`acknowledgeOrder` 和 `createEvents` 没有错误——它们是「单轨」函数——因此可以用 `Result.map` 将它们转换为可放入管道的双轨函数：

```fsharp
let placeOrder unvalidatedOrder =
    unvalidatedOrder
    |> validateOrderAdapted
    |> Result.bind priceOrderAdapted
    |> Result.map acknowledgeOrder  // 用 map 转换为双轨
    |> Result.map createEvents      // 转换为双轨
```

这个 `placeOrder` 函数的签名是：

```fsharp
UnvalidatedOrder -> Result<PlaceOrderEvent list,PlaceOrderError>
```

非常接近我们需要的。

分析这个新版本的工作流管道：

- 管道中的每个函数都可以生成错误，其可能产生的错误在签名中表明。我们可以隔离测试这些函数，确信组装时不会出现意外行为。
- 函数仍然链式连接，但现在是双轨模型。某一步的错误会导致管道中剩余函数被跳过。
- 顶层 `placeOrder` 的整体流程仍然清晰。没有特殊条件判断或 try/catch 块。

遗憾的是，这个 `placeOrder` 实现实际上无法编译！即使用了 `bind` 和 `map`，函数也并不总能契合。具体来说，`acknowledgeOrder` 的输出与 `createEvents` 的输入不匹配，因为输出只是事件，而不是定价订单。我们稍后会看到如何解决这个问题。

## 10.5 将其他函数适配到双轨模型

到目前为止，我们在管道中见过两种函数「形状」：单轨函数和「开关」函数。但当然我们可能需要与许多其他类型的函数协作。现在看其中两种：

- 抛出异常的函数
- 不返回任何东西的「死端」函数

### 10.5.1 处理异常

我们避免了在代码中抛出异常，但那些不由我们控制的代码（如库或服务）抛出的异常呢？

之前我们建议，许多异常不属于领域设计，除了在顶层外无需捕获。但若我们确实想把异常当作领域的一部分，该怎么做？

解决方案很直接——可以再创建一个「适配器块」函数，把抛出异常的函数转换为返回 `Result` 的函数，如下图所示：

```
┌─────────────────────────────────┐
│  适配器块                        │
│  ┌─────────────────────────┐   │
│  │ 槽位：可能抛异常的函数    │   │
│  │ try/catch 包裹           │   │
│  └─────────────────────────┘   │
│  输入 ──> Result<输出, 错误>    │
└─────────────────────────────────┘
```

例如，假设我们想捕获远程服务的超时并将其转为 `RemoteServiceError`。我们会与许多服务打交道，所以先定义 `ServiceInfo` 来跟踪导致错误的服务：

```fsharp
type ServiceInfo = {
    Name : string
    Endpoint: Uri
}
```

然后可以定义一个基于此的错误类型：

```fsharp
type RemoteServiceError = {
    Service : ServiceInfo
    Exception : System.Exception
}
```

我们把服务信息和原始服务函数传给一个适配器块，该块捕获部分异常并在这些情况下返回 `Result`。下面是服务函数接受单个参数（代码中的 `x`）时的例子：

```fsharp
/// 将抛出异常的服务转换为返回 Result 的服务的「适配器块」
let serviceExceptionAdapter serviceInfo serviceFn x =
    try
        Ok (serviceFn x)
    with
    | :? TimeoutException as ex ->
        Error {Service=serviceInfo; Exception=ex}
    | :? AuthorizationException as ex ->
        Error {Service=serviceInfo; Exception=ex}
```

注意我们并非捕获所有可能的异常，只捕获与领域相关的那些。

若服务函数有两个参数，需要定义另一个适配器支持该情况，以此类推：

```fsharp
let serviceExceptionAdapter2 serviceInfo serviceFn x y =
    try
        Ok (serviceFn x y)
    with
    | :? TimeoutException as ex -> ...
    | :? AuthorizationException as ex -> ...
```

这些是通用适配器块，可以适配任何函数。在某些情况下，你可能更倾向于为特定服务使用自定义适配器块，例如把数据库异常转换为带有「记录未找到」「重复键」等领域友好分支的 `DatabaseError` 选择类型。

要使用这个适配器，我们创建 `ServiceInfo`，然后传入服务函数。例如，若服务函数是地址检查函数，代码大致如下：

```fsharp
let serviceInfo = {
    Name = "AddressCheckingService"
    Endpoint = ...
}

// 抛出异常的服务
let checkAddressExists address =
    ...

// 返回 Result 的服务
let checkAddressExistsR address =
    let adaptedService =
        serviceExceptionAdapter serviceInfo checkAddressExists
    adaptedService address
```

为明确新函数是返回 `Result` 的变体，我们将其命名为 `checkAddressExistsR`，末尾加 `R`。（在实际代码中，你可能会直接给它与原始函数相同的名字——「遮蔽」它）。

再检查一下签名，确保符合预期。原始函数表明它总是返回 `CheckedAddress`：

```fsharp
checkAddressExists : UnvalidatedAddress -> CheckedAddress
```

但我们知道该签名具有误导性。若看新「适配」函数的签名，会发现它更具描述性，表明可能失败并返回错误：

```fsharp
checkAddressExistsR : UnvalidatedAddress -> Result<CheckedAddress,RemoteServiceError>
```

错误类型是 `RemoteServiceError`，因此若要在管道中使用该函数，需要在 `PlaceOrderError` 类型中为远程错误添加一个分支：

```fsharp
type PlaceOrderError =
    | Validation of ValidationError
    | Pricing of PricingError
    | RemoteService of RemoteServiceError  // 新增！
```

然后在创建该函数的 R 版本时，必须把 `RemoteServiceError` 转换为共享的 `PlaceOrderError`，就像之前做的那样：

```fsharp
let checkAddressExistsR address =
    let adaptedService =
        serviceExceptionAdapter serviceInfo checkAddressExists
    address
    |> adaptedService
    |> Result.mapError RemoteService  // 提升为 PlaceOrderError
```

### 10.5.2 处理死端函数

另一种常见类型是所谓的「死端」或「发射后不管」函数：接受输入但不返回任何输出的函数。这类函数大多以某种方式写入 I/O。例如，下面的日志函数没有输出：

```fsharp
// string -> unit
let logError msg =
    printfn "ERROR %s" msg
```

其他例子包括写入数据库、投递到队列等。

要让死端函数与双轨管道协作，需要另一个适配器块。要构造它，首先需要一种方式：用输入调用死端函数，然后返回原始输入——一个「透传」函数。我们称其为 **tee**：

```
死端函数
    │
    ▼
主流程 ──> Tee ──> 透传后的函数（输出 = 输入）
```

代码如下：

```fsharp
// ('a -> unit) -> ('a -> 'a)
let tee f x =
    f x
    x
```

签名表明它接受任何返回 `unit` 的函数，并产生一个单轨函数。

然后可以用 `Result.map` 把 `tee` 的输出转换为双轨函数：

```fsharp
// ('a -> unit) -> (Result<'a,'error> -> Result<'a,'error>)
let adaptDeadEnd f =
    Result.map (tee f)
```

这样我们就可以把像 `logError` 这样的死端函数转换为可放入管道的双轨函数。

```
死端函数 ──> 适配器块 ──> 适配后的函数
主流程 ──────────────> 主流程（死端输出未使用）
```

## 10.6 用计算表达式简化

到目前为止，我们一直在处理相对直接的错误处理逻辑。我们能用 `bind` 链式连接生成 `Result` 的函数；对于那些不是双轨的函数，我们能用各种「适配器」函数使它们符合双轨模型。

但有时工作流逻辑更复杂。你可能需要在条件分支内工作，或循环，或与深层嵌套的生成 `Result` 的函数协作。在这些情况下，F# 以「计算表达式（computation expressions）」的形式提供了一些缓解。计算表达式是一种特殊的表达式块，在幕后隐藏了 `bind` 的繁琐。

创建自己的计算表达式很容易。例如，我们可以为 `Result` 创建一个名为 `result`（小写）的。入门只需要两个函数：

- **bind**，我们已在 `Result` 中见过
- **return**，仅构造一个值——对 `Result` 而言，就是 `Ok` 构造器

我们这里不展示 `result` 计算表达式的实现细节——你可以在本书代码仓库的 `Result.fs` 文件中查看。相反，看看计算表达式在实践中如何简化充满 `Result` 的代码。

在 `placeOrder` 的早期版本中，我们用 `bind` 把返回 `Result` 的 `validateOrder` 的输出连接到 `priceOrder` 的输入，像这样：

```fsharp
let placeOrder unvalidatedOrder =
    unvalidatedOrder
    |> validateOrderAdapted
    |> Result.bind priceOrderAdapted
    |> Result.map acknowledgeOrder
    |> Result.map createEvents
```

然而，使用计算表达式时，我们可以直接使用 `validateOrder` 和 `priceOrder` 的输出，就好像它们没有被包装在 `Result` 中一样。下面是使用计算表达式的相同代码：

```fsharp
let placeOrder unvalidatedOrder =
    result {
        let! validatedOrder =
            validateOrder unvalidatedOrder
            |> Result.mapError PlaceOrderError.Validation
        let! pricedOrder =
            priceOrder validatedOrder
            |> Result.mapError PlaceOrderError.Pricing
        let acknowledgmentOption =
            acknowledgeOrder pricedOrder
        let events =
            createEvents pricedOrder acknowledgmentOption
        return events
    }
```

看看这段代码如何工作：

- `result` 计算表达式以 `result` 开头，然后包含花括号界定的块。
- 特殊的 `let!` 关键字看起来像 `let`，但实际上会「解包」结果以获取内部值。`let! validatedOrder = ...` 中的 `validatedOrder` 是普通值，可以直接传给 `priceOrder` 函数。
- 错误类型在整个块中必须相同，因此像之前一样用 `Result.mapError` 把错误类型提升为通用类型。错误在 `result` 表达式中不显式出现，但它们的类型仍需匹配。
- 块中最后一行使用 `return` 关键字，表示整个块的值。

实践中，在所有原本会用 `bind` 的地方都用 `let!`。对于不需要 `bind` 的其他函数，如 `acknowledgeOrder`，直接用普通语法即可——不需要用 `Result.map`。

如你所见，计算表达式让代码看起来好像根本没有使用 `Result`。它很好地隐藏了复杂性。

我们不会深入如何定义计算表达式，但相当直接。例如，下面是上面使用的 `result` 计算表达式的基本定义：

```fsharp
type ResultBuilder() =
    member this.Return(x) = Ok x
    member this.Bind(x,f) = Result.bind f x

let result = ResultBuilder()
```

本书后面还会看到更多计算表达式，尤其是用于以同样优雅的方式管理异步回调的 `async` 计算表达式。

### 10.6.1 组合计算表达式

计算表达式的一个吸引人之处在于它们可组合，这是我们始终追求的品质。

例如，假设 `validateOrder` 和 `priceOrder` 是用 `result` 计算表达式定义的：

```fsharp
let validateOrder input = result {
    let! validatedOrder = ...
    return validatedOrder
}

let priceOrder input = result {
    let! pricedOrder = ...
    return pricedOrder
}
```

那么它们可以在更大的 `result` 表达式中使用，就像普通函数一样：

```fsharp
let placeOrder unvalidatedOrder = result {
    let! validatedOrder = validateOrder unvalidatedOrder
    let! pricedOrder = priceOrder validatedOrder
    ...
    return ...
}
```

而 `placeOrder` 又可以用于更大的 `result` 表达式中，以此类推。

### 10.6.2 使用 Result 验证订单

现在可以重新审视 `validateOrder` 的实现，这次使用 `result` 计算表达式来隐藏错误处理逻辑。

提醒一下，下面是不使用任何 `Result` 的实现：

```fsharp
let validateOrder : ValidateOrder =
    fun checkProductCodeExists checkAddressExists unvalidatedOrder ->
        let orderId =
            unvalidatedOrder.OrderId
            |> OrderId.create
        let customerInfo =
            unvalidatedOrder.CustomerInfo
            |> toCustomerInfo
        let shippingAddress =
            unvalidatedOrder.ShippingAddress
            |> toAddress checkAddressExists
        let billingAddress = ...
        let lines = ...
        let validatedOrder : ValidatedOrder = {
            OrderId = orderId
            CustomerInfo = customerInfo
            ShippingAddress = shippingAddress
            BillingAddress = billingAddress
            Lines = lines
        }
        validatedOrder
```

但当把所有辅助函数改为返回 `Result` 时，这段代码就不再有效。例如，`OrderId.create` 会返回 `Result<OrderId,string>`，而不是普通的 `OrderId`（`toCustomerInfo`、`toAddress` 等同理）。然而，若使用 `result` 计算表达式并用 `let!` 而非 `let`，就可以把 `OrderId`、`CustomerInfo` 等当作普通值访问。下面是现在的实现：

```fsharp
let validateOrder : ValidateOrder =
    fun checkProductCodeExists checkAddressExists unvalidatedOrder ->
        result {
            let! orderId =
                unvalidatedOrder.OrderId
                |> OrderId.create
                |> Result.mapError ValidationError
            let! customerInfo =
                unvalidatedOrder.CustomerInfo
                |> toCustomerInfo
            let! shippingAddress = ...
            let! billingAddress = ...
            let! lines = ...
            let validatedOrder : ValidatedOrder = {
                OrderId = orderId
                CustomerInfo = customerInfo
                ShippingAddress = shippingAddress
                BillingAddress = billingAddress
                Lines = lines
            }
            return validatedOrder
        }
```

不过，仍需用 `Result.mapError` 确保所有错误类型匹配。`OrderId.create` 在错误情况下返回 `string`，因此必须用 `mapError` 将其提升为 `ValidationError`。其他辅助函数在处理简单类型时也需要做同样的事。我们假设 `toCustomerInfo` 和 `toAddress` 的输出已经是 `ValidationError`，因此不需要对它们使用 `mapError`。

### 10.6.3 处理 Result 列表

当我们最初不使用 `Result` 类型验证订单行时，可以直接用 `List.map` 转换每一行：

```fsharp
let validateOrder unvalidatedOrder =
    ...
    let lines =
        unvalidatedOrder.Lines
        |> List.map (toValidatedOrderLine checkProductCodeExists)
    let validatedOrder : ValidatedOrder = {
        ...
        Lines = lines
    }
    validatedOrder
```

但当 `toValidatedOrderLine` 返回 `Result` 时，这种方法不再有效。使用 `map` 后，我们得到的是 `Result<ValidatedOrderLine,...>` 的列表，而不是 `ValidatedOrderLine` 的列表。

这对我们毫无帮助：设置 `ValidatedOrder.Lines` 的值时，我们需要的是「list 的 Result」，而不是「Result 的 list」。

```fsharp
let validateOrder unvalidatedOrder =
    ...
    let lines =  // lines 是「Result 的 list」
        unvalidatedOrder.Lines
        |> List.map (toValidatedOrderLine checkProductCodeExists)
    let validatedOrder : ValidatedOrder = {
        ...
        Lines = lines  // 编译错误
        // ^ 这里期望的是「list 的 Result」
    }
    ...
```

使用 `result` 表达式也帮不上忙——问题是类型不匹配。所以现在的问题是：如何把「Result 的 list」转换为「list 的 Result」？

创建一个辅助函数来完成这件事：它会遍历 Result 列表，若有任何一个失败，整体结果就是该错误。否则，若全部成功，整体结果就是所有成功的列表。

实现的关键是记住，在 F# 中，标准 list 类型是链表，通过把每个元素 prepend 到更小的列表上构建。要解决我们的问题，首先需要一个新版本的 prepend 操作（在 FP 世界中也称为「cons」操作符），它把一个包含单个元素的 `Result` prepend 到一个包含元素列表的 `Result` 上。实现很直接：

- 若两个参数都是 `Ok`，prepend 内容并将结果列表包装回 `Result`。
- 否则，若任一参数是 `Error`，返回该错误。

代码如下：

```fsharp
/// 将 Result<item> prepend 到 Result<list>
let prepend firstR restR =
    match firstR, restR with
    | Ok first, Ok rest -> Ok (first::rest)
    | Error err1, Ok _ -> Error err1
    | Ok _, Error err2 -> Error err2
    | Error err1, Error _ -> Error err1
```

若看这个 `prepend` 函数的类型签名，会发现它完全泛型：接受 `Result<'a>` 和 `Result<'a list>`，并将它们组合成新的 `Result<'a list>`。

有了它，我们可以通过从最后一个开始遍历列表（使用 `foldBack`），然后把每个 `Result` 元素 prepend 到目前构建的列表上，从 `Result<'a>` 列表构建出 `Result<'a list>`。我们称这个函数为 **sequence**，并将其作为另一个有用函数加入 `Result` 模块。实现如下：

```fsharp
let sequence aListOfResults =
    let initialValue = Ok []  // Result 内的空列表
    List.foldBack prepend aListOfResults initialValue
```

不必太担心这段代码如何工作。一旦写好并纳入你的库，你只需要知道如何以及何时使用它！

定义一个 `Result` 类型来试验（我们称其为 `IntOrError`），然后用成功列表测试 `sequence`：

```fsharp
type IntOrError = Result<int,string>

let listOfSuccesses : IntOrError list = [Ok 1; Ok 2]
let successResult =
    Result.sequence listOfSuccesses  // Ok [1; 2]
```

可以看到，Result 的列表（`[Ok 1; Ok 2]`）已被转换为包含列表的 Result（`Ok [1; 2]`）。

用失败列表试试：

```fsharp
let listOfErrors : IntOrError list = [ Error "bad"; Error "terrible" ]
let errorResult =
    Result.sequence listOfErrors  // Error "bad"
```

得到另一个 `Result`，但这次包含错误（`Error "bad"`）。

在失败例子中，只返回了第一个错误。但在许多情况下，我们希望保留所有错误，尤其是在做验证时。实现这一点的函数式编程技术称为 **applicative**。我们会在下一节简要提及，但本书不会讨论详细实现。

有了 `Result.sequence`，我们终于可以写出构造 `ValidatedOrder` 的代码：

```fsharp
let validateOrder : ValidateOrder =
    fun checkProductCodeExists checkAddressExists unvalidatedOrder ->
        result {
            let! orderId = ...
            let! customerInfo = ...
            let! shippingAddress = ...
            let! billingAddress = ...
            let! lines =
                unvalidatedOrder.Lines
                |> List.map (toValidatedOrderLine checkProductCodeExists)
                |> Result.sequence  // 将 Result 的 list 转换为单个 Result
            let validatedOrder : ValidatedOrder = {
                OrderId = orderId
                CustomerInfo = customerInfo
                ShippingAddress = shippingAddress
                BillingAddress = billingAddress
                Lines = lines
            }
            return validatedOrder
        }
```

若关心性能，`List.map` 后接 `Result.sequence` 可以通过合并为通常称为 **traverse** 的单个函数来优化，但我们不在此展开。

我们快完成了，但还有最后一个问题。`validateOrder` 的输出在错误情况下是 `ValidationError` 类型。然而在主管道中，我们需要错误情况是 `PlaceOrderError`。因此，在 `placeOrder` 函数中，需要把类型 `Result<ValidatedOrder,ValidationError>` 转换为 `Result<ValidatedOrder,PlaceOrderError>`。像之前一样，可以用 `mapError` 转换错误值的类型。同样，也需要把 `priceOrder` 的输出从 `PricingError` 转换为 `PlaceOrderError`。

下面是使用 `mapError` 的完整工作流实现：

```fsharp
let placeOrder : PlaceOrder =
    fun unvalidatedOrder ->
        result {
            let! validatedOrder =
                validateOrder checkProductExists checkAddressExists unvalidatedOrder
                |> Result.mapError PlaceOrderError.Validation
            let! pricedOrder =
                priceOrder getProductPrice validatedOrder
                |> Result.mapError PlaceOrderError.Pricing
            let acknowledgmentOption = ...
            let events = ...
            return events
        }
```

输出现在是 `Result<ValidatedOrder,PlaceOrderError>`，正是我们想要的。

## 10.7 单子与更多

本书尽量避免过多行话，但函数式编程中有一个词经常出现：**单子（monad）**。所以让我们暂停一下，简单聊聊单子。这个词以吓人著称，但实际上我们在本章已经创建并使用了一个！

单子只是一种编程模式，允许你串联链式连接「单子式」函数。那么什么是「单子式」函数？它是接受「普通」值并返回某种「增强」值的函数。在本章发展的错误处理方法中，「增强」值是包装在 `Result` 类型中的东西，因此单子式函数正是我们一直在用的那种生成 `Result` 的「开关」函数。

从技术上讲，「单子」只是具有三个组成部分的事物的术语：

- 一个数据结构
- 一些相关函数
- 关于这些函数必须如何工作的规则

在我们这里，数据结构是 `Result` 类型。

要成为单子，数据类型还必须有两个相关函数：`return` 和 `bind`：

- **return**（也称为 pure）是把普通值变为单子类型的函数。由于我们使用的类型是 `Result`，`return` 函数就是 `Ok` 构造器。
- **bind**（也称为 flatMap）是让你链式连接单子式函数（在我们这里是生成 `Result` 的函数）的函数。我们在本章前面看到了如何为 `Result` 实现 `bind`。

关于这些函数应如何工作的规则称为「单子定律」，听起来吓人，但实际上是确保实现正确、不做奇怪事情的常识性准则。这里不展开单子定律——你可以在网上轻松找到。

所以，单子就是这么回事。希望你能看出它并不像你想象的那么神秘。

### 10.7.1 用 Applicative 并行组合

既然说到这里，也聊聊一个相关模式：**Applicative**。Applicative 与单子类似；但单子是串联链式连接单子式函数，而 applicative 允许你并行组合单子式值。

例如，若需要做验证，我们可能会用 applicative 方法组合所有错误，而不是只保留第一个。遗憾的是，本书没有篇幅深入细节，但 fsharpforfunandprofit.com 上有详细讨论。

本书不会过多使用 monad 或 applicative 这些术语，但现在若你遇到它们，至少知道它们的意思。

### 10.7.2 术语提醒

供参考，本章引入的术语如下：

- 在错误处理上下文中，**bind** 函数把生成 `Result` 的函数转换为双轨函数。它用于「串联」链式连接生成 `Result` 的函数。更一般地说，bind 是单子的关键组成部分。
- 在错误处理上下文中，**map** 函数把单轨函数转换为双轨函数。
- **单子式组合**指使用 bind 串联组合函数。
- **Applicative 式组合**指并行组合结果。

## 10.8 添加 Async 效应

在原始设计中，我们不仅使用了错误效应（`Result`）。在管道的大部分中，我们还使用了 async 效应。组合效应通常很棘手，但由于这两种效应经常一起出现，我们会定义一个 `asyncResult` 计算表达式，与之前定义的 `AsyncResult` 类型配套。这里不展示实现，但你可以在本书代码仓库中找到。

使用 `asyncResult` 与使用 `result` 一样。例如，`validateOrder` 的实现如下：

```fsharp
let validateOrder : ValidateOrder =
    fun checkProductCodeExists checkAddressExists unvalidatedOrder ->
        asyncResult {
            let! orderId =
                unvalidatedOrder.OrderId
                |> OrderId.create
                |> Result.mapError ValidationError
                |> AsyncResult.ofResult  // 将 Result 提升为 AsyncResult
            let! customerInfo =
                unvalidatedOrder.CustomerInfo
                |> toCustomerInfo
                |> AsyncResult.ofResult
            let! checkedShippingAddress =
                unvalidatedOrder.ShippingAddress
                |> toCheckedAddress checkAddressExists
            let! shippingAddress =
                checkedShippingAddress
                |> toAddress
                |> AsyncResult.ofResult
            let! billingAddress = ...
            let! lines =
                unvalidatedOrder.Lines
                |> List.map (toValidatedOrderLine checkProductCodeExists)
                |> Result.sequence
                |> AsyncResult.ofResult
            let validatedOrder : ValidatedOrder = {
                OrderId = orderId
                CustomerInfo = customerInfo
                ShippingAddress = shippingAddress
                BillingAddress = billingAddress
                Lines = lines
            }
            return validatedOrder
        }
```

除了把 `result` 换成 `asyncResult`，还需要确保现在一切都是 `AsyncResult`。例如，`OrderId.create` 的输出只是 `Result`，因此必须用辅助函数 `AsyncResult.ofResult` 将其「提升」为 `AsyncResult`。

我们还把地址验证拆成了两部分。原因是当我们把所有效应加回去时，`CheckAddressExists` 函数返回 `AsyncResult`：

```fsharp
type CheckAddressExists =
    UnvalidatedAddress -> AsyncResult<CheckedAddress,AddressValidationError>
```

其错误类型与工作流不匹配，因此创建一个辅助函数（`toCheckedAddress`）来处理该结果，并把服务特定的错误（`AddressValidationError`）映射为我们自己的 `ValidationError`：

```fsharp
/// 调用 checkAddressExists 并将错误转换为 ValidationError
let toCheckedAddress (checkAddress:CheckAddressExists) address =
    address
    |> checkAddress
    |> AsyncResult.mapError (fun addrError ->
        match addrError with
        | AddressNotFound -> ValidationError "Address not found"
        | InvalidFormat -> ValidationError "Address has bad format"
    )
```

`toCheckedAddress` 的输出仍然返回包装 `CheckedAddress` 的 `AsyncResult`，因此我们用 `let!` 解包为 `checkedAddress` 值，然后可以按通常方式传给验证阶段（`toAddress`）。

把主 `placeOrder` 函数转换为使用 `asyncResult` 也很直接：

```fsharp
let placeOrder : PlaceOrder =
    fun unvalidatedOrder ->
        asyncResult {
            let! validatedOrder =
                validateOrder checkProductExists checkAddressExists unvalidatedOrder
                |> AsyncResult.mapError PlaceOrderError.Validation
            let! pricedOrder =
                priceOrder getProductPrice validatedOrder
                |> AsyncResult.ofResult
                |> AsyncResult.mapError PlaceOrderError.Pricing
            let acknowledgmentOption = ...
            let events = ...
            return events
        }
```

管道其余代码可以用同样方式转换为使用 `asyncResult`，这里不展示。你可以在代码仓库中看到完整实现。

## 本章小结

我们完成了管道的修订实现，融入了类型安全的错误处理和 async 效应。上面的主 `placeOrder` 实现仍然相当清晰，没有丑陋的错误处理代码打断流程。是的，我们确实做了一些笨拙的转换来让所有类型正确对齐，但这份额外努力换来了信心：所有管道组件将无缝协作。

接下来几章，我们将实现领域与外部世界的交互：如何序列化和反序列化数据，以及如何将状态持久化到数据库。

---

[← 上一章：组合管道](ch09-composing-a-pipeline.md) | [返回目录](../index.md) | [下一章：序列化 →](ch11-serialization.md)
