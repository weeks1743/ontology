/**
 * SKILL 执行引擎
 * 支持 inline / fork / spawn 三种执行模式
 *
 * inline: 参数替换 + shell 执行 + LLM 执行（对话扩展）
 * fork:   worker thread 隔离执行（子代理模拟）
 * spawn:  向后兼容旧格式（child_process 子进程）
 *
 * 独立模块，不依赖现有 ability skill-executor.ts
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import OpenAI from 'openai';
import type {
  ParsedSkill,
  SkillExecutionRequest,
  SkillExecutionResult,
} from './types.js';
import { substituteArguments, parseArgumentNames } from './params.js';
import { executeShellCommandsInPrompt, hasShellCommands } from './shell.js';
import { getSkillById } from './discovery.js';
import { getSkillConfig } from '../engine/external-skills.js';

// ─── LLM 配置（延迟读取 .env，避免模块加载顺序问题）──────────

let openaiClient: OpenAI | null = null;

function getLLMConfig() {
  return {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  };
}

function getLLMClient(): OpenAI {
  const config = getLLMConfig();
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }
  return openaiClient;
}

function isLLMConfigured(): boolean {
  const key = process.env.DEEPSEEK_API_KEY || '';
  return key.length > 0 && !key.startsWith('your_');
}

/**
 * 根据模型名解析对应的 LLM 客户端和模型标识符
 * 支持 Qwen（DashScope）和 DeepSeek（默认全局）
 */
function getClientForModel(model: string): { client: OpenAI; model: string; extraBody?: Record<string, unknown> } {
  if (model.startsWith('qwen')) {
    const apiKey = process.env.DASHSCOPE_API_KEY || '';
    return {
      client: new OpenAI({
        apiKey,
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        timeout: 300000, // 300s 超时（12 张幻灯片需要更长时间）
      }),
      model,
      // 代码生成任务不需要思考模式，关闭以大幅减少延迟
      extraBody: { enable_thinking: false },
    };
  }
  // 默认：全局 DeepSeek 配置
  const config = getLLMConfig();
  return { client: getLLMClient(), model: config.model };
}

// ─── Main Executor ──────────────────────────────────────────

/**
 * 统一执行入口
 * 根据 frontmatter.context 和请求参数路由到具体执行器
 */
export async function executeSkill(
  request: SkillExecutionRequest,
): Promise<SkillExecutionResult> {
  const startTime = Date.now();

  console.log(`[skill-core-executor] ========== EXECUTE SKILL START ==========`);
  console.log(`[skill-core-executor] Skill ID: ${request.skillId}`);
  console.log(`[skill-core-executor] Mode: ${request.mode || 'auto'}`);
  console.log(`[skill-core-executor] Timestamp: ${new Date().toISOString()}`);

  // 1. 查找技能
  const skill = getSkillById(request.skillId);
  if (!skill) {
    console.error(`[skill-core-executor] ❌ Skill not found: ${request.skillId}`);
    return failResult(`Skill not found: ${request.skillId}`, startTime);
  }

  console.log(`[skill-core-executor] ✅ Skill found: ${skill.id}, frontmatter.name=${skill.frontmatter.name}`);

  // 2. 确定执行模式
  const mode = request.mode || skill.frontmatter.context || detectExecutionMode(skill);

  console.log(`[skill-core-executor] Execution mode determined: ${mode}`);

  // 3. 路由到具体执行器
  try {
    console.log(`[skill-core-executor] Routing to ${mode} executor...`);
    switch (mode) {
      case 'inline':
        return await executeInline(skill, request, startTime);
      case 'fork':
        return await executeFork(skill, request, startTime);
      case 'spawn':
        return await executeSpawn(skill, request, startTime);
      default:
        return await executeInline(skill, request, startTime);
    }
  } catch (error) {
    console.error(`[skill-core-executor] ❌ Execution error:`, error);
    return failResult(
      error instanceof Error ? error.message : String(error),
      startTime,
      mode as 'inline' | 'fork' | 'spawn',
    );
  } finally {
    console.log(`[skill-core-executor] ========== EXECUTE SKILL END (${Date.now() - startTime}ms) ==========`);
  }
}

// ─── Inline Executor ────────────────────────────────────────

/**
 * inline 执行：参数替换 + shell 执行 + LLM 执行
 * 模拟 Claude Code 的 "扩展到对话" 行为
 *
 * 执行流程：
 * 1. 参数替换（$ARGUMENTS / $0 / $named）
 * 2. Shell 命令预执行（!`command` 和 ```! ... ```）
 * 3. 向后兼容 scripts/ 目录脚本
 * 4. LLM 执行（将 SKILL body + 用户参数发给 DeepSeek）
 */
async function executeInline(
  skill: ParsedSkill,
  request: SkillExecutionRequest,
  startTime: number,
): Promise<SkillExecutionResult> {
  console.log(`[skill-core-inline] ========== INLINE EXECUTION START ==========`);
  console.log(`[skill-core-inline] Skill: ${skill.id}`);

  // 1. 参数替换
  const args = typeof request.args === 'string' ? request.args : undefined;
  const paramArgs = request.params
    ? Object.values(request.params).join(' ')
    : args;

  const argumentNames = parseArgumentNames(skill.frontmatter.arguments);
  let body = substituteArguments(skill.body, paramArgs, {
    argumentNames,
    skillDir: skill.skillDir,
    appendIfNoPlaceholder: true,
  });

  // 2. Shell 命令执行（如果 body 包含 !`...` 或 ```! ... ```）
  let shellCommands: string[] = [];
  let shellOutputs: string[] = [];

  if (hasShellCommands(body)) {
    const shellResult = await executeShellCommandsInPrompt(body, {
      shell: skill.frontmatter.shell || 'bash',
      cwd: request.workingDirectory || skill.skillDir,
      timeout: 30000,
    });
    body = shellResult.content;
    shellCommands = shellResult.executedCommands;
    shellOutputs = shellResult.outputs;
  }

  // 3. 向后兼容：如果有 scripts/ 目录下的可执行脚本
  if (shellCommands.length === 0 && request.params) {
    const scriptResult = await tryExecuteScript(skill, request.params);
    if (scriptResult) {
      return {
        success: true,
        executionMode: 'inline',
        substitutedBody: body,
        shellCommands,
        shellOutputs,
        spawnOutput: scriptResult,
        durationMs: Date.now() - startTime,
      };
    }
  }

  // 4. LLM 执行：将 SKILL body 作为 system prompt，用户参数作为 user message
  if (isLLMConfigured() && body.length > 100) {
    // 检测是否是 PPTX 技能，如果是则使用分批生成
    const isPptxSkill = skill.id === 'pptx' || skill.frontmatter.name === 'pptx';
    console.log(`[skill-core] Inline mode - Skill detection: id=${skill.id}, name=${skill.frontmatter.name}, isPptx=${isPptxSkill}`);

    const llmResult = isPptxSkill
      ? await executeWithLLMBatched(skill, body, request.params)
      : await executeWithLLM(skill, body, request.params);

    if (llmResult) {
      // 5. 后处理：如果 LLM 生成了可执行的 Node.js 代码，尝试执行它
      let finalOutput = llmResult;

      // 检测是否是 pptxgenjs 代码
      if (skill.id === 'pptx' && llmResult.includes('pptxgenjs') && llmResult.includes('writeFile')) {
        console.log('[skill-core] Detected pptxgenjs code, attempting to execute...');
        const executionResult = await executeGeneratedCode(llmResult, skill.skillDir);
        if (executionResult) {
          finalOutput = executionResult;
        }
      }

      return {
        success: true,
        executionMode: 'inline',
        substitutedBody: body,
        shellCommands,
        shellOutputs,
        spawnOutput: finalOutput,
        durationMs: Date.now() - startTime,
      };
    }
  }

  // 5. 降级：返回参数替换后的 body
  return {
    success: true,
    executionMode: 'inline',
    substitutedBody: body,
    shellCommands,
    shellOutputs,
    durationMs: Date.now() - startTime,
  };
}

// ─── Fork Executor ──────────────────────────────────────────

/**
 * fork 执行：创建隔离的执行环境
 * 使用 LLM + 隔离 child_process 模拟子代理
 */
async function executeFork(
  skill: ParsedSkill,
  request: SkillExecutionRequest,
  startTime: number,
): Promise<SkillExecutionResult> {
  const args = typeof request.args === 'string' ? request.args : undefined;
  const paramArgs = request.params
    ? Object.values(request.params).join(' ')
    : args;

  const argumentNames = parseArgumentNames(skill.frontmatter.arguments);
  const prompt = substituteArguments(skill.body, paramArgs, {
    argumentNames,
    skillDir: skill.skillDir,
    appendIfNoPlaceholder: true,
  });

  // Shell 命令预执行
  let processedPrompt = prompt;
  if (hasShellCommands(prompt)) {
    const shellResult = await executeShellCommandsInPrompt(prompt, {
      cwd: request.workingDirectory || skill.skillDir,
      timeout: 60000,
    });
    processedPrompt = shellResult.content;
  }

  // LLM 执行
  if (isLLMConfigured()) {
    // 检测是否是 PPTX 技能，如果是则使用分批生成
    const isPptxSkill = skill.id === 'pptx' || skill.frontmatter.name === 'pptx';
    console.log(`[skill-core] Skill detection: id=${skill.id}, name=${skill.frontmatter.name}, isPptx=${isPptxSkill}`);

    const llmResult = isPptxSkill
      ? await executeWithLLMBatched(skill, processedPrompt, request.params)
      : await executeWithLLM(skill, processedPrompt, request.params);

    if (llmResult) {
      return {
        success: true,
        executionMode: 'fork',
        substitutedBody: processedPrompt,
        spawnOutput: llmResult,
        durationMs: Date.now() - startTime,
      };
    }
  }

  return {
    success: true,
    executionMode: 'fork',
    substitutedBody: processedPrompt,
    durationMs: Date.now() - startTime,
  };
}

// ─── Spawn Executor (Legacy) ────────────────────────────────

/**
 * spawn 执行：向后兼容旧格式
 * 使用 child_process.spawn 执行 scripts/ 目录下的脚本
 */
async function executeSpawn(
  skill: ParsedSkill,
  request: SkillExecutionRequest,
  startTime: number,
): Promise<SkillExecutionResult> {
  const params = request.params || {};

  const spawnOutput = await tryExecuteScript(skill, params);
  if (spawnOutput === null) {
    return failResult(
      `No executable script found for skill: ${skill.id}`,
      startTime,
      'spawn',
    );
  }

  return {
    success: true,
    executionMode: 'spawn',
    spawnOutput,
    durationMs: Date.now() - startTime,
  };
}

/**
 * 执行 LLM 生成的 Node.js 代码
 * 用于 pptx 等需要执行生成代码的技能
 */
async function executeGeneratedCode(code: string, workingDir: string): Promise<string | null> {
  console.log(`[skill-core] executeGeneratedCode called, code length: ${code.length} chars`);
  try {
    const { writeFileSync, unlinkSync } = await import('fs');
    const { join, dirname } = await import('path');
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const { fileURLToPath } = await import('url');

    // 提取代码（移除 markdown 代码块标记和额外文本）
    let cleanCode = code;

    // 1. 尝试提取 markdown 代码块
    const codeBlockMatch = code.match(/```(?:javascript|js)?\s*\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      cleanCode = codeBlockMatch[1];
      console.log(`[skill-core] Extracted code from markdown block`);
    } else {
      // 2. 如果没有代码块，查找代码结束标记（如 ---, Execution:, Result: 等）
      const endMarkers = ['\n---', '\nExecution:', '\nResult:', '\n##', '\n**Note'];
      for (const marker of endMarkers) {
        const idx = cleanCode.indexOf(marker);
        if (idx > 0) {
          cleanCode = cleanCode.substring(0, idx);
          console.log(`[skill-core] Trimmed code at marker: ${marker}`);
          break;
        }
      }
    }

    cleanCode = cleanCode.trim();

    // 验证代码是否有效
    if (!cleanCode || cleanCode.length < 50) {
      console.error('[skill-core] Extracted code too short or empty');
      return null;
    }

    console.log(`[skill-core] Clean code length: ${cleanCode.length} chars`);

    // 使用服务器根目录（有 node_modules 访问权限）
    // 注意：server/package.json 有 "type":"module"，所以必须用 .cjs 扩展名以 CommonJS 模式执行
    const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
    const tmpFile = join(serverRoot, `tmp-exec-${Date.now()}.cjs`);

    writeFileSync(tmpFile, cleanCode, 'utf-8');

    console.log(`[skill-core] ⚙️ Executing generated code: ${tmpFile}`);
    const execStartTime = Date.now();

    // 在服务器根目录执行（可以访问 node_modules）
    const { stdout, stderr } = await execAsync(`node "${tmpFile}"`, {
      cwd: serverRoot,
      timeout: 60000,
    });

    const execElapsed = Date.now() - execStartTime;
    console.log(`[skill-core] ✅ Code execution completed in ${execElapsed}ms`);

    // 清理临时文件
    try {
      unlinkSync(tmpFile);
    } catch (err) {
      console.warn('[skill-core] Failed to delete temp file:', tmpFile);
    }

    if (stderr) {
      console.error('[skill-core] Code execution stderr:', stderr);
    }

    const output = stdout || stderr || 'Code executed successfully';
    console.log(`[skill-core] Code execution output: ${output.substring(0, 200)}`);
    return output;
  } catch (error) {
    console.error('[skill-core] Failed to execute generated code:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

// ─── LLM Executor ───────────────────────────────────────────

/**
 * PPTX 分批生成：将多页幻灯片拆分为多次 LLM 调用
 * 每次生成 3-4 页，最后合并成完整代码
 */
async function executeWithLLMBatched(
  skill: ParsedSkill,
  processedBody: string,
  params?: Record<string, unknown>,
): Promise<string | null> {
  try {
    // 检测是否需要分批生成（从 params.task 中提取幻灯片数量）
    const taskText = params?.task as string || '';
    console.log(`[skill-core] PPTX batched check: task length=${taskText.length}, params keys=${Object.keys(params || {}).join(',')}`);

    const slideCountMatch = taskText.match(/(\d+)\s*张幻灯片/);
    const totalSlides = slideCountMatch ? parseInt(slideCountMatch[1]) : 0;

    console.log(`[skill-core] PPTX slide count detected: ${totalSlides} (match: ${slideCountMatch?.[0] || 'none'})`);

    // 如果少于 8 页，使用普通模式
    if (totalSlides < 8) {
      console.log(`[skill-core] Using normal mode (slides < 8)`);
      return executeWithLLM(skill, processedBody, params);
    }

    console.log(`[skill-core] ✅ PPTX batched generation: ${totalSlides} slides, splitting into batches`);

    const skillModel = skill.frontmatter.model;
    const { client, model, extraBody } = skillModel
      ? getClientForModel(skillModel)
      : { client: getLLMClient(), model: getLLMConfig().model, extraBody: undefined };

    // 分批策略：每批 4 页
    const batchSize = 4;
    const batches = Math.ceil(totalSlides / batchSize);
    const slideCodeParts: string[] = [];

    for (let i = 0; i < batches; i++) {
      const startSlide = i * batchSize + 1;
      const endSlide = Math.min((i + 1) * batchSize, totalSlides);

      console.log(`[skill-core] Generating batch ${i + 1}/${batches}: slides ${startSlide}-${endSlide}`);

      // 修改 params，指定当前批次的幻灯片范围
      const batchParams = {
        ...params,
        task: taskText.replace(/共\s*\d+\s*张幻灯片/, `生成第 ${startSlide}-${endSlide} 张幻灯片（共 ${totalSlides} 张）`),
        _batchInfo: `当前批次：第 ${startSlide}-${endSlide} 张幻灯片。只生成这些幻灯片的 addSlide() 代码块，不要生成 pres 初始化和 writeFile() 代码。`,
      };

      const systemPrompt = `You are generating PART of a PptxGenJS presentation. Generate ONLY the slide creation code (pres.addSlide() blocks) for slides ${startSlide}-${endSlide}. Do NOT include:
- const pptxgen = require('pptxgenjs')
- let pres = new pptxgen()
- pres.writeFile()
- Any initialization or finalization code

Output ONLY the slide blocks that will be inserted into the main code.

## CRITICAL LAYOUT RULES (violations cause overlap/misalignment bugs):

### Canvas bounds (LAYOUT_16x9 = 10" x 5.625"):
- ALL elements MUST satisfy: x >= 0.4, y >= 0.3, x + w <= 9.6, y + h <= 5.4
- Minimum margin from slide edges: 0.4" left/right, 0.3" top/bottom
- NEVER place any element outside these bounds

### Spacing:
- Minimum 0.15" gap between any two elements (vertical and horizontal)
- Do NOT stack/overlap shapes and text boxes at the same coordinates
- Plan the full slide layout before writing code; verify all elements fit

### Text alignment with shapes:
- When text must align with a shape edge, use margin: 0 on the text box
- NEVER use ROUNDED_RECTANGLE paired with accent bar overlays — use RECTANGLE instead

### Color values:
- NEVER use "#" prefix in hex colors (use "FF0000" not "#FF0000")
- NEVER encode transparency in color string (use opacity property instead)
- Example: shadow: { color: "000000", opacity: 0.15 } — NOT { color: "00000026" }

### Options objects:
- NEVER reuse the same options object (shadow, fill, etc.) across multiple addShape/addText calls
- Use a factory function: const mkShadow = () => ({ type: "outer", blur: 6, offset: 2, color: "000000", opacity: 0.15 })

### Bullets:
- Use bullet: true — NEVER use Unicode bullet characters like "•" (causes double bullets)
- Use breakLine: true between items in a bullet list array

### Coordinate checklist (verify before finalizing each slide):
1. Title bar: typically y: 0, h: 0.7 — text box inside at y: 0.1, h: 0.5
2. Content area: starts at y: 0.8 or later, ends before y: 5.3
3. Footer/label: if present, y >= 5.1, h <= 0.4
4. No element extends beyond x + w > 9.6 or y + h > 5.4`;

      let userMessage = `Generate slides ${startSlide}-${endSlide} for this presentation:\n\n${JSON.stringify(batchParams, null, 2)}`;

      // 注入文件内容
      if (params) {
        const filePathRegex = /\/[A-Za-z0-9_\-/. \u4e00-\u9fff]+\.(md|txt|json|csv)/g;
        const filePaths = [...new Set(taskText.match(filePathRegex) || [])];
        for (const filePath of filePaths) {
          if (existsSync(filePath)) {
            try {
              const fileContent = readFileSync(filePath, 'utf-8');
              userMessage += `\n\n--- File content of ${filePath} ---\n${fileContent}\n--- End of ${filePath} ---`;
              console.log(`[skill-core] Injected file content: ${filePath} (${fileContent.length} chars)`);
            } catch {
              console.warn(`[skill-core] Could not read file: ${filePath}`);
            }
          }
        }
      }

      console.log(`[skill-core] 🚀 Sending batch ${i + 1} LLM request to ${model}, userMessage length: ${userMessage.length} chars`);
      const batchStartTime = Date.now();

      try {
        const response = await client.chat.completions.create(
          {
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            temperature: 0.3,
            max_tokens: 8192,
            ...(extraBody ?? {}),
          },
          {
            timeout: 180000, // 3 minutes per batch
          }
        ) as OpenAI.Chat.Completions.ChatCompletion;

        const batchElapsed = Date.now() - batchStartTime;
        console.log(`[skill-core] ✅ Batch ${i + 1} LLM response received in ${batchElapsed}ms`);

        let batchContent = response.choices[0]?.message?.content || '';
        console.log(`[skill-core] Batch ${i + 1} content length: ${batchContent.length} chars, finish_reason: ${response.choices[0]?.finish_reason}`);

        // 如果被截断，继续生成
        if (response.choices[0]?.finish_reason === 'length') {
          console.log(`[skill-core] Batch ${i + 1} truncated, continuing...`);
          batchContent = await continueGeneration(client, model, extraBody, systemPrompt, userMessage, batchContent);
        }

        slideCodeParts.push(batchContent);
        console.log(`[skill-core] Batch ${i + 1}/${batches} completed (${batchContent.length} chars)`);
      } catch (error) {
        console.error(`[skill-core] ❌ Batch ${i + 1} failed:`, error instanceof Error ? error.message : String(error));
        throw new Error(`Batch ${i + 1} generation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 合并所有批次的代码——先剥离各批次可能包含的 markdown 代码块标记
    const cleanParts = slideCodeParts.map(part => {
      // 如果批次内容被包在 ```javascript ... ``` 中，只取内部代码
      const match = part.match(/```(?:javascript|js)?\s*\n([\s\S]*?)\n```/);
      return match ? match[1].trim() : part.trim();
    });

    const timestamp = Date.now();
    const outputPath = `/Users/weeks/Desktop/workspaces-yzj/ontology/ability/tmp/output-${timestamp}.pptx`;

    const finalCode = `const PptxGenJS = require('pptxgenjs');

// 初始化演示文稿
let pres = new PptxGenJS();
pres.layout = 'LAYOUT_16x9';
pres.author = 'AI Generated';
pres.title = '${(params?.task as string || '').split('\n')[0].substring(0, 50)}';

// 样式常量
const COLORS = {
  primary: '1E2761',
  secondary: 'CADCFC',
  accent: 'FFFFFF',
};

${cleanParts.join('\n\n')}

// 保存文件
const fileName = '${outputPath}';
pres.writeFile({ fileName });
console.log('PPTX saved to:', fileName);
`;

    console.log(`[skill-core] Merged ${batches} batches into final code (${finalCode.length} chars)`);
    return finalCode;

  } catch (error) {
    console.error('[skill-core] Batched LLM execution failed:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * 使用 DeepSeek（OpenAI 兼容格式）执行 SKILL
 *
 * 将 SKILL.md body 作为 system prompt
 * 将用户参数格式化为 user message
 * 返回 LLM 生成的文本结果
 */
async function executeWithLLM(
  skill: ParsedSkill,
  processedBody: string,
  params?: Record<string, unknown>,
): Promise<string | null> {
  console.log(`[skill-core] executeWithLLM called for skill: ${skill.id}`);
  try {
    // 若技能声明了 model 字段，使用对应 provider；否则回退到全局配置
    const skillModel = skill.frontmatter.model;
    const { client, model, extraBody } = skillModel
      ? getClientForModel(skillModel)
      : { client: getLLMClient(), model: getLLMConfig().model, extraBody: undefined };

    console.log(`[skill-core] LLM config: model=${model}, key=${(skillModel ? (process.env.DASHSCOPE_API_KEY || '') : (process.env.DEEPSEEK_API_KEY || '')).substring(0, 8) + '...'}, base=${skillModel?.startsWith('qwen') ? 'dashscope' : getLLMConfig().baseURL}`);

    // 构建 system prompt：SKILL 名称 + 描述 + body 指令
    const skillName = skill.frontmatter.name || skill.id;
    const skillDesc = skill.frontmatter.description || '';

    const systemPrompt = [
      `You are a SKILL executor. You MUST execute the SKILL "${skillName}" immediately and output the result directly.`,
      skillDesc ? `SKILL Description: ${skillDesc}` : '',
      '',
      'CRITICAL RULES:',
      '1. DO NOT ask questions or wait for user confirmation — execute immediately.',
      '2. DO NOT explain what you would do — just do it and output the result.',
      '3. Output ONLY the final result as specified by the SKILL (code, HTML, JSON, or text).',
      '4. Do NOT wrap output in markdown code blocks unless the SKILL says to.',
      '5. If the SKILL requires generating executable code (Node.js, Python, etc.), output the complete runnable code directly.',
      '6. If the SKILL says to generate HTML for browser execution, output raw HTML starting with <!DOCTYPE html>.',
      '7. If the SKILL says to generate JSON, output raw JSON.',
      '8. For pptxgenjs: Generate Node.js CommonJS code using require() (NOT import). Use pres.writeFile() to save the file.',
      '9. For pptxgenjs: The output PPTX file MUST be saved to this exact path: /Users/weeks/Desktop/workspaces-yzj/ontology/ability/tmp/',
      '   Example: pres.writeFile({ fileName: "/Users/weeks/Desktop/workspaces-yzj/ontology/ability/tmp/output-" + Date.now() + ".pptx" })',
      '10. For pptxgenjs: After writeFile(), add console.log("PPTX saved to:", fileName) so we know the file path.',
      '11. CODE OPTIMIZATION (CRITICAL for multi-slide presentations):',
      '    - Extract common styles (colors, fonts, sizes) as constants at the top',
      '    - Use helper functions for repeated patterns (e.g., addTitleSlide, addContentSlide)',
      '    - Use loops and arrays to generate similar slides instead of copy-pasting code',
      '    - Keep code DRY (Don\'t Repeat Yourself) - if you copy-paste more than 3 lines, refactor into a function',
      '    - Example: Instead of 12 separate slide blocks, use a slides array + forEach loop',
      '    - Target: Generate 12 slides in under 300 lines of code (not 1000+ lines)',
      '',
      '=== SKILL INSTRUCTIONS START ===',
      processedBody,
      '=== SKILL INSTRUCTIONS END ===',
    ].join('\n');

    // 构建 user message：用户的输入参数
    // 如果参数中包含本地文件路径引用，自动读取并注入内容
    let userMessage: string;
    if (params) {
      let paramsText = JSON.stringify(params, null, 2);

      // 检测并替换文件路径引用（绝对路径）
      const filePathRegex = /\/[A-Za-z0-9_\-/. \u4e00-\u9fff]+\.(md|txt|json|csv)/g;
      const filePaths = [...new Set(paramsText.match(filePathRegex) || [])];
      for (const filePath of filePaths) {
        if (existsSync(filePath)) {
          try {
            const fileContent = readFileSync(filePath, 'utf-8');
            paramsText = paramsText + `\n\n--- File content of ${filePath} ---\n${fileContent}\n--- End of ${filePath} ---`;
            console.log(`[skill-core] Injected file content: ${filePath} (${fileContent.length} chars)`);
          } catch {
            console.warn(`[skill-core] Could not read file: ${filePath}`);
          }
        }
      }

      userMessage = `Execute this SKILL NOW with these parameters (generate output directly, no questions):\n\n${paramsText}`;
    } else {
      userMessage = 'Execute this SKILL NOW with default parameters. Generate output directly.';
    }

    console.log(`[skill-core] Sending initial LLM request to ${model}, user message length: ${userMessage.length} chars`);
    const initialStartTime = Date.now();

    const response = await client.chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 8192,
        ...(extraBody ?? {}),
      },
      {
        timeout: 120000, // 120s 超时，防止无限等待
      }
    ) as OpenAI.Chat.Completions.ChatCompletion;

    const initialElapsed = Date.now() - initialStartTime;
    console.log(`[skill-core] Initial LLM response received in ${initialElapsed}ms`);

    // 检查是否被截断（length 模式意味着输出超出了 max_tokens）
    const finishReason = response.choices[0]?.finish_reason;
    let content = response.choices[0]?.message?.content || '';

    console.log(`[skill-core] Initial response: ${content.length} chars, finish_reason=${finishReason}`);

    if (finishReason === 'length' && content.length > 0) {
      console.log(`[skill-core] ⚠️ Output truncated (${content.length} chars), starting continuation...`);
      content = await continueGeneration(client, model, extraBody, systemPrompt, userMessage, content);
      console.log(`[skill-core] ✅ Continuation completed, final length: ${content.length} chars`);
    }

    if (!content) {
      console.error('[skill-core] LLM returned empty content');
      return null;
    }

    console.log(`[skill-core] LLM executed skill "${skill.id}" (${content.length} chars, ${response.usage?.total_tokens || 0} tokens)`);
    return content;
  } catch (error) {
    console.error('[skill-core] LLM execution failed:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * 继续被截断的生成
 * 将已生成的内容作为上下文，让 LLM 接着生成剩余部分
 * 持续航写直到完成（或达到最大尝试次数）
 */
async function continueGeneration(
  client: OpenAI,
  model: string,
  extraBody: Record<string, unknown> | undefined,
  systemPrompt: string,
  originalUserMessage: string,
  existingContent: string,
): Promise<string> {
  console.log(`[skill-core] continueGeneration started: existing content ${existingContent.length} chars`);
  let fullContent = existingContent;
  const maxRetries = 10;  // 增加到 10 次，理论最大 81920 tokens

  for (let i = 0; i < maxRetries; i++) {
    console.log(`[skill-core] Continuation attempt ${i + 1}/${maxRetries}, current length: ${fullContent.length} chars`);
    const continueMessage = `The previous output was truncated. Continue generating from where you left off. Output ONLY the continuation, do NOT repeat any previous content.\n\nLast 500 characters of previous output:\n${fullContent.slice(-500)}`;

    console.log(`[skill-core] Sending continuation request to ${model}...`);
    const startTime = Date.now();

    const response = await client.chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: originalUserMessage },
          { role: 'assistant', content: fullContent },
          { role: 'user', content: continueMessage },
        ],
        temperature: 0.3,
        max_tokens: 8192,
        ...(extraBody ?? {}),
      },
      {
        timeout: 300000, // 300s timeout for continuation calls (matches Qwen client config)
      }
    ) as OpenAI.Chat.Completions.ChatCompletion;

    const elapsed = Date.now() - startTime;
    console.log(`[skill-core] Continuation response received in ${elapsed}ms`);

    const continuation = response.choices[0]?.message?.content || '';
    fullContent += continuation;

    const finishReason = response.choices[0]?.finish_reason;
    console.log(`[skill-core] Continuation ${i + 1}: added ${continuation.length} chars, total ${fullContent.length} chars, finish_reason=${finishReason}`);
    // 如果不是因为长度截断，说明生成完成
    if (finishReason !== 'length') {
      console.log(`[skill-core] Generation completed after ${i + 1} continuations (${fullContent.length} chars total)`);
      break;
    }

    console.log(`[skill-core] Continued generation (${fullContent.length} chars total, attempt ${i + 1}/${maxRetries})`);

    // 安全检查：如果连续 10 次都被截断，可能是无限循环
    if (i === maxRetries - 1) {
      console.warn(`[skill-core] Max retries reached (${maxRetries}), output may be incomplete`);
    }
  }

  return fullContent;
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * 自动检测执行模式
 * 根据 SKILL.md 内容判断使用 inline、fork 还是 spawn
 */
function detectExecutionMode(skill: ParsedSkill): 'inline' | 'fork' | 'spawn' {
  const body = skill.body;

  // body 中有 shell 执行语法 → inline
  if (hasShellCommands(body)) return 'inline';

  // 有 scripts/ 目录且包含可执行脚本 → spawn
  const scriptsDir = join(skill.skillDir, 'scripts');
  if (existsSync(scriptsDir)) {
    const scriptFiles = ['generate.js', 'search.py', 'execute.js', 'run.py', 'index.js'];
    for (const file of scriptFiles) {
      if (existsSync(join(scriptsDir, file))) return 'spawn';
    }
  }

  // 默认 inline
  return 'inline';
}

/**
 * 尝试执行 scripts/ 目录下的脚本（向后兼容）
 */
async function tryExecuteScript(
  skill: ParsedSkill,
  params: Record<string, unknown>,
): Promise<unknown | null> {
  const scriptsDir = join(skill.skillDir, 'scripts');
  if (!existsSync(scriptsDir)) return null;

  // 查找可执行脚本
  const scriptFiles = ['generate.js', 'search.py', 'execute.js', 'run.py', 'index.js'];
  let scriptPath: string | null = null;
  let command: string | null = null;

  for (const file of scriptFiles) {
    const fullPath = join(scriptsDir, file);
    if (existsSync(fullPath)) {
      scriptPath = fullPath;
      command = file.endsWith('.py') ? 'python3' : 'node';
      break;
    }
  }

  if (!scriptPath || !command) return null;

  // 加载技能配置（从 skills.json）
  const skillConfig = getSkillConfig(skill.id);

  // 执行脚本
  return new Promise((resolve, reject) => {
    const proc = spawn(command, [scriptPath, JSON.stringify(params)], {
      cwd: skill.skillDir,
      env: { ...process.env, ...skillConfig } as Record<string, string>,  // 合并配置
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Script exited with code ${code}: ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve(stdout);
      }
    });

    proc.on('error', reject);
  });
}

function failResult(
  error: string,
  startTime: number,
  mode: 'inline' | 'fork' | 'spawn' = 'inline',
): SkillExecutionResult {
  return {
    success: false,
    executionMode: mode,
    error,
    durationMs: Date.now() - startTime,
  };
}
