import { beforeEach, it, vi } from 'vitest';

import bdd from '@/test/bdd';
import { createTemplateDomainSteps, TemplateDomainSteps } from './template-domain.steps';

const { scenario, given, when, then } = bdd;

vi.mock('inversify', () => ({
    injectable: () => (target: unknown) => target,
    inject: () => (target: unknown, _propertyKey: string) => target,
}));

vi.mock('@/backend/infrastructure/logger', () => ({
    getMainLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

let steps: TemplateDomainSteps;

beforeEach(() => {
    steps = createTemplateDomainSteps();
});

scenario('【模板】某业务域：行为场景（场景层）', () => {
    it('给定<前置条件A>，当<触发动作A>，那么<业务结果A>', async () => {
        await given('给定：<前置条件A>', () => steps.givenPreconditionA());
        await when('当：<触发动作A>', () => steps.whenActionA());
        await then('那么：<业务结果A>', () => steps.thenOutcomeA());
    });

    it('给定<前置条件B>，当<触发动作B>，那么<业务结果B>', async () => {
        await given('给定：<前置条件B>', () => steps.givenPreconditionB());
        await when('当：<触发动作B>', () => steps.whenActionB());
        await then('那么：<业务结果B>', () => steps.thenOutcomeB());
    });
});
