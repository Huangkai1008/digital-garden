# 第9章：实现：组合管道

> 到目前为止，我们花了很多时间仅用类型来建模领域，却还没有实现任何东西！现在就来弥补这一点。接下来两章，我们将基于之前的设计（第 7 章《将工作流建模为管道》，第 119 页）用函数式原则实现它。

---

回顾第 7 章的设计，工作流可以看作一系列文档转换——一条**管道（pipeline）**——其中每一步都设计成一段「管道」。

从技术角度看，我们的管道包含以下阶段：

- 从 `UnvalidatedOrder` 开始，转换为 `ValidatedOrder`，若验证失败则返回错误
- 取验证步骤的输出（`ValidatedOrder`），加上额外信息，得到 `PricedOrder`
- 取定价步骤的输出，生成确认信并发送
- 创建表示所发生事件的一组事件并返回

我们希望把这些变成代码，在保留原始需求的同时不被技术细节缠住。

下面是我们希望用第 156 页讨论的管道方式连接各步骤函数时的代码形态：

```fsharp
let placeOrder unvalidatedOrder =
    unvalidatedOrder
    |> validateOrder
    |> priceOrder
    |> acknowledgeOrder
    |> createEvents
```

这段代码——一系列步骤——即使对非开发者来说也容易理解，所以我们来看看需要做什么才能实现它。实现该工作流有两部分：创建各个步骤，然后把它们组合在一起。

首先，我们将把管道中的每一步实现为独立函数，确保其无状态且无副作用，以便可以独立测试和推理。

接下来，只需把这些小函数组合成一个更大的函数。理论上听起来简单。但正如我们之前提到的，真正动手时会遇到问题：按设计写出的函数并不能很好地对接——一个的输出与下一个的输入不匹配。要克服这一点，我们需要学会如何操纵每一步的输入和输出，使它们能够组合。

函数无法组合有两个原因：

- 有些函数有额外的参数，它们不是数据管道的一部分，但实现时需要——我们称之为「依赖（dependencies）」
- 我们在函数签名中用 `Result` 等包装类型明确表示「效应（effects）」（如错误处理），这意味着输出带效应的函数无法直接连接到输入为普通数据的函数

本章我们处理第一个问题，即处理作为依赖的输入，并学习如何做函数式意义上的「依赖注入」。至于如何处理效应，我们留到下一章。

因此，在第一次动手写真实代码时，我们将实现所有步骤，而不考虑 `Result` 和 `Async` 等效应。这样我们可以专注于组合的基础。

## 9.1 使用简单类型

在实现工作流本身之前，我们需要先实现「简单类型（simple types）」，例如 `OrderId` 和 `ProductCode`。

由于大多数类型都有某种约束，我们将遵循第 104 页讨论的约束类型实现大纲。

因此，对每个简单类型我们至少需要两个函数：

- **create** 函数：从原始类型（如 `string` 或 `int`）构造该类型——例如 `OrderId.create` 会从字符串创建 `OrderId`，若格式错误则抛出错误
- **value** 函数：提取内部原始值

我们通常把这些辅助函数放在与简单类型相同的文件中，使用与类型同名的模块。例如，下面是 `Domain` 模块中 `OrderId` 的定义及其辅助函数：

```fsharp
module Domain =
    type OrderId = private OrderId of string

module OrderId =
    /// Define a "Smart constructor" for OrderId
    /// string -> OrderId
    let create str =
        if String.IsNullOrEmpty(str) then
            // use exceptions rather than Result for now
            failwith "OrderId must not be null or empty"
        elif str.Length > 50 then
            failwith "OrderId must not be more than 50 chars"
        else
            OrderId str

    /// Extract the inner value from an OrderId
    /// OrderId -> string
    let value (OrderId str) = // unwrap in the parameter!
        str // return the inner value
```

- `create` 函数与指南版本类似，但因为我们暂时避免效应，所以用异常（`failwith`）处理错误，而不是返回 `Result`
- `value` 函数展示了如何在参数中直接通过模式匹配一步提取内部值

## 9.2 使用函数类型指导实现

在建模章节中，我们定义了特殊的函数类型来表示工作流的每一步。现在到了实现阶段，如何确保代码符合这些类型？

### 9.2.1 两种实现方式

最简单的方式是直接按通常方式定义函数，相信后续使用时若出错会得到类型检查错误。例如，我们可以这样定义 `validateOrder`，不引用之前设计的 `ValidateOrder` 类型：

```fsharp
let validateOrder
    checkProductCodeExists // dependency
    checkAddressExists     // dependency
    unvalidatedOrder =     // input
    ...
```

这是大多数 F# 代码的标准做法，但若想明确表示我们在实现某个函数类型，可以采用另一种风格：将函数写成一个带类型注解的值（无参数），函数体写成 lambda：

```fsharp
// define a function signature
type MyFunctionSignature = Param1 -> Param2 -> Result

// define a function that implements that signature
let myFunc: MyFunctionSignature =
    fun param1 param2 ->
    ...
```

把这种写法应用到 `validateOrder` 得到：

```fsharp
let validateOrder : ValidateOrder =
    fun checkProductCodeExists checkAddressExists unvalidatedOrder ->
    // ^dependency ^dependency ^input
    ...
```

这样写的好处是：所有参数和返回值都由函数类型决定，若实现出错，错误会出现在函数定义内部，而不是在后续组装函数时。

### 9.2.2 类型检查示例

下面是一个类型检查在工作中的例子，我们不小心把整数传给了 `checkProductCodeExists`：

```fsharp
let validateOrder : ValidateOrder =
    fun checkProductCodeExists checkAddressExists unvalidatedOrder ->
        if checkProductCodeExists 42 then
        // compiler error ^
        // This expression was expected to have type ProductCode
        // but here has type int
            ...
```

若没有函数类型来约束参数类型，编译器会使用类型推断，可能推断出 `checkProductCodeExists` 接受整数，从而在别处产生（可能令人困惑的）编译错误。

## 9.3 实现验证步骤

