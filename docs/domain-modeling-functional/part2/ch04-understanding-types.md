# 第4章：理解类型

> 在第二章中，我们捕获了接单系统单一工作流的领域驱动需求。接下来的挑战是将这些非形式化的需求转化为可编译的代码。我们将采用 F# 的「代数类型系统」（algebraic type system）来表示需求。本章将学习什么是代数类型、如何定义和使用它们，以及它们如何表示领域模型。下一章则运用所学，准确建模下单工作流。

---

## 4.1 理解函数

在理解类型之前，我们需要先理解函数式编程中最基本的概念——**函数**（function）。

如果你还记得高中数学，函数就是一种有输入和输出的黑盒。可以把它想象成一段铁轨，上面有一座「转换隧道」：东西进去，经过某种变换，从另一端出来。

```text
    输入 ──► [ 转换隧道 ] ──► 输出
```

例如，假设某个函数把苹果变成香蕉。我们通过写下输入和输出（用箭头分隔）来描述一个函数，如下图所示：

```text
    apple ──► [ 函数 ] ──► banana
```

### 4.1.1 类型签名

这种 `apple -> banana` 的描述称为**类型签名**（type signature），也叫**函数签名**（function signature）。这个签名很简单，但类型签名可以非常复杂。理解和使用类型签名是 F# 编程的关键部分，因此我们要确保掌握它们。

下面是两个函数：`add1` 给单个输入 `x` 加 1，`add` 将两个输入 `x` 和 `y` 相加：

```fsharp
let add1 x = x + 1 // signature is: int -> int
let add x y = x + y // signature is: int -> int -> int
```

可以看到，`let` 关键字用于定义函数。参数用空格分隔，不需要括号或逗号。与 C# 或 Java 不同，没有 `return` 关键字。函数定义中的最后一个表达式就是函数的输出。

尽管 F# 关心输入和输出的类型，但在大多数情况下你很少需要显式声明它们，因为编译器会自动推断类型。

- 对于 `add1`，`x` 的推断类型（箭头前）是 `int`，输出的推断类型（箭头后）也是 `int`，因此类型签名是 `int -> int`。
- 对于 `add`，`x` 和 `y` 的推断类型是 `int`，输出的推断类型（最后一个箭头后）也是 `int`。`add` 有两个参数，每个参数之间用箭头分隔，因此类型签名是 `int -> int -> int`。

如果使用 Visual Studio 等 IDE，将鼠标悬停在函数定义上会显示其类型签名；由于这是书本，我们会在需要说明时在定义上方用注释写出类型签名。这只是注释，编译器不会使用。

多行函数用缩进书写（类似 Python），没有花括号。例如：

```fsharp
// squarePlusOne : int -> int
let squarePlusOne x =
    let square = x * x
    square + 1
```

这个例子还表明，可以在函数内定义子函数（`let square = ...`），并且最后一行（`square + 1`）是返回值。

### 4.1.2 泛型函数

如果函数适用于任意类型，编译器会自动推断泛型类型，例如下面的 `areEqual` 函数：

```fsharp
// areEqual : 'a -> 'a -> bool
let areEqual x y =
    (x = y)
```

对于 `areEqual`，`x` 和 `y` 的推断类型是 `'a`。撇号加字母是 F# 表示泛型类型的方式。只要 `x` 和 `y` 类型相同，它们可以是任意类型。

顺便一提，这段代码表明 F# 中相等性测试用的是 `=`，而不是 C 系语言中的 `==`。相比之下，C# 中使用泛型的 `areEqual` 代码可能类似这样：

```csharp
static bool AreEqual<T>(T x, T y)
{
    return (x == y);
}
```

## 4.2 类型与函数

在 F# 这样的编程语言中，类型扮演着关键角色，因此我们来看看函数式程序员所说的「类型」是什么意思。

函数式编程中的**类型**（type）与面向对象编程中的**类**（class）不同。它更简单。事实上，类型只是给「可作为函数输入或输出的可能值集合」起的名字：

```text
    函数
输入集合 ──► 输出集合
（有效输入）   （有效输出）
```

