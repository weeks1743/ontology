#!/bin/bash

echo "=== 测试技能市场功能 ==="
echo ""

# 测试技能列表 API
echo "1. 测试技能列表 API (检查 display_name 和 emoji)"
curl -s http://localhost:3002/api/skills | jq '.[] | {id, display_name, emoji: .metadata.emoji}' | head -20
echo ""

# 测试技能详情 API (百度搜索)
echo "2. 测试技能详情 API (ext.baidu_search - SKILL.md)"
curl -s http://localhost:3002/api/skills/ext.baidu_search/detail | jq '{skill_id, source, preview: .content[:100]}'
echo ""

# 测试技能详情 API (Kai 报告生成器)
echo "3. 测试技能详情 API (ext.kai_report_creator - README.md)"
curl -s http://localhost:3002/api/skills/ext.kai_report_creator/detail | jq '{skill_id, source, preview: .content[:150]}'
echo ""

# 测试前端访问
echo "4. 测试前端技能市场页面访问"
curl -s http://localhost:5176/ | head -5
echo ""

echo "=== 测试完成 ==="
echo "请手动访问 http://localhost:5176/ 验证以下功能："
echo "- 技能卡片显示中文名称"
echo "- 点击卡片打开详情弹窗"
echo "- 详情弹窗正确渲染 Markdown"
echo "- 配置按钮仍然可用"