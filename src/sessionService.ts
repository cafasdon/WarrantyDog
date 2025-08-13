/*
 * Copyright 2025 Rodrigo Quintian (cafasdon)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * WarrantyDog Session Service
 * Browser-side session management with SQLite backend integration
 */

import type {
  DeviceData,
  SessionData,
  ProcessingProgress,
  DuplicateHandlingOptions
} from './types/frontend';

interface SessionCreateRequest {
  sessionId: string;
  fileName: string;
  devices: DeviceData[];
}

interface SessionResponse {
  sessionId: string;
  message: string;
  duplicateHandling?: any;
}

interface DuplicateCheckRequest {
  devices: DeviceData[];
  maxAgeHours?: number;
}

interface DuplicateCheckResponse {
  duplicates: any[];
  fresh: DeviceData[];
}

interface BulkWarrantyRequest {
  devices: DeviceData[];
}

interface DatabaseStats {
  sessions: Record<string, number>;
  devices: Record<string, number>;
  totalAttempts: number;
}

/**
 * Session Service Class
 */
class SessionService {
  public currentSessionId: string | null = null;
  private baseUrl: string;

  constructor() {
    this.baseUrl = window.location.origin;
  }

  /**
   * Generate a unique session ID
   */
  generateSessionId(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Set current session ID
   */
  setCurrentSession(sessionId: string): void {
    this.currentSessionId = sessionId;
    localStorage.setItem('current_session_id', sessionId);
  }

  /**
   * Get current session ID
   */
  getCurrentSession(): string | null {
    if (!this.currentSessionId) {
      this.currentSessionId = localStorage.getItem('current_session_id');
    }
    return this.currentSessionId;
  }

  /**
   * Clear current session
   */
  clearCurrentSession(): void {
    this.currentSessionId = null;
    localStorage.removeItem('current_session_id');
  }

  /**
   * Create a new session
   */
  async createSession(sessionData: SessionCreateRequest, duplicateOptions: DuplicateHandlingOptions = {}): Promise<SessionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: sessionData.sessionId,
          fileName: sessionData.fileName,
          devices: sessionData.devices,
          options: duplicateOptions
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`);
      }

      const result = await response.json() as SessionResponse;
      return result;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to get session: ${response.statusText}`);
      }

      return await response.json() as SessionData;
    } catch (error) {
      console.error('Error getting session:', error);
      throw error;
    }
  }

  /**
   * Update session progress
   */
  async updateSessionProgress(sessionId: string, progressData: Partial<ProcessingProgress>): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/progress`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(progressData)
      });

      if (!response.ok) {
        throw new Error(`Failed to update session progress: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating session progress:', error);
      throw error;
    }
  }

  /**
   * Complete session
   */
  async completeSession(sessionId: string, status: string = 'completed'): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/complete`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error(`Failed to complete session: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error completing session:', error);
      throw error;
    }
  }

  /**
   * Get all sessions
   */
  async getAllSessions(): Promise<SessionData[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions`);
      
      if (!response.ok) {
        throw new Error(`Failed to get sessions: ${response.statusText}`);
      }

      return await response.json() as SessionData[];
    } catch (error) {
      console.error('Error getting sessions:', error);
      throw error;
    }
  }

  /**
   * Check for duplicate devices
   */
  async checkDuplicates(devices: DeviceData[], maxAgeHours: number = 24): Promise<DuplicateCheckResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/check-duplicates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ devices, maxAgeHours } as DuplicateCheckRequest)
      });

      if (!response.ok) {
        throw new Error(`Failed to check duplicates: ${response.statusText}`);
      }

      return await response.json() as DuplicateCheckResponse;
    } catch (error) {
      console.error('Error checking duplicates:', error);
      throw error;
    }
  }

  /**
   * Migrate localStorage session data to database
   */
  async migrateLocalStorageSession(): Promise<void> {
    try {
      // Check for old localStorage session data
      const oldSessionData = localStorage.getItem('warrantydog_session');
      if (oldSessionData) {
        console.log('Found old localStorage session data, migrating...');
        
        // Parse and migrate the data
        const sessionData = JSON.parse(oldSessionData);
        
        // Create new session in database
        if (sessionData.csvData && sessionData.csvData.length > 0) {
          const newSessionId = this.generateSessionId();
          await this.createSession({
            sessionId: newSessionId,
            fileName: sessionData.fileName || 'Migrated Session',
            devices: sessionData.csvData
          });
          
          this.setCurrentSession(newSessionId);
          console.log('Session migrated successfully');
        }
        
        // Remove old localStorage data
        localStorage.removeItem('warrantydog_session');
      }
    } catch (error) {
      console.error('Error migrating localStorage session:', error);
    }
  }

  /**
   * Validate localStorage session data
   */
  isValidLocalStorageSession(sessionData: any): boolean {
    if (!sessionData || !sessionData.sessionId || !sessionData.devices) {
      return false;
    }

    // Check if session is not too old (24 hours)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const sessionAge = Date.now() - (sessionData.lastSaved || 0);

    return sessionAge < maxAge;
  }

  /**
   * Get bulk warranty data for multiple devices
   */
  async getBulkWarrantyData(devices: DeviceData[]): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/warranty-data/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ devices } as BulkWarrantyRequest)
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch bulk warranty data: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching bulk warranty data:', error);
      throw error;
    }
  }

  /**
   * Check for existing sessions (replaces localStorage check)
   */
  async checkForExistingSessions(): Promise<SessionData[]> {
    try {
      const sessions = await this.getAllSessions();
      return sessions.filter(session =>
        session.status === 'active' &&
        (session.progress?.processed || 0) < (session.progress?.total || 0)
      );
    } catch (error) {
      console.error('Error checking for existing sessions:', error);
      return [];
    }
  }

  /**
   * Get retryable devices for a session
   */
  async getRetryableDevices(sessionId: string): Promise<DeviceData[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/retryable`);

      if (!response.ok) {
        throw new Error(`Failed to fetch retryable devices: ${response.statusText}`);
      }

      return await response.json() as DeviceData[];
    } catch (error) {
      console.error('Error fetching retryable devices:', error);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<DatabaseStats> {
    try {
      const response = await fetch(`${this.baseUrl}/api/database/stats`);

      if (!response.ok) {
        throw new Error(`Failed to fetch database stats: ${response.statusText}`);
      }

      return await response.json() as DatabaseStats;
    } catch (error) {
      console.error('Error fetching database stats:', error);
      throw error;
    }
  }

  /**
   * Get session devices
   */
  async getSessionDevices(sessionId: string): Promise<DeviceData[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/devices`);

      if (!response.ok) {
        throw new Error(`Failed to fetch session devices: ${response.statusText}`);
      }

      return await response.json() as DeviceData[];
    } catch (error) {
      console.error('Error fetching session devices:', error);
      throw error;
    }
  }

  /**
   * Update device warranty data
   */
  async updateDeviceWarrantyData(sessionId: string, deviceId: number, warrantyData: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/devices/${deviceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ warrantyData })
      });

      if (!response.ok) {
        throw new Error(`Failed to update device warranty data: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating device warranty data:', error);
      throw error;
    }
  }

  /**
   * Store warranty data in cache
   */
  async storeWarrantyData(warrantyData: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/warranty-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(warrantyData)
      });

      if (!response.ok) {
        throw new Error(`Failed to store warranty data: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error storing warranty data:', error);
      throw error;
    }
  }

  /**
   * Get cached warranty data
   */
  async getCachedWarrantyData(vendor: string, serviceTag: string, maxAge: number = 24): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/warranty-cache/${vendor}/${serviceTag}?maxAge=${maxAge}`);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to get cached warranty data: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting cached warranty data:', error);
      throw error;
    }
  }

  /**
   * Health check for session service
   */
  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error performing health check:', error);
      return {
        status: 'error',
        message: `Health check failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Get API metrics
   */
  async getMetrics(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/metrics`);

      if (!response.ok) {
        throw new Error(`Failed to get metrics: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting metrics:', error);
      throw error;
    }
  }
}

// Create global instance
const sessionService = new SessionService();

// Attach to window for global access
declare global {
  interface Window {
    sessionService: any;
  }
}

if (typeof window !== 'undefined') {
  window.sessionService = sessionService;
}

export default SessionService;
export { sessionService };