例如，我们可以把 -32768 到 +32767 范围内的数字集合命名为 `int16`。类型除了这个含义之外，没有其他特殊意义或行为。

下面是一个输入为 `int16` 的函数示例：

```text
    函数
int16 ──► 输出
-32768, -32767...-2, -1, 0, 1, 2...32766, 32767
（这就是类型 'int16'）
```

类型决定了函数的签名，因此该函数的签名可能如下：

```text
int16 -> someOutputType
```

下面是一个输出为所有可能字符串集合（我们称之为 `string` 类型）的函数示例：

```text
    函数
输入 ──► string
        'abc' 'but' 'cobol' 'double' 'end' 'float'...
        （这就是类型 'string'）
```

该函数的签名为：

```text
someInputType -> string
```

类型中的元素不必是原始对象。例如，我们可能有一个处理一组对象的函数，我们 collectively 称之为 `Person`：

```text
    函数
输入 ──► Person
        Donna Roy, Javier Mendoza, Nathan Logan...
        （这就是类型 'Person'）
```

从概念上讲，类型中的事物可以是任何种类——真实的或虚拟的。下图展示了一个处理「水果」的函数。这些是真实水果还是虚拟表示，目前并不重要：

```text
    函数
输入 ──► Fruit
        （这就是类型 'Fruit'）
```

最后，函数本身也是事物，因此我们也可以把函数集合用作类型。下面的函数输出一个「Fruit 到 Fruit」的函数：

```text
    函数
输入 ──► (Fruit -> Fruit)
        （这就是类型 'Fruit -> Fruit'）
```

输出集合中的每个元素都是一个 `Fruit -> Fruit` 函数，因此整个函数的签名是：

```text
someInputType -> (Fruit -> Fruit)
```

::: tip 术语说明：「值」vs「对象」vs「变量」
在函数式编程语言中，大多数事物称为「值」（values）。在面向对象语言中，大多数事物称为「对象」（objects）。那么「值」和「对象」有什么区别？

**值**只是类型的成员，可作为输入或输出使用。例如，`1` 是类型 `int` 的值，`"abc"` 是类型 `string` 的值，等等。函数也可以是值。如果我们定义简单函数 `let add1 x = x + 1`，那么 `add1` 就是类型 `int->int` 的（函数）值。

值是**不可变的**（immutable），因此不称为「变量」。值没有任何附加行为，它们只是数据。

相比之下，**对象**是数据结构及其关联行为（方法）的封装。一般来说，对象被认为具有状态（即可变的），所有改变内部状态的操作都必须由对象本身提供（通过「点」表示法）。

因此在函数式编程的世界里（那里没有对象），你应该使用「值」而不是「变量」或「对象」。
:::

## 4.3 类型的组合

在函数式编程中，你会经常听到「组合」（composition）这个词——它是函数式设计的基础。组合就是指可以把两样东西组合成更大的东西，就像用乐高积木一样。

在函数式编程世界中，我们用组合从小函数构建新函数，从小类型构建新类型。我们现在讨论类型的组合，函数组合将在第 8 章「理解函数」中讨论。

在 F# 中，新类型通过两种方式从小类型构建：

- 通过 **AND** 组合
- 通过 **OR** 组合

### 4.3.1 「AND」类型

先从用 AND 构建类型开始。例如，我们可以说做水果沙拉需要一个苹果、一根香蕉和一些樱桃：

```text
FruitSalad = 苹果 AND 香蕉 AND 樱桃
```

在 F# 中，这种类型称为**记录**（record）。下面是 `FruitSalad` 记录类型的定义：

```fsharp
type FruitSalad = {
    Apple: AppleVariety
    Banana: BananaVariety
    Cherries: CherryVariety
}
```

花括号表示这是记录类型，三个字段分别是 Apple、Banana 和 Cherries。

### 4.3.2 「OR」类型

另一种构建新类型的方式是使用 OR。例如，我们可以说水果零食需要一个苹果或一根香蕉或一些樱桃：

```text
FruitSnack = 苹果 OR 香蕉 OR 樱桃（三选一）
```

