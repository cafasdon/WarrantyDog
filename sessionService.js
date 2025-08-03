/**
 * WarrantyDog Session Service
 * Browser-side session management with SQLite backend integration
 */

class SessionService {
    constructor() {
        this.currentSessionId = null;
        this.baseUrl = window.location.origin;
    }

    /**
     * Generate a unique session ID
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Set current session ID
     */
    setCurrentSession(sessionId) {
        this.currentSessionId = sessionId;
        localStorage.setItem('current_session_id', sessionId);
    }

    /**
     * Get current session ID
     */
    getCurrentSession() {
        if (!this.currentSessionId) {
            this.currentSessionId = localStorage.getItem('current_session_id');
        }
        return this.currentSessionId;
    }

    /**
     * Clear current session
     */
    clearCurrentSession() {
        this.currentSessionId = null;
        localStorage.removeItem('current_session_id');
    }

    /**
     * Create a new session
     */
    async createSession(sessionData, duplicateOptions = {}) {
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
                    duplicateOptions: duplicateOptions
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to create session: ${response.statusText}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error creating session:', error);
            throw error;
        }
    }

    /**
     * Get session by ID
     */
    async getSession(sessionId) {
        try {
            const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(`Failed to get session: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting session:', error);
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
     * Get all sessions
     */
    async getAllSessions() {
        try {
            const response = await fetch(`${this.baseUrl}/api/sessions`);
            
            if (!response.ok) {
                throw new Error(`Failed to get sessions: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting sessions:', error);
            throw error;
        }
    }

    /**
     * Check for duplicate devices
     */
    async checkDuplicates(devices, maxAgeHours = 24) {
        try {
            const response = await fetch(`${this.baseUrl}/api/sessions/check-duplicates`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ devices, maxAgeHours })
            });

            if (!response.ok) {
                throw new Error(`Failed to check duplicates: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error checking duplicates:', error);
            throw error;
        }
    }

    /**
     * Migrate localStorage session data to database
     */
    async migrateLocalStorageSession() {
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
     * Get bulk warranty data for multiple devices
     */
    async getBulkWarrantyData(devices) {
        try {
            const response = await fetch(`${this.baseUrl}/api/warranty-data/bulk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ devices })
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
    async checkForExistingSessions() {
        try {
            const sessions = await this.getAllSessions();
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
}

// Create global instance
window.sessionService = new SessionService();
