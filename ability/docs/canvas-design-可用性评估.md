# canvas-design SKILL 可用性评估

## SKILL 基本信息

- **来源**：https://github.com/anthropics/skills/tree/main/skills/canvas-design
- **功能**：创建视觉艺术设计（海报、艺术作品、设计文档）
- **输出格式**：.md（设计哲学） + .pdf/.png（视觉作品）
- **执行方式**：纯 prompt-based，无需外部脚本

---

## 你的平台当前能力

### ✅ 已具备的能力

1. **SKILL 加载机制**
   - 支持 `skills/external/` 目录自动扫描
   - 100% 兼容 Claude Code SKILL.md 格式
   - 支持 inline/fork 执行模式

2. **LLM 执行能力**
   - executor.ts 已集成 DeepSeek API (executor.ts:30-52)
   - 支持 system prompt + user message 格式
   - 支持长文本生成（max_tokens=8192，支持续写）

3. **参数处理**
   - 支持参数替换（substituteArguments）
   - 支持参数传递给 LLM

### ❌ 缺失的关键能力

1. **PDF/PNG 文件生成能力**
   - 你的 executor 只返回文本内容
   - 无法将 LLM 输出转换为 PDF/PNG 文件
   - canvas-design 要求输出二进制文件，而非文本

2. **字体文件处理能力**
   - canvas-design 需要 canvas-fonts 目录（20+ 字体文件）
   - 你的 executor 无法使用这些字体进行渲染

3. **视觉渲染引擎**
   - Claude Code 本身有内部工具可以将设计指令渲染为视觉作品
   - 你的平台使用 DeepSeek API，只能返回文本描述
   - 没有 HTML-to-PDF、Canvas API 或图片生成工具

---

## 核心问题分析

### 问题：输出格式不匹配

**canvas-design 期望的执行流程：**

```
用户输入 "创建一个海报"
  ↓
SKILL.md prompt 指导 Claude
  ↓
Claude 生成设计哲学 (.md)
  ↓
Claude 内部工具渲染视觉作品 (.pdf/.png)
  ↓
输出文件给用户
```

**你的平台实际流程：**

```
用户输入 "创建一个海报"
  ↓
SKILL.md prompt 发送给 DeepSeek
  ↓
DeepSeek 返回文本描述（无法生成图片）
  ↓
executor 返回文本内容
  ↓
用户只得到文本描述，没有实际图片
```

### 具体例子

如果用户调用 canvas-design，DeepSeek 会返回类似：

```markdown
# 设计哲学：Concrete Poetry

通过纪念碑式的形式和大胆的几何图形传达信息...

# 视觉设计建议
- 使用大块色彩
- 采用雕塑般的排版
- 粗野主义的空间分割...
```

但**不会生成实际的 PDF 或 PNG 文件**。

---

## 可用性结论

### ❌ 直接复制过来不可用

**原因：**
1. 缺少 PDF/PNG 生成能力（核心问题）
2. 缺少视觉渲染引擎
3. 无法使用字体文件进行设计

**预期行为：**
- SKILL 可以加载到技能市场
- 用户点击后会看到 SKILL 详情
- 调用执行只会返回文本描述，而非实际设计文件

---

## 如何才能使用这个 SKILL

### 方案 1：集成 Claude API（推荐）

将 executor.ts 改为使用 Claude API（而非 DeepSeek）：

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 8192,
  messages: [
    { role: 'user', content: userMessage }
  ],
  system: systemPrompt,
});
```

**优势：**
- Claude 有内部工具可以生成 PDF/PNG
- 完全兼容 Anthropic skills 生态
- 可以直接使用 canvas-design

**劣势：**
- 需要 Anthropic API Key（成本更高）
- 需要重构 executor.ts

### 方案 2：添加渲染引擎（复杂）

在 executor 中集成 HTML-to-PDF 渲染工具：

```bash
npm install puppeteer  # 或 playwright
```

修改执行流程：

```typescript
// 1. DeepSeek 生成设计描述（JSON 格式）
const designSpec = await executeWithLLM(skill, body, params);

// 2. 将设计描述转换为 HTML
const html = convertDesignSpecToHtml(designSpec);

// 3. 使用 Puppeteer 渲染为 PDF
const pdfBuffer = await puppeteer.render(html);

// 4. 返回 PDF 文件
return {
  success: true,
  file: pdfBuffer,
  filename: 'design.pdf',
};
```

**优势：**
- 可以继续使用 DeepSeek（成本低）
- 可以生成实际的 PDF 文件

**劣势：**
- 实现复杂（需要设计 HTML 模板系统）
- 需要处理字体文件
- 渲染质量取决于 HTML 实现

### 方案 3：标注为"仅描述型"（临时方案）

修改 SKILL.md 添加说明：

```markdown
---
name: canvas-design
description: 生成视觉艺术设计的文本描述和设计哲学（当前平台不支持 PDF/PNG 输出）
metadata:
  emoji: "🎨"
  platform_note: "仅输出文本描述，无法生成实际设计文件"
---
```

**优势：**
- 无需修改代码
- 用户知道实际行为

**劣势：**
- 用户体验不完整
- 无法发挥 SKILL 的真正价值

---

## 推荐方案

### 短期：方案 3（标注说明）
- 先加载 SKILL，明确告知用户当前限制
- 用户可以看到设计哲学和文本描述

### 中期：方案 1（集成 Claude API）
- 重构 executor 支持多模型（DeepSeek + Claude）
- 对于需要视觉输出的 SKILL，使用 Claude
- 其他 SKILL 继续使用 DeepSeek（成本优化）

### 长期：方案 2（完整渲染引擎）
- 构建通用的文件生成系统
- 支持 PDF、PNG、HTML 等多种输出格式
- 完全兼容 Anthropic skills 生态

---

## 其他类似 SKILL 的兼容性问题

相同问题会出现在所有需要视觉输出的 Anthropic skills：

- `canvas-design`：海报/艺术作品设计 ❌
- `slide-deck`：幻灯片生成 ❌
- `website-design`：网站设计稿 ❌
- `data-visualization`：数据可视化图表 ❌

这些 SKILL 都依赖 Claude 的内部渲染工具。

---

## 总结

**直接复制过来不可用**，因为：

1. ✅ 加载能力：平台可以加载 SKILL
2. ✅ LLM 能力：DeepSeek 可以理解并生成文本响应
3. ❌ 文件生成：缺少 PDF/PNG 输出能力（核心缺失）
4. ❌ 渲染引擎：缺少视觉设计渲染工具

**建议：**
- 先标注为"描述型"加载进来
- 后续集成 Claude API 或构建渲染引擎才能完整使用
- 或者寻找其他纯文本型的 Anthropic skills（如代码生成、数据分析类）

---

## 附录：纯文本型 Anthropic Skills（可直接使用）

以下类型的 skills 可以直接复制使用：

- **代码生成类**：生成代码片段、脚本
- **文档编写类**：生成 Markdown、文档
- **数据分析类**：分析数据、生成 JSON 报告
- **API 调用类**：调用外部 API，返回文本结果

识别标准：SKILL.md 中只要求输出文本文件（.md/.txt/.json/.html），不要求 .pdf/.png/.pptx 等二进制文件。