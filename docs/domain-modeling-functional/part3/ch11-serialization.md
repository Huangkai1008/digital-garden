# 第11章：序列化

> 本书中的示例将工作流设计为具有输入和输出的函数，输入来自命令（Commands），输出是事件（Events）。但这些命令从何而来？事件又去向何处？它们来自或流向限界上下文之外的某些基础设施——消息队列、Web 请求等。这些基础设施不理解我们的特定领域，因此必须将领域模型中的类型转换为基础设施能理解的形式，例如 JSON、XML 或 protobuf 等二进制格式。我们还需要某种方式来跟踪工作流所需的内部状态，例如订单的当前状态，这通常也会用到数据库等外部服务。显然，与外部基础设施协作的一个重要方面，是能够将领域模型中的类型轻松地序列化和反序列化。因此，本章将学习如何做到这一点：如何设计可序列化的类型，以及如何在领域对象与这些中间类型之间进行转换。

---

## 11.1 持久化与序列化（Persistence vs Serialization）

先明确几个定义。**持久化（persistence）** 指状态在创建它的进程结束后仍然存在。**序列化（serialization）** 指将领域特定的表示转换为易于持久化的表示，例如二进制、JSON 或 XML。

例如，我们的下单工作流实现会在每次「订单表单到达」事件发生时被实例化并运行。但当代码停止运行时，我们希望其输出能以某种方式保留下来（「被持久化」），以便业务的其他部分可以使用这些数据。「保留」不一定意味着存储在正式数据库中——可以存储在文件或队列中。我们也不应假设持久化数据的生命周期——可能只保留几秒（如在队列中），也可能保留几十年（如在数据仓库中）。

本章聚焦于序列化，下一章将讨论持久化。

## 11.2 面向序列化的设计（Designing for Serialization）

如第 46 页《限界上下文之间的数据传输》所述，我们复杂的领域类型——带有嵌套的选择类型和约束——并不适合序列化器直接处理。因此，实现无痛序列化的诀窍是：先将领域对象转换为专门为序列化设计的类型——**数据传输对象（Data Transfer Object，DTO）**，然后序列化该 DTO，而不是直接序列化领域类型。

```
领域类型 ──> 领域类型转 DTO ──> DTO 类型 ──> 序列化 ──> Json/XML
                                                      │
                                            领域边界 ──┴──> 下游上下文
```

反序列化时，按相反方向进行：

```
领域类型 <── DTO 转领域类型 <── DTO 类型 <── 反序列化 <── Json/XML
    │
    └── 领域边界 <── 上游上下文
```

一般而言，我们希望反序列化尽可能干净。这意味着反序列化为 DTO 应当始终成功，除非底层数据本身已损坏。任何领域特定的验证（例如验证 OrderQty 的整数边界，或检查 ProductCode 是否有效）都应在 DTO 到领域类型的转换过程中完成，在限界上下文内部进行，以便更好地控制错误处理。

## 11.3 将序列化代码连接到工作流（Connecting the Serialization Code to the Workflow）

序列化过程只是可以加入工作流管道的另一个组件：反序列化步骤加在工作流前端，序列化步骤加在工作流末端。

例如，假设我们有如下工作流（暂时忽略错误处理和 Result）：

```fsharp
type MyInputType = ...
type MyOutputType = ...
type Workflow = MyInputType -> MyOutputType
```

反序列化步骤的函数签名可能如下：

```fsharp
type JsonString = string
type MyInputDto = ...
type DeserializeInputDto = JsonString -> MyInputDto
type InputDtoToDomain = MyInputDto -> MyInputType
```

序列化步骤可能如下：

```fsharp
type MyOutputDto = ...
type OutputDtoFromDomain = MyOutputType -> MyOutputDto
type SerializeOutputDto = MyOutputDto -> JsonString
```

显然，这些函数可以像管道一样串联起来：

```fsharp
let workflowWithSerialization jsonString =
    jsonString
    |> deserializeInputDto      // JSON 转 DTO
    |> inputDtoToDomain         // DTO 转领域对象
    |> workflow                 // 领域内的核心工作流
    |> outputDtoFromDomain      // 领域对象转 DTO
    |> serializeOutputDto       // DTO 转 JSON
    // 最终输出是另一个 JsonString
```