这种「选择」类型在建模中非常有用（我们将在本书中多次看到）。下面是使用选择类型定义的 `FruitSnack`：

```fsharp
type FruitSnack =
| Apple of AppleVariety
| Banana of BananaVariety
| Cherries of CherryVariety
```

这种选择类型在 F# 中称为**可辨识联合**（discriminated union）。可以这样理解：

- `FruitSnack` 要么是带 `Apple` 标签的 `AppleVariety`，要么是带 `Banana` 标签的 `BananaVariety`，要么是带 `Cherries` 标签的 `CherryVariety`。

竖线分隔每个选择，标签（如 `Apple` 和 `Banana`）是必需的，因为有时两个或多个选择可能有相同类型，需要标签来区分。

水果品种本身也定义为 OR 类型，在这种情况下用法类似于其他语言中的枚举：

```fsharp
type AppleVariety =
| GoldenDelicious
| GrannySmith
| Fuji

type BananaVariety =
| Cavendish
| GrosMichel
| Manzano

type CherryVariety =
| Montmorency
| Bing
```

可以理解为：

- `AppleVariety` 要么是 `GoldenDelicious`，要么是 `GrannySmith`，要么是 `Fuji`，等等。

::: tip 术语说明：「积类型」与「和类型」
用 AND 构建的类型称为**积类型**（product types）。

用 OR 构建的类型称为**和类型**（sum types）或**带标签联合**（tagged unions），在 F# 术语中称为**可辨识联合**（discriminated unions）。本书中我常称它们为**选择类型**（choice types），因为我认为这最能描述它们在领域建模中的作用。
:::

### 4.3.3 简单类型

我们经常定义一个只有一个选择的类型，例如：

```fsharp
type ProductCode =
| ProductCode of string
```

这种类型几乎总是简化为：

```fsharp
type ProductCode = ProductCode of string
```

为什么要创建这样的类型？因为这是创建「包装器」的简单方式——一种包含原始类型（如 `string` 或 `int`）作为内部值的类型。在领域建模中我们会大量使用这类类型。本书中我将这类单情况联合称为**简单类型**（simple types）。

## 4.4 使用 F# 类型

### 4.4.1 记录类型

记录类型的构造和析构是对称的。要构造一个记录，列出字段名和值即可：

```fsharp
type Person = {
    First: string
    Last: string
}

let aPerson = { First = "Albert"; Last = "Einstein" }
```

要析构（解构）记录以访问其字段，可以使用相同的语法，将字段绑定到新名称：

```fsharp
let { First = first; Last = last } = aPerson
```

这段代码表示 `first` 和 `last` 将被设置为记录中对应的字段。对于记录，我们也可以使用更熟悉的点语法。因此上面的代码等价于：

```fsharp
let first = aPerson.First
let last = aPerson.Last
```

### 4.4.2 可辨识联合

构造与析构的对称性也适用于可辨识联合。要定义选择类型，我们用竖线分隔每个选择，每个选择定义为 `caseLabel of type`：

```fsharp
type OrderQuantity =
| UnitQuantity of int
| KilogramQuantity of decimal
```

选择类型通过将任一 case 标签用作构造函数来构造，关联信息作为参数传入：

```fsharp
let anOrderQtyInUnits = UnitQuantity 10
let anOrderQtyInKg = KilogramQuantity 2.5
```

::: info
Case 与子类不同——`UnitQuantity` 和 `KilogramQuantity` 本身不是类型，只是 `OrderQuantity` 类型的不同 case。在上面的例子中，这两个值的类型相同：`OrderQuantity`。
:::

要析构选择类型，必须使用**模式匹配**（pattern matching）（`match..with` 语法），为每个 case 编写测试：

```fsharp
let printQuantity aOrderQty =
    match aOrderQty with
    | UnitQuantity uQty ->
        printfn "%i units" uQty
    | KilogramQuantity kgQty ->
        printfn "%g kg" kgQty
```

在匹配过程中，与特定 case 关联的数据也会被提取出来。在上面的例子中，如果输入匹配 `UnitQuantity` case，`uQty` 将被设置。

传入我们上面定义的两个值时，模式匹配的结果如下：

