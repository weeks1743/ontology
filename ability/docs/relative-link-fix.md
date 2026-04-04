# 相对链接修复测试

## 问题
Markdown 文件中的相对链接（如 `README.zh-CN.md`）被错误解析为前端路由：
```
http://localhost:5174/1/README.zh-CN.md
```

## 解决方案

### 1. 配置 GitHub 仓库信息
在 `server/config/skill-names.json` 中添加：
```json
{
  "_github_base_url": "https://github.com/openclaw/ability/blob/main/skills/external",
  "ext.kai_report_creator": {
    "display_name": "Kai 报告生成器",
    "emoji": "📊",
    "github_path": "kai-report-creator"
  }
}
```

### 2. 后端 API 返回 GitHub 信息
`GET /api/skills/:id/detail` 端点现在返回：
```json
{
  "skill_id": "ext.kai_report_creator",
  "content": "...",
  "source": "README.md",
  "github_base_url": "https://github.com/openclaw/ability/blob/main/skills/external",
  "github_path": "kai-report-creator"
}
```

### 3. 前端链接转换逻辑
在 `SkillDetailDialog.tsx` 中：
- 绝对链接（http/https）保持不变
- 相对链接转换为 GitHub 绝对链接：
  ```
  README.zh-CN.md → https://github.com/openclaw/ability/blob/main/skills/external/kai-report-creator/README.zh-CN.md
  ```

## 测试验证

### API 测试
```bash
# 测试 Kai 报告生成器
curl -s http://localhost:3002/api/skills/ext.kai_report_creator/detail | jq '{skill_id, source, github_base_url, github_path}'
# 输出：
{
  "skill_id": "ext.kai_report_creator",
  "source": "README.md",
  "github_base_url": "https://github.com/openclaw/ability/blob/main/skills/external",
  "github_path": "kai-report-creator"
}

# 测试百度搜索
curl -s http://localhost:3002/api/skills/ext.baidu_search/detail | jq '{skill_id, source, github_base_url, github_path}'
# 输出：
{
  "skill_id": "ext.baidu_search",
  "source": "SKILL.md",
  "github_base_url": "https://github.com/openclaw/ability/blob/main/skills/external",
  "github_path": "baidu-search"
}
```

### 前端测试
访问 http://localhost:5176 技能市场页面：
1. 点击"Kai 报告生成器"卡片
2. 在详情弹窗中点击 `[简体中文]` 链接
3. 链接应该跳转到：
   ```
   https://github.com/openclaw/ability/blob/main/skills/external/kai-report-creator/README.zh-CN.md
   ```
4. 而不是错误的 `http://localhost:5174/1/README.zh-CN.md`

## 链接转换规则

| 原始链接 | 转换结果 | 说明 |
|---------|---------|------|
| `README.zh-CN.md` | `https://github.com/.../kai-report-creator/README.zh-CN.md` | 相对链接 → GitHub |
| `./docs/api.md` | `https://github.com/.../kai-report-creator/docs/api.md` | 相对路径 → GitHub |
| `https://example.com` | `https://example.com` | 绝对链接保持不变 |
| `http://localhost` | `http://localhost` | 绝对链接保持不变 |

## 优势
- ✅ 相对链接正确转换为 GitHub 绝对链接
- ✅ 用户可以访问技能的完整文档（如中文版 README）
- ✅ 不影响外部网站的链接
- ✅ 配置灵活，可以为不同技能设置不同的 GitHub 路径