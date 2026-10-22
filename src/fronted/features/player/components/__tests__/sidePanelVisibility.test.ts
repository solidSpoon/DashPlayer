import { describe, expect, it } from 'vitest';

import { isSidebarHiddenByEnglish } from '../sidePanelVisibility';

describe('侧栏是否被英文字幕开关收起', () => {
    it('跟随英文字幕隐藏且英文字幕已关闭时，侧栏被收起', () => {
        expect(isSidebarHiddenByEnglish(true, false)).toBe(true);
    });

    it('跟随英文字幕隐藏但英文字幕仍显示时，侧栏照常可见', () => {
        expect(isSidebarHiddenByEnglish(true, true)).toBe(false);
    });

    it('不跟随英文字幕隐藏时，即使英文字幕关闭侧栏也可见', () => {
        expect(isSidebarHiddenByEnglish(false, false)).toBe(false);
    });

    it('不跟随英文字幕隐藏且英文字幕显示时，侧栏可见', () => {
        expect(isSidebarHiddenByEnglish(false, true)).toBe(false);
    });
});
