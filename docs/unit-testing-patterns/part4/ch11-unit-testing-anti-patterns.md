# 第11章：单元测试反模式

> **本章内容**
>
> - 测试私有方法的陷阱与正确做法
> - 为测试暴露私有状态的危害
> - 测试中泄露领域知识的反模式
> - 代码污染：生产代码中的测试专用逻辑
> - Mock 具体类而非接口的问题
> - 时间依赖的正确处理方式

前几章建立了单元测试的最佳实践：测试可观察行为、在系统边界使用 Mock、保持测试与实现细节解耦。本章聚焦于**常见的反模式**——那些看似合理、实则削弱测试价值的做法。识别并避免这些陷阱，是保持测试套件健康的关键。

---

## 11.1 测试私有方法

### 11.1.1 私有方法与测试脆弱性

私有方法是**实现细节**。客户端无法直接调用它们，它们的存在完全是为了支持类的公共 API。

::: tip 核心原则
私有方法是实现细节。测试它们等于将测试与实现耦合，导致测试脆弱。

:::

当你针对私有方法编写测试时，你实际上在断言「类内部是如何工作的」，而非「类对外提供了什么行为」。一旦重构内部实现——例如提取方法、合并逻辑、调整算法——即使公共行为未变，测试也会失败。这就是**误报**：功能正常，测试却报错。

::: tip 正确做法
始终通过**公共 API** 测试。私有方法会作为公共方法的执行路径被间接覆盖。若覆盖不足，问题在于设计，而非测试策略。

:::

---

### 11.1.2 私有方法与覆盖率不足

若通过公共 API 无法充分覆盖某个私有方法，通常意味着两类问题之一：

1. **私有方法过于复杂**：应将其提取为独立的类，通过公共 API 测试新类。
2. **公共 API 未覆盖所有路径**：应增加更多通过公共 API 的测试用例，而非直接测试私有方法。

::: info 设计信号
若私有方法「必须」单独测试才能获得足够覆盖率，这往往表明该方法承担了过多职责，或类的公共接口设计不完整。

:::

---

### 11.1.3 何时可以测试私有方法

在极少数情况下，测试私有方法是可接受的：

- **类本身就是实现细节**：例如 ORM 映射工具类、序列化辅助类，其「公共 API」可能只是框架回调，真正的业务逻辑在私有方法中。此时，测试的目标仍是**更广系统的可观察行为**，只是恰好通过私有入口触发。
- **测试的是可观察行为**：你并非在断言私有方法的实现，而是在验证整个系统在某种输入下的输出；私有方法只是到达该行为的路径。

::: warning 谨慎使用
绝大多数情况下，应避免测试私有方法。若你经常需要这样做，优先考虑重构设计，而非放宽测试策略。

:::

---

## 11.2 暴露私有状态

为便于测试而将字段或属性改为 `public`，或添加仅用于断言的 getter，是一种**代码污染**。

```csharp
// 反模式：为测试暴露内部状态
public class Order
{
    public decimal Discount { get; }  // 仅用于测试断言
    // ...
}
```

::: tip 原则
测试应验证**可观察行为**，而非内部状态。若你需要断言对象的内部字段，说明你在测试实现细节。

:::

**正确做法**：

- 通过**返回值**验证：若方法返回计算结果，断言返回值即可。
- 通过**副作用**验证：若行为体现为数据库更新、消息发送等，在系统边界验证这些副作用。
- 若必须验证内部状态才能建立信心，这通常是**设计问题**的信号——考虑将关键状态通过返回值或事件暴露出来，使其成为可观察行为的一部分。

---

## 11.3 泄露领域知识到测试中

### 反模式：在测试中复现生产算法

一种常见错误是：测试用**与生产代码相同的方式**计算期望值，然后断言结果相等。