于是 `workflowWithSerialization` 函数就是暴露给基础设施的入口。输入和输出只是 `JsonString` 或类似类型，因此基础设施与领域是隔离的。

当然，实践中并非如此简单！我们需要处理错误、异步等。但这展示了基本概念。

### 11.3.1 DTO 作为限界上下文之间的契约

我们消费的命令由其他限界上下文的输出触发，工作流发出的事件则成为其他限界上下文的输入。这些事件和命令形成一种契约，我们的限界上下文必须支持。这是一种松散的契约，因为我们希望避免限界上下文之间的紧耦合。尽管如此，这些事件和命令的序列化格式（即 DTO）应当谨慎修改，甚至尽量不改。这意味着你应当始终完全控制序列化格式，而不应让库自动处理！

## 11.4 完整序列化示例（A Complete Serialization Example）

为演示将领域对象序列化到 JSON 以及从 JSON 反序列化的实践，我们构建一个小示例。假设要持久化一个领域类型 `Person`，定义如下：

```fsharp
module Domain =  // 我们的领域驱动类型
    /// 约束为非空且最多 50 个字符
    type String50 = String50 of string
    /// 约束为大于 1900/1/1 且小于今天
    type Birthdate = Birthdate of DateTime
    /// 领域类型
    type Person = {
        First: String50
        Last: String50
        Birthdate : Birthdate
    }
```

`String50` 和 `Birthdate` 类型无法直接序列化，因此我们首先创建对应的 DTO 类型 `Dto.Person`（Dto 模块中的 Person），其中所有字段都是基本类型：

```fsharp
/// 用于组织所有 DTO 相关类型和函数的模块
module Dto =
    type Person = {
        First: string
        Last: string
        Birthdate : DateTime
    }
```

接下来需要「toDomain」和「fromDomain」函数。它们与 DTO 类型关联，而非领域类型，因为领域不应了解 DTO，因此也放在 Dto 模块中，放在名为 Person 的子模块里：

```fsharp
module Dto =
    module Person =
        let fromDomain (person:Domain.Person) :Dto.Person =
            ...

        let toDomain (dto:Dto.Person) :Result<Domain.Person,string> =
            ...
```

::: tip 版本说明
在 F# 4.1 之前的版本中，当模块与类型同名时，需要使用 `CompilationRepresentation` 属性。
:::

这种成对的 `fromDomain` 和 `toDomain` 函数模式，我们将一致使用。

先从 `fromDomain` 函数开始，它将领域类型转换为 DTO。该函数始终成功（不需要 Result），因为复杂领域类型总能无误地转换为 DTO：

```fsharp
let fromDomain (person:Domain.Person) :Dto.Person =
    // 从领域对象获取基本值
    let first = person.First |> String50.value
    let last = person.Last |> String50.value
    let birthdate = person.Birthdate |> Birthdate.value
    // 组合各组件创建 DTO
    {First = first; Last = last; Birthdate = birthdate}
```

反方向，`toDomain` 函数将 DTO 转换为领域类型；由于各种验证和约束可能失败，`toDomain` 返回 `Result<Person,string>` 而非普通 `Person`：

```fsharp
let toDomain (dto:Dto.Person) :Result<Domain.Person,string> =
    result {
        // 从 DTO 获取每个（已验证的）简单类型，成功或失败
        let! first = dto.First |> String50.create "First"
        let! last = dto.Last |> String50.create "Last"
        let! birthdate = dto.Birthdate |> Birthdate.create
        // 组合各组件创建领域对象
        return {
            First = first
            Last = last
            Birthdate = birthdate
        }
    }
```

我们使用 result 计算表达式处理错误流，因为简单类型（如 `String50` 和 `Birthdate`）的 `create` 方法返回 `Result`。

例如，我们可以按第 104 页《简单值的完整性》中的方法实现 `String50.create`。代码如下。注意我们将字段名作为参数传入，以便得到有用的错误消息：

```fsharp
let create fieldName str : Result<String50,string> =
    if String.IsNullOrEmpty(str) then
        Error (fieldName + " must be non-empty")
    elif str.Length > 50 then
        Error (fieldName + " must be less that 50 chars")
    else
        Ok (String50 str)
```

### 11.4.1 封装 JSON 序列化器

