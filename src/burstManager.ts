/**
 * Burst Manager for WarrantyDog
 * Manages burst processing capabilities for API requests
 */

import type {
  VendorType,
  BurstManagerConfig,
  BurstState,
  IBurstManager
} from './types/rateLimiting.js';

interface BurstDecision {
  allowed: boolean;
  reason: string;
  burstSize?: number;
}

interface BurstHistoryEntry {
  startTime: number;
  endTime: number;
  duration: number;
  requestCount: number;
  reason: string;
  successful: boolean;
}

export class BurstManager implements IBurstManager {
  public readonly vendor: VendorType;
  private readonly config: Required<BurstManagerConfig>;

  // Burst state
  private isInBurstMode: boolean = false;
  private burstStartTime: number | null = null;
  private burstRequestCount: number = 0;
  private lastBurstEnd: number | null = null;

  // Performance tracking
  private burstHistory: BurstHistoryEntry[] = [];
  private successfulBursts: number = 0;
  private failedBursts: number = 0;

  constructor(vendor: VendorType, config: BurstManagerConfig = {}) {
    this.vendor = vendor;
    this.config = {
      maxBurstSize: config.maxBurstSize ?? 10,
      burstWindowMs: config.burstWindowMs ?? 30000, // 30 seconds
      cooldownMs: config.cooldownMs ?? 60000, // 1 minute
      adaptiveBurst: config.adaptiveBurst ?? true
    };

    console.log(`[${this.vendor}] Burst Manager initialized with config:`, this.config);
  }

  /**
   * Check if a burst can be started
   */
  public canStartBurst(currentRequests: number, minuteLimit: number): BurstDecision {
    // Don't start burst if already in burst mode
    if (this.isInBurstMode) {
      return { allowed: false, reason: 'Already in burst mode' };
    }

    // Check cooldown period
    if (this.lastBurstEnd && Date.now() - this.lastBurstEnd < this.config.cooldownMs) {
      const remainingCooldown = this.config.cooldownMs - (Date.now() - this.lastBurstEnd);
      return { 
        allowed: false, 
        reason: `Cooldown period active (${Math.ceil(remainingCooldown / 1000)}s remaining)` 
      };
    }

    // Check if we have room for burst
    const remainingCapacity = minuteLimit - currentRequests;
    let burstSize = Math.min(this.config.maxBurstSize, Math.floor(remainingCapacity * 0.5));

    // Adaptive burst sizing based on history
    if (this.config.adaptiveBurst) {
      burstSize = this.calculateAdaptiveBurstSize(burstSize, remainingCapacity);
    }

    if (burstSize < 3) {
      return { 
        allowed: false, 
        reason: 'Insufficient capacity for meaningful burst' 
      };
    }

    return {
      allowed: true,
      burstSize: burstSize,
      reason: `Burst of ${burstSize} requests approved`
    };
  }

  /**
   * Check if we can make a burst request
   */
  public canMakeBurstRequest(): boolean {
    if (!this.isInBurstMode) {
      return false;
    }

    // Check if burst window has expired
    if (this.burstStartTime && Date.now() - this.burstStartTime > this.config.burstWindowMs) {
      this.endBurst('window_expired');
      return false;
    }

    // Check if we've reached max burst size
    if (this.burstRequestCount >= this.config.maxBurstSize) {
      this.endBurst('max_size_reached');
      return false;
    }

    return true;
  }

  /**
   * Record a burst request
   */
  public recordBurstRequest(): void {
    if (!this.isInBurstMode) {
      console.warn(`[${this.vendor}] Attempted to record burst request while not in burst mode`);
      return;
    }

    this.burstRequestCount++;
    console.log(`[${this.vendor}] Burst request recorded (${this.burstRequestCount}/${this.config.maxBurstSize})`);

    // Auto-end burst if we've reached the limit
    if (this.burstRequestCount >= this.config.maxBurstSize) {
      this.endBurst('completed');
    }
  }

  /**
   * Start a burst processing session
   */
  public startBurst(): boolean {
    if (this.isInBurstMode) {
      console.warn(`[${this.vendor}] Attempted to start burst while already in burst mode`);
      return false;
    }

    this.isInBurstMode = true;
    this.burstStartTime = Date.now();
    this.burstRequestCount = 0;

    console.log(`[${this.vendor}] Burst mode started`);
    return true;
  }

  /**
   * End burst processing session
   */
  public endBurst(reason: string = 'completed'): boolean {
    if (!this.isInBurstMode || !this.burstStartTime) {
      return false;
    }

    const duration = Date.now() - this.burstStartTime;
    const burstData: BurstHistoryEntry = {
      startTime: this.burstStartTime,
      endTime: Date.now(),
      duration: duration,
      requestCount: this.burstRequestCount,
      reason: reason,
      successful: reason === 'completed'
    };

    this.burstHistory.push(burstData);

    if (reason === 'completed') {
      this.successfulBursts++;
    } else {
      this.failedBursts++;
    }

    // Reset burst state
    this.isInBurstMode = false;
    this.lastBurstEnd = Date.now();
    this.burstStartTime = null;
    this.burstRequestCount = 0;

    console.log(`[${this.vendor}] Burst ended: ${reason} (${burstData.requestCount} requests in ${duration}ms)`);
    return true;
  }

  /**
   * Get current burst state
   */
  public getBurstState(): BurstState {
    return {
      currentBurstSize: this.burstRequestCount,
      burstStartTime: this.burstStartTime,
      lastRequestTime: this.isInBurstMode ? Date.now() : null,
      inCooldown: this.isInCooldownPeriod(),
      cooldownStartTime: this.lastBurstEnd
    };
  }

  /**
   * Reset burst state (manual intervention)
   */
  public resetBurst(): void {
    this.isInBurstMode = false;
    this.burstStartTime = null;
    this.burstRequestCount = 0;
    this.lastBurstEnd = null;
    console.log(`[${this.vendor}] Burst state manually reset`);
  }

  /**
   * Get burst performance metrics
   */
  public getMetrics(): {
    totalBursts: number;
    successfulBursts: number;
    failedBursts: number;
    successRate: number;
    averageBurstSize: number;
    averageBurstDuration: number;
    isInBurstMode: boolean;
    isInCooldown: boolean;
  } {
    const totalBursts = this.successfulBursts + this.failedBursts;
    const successRate = totalBursts > 0 ? this.successfulBursts / totalBursts : 0;
    
    const avgBurstSize = this.burstHistory.length > 0 
      ? this.burstHistory.reduce((sum, burst) => sum + burst.requestCount, 0) / this.burstHistory.length
      : 0;
    
    const avgBurstDuration = this.burstHistory.length > 0
      ? this.burstHistory.reduce((sum, burst) => sum + burst.duration, 0) / this.burstHistory.length
      : 0;

    return {
      totalBursts,
      successfulBursts: this.successfulBursts,
      failedBursts: this.failedBursts,
      successRate,
      averageBurstSize: Math.round(avgBurstSize * 100) / 100,
      averageBurstDuration: Math.round(avgBurstDuration),
      isInBurstMode: this.isInBurstMode,
      isInCooldown: this.isInCooldownPeriod()
    };
  }

  /**
   * Calculate adaptive burst size based on historical performance
   */
  private calculateAdaptiveBurstSize(baseBurstSize: number, remainingCapacity: number): number {
    if (this.burstHistory.length < 3) {
      return baseBurstSize; // Not enough history for adaptation
    }

    const recentBursts = this.burstHistory.slice(-5); // Last 5 bursts
    const successRate = recentBursts.filter(b => b.successful).length / recentBursts.length;

    // Adjust burst size based on success rate
    if (successRate > 0.8) {
      // High success rate - can be more aggressive
      return Math.min(baseBurstSize * 1.2, remainingCapacity * 0.7);
    } else if (successRate < 0.5) {
      // Low success rate - be more conservative
      return Math.max(baseBurstSize * 0.7, 3);
    }

    return baseBurstSize;
  }

  /**
   * Check if currently in cooldown period
   */
  private isInCooldownPeriod(): boolean {
    return this.lastBurstEnd !== null && 
           Date.now() - this.lastBurstEnd < this.config.cooldownMs;
  }
}

export default BurstManager;