```csharp
// 反模式：测试复现了生产代码的算法
[Fact]
public void CalculateDiscount_returns_correct_value()
{
    var calculator = new DiscountCalculator();
    var products = new[] { p1, p2, p3 };

    decimal discount = calculator.CalculateDiscount(products);

    // 错误！测试「知道」算法是 products.Length * 0.01m
    Assert.Equal(products.Length * 0.01m, discount);
}
```

::: tip 核心原则
测试不应知道**如何**计算出结果，只应知道**结果应该是什么**。用硬编码的期望值，而非计算出的值。

:::

若生产代码的算法有 bug，测试中的「相同算法」也会有相同 bug，测试将无法发现错误。测试与生产代码变成了**同一错误的两份拷贝**。

**正确做法**：

```csharp
// 正确：使用硬编码的期望值
[Fact]
public void CalculateDiscount_returns_correct_value()
{
    var calculator = new DiscountCalculator();
    var products = new[] { p1, p2, p3 };

    decimal discount = calculator.CalculateDiscount(products);

    Assert.Equal(0.03m, discount);  // 硬编码期望值，不依赖算法知识
}
```

::: tip 判断标准
问自己：若生产算法写错，这个测试能发现吗？若测试的期望值是用「同样的算法」算出来的，答案往往是「不能」。

:::

---

## 11.4 代码污染

**代码污染**指在生产代码中加入**仅用于测试**的逻辑。

典型例子：

- `if (isTestEnvironment)` 分支
- 仅为满足测试而引入的接口，且生产环境中该接口只有一个实现
- 仅用于测试的配置开关、标志位

```csharp
// 反模式：生产代码中的测试专用逻辑
public class OrderService
{
    private readonly bool _isTestEnvironment;

    public OrderService(bool isTestEnvironment = false)
    {
        _isTestEnvironment = isTestEnvironment;
    }

    public void Process(Order order)
    {
        // 测试时跳过某些逻辑——代码污染
        if (!_isTestEnvironment)
        {
            _logger.Log("Processing...");
        }
    }
}
```

::: tip 原则
生产代码不应包含「仅测试用」的分支或类型。测试专用代码应放在**测试项目**中。

:::

**正确做法**：

- 使用**六边形架构**等设计，让接口自然产生于业务需求，而非为测试而生。
- 若 `ILogger` 在生产中只有一个实现，且引入它仅仅是为了 Mock，这可能是过度设计。评估是否真的需要抽象，或是否可以通过集成测试覆盖。
- 测试替身、测试专用配置、测试数据——全部保留在测试项目中。

---

## 11.5 Mock 具体类

### 反模式：通过虚方法在测试中覆盖行为

为了在测试中「拦截」某个类的行为，开发者有时会：

- 将方法改为 `virtual`，在测试中创建子类并重写该方法；
- 或直接 Mock 具体类（部分 Mock 框架支持）。

```csharp
// 反模式：Mock 具体类，依赖 virtual 方法
public class OrderRepository
{
    public virtual void Save(Order order)  // virtual 仅为了测试
    {
        _database.Execute("INSERT INTO Orders...");  // 真实 DB 调用
    }
}

// 测试中
var repoMock = new Mock<OrderRepository>();
repoMock.Setup(x => x.Save(It.IsAny<Order>()));  // 覆盖以跳过真实 DB
```

::: tip 问题
这种做法违反单一职责，增加耦合，且使「哪些行为是真实的、哪些被替换了」难以理解。具体类的 Mock 往往依赖实现细节（如方法是否 virtual），测试会随实现变更而脆弱。

:::

::: tip 正确做法
始终 Mock **接口**，而非具体类。若需要 Mock 一个具体类，说明该类应依赖接口，而不是具体实现。提取接口，注入接口，在测试中 Mock 接口。

:::

```csharp
// 正确：提取接口，Mock 接口
public interface IOrderRepository
{
    void Save(Order order);
}

public class OrderRepository : IOrderRepository
{
    public void Save(Order order)
    {
        _database.Execute("INSERT INTO Orders...");
    }
}

// 测试中
var repoMock = new Mock<IOrderRepository>();
var service = new OrderService(repoMock.Object);
```