```text
printQuantity anOrderQtyInUnits // "10 units"
printQuantity anOrderQtyInKg    // "2.5 kg"
```

## 4.5 通过组合类型构建领域模型

可组合的类型系统是进行领域驱动设计的绝佳助力，因为我们可以通过以不同方式混合类型，快速创建复杂模型。例如，假设我们要为电商网站跟踪支付。看看在设计会话中如何用代码勾勒出来。

首先，我们从一些原始类型的包装器开始，例如 `CheckNumber`。这些就是我们上面讨论的「简单类型」。这样做可以赋予它们有意义的名称，让领域其余部分更容易理解：

```fsharp
type CheckNumber = CheckNumber of int
type CardNumber = CardNumber of string
```

接下来，我们构建一些低层类型。`CardType` 是 OR 类型——在 Visa 和 Mastercard 之间选择；`CreditCardInfo` 是 AND 类型，是包含 `CardType` 和 `CardNumber` 的记录：

```fsharp
type CardType =
| Visa | Mastercard  // 'OR' 类型

type CreditCardInfo = {  // 'AND' 类型（记录）
    CardType : CardType
    CardNumber : CardNumber
}
```

然后我们定义另一个 OR 类型 `PaymentMethod`，在 Cash、Check 或 Card 之间选择。这不再是简单的「枚举」，因为有些选择带有关联数据：Check case 有 `CheckNumber`，Card case 有 `CreditCardInfo`：

```fsharp
type PaymentMethod =
| Cash
| Check of CheckNumber
| Card of CreditCardInfo
```

我们再定义一些基本类型，如 `PaymentAmount` 和 `Currency`：

```fsharp
type PaymentAmount = PaymentAmount of decimal
type Currency = EUR | USD
```

最后，顶层类型 `Payment` 是包含 `PaymentAmount`、`Currency` 和 `PaymentMethod` 的记录：

```fsharp
type Payment = {
    Amount : PaymentAmount
    Currency: Currency
    Method: PaymentMethod
}
```

就这样。大约 25 行代码，我们已经定义了一组相当有用的类型。

::: info
当然，这些类型没有直接关联行为，因为这是函数式模型，不是面向对象模型。要记录可以执行的操作，我们改为定义表示函数的类型。

例如，如果我们想表示有一种方式可以用 `Payment` 类型支付未付发票，最终结果是已付发票，可以定义这样的函数类型：

```fsharp
type PayInvoice =
    UnpaidInvoice -> Payment -> PaidInvoice
```

意思是：给定 `UnpaidInvoice` 和 `Payment`，我们可以创建 `PaidInvoice`。

或者，要将支付从一种货币转换为另一种：

```fsharp
type ConvertPaymentCurrency =
    Payment -> Currency -> Payment
```

其中第一个 `Payment` 是输入，第二个参数 `Currency` 是要转换成的货币，第二个 `Payment`（输出）是转换后的结果。
:::

## 4.6 建模可选值、错误与集合

在讨论领域建模的同时，我们来看看一些常见场景以及如何用 F# 类型系统表示它们：

- 可选或缺失值
- 错误
- 无返回值的函数
- 集合

### 4.6.1 建模可选值

我们目前使用的类型——记录和选择类型——在 F# 中不允许为 null。这意味着每次在领域模型中引用一个类型时，它都是必需值。

那么如何建模缺失或可选数据？

答案是思考「缺失数据」的含义：要么存在，要么不存在。有东西，或没有东西。我们可以用名为 `Option` 的选择类型来建模：

```fsharp
type Option<'a> =
| Some of 'a
| None
```

`Some` case 表示有关联值 `'a` 存储的数据。`None` case 表示没有数据。同样，`'a` 中的撇号是 F# 表示泛型类型的方式——即 `Option` 类型可以包装任意其他类型。C# 或 Java 的等价物类似于 `Option<T>`。

你不需要自己定义 `Option` 类型。它是 F# 标准库的一部分，有丰富的辅助函数与之配合。

要在领域模型中表示可选数据，我们将类型包装在 `Option<..>` 中，就像在 C# 或 Java 中一样。例如，如果我们有 `PersonalName` 类型，其中 first 和 last 名是必需的，但中间名首字母是可选的，可以这样建模：

