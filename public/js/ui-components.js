/**
 * UI Components Module
 * Reusable UI components for rendering dashboard elements
 */
class UIComponents {
    /**
     * Format lap time for display
     */
    static formatLapTime(time) {
        if (!time || time <= 0) return '-';
        return time.toFixed(3);
    }

    /**
     * Format position with medal emoji
     */
    static formatPosition(position) {
        if (position === 1) return '🥇';
        if (position === 2) return '🥈';
        if (position === 3) return '🥉';
        return position;
    }

    /**
     * Get position CSS class
     */
    static getPositionClass(position) {
        if (position === 1) return 'position-1';
        if (position === 2) return 'position-2';
        if (position === 3) return 'position-3';
        return '';
    }

    /**
     * Render statistics cards
     */
    static renderStats(stats) {
        document.getElementById('totalPilots').textContent = stats.totalPilots || 0;
        document.getElementById('totalRaces').textContent = stats.totalRaces || 0;
        document.getElementById('totalLaps').textContent = stats.totalLaps || 0;
        document.getElementById('fastestLap').textContent = stats.fastestLap ? this.formatLapTime(stats.fastestLap) : '-';
        document.getElementById('completionRate').textContent = stats.completionRate ? `${stats.completionRate}%` : '-';
        document.getElementById('avgConsistency').textContent = stats.avgConsistency || '-';
        
        document.getElementById('pilotsRegistered').textContent = stats.totalPilots ? `${stats.totalPilots} registered` : '';
        document.getElementById('raceBreakdown').textContent = stats.raceBreakdown || '';
        document.getElementById('avgLapsPerRace').textContent = stats.avgLapsPerRace ? `${stats.avgLapsPerRace} avg` : '';
        document.getElementById('fastestPilot').textContent = stats.fastestPilot || '';
        document.getElementById('dnfRate').textContent = stats.dnfRate ? `${stats.dnfRate}%` : '-';
    }

    /**
     * Render standings table
     */
    static renderStandingsTable(standings) {
        const tbody = document.querySelector('#standingsTable tbody');
        tbody.innerHTML = '';

        if (!Array.isArray(standings)) {
            console.warn('Standings is not an array:', standings);
            return;
        }

        standings.forEach(standing => {
            const row = document.createElement('tr');
            row.className = this.getPositionClass(standing.position);
            
            // Calculate stats from race results
            const raceResults = standing.raceResults || [];
            const wins = raceResults.filter(r => r.position === 1).length;
            const podiums = raceResults.filter(r => r.position <= 3).length;
            const dnfs = raceResults.filter(r => r.dnf).length;
            
            row.innerHTML = `
                <td>${this.formatPosition(standing.position)}</td>
                <td>${standing.pilot?.Name || 'Unknown'}</td>
                <td class="points">${standing.correctedPoints || 0}</td>
                <td>${raceResults.length || 0}</td>
                <td>${wins}</td>
                <td>${podiums}</td>
                <td class="dnf">${dnfs}</td>
                <td class="best-lap">${this.formatLapTime(standing.bestLapTime)}</td>
                <td class="lap-time">${this.formatLapTime(standing.avgLapTime)}</td>
                <td>${standing.consistency ? standing.consistency.toFixed(1) : '-'}</td>
            `;
            
            tbody.appendChild(row);
        });
    }

    /**
     * Render fastest lap rankings table
     */
    static renderFastestLapTable(rankings) {
        const tbody = document.querySelector('#fastestLapTable tbody');
        tbody.innerHTML = '';

        if (!Array.isArray(rankings)) {
            console.warn('Fastest lap rankings is not an array:', rankings);
            return;
        }

        rankings.forEach((ranking, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${ranking.pilot || ranking.pilotName || 'Unknown'}</td>
                <td class="best-lap">${this.formatLapTime(ranking.fastestLapTime)}</td>
                <td>${ranking.round || '-'}</td>
                <td>${ranking.group || '-'}</td>
            `;
            tbody.appendChild(row);
        });
    }

    /**
     * Render hole shot analysis table
     */
    static renderHoleShotTable(holeShots) {
        const tbody = document.querySelector('#holeShotTable tbody');
        tbody.innerHTML = '';

        if (!Array.isArray(holeShots)) {
            console.warn('Hole shots data is not an array:', holeShots);
            return;
        }

        holeShots.forEach((holeShot, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${holeShot.pilot || holeShot.pilotName || 'Unknown'}</td>
                <td class="best-lap">${this.formatLapTime(holeShot.bestHoleShot)}</td>
                <td>${holeShot.round || '-'}</td>
                <td class="lap-time">${this.formatLapTime(holeShot.avgHoleShot)}</td>
            `;
            tbody.appendChild(row);
        });
    }

