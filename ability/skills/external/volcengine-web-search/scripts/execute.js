/**
 * 火山方舟联网搜索 - 执行脚本
 * 使用 Volcengine Responses API 的 web_search 工具
 * 模型: doubao-seed-2-0-pro-260215
 */

const API_BASE = 'https://ark.cn-beijing.volces.com/api/v3';

async function main() {
  // 读取参数：从 stdin 或命令行参数
  let params = {};
  try {
    const input = process.argv[2];
    if (input) {
      params = JSON.parse(input);
    }
  } catch (e) {
    console.error('Failed to parse input params:', e.message);
    process.exit(1);
  }

  const apiKey = process.env.ARK_API_KEY || '';
  if (!apiKey || apiKey.startsWith('your_')) {
    const result = {
      success: false,
      error: 'ARK_API_KEY 未配置。请在 .env 文件中设置 ARK_API_KEY',
      results: [],
    };
    console.log(JSON.stringify(result));
    process.exit(0);
  }

  const query = params.query || params.q || '今日热点新闻';
  const maxKeyword = params.max_keyword || 3;
  const limit = params.limit || 10;
  const sources = params.sources || ['douyin', 'toutiao', 'moji'];
  const userLocation = params.user_location || null;
  const stream = params.stream || false;

  // 构建 tools 配置
  const webSearchTool = {
    type: 'web_search',
    max_keyword: maxKeyword,
    limit: limit,
  };
  if (sources && sources.length > 0) {
    webSearchTool.sources = sources;
  }
  if (userLocation) {
    webSearchTool.user_location = {
      type: 'approximate',
      ...userLocation,
    };
  }

  // 构建请求体
  const requestBody = {
    model: 'doubao-seed-2-0-pro-260215',
    stream: false,
    tools: [webSearchTool],
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: query,
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(`${API_BASE}/responses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg;
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.error?.message || errorJson.message || errorText;
      } catch {
        errorMsg = errorText;
      }
      const result = {
        success: false,
        error: `API 请求失败 (${response.status}): ${errorMsg}`,
        results: [],
      };
      console.log(JSON.stringify(result));
      process.exit(0);
    }

    const data = await response.json();

    // 提取搜索结果
    const outputItems = data.output || [];
    let answerText = '';
    let annotations = [];
    let webSearchCalls = [];
    let toolUsage = null;
    let toolUsageDetails = null;

    for (const item of outputItems) {
      if (item.type === 'message' && item.content) {
        for (const content of item.content) {
          if (content.type === 'output_text' && content.text) {
            answerText = content.text;
            if (content.annotations) {
              annotations = content.annotations;
            }
          }
        }
      }
      if (item.type === 'web_search_call') {
        webSearchCalls.push({
          id: item.id,
          action: item.action,
          status: item.status,
        });
      }
    }

    // 提取使用量
    if (data.usage) {
      toolUsage = data.usage.tool_usage || null;
      toolUsageDetails = data.usage.tool_usage_details || null;
    }

    // 格式化引用来源
    const references = annotations.map((ann, idx) => ({
      index: idx + 1,
      url: ann.url || '',
      title: ann.title || '',
    }));

    const result = {
      success: true,
      query: query,
      answer: answerText,
      references: references,
      web_search_calls: webSearchCalls,
      usage: {
        tool_usage: toolUsage,
        tool_usage_details: toolUsageDetails,
      },
    };

    console.log(JSON.stringify(result));
  } catch (error) {
    const result = {
      success: false,
      error: `请求异常: ${error.message}`,
      results: [],
    };
    console.log(JSON.stringify(result));
    process.exit(0);
  }
}

main();