现在可以开始实现验证步骤。验证步骤将接收未验证订单（及其所有原始字段），并转换为正确、完全验证过的领域对象。

我们为该步骤建模的函数类型如下：

```fsharp
type CheckAddressExists =
    UnvalidatedAddress -> AsyncResult<CheckedAddress,AddressValidationError>

type ValidateOrder =
    CheckProductCodeExists // dependency
    -> CheckAddressExists   // AsyncResult dependency
    -> UnvalidatedOrder    // input
    -> AsyncResult<ValidatedOrder,ValidationError list> // output
```

如前所述，本章我们先消除效应，因此可以去掉 `AsyncResult` 部分，得到：

```fsharp
type CheckAddressExists =
    UnvalidatedAddress -> CheckedAddress

type ValidateOrder =
    CheckProductCodeExists // dependency
    -> CheckAddressExists  // dependency
    -> UnvalidatedOrder    // input
    -> ValidatedOrder     // output
```

将其转换为实现。从 `UnvalidatedOrder` 创建 `ValidatedOrder` 的步骤如下：

- 从未验证订单中对应的 `OrderId` 字符串创建 `OrderId` 领域类型
- 从未验证订单的 `UnvalidatedCustomerInfo` 字段创建 `CustomerInfo` 领域类型
- 从 `ShippingAddress` 字段（类型为 `UnvalidatedAddress`）创建 `Address` 领域类型
- 对 `BillingAddress` 及其他属性做同样处理
- 一旦有了 `ValidatedOrder` 的所有组成部分，就可以按通常方式创建记录

### 9.3.1 实现代码骨架

代码大致如下：

```fsharp
let validateOrder : ValidateOrder =
    fun checkProductCodeExists checkAddressExists unvalidatedOrder ->
        let orderId =
            unvalidatedOrder.OrderId
            |> OrderId.create
        let customerInfo =
            unvalidatedOrder.CustomerInfo
            |> toCustomerInfo // helper function
        let shippingAddress =
            unvalidatedOrder.ShippingAddress
            |> toAddress // helper function
        // and so on, for each property of the unvalidatedOrder
        // when all the fields are ready, use them to
        // create and return a new "ValidatedOrder" record
        {
            OrderId = orderId
            CustomerInfo = customerInfo
            ShippingAddress = shippingAddress
            BillingAddress = ...
            Lines = ...
        }
```

可以看到我们使用了一些尚未定义的辅助函数，如 `toCustomerInfo` 和 `toAddress`。这些函数从未验证类型构造领域类型。例如，`toAddress` 会把 `UnvalidatedAddress` 转换为对应的领域类型 `Address`，若未验证地址中的原始值不满足约束（如非空、长度小于 50 字符），则会抛出错误。

有了这些辅助函数后，将未验证订单（或任何非领域类型）转换为领域类型的逻辑就很直接：对领域类型的每个字段（这里是 `ValidatedOrder`），找到非领域类型（`UnvalidatedOrder`）中的对应字段，用某个辅助函数将其转换为领域类型。

对订单的子组件也可以采用完全相同的做法。例如，下面是 `toCustomerInfo` 的实现，它从 `UnvalidatedCustomerInfo` 构建 `CustomerInfo`：

```fsharp
let toCustomerInfo (customer:UnvalidatedCustomerInfo) : CustomerInfo =
    // create the various CustomerInfo properties
    // and throw exceptions if invalid
    let firstName = customer.FirstName |> String50.create
    let lastName = customer.LastName |> String50.create
    let emailAddress = customer.EmailAddress |> EmailAddress.create
    // create a PersonalName
    let name : PersonalName = {
        FirstName = firstName
        LastName = lastName
    }
    // create a CustomerInfo
    let customerInfo : CustomerInfo = {
        Name = name
        EmailAddress = emailAddress
    }
    // ... and return it
    customerInfo
```

### 9.3.2 创建已验证、已检查的地址

`toAddress` 函数稍复杂一些，因为它不仅要把原始类型转换为领域对象，还要检查地址是否存在（使用 `CheckAddressExists` 服务）。下面是完整实现及注释：

```fsharp
let toAddress (checkAddressExists:CheckAddressExists) unvalidatedAddress =
    // call the remote service
    let checkedAddress = checkAddressExists unvalidatedAddress
    // extract the inner value using pattern matching
    let (CheckedAddress checkedAddress) = checkedAddress
    let addressLine1 =
        checkedAddress.AddressLine1 |> String50.create
    let addressLine2 =
        checkedAddress.AddressLine2 |> String50.createOption
    let addressLine3 =
        checkedAddress.AddressLine3 |> String50.createOption
    let addressLine4 =
        checkedAddress.AddressLine4 |> String50.createOption
    let city =
        checkedAddress.City |> String50.create
    let zipCode =
        checkedAddress.ZipCode |> ZipCode.create
    // create the address
    let address : Address = {
        AddressLine1 = addressLine1
        AddressLine2 = addressLine2
        AddressLine3 = addressLine3
        AddressLine4 = addressLine4
        City = city
        ZipCode = zipCode
    }
    // return the address
    address
```

::: info 关于 String50.createOption
我们引用了 `String50` 模块中的另一个构造函数——`String50.createOption`——它允许输入为 null 或空，并在该情况下返回 `None`。
:::

`toAddress` 需要调用 `checkAddressExists`，因此我们把它作为参数传入；现在从父函数 `validateOrder` 中传入该函数：

```fsharp
let validateOrder : ValidateOrder =
    fun checkProductCodeExists checkAddressExists unvalidatedOrder ->
        let orderId = ...
        let customerInfo = ...
        let shippingAddress =
            unvalidatedOrder.ShippingAddress
            |> toAddress checkAddressExists // new parameter
        ...
```

你可能会奇怪，为什么我们只传一个参数给 `toAddress`，而它实际有两个参数。第二个参数（收货地址）是通过管道过程提供的。这是第 153 页讨论的**部分应用（partial application）**技术的例子。

### 9.3.3 创建订单行

