/**
 * skill-core 模块入口
 * 100% 兼容 Claude Code SKILL 规范
 *
 * 用法：
 *   import { initSkillCore, skillCoreRouter } from './skill-core/index.js';
 *   app.use('/api/v2/skills', skillCoreRouter);
 *   initSkillCore();
 */

export { skillCoreRouter, initSkillCore } from './router.js';
export { executeSkill } from './executor.js';
export {
  discoverAndLoadSkills,
  getAllSkills,
  getSkillById,
  reloadSkills,
} from './discovery.js';
export { parseSkillMd, validateSkillMd } from './parser.js';
export { substituteArguments, parseArguments } from './params.js';
export { executeShellCommandsInPrompt, hasShellCommands } from './shell.js';
export type {
  SkillFrontmatter,
  ParsedSkill,
  SkillExecutionRequest,
  SkillExecutionResult,
  DiscoveredSkill,
  ValidationResult,
} from './types.js';
