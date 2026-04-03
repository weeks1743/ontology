// 规则校验器 - 执行规则表达式求值

import { OntologyRule } from './ontology-client.js';

export interface ValidationResult {
  passed: boolean;
  failedRules: Array<{
    rule: OntologyRule;
    message: string;
  }>;
}

// 简单的表达式求值器
export class RuleValidator {
  // 校验数据是否满足规则
  validate(data: any, rules: OntologyRule[]): ValidationResult {
    const failedRules: Array<{ rule: OntologyRule; message: string }> = [];

    for (const rule of rules) {
      try {
        const passed = this.evaluateExpression(rule.expression, data);
        if (!passed) {
          failedRules.push({
            rule,
            message: rule.failure_message,
          });
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.code}:`, error);
        failedRules.push({
          rule,
          message: `规则执行错误: ${(error as Error).message}`,
        });
      }
    }

    return {
      passed: failedRules.length === 0,
      failedRules,
    };
  }

  // 表达式求值
  private evaluateExpression(expression: string, data: any): boolean {
    try {
      // 替换变量引用
      let processedExpr = expression;

      // 支持的操作符
      const operators = ['&&', '||', '>=', '<=', '!=', '==', '>', '<'];

      // 查找所有变量引用（如 title, phone, amount 等）
      const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
      const matches = expression.match(varPattern);

      if (matches) {
        for (const varName of matches) {
          // 跳过操作符关键字
          if (['true', 'false', 'null', 'undefined', 'and', 'or', 'not'].includes(varName)) {
            continue;
          }

          // 替换变量为实际值
          const value = data[varName];
          const valueStr = this.serializeValue(value);

          // 使用正则替换，确保只替换完整的单词
          const regex = new RegExp(`\\b${varName}\\b`, 'g');
          processedExpr = processedExpr.replace(regex, valueStr);
        }
      }

      // 执行表达式求值
      // 注意：这里使用 Function 构造函数而不是 eval，相对更安全
      const result = new Function(`return ${processedExpr}`)();
      return Boolean(result);
    } catch (error) {
      console.error('Expression evaluation error:', error);
      throw error;
    }
  }

  // 序列化值为 JavaScript 表达式
  private serializeValue(value: any): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'string') {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return 'null';
  }

  // 检查必填字段
  validateRequiredFields(data: any, requiredFields: string[]): ValidationResult {
    const failedRules: Array<{ rule: OntologyRule; message: string }> = [];

    for (const field of requiredFields) {
      if (!data[field] || data[field] === '') {
        failedRules.push({
          rule: {
            id: `required_${field}`,
            code: `required_${field}`,
            name: `必填字段: ${field}`,
            description: `${field} 是必填字段`,
            expression: `${field} != null && ${field} != ""`,
            severity: 'error',
            failure_message: `缺少必填字段: ${field}`,
          },
          message: `缺少必填字段: ${field}`,
        });
      }
    }

    return {
      passed: failedRules.length === 0,
      failedRules,
    };
  }

  // 检查字段类型
  validateFieldTypes(data: any, fieldTypes: Record<string, string>): ValidationResult {
    const failedRules: Array<{ rule: OntologyRule; message: string }> = [];

    for (const [field, expectedType] of Object.entries(fieldTypes)) {
      const value = data[field];
      if (value === null || value === undefined) {
        continue; // 跳过空值
      }

      const actualType = typeof value;
      let typeMatch = false;

      switch (expectedType) {
        case 'string':
          typeMatch = actualType === 'string';
          break;
        case 'number':
          typeMatch = actualType === 'number';
          break;
        case 'boolean':
          typeMatch = actualType === 'boolean';
          break;
        case 'date':
          typeMatch = actualType === 'string' && !isNaN(Date.parse(value));
          break;
        default:
          typeMatch = true;
      }

      if (!typeMatch) {
        failedRules.push({
          rule: {
            id: `type_${field}`,
            code: `type_${field}`,
            name: `字段类型: ${field}`,
            description: `${field} 应该是 ${expectedType} 类型`,
            expression: `typeof ${field} === "${expectedType}"`,
            severity: 'error',
            failure_message: `字段 ${field} 类型错误，期望 ${expectedType}，实际 ${actualType}`,
          },
          message: `字段 ${field} 类型错误，期望 ${expectedType}，实际 ${actualType}`,
        });
      }
    }

    return {
      passed: failedRules.length === 0,
      failedRules,
    };
  }
}

// 单例实例
export const ruleValidator = new RuleValidator();