序列化 JSON 或 XML 不是我们要自己实现的事——我们可能更愿意使用第三方库。然而，库的 API 可能不够函数式友好，因此我们可能希望封装序列化和反序列化例程，使其适合在管道中使用，并将任何异常转换为 Result。例如，封装标准 .NET JSON 序列化库（Newtonsoft.Json）的一部分：

```fsharp
module Json =
    open Newtonsoft.Json

    let serialize obj =
        JsonConvert.SerializeObject obj

    let deserialize<'a> str =
        try
            JsonConvert.DeserializeObject<'a> str
            |> Result.Ok
        with
        // 捕获所有异常并转换为 Result
        | ex -> Result.Error ex
```

我们创建自己的 Json 模块来放置适配后的版本，以便调用 `Json.serialize` 和 `Json.deserialize`。

### 11.4.2 完整序列化管道

有了 DTO 到领域的转换器和序列化函数，我们可以将领域类型——`Person` 记录——一路转换为 JSON 字符串：

```fsharp
/// 将 Person 序列化为 JSON 字符串
let jsonFromDomain (person:Domain.Person) =
    person
    |> Dto.Person.fromDomain
    |> Json.serialize
```

测试时，我们得到预期的 JSON 字符串：

```fsharp
// 测试用输入
let person : Domain.Person = {
    First = String50 "Alex"
    Last = String50 "Adams"
    Birthdate = Birthdate (DateTime(1980,1,1))
}

// 使用序列化管道
jsonFromDomain person
// 输出为
// "{"First":"Alex","Last":"Adams","Birthdate":"1980-01-01T00:00:00"}"
```

组合序列化管道很简单，因为所有阶段都不涉及 Result；但组合反序列化管道更棘手，因为 `Json.deserialize` 和 `Dto.Person.toDomain` 都可能返回 Result。解决方案是使用 `Result.mapError` 将潜在失败转换为公共选择类型，然后用 result 表达式隐藏错误，正如第 201 页《转换为公共错误类型》所述：

```fsharp
type DtoError =
    | ValidationError of string
    | DeserializationException of exn

/// 将 JSON 字符串反序列化为 Person
let jsonToDomain jsonString :Result<Domain.Person,DtoError> =
    result {
        let! deserializedValue =
            jsonString
            |> Json.deserialize
            |> Result.mapError DeserializationException
        let! domainValue =
            deserializedValue
            |> Dto.Person.toDomain
            |> Result.mapError ValidationError
        return domainValue
    }
```

用无错误的输入测试：

```fsharp
// 测试用 JSON 字符串
let jsonPerson = """{
    "First": "Alex",
    "Last": "Adams",
    "Birthdate": "1980-01-01T00:00:00"
}"""

// 调用反序列化管道
jsonToDomain jsonPerson |> printfn "%A"
// 输出为：
// Ok {First = String50 "Alex";
//     Last = String50 "Adams";
//     Birthdate = Birthdate 01/01/1980 00:00:00;}
```

可以看到整体结果是 `Ok`，`Person` 领域对象已成功创建。

现在修改 JSON 字符串使其包含错误——空名称和错误日期——再次运行：

```fsharp
let jsonPersonWithErrors = """{
    "First": "",
    "Last": "Adams",
    "Birthdate": "1776-01-01T00:00:00"
}"""

// 调用反序列化管道
jsonToDomain jsonPersonWithErrors |> printfn "%A"
// 输出为：
// Error (ValidationError "First must be non-empty")
```

可以看到我们确实得到了 Result 的 Error 分支和一条验证错误消息。在实际应用中，可以记录此错误并可能将其返回给调用方。（在此实现中我们只返回第一个错误。要返回所有错误，参见第 217 页《用 Applicative 并行组合》。）

反序列化时错误处理的另一种做法是根本不处理，而是让反序列化代码直接抛出异常。选择哪种方式取决于你是将反序列化错误视为预期情况，还是视为使整个管道崩溃的「恐慌」。而这又取决于 API 的公开程度、对调用方的信任程度，以及希望向调用方提供多少关于此类错误的信息。

### 11.4.3 使用其他序列化器

上述代码使用 Newtonsoft.Json 序列化器。你可以使用其他序列化器，但可能需要在 `PersonDto` 类型上添加属性。例如，要使用 DataContractSerializer（用于 XML）或 DataContractJsonSerializer（用于 JSON）序列化记录类型，必须用 `DataContractAttribute` 和 `DataMemberAttribute` 装饰 DTO 类型：

```fsharp
module Dto =
    [<DataContract>]
    type Person = {
        [<field: DataMember>]
        First: string
        [<field: DataMember>]
        Last: string
        [<field: DataMember>]
        Birthdate : DateTime
    }
```

这展示了将序列化类型与领域类型分离的另一个优势——领域类型不会被此类复杂属性污染。一如既往，将领域关注点与基础设施关注点分离是好的做法。

另一个值得了解的序列化器属性是 `CLIMutableAttribute`，它会生成（隐藏的）无参构造函数，许多使用反射的序列化器需要它。

最后，如果你确定只与其他 F# 组件协作，可以使用 F# 专用序列化器，如 [FsPickler](https://github.com/mbraceproject/FsPickler) 或 [Chiron](https://github.com/xyncro/chiron)。注意，这样做会在限界上下文之间引入耦合，因为它们都必须使用同一种编程语言。

### 11.4.4 处理序列化类型的多个版本

随着设计演进，领域类型可能需要变更，字段可能增删或重命名。这也会影响 DTO 类型。DTO 类型充当限界上下文之间的契约，不破坏这一契约很重要。这意味着你可能需要随时间支持 DTO 类型的多个版本。实现方式有很多，但本书篇幅有限无法展开。Greg Young 的《Versioning in an Event Sourced System》对各种可用方法有很好的讨论。

## 11.5 如何将领域类型转换为 DTO（How to Translate Domain Types to DTOs）

我们定义的领域类型可能相当复杂，而对应的 DTO 类型必须是仅包含基本类型的简单结构。那么给定特定领域类型，如何设计 DTO？下面是一些指南。

### 11.5.1 单例联合（Single-Case Unions）

单例联合——本书中我们称为「简单类型」——在 DTO 中可以用底层基本类型表示。

例如，若 `ProductCode` 是如下领域类型：

```fsharp
type ProductCode = ProductCode of string
```

则对应的 DTO 类型就是 `string`。

### 11.5.2 可选值（Options）

对于 option，可以用 `null` 替代 `None` 分支。若 option 包装的是引用类型，无需额外处理，因为 `null` 是合法值。对于 `int` 等值类型，需要使用可空等价类型，如 `Nullable<int>`。

### 11.5.3 记录（Records）

定义为记录的领域类型在 DTO 中可以保持为记录，只要每个字段的类型都转换为对应的 DTO 等价类型。

以下示例演示单例联合、可选值和记录类型：

```fsharp
/// 领域类型
type OrderLineId = OrderLineId of int
type OrderLineQty = OrderLineQty of int
type OrderLine = {
    OrderLineId : OrderLineId
    ProductCode : ProductCode
    Quantity : OrderLineQty option
    Description : string option
}

/// 对应的 DTO 类型
type OrderLineDto = {
    OrderLineId : int
    ProductCode : string
    Quantity : Nullable<int>
    Description : string
}
```

### 11.5.4 集合（Collections）

列表、序列和集合应转换为数组，因为所有序列化格式都支持数组：

```fsharp
/// 领域类型
type Order = {
    ...
    Lines : OrderLine list
}

/// 对应的 DTO 类型
type OrderDto = {
    ...
    Lines : OrderLineDto[]
}
```

对于 map 和其他复杂集合，采用的方法取决于序列化格式。使用 JSON 格式时，应能直接从 map 序列化为 JSON 对象，因为 JSON 对象本身就是键值集合。

对于其他格式，可能需要创建特殊表示。例如，map 在 DTO 中可以表示为记录数组，每条记录是一个键值对：

```fsharp
/// 领域类型
type Price = Price of decimal
type PriceLookup = Map<ProductCode,Price>

/// 表示 map 的 DTO 类型
type PriceLookupPair = {
    Key : string
    Value : decimal
}
type PriceLookupDto = {
    KVPairs : PriceLookupPair []
}
```

或者，map 也可以用两个并行数组表示，在反序列化时 zip 在一起：

```fsharp
/// 表示 map 的另一种 DTO 类型
type PriceLookupDto = {
    Keys : string []
    Values : decimal []
}
```

