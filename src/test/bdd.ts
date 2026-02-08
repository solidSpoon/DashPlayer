type StepFn<T = void> = () => T | Promise<T>;

export function scenario(_name: string, run: () => void): void {
    run();
}

export function given<T = void>(step: string, run: StepFn<T>): T | Promise<T> {
    void step;
    return run();
}

export function when<T = void>(step: string, run: StepFn<T>): T | Promise<T> {
    void step;
    return run();
}

function thenStep<T = void>(step: string, run: StepFn<T>): T | Promise<T> {
    void step;
    return run();
}

export function createBddFixture<T>(factory: () => T): () => T {
    return () => factory();
}

const bdd = {
    scenario,
    given,
    when,
    then: thenStep,
    createBddFixture,
};

export default bdd;