---

## 11.6 处理时间

### 11.6.1 时间作为环境上下文

`DateTime.Now` 等静态调用是一种**环境上下文**（ambient context）：代码从「全局」获取当前时间，而非通过参数或依赖注入获得。

```csharp
// 问题：静态 DateTime.Now 难以测试
public void ChangeEmail(string newEmail)
{
    if (_lastEmailChangeDate.AddDays(1) > DateTime.Now)  // 无法注入
    {
        throw new InvalidOperationException("Too soon");
    }
    // ...
}
```

即使引入 `IDateTimeProvider` 或 `DateTimeServer.Now` 这类可 Mock 的静态服务，**环境上下文**的本质问题依然存在：

- 数据流不清晰：时间从哪来、如何影响行为，难以追踪。
- 并发与共享状态：多线程下，替换「全局时间」可能引入微妙的竞态。
- 测试与生产行为差异：测试中「伪造时间」的方式可能与真实场景不一致。

::: warning 环境上下文的局限
将时间作为可 Mock 的静态服务，仍是一种环境上下文。更好的做法是将其作为**显式依赖**传入。

:::

---

### 11.6.2 时间作为显式依赖

**正确做法**：将当前时间作为**方法参数**或**构造函数参数**传入，而不是从静态上下文读取。

```csharp
// 正确：时间作为显式参数
public void ChangeEmail(string newEmail, DateTime now)
{
    if (_lastEmailChangeDate.AddDays(1) > now)
    {
        throw new InvalidOperationException("Too soon");
    }
    // ...
}

// 测试中
var now = new DateTime(2024, 3, 14, 12, 0, 0);
sut.ChangeEmail("new@example.com", now);
```

::: tip 原则
将时间作为**值**注入（如 `DateTime now`），而非作为服务或 Provider 注入。时间是一个简单的值，不需要抽象成接口。

:::

**优势**：

- 数据流清晰：谁在何时使用了什么时间，一目了然。
- 测试简单：传入任意 `DateTime` 即可，无需 Mock。
- 无共享状态：每个调用显式传入时间，无并发问题。

::: tip 何时使用
若方法或类的行为依赖「当前时间」，优先采用「时间作为参数」的方式。对于已有大量 `DateTime.Now` 的遗留代码，可逐步重构：先提取方法接受 `DateTime` 参数，内部再调用新方法并传入 `DateTime.Now`。

:::

---

## 11.7 本章小结

下表总结了本章讨论的反模式及对应建议：

| 反模式 | 问题 | 正确做法 |
|--------|------|----------|
| **测试私有方法** | 与实现细节耦合，重构即碎 | 通过公共 API 测试；复杂私有逻辑提取为独立类 |
| **暴露私有状态** | 代码污染，测试实现细节 | 通过返回值或副作用验证可观察行为 |
| **泄露领域知识** | 测试与生产代码共享错误算法 | 使用硬编码期望值，不复现算法 |
| **代码污染** | 生产代码含测试专用逻辑 | 测试专用代码放在测试项目；接口应有真实需求 |
| **Mock 具体类** | 违反 SRP，依赖实现细节 | 提取接口，Mock 接口 |
| **时间作为环境上下文** | 数据流不清晰，难以测试 | 将时间作为显式参数传入 |

::: tip 核心要点
- 不要测试私有方法（通过公共 API 测试）
- 不要为测试暴露私有状态
- 不要在测试中复现算法（使用硬编码期望值）
- 不要在生产代码中加入仅用于测试的代码
- 不要 Mock 具体类（使用接口）
- 不要将时间作为环境上下文（显式注入时间作为值）

:::

---

[← 上一章：数据库测试](../part3/ch10-database-testing.md) | [返回目录](../index.md)