    /**
     * Render performance gaps table
     */
    static renderPerformanceGapsTable(gaps) {
        const tbody = document.querySelector('#performanceGapsTable tbody');
        tbody.innerHTML = '';

        if (!Array.isArray(gaps)) {
            console.warn('Performance gaps data is not an array:', gaps);
            return;
        }

        gaps.forEach((gap, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${gap.pilot || gap.pilotName || 'Unknown'}</td>
                <td class="best-lap">${this.formatLapTime(gap.fastestLapTime)}</td>
                <td>${this.formatLapTime(gap.gapToLeader)}</td>
                <td>${gap.gapPercentage ? gap.gapPercentage.toFixed(1) + '%' : '-'}</td>
            `;
            tbody.appendChild(row);
        });
    }

    /**
     * Render pilot cards
     */
    static renderPilotCards(pilots) {
        const container = document.getElementById('pilotCards');
        container.innerHTML = '';

        Object.values(pilots).forEach(pilot => {
            const card = document.createElement('div');
            card.className = 'pilot-card';
            
            const recentForm = this.getRecentForm(pilot);
            const consistency = pilot.stats.consistency ? pilot.stats.consistency.toFixed(1) : '-';
            
            card.innerHTML = `
                <div class="pilot-header">
                    <h3>${pilot.Name}</h3>
                    <div class="pilot-stats-summary">
                        <span class="stat">${pilot.stats.totalRaces} races</span>
                        <span class="stat">${pilot.stats.wins} wins</span>
                        <span class="stat">${pilot.stats.podiums} podiums</span>
                    </div>
                </div>
                <div class="pilot-details">
                    <div class="detail-row">
                        <span class="label">Best Lap:</span>
                        <span class="value best-lap">${this.formatLapTime(pilot.stats.bestLapTime)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Avg Lap:</span>
                        <span class="value lap-time">${this.formatLapTime(pilot.stats.avgLapTime)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Consistency:</span>
                        <span class="value">${consistency}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">DNFs:</span>
                        <span class="value dnf">${pilot.stats.dnfs}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Recent Form:</span>
                        <span class="value">${recentForm}</span>
                    </div>
                </div>
            `;
            
            container.appendChild(card);
        });
    }

    /**
     * Get recent form indicator
     */
    static getRecentForm(pilot) {
        if (!pilot.stats.lapTimes || pilot.stats.lapTimes.length < 3) return 'Insufficient data';
        
        const recentLaps = pilot.stats.lapTimes.slice(-3);
        const avgRecent = recentLaps.reduce((a, b) => a + b, 0) / recentLaps.length;
        const avgOverall = pilot.stats.avgLapTime;
        
        if (avgRecent < avgOverall * 0.98) return '🔥 Improving';
        if (avgRecent > avgOverall * 1.02) return '📉 Declining';
        return '➡️ Stable';
    }

    /**
     * Render round results
     */
    static renderRoundResults(races) {
        const container = document.getElementById('roundResults');
        container.innerHTML = '';

        // Group races by round
        const racesByRound = {};
        races.forEach(race => {
            const round = race.roundNumber || 'Unknown';
            if (!racesByRound[round]) {
                racesByRound[round] = [];
            }
            racesByRound[round].push(race);
        });

        // Render each round
        Object.keys(racesByRound).sort().forEach(round => {
            const roundRaces = racesByRound[round];
            const roundDiv = document.createElement('div');
            roundDiv.className = 'round-section';
            
            roundDiv.innerHTML = `
                <h3>Round ${round}</h3>
                <div class="round-races">
                    ${roundRaces.map(race => this.renderRaceCard(race)).join('')}
                </div>
            `;
            
            container.appendChild(roundDiv);
        });
    }

    /**
     * Render individual race card
     */
    static renderRaceCard(race) {
        if (!race.result) return '';
        
        const raceType = race.eventType || 'Unknown';
        const results = race.result.sort((a, b) => a.Position - b.Position);
        
        return `
            <div class="race-card">
                <div class="race-header">
                    <h4>${raceType} ${race.raceNumber || ''}</h4>
                    <span class="race-info">${results.length} pilots</span>
                </div>
                <div class="race-results">
                    ${results.slice(0, 5).map(result => `
                        <div class="result-row ${this.getPositionClass(result.Position)}">
                            <span class="position">${this.formatPosition(result.Position)}</span>
                            <span class="pilot">${result.Pilot}</span>
                            <span class="points">${result.Points || 0}</span>
                            ${result.DNF ? '<span class="dnf-badge">DNF</span>' : ''}
                        </div>
                    `).join('')}
                    ${results.length > 5 ? `<div class="more-results">+${results.length - 5} more</div>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Show/hide loading state
     */
    static showLoading(show, message = 'Loading...') {
        const loadingSection = document.getElementById('dataLoading');
        const dashboard = document.getElementById('dashboard');
        const errorSection = document.getElementById('errorSection');
        
        if (show) {
            loadingSection.classList.remove('hidden');
            dashboard.classList.add('hidden');
            errorSection.classList.add('hidden');
            document.getElementById('loadingMessage').textContent = message;
        } else {
            loadingSection.classList.add('hidden');
        }
    }

    /**
     * Show error state
     */
    static showError(message) {
        const errorSection = document.getElementById('errorSection');
        const loadingSection = document.getElementById('dataLoading');
        const dashboard = document.getElementById('dashboard');
        
        errorSection.classList.remove('hidden');
        loadingSection.classList.add('hidden');
        dashboard.classList.add('hidden');
        
        document.getElementById('errorMessage').textContent = message;
    }

    /**
     * Show dashboard content
     */
    static showDashboard() {
        const dashboard = document.getElementById('dashboard');
        const loadingSection = document.getElementById('dataLoading');
        const errorSection = document.getElementById('errorSection');
        
        dashboard.classList.remove('hidden');
        loadingSection.classList.add('hidden');
        errorSection.classList.add('hidden');
    }

    /**
     * Update event info
     */
    static updateEventInfo(event) {
        if (event) {
            document.getElementById('eventInfo').textContent = event.name;
        }
    }

    /**
     * Populate round selector
     */
    static populateRoundSelector(rounds) {
        const selector = document.getElementById('roundSelector');
        selector.innerHTML = '<option value="all">All Rounds</option>';
        
        rounds.forEach(round => {
            const option = document.createElement('option');
            option.value = round;
            option.textContent = `Round ${round}`;
            selector.appendChild(option);
        });
    }
}

// Export for use in other modules
window.UIComponents = UIComponents; 