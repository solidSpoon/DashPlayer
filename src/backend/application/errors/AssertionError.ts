export default class AssertionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AssertionError';
        Error.captureStackTrace(this, AssertionError);
    }
}
