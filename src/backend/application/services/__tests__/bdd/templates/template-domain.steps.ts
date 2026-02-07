import { expect } from 'vitest';

import {
    createTemplateDomainFixture,
    TemplateDomainFixture,
} from './template-domain.fixture';

export class TemplateDomainSteps {
    private readonly fixture: TemplateDomainFixture;

    private latestResult: string | null = null;

    constructor() {
        this.fixture = createTemplateDomainFixture();
    }

    givenPreconditionA(): void {
        this.fixture.setInput('A-ready');
    }

    givenPreconditionB(): void {
        this.fixture.setInput('B-ready');
    }

    async whenActionA(): Promise<void> {
        this.latestResult = await this.fixture.runAction('A');
    }

    async whenActionB(): Promise<void> {
        this.latestResult = await this.fixture.runAction('B');
    }

    thenOutcomeA(): void {
        expect(this.latestResult).toBe('A-done');
    }

    thenOutcomeB(): void {
        expect(this.latestResult).toBe('B-done');
    }
}

export function createTemplateDomainSteps(): TemplateDomainSteps {
    return new TemplateDomainSteps();
}
