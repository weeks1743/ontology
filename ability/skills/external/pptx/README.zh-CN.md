# PPTX 技能 — 中文使用文档

## 适用场景

本技能适用于所有涉及 `.pptx` 文件的操作，包括：

- **从零创建**演示文稿、路演材料、企业介绍 PPT
- **读取与提取**现有 .pptx 文件的文字内容
- **基于模板编辑**现有演示文稿
- 合并、拆分幻灯片，处理模板、版式、备注

触发词：幻灯片、PPT、演示文稿、路演、.pptx 文件名

---

## 三种工作模式

### 模式 1：读取内容（markitdown）

适合：提取 PPT 文字、生成摘要、内容分析

```bash
# 提取全部文字
python -m markitdown presentation.pptx

# 生成缩略图预览
python scripts/thumbnail.py presentation.pptx

# 查看原始 XML
python scripts/office/unpack.py presentation.pptx unpacked/
```

### 模式 2：从零创建（pptxgenjs）

适合：无模板时，用 JavaScript 程序化生成专业 PPT

详见 [pptxgenjs.md](pptxgenjs.md)

```bash
npm install -g pptxgenjs
node create-presentation.js
```

### 模式 3：基于模板编辑（7步工作流）

适合：有现有模板或参考演示文稿时修改

详见 [editing.md](editing.md)

```bash
# 1. 分析模板
python scripts/thumbnail.py template.pptx
python -m markitdown template.pptx

# 2. 解包
python scripts/office/unpack.py template.pptx unpacked/

# 3. 编辑 XML（见 editing.md 详细步骤）

# 4. 清理
python scripts/clean.py unpacked/

# 5. 重新打包
python scripts/office/pack.py unpacked/ output.pptx --original template.pptx
```

---

## 依赖安装

```bash
# Python 依赖
pip install "markitdown[pptx]" Pillow

# Node.js 依赖（从零创建时使用）
npm install -g pptxgenjs

# 可选图标支持
npm install -g react-icons react react-dom sharp

# 系统依赖（PDF/图片转换）
# LibreOffice (soffice) — 用于 PDF 转换，通过 scripts/office/soffice.py 自动配置
# Poppler (pdftoppm) — 用于 PDF 转图片
```

---

## 许可证说明

本技能源自 Anthropic, PBC 专有许可证（详见 [LICENSE.txt](LICENSE.txt)）。

为在 Claude Code 运行环境内合法加载使用的内部中文本地化版本，不用于第三方分发。

上游来源：`skills-main/skills/pptx`
