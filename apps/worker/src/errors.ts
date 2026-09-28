export class RetryableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "RetryableError";
    }
}

export function isRetryableError(error: unknown): boolean {
    return error instanceof RetryableError;
}