```fsharp
type PersonalName = {
    FirstName : string
    MiddleInitial: Option<string>  // 可选
    LastName : string
}
```

F# 也支持在类型后使用 `option` 标签，更易读且更常用：

```fsharp
type PersonalName = {
    FirstName : string
    MiddleInitial: string option
    LastName : string
}
```

### 4.6.2 建模错误

假设我们有一个可能失败的过程：「支付成功完成，或因卡已过期而失败。」应该如何建模？

F# 支持抛出异常，但我们通常希望在类型签名中显式标注可能发生失败的事实。这需要有两个 case 的选择类型，因此我们定义 `Result` 类型：

```fsharp
type Result<'Success,'Failure> =
| Ok of 'Success
| Error of 'Failure
```

`Ok` case 用于在函数成功时保存值，`Error` case 用于在函数失败时保存错误数据。当然我们希望这个类型能包含任意类型的数据，因此在定义中使用了泛型。

::: tip
如果你使用 F# 4.1 及以上（或 Visual Studio 2017），则不需要自己定义 `Result` 类型，因为它是 F# 标准库的一部分。如果使用更早版本的 F#，可以用几行代码轻松定义它及其辅助函数。
:::

要表示函数可能失败，我们将输出包装在 `Result` 类型中。例如，如果 `PayInvoice` 函数可能失败，可以这样定义：

```fsharp
type PayInvoice =
    UnpaidInvoice -> Payment -> Result<PaidInvoice,PaymentError>
```

这表明与 `Ok` case 关联的类型是 `PaidInvoice`，与 `Error` case 关联的类型是 `PaymentError`。然后我们可以将 `PaymentError` 定义为选择类型，每个可能错误对应一个 case：

```fsharp
type PaymentError =
| CardTypeNotRecognized
| PaymentRejected
| PaymentProviderOffline
```

这种记录错误的方式将在第 10 章「实现：处理错误」中详细讨论。

### 4.6.3 建模「无值」

大多数编程语言都有 `void` 的概念，用于函数或方法不返回任何东西时。

在 F# 这样的函数式语言中，每个函数都必须返回某种东西，因此不能使用 `void`。我们改用名为 `unit` 的特殊内置类型。`unit` 只有一个值，写作一对括号：`()`。

假设你有一个在数据库中更新客户记录的函数。输入是客户记录，但没有有用的输出。在 F# 中，我们用 `unit` 作为输出类型来写类型签名：

```fsharp
type SaveCustomer = Customer -> unit
```

（实践中当然会比这更复杂！参见第 12 章「持久化」，了解与数据库协作的详细讨论。）

或者，假设你有一个没有输入但返回有用内容的函数，例如生成随机数的函数。在 F# 中，你也用 `unit` 表示「无输入」：

```fsharp
type NextRandom = unit -> int
```

当你在签名中看到 `unit` 类型时，这强烈暗示存在副作用。某处有东西在改变状态，但对你是隐藏的。一般来说，函数式程序员会尽量避免副作用，或至少将其限制在代码的特定区域。

### 4.6.4 建模列表与集合

F# 在标准库中支持多种不同的集合类型：

| 类型 | 说明 |
|------|------|
| `list` | 固定大小的不可变集合（实现为链表） |
| `array` | 固定大小的可变集合，可按索引获取和赋值 |
| `ResizeArray` | 可变大小数组，可增删元素。是 C# `List<T>` 的 F# 别名 |
| `seq` | 惰性集合，按需返回每个元素。是 C# `IEnumerable<T>` 的 F# 别名 |
| `Map`、`Set` | 内置类型，但在领域模型中很少直接使用 |

对于领域建模，建议始终使用 `list` 类型。就像 `option` 一样，它可以作为类型的后缀使用（非常易读）：

```fsharp
type Order = {
    OrderId : OrderId
    Lines : OrderLine list  // 集合
}
```

要创建列表，可以使用列表字面量，用方括号和分号（不是逗号！）作为分隔符：

```fsharp
let aList = [1; 2; 3]
```

