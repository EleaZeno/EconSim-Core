/**
 * DETERMINISM & REPRODUCIBILITY CONTRACT
 * 
 * This service provides a pseudo-random number generator (PRNG) that ensures
 * bit-level reproducibility of the simulation given the same initial seed.
 * 
 * - Algorithm: Mulberry32 (Fast, decent quality, simple state).
 * - State: Must be stored in WorldState to allow time-travel/rollback.
 * - Constraints: NEVER use Math.random() in the simulation engine.
 */

export class DeterministicRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /**
   * Returns a float between 0 and 1.
   * Advances internal state.
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns current internal state for serialization
   */
  getState(): number {
    return this.state;
  }

  /**
   * Fisher-Yates Shuffle using this PRNG.
   * Essential for ensuring agent execution order doesn't bias results 
   * in a way that isn't reproducible.
   */
  shuffle<T>(array: T[]): T[] {
    let currentIndex = array.length, randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex !== 0) {
      // Pick a remaining element.
      randomIndex = Math.floor(this.next() * currentIndex);
      currentIndex--;

      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }

    return array;
  }
}
