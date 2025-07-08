/**
 * Data Loader Module
 * Handles all server API communication and data loading
 */
class DataLoader {
    constructor() {
        this.baseUrl = window.location.origin;
        this.apiEndpoints = {
            health: '/api/health',
            events: '/api/events',
            data: '/api/data',
            eventData: (eventId) => `/api/events/${eventId}`,
            standings: (eventId) => `/api/events/${eventId}/standings`,
            enhancedStandings: (eventId) => `/api/events/${eventId}/enhanced-standings`,
            fastestLaps: '/api/insights/fastest-lap-rankings',
            holeShots: '/api/insights/hole-shot-analysis',
            performanceGaps: '/api/insights/performance-gaps',
            personalBests: '/api/insights/personal-bests'
        };
    }

    /**
     * Check server health and data availability
     */
    async checkHealth() {
        try {
            const response = await fetch(this.apiEndpoints.health);
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Health check failed:', error);
            throw new Error('Unable to connect to server. Please ensure the server is running.');
        }
    }

    /**
     * Load all available events
     */
    async loadEvents() {
        try {
            const response = await fetch(this.apiEndpoints.events);
            if (!response.ok) {
                throw new Error(`Failed to load events: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Failed to load events:', error);
            throw new Error('Unable to load events from server.');
        }
    }

    /**
     * Load all data for a specific event
     */
    async loadEventData(eventId) {
        try {
            const response = await fetch(this.apiEndpoints.eventData(eventId));
            if (!response.ok) {
                throw new Error(`Failed to load event data: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Failed to load event data:', error);
            throw new Error(`Unable to load data for event: ${eventId}`);
        }
    }

    /**
     * Load enhanced standings with grade information
     */
    async loadEnhancedStandings(eventId) {
        try {
            const response = await fetch(this.apiEndpoints.enhancedStandings(eventId));
            if (!response.ok) {
                throw new Error(`Failed to load standings: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Failed to load enhanced standings:', error);
            throw new Error(`Unable to load standings for event: ${eventId}`);
        }
    }

    /**
     * Load performance insights
     */
    async loadPerformanceInsights() {
        try {
            console.log('Loading performance insights...');
            
            const [fastestLaps, holeShots, performanceGaps, personalBests] = await Promise.all([
                fetch(this.apiEndpoints.fastestLaps).then(r => r.ok ? r.json() : null),
                fetch(this.apiEndpoints.holeShots).then(r => r.ok ? r.json() : null),
                fetch(this.apiEndpoints.performanceGaps).then(r => r.ok ? r.json() : null),
                fetch(this.apiEndpoints.personalBests).then(r => r.ok ? r.json() : null)
            ]);

            console.log('Insights API responses:', {
                fastestLaps,
                holeShots,
                performanceGaps,
                personalBests
            });

            // Handle different data structures returned by server
            return {
                fastestLaps: Array.isArray(fastestLaps) ? fastestLaps : [],
                holeShots: holeShots && holeShots.rankings ? holeShots.rankings : [],
                performanceGaps: performanceGaps && performanceGaps.gaps ? performanceGaps.gaps : [],
                personalBests: Array.isArray(personalBests) ? personalBests : []
            };
        } catch (error) {
            console.error('Failed to load performance insights:', error);
            return {
                fastestLaps: [],
                holeShots: [],
                performanceGaps: [],
                personalBests: []
            };
        }
    }

    /**
     * Load all data (legacy endpoint for compatibility)
     */
    async loadAllData() {
        try {
            const response = await fetch(this.apiEndpoints.data);
            if (!response.ok) {
                throw new Error(`Failed to load all data: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Failed to load all data:', error);
            throw new Error('Unable to load data from server.');
        }
    }

    /**
     * Auto-detect and load the first available event
     */
    async autoLoadFirstEvent() {
        try {
            // First check server health
            const health = await this.checkHealth();
            if (!health.dataPathFound) {
                throw new Error('FPVTrackside data not found. Please ensure FPVTrackside is installed and has event data.');
            }

            // Load available events
            const events = await this.loadEvents();
            if (!events || events.length === 0) {
                throw new Error('No events found in FPVTrackside data.');
            }

            // Load the first event
            const firstEvent = events[0];
            const eventDataResponse = await this.loadEventData(firstEvent.id);
            const enhancedStandings = await this.loadEnhancedStandings(firstEvent.id);
            const insights = await this.loadPerformanceInsights();

            // The server returns { event, pilots, rounds, races }
            // We need to restructure it for the state manager
            const eventData = {
                event: eventDataResponse.event,
                pilots: eventDataResponse.pilots || [],
                rounds: eventDataResponse.rounds || [],
                races: eventDataResponse.races || []
            };

            return {
                event: firstEvent,
                eventData,
                enhancedStandings,
                insights,
                health
            };
        } catch (error) {
            console.error('Auto-load failed:', error);
            throw error;
        }
    }
}

// Export for use in other modules
window.DataLoader = DataLoader; 