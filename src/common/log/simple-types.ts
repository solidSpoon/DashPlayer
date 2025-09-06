// src/common/log/simple-types.ts
export type SimpleLevel = 'debug' | 'info' | 'warn' | 'error';

export interface SimpleEvent {
  ts: string;
  level: SimpleLevel;
  process: 'main' | 'renderer';
  module: string;     // 组件或文件名
  msg: string;
  data?: any;         // 结构化对象（可选）
}