import { describe, expect, it } from 'vitest';
import { parseSubtitleBatchLines } from '@/backend/infrastructure/translate/subtitleBatchPrompt';

/**
 * 紧凑行式输出的解析契约：本地模型按「每行一条译文」返回，
 * 行数必须与目标句数一致才能按序对齐；模型自发添加的装饰前缀
 * （实测 Qwen3-0.6B 会模仿 "- " 或自发 "1. "）不进入业务层。
 */
describe('紧凑行式译文解析', () => {
    it('按行拆分并返回与目标数一致的译文数组', () => {
        const lines = parseSubtitleBatchLines('第一句\n第二句\n第三句', 3);
        expect(lines).toEqual(['第一句', '第二句', '第三句']);
    });

    it('忽略首尾空白行；译文自身保留前后内部空格的 trim 结果', () => {
        const lines = parseSubtitleBatchLines('\n译文甲\n\n\n译文乙\n', 2);
        expect(lines).toEqual(['译文甲', '译文乙']);
    });

    it('剥离模型模仿输入格式带上的列表或序号前缀', () => {
        const lines = parseSubtitleBatchLines('- 甲\n* 乙\n1. 丙\n2、丁\n3）戊', 5);
        expect(lines).toEqual(['甲', '乙', '丙', '丁', '戊']);
    });

    it('行数多于或少于目标数时显式报错，不做静默对齐', () => {
        expect(() => parseSubtitleBatchLines('甲\n乙', 3)).toThrow('行数不匹配');
        expect(() => parseSubtitleBatchLines('甲\n乙\n丙', 2)).toThrow('行数不匹配');
    });
});
