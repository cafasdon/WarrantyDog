/**
 * WarrantyDog Session Service
 * Replaces localStorage with SQLite database backend for persistent session management
 */
class SessionService {
    constructor() {
        this.baseUrl = window.location.origin;
        this.currentSessionId = null;
    }

    /**
     * Create a new session
     */
    async createSession(sessionData) {
        try {
            const response = await fetch(`${this.baseUrl}/api/sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: sessionData.sessionId,
                    fileName: sessionData.fileName,
                    devices: sessionData.devices
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to create session: ${response.statusText}`);
            }

            const result = await response.json();
            this.currentSessionId = sessionData.sessionId;
            console.log('Session created successfully:', result);
            return result;
        } catch (error) {
            console.error('Error creating session:', error);
            throw error;
        }
    }

    /**
     * Get active sessions
     */
    async getActiveSessions() {
        try {
            const response = await fetch(`${this.baseUrl}/api/sessions`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch sessions: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching sessions:', error);
            throw error;
        }
    }

    /**
     * Get specific session data
     */
    async getSession(sessionId) {
        try {
            const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}`);
            
            if (response.status === 404) {
                return null;
            }
            
            if (!response.ok) {
                throw new Error(`Failed to fetch session: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching session:', error);
            throw error;
        }
    }

    /**
     * Update session progress
     */
    async updateSessionProgress(sessionId, progressData) {
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
    async completeSession(sessionId, status = 'completed') {
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
     * Get retryable devices for a session
     */
    async getRetryableDevices(sessionId) {
        try {
            const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/retryable`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch retryable devices: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching retryable devices:', error);
            throw error;
        }
    }

    /**
     * Check for existing sessions (replaces localStorage check)
     */
    async checkForExistingSessions() {
        try {
            const sessions = await this.getActiveSessions();
            return sessions.filter(session => 
                session.status === 'active' && 
                session.processed_count < session.total_devices
            );
        } catch (error) {
            console.error('Error checking for existing sessions:', error);
            return [];
        }
    }

    /**
     * Migrate localStorage session to database (backward compatibility)
     */
    async migrateLocalStorageSession() {
        try {
            const localStorageKey = 'warrantydog_session';
            const savedSession = localStorage.getItem(localStorageKey);
            
            if (!savedSession) {
                return null;
            }

            const sessionData = JSON.parse(savedSession);
            
            // Check if session is valid and not too old (24 hours)
            if (!this.isValidLocalStorageSession(sessionData)) {
                localStorage.removeItem(localStorageKey);
                return null;
            }

            // Create session in database
            await this.createSession({
                sessionId: sessionData.sessionId,
                fileName: sessionData.csvFileName || 'Migrated Session',
                devices: sessionData.devices || []
            });

            // Update progress if available
            if (sessionData.processedCount > 0) {
                await this.updateSessionProgress(sessionData.sessionId, {
                    processed: sessionData.processedCount,
                    successful: sessionData.successful || 0,
                    failed: sessionData.failed || 0,
                    skipped: sessionData.skipped || 0
                });
            }

            // Remove from localStorage after successful migration
            localStorage.removeItem(localStorageKey);
            
            console.log('Successfully migrated localStorage session to database');
            return sessionData.sessionId;
        } catch (error) {
            console.error('Error migrating localStorage session:', error);
            return null;
        }
    }

    /**
     * Validate localStorage session data
     */
    isValidLocalStorageSession(sessionData) {
        if (!sessionData || !sessionData.sessionId || !sessionData.devices) {
            return false;
        }

        // Check if session is not too old (24 hours)
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        const sessionAge = Date.now() - (sessionData.lastSaved || 0);
        
        return sessionAge < maxAge;
    }

    /**
     * Get database statistics
     */
    async getDatabaseStats() {
        try {
            const response = await fetch(`${this.baseUrl}/api/database/stats`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch database stats: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching database stats:', error);
            throw error;
        }
    }

    /**
     * Generate unique session ID
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    }

    /**
     * Set current session ID
     */
    setCurrentSession(sessionId) {
        this.currentSessionId = sessionId;
    }

    /**
     * Get current session ID
     */
    getCurrentSession() {
        return this.currentSessionId;
    }

    /**
     * Clear current session
     */
    clearCurrentSession() {
        this.currentSessionId = null;
    }
}

// Create global instance
window.sessionService = new SessionService();