创建订单行列表更复杂一些。首先，我们需要一种方式将单个 `UnvalidatedOrderLine` 转换为 `ValidatedOrderLine`。我们称其为 `toValidatedOrderLine`：

```fsharp
let toValidatedOrderLine checkProductCodeExists
    (unvalidatedOrderLine:UnvalidatedOrderLine) =
    let orderLineId =
        unvalidatedOrderLine.OrderLineId
        |> OrderLineId.create
    let productCode =
        unvalidatedOrderLine.ProductCode
        |> toProductCode checkProductCodeExists // helper function
    let quantity =
        unvalidatedOrderLine.Quantity
        |> toOrderQuantity productCode // helper function
    let validatedOrderLine = {
        OrderLineId = orderLineId
        ProductCode = productCode
        Quantity = quantity
    }
    validatedOrderLine
```

这与上面的 `toAddress` 类似。有两个辅助函数：`toProductCode` 和 `toOrderQuantity`，我们稍后讨论。

有了转换列表中每个元素的方式后，可以用 `List.map`（相当于 C# LINQ 的 `Select`）一次性转换整个列表，得到可用于 `ValidatedOrder` 的 `ValidatedOrderLine` 列表：

```fsharp
let validateOrder : ValidateOrder =
    fun checkProductCodeExists checkAddressExists unvalidatedOrder ->
        let orderId = ...
        let customerInfo = ...
        let shippingAddress = ...
        let orderLines =
            unvalidatedOrder.Lines
            // convert each line using `toValidatedOrderLine`
            |> List.map (toValidatedOrderLine checkProductCodeExists)
        ...
```

接下来看辅助函数 `toOrderQuantity`。这是有界上下文边界处验证的好例子：输入是来自 `UnvalidatedOrderLine` 的原始未验证小数，而输出（`OrderQuantity`）是选择类型，每种情况有不同的验证逻辑：

```fsharp
let toOrderQuantity productCode quantity =
    match productCode with
    | Widget _ ->
        quantity
        |> int // convert decimal to int
        |> UnitQuantity.create // to UnitQuantity
        |> OrderQuantity.Unit // lift to OrderQuantity type
    | Gizmo _ ->
        quantity
        |> KilogramQuantity.create // to KilogramQuantity
        |> OrderQuantity.Kilogram // lift to OrderQuantity type
```

我们使用 `ProductCode` 选择类型的分支来指导构造。例如，若 `ProductCode` 是 `Widget`，就把原始小数转换为 `int`，并从中创建 `UnitQuantity`。`GizmoCode` 分支同理。

但不能到此为止。若这样，一个分支会返回 `UnitQuantity`，另一个返回 `KilogramQuantity`，类型不同，会得到编译错误。通过把两个分支都转换为选择类型 `OrderQuantity`，我们确保两个分支返回相同类型，编译器才能通过。

### 9.3.4 创建函数适配器

另一个辅助函数 `toProductCode` 乍看应该很简单。我们希望尽量用管道写函数，所以代码大概是这样：

```fsharp
let toProductCode (checkProductCodeExists:CheckProductCodeExists) productCode =
    productCode
    |> ProductCode.create
    |> checkProductCodeExists
    // returns a bool :(
```

但这里有个问题。我们希望 `toProductCode` 返回 `ProductCode`，而 `checkProductCodeExists` 返回 `bool`，意味着整个管道返回 `bool`。我们需要某种方式让 `checkProductCodeExists` 返回 `ProductCode` 而不是 `bool`。难道要改规格？幸运的是不用。我们来看看怎么做。

我们有一个返回 `bool` 的函数，但真正需要的是在一切顺利时返回原始 `ProductCode` 输入的函数。与其改规格，不如创建一个「适配器（adapter）」函数：接收原函数作为输入，输出一个具有正确「形状」的新函数，以便在管道中使用。

```text
ProductCode ──→ Bool
     │
     │  Adapter Function
     │
     └──→ ProductCode ──→ ProductCode
          Original function    Adapted function
          Input                Output
```

下面是直观的实现，参数包括返回 bool 的谓词（`checkProductCodeExists`）和要检查的值（`productCode`）：

```fsharp
let convertToPassthru checkProductCodeExists productCode =
    if checkProductCodeExists productCode then
        productCode
    else
        failwith "Invalid Product Code"
```

有趣的是，编译器推断出这个实现是**完全泛型**的——与我们的具体场景无关！看函数签名，你会发现没有任何地方提到 `ProductCode` 类型：

```fsharp
val convertToPassthru :
    checkProductCodeExists:('a -> bool) -> productCode:'a -> 'a
```

实际上，我们无意中创建了一个泛型适配器，可以把任何谓词函数转换为适合管道的「透传（passthrough）」函数。

把参数命名为 `checkProductCodeExists` 或 `productCode` 现在就不太合适了——它们可以是任何东西。这就是为什么很多标准库函数的参数名都很短，如 `f`、`g` 表示函数参数，`x`、`y` 表示其他值。

让我们用更抽象的名字重写该函数：

```fsharp
let predicateToPassthru f x =
    if f x then
        x
    else
        failwith "Invalid Product Code"
```

现在硬编码的错误信息显得突兀，所以我们也把它参数化。下面是最终版本：

```fsharp
let predicateToPassthru errorMsg f x =
    if f x then
        x
    else
        failwith errorMsg
```

注意我们把错误信息放在参数顺序的第一位，以便用部分应用预先「烘焙」进去。

该函数的签名是：

```fsharp
val predicateToPassthru : errorMsg:string -> f:('a -> bool) -> x:'a -> 'a
```

可以理解为：「你给我一个错误信息和类型为 `'a -> bool` 的函数，我返回一个类型为 `'a -> 'a` 的函数。」因此 `predicateToPassthru` 是一个「函数转换器（function transformer）」——你喂给它一个函数，它会转换成另一个函数。

这种技术在函数式编程中极为常见，理解其原理并能在看到时识别这种模式很重要。甚至 `List.map` 也可以看作函数转换器——它把「普通」函数 `'a -> 'b` 转换为作用于列表的函数（`'a list -> 'b list`）。

