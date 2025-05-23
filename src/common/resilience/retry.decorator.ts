import { Logger } from '@nestjs/common';

export function WithRetry(
  maxAttempts: number = 3,
  delayMs: number = 100,
  backoffFactor: number = 2,
  retryableErrors: any[] = [Error],
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const logger = new Logger(`Retry(${target.constructor.name})`);

    descriptor.value = async function (...args: any[]) {
      let attempt = 1;
      let delay = delayMs;

      while (attempt <= maxAttempts) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          const isRetryable = retryableErrors.some(
            (errorType) => error instanceof errorType,
          );

          if (!isRetryable || attempt === maxAttempts) {
            logger.error(
              `Failed after ${attempt} attempts: ${error.message}`,
              error.stack,
            );
            throw error;
          }

          logger.warn(
            `Attempt ${attempt}/${maxAttempts} failed: ${error.message}. Retrying in ${delay}ms...`,
          );

          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= backoffFactor; // Exponential backoff
          attempt++;
        }
      }
    };

    return descriptor;
  };
}
