import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SWRConfig } from 'swr';
import React from 'react';
import ProxySetting from '@/fronted/pages/setting/ProxySetting';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const KEY = 'settings/proxy/detail';

beforeAll(() => {
    if (typeof window !== 'undefined') {
        HTMLElement.prototype.hasPointerCapture = () => false;
        HTMLElement.prototype.setPointerCapture = () => {};
        HTMLElement.prototype.releasePointerCapture = () => {};
        HTMLElement.prototype.scrollIntoView = () => {};
    }
});

afterEach(() => cleanup());

const renderPage = () => {
    return render(
        <SWRConfig value={{ provider: () => new Map() }}>
            <ProxySetting />
        </SWRConfig>
    );
};

describe('ProxySetting（SWR 版本）', () => {
    it('detail 返回 custom 时页面显示“自定义”', async () => {
        const calls: unknown[] = [];
        window.electron = {
            call: vi.fn((path: string, params: unknown) => {
                if (path === KEY) return Promise.resolve({ mode: 'custom', url: '', bypassRules: '' });
                if (path === 'settings/proxy/update') calls.push(params);
                return Promise.resolve(undefined);
            }),
        } as never;

        renderPage();
        const combo = await screen.findByRole('combobox', {}, { timeout: 3000 });
        await sleep(200);
        expect(combo.textContent).toContain('proxy.modeCustom');
        expect(calls).toHaveLength(0);
    });

    it('detail 返回 none 时页面显示“没有代理”', async () => {
        window.electron = {
            call: vi.fn((path: string) => {
                if (path === KEY) return Promise.resolve({ mode: 'none', url: '', bypassRules: '' });
                return Promise.resolve(undefined);
            }),
        } as never;

        renderPage();
        const combo = await screen.findByRole('combobox', {}, { timeout: 3000 });
        await sleep(200);
        expect(combo.textContent).toContain('proxy.modeNone');
    });
});
