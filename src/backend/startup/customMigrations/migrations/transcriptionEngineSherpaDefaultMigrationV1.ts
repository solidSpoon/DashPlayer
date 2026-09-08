import Store from 'electron-store';
import fs from 'fs';
import path from 'path';

import { storeSet } from '@/backend/infrastructure/settings/store';
import {
    resolveStorageDirectory,
    resolveStorageRootPath,
} from '@/backend/infrastructure/storage/StorageDirectorySupport';
import { StorageDirectoryTarget } from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import {
    PARAKEET_MODEL_DIRECTORY,
    PARAKEET_REQUIRED_FILES,
} from '@/backend/services/models/parakeetModel';
import { getEnvironmentConfigName } from '@/backend/utils/runtimeEnv';

import type { CustomMigration } from '../types';
import { resolveMigratedTranscriptionEngine } from './transcriptionEngineDefaultLogic';

const MIGRATION_ID = 'transcription-engine-sherpa-default-v1';
const TRANSCRIPTION_ENGINE_KEY = 'transcription.engine';

const settingsStore = new Store<Record<string, unknown>>({
    name: getEnvironmentConfigName('config'),
});

/**
 * 读取用户配置的存储根路径原始值；未配置时返回空串，由 resolveStorageRootPath 落到默认文档目录。
 */
const getConfiguredStoragePath = (): string => {
    const configured = settingsStore.get('storage.path');
    return typeof configured === 'string' ? configured : '';
};

/**
 * 判断 sherpa Parakeet 模型是否已完整安装。
 *
 * @returns 四个必需模型文件全部存在且为普通文件时为 true；任一缺失（含目录不存在、外接盘未挂载导致的不可见）均为 false。
 */
const isSherpaModelInstalled = (): boolean => {
    const modelsRoot = resolveStorageDirectory(
        resolveStorageRootPath(getConfiguredStoragePath()),
        StorageDirectoryTarget.MODELS,
    );
    const modelDirectory = path.join(modelsRoot, PARAKEET_MODEL_DIRECTORY);
    return PARAKEET_REQUIRED_FILES.every((fileName) => {
        try {
            return fs.statSync(path.join(modelDirectory, fileName)).isFile();
        } catch {
            return false;
        }
    });
};

/**
 * 老用户识别引擎平滑迁移：`transcription.engine` 为新增键，老配置文件中没有，
 * 若不做处理，升级用户会被 schema 默认值切到 whisper-cpp，而其 GGUF 模型尚未
 * 下载，识别直接报错。本迁移把"已完整安装 sherpa CPU 模型"的用户显式落盘为
 * `sherpa-onnx`，其余用户不写入、走新默认值。
 *
 * 迁移只跑一次（sysConf 标记），之后用户可在设置中自由切换引擎。
 */
export const transcriptionEngineSherpaDefaultMigrationV1: CustomMigration = {
    id: MIGRATION_ID,
    description: '未显式设置过识别引擎且已安装 sherpa CPU 模型的老用户，升级后沿用 sherpa-onnx 引擎',
    run: async (): Promise<void> => {
        const decision = resolveMigratedTranscriptionEngine(
            settingsStore.has(TRANSCRIPTION_ENGINE_KEY),
            isSherpaModelInstalled(),
        );
        if (decision !== null) {
            storeSet(TRANSCRIPTION_ENGINE_KEY, decision);
        }
    },
};
