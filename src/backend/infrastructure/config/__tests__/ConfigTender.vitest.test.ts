import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ConfigTender } from '@/backend/infrastructure/config/ConfigTender';

const tempDirs: string[] = [];

/**
 * 创建测试用的临时配置文件路径。
 * @param fileName 临时配置文件名。
 * @returns 临时配置文件完整路径。
 */
function createTempConfigPath(fileName: string): string {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashplayer-config-tender-vitest-'));
    tempDirs.push(tempDir);
    return path.join(tempDir, fileName);
}

/**
 * 清理当前测试创建的所有临时目录。
 * @returns 无返回值。
 */
function cleanupTempDirs(): void {
    for (const tempDir of tempDirs.splice(0)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

afterEach(() => {
    cleanupTempDirs();
});

describe('ConfigTender（普通 Vitest 对照）', () => {
    it('就算默认值是 0，第一次创建时也要写入配置文件', () => {
        const configPath = createTempConfigPath('number-config.json');
        const configTender = new ConfigTender<number, z.ZodNumber>(configPath, z.number(), 0);

        expect(fs.existsSync(configPath)).toBe(true);
        expect(configTender.get()).toBe(0);
    });

    it('配置文件坏了时，读取配置会自动回退到默认值并修好文件', () => {
        const configPath = createTempConfigPath('broken-config.json');
        fs.writeFileSync(configPath, '{ invalid-json');

        const schema = z.object({ enabled: z.boolean() });
        const defaultValue = { enabled: false };
        const configTender = new ConfigTender<typeof defaultValue, typeof schema>(
            configPath,
            schema,
            defaultValue,
        );

        expect(configTender.get()).toEqual(defaultValue);

        const repaired = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        expect(repaired).toEqual(defaultValue);
    });

    it('关闭自动修复时，配置文件损坏应直接抛错', () => {
        const configPath = createTempConfigPath('broken-no-repair.json');
        fs.writeFileSync(configPath, '{ invalid-json');

        const schema = z.object({ enabled: z.boolean() });
        const defaultValue = { enabled: false };
        const configTender = new ConfigTender<typeof defaultValue, typeof schema>(
            configPath,
            schema,
            defaultValue,
            {
                autoRepairOnInvalid: false,
            },
        );

        expect(() => configTender.get()).toThrowError('Failed to read config');
        expect(fs.readFileSync(configPath, 'utf-8')).toBe('{ invalid-json');
    });

    it('自动修复成功时应通知调用方', () => {
        const configPath = createTempConfigPath('broken-with-callback.json');
        fs.writeFileSync(configPath, '{ invalid-json');

        const schema = z.object({ enabled: z.boolean() });
        const defaultValue = { enabled: false };
        const onInvalid = vi.fn();
        const onAutoRepaired = vi.fn();

        const configTender = new ConfigTender<typeof defaultValue, typeof schema>(
            configPath,
            schema,
            defaultValue,
            {
                onInvalid,
                onAutoRepaired,
            },
        );

        const result = configTender.get();

        expect(result).toEqual(defaultValue);
        expect(onInvalid).toHaveBeenCalledTimes(1);
        expect(onAutoRepaired).toHaveBeenCalledWith(defaultValue);
    });

    it('文件不存在且没有默认值时，读取应抛错', () => {
        const configPath = createTempConfigPath('missing-without-default.json');
        const schema = z.object({ enabled: z.boolean() });
        const configTender = new ConfigTender<z.infer<typeof schema>, typeof schema>(configPath, schema);

        expect(() => configTender.get()).toThrowError('Failed to read config');
    });

    it('JSON 合法但 schema 不匹配时，开启自动修复应回退默认值并修复文件', () => {
        const configPath = createTempConfigPath('schema-invalid-auto-repair.json');
        fs.writeFileSync(configPath, JSON.stringify({ enabled: 'no' }));

        const schema = z.object({ enabled: z.boolean() });
        const defaultValue = { enabled: true };
        const onInvalid = vi.fn();
        const onAutoRepaired = vi.fn();

        const configTender = new ConfigTender<typeof defaultValue, typeof schema>(
            configPath,
            schema,
            defaultValue,
            {
                autoRepairOnInvalid: true,
                onInvalid,
                onAutoRepaired,
            },
        );

        const result = configTender.get();

        expect(result).toEqual(defaultValue);
        expect(onInvalid).toHaveBeenCalledTimes(1);
        expect(onAutoRepaired).toHaveBeenCalledWith(defaultValue);
        expect(JSON.parse(fs.readFileSync(configPath, 'utf-8'))).toEqual(defaultValue);
    });

    it('JSON 合法但 schema 不匹配时，关闭自动修复应抛错且保留原文件', () => {
        const configPath = createTempConfigPath('schema-invalid-no-repair.json');
        const originalValue = { enabled: 'no' };
        fs.writeFileSync(configPath, JSON.stringify(originalValue));

        const schema = z.object({ enabled: z.boolean() });
        const defaultValue = { enabled: false };
        const configTender = new ConfigTender<typeof defaultValue, typeof schema>(
            configPath,
            schema,
            defaultValue,
            {
                autoRepairOnInvalid: false,
            },
        );

        expect(() => configTender.get()).toThrowError('Failed to read config');
        expect(JSON.parse(fs.readFileSync(configPath, 'utf-8'))).toEqual(originalValue);
    });

    it('保存不合法配置时应抛错，且不覆盖原有合法文件内容', () => {
        const configPath = createTempConfigPath('save-invalid.json');
        const schema = z.object({ enabled: z.boolean() });
        const defaultValue = { enabled: true };
        const configTender = new ConfigTender<typeof defaultValue, typeof schema>(configPath, schema, defaultValue);

        expect(() => configTender.save({ enabled: 'bad' } as unknown as typeof defaultValue)).toThrowError('Failed to save config');
        expect(JSON.parse(fs.readFileSync(configPath, 'utf-8'))).toEqual(defaultValue);
    });

    it('默认值本身不符合 schema 时，自动修复路径应抛错', () => {
        const configPath = createTempConfigPath('invalid-default.json');
        fs.writeFileSync(configPath, '{ invalid-json');

        const schema = z.object({ enabled: z.boolean() });

        const invalidDefaultValue = { enabled: 'wrong' } as unknown as z.infer<typeof schema>;
        const configTender = new ConfigTender<z.infer<typeof schema>, typeof schema>(
            configPath,
            schema,
            invalidDefaultValue,
        );

        expect(() => configTender.get()).toThrow();
    });

    it('文件是空白内容时，读取会回退默认值并修复文件', () => {
        const configPath = createTempConfigPath('blank-file.json');
        fs.writeFileSync(configPath, '   ');

        const schema = z.object({ enabled: z.boolean() });
        const defaultValue = { enabled: false };
        const configTender = new ConfigTender<typeof defaultValue, typeof schema>(
            configPath,
            schema,
            defaultValue,
        );

        expect(configTender.get()).toEqual(defaultValue);
        expect(JSON.parse(fs.readFileSync(configPath, 'utf-8'))).toEqual(defaultValue);
    });
});
