// src/backend/ioc/simple-logger.ts
import path from 'path';
import fs from 'fs';
import log from 'electron-log/main';
import { SimpleEvent, SimpleLevel } from '@/common/log/simple-types';
import LocationUtil from '@/backend/utils/LocationUtil';
import { LocationType } from '@/backend/services/LocationService';

// 使用你们现有存储路径
const logPath = LocationUtil.staticGetStoragePath(LocationType.LOGS);

// 确保目录存在
if (!fs.existsSync(logPath)) fs.mkdirSync(logPath, { recursive: true });

// 按天文件名
function todayFile() {
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return path.join(logPath, `main-${day}.log`);
}

// electron-log 配置
log.initialize({ preload: true });
log.transports.file.resolvePathFn = todayFile;
log.transports.file.level = 'silly'; // 统一用我们自己的级别过滤
log.errorHandler.startCatching();

const levelOrder: Record<SimpleLevel, number> = {
  debug: 20, info: 30, warn: 40, error: 50,
};

// 全局开关：默认 debug
let CURRENT_LEVEL: SimpleLevel = (process.env.DP_LOG_LEVEL as SimpleLevel) || 'debug';

// 启动时输出当前日志级别
console.log('=== LOGGER INIT ===');
console.log('DP_LOG_LEVEL env:', process.env.DP_LOG_LEVEL);
console.log('CURRENT_LEVEL:', CURRENT_LEVEL);
console.log('levelOrder debug:', levelOrder.debug);
console.log('levelOrder info:', levelOrder.info);

// 测试日志输出
const testLogger = getMainLogger('logger-test');
testLogger.debug('This is a test debug message from logger init');
testLogger.info('This is a test info message from logger init');

export function setLogLevel(lv: SimpleLevel) {
  CURRENT_LEVEL = lv;
}

function writeJsonl(e: SimpleEvent) {
  try {
    log.log(JSON.stringify(e));
  } catch (err) {
    // 兜底
    console.error('writeJsonl failed', err);
  }
}

function logAt(moduleName: string, level: SimpleLevel, msg: string, data?: any) {
  const levelNum = levelOrder[level];
  const currentNum = levelOrder[CURRENT_LEVEL];
  
  // 调试：输出日志过滤决策
  if (msg.includes('=== LOGGER INIT') || msg.includes('SRT GENERATION') || msg.includes('DTW Word-level')) {
    console.log(`LOG FILTER DEBUG: level=${level}(${levelNum}), current=${CURRENT_LEVEL}(${currentNum}), pass=${levelNum >= currentNum}`);
  }
  
  if (levelNum < currentNum) return;
  writeJsonl({
    ts: new Date().toISOString(),
    level,
    process: 'main',
    module: moduleName,
    msg,
    data,
  });
}

// 导出一个简单 Logger 工厂
export function getMainLogger(moduleName: string) {
  return {
    debug: (msg: string, data?: any) => logAt(moduleName, 'debug', msg, data),
    info:  (msg: string, data?: any) => logAt(moduleName, 'info',  msg, data),
    warn:  (msg: string, data?: any) => logAt(moduleName, 'warn',  msg, data),
    error: (msg: string, data?: any) => logAt(moduleName, 'error', msg, data),
  };
}

// 可选：简单的日志清理（保留 14 天）
export function pruneOldLogs(days = 14) {
  const keepMs = days * 24 * 60 * 60 * 1000;
  const now = Date.now();
  try {
    const files = fs.readdirSync(logPath);
    files.forEach(f => {
      if (!/^main-\d{4}-\d{2}-\d{2}\.log$/.test(f)) return;
      const full = path.join(logPath, f);
      const st = fs.statSync(full);
      if (now - st.mtimeMs > keepMs) fs.unlinkSync(full);
    });
  } catch (e) {
    console.error('pruneOldLogs error', e);
  }
}

// 可选：每日清理
setInterval(() => pruneOldLogs(), 24 * 60 * 60 * 1000).unref();