现在用这个泛型函数创建 `toProductCode` 的新版本，供实现使用：

```fsharp
let toProductCode (checkProductCodeExists:CheckProductCodeExists) productCode =
    // create a local ProductCode -> ProductCode function
    // suitable for using in a pipeline
    let checkProduct productCode =
        let errorMsg = sprintf "Invalid: %A" productCode
        predicateToPassthru errorMsg checkProductCodeExists productCode
    // assemble the pipeline
    productCode
    |> ProductCode.create
    |> checkProduct
```

至此，我们有了一个可以在此基础上构建的 `validateOrder` 实现基本草图。注意，低层验证逻辑（如「产品代码必须以 W 或 G 开头」）并未显式写在验证函数中，而是内置于约束简单类型（如 `OrderId` 和 `ProductCode`）的构造器中。使用类型可以增强我们对代码正确性的信心——能够成功从 `UnvalidatedOrder` 创建 `ValidatedOrder` 这一事实本身，就说明我们可以信任它是已验证的。

## 9.4 实现其余步骤

实现 `validateOrder` 的方式已见，接下来可以用同样的技术构建管道其余函数。

### 9.4.1 定价步骤

定价步骤的原始设计（带效应）如下：

```fsharp
type PriceOrder =
    GetProductPrice // dependency
    -> ValidatedOrder // input
    -> Result<PricedOrder, PlaceOrderError> // output
```

同样，我们先消除效应，得到：

```fsharp
type GetProductPrice = ProductCode -> Price

type PriceOrder =
    GetProductPrice // dependency
    -> ValidatedOrder // input
    -> PricedOrder // output
```

实现的大致结构如下。它只是把每个订单行转换为 `PricedOrderLine`，并用它们构建新的 `PricedOrder`：

```fsharp
let priceOrder : PriceOrder =
    fun getProductPrice validatedOrder ->
        let lines =
            validatedOrder.Lines
            |> List.map (toPricedOrderLine getProductPrice)
        let amountToBill =
            lines
            // get each line price
            |> List.map (fun line -> line.LinePrice)
            // add them together as a BillingAmount
            |> BillingAmount.sumPrices
        let pricedOrder : PricedOrder = {
            OrderId = validatedOrder.OrderId
            CustomerInfo = validatedOrder.CustomerInfo
            ShippingAddress = validatedOrder.ShippingAddress
            BillingAddress = validatedOrder.BillingAddress
            Lines = lines
            AmountToBill = amountToBill
        }
        pricedOrder
```

::: tip 占位实现
若管道中有很多步骤，而你暂时不想实现（或不知道如何实现），可以先用 `failwith "not implemented"` 占位：

```fsharp
let priceOrder : PriceOrder =
    fun getProductPrice validatedOrder ->
        failwith "not implemented"
```

使用「未实现」异常在勾勒实现时很方便，可以确保项目始终能完整编译。例如，可以用这种方式为某个管道阶段构建一个符合函数类型的占位版本，在正式实现前与其他阶段一起使用。
:::

回到 `priceOrder` 的实现，我们引入了两个新辅助函数：`toPricedOrderLine` 和 `BillingAmount.sumPrices`。

我们把 `BillingAmount.sumPrices` 放在共享的 `BillingAmount` 模块中（与 `create` 和 `value` 一起）。它只是把价格列表相加并包装为 `BillingAmount`。为什么一开始要定义 `BillingAmount` 类型？因为它与 `Price` 不同，验证规则可能也不同。

```fsharp
/// Sum a list of prices to make a billing amount
/// Raise exception if total is out of bounds
let sumPrices prices =
    let total = prices |> List.map Price.value |> List.sum
    create total
```

`toPricedOrderLine` 与之前见过的类似，是只转换单行的辅助函数：

```fsharp
/// Transform a ValidatedOrderLine to a PricedOrderLine
let toPricedOrderLine getProductPrice (line:ValidatedOrderLine) : PricedOrderLine =
    let qty = line.Quantity |> OrderQuantity.value
    let price = line.ProductCode |> getProductPrice
    let linePrice = price |> Price.multiply qty
    {
        OrderLineId = line.OrderLineId
        ProductCode = line.ProductCode
        Quantity = line.Quantity
        LinePrice = linePrice
    }
```

在此函数中，我们还引入了另一个辅助函数 `Price.multiply`，用于将 `Price` 乘以数量：

```fsharp
/// Multiply a Price by a decimal qty.
/// Raise exception if new price is out of bounds.
let multiply qty (Price p) =
    create (qty * p)
```

定价步骤至此完成。

### 9.4.2 确认步骤

确认步骤的设计（已去除效应）如下：

```fsharp
type HtmlString = HtmlString of string

type CreateOrderAcknowledgmentLetter =
    PricedOrder -> HtmlString

type OrderAcknowledgment = {
    EmailAddress : EmailAddress
    Letter : HtmlString
}

type SendResult = Sent | NotSent

type SendOrderAcknowledgment =
    OrderAcknowledgment -> SendResult

type AcknowledgeOrder =
    CreateOrderAcknowledgmentLetter // dependency
    -> SendOrderAcknowledgment      // dependency
    -> PricedOrder                  // input
    -> OrderAcknowledgmentSent option // output
```

实现如下：

```fsharp
let acknowledgeOrder : AcknowledgeOrder =
    fun createAcknowledgmentLetter sendAcknowledgment pricedOrder ->
        let letter = createAcknowledgmentLetter pricedOrder
        let acknowledgment = {
            EmailAddress = pricedOrder.CustomerInfo.EmailAddress
            Letter = letter
        }
        // if the acknowledgment was successfully sent,
        // return the corresponding event, else return None
        match sendAcknowledgment acknowledgment with
        | Sent ->
            let event = {
                OrderId = pricedOrder.OrderId
                EmailAddress = pricedOrder.CustomerInfo.EmailAddress
            }
            Some event
        | NotSent ->
            None
```

实现很直接，不需要辅助函数。

至于 `sendAcknowledgment` 依赖，我们迟早要决定其实现。但目前可以先放着。用函数参数化依赖的一大好处是：可以推迟决策到「最后责任时刻」，同时仍能构建和组装大部分代码。

### 9.4.3 创建事件

最后，只需创建要从工作流返回的事件。我们给需求加一点变化：仅当应付金额大于零时才发送账单事件。设计如下：

```fsharp
/// Event to send to shipping context
type OrderPlaced = PricedOrder

/// Event to send to billing context
/// Will only be created if the AmountToBill is not zero
type BillableOrderPlaced = {
    OrderId : OrderId
    BillingAddress: Address
    AmountToBill : BillingAmount
}

type PlaceOrderEvent =
    | OrderPlaced of OrderPlaced
    | BillableOrderPlaced of BillableOrderPlaced
    | AcknowledgmentSent of OrderAcknowledgmentSent

type CreateEvents =
    PricedOrder                    // input
    -> OrderAcknowledgmentSent option // input (event from previous step)
    -> PlaceOrderEvent list        // output
```

我们不需要创建 `OrderPlaced` 事件，因为它就是 `PricedOrder`；`OrderAcknowledgmentSent` 事件会在上一步创建，所以也不需要再创建。

但需要 `BillableOrderPlaced` 事件，所以写一个 `createBillingEvent` 函数。由于要测试非零应付金额，该函数必须返回可选事件：

```fsharp
// PricedOrder -> BillableOrderPlaced option
let createBillingEvent (placedOrder:PricedOrder) : BillableOrderPlaced option =
    let billingAmount = placedOrder.AmountToBill |> BillingAmount.value
    if billingAmount > 0M then
        let order = {
            OrderId = placedOrder.OrderId
            BillingAddress = placedOrder.BillingAddress
            AmountToBill = placedOrder.AmountToBill
        }
        Some order
    else
        None
```

现在我们有了 `OrderPlaced` 事件、可选的 `OrderAcknowledgmentSent` 事件和可选的 `BillableOrderPlaced`。如何返回它们？我们使用第 158 页的「最小公倍数」方法，把一切转换为共同类型。

之前我们决定为每个事件创建一个选择类型（`PlaceOrderEvent`），然后返回这些事件的列表。所以首先要把每个事件转换为选择类型。对 `OrderPlaced`，可以直接用 `PlaceOrderEvent.OrderPlaced` 构造器；对 `OrderAcknowledgmentSent` 和 `BillableOrderPlaced`，需要用 `Option.map`，因为它们是可选的。

```fsharp
let createEvents : CreateEvents =
    fun pricedOrder acknowledgmentEventOpt ->
        let event1 =
            pricedOrder
            // convert to common choice type
            |> PlaceOrderEvent.OrderPlaced
        let event2Opt =
            acknowledgmentEventOpt
            // convert to common choice type
            |> Option.map PlaceOrderEvent.AcknowledgmentSent
        let event3Opt =
            pricedOrder
            |> createBillingEvent
            // convert to common choice type
            |> Option.map PlaceOrderEvent.BillableOrderPlaced
        // return all the events how?
        ...
```

现在它们都是同一类型，但有些是可选的。如何处理？我们再用同样的技巧，把它们都转换为更一般的类型——这里是列表。

对 `OrderPlaced` 可以用 `List.singleton` 转为列表；对 `option` 可以写一个叫 `listOfOption` 的辅助函数：

```fsharp
/// convert an Option into a List
let listOfOption opt =
    match opt with
    | Some x -> [x]
    | None -> []
```

有了它，三种事件类型都统一了，可以在另一个列表中返回：

```fsharp
let createEvents : CreateEvents =
    fun pricedOrder acknowledgmentEventOpt ->
        let events1 =
            pricedOrder
            |> PlaceOrderEvent.OrderPlaced
            |> List.singleton
        let events2 =
            acknowledgmentEventOpt
            |> Option.map PlaceOrderEvent.AcknowledgmentSent
            |> listOfOption
        let events3 =
            pricedOrder
            |> createBillingEvent
            |> Option.map PlaceOrderEvent.BillableOrderPlaced
            |> listOfOption
        // return all the events
        [
            yield! events1
            yield! events2
            yield! events3
        ]
```

这种把不兼容的东西转换或「提升（lifting）」到共享类型的方法，是处理组合问题的关键技术。例如，下一章我们会用它处理不同 `Result` 类型之间的不匹配。

## 9.5 组合管道步骤

现在可以把各步骤的实现组合成管道，完成工作流。我们希望代码大致是这样：

```fsharp
let placeOrder : PlaceOrderWorkflow =
    fun unvalidatedOrder ->
        unvalidatedOrder
        |> validateOrder
        |> priceOrder
        |> acknowledgeOrder
        |> createEvents
```

但有个问题：`validateOrder` 除了 `UnvalidatedOrder` 还有两个额外输入。照目前这样，很难把 `PlaceOrder` 工作流的输入连接到 `validateOrder`，因为输入输出不匹配。

```text
UnvalidatedOrder ──→ ValidateOrder ──→ ValidatedOrder
     ↑                    ↑
     │              CheckProductCodeExists
     │              CheckAddressExists
     │                    (dependencies)
     │
From workflow input
```

`priceOrder` 有两个输入，所以也无法直接接到 `validateOrder` 的输出：

```text
ValidatedOrder ──→ PriceOrder ──→ PricedOrder
                      ↑
                GetProductPrice (dependency)
```

如第 136 页所述，组合这种「形状」不同的函数是函数式编程的主要挑战之一，已有多种技术来解决。大多数方案涉及令人望而生畏的「monad」，所以这里我们采用非常简单的做法：使用第 153 页介绍的**部分应用**。我们只对 `validateOrder` 应用三个参数中的两个（两个依赖），得到只有一个输入的新函数。

```text
UnvalidatedOrder ──→ ValidateOrder ──→ ValidatedOrder
     ↑                    ↑
     │              CheckProductCodeExists
     │              CheckAddressExists
     │         (dependencies baked in with partial application)
     │
From workflow input
```

代码可以这样写：