或者可以使用 `::`（也称为「cons」）运算符将值添加到现有列表前面：

```fsharp
let aNewList = 0 :: aList  // 新列表是 [0;1;2;3]
```

要析构列表以访问其中的元素，可以使用类似的模式。可以这样匹配列表字面量：

```fsharp
let printList1 aList =
    match aList with
    | [] ->
        printfn "list is empty"
    | [x] ->
        printfn "list has one element: %A" x
    | [x;y] ->
        printfn "list has two elements: %A and %A" x y
    | longerList ->
        printfn "list has more than two elements"
```

或者可以这样使用「cons」运算符匹配：

```fsharp
let printList2 aList =
    match aList with
    | [] ->
        printfn "list is empty"
    | first::rest ->
        printfn "list is non-empty with the first element being: %A" first
```

## 4.7 在文件与项目中组织类型

还有一点你需要知道。F# 对声明顺序有严格规则。文件中靠前的类型不能引用文件中靠后的类型。编译顺序中靠前的文件不能引用靠后的文件。这意味着在编写类型时，必须考虑如何组织它们。

标准做法是将所有领域类型放在一个文件中，例如 `Types.fs` 或 `Domain.fs`，然后让依赖它们的函数放在编译顺序的后面。如果类型很多，需要拆分到多个文件，将共享的放在前面，子域特定的放在后面。文件列表可能类似这样：

```text
Common.Types.fs
Common.Functions.fs
OrderTaking.Types.fs
OrderTaking.Functions.fs
Shipping.Types.fs
Shipping.Functions.fs
```

在文件内部，该规则意味着需要将简单类型放在顶部，更复杂的类型（依赖它们的）按依赖顺序放在下面：

```fsharp
module Payments =
    // 简单类型在文件顶部
    type CheckNumber = CheckNumber of int

    // 领域类型在文件中部
    type PaymentMethod =
    | Cash
    | Check of CheckNumber  // 在上面定义
    | Card of ...

    // 顶层类型在文件底部
    type Payment = {
        Amount: ...
        Currency: ...
        Method: PaymentMethod  // 在上面定义
    }
```

当你自顶向下开发模型时，依赖顺序约束有时会带来不便，因为你往往希望把低层类型写在高层类型下面。在 F# 4.1 中，可以在模块或命名空间级别使用 `rec` 关键字来解决这个问题。`rec` 关键字允许类型在模块内任意位置相互引用：

```fsharp
module rec Payments =
    type Payment = {
        Amount: ...
        Currency: ...
        Method: PaymentMethod  // 在下面定义
    }
    type PaymentMethod =
    | Cash
    | Check of CheckNumber  // 在下面定义
    | Card of ...
    type CheckNumber = CheckNumber of int
```

对于更早版本的 F#，可以使用 `and` 关键字让类型定义引用紧接其下的类型：

```fsharp
type Payment = {
    Amount: ...
    Currency: ...
    Method: PaymentMethod  // 在下面定义
}
and PaymentMethod =
| Cash
| Check of CheckNumber  // 在下面定义
| Card of ...
and CheckNumber = CheckNumber of int
```

::: warning
这种乱序方式适合草图阶段，但一旦设计确定并准备投入生产，通常最好将类型按正确的依赖顺序排列。这样与其他 F# 代码保持一致，也便于其他开发者阅读。
:::

关于如何在项目中组织类型的真实示例，请参阅本书的代码仓库。

## 本章小结

本章我们探讨了类型的概念及其与函数式编程的关系，也看到了如何通过 F# 的代数类型系统，用类型组合从小类型创建更大的类型。我们介绍了用 AND 组合数据构建的**记录类型**（record types），以及用 OR 组合数据构建的**选择类型**（choice types，即可辨识联合），还有基于这些的常见类型，如 `Option` 和 `Result`。

现在我们理解了类型如何工作，可以重新审视需求，并用所学知识来记录它们。

---

[← 上一章：函数式架构](../part1/ch03-functional-architecture.md) | [返回目录](../index.md) | [下一章：用类型建模领域 →](ch05-domain-modeling-with-types.md)
