# 编辑演示文稿

## 基于模板的工作流

使用现有演示文稿作为模板时：

1. **分析现有幻灯片**：
   ```bash
   python scripts/thumbnail.py template.pptx
   python -m markitdown template.pptx
   ```
   查看 `thumbnails.jpg` 了解版式，查看 markitdown 输出了解占位文本。

2. **规划幻灯片映射**：为每个内容章节选择一张模板幻灯片。

   ⚠️ **使用多样化版式** — 单调的演示文稿是常见失败模式。不要默认基础的标题+项目点幻灯片。主动寻找：
   - 多栏版式（双栏、三栏）
   - 图片 + 文字组合
   - 全出血图片加文字叠加
   - 引用或标注幻灯片
   - 章节分隔页
   - 数据/数字标注
   - 图标网格或图标+文字行

   **避免：** 每张幻灯片重复同一文字密集版式。

   根据内容类型匹配版式风格（如：要点 → 项目点幻灯片，团队信息 → 多栏，证言 → 引用幻灯片）。

3. **解包**：`python scripts/office/unpack.py template.pptx unpacked/`

4. **构建演示文稿**（由你自己完成，不使用子智能体）：
   - 删除不需要的幻灯片（从 `<p:sldIdLst>` 中移除）
   - 复制要复用的幻灯片（`add_slide.py`）
   - 在 `<p:sldIdLst>` 中重新排序幻灯片
   - **在第 5 步前完成所有结构性修改**

5. **编辑内容**：更新每个 `slide{N}.xml` 中的文字。
   **如果有子智能体，请在此步使用** — 幻灯片是独立的 XML 文件，子智能体可以并行编辑。

6. **清理**：`python scripts/clean.py unpacked/`

7. **打包**：`python scripts/office/pack.py unpacked/ output.pptx --original template.pptx`

---

## 脚本说明

| 脚本 | 用途 |
|------|------|
| `unpack.py` | 解包并格式化 PPTX |
| `add_slide.py` | 复制幻灯片或从版式新建 |
| `clean.py` | 移除孤立文件 |
| `pack.py` | 重新打包并验证 |
| `thumbnail.py` | 创建幻灯片视觉网格 |

### unpack.py

```bash
python scripts/office/unpack.py input.pptx unpacked/
```

解包 PPTX，格式化 XML，转义智能引号。

### add_slide.py

```bash
python scripts/add_slide.py unpacked/ slide2.xml      # 复制幻灯片
python scripts/add_slide.py unpacked/ slideLayout2.xml # 从版式新建
```

输出需添加到 `<p:sldIdLst>` 指定位置的 `<p:sldId>`。

### clean.py

```bash
python scripts/clean.py unpacked/
```

移除不在 `<p:sldIdLst>` 中的幻灯片、未引用的媒体文件、孤立的关联关系。

### pack.py

```bash
python scripts/office/pack.py unpacked/ output.pptx --original input.pptx
```

验证、修复、压缩 XML，重新编码智能引号。

### thumbnail.py

```bash
python scripts/thumbnail.py input.pptx [output_prefix] [--cols N]
```

创建带幻灯片文件名标签的 `thumbnails.jpg`。默认 3 列，每个网格最多 12 张。

**仅用于模板分析**（选择版式）。视觉 QA 请使用 `soffice` + `pdftoppm` 创建全分辨率单张幻灯片图片——参见 SKILL.md。

---

## 幻灯片操作

幻灯片顺序在 `ppt/presentation.xml` → `<p:sldIdLst>` 中。

**重新排序**：重排 `<p:sldId>` 元素。

**删除**：移除 `<p:sldId>`，然后运行 `clean.py`。

**新增**：使用 `add_slide.py`。不要手动复制幻灯片文件——该脚本处理备注引用、Content_Types.xml 和手动复制会遗漏的关联 ID。

---

## 编辑内容

**子智能体：** 如果有，请在此步（完成第 4 步后）使用。每张幻灯片是独立的 XML 文件，子智能体可并行编辑。给子智能体的提示中包含：
- 要编辑的幻灯片文件路径
- **"所有修改使用 Edit 工具"**
- 以下格式规则和常见陷阱

对每张幻灯片：
1. 读取幻灯片的 XML
2. 识别所有占位内容——文字、图片、图表、图标、说明文字
3. 将每个占位符替换为最终内容

**使用 Edit 工具，不要用 sed 或 Python 脚本。** Edit 工具强制明确要替换的内容和位置，可靠性更高。

### 格式规则

- **加粗所有标题、副标题和行内标签**：在 `<a:rPr>` 上使用 `b="1"`。包括：
  - 幻灯片标题
  - 幻灯片内的章节标题
  - 行内标签（如 "状态："、"描述："位于行首）
- **绝不使用 Unicode 项目符号（•）**：使用 `<a:buChar>` 或 `<a:buAutoNum>` 正确的列表格式
- **项目符号一致性**：让项目符号继承版式。仅指定 `<a:buChar>` 或 `<a:buNone>`。

---

## 常见陷阱

### 模板适配

当源内容的条目少于模板时：
- **完全移除多余元素**（图片、形状、文字框），不要只清空文字
- 清空文字内容后检查孤立视觉元素
- 运行视觉 QA 捕获数量不匹配

用不同长度内容替换文字时：
- **较短替换**：通常安全
- **较长替换**：可能溢出或意外换行
- 文字修改后用视觉 QA 测试
- 考虑截断或拆分内容以符合模板设计限制

**模板槽 ≠ 源条目**：若模板有 4 名团队成员但源只有 3 名用户，删除第 4 名成员的整个分组（图片 + 文字框），不只是文字。

### 多条目内容

若源有多个条目（编号列表、多个章节），为每项创建独立的 `<a:p>` 元素 — **绝不拼接为一个字符串**。

**❌ 错误** — 所有条目在一个段落中：
```xml
<a:p>
  <a:r><a:rPr .../><a:t>第一步：做第一件事。第二步：做第二件事。</a:t></a:r>
</a:p>
```

**✅ 正确** — 带粗体标题的独立段落：
```xml
<a:p>
  <a:pPr algn="l"><a:lnSpc><a:spcPts val="3919"/></a:lnSpc></a:pPr>
  <a:r><a:rPr lang="zh-CN" sz="2799" b="1" .../><a:t>第一步</a:t></a:r>
</a:p>
<a:p>
  <a:pPr algn="l"><a:lnSpc><a:spcPts val="3919"/></a:lnSpc></a:pPr>
  <a:r><a:rPr lang="zh-CN" sz="2799" .../><a:t>做第一件事。</a:t></a:r>
</a:p>
<!-- 继续此模式 -->
```

从原段落复制 `<a:pPr>` 以保留行间距。标题使用 `b="1"`。

### 智能引号

由解包/打包自动处理。但 Edit 工具会将智能引号转为 ASCII。

**添加带引号的新文字时，使用 XML 实体：**

```xml
<a:t>所谓&#x201C;协议&#x201D;</a:t>
```

| 字符 | 名称 | Unicode | XML 实体 |
|------|------|---------|----------|
| `"` | 左双引号 | U+201C | `&#x201C;` |
| `"` | 右双引号 | U+201D | `&#x201D;` |
| `'` | 左单引号 | U+2018 | `&#x2018;` |
| `'` | 右单引号 | U+2019 | `&#x2019;` |

### 其他

- **空白字符**：在带前导/尾随空格的 `<a:t>` 上使用 `xml:space="preserve"`
- **XML 解析**：使用 `defusedxml.minidom`，不要用 `xml.etree.ElementTree`（会损坏命名空间）