### 11.5.5 用作枚举的可区分联合（Discriminated Unions Used as Enumerations）

在许多情况下，联合的每个分支都只是名称，没有额外数据。这类可以用 .NET 枚举表示，而枚举在序列化时通常表示为整数：

```fsharp
/// 领域类型
type Color =
    | Red
    | Green
    | Blue

/// 对应的 DTO 类型
type ColorDto =
    | Red = 1
    | Green = 2
    | Blue = 3
```

注意反序列化时，必须处理 .NET 枚举值不是枚举定义中之一的情况：

```fsharp
let toDomain dto : Result<Color,_> =
    match dto with
    | ColorDto.Red -> Ok Color.Red
    | ColorDto.Green -> Ok Color.Green
    | ColorDto.Blue -> Ok Color.Blue
    | _ -> Error (sprintf "Color %O is not one of Red,Green,Blue" dto)
```

或者，也可以将枚举式联合序列化为字符串，使用分支名称作为值。但这对重命名更敏感。

### 11.5.6 元组（Tuples）

元组在领域中出现不应太频繁，但若出现，可能需要用专门定义的记录表示，因为大多数序列化格式不支持元组。下例中，领域类型 `Card` 是元组，但对应的 `CardDto` 是记录：

```fsharp
/// 元组组件
type Suit = Heart | Spade | Diamond | Club
type Rank = Ace | Two | Queen | King  // 为简洁起见不完整

// 元组
type Card = Suit * Rank

/// 对应的 DTO 类型
type SuitDto = Heart = 1 | Spade = 2 | Diamond = 3 | Club = 4
type RankDto = Ace = 1 | Two = 2 | Queen = 12 | King = 13
type CardDto = {
    Suit : SuitDto
    Rank : RankDto
}
```

### 11.5.7 选择类型（Choice Types）

选择类型可以表示为带有「标签」的记录，标签表示使用了哪个分支，然后为每个可能的分支各有一个字段，包含该分支关联的数据。当某个分支被转换到 DTO 时，该分支的字段有数据，其他分支的字段为 null（或对于列表，为空）。

::: tip 序列化器与可区分联合
某些序列化器可以直接处理 F# 可区分联合类型，但你无法控制它们使用的格式。若另一个限界上下文使用不同的序列化器，可能无法正确解析。由于 DTO 是契约的一部分，最好对格式有显式控制。
:::

以下是一个领域类型（Example）的示例，有四个分支：

- 空分支，标签为 A
- 整数，标签为 B
- 字符串列表，标签为 C
- 名称（使用上面的 Name 类型），标签为 D

```fsharp
/// 领域类型
type Name = {
    First : String50
    Last : String50
}
type Example =
    | A
    | B of int
    | C of string list
    | D of Name
```

对应的 DTO 类型如下，每个分支的类型替换为可序列化版本：`int` 到 `Nullable<int>`，`string list` 到 `string[]`，`Name` 到 `NameDto`：

```fsharp
/// 对应的 DTO 类型
type NameDto = {
    First : string
    Last : string
}
type ExampleDto = {
    Tag : string  // "A"、"B"、"C"、"D" 之一
    // A 分支无数据
    BData : Nullable<int>   // B 分支的数据
    CData : string[]       // C 分支的数据
    DData : NameDto        // D 分支的数据
}
```

序列化很直接——只需转换所选分支的相应数据，并将其他分支的数据设为 null：

```fsharp
let nameDtoFromDomain (name:Name) :NameDto =
    let first = name.First |> String50.value
    let last = name.Last |> String50.value
    {First=first; Last=last}

let fromDomain (domainObj:Example) :ExampleDto =
    let nullBData = Nullable()
    let nullCData = null
    let nullDData = Unchecked.defaultof<NameDto>
    match domainObj with
    | A ->
        {Tag="A"; BData=nullBData; CData=nullCData; DData=nullDData}
    | B i ->
        let bdata = Nullable i
        {Tag="B"; BData=bdata; CData=nullCData; DData=nullDData}
    | C strList ->
        let cdata = strList |> List.toArray
        {Tag="C"; BData=nullBData; CData=cdata; DData=nullDData}
    | D name ->
        let ddata = name |> nameDtoFromDomain
        {Tag="D"; BData=nullBData; CData=nullCData; DData=ddata}
```

这段代码的逻辑如下：

- 在函数开头为每个字段设置 null 值，然后将它们赋给与当前匹配分支无关的字段。
- 在「B」分支中，`Nullable<_>` 类型不能直接赋 null，必须使用 `Nullable()` 函数。
- 在「C」分支中，Array 可以赋 null，因为它是 .NET 类。
- 在「D」分支中，`NameDto` 等 F# 记录也不能赋 null，因此使用「后门」函数 `Unchecked.defaultOf<_>` 为其创建 null 值。这不应在正常代码中使用，仅在需要为互操作或序列化创建 null 时使用。

反序列化带标签的选择类型时，根据「tag」字段匹配，然后分别处理每个分支。在尝试反序列化之前，必须始终检查与标签关联的数据不为 null：

```fsharp
let nameDtoToDomain (nameDto:NameDto) :Result<Name,string> =
    result {
        let! first = nameDto.First |> String50.create
        let! last = nameDto.Last |> String50.create
        return {First=first; Last=last}
    }

let toDomain dto : Result<Example,string> =
    match dto.Tag with
    | "A" ->
        Ok A
    | "B" ->
        if dto.BData.HasValue then
            dto.BData.Value |> B |> Ok
        else
            Error "B data not expected to be null"
    | "C" ->
        match dto.CData with
        | null ->
            Error "C data not expected to be null"
        | _ ->
            dto.CData |> Array.toList |> C |> Ok
    | "D" ->
        match box dto.DData with
        | null ->
            Error "D data not expected to be null"
        | _ ->
            dto.DData
            |> nameDtoToDomain  // 返回 Result...
            |> Result.map D     // ...所以必须用 "map"
    | _ ->
        // 所有其他情况
        let msg = sprintf "Tag '%s' not recognized" dto.Tag
        Error msg
```

在「B」和「C」分支中，从基本值到领域值的转换是无错误的（在确保数据不为 null 之后）。在「D」分支中，从 `NameDto` 到 `Name` 的转换可能失败，因此返回 `Result`，我们必须用 `Result.map` 与 `D` 分支构造器进行映射。

### 11.5.8 使用 Map 序列化记录和选择类型

复合类型（记录和可区分联合）的另一种序列化方式是，将所有内容序列化为键值 map。换言之，所有 DTO 都以相同方式实现：使用 .NET 类型 `IDictionary<string,obj>`。这种方法特别适用于 JSON 格式，与 JSON 对象模型契合良好。

这种方式的优点是 DTO 结构中没有隐式「契约」——键值 map 可以包含任何内容——因此促进高度解耦的交互。缺点是根本没有契约！这意味着很难知道生产者与消费者之间的期望是否不匹配。有时一点耦合是有用的。看一些代码。使用这种方式，我们会这样序列化 `Name` 记录：

```fsharp
let nameDtoFromDomain (name:Name) :IDictionary<string,obj> =
    let first = name.First |> String50.value :> obj
    let last = name.Last |> String50.value :> obj
    [
        ("First",first)
        ("Last",last)
    ] |> dict
```

这里我们创建键/值对列表，然后用内置函数 `dict` 构建 `IDictionary`。若将此字典序列化为 JSON，输出看起来就像创建了单独的 `NameDto` 类型并序列化它一样。

需要注意的是，`IDictionary` 使用 `obj` 作为值的类型。这意味着记录中的所有值都必须使用上转型运算符 `:>` 显式转换为 `obj`。

对于选择类型，返回的字典将恰好有一个条目，但键的值取决于选择。例如，若序列化 `Example` 类型，键将是「A」、「B」、「C」或「D」之一：

```fsharp
let fromDomain (domainObj:Example) :IDictionary<string,obj> =
    match domainObj with
    | A ->
        [ ("A",null) ] |> dict
    | B i ->
        let bdata = Nullable i :> obj
        [ ("B",bdata) ] |> dict
    | C strList ->
        let cdata = strList |> List.toArray :> obj
        [ ("C",cdata) ] |> dict
    | D name ->
        let ddata = name |> nameDtoFromDomain :> obj
        [ ("D",ddata) ] |> dict
```

上述代码展示了与 `nameDtoFromDomain` 类似的方法。对每个分支，将数据转换为可序列化格式，然后转换为 `obj`。在「D」分支中，数据是 `Name`，可序列化格式就是另一个 `IDictionary`。

反序列化稍复杂。对每个字段需要：(a) 在字典中查找是否存在；(b) 若存在，检索并尝试转换为正确类型。

这需要辅助函数，我们称之为 `getValue`：

```fsharp
let getValue key (dict:IDictionary<string,obj>) :Result<'a,string> =
    match dict.TryGetValue key with
    | (true,value) ->  // 找到键！
        try
            // 下转为类型 'a 并返回 Ok
            (value :?> 'a) |> Ok
        with
        | :? InvalidCastException ->
            // 转换失败
            let typeName = typeof<'a>.Name
            let msg = sprintf "Value could not be cast to %s" typeName
            Error msg
    | (false,_) ->  // 未找到键
        let msg = sprintf "Key '%s' not found" key
        Error msg
```

看如何反序列化 `Name`。首先获取「First」键的值（可能出错）。若成功，对其调用 `String50.create` 得到 First 字段（也可能出错）。对「Last」键和 Last 字段同理。一如既往，使用 result 表达式简化代码：

```fsharp
let nameDtoToDomain (nameDto:IDictionary<string,obj>) :Result<Name,string> =
    result {
        let! firstStr = nameDto |> getValue "First"
        let! first = firstStr |> String50.create
        let! lastStr = nameDto |> getValue "Last"
        let! last = lastStr |> String50.create
        return {First=first; Last=last}
    }
```

要反序列化 `Example` 等选择类型，需要测试每个分支的键是否存在。若存在，可以尝试检索并转换为领域对象。同样，每个分支都有很多出错可能，因此对每个分支使用 result 表达式：

```fsharp
let toDomain (dto:IDictionary<string,obj>) : Result<Example,string> =
    if dto.ContainsKey "A" then
        Ok A  // 无需额外数据
    elif dto.ContainsKey "B" then
        result {
            let! bData = dto |> getValue "B"  // 可能失败
            return B bData
        }
    elif dto.ContainsKey "C" then
        result {
            let! cData = dto |> getValue "C"  // 可能失败
            return cData |> Array.toList |> C
        }
    elif dto.ContainsKey "D" then
        result {
            let! dData = dto |> getValue "D"  // 可能失败
            let! name = dData |> nameDtoToDomain  // 也可能失败
            return name |> D
        }
    else
        // 所有其他情况
        let msg = sprintf "No union case recognized"
        Error msg
```

### 11.5.9 泛型（Generics）

在许多情况下，领域类型是泛型的。若序列化库支持泛型，则也可以使用泛型创建 DTO。

例如，`Result` 类型是泛型的，可以转换为泛型 `ResultDto`：

```fsharp
type ResultDto<'OkData,'ErrorData when 'OkData : null and 'ErrorData: null> = {
    IsError : bool  // 替代 "Tag" 字段
    OkData : 'OkData
    ErrorData : 'ErrorData
}
```

注意泛型 `'OkData` 和 `'ErrorData` 必须约束为可空，因为它们在关联的 JSON 对象中可能缺失或为 null。

若序列化库不支持泛型，则必须为每个具体情况创建专门类型。听起来繁琐，但实践中你会发现需要序列化的泛型类型很少。例如，以下是下单工作流中的 `Result` 类型，使用具体类型而非泛型转换为 DTO：

```fsharp
type PlaceOrderResultDto = {
    IsError : bool
    OkData : PlaceOrderEventDto[]
    ErrorData : PlaceOrderErrorDto
}
```

## 本章小结

本章我们离开限界上下文和干净的领域，踏入基础设施的纷繁世界。我们学习了如何设计可序列化的数据传输对象（DTO），作为限界上下文与外部世界之间的中介，并介绍了一系列有助于你自己实现的指南。

序列化是与外部世界交互的一种方式，但不是唯一方式。在大多数应用中，我们还需要与某种数据库打交道。下一章将把注意力转向持久化的技术与挑战——如何让领域模型与关系数据库和 NoSQL 数据库协同工作。

---

[← 上一章：处理错误](ch10-working-with-errors.md) | [返回目录](../index.md) | [下一章：持久化 →](ch12-persistence.md)
