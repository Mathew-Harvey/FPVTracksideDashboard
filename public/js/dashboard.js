/**
 * Main Dashboard Module
 * Orchestrates all components and handles user interactions
 */
class Dashboard {
    constructor() {
        this.dataLoader = new DataLoader();
        this.stateManager = new StateManager();
        this.chart = null;
        
        this.init();
    }

    /**
     * Initialize the dashboard
     */
    async init() {
        try {
            // Set up event listeners
            this.setupEventListeners();
            
            // Subscribe to state changes
            this.stateManager.subscribe(this.handleStateChange.bind(this));
            
            // Start loading data
            await this.loadData();
            
        } catch (error) {
            console.error('Dashboard initialization failed:', error);
            UIComponents.showError('Failed to initialize dashboard: ' + error.message);
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Filter buttons
        document.querySelectorAll('.filter-button[data-filter]').forEach(button => {
            button.addEventListener('click', (e) => {
                this.updateEventTypeFilter(e.target.dataset.filter);
            });
        });

        // Round selector
        document.getElementById('roundSelector').addEventListener('change', (e) => {
            this.updateRoundFilter(e.target.value);
        });

        // Retry button
        document.getElementById('retryButton').addEventListener('click', () => {
            this.loadData();
        });
    }

    /**
     * Load data from server
     */
    async loadData() {
        try {
            UIComponents.showLoading(true, 'Connecting to server...');
            
            const data = await this.dataLoader.autoLoadFirstEvent();
            
            this.stateManager.loadData(data);
            
            UIComponents.showLoading(false);
            UIComponents.showDashboard();
            
        } catch (error) {
            console.error('Data loading failed:', error);
            this.stateManager.setError(error.message);
            UIComponents.showError(error.message);
        }
    }

    /**
     * Handle state changes
     */
    handleStateChange(state) {
        // Update UI based on state
        if (state.event) {
            UIComponents.updateEventInfo(state.event);
        }
        
        if (state.stats) {
            UIComponents.renderStats(state.stats);
        }
        
        if (state.error) {
            UIComponents.showError(state.error);
        }
        
        // Update round selector
        const availableRounds = this.stateManager.getAvailableRounds();
        UIComponents.populateRoundSelector(availableRounds);
        
        // Render current tab content
        this.renderCurrentTab();
    }

    /**
     * Switch between tabs
     */
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');
        
        // Render tab content
        this.renderTabContent(tabName);
    }

    /**
     * Render content for specific tab
     */
    renderTabContent(tabName) {
        const state = this.stateManager.state;
        console.log(`Rendering tab: ${tabName}`, state);
        
        switch (tabName) {
            case 'standings':
                const standings = this.stateManager.getStandings();
                console.log('Standings data:', standings);
                UIComponents.renderStandingsTable(standings);
                break;
                
            case 'insights':
                this.renderInsights();
                break;
                
            case 'pilots':
                console.log('Pilots data:', state.pilots);
                UIComponents.renderPilotCards(state.pilots);
                break;
                
            case 'rounds':
                console.log('Filtered races:', state.filteredRaces);
                UIComponents.renderRoundResults(state.filteredRaces);
                break;
        }
    }

    /**
     * Render insights tab content
     */
    renderInsights() {
        const { insights } = this.stateManager.state;
        
        console.log('Rendering insights with data:', insights);
        
        if (insights.fastestLaps && Array.isArray(insights.fastestLaps)) {
            UIComponents.renderFastestLapTable(insights.fastestLaps);
        } else {
            console.warn('No fastest laps data available');
            document.querySelector('#fastestLapTable tbody').innerHTML = '<tr><td colspan="5">No fastest lap data available</td></tr>';
        }
        
        if (insights.holeShots && Array.isArray(insights.holeShots)) {
            UIComponents.renderHoleShotTable(insights.holeShots);
        } else {
            console.warn('No hole shots data available');
            document.querySelector('#holeShotTable tbody').innerHTML = '<tr><td colspan="5">No hole shot data available</td></tr>';
        }
        
        if (insights.performanceGaps && Array.isArray(insights.performanceGaps)) {
            UIComponents.renderPerformanceGapsTable(insights.performanceGaps);
        } else {
            console.warn('No performance gaps data available');
            document.querySelector('#performanceGapsTable tbody').innerHTML = '<tr><td colspan="5">No performance gap data available</td></tr>';
        }
    }

    /**
     * Update event type filter
     */
    updateEventTypeFilter(eventType) {
        // Update button states
        document.querySelectorAll('.filter-button[data-filter]').forEach(button => {
            button.classList.remove('active');
        });
        document.querySelector(`[data-filter="${eventType}"]`).classList.add('active');
        
        // Update state
        this.stateManager.updateFilters({ eventType });
    }

    /**
     * Update round filter
     */
    updateRoundFilter(round) {
        this.stateManager.updateFilters({ roundFilter: round });
    }

    /**
     * Render current tab content
     */
    renderCurrentTab() {
        const activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            this.renderTabContent(activeTab.dataset.tab);
        }
    }

    /**
     * Initialize performance chart
     */
    initPerformanceChart() {
        const ctx = document.getElementById('performanceChart');
        if (!ctx) return;
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#f8fafc'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#cbd5e1'
                        },
                        grid: {
                            color: '#334155'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#cbd5e1'
                        },
                        grid: {
                            color: '#334155'
                        }
                    }
                }
            }
        });
    }

    /**
     * Update performance chart
     */
    updatePerformanceChart() {
        if (!this.chart) {
            this.initPerformanceChart();
        }
        
        const state = this.stateManager.state;
        const pilots = Object.values(state.pilots).slice(0, 10); // Top 10 pilots
        
        const datasets = pilots.map(pilot => ({
            label: pilot.Name,
            data: pilot.stats.lapTimes || [],
            borderColor: this.getPilotColor(pilot.ID),
            backgroundColor: this.getPilotColor(pilot.ID, 0.1),
            tension: 0.1
        }));
        
        this.chart.data.labels = Array.from({ length: Math.max(...datasets.map(d => d.data.length)) }, (_, i) => `Lap ${i + 1}`);
        this.chart.data.datasets = datasets;
        this.chart.update();
    }

    /**
     * Get color for pilot
     */
    getPilotColor(pilotId, alpha = 1) {
        const colors = [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
            '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43'
        ];
        
        const index = pilotId.charCodeAt(0) % colors.length;
        const color = colors[index];
        
        if (alpha < 1) {
            return color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        }
        
        return color;
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});