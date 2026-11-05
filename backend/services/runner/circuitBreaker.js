/**
 * Circuit Breaker implementation for external service dependencies.
 *
 * Requirements:
 * - Open after 5 failures within 60 seconds.
 * - Stay open for 30 seconds.
 * - After cooldown, transition to HALF_OPEN to allow one trial request.
 * - If trial succeeds, close breaker; if trial fails, return to open for another 30 seconds.
 * - While open, reject immediately with status 503 "The code runner is temporarily unavailable".
 */
export class CircuitBreaker {
  constructor({
    failureThreshold = 5,
    windowMs = 60000,
    cooldownMs = 30000,
    errorMessage = "The code runner is temporarily unavailable",
  } = {}) {
    this.failureThreshold = failureThreshold;
    this.windowMs = windowMs;
    this.cooldownMs = cooldownMs;
    this.errorMessage = errorMessage;

    this.state = "CLOSED"; // "CLOSED" | "OPEN" | "HALF_OPEN"
    this.failures = [];     // Array of timestamps
    this.openedAt = null;
    this.trialInProgress = false;
  }

  getState() {
    this._checkCooldown();
    return this.state;
  }

  _checkCooldown() {
    if (this.state === "OPEN" && this.openedAt && Date.now() - this.openedAt >= this.cooldownMs) {
      this.state = "HALF_OPEN";
      this.trialInProgress = false;
    }
  }

  canExecute() {
    this._checkCooldown();
    if (this.state === "CLOSED") return true;
    if (this.state === "HALF_OPEN") {
      if (!this.trialInProgress) {
        this.trialInProgress = true;
        return true;
      }
      return false;
    }
    return false;
  }

  recordSuccess() {
    this.state = "CLOSED";
    this.failures = [];
    this.openedAt = null;
    this.trialInProgress = false;
  }

  recordFailure() {
    const now = Date.now();
    if (this.state === "HALF_OPEN") {
      // Trial failed: trip back to OPEN for cooldown
      this.state = "OPEN";
      this.openedAt = now;
      this.trialInProgress = false;
      return;
    }

    // Filter failures within sliding window
    this.failures = this.failures.filter((t) => now - t <= this.windowMs);
    this.failures.push(now);

    if (this.failures.length >= this.failureThreshold) {
      this.state = "OPEN";
      this.openedAt = now;
    }
  }

  reset() {
    this.state = "CLOSED";
    this.failures = [];
    this.openedAt = null;
    this.trialInProgress = false;
  }

  /**
   * Execute an async action through the circuit breaker.
   * @param {() => Promise<T>} action
   * @returns {Promise<T>}
   */
  async execute(action) {
    if (!this.canExecute()) {
      const error = new Error(this.errorMessage);
      error.status = 503;
      error.isCircuitOpen = true;
      throw error;
    }

    try {
      const result = await action();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      throw err;
    }
  }
}

export const runnerBreaker = new CircuitBreaker();
export default runnerBreaker;
