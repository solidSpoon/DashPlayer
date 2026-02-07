export type TemplateDomainFixture = {
    setInput: (value: string) => void;
    runAction: (kind: 'A' | 'B') => Promise<string>;
};

export function createTemplateDomainFixture(): TemplateDomainFixture {
    let input = '';

    return {
        setInput(value: string) {
            input = value;
        },
        async runAction(kind: 'A' | 'B') {
            if (kind === 'A' && input === 'A-ready') {
                return 'A-done';
            }
            if (kind === 'B' && input === 'B-ready') {
                return 'B-done';
            }
            return 'invalid';
        },
    };
}
