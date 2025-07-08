/**
 * State Manager Module
 * Centralized state management for the dashboard
 */
class StateManager {
    constructor() {
        this.state = {
            // Core data
            event: null,
            pilots: {},
            races: [],
            rounds: [],
            results: [],
            
            // Enhanced data
            enhancedStandings: null,
            insights: {
                fastestLaps: [],
                holeShots: [],
                performanceGaps: [],
                personalBests: []
            },
            
            // UI state
            activeFilters: {
                eventType: 'all',
                roundFilter: 'all'
            },
            
            // Loading states
            isLoading: false,
            error: null,
            
            // Computed data
            stats: {},
            filteredRaces: []
        };

        this.listeners = [];
    }

    /**
     * Subscribe to state changes
     */
    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(listener => listener !== callback);
        };
    }

    /**
     * Notify all listeners of state changes
     */
    notify() {
        this.listeners.forEach(callback => callback(this.state));
    }

    /**
     * Update state and notify listeners
     */
    setState(updates) {
        this.state = { ...this.state, ...updates };
        this.notify();
    }

    /**
     * Set loading state
     */
    setLoading(isLoading, message = '') {
        this.setState({ 
            isLoading, 
            error: null,
            loadingMessage: message 
        });
    }

    /**
     * Set error state
     */
    setError(error) {
        this.setState({ 
            error, 
            isLoading: false 
        });
    }

    /**
     * Load data from server response
     */
    loadData(data) {
        console.log('StateManager.loadData called with:', data);
        
        const { event, eventData, enhancedStandings, insights } = data;
        
        // Process pilots
        const pilots = {};
        if (eventData.pilots) {
            eventData.pilots.forEach(pilot => {
                pilots[pilot.ID] = {
                    ...pilot,
                    stats: this.calculatePilotStats(pilot.ID, eventData.races)
                };
            });
        }

        // Process races - the server returns { id, race, result } format
        const races = (eventData.races || []).map(raceData => {
            const race = raceData.race || {};
            return {
                id: raceData.id,
                eventType: race.EventType,
                roundNumber: race.RoundNumber,
                raceNumber: race.RaceNumber,
                laps: race.Laps || [],
                result: raceData.result || [],
                race: race // Keep original race data for compatibility
            };
        });
        
        const results = [];
        races.forEach(race => {
            if (race.result) {
                results.push(...race.result);
            }
        });

        console.log('Processed data:', {
            pilotsCount: Object.keys(pilots).length,
            racesCount: races.length,
            resultsCount: results.length,
            insights
        });

        // Calculate stats
        const stats = this.calculateStats(pilots, races, results);

        this.setState({
            event,
            pilots,
            races,
            rounds: eventData.rounds || [],
            results,
            enhancedStandings,
            insights: insights || this.state.insights,
            stats,
            filteredRaces: this.getFilteredRaces(races, this.state.activeFilters),
            isLoading: false,
            error: null
        });
    }

    /**
     * Update filters
     */
    updateFilters(filters) {
        const newFilters = { ...this.state.activeFilters, ...filters };
        this.setState({
            activeFilters: newFilters,
            filteredRaces: this.getFilteredRaces(this.state.races, newFilters)
        });
    }

    /**
     * Get filtered races based on current filters
     */
    getFilteredRaces(races, filters) {
        return races.filter(race => {
            // Event type filter
            if (filters.eventType !== 'all' && race.eventType !== filters.eventType) {
                return false;
            }
            
            // Round filter
            if (filters.roundFilter !== 'all' && race.roundNumber !== parseInt(filters.roundFilter)) {
                return false;
            }
            
            return true;
        });
    }

    /**
     * Calculate pilot statistics
     */
    calculatePilotStats(pilotId, races) {
        const pilotRaces = races.filter(race => 
            race.result && race.result.some(r => r.Pilot === pilotId)
        );
        
        const pilotResults = pilotRaces.flatMap(race => race.result).filter(r => r.Pilot === pilotId);
        const pilotLaps = races.flatMap(race => 
            race.race?.Laps?.filter(lap => lap.Pilot === pilotId) || []
        );

        const lapTimes = pilotLaps
            .map(lap => lap.Length)
            .filter(time => time > 0 && time < 200);

        return {
            totalRaces: pilotRaces.length,
            totalLaps: pilotLaps.length,
            bestLapTime: lapTimes.length > 0 ? Math.min(...lapTimes) : null,
            avgLapTime: lapTimes.length > 0 ? lapTimes.reduce((a, b) => a + b, 0) / lapTimes.length : null,
            lapTimes,
            wins: pilotResults.filter(r => r.Position === 1).length,
            podiums: pilotResults.filter(r => r.Position <= 3).length,
            dnfs: pilotResults.filter(r => r.DNF).length,
            consistency: this.calculateConsistency(lapTimes)
        };
    }

    /**
     * Calculate consistency (standard deviation of lap times)
     */
    calculateConsistency(lapTimes) {
        if (lapTimes.length < 2) return null;
        
        const mean = lapTimes.reduce((a, b) => a + b, 0) / lapTimes.length;
        const variance = lapTimes.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / lapTimes.length;
        return Math.sqrt(variance);
    }

    /**
     * Calculate overall statistics
     */
    calculateStats(pilots, races, results) {
        const pilotCount = Object.keys(pilots).length;
        const raceCount = races.filter(r => r.eventType === 'Race').length;
        const ttCount = races.filter(r => r.eventType === 'TimeTrial').length;
        
        const allLaps = races.flatMap(race => 
            race.race?.Laps?.map(lap => lap.Length) || []
        ).filter(time => time > 0 && time < 200);

        const fastestTime = allLaps.length > 0 ? Math.min(...allLaps) : null;
        const fastestPilot = fastestTime ? 
            Object.values(pilots).find(p => p.stats.bestLapTime === fastestTime) : null;

        const raceResults = results.filter(r => r.ResultType === 'Race' || !r.ResultType);
        const dnfCount = raceResults.filter(r => r.DNF).length;
        const completionRate = raceResults.length > 0 ? 
            ((raceResults.length - dnfCount) / raceResults.length * 100).toFixed(1) : '0';

        const consistencies = Object.values(pilots)
            .map(p => p.stats.consistency)
            .filter(c => c !== null);
        const avgConsistency = consistencies.length > 0 ? 
            (consistencies.reduce((a, b) => a + b, 0) / consistencies.length).toFixed(1) : '-';

        return {
            totalPilots: pilotCount,
            totalRaces: races.length,
            raceBreakdown: `${raceCount} races, ${ttCount} time trials`,
            totalLaps: allLaps.length,
            avgLapsPerRace: races.length > 0 ? (allLaps.length / races.length).toFixed(1) : '0',
            fastestLap: fastestTime,
            fastestPilot: fastestPilot?.Name || null,
            completionRate,
            dnfRate: raceResults.length > 0 ? (dnfCount / raceResults.length * 100).toFixed(1) : '0',
            avgConsistency
        };
    }

    /**
     * Get standings data
     */
    getStandings() {
        if (this.state.enhancedStandings?.standings) {
            return this.state.enhancedStandings.standings;
        }
        
        // Fallback to calculated standings
        return Object.values(this.state.pilots)
            .map(pilot => ({
                position: 0, // Will be set after sorting
                pilot,
                points: pilot.stats.totalPoints || 0,
                races: pilot.stats.totalRaces,
                wins: pilot.stats.wins,
                podiums: pilot.stats.podiums,
                dnfs: pilot.stats.dnfs,
                bestLapTime: pilot.stats.bestLapTime,
                avgLapTime: pilot.stats.avgLapTime,
                consistency: pilot.stats.consistency
            }))
            .sort((a, b) => b.points - a.points)
            .map((standing, index) => ({ ...standing, position: index + 1 }));
    }

    /**
     * Get available rounds for filter
     */
    getAvailableRounds() {
        const rounds = [...new Set(this.state.races.map(r => r.roundNumber))];
        return rounds.sort((a, b) => a - b);
    }
}

// Export for use in other modules
window.StateManager = StateManager; 