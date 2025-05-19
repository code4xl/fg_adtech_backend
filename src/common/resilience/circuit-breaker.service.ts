import { Injectable, Logger } from '@nestjs/common';

enum CircuitState {
  CLOSED,
  OPEN,
  HALF_OPEN,
}

interface CircuitOptions {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenSuccesses: number;
}

@Injectable()
export class CircuitBreakerService {
  private circuits: Map<string, Circuit> = new Map();
  private readonly logger = new Logger(CircuitBreakerService.name);

  registerCircuit(name: string, options?: Partial<CircuitOptions>): Circuit {
    if (!this.circuits.has(name)) {
      this.circuits.set(
        name,
        new Circuit(name, {
          failureThreshold: options?.failureThreshold || 5,
          resetTimeout: options?.resetTimeout || 10000,
          halfOpenSuccesses: options?.halfOpenSuccesses || 2,
        }),
      );
      this.logger.log(`Circuit registered: ${name}`);
    }
    return this.circuits.get(name)!;
  }

  getCircuit(name: string): Circuit {
    if (!this.circuits.has(name)) {
      this.logger.warn(`Circuit not found: ${name}, registering with defaults`);
      return this.registerCircuit(name);
    }
    return this.circuits.get(name)!;
  }

  async executeWithCircuitBreaker<T>(
    circuitName: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const circuit = this.getCircuit(circuitName);

    if (circuit.isOpen()) {
      this.logger.warn(`Circuit ${circuitName} is OPEN, request rejected`);
      throw new Error(`Service unavailable: circuit ${circuitName} is open`);
    }

    try {
      const result = await fn();
      circuit.recordSuccess();
      return result;
    } catch (error) {
      circuit.recordFailure();
      throw error;
    }
  }
}

class Circuit {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastStateChange: number = Date.now();
  private readonly logger = new Logger('Circuit');

  constructor(
    private readonly name: string,
    private readonly options: CircuitOptions,
  ) {}

  isOpen(): boolean {
    this.checkStateTransition();
    return this.state === CircuitState.OPEN;
  }

  recordSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.options.halfOpenSuccesses) {
        this.toState(CircuitState.CLOSED);
      }
    }
    this.failures = 0; // Reset failures on success in CLOSED state
  }

  recordFailure(): void {
    this.failures++;

    if (
      this.state === CircuitState.CLOSED &&
      this.failures >= this.options.failureThreshold
    ) {
      this.toState(CircuitState.OPEN);
    } else if (this.state === CircuitState.HALF_OPEN) {
      this.toState(CircuitState.OPEN);
    }
  }

  private checkStateTransition(): void {
    if (
      this.state === CircuitState.OPEN &&
      Date.now() - this.lastStateChange >= this.options.resetTimeout
    ) {
      this.toState(CircuitState.HALF_OPEN);
    }
  }

  private toState(state: CircuitState): void {
    if (this.state === state) return;

    const stateMap = {
      [CircuitState.CLOSED]: 'CLOSED',
      [CircuitState.OPEN]: 'OPEN',
      [CircuitState.HALF_OPEN]: 'HALF-OPEN',
    };

    this.logger.log(
      `Circuit ${this.name} state change: ${stateMap[this.state]} -> ${stateMap[state]}`,
    );

    this.state = state;
    this.lastStateChange = Date.now();
    this.failures = state === CircuitState.CLOSED ? 0 : this.failures;
    this.successes = state === CircuitState.HALF_OPEN ? 0 : this.successes;
  }
}