```fsharp
let validateOrderWithDependenciesBakedIn =
    validateOrder checkProductCodeExists checkAddressExists
// new function signature after partial application:
// UnvalidatedOrder -> ValidatedOrder
```

当然，这名字太丑了！好在 F# 中可以在局部用同一个名字（`validateOrder`）给新函数命名——这叫「遮蔽（shadowing）」：

```fsharp
let validateOrder =
    validateOrder checkProductCodeExists checkAddressExists
```

或者用带撇号的名字（`validateOrder'`）表示它是原函数的变体：

```fsharp
let validateOrder' =
    validateOrder checkProductCodeExists checkAddressExists
```

可以用同样方式把依赖「烘焙」进 `priceOrder` 和 `acknowledgeOrder`，使它们也变成单参数函数。

主工作流函数 `placeOrder` 现在大致如下：

```fsharp
let placeOrder : PlaceOrderWorkflow =
    // set up local versions of the pipeline stages
    // using partial application to bake in the dependencies
    let validateOrder =
        validateOrder checkProductCodeExists checkAddressExists
    let priceOrder =
        priceOrder getProductPrice
    let acknowledgeOrder =
        acknowledgeOrder createAcknowledgmentLetter sendOrderAcknowledgment
    // return the workflow function
    fun unvalidatedOrder ->
        // compose the pipeline from the new one-parameter functions
        unvalidatedOrder
        |> validateOrder
        |> priceOrder
        |> acknowledgeOrder
        |> createEvents
```

有时即使这样做，函数仍对不上。在我们的例子中，`acknowledgeOrder` 的输出只是事件，不是定价订单，所以与 `createEvents` 的输入不匹配。

可以写一个小适配器，或者干脆改用更命令式的风格，把每步的输出显式赋给变量：

```fsharp
let placeOrder : PlaceOrderWorkflow =
    // return the workflow function
    fun unvalidatedOrder ->
        let validatedOrder =
            unvalidatedOrder
            |> validateOrder checkProductCodeExists checkAddressExists
        let pricedOrder =
            validatedOrder
            |> priceOrder getProductPrice
        let acknowledgmentOption =
            pricedOrder
            |> acknowledgeOrder createOrderAcknowledgmentLetter sendOrderAcknowledgment
        let events =
            createEvents pricedOrder acknowledgmentOption
        events
```

虽不如管道优雅，但仍易于理解和维护。

下一个问题：`checkProductCodeExists`、`checkAddressExists`、`priceOrder` 等依赖从哪来？我们不想在全局定义它们，所以来看看如何「注入」这些依赖。

## 9.6 注入依赖

我们有很多低层辅助函数（如 `toValidProductCode`），它们接受表示服务的函数参数。这些在设计深处，如何把依赖从顶层传到需要它们的函数？

若用面向对象编程，我们会用依赖注入，可能还有 IoC 容器。在函数式编程中，我们不想这样做，因为依赖会变得隐式。我们始终希望把依赖作为**显式参数**传递，这样依赖一目了然。

函数式编程中有多种技术可以做到这一点，如「Reader Monad」和「Free Monad」，但作为入门书，我们采用最简单的方式：**把所有依赖传入顶层函数**，再由它传入内部函数，内部函数再传给它们的内部函数，如此层层传递。

假设我们按之前的定义实现了辅助函数：

```fsharp
// low-level helper functions
let toAddress checkAddressExists unvalidatedAddress =
    ...

let toProductCode checkProductCodeExists productCode =
    ...
```

它们都有显式的依赖参数。

作为创建订单行的一部分，需要创建产品代码，所以 `toValidatedOrderLine` 要用 `toProductCode`，这意味着 `toValidatedOrderLine` 也需要 `checkProductCodeExists` 参数：

```fsharp
// helper function
let toValidatedOrderLine checkProductExists unvalidatedOrderLine =
// ^ needed for toProductCode, below
    // create the components of the line
    let orderLineId = ...
    let productCode =
        unvalidatedOrderLine.ProductCode
        |> toProductCode checkProductExists // use service
    ...
```

再往上一层，`validateOrder` 需要同时使用 `toAddress` 和 `toValidatedOrderLine`，所以它也需要把两个服务作为额外参数传入：

```fsharp
let validateOrder : ValidateOrder =
    fun checkProductExists  // dependency for toValidatedOrderLine
        checkAddressExists  // dependency for toAddress
        unvalidatedOrder ->
        // build the validated address using the dependency
        let shippingAddress =
            unvalidatedOrder.ShippingAddress
            |> toAddress checkAddressExists
        ...
        // build the validated order lines using the dependency
        let lines =
            unvalidatedOrder.Lines
            |> List.map (toValidatedOrderLine checkProductExists)
        ...
```

如此层层向上，直到顶层函数，由它设置所有服务和其他依赖。在面向对象设计中，这个顶层函数通常叫**组合根（composition root）**，我们沿用这个术语。

`placeOrder` 工作流函数应该充当组合根吗？不，因为设置服务通常涉及访问配置等。更好的做法是让 `placeOrder` 工作流本身以参数形式接收所需服务：

```fsharp
let placeOrder
    checkProductExists           // dependency
    checkAddressExists           // dependency
    getProductPrice              // dependency
    createOrderAcknowledgmentLetter // dependency
    sendOrderAcknowledgment      // dependency
    : PlaceOrderWorkflow =       // function definition
    fun unvalidatedOrder ->
        ...
```

这样还有一个好处：整个工作流易于测试，因为所有依赖都可以伪造。

实践中，组合根函数应尽可能靠近应用的入口点——控制台应用的 `main` 函数，或 Web 服务等长运行应用的 `OnStartup`/`Application_Start` 处理器。

下面是使用 Suave 框架的 Web 服务的组合根示例：

```fsharp
let app : WebPart =
    // set up the services used by the workflow
    let checkProductExists = ...
    let checkAddressExists = ...
    let getProductPrice = ...
    let createOrderAcknowledgmentLetter = ...
    let sendOrderAcknowledgment = ...
    let toHttpResponse = ...

    // set up the "placeOrder" workflow
    // by partially applying the services to it
    let placeOrder =
        placeOrder
            checkProductExists
            checkAddressExists
            getProductPrice
            createOrderAcknowledgmentLetter
            sendOrderAcknowledgment

    // set up the other workflows
    let changeOrder = ...
    let cancelOrder = ...

    // set up the routing
    choose
        [ POST >=> choose
            [ path "/placeOrder"
                >=> deserializeOrder  // convert JSON to UnvalidatedOrder
                >=> placeOrder        // do the workflow
                >=> postEvents        // post the events onto queues
                >=> toHttpResponse    // return 200/400/etc based on the output
              path "/changeOrder"
                >=> ...
              path "/cancelOrder"
                >=> ...
            ]
        ]
```

可以看到，若路径是 `/placeOrder`，我们启动「下单」流程：先反序列化输入，再调用主 `placeOrder` 管道，然后发布事件，最后根据输出转换为 HTTP 响应。除 `placeOrder` 外的函数篇幅有限无法详述，反序列化技术在第 11 章（序列化，第 221 页）讨论。

### 9.6.1 依赖太多？

`validateOrder` 有两个依赖。若需要四个、五个或更多呢？若其他步骤也需要大量依赖，可能会爆炸。若发生这种情况，该怎么办？

首先，可能是函数做了太多事。能否拆成更小的部分？若不行，可以把依赖分组到一个记录结构中，作为单个参数传递。

常见情况是子函数的依赖本身特别复杂。例如，假设 `checkAddressExists` 要调用需要 URI 端点和凭据的 Web 服务：

```fsharp
let checkAddressExists endPoint credentials =
    ...
```

我们是否也要把这两个额外参数传给 `toAddress` 的调用者？

```fsharp
let toAddress checkAddressExists endPoint credentials unvalidatedAddress =
// only ^ needed ^ for checkAddressExists
    // call the remote service
    let checkedAddress = checkAddressExists endPoint credentials unvalidatedAddress
    // 2 extra parameters ^ passed in ^
    ...
```

然后还要把这些额外参数传给 `toAddress` 的调用者，一路传到顶层：

```fsharp
let validateOrder
    checkProductExists
    checkAddressExists
    endPoint    // only needed for checkAddressExists
    credentials // only needed for checkAddressExists
    unvalidatedOrder =
    ...
```

不，当然不应该这样做。这些中间函数不需要知道 `checkAddressExists` 的依赖。更好的做法是：**在顶层函数之外设置低层函数**，然后只传入一个已预构建好的子函数，其依赖已全部烘焙进去。

例如，在下面的代码中，我们在设置阶段把 URI 和凭据烘焙进 `checkAddressExists`，此后它就可以作为单参数函数使用。这个简化后的函数可以像以前一样到处传递：

```fsharp
let placeOrder : PlaceOrderWorkflow =
    // initialize information (e.g from configuration)
    let endPoint = ...
    let credentials = ...

    // make a new version of checkAddressExists
    // with the credentials baked in
    let checkAddressExists = checkAddressExists endPoint credentials
    // etc

    // set up the steps in the workflow
    let validateOrder =
        validateOrder checkProductCodeExists checkAddressExists
    // the new checkAddressExists ^ is a one parameter function
    // etc

    // return the workflow function
    fun unvalidatedOrder ->
        // compose the pipeline from the steps
        ...
```

这种通过传入「预构建」辅助函数来减少参数的做法是常见技术，有助于隐藏复杂性。当一个函数传入另一个函数时，「接口」——即函数类型——应尽可能最小，所有依赖都隐藏起来。

## 9.7 测试依赖

这样传递依赖的一大好处是：核心函数非常容易测试，因为可以轻松提供假的、但能工作的依赖，无需任何专门的 mock 库。

例如，假设要测试验证中产品代码相关逻辑是否正常。一个测试应检查：若 `checkProductCodeExists` 成功，整个验证应成功。另一个测试应检查：若 `checkProductCodeExists` 失败，整个验证应失败。我们来看看如何写这些测试。

开始前有个提示：F# 允许创建带空格和标点的标识符，只要用双反引号括起来。正常代码中不建议这样做，但测试函数中可以接受，因为能让测试输出更易读。

下面是「成功」用例的示例代码，使用 Arrange/Act/Assert 测试模型：

```fsharp
open NUnit.Framework

[<Test>]
let ``If product exists, validation succeeds``() =
    // arrange: set up stub versions of service dependencies
    let checkAddressExists address =
        CheckedAddress address // succeed
    let checkProductCodeExists productCode =
        true // succeed

    // arrange: set up input
    let unvalidatedOrder = ...

    // act: call validateOrder
    let result = validateOrder checkProductCodeExists checkAddressExists ...

    // assert: check that result is a ValidatedOrder, not an error
    ...
```

可以看到，表示服务的 `checkAddressExists` 和 `checkProductCodeExists` 的 stub 版本写起来很简单，可以直接在测试中定义。

::: info 测试框架
这里用 NUnit 演示测试，但你可以用任何 .NET 测试框架，或更好的 F# 友好库，如 FsUnit、Unquote、Expecto 或 FsCheck。
:::

写失败用例的代码时，只需把 `checkProductCodeExists` 改成对任何产品代码都失败：

```fsharp
let checkProductCodeExists productCode =
    false // fail
```

完整测试如下：

```fsharp
[<Test>]
let ``If product doesn't exist, validation fails``() =
    // arrange: set up stub versions of service dependencies
    let checkAddressExists address = ...
    let checkProductCodeExists productCode =
        false // fail

    // arrange: set up input
    let unvalidatedOrder = ...

    // act: call validateOrder
    let result = validateOrder checkProductCodeExists checkAddressExists ...

    // assert: check that result is a failure
    ...
```

当然，本章我们说过服务失败会通过抛出异常表示，这是我们希望避免的。下一章会修复这一点。

这是个小例子，但已经能看到用函数式编程原则做测试的实用好处：

- `validateOrder` 是无状态的。它不修改任何东西，相同输入会得到相同输出。这让函数易于测试。
- 所有依赖都显式传入，易于理解其行为。
- 所有副作用都封装在参数中，而不是在函数内部。同样，这让函数易于测试，也易于控制副作用是什么。

测试是个大话题，我们篇幅有限无法深入。这里列出一些值得了解的 F# 友好测试工具：

- **FsUnit**：用 F# 友好语法包装 NUnit、XUnit 等标准测试框架
- **Unquote**：展示导致测试失败的所有值（「展开堆栈」）
- 若你只熟悉 NUnit 等「基于示例」的测试方式，不妨了解「基于属性」的测试。**FsCheck** 是 F# 的主要基于属性测试库
- **Expecto**：轻量级 F# 测试框架，用标准函数作为测试 fixture，无需 `[<Test>]` 等特殊属性

## 9.8 组装后的管道

本章的代码分散在各处，这里把它们汇总起来，展示完整管道是如何组装的。

1. 我们把实现某个工作流的所有代码放在同一模块中，以工作流命名（例如 `PlaceOrderWorkflow.fs`）
2. 文件顶部放类型定义
3. 然后是各步骤的实现
4. 文件最底部，把各步骤组装成主工作流函数

为节省篇幅，这里只展示文件结构。若想看完整代码，本章所有代码可在本书配套代码仓库中找到。

首先是类型定义：

```fsharp
module PlaceOrderWorkflow =
    // make the shared simple types (such as
    // String50 and ProductCode) available.
    open SimpleTypes

    // make the public types exposed to the
    // callers available
    open API

    // ==============================
    // Part 1: Design
    // ==============================
    // NOTE: the public parts of the workflow -- the API --
    // such as the `PlaceOrderWorkflow` function and its
    // input `UnvalidatedOrder`, are defined elsewhere.
    // The types below are private to the workflow implementation.

    // ----- Validate Order -----
    type CheckProductCodeExists =
        ProductCode -> bool

    type CheckedAddress =
        CheckedAddress of UnvalidatedAddress

    type CheckAddressExists =
        UnvalidatedAddress -> CheckedAddress

    type ValidateOrder =
        CheckProductCodeExists // dependency
        -> CheckAddressExists  // dependency
        -> UnvalidatedOrder    // input
        -> ValidatedOrder      // output

    // ----- Price order -----
    type GetProductPrice = ...
    type PriceOrder = ...
    // etc
```

类型之后，在同一文件中，放基于这些类型的实现。下面是 `validateOrder` 第一步的摘要（本章第 165 页附近）：

```fsharp
    // ==============================
    // Part 2: Implementation
    // ==============================
    // ------------------------------
    // ValidateOrder implementation
    // ------------------------------
    let toCustomerInfo (unvalidatedCustomerInfo: UnvalidatedCustomerInfo) =
        ...

    let toAddress (checkAddressExists:CheckAddressExists) unvalidatedAddress =
        ...

    let predicateToPassthru = ...

    let toProductCode (checkProductCodeExists:CheckProductCodeExists) productCode =
        ...

    let toOrderQuantity productCode quantity =
        ...

    let toValidatedOrderLine checkProductExists (unvalidatedOrderLine:UnvalidatedOrderLine) =
        ...

    /// Implementation of ValidateOrder step
    let validateOrder : ValidateOrder =
        fun checkProductCodeExists checkAddressExists unvalidatedOrder ->
            let orderId =
                unvalidatedOrder.OrderId
                |> OrderId.create
            let customerInfo = ...
            let shippingAddress = ...
            let billingAddress = ...
            let lines =
                unvalidatedOrder.Lines
                |> List.map (toValidatedOrderLine checkProductCodeExists)
            let validatedOrder : ValidatedOrder = {
                OrderId = orderId
                CustomerInfo = customerInfo
                ShippingAddress = shippingAddress
                BillingAddress = billingAddress
                Lines = lines
            }
            validatedOrder
```

其余步骤的实现略过（同样可在仓库中查看），直接跳到文件最底部，顶层 `PlaceOrder` 函数的实现：

```fsharp
    // ------------------------------
    // The complete workflow
    // ------------------------------
    let placeOrder
        checkProductExists           // dependency
        checkAddressExists           // dependency
        getProductPrice               // dependency
        createOrderAcknowledgmentLetter // dependency
        sendOrderAcknowledgment      // dependency
        : PlaceOrderWorkflow =       // definition of function
        fun unvalidatedOrder ->
            let validatedOrder =
                unvalidatedOrder
                |> validateOrder checkProductExists checkAddressExists
            let pricedOrder =
                validatedOrder
                |> priceOrder getProductPrice
            let acknowledgmentOption =
                pricedOrder
                |> acknowledgeOrder createOrderAcknowledgmentLetter sendOrderAcknowledgment
            let events =
                createEvents pricedOrder acknowledgmentOption
            events
```

## 本章小结

本章我们专注于实现管道中的各步骤以及处理依赖。每一步的实现都专注于只做一次增量转换，易于单独推理和测试。

组合时，类型并不总是对齐，因此我们引入了三种重要的函数式编程技术：

- **使用「适配器函数」**：把函数从一种「形状」转换为另一种——在本例中，把 `checkProductCodeExists` 的输出从 `bool` 改为 `ProductCode`
- **「提升」**：把不兼容的类型提升到共同类型，如我们在事件上所做的那样，把一切都转换为 `PlaceOrderEvent` 类型
- **使用部分应用**：把依赖烘焙进函数，使函数更易组合，同时向调用者隐藏不需要的实现细节

本书后续还会用到这些技术。

还有一点我们尚未涉及。本章我们回避了效应，改用异常处理错误。这对组合很方便，但对文档来说很糟，导致函数签名具有欺骗性，而不是我们更希望的显式签名。下一章我们会纠正这一点：把 `Result` 类型加回函数类型，并学习如何与之协作。

---

[← 上一章：理解函数](ch08-understanding-functions.md) | [返回目录](../index.md) | [下一章：处理错误 →](ch10-working-with-errors.md)
