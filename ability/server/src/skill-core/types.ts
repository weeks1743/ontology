/**
 * skill-core 类型定义
 * 100% 兼容 Claude Code SKILL.md frontmatter 规范
 *
 * 独立模块，不依赖现有 ability 业务类型
 */

// ─── Frontmatter ──────────────────────────────────────────────

/** Shell 类型（用于 !`cmd` 执行） */
export type FrontmatterShell = 'bash' | 'powershell';

/** SKILL.md YAML frontmatter 中所有合法字段 */
export interface SkillFrontmatter {
  /** 显示名称覆盖（默认用目录名） */
  name?: string;
  /** 人类可读的技能描述 */
  description?: string;
  /** 允许使用的工具列表（逗号分隔或数组） */
  'allowed-tools'?: string | string[];
  /** 命名参数，用于 $arg 替换（空格分隔字符串或数组） */
  arguments?: string | string[];
  /** UI 中显示在命令名后面的参数提示 */
  'argument-hint'?: string;
  /** 详细的使用场景描述，供模型参考 */
  when_to_use?: string;
  /** 语义版本号 */
  version?: string;
  /** 模型别名覆盖（haiku/sonnet/opus），或 inherit 使用父级模型 */
  model?: string;
  /** 是否禁止模型通过 SkillTool 调用（仅保留斜杠命令） */
  'disable-model-invocation'?: boolean | string;
  /** 用户是否可通过 /skill-name 调用。默认 true */
  'user-invocable'?: boolean | string;
  /** 钩子定义（PreToolUse / PostToolUse / Stop 等） */
  hooks?: Record<string, unknown>;
  /** 努力级别：low / medium / high / max / 整数 */
  effort?: string | number;
  /** 执行上下文：inline = 扩展到当前对话，fork = 子代理隔离执行 */
  context?: 'inline' | 'fork';
  /** fork 执行时的代理类型（默认 general-purpose） */
  agent?: string;
  /** 条件激活的 glob 路径模式（逗号分隔或数组） */
  paths?: string | string[];
  /** !`cmd` 和 ```! 块使用的 shell，默认 bash */
  shell?: 'bash' | 'powershell';

  /** 兼容旧格式：metadata JSON 字符串 */
  metadata?: string | Record<string, unknown>;

  // 允许扩展字段
  [key: string]: unknown;
}

// ─── Parsed Skill ─────────────────────────────────────────────

/** 解析后的完整 SKILL.md */
export interface ParsedSkill {
  /** 技能唯一 ID（来自目录名或 name 字段） */
  id: string;
  /** SKILL.md 文件所在目录的绝对路径 */
  skillDir: string;
  /** 解析后的 frontmatter */
  frontmatter: SkillFrontmatter;
  /** frontmatter 之后的 Markdown body（未经参数替换） */
  body: string;
  /** 加载来源 */
  loadedFrom: 'external' | 'ontology' | 'discovered';
}

// ─── Execution ────────────────────────────────────────────────

/** 执行请求 */
export interface SkillExecutionRequest {
  /** 技能 ID */
  skillId: string;
  /** 用户传入的原始参数字符串 */
  args?: string;
  /** 或结构化参数对象（兼容旧接口） */
  params?: Record<string, unknown>;
  /** 执行模式覆盖（默认用 frontmatter.context） */
  mode?: 'inline' | 'fork' | 'spawn';
  /** 工作目录 */
  workingDirectory?: string;
}

/** 执行结果 */
export interface SkillExecutionResult {
  success: boolean;
  /** 最终执行模式 */
  executionMode: 'inline' | 'fork' | 'spawn';
  /** 参数替换后的 body（inline 模式） */
  substitutedBody?: string;
  /** 执行的 shell 命令列表 */
  shellCommands?: string[];
  /** shell 命令输出列表 */
  shellOutputs?: string[];
  /** spawn 子进程的 stdout */
  spawnOutput?: unknown;
  /** 错误信息 */
  error?: string;
  /** 耗时毫秒 */
  durationMs: number;
}

// ─── Discovery ────────────────────────────────────────────────

/** 扫描发现的结果 */
export interface DiscoveredSkill {
  id: string;
  skillDir: string;
  frontmatter: SkillFrontmatter;
  body: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ─── Validation ───────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ─── SAFE_SKILL_PROPERTIES ────────────────────────────────────

/**
 * 安全属性白名单（来自 Claude Code）
 * 白名单中的字段被认为是安全的，无需额外权限检查
 * 新增字段默认不安全，需显式添加到白名单
 */
export const SAFE_SKILL_PROPERTIES = new Set([
  'type', 'progressMessage', 'contentLength', 'argNames', 'model', 'effort',
  'source', 'disableNonInteractive', 'skillRoot', 'context',
  'agent', 'getPromptForCommand', 'frontmatterKeys',
  'name', 'description', 'hasUserSpecifiedDescription', 'isEnabled', 'isHidden',
  'aliases', 'isMcp', 'argumentHint', 'whenToUse', 'paths', 'version',
  'disableModelInvocation', 'userInvocable', 'loadedFrom', 'immediate',
  'userFacingName', 'arguments', 'allowed-tools', 'argument-hint',
  'when_to_use', 'user-invocable', 'hooks', 'shell', 'metadata',
  'hide-from-slash-command-tool', 'skills',
]);

/** 检查技能是否只使用安全属性 */
export function skillHasOnlySafeProperties(frontmatter: SkillFrontmatter): boolean {
  for (const key of Object.keys(frontmatter)) {
    if (SAFE_SKILL_PROPERTIES.has(key)) continue;
    const value = (frontmatter as Record<string, unknown>)[key];
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0) continue;
    return false;
  }
  return true;
}
