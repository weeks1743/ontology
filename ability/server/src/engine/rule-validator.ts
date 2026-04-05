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

  // Public expression evaluation (supports string expressions and structured objects)
  evaluateExpression(expression: any, data: any): boolean {
    if (expression === null || expression === undefined) return true;

    if (typeof expression === 'object') {
      return this.evaluateStructuredExpression(expression, data);
    }

    if (typeof expression !== 'string') return true;

    return this.evaluateStringExpression(expression, data);
  }

  // Evaluate a structured (AST-like) expression object
  evaluateStructuredExpression(expression: any, data: any): boolean {
    if (!expression || typeof expression !== 'object') return true;

    const type = expression.type;

    if (type === 'logical_and' || type === 'and') {
      const operands: any[] = expression.operands || [];
      return operands.every(op => this.evaluateExpression(op, data));
    }

    if (type === 'logical_or' || type === 'or') {
      const operands: any[] = expression.operands || [];
      return operands.some(op => this.evaluateExpression(op, data));
    }

    if (type === 'logical_not' || type === 'not') {
      return !this.evaluateExpression(expression.operand || expression.operands?.[0], data);
    }

    if (type === 'comparison') {
      const leftVal = this.resolveValue(expression.left, data);
      const rightVal = expression.right;
      const op = expression.operator;
      return this.compareValues(leftVal, op, rightVal);
    }

    if (type === 'is_null') {
      const val = this.resolveValue(expression.field, data);
      return val === null || val === undefined;
    }

    if (type === 'is_not_null') {
      const val = this.resolveValue(expression.field, data);
      return val !== null && val !== undefined;
    }

    if (type === 'in') {
      const val = this.resolveValue(expression.field || expression.left, data);
      const values: any[] = expression.values || expression.right || [];
      return values.includes(val);
    }

    if (type === 'not_in') {
      const val = this.resolveValue(expression.field || expression.left, data);
      const values: any[] = expression.values || expression.right || [];
      return !values.includes(val);
    }

    // required_fields shorthand
    if (expression.required_fields) {
      const fields: string[] = expression.required_fields;
      return fields.every(f => data[f] !== undefined && data[f] !== null && data[f] !== '');
    }

    // Fallback: treat as truthy
    return true;
  }

  private resolveValue(ref: any, data: any): any {
    if (typeof ref !== 'string') return ref;
    // Support dot paths like "input.amount"
    const parts = ref.split('.');
    let val: any = data;
    for (const part of parts) {
      val = val?.[part];
    }
    return val !== undefined ? val : data[ref];
  }

  private compareValues(left: any, op: string, right: any): boolean {
    switch (op) {
      case '>=': return left >= right;
      case '<=': return left <= right;
      case '>': return left > right;
      case '<': return left < right;
      case '==': case '===': return left == right;
      case '!=': case '!==': return left != right;
      case 'contains': return typeof left === 'string' && left.includes(String(right));
      case 'starts_with': return typeof left === 'string' && left.startsWith(String(right));
      case 'ends_with': return typeof left === 'string' && left.endsWith(String(right));
      default: return true;
    }
  }

  // String expression evaluation (legacy)
  private evaluateStringExpression(expression: string, data: any): boolean {
    try {
      let processedExpr = expression;

      // Handle dot-notation references like "lead.title", "opportunity.probability"
      // by replacing them with the flat data field value
      const dotPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
      processedExpr = processedExpr.replace(dotPattern, (_match, _prefix, field) => {
        const value = data[field] !== undefined ? data[field] : data[`${_prefix}.${field}`];
        return this.serializeValue(value);
      });

      // Handle remaining bare variable names
      const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
      const matches = processedExpr.match(varPattern);

      if (matches) {
        for (const varName of matches) {
          if (['true', 'false', 'null', 'undefined', 'and', 'or', 'not'].includes(varName)) {
            continue;
          }

          const value = data[varName];
          const valueStr = this.serializeValue(value);

          const regex = new RegExp(`\\b${varName}\\b`, 'g');
          processedExpr = processedExpr.replace(regex, valueStr);
        }
      }

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
