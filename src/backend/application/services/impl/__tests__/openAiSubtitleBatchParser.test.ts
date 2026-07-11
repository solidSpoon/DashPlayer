import { describe, expect, it } from 'vitest';
import { parseOpenAIBatchTextResult } from '../openAiSubtitleBatchParser';

describe('parseOpenAIBatchTextResult', () => {
    const windowSentences = [
        {
            fileHash: 'file-a',
            translationKey: 'file-a:1'
        },
        {
            fileHash: 'file-a',
            translationKey: 'file-a:2'
        }
    ];

    it('parses subtitle batch JSON from a fenced model response', () => {
        const text = [
            '```json',
            '{',
            '  "items": [',
            '    {"key": "file-a:1", "translation": "你好"},',
            '    {"key": "file-a:2", "translation": "世界"}',
            '  ]',
            '}',
            '```'
        ].join('\n');

        expect(parseOpenAIBatchTextResult(text, windowSentences)).toEqual([
            { key: 'file-a:1', fileHash: 'file-a', translation: '你好' },
            { key: 'file-a:2', fileHash: 'file-a', translation: '世界' }
        ]);
    });

    it('ignores items whose keys are not in the current subtitle window', () => {
        const text = JSON.stringify({
            items: [
                { key: 'file-a:1', translation: '保留' },
                { key: 'file-a:999', translation: '忽略' }
            ]
        });

        expect(parseOpenAIBatchTextResult(text, windowSentences)).toEqual([
            { key: 'file-a:1', fileHash: 'file-a', translation: '保留' }
        ]);
    });
});
