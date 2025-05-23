export class FileValidationError extends Error {
    details: any;

    constructor(message: string, details?: any) {
        super(message);
        this.name = 'FileValidationError';
        this.details = details;
    }
}