const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { existsSync } = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Serve static files from the public directory
app.use(express.static('public'));

// Function to find FPVTrackside data directory
let cachedDataPath = null;
function getFPVTracksideDataPath() {
    if (cachedDataPath !== null) {
        return cachedDataPath;
    }
    
    const possiblePaths = [
        path.join(process.cwd(), 'Users', 'WCMRC', 'AppData', 'Local', 'FPVTrackside', 'events'),
        path.join(process.env.USERPROFILE || process.env.HOME, 'AppData', 'Local', 'FPVTrackside', 'events'),
        path.join('C:', 'Users', process.env.USERNAME, 'AppData', 'Local', 'FPVTrackside', 'events'),
    ];

    for (const dataPath of possiblePaths) {
        if (existsSync(dataPath)) {
            cachedDataPath = dataPath;
            return dataPath;
        }
    }
    
    cachedDataPath = false; // Cache that we didn't find it
    return null;
}

// Function to safely read JSON file
async function readJSONFile(filePath, silent = false) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Only log errors for important files, not missing Result.json files
        if (!silent && !filePath.includes('Result.json')) {
            console.error(`Error reading ${filePath}:`, error.message);
        }
        return null;
    }
}

// Recursively find all JSON files in a directory
async function findJsonFiles(dirPath, maxDepth = 10) {
    const jsonFiles = [];
    
    async function scanDirectory(currentPath, depth = 0) {
        if (depth > maxDepth) return;
        
        try {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                
                if (entry.isDirectory()) {
                    await scanDirectory(fullPath, depth + 1);
                } else if (entry.isFile() && entry.name.endsWith('.json')) {
                    jsonFiles.push(fullPath);
                }
            }
        } catch (error) {
            // Silently skip directories we can't read
        }
    }
    
    await scanDirectory(dirPath);
    return jsonFiles;
}

// Identify the type of a JSON file based on its content
function identifyJsonFileType(data, filePath) {
    if (!data) return 'unknown';
    
    // Use filename as a hint
    const fileName = path.basename(filePath).toLowerCase();
    
    // Check filename patterns first for accuracy
    if (fileName === 'event.json') return 'event';
    if (fileName === 'pilots.json') return 'pilots'; 
    if (fileName === 'rounds.json') return 'rounds';
    if (fileName === 'race.json') return 'race';
    if (fileName === 'result.json') return 'result';
    
    // Check if it's an array
    if (Array.isArray(data)) {
        if (data.length === 0) return 'empty';
        const first = data[0];
        
        // Event data - has Name, EventType, Start
        if (first.Name && first.EventType && first.Start) {
            return 'event';
        }
        
        // Pilots data - has ID, Name, and pilot-specific properties like Phonetic, PhotoPath
        if (first.ID && first.Name && (first.Phonetic !== undefined || first.PhotoPath !== undefined || first.TimingSensitivityPercent !== undefined)) {
            return 'pilots';
        }
        
        // Rounds data - has RoundNumber and EventType
        if (first.RoundNumber !== undefined && first.EventType) {
            return 'rounds';
        }
        
        // Race data - has Laps array or RoundNumber with race-specific properties
        if (first.Laps || (first.RoundNumber !== undefined && (first.StartTime !== undefined || first.EndTime !== undefined))) {
            return 'race';
        }
        
        // Result data - has Position and Pilot
        if (first.Position !== undefined && first.Pilot) {
            return 'result';
        }
        
        // Alternative pilot detection - just ID and Name without specific race properties
        if (first.ID && first.Name && !first.RoundNumber && !first.Position && !first.Laps) {
            return 'pilots';
        }
    } else {
        // Single object
        // Event data (sometimes stored as single object)
        if (data.Name && data.EventType && data.Start) {
            return 'event';
        }
        
        // Race data (sometimes stored as single object)
        if (data.Laps || (data.RoundNumber !== undefined && (data.StartTime !== undefined || data.EndTime !== undefined))) {
            return 'race';
        }
        
        // Result data (sometimes stored as single object)
        if (data.Position !== undefined && data.Pilot) {
            return 'result';
        }
    }
    
    return 'unknown';
}

// Load data from a single JSON file and classify it
async function loadAndClassifyJsonFile(filePath) {
    const data = await readJSONFile(filePath, true);
    if (!data) return null;
    
    const type = identifyJsonFileType(data, filePath);
    const fileName = path.basename(filePath);
    
    // Debug logging for classification issues
    if (type === 'unknown' && fileName.toLowerCase().includes('.json')) {
        console.log(`⚠️  Unknown file type: ${fileName} - first few properties:`, 
            Array.isArray(data) && data.length > 0 ? Object.keys(data[0]).slice(0, 5) : 'N/A');
    }
    
    return {
        filePath,
        type,
        data: Array.isArray(data) ? data : [data], // Normalize to array
        fileName: fileName,
        directory: path.dirname(filePath)
    };
}

// Performance Insights Calculation Functions

// Calculate Excel-style fastest lap rankings
async function calculateFastestLapRankings(dataPath, groupSize = 4) {
    const allData = await loadAllEventData(dataPath);
    const timeTrialData = [];
    
    // Extract time trial data with lap times - ONLY from qualifying rounds (1-4)
    for (const race of allData.races) {
        if (race.race && race.race.EventType === 'TimeTrial' && race.roundNumber <= 4) {
            const raceData = race.race;
            
            // Get lap times for each pilot
            if (raceData.Laps) {
                const pilotLaps = {};
                raceData.Laps.forEach(lap => {
                    if (!pilotLaps[lap.Pilot]) {
                        pilotLaps[lap.Pilot] = [];
                    }
                    if (lap.Length > 0 && lap.Length < 200) { // Valid lap time
                        pilotLaps[lap.Pilot].push({
                            time: lap.Length,
                            raceTime: lap.RaceTime || 0
                        });
                    }
                });
                
                // Calculate consecutive lap times and hole shots
                Object.entries(pilotLaps).forEach(([pilotId, laps]) => {
                    const pilot = allData.pilots.find(p => p.ID === pilotId);
                    if (!pilot || laps.length === 0) return;
                    
                    const fastestLapTime = Math.min(...laps.map(l => l.time));
                    const fastestLapIndex = laps.findIndex(l => l.time === fastestLapTime);
                    
                    // Calculate consecutive lap times (sum of 3 consecutive laps)
                    let bestConsecutive = null;
                    for (let i = 0; i <= laps.length - 3; i++) {
                        const consecutiveTime = laps.slice(i, i + 3).reduce((sum, lap) => sum + lap.time, 0);
                        if (!bestConsecutive || consecutiveTime < bestConsecutive) {
                            bestConsecutive = consecutiveTime;
                        }
                    }
                    
                    // Calculate hole shot (RaceTime - Consecutive Lap Times)
                    let fastestHoleShot = null;
                    let holeShotRound = '';
                    
                    if (bestConsecutive && laps.length >= 3) {
                        // Find the race time at the end of the best consecutive sequence
                        for (let i = 0; i <= laps.length - 3; i++) {
                            const consecutiveTime = laps.slice(i, i + 3).reduce((sum, lap) => sum + lap.time, 0);
                            if (consecutiveTime === bestConsecutive) {
                                const endRaceTime = laps[i + 2].raceTime;
                                const holeShot = endRaceTime - consecutiveTime;
                                if (holeShot > 0 && (!fastestHoleShot || holeShot < fastestHoleShot)) {
                                    fastestHoleShot = holeShot;
                                    holeShotRound = `R${raceData.RoundNumber || race.roundNumber}`;
                                }
                                break;
                            }
                        }
                    }
                    
                    timeTrialData.push({
                        pilotId: pilotId,
                        pilotName: pilot.Name,
                        fastestLapTime: fastestLapTime,
                        round: `R${raceData.RoundNumber || race.roundNumber}`,
                        fastestHoleShot: fastestHoleShot,
                        holeShotRound: holeShotRound,
                        consecutiveLapTimes: bestConsecutive
                    });
                });
            }
        }
    }
    
    // Get unique pilots and their best times
    const pilotBests = {};
    timeTrialData.forEach(entry => {
        if (!pilotBests[entry.pilotId] || entry.fastestLapTime < pilotBests[entry.pilotId].fastestLapTime) {
            pilotBests[entry.pilotId] = entry;
        }
    });
    
    // Sort by fastest lap time (Excel style)
    const sortedPilots = Object.values(pilotBests)
        .filter(pilot => pilot.fastestLapTime > 0)
        .sort((a, b) => a.fastestLapTime - b.fastestLapTime);
    
    // Add position and group
    const rankings = sortedPilots.map((pilot, index) => ({
        position: index + 1,
        group: Math.ceil((index + 1) / groupSize),
        pilot: pilot.pilotName,
        fastestLapTime: parseFloat(pilot.fastestLapTime.toFixed(2)),
        round: pilot.round,
        holeShot: pilot.fastestHoleShot ? parseFloat(pilot.fastestHoleShot.toFixed(2)) : '',
        holeShotRound: pilot.holeShotRound || ''
    }));
    
    return rankings;
}

// Calculate hole shot analysis
async function calculateHoleShotAnalysis(dataPath) {
    const allData = await loadAllEventData(dataPath);
    const holeShotData = [];
    
    for (const race of allData.races) {
        if (race.race && race.race.Laps) {
            const raceData = race.race;
            const pilotLaps = {};
            
            // Group laps by pilot
            raceData.Laps.forEach(lap => {
                if (!pilotLaps[lap.Pilot]) {
                    pilotLaps[lap.Pilot] = [];
                }
                pilotLaps[lap.Pilot].push({
                    time: lap.Length,
                    raceTime: lap.RaceTime || 0,
                    lapNumber: lap.LapNumber || pilotLaps[lap.Pilot].length + 1
                });
            });
            
            // Calculate hole shots for each pilot
            Object.entries(pilotLaps).forEach(([pilotId, laps]) => {
                const pilot = allData.pilots.find(p => p.ID === pilotId);
                if (!pilot || laps.length < 3) return;
                
                // Sort laps by lap number
                laps.sort((a, b) => a.lapNumber - b.lapNumber);
                
                // Calculate consecutive 3-lap times and hole shots
                for (let i = 0; i <= laps.length - 3; i++) {
                    const consecutiveLaps = laps.slice(i, i + 3);
                    const consecutiveTime = consecutiveLaps.reduce((sum, lap) => sum + lap.time, 0);
                    const endRaceTime = consecutiveLaps[2].raceTime;
                    
                    if (consecutiveTime > 0 && endRaceTime > consecutiveTime) {
                        const holeShot = endRaceTime - consecutiveTime;
                        
                        holeShotData.push({
                            pilotId: pilotId,
                            pilotName: pilot.Name,
                            holeShot: holeShot,
                            round: `R${raceData.RoundNumber || 1}`,
                            raceNumber: raceData.RaceNumber || 1,
                            eventType: raceData.EventType,
                            consecutiveTime: consecutiveTime,
                            startingLap: i + 1
                        });
                    }
                }
            });
        }
    }
    
    // Find best hole shot for each pilot
    const pilotBestHoleShots = {};
    holeShotData.forEach(entry => {
        if (!pilotBestHoleShots[entry.pilotId] || entry.holeShot < pilotBestHoleShots[entry.pilotId].holeShot) {
            pilotBestHoleShots[entry.pilotId] = entry;
        }
    });
    
    // Sort by best hole shot time
    const rankings = Object.values(pilotBestHoleShots)
        .sort((a, b) => a.holeShot - b.holeShot)
        .map((pilot, index) => ({
            position: index + 1,
            pilot: pilot.pilotName,
            bestHoleShot: parseFloat(pilot.holeShot.toFixed(3)),
            round: pilot.round,
            improvements: holeShotData.filter(h => h.pilotId === pilot.pilotId).length,
            avgHoleShot: parseFloat((holeShotData
                .filter(h => h.pilotId === pilot.pilotId)
                .reduce((sum, h) => sum + h.holeShot, 0) / 
                holeShotData.filter(h => h.pilotId === pilot.pilotId).length).toFixed(3))
        }));
    
    return {
        rankings: rankings,
        allHoleShots: holeShotData.map(entry => ({
            ...entry,
            holeShot: parseFloat(entry.holeShot.toFixed(3))
        }))
    };
}

// Calculate performance gaps
async function calculatePerformanceGaps(dataPath) {
    const rankings = await calculateFastestLapRankings(dataPath);
    const gaps = [];
    
    for (let i = 1; i < rankings.length; i++) {
        const currentPilot = rankings[i];
        const previousPilot = rankings[i - 1];
        const gap = currentPilot.fastestLapTime - previousPilot.fastestLapTime;
        const gapPercentage = ((gap / previousPilot.fastestLapTime) * 100).toFixed(2);
        
        gaps.push({
            position: currentPilot.position,
            pilot: currentPilot.pilot,
            fastestLapTime: currentPilot.fastestLapTime,
            gapToLeader: parseFloat((currentPilot.fastestLapTime - rankings[0].fastestLapTime).toFixed(3)),
            gapToPrevious: parseFloat(gap.toFixed(3)),
            gapPercentage: parseFloat(gapPercentage),
            isClose: gap < 0.5, // Tight competition marker
            round: currentPilot.round
        });
    }
    
    // Add leader (no gap)
    if (rankings.length > 0) {
        gaps.unshift({
            position: 1,
            pilot: rankings[0].pilot,
            fastestLapTime: rankings[0].fastestLapTime,
            gapToLeader: 0,
            gapToPrevious: 0,
            gapPercentage: 0,
            isClose: false,
            round: rankings[0].round
        });
    }
    
    return {
        gaps: gaps,
        closeCompetition: gaps.filter(g => g.isClose),
        biggestGap: gaps.reduce((max, gap) => gap.gapToPrevious > max.gapToPrevious ? gap : max, {gapToPrevious: 0})
    };
}

// Calculate personal bests and progression
async function calculatePersonalBests(dataPath) {
    const allData = await loadAllEventData(dataPath);
    const pilotProgression = {};
    
    // Process each race chronologically
    const sortedRaces = allData.races
        .filter(race => race.race && race.race.Laps)
        .sort((a, b) => {
            const aRound = a.race.RoundNumber || 0;
            const bRound = b.race.RoundNumber || 0;
            if (aRound !== bRound) return aRound - bRound;
            return (a.race.RaceNumber || 0) - (b.race.RaceNumber || 0);
        });
    
    sortedRaces.forEach((race, raceIndex) => {
        const raceData = race.race;
        const pilotLaps = {};
        
        // Group laps by pilot
        raceData.Laps.forEach(lap => {
            if (!pilotLaps[lap.Pilot]) {
                pilotLaps[lap.Pilot] = [];
            }
            if (lap.Length > 0 && lap.Length < 200) {
                pilotLaps[lap.Pilot].push(lap.Length);
            }
        });
        
        // Track personal bests
        Object.entries(pilotLaps).forEach(([pilotId, laps]) => {
            const pilot = allData.pilots.find(p => p.ID === pilotId);
            if (!pilot || laps.length === 0) return;
            
            if (!pilotProgression[pilotId]) {
                pilotProgression[pilotId] = {
                    pilotName: pilot.Name,
                    personalBests: [],
                    allTimes: [],
                    rounds: []
                };
            }
            
            const fastestInRace = Math.min(...laps);
            const avgInRace = laps.reduce((sum, time) => sum + time, 0) / laps.length;
            const currentPB = pilotProgression[pilotId].personalBests.length > 0 
                ? Math.min(...pilotProgression[pilotId].personalBests.map(pb => pb.time))
                : Infinity;
            
            const roundData = {
                round: raceData.RoundNumber || 1,
                raceNumber: raceData.RaceNumber || 1,
                eventType: raceData.EventType,
                fastestLap: fastestInRace,
                averageLap: avgInRace,
                lapCount: laps.length,
                isPB: fastestInRace < currentPB,
                improvement: currentPB < Infinity ? currentPB - fastestInRace : 0
            };
            
            pilotProgression[pilotId].rounds.push(roundData);
            pilotProgression[pilotId].allTimes.push(...laps);
            
            // Record new PB
            if (fastestInRace < currentPB) {
                pilotProgression[pilotId].personalBests.push({
                    time: fastestInRace,
                    round: `R${raceData.RoundNumber || 1}`,
                    raceNumber: raceData.RaceNumber || 1,
                    eventType: raceData.EventType,
                    improvementFromPrevious: currentPB < Infinity ? parseFloat((currentPB - fastestInRace).toFixed(3)) : 0,
                    date: raceIndex // Use race index as chronological marker
                });
            }
        });
    });
    
    // Calculate final stats for each pilot
    const pilotStats = Object.entries(pilotProgression).map(([pilotId, data]) => {
        const allValidTimes = data.allTimes.filter(time => time > 0 && time < 200);
        const currentPB = data.personalBests.length > 0 
            ? Math.min(...data.personalBests.map(pb => pb.time))
            : null;
        
        return {
            pilotId: pilotId,
            pilotName: data.pilotName,
            currentPB: currentPB,
            pbCount: data.personalBests.length,
            totalImprovement: data.personalBests.length > 1 
                ? parseFloat((data.personalBests[0].time - currentPB).toFixed(3))
                : 0,
            averageTime: allValidTimes.length > 0 
                ? parseFloat((allValidTimes.reduce((sum, time) => sum + time, 0) / allValidTimes.length).toFixed(3))
                : null,
            consistency: calculateConsistency(allValidTimes),
            personalBests: data.personalBests,
            recentForm: data.rounds.slice(-3), // Last 3 rounds
            totalRounds: data.rounds.length
        };
    });
    
    return pilotStats
        .filter(pilot => pilot.currentPB !== null)
        .sort((a, b) => a.currentPB - b.currentPB);
}

// Helper function to calculate consistency
function calculateConsistency(lapTimes) {
    if (lapTimes.length < 2) return null;
    
    const mean = lapTimes.reduce((sum, time) => sum + time, 0) / lapTimes.length;
    const variance = lapTimes.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / lapTimes.length;
    const stdDev = Math.sqrt(variance);
    
    return parseFloat(((stdDev / mean) * 100).toFixed(1));
}

// Calculate points for grade-based racing system
function calculateGradeBasedPoints(roundRaces) {
    // Sort races by grade (A first, then B, then C, etc.)
    const sortedRaces = roundRaces.sort((a, b) => {
        const gradeA = a.grade || 'Z';
        const gradeB = b.grade || 'Z';
        return gradeA.localeCompare(gradeB);
    });
    

    
    // First, create a global ranking across all races
    const globalRanking = [];
    
    // Collect all pilots with their race grade and position
    sortedRaces.forEach((race, raceIndex) => {
        if (race.results) {
            // Sort results by position within the race, with DNF pilots at the end of their grade
            const sortedResults = [...race.results].sort((a, b) => {
                if (a.DNF && !b.DNF) return 1; // DNF goes after non-DNF
                if (!a.DNF && b.DNF) return -1; // non-DNF goes before DNF
                return a.Position - b.Position; // Normal position sorting
            });
            
            sortedResults.forEach(result => {
                if (result.Position > 0) { // Include all pilots with valid positions (including DNF)
                    globalRanking.push({
                        pilot: result.Pilot,
                        grade: race.grade,
                        racePosition: result.Position,
                        raceIndex: raceIndex,
                        dnf: result.DNF
                    });
                }
            });
        }
    });
    
    // Sort global ranking by grade first, then by DNF status, then by position within grade
    globalRanking.sort((a, b) => {
        // First sort by grade
        const gradeCompare = (a.grade || 'Z').localeCompare(b.grade || 'Z');
        if (gradeCompare !== 0) return gradeCompare;
        // Within same grade, non-DNF pilots come before DNF pilots
        if (a.dnf && !b.dnf) return 1;
        if (!a.dnf && b.dnf) return -1;
        // Then by position within the race
        return a.racePosition - b.racePosition;
    });
    
    // Assign points based on global ranking
    const pointsMap = {};
    let currentPoints = 20; // Start at 20 points for first place overall
    
    // Assign points based on global ranking
    globalRanking.forEach((entry, index) => {
        pointsMap[entry.pilot] = currentPoints;
        currentPoints = Math.max(0, currentPoints - 1); // Count down but never go below 0
    });
    
    console.log(`  ✓ Points allocated: ${Object.keys(pointsMap).length} pilots`);
    return pointsMap;
}

// Analyze race structure and determine grade levels
async function analyzeRaceStructure(dataPath) {
    const allData = await loadAllEventData(dataPath);
    
    // Group races by round
    const racesByRound = {};
    allData.races.forEach(race => {
        const roundId = race.race.Round;
        if (!racesByRound[roundId]) {
            racesByRound[roundId] = {
                roundNumber: race.roundNumber,
                eventType: race.eventType,
                races: []
            };
        }
        racesByRound[roundId].races.push(race);
    });
    
    // Get time trial results for seeding
    const timeTrialResults = {};
    
    // Process qualifying rounds (1-4)
    Object.values(racesByRound).forEach(roundData => {
        if (roundData.eventType === 'TimeTrial' && roundData.roundNumber <= 4) {
            roundData.races.forEach(race => {
                if (race.race.Laps) {
                    // Calculate best consecutive laps for each pilot
                    const pilotLaps = {};
                    race.race.Laps.forEach(lap => {
                        if (!pilotLaps[lap.Pilot]) {
                            pilotLaps[lap.Pilot] = [];
                        }
                        if (lap.Length > 0 && lap.Length < 200) {
                            pilotLaps[lap.Pilot].push(lap.Length);
                        }
                    });
                    
                    Object.entries(pilotLaps).forEach(([pilotId, laps]) => {
                        if (laps.length >= 3) {
                            // Find best 3 consecutive laps
                            let bestConsecutive = Infinity;
                            for (let i = 0; i <= laps.length - 3; i++) {
                                const consecutiveTime = laps[i] + laps[i+1] + laps[i+2];
                                if (consecutiveTime < bestConsecutive) {
                                    bestConsecutive = consecutiveTime;
                                }
                            }
                            
                            if (!timeTrialResults[pilotId] || bestConsecutive < timeTrialResults[pilotId].bestTime) {
                                timeTrialResults[pilotId] = {
                                    pilotId: pilotId,
                                    pilotName: allData.pilots.find(p => p.ID === pilotId)?.Name || 'Unknown',
                                    bestTime: bestConsecutive,
                                    bestSingle: Math.min(...laps)
                                };
                            }
                        }
                    });
                }
            });
        }
    });
    
    // Sort pilots by time trial performance
    const sortedPilots = Object.values(timeTrialResults)
        .sort((a, b) => a.bestTime - b.bestTime);
    
    // Determine grade assignments based on race structure
    const gradeAssignments = {};
    const correctedPoints = {};
    
    Object.entries(racesByRound).forEach(([roundId, roundData]) => {
        // Detect racing rounds by structure: rounds with multiple races and results (indicating graded racing)
        const hasMultipleRaces = roundData.races.length > 1;
        const hasRaceResults = roundData.races.some(race => race.result && race.result.length > 0);
        const isExplicitRace = roundData.eventType === 'Race';
        const isRacingRound = (hasMultipleRaces && hasRaceResults) || (isExplicitRace && hasRaceResults);
        
        console.log(`Processing Round ${roundData.roundNumber}: ${isRacingRound ? 'RACING ROUND' : 'skipping'} (${roundData.eventType}, ${roundData.races.length} races)`);
        
        if (isRacingRound && hasRaceResults) {
            const numRaces = roundData.races.length;
            const pilotsPerRace = Math.ceil(sortedPilots.length / numRaces);
            
            // Sort races by their start time or race number
            const sortedRaces = roundData.races.sort((a, b) => {
                return (a.race.RaceNumber || 0) - (b.race.RaceNumber || 0);
            });
            
            // Prepare races with grade info for points calculation
            const racesWithGrades = [];
            
            // Determine grade based on pilots in each race
            sortedRaces.forEach((race, raceIndex) => {
                // Get pilots in this race and their seeding positions
                const racePilots = [];
                let totalSeedingPos = 0;
                let validPilotCount = 0;
                
                if (race.result) {
                    race.result.forEach(result => {
                        const seedingIndex = sortedPilots.findIndex(p => p.pilotId === result.Pilot);
                        const pilot = allData.pilots.find(p => p.ID === result.Pilot);
                        
                        if (pilot) {
                            racePilots.push({
                                pilotId: result.Pilot,
                                pilotName: pilot.Name,
                                seedingPosition: seedingIndex >= 0 ? seedingIndex + 1 : 999,
                                position: result.Position,
                                points: result.Points,
                                dnf: result.DNF
                            });
                            
                            if (seedingIndex >= 0) {
                                totalSeedingPos += seedingIndex + 1;
                                validPilotCount++;
                            }
                        }
                    });
                }
                
                // Determine grade based on race number if seeding not available
                let grade = 'U'; // Unknown
                
                // First try: Use seeding positions if we have them
                if (validPilotCount > 0 && sortedPilots.length > 0) {
                    const avgSeedingPos = totalSeedingPos / validPilotCount;
                    
                    // Assign grade based on seeding position ranges
                    const totalPilots = sortedPilots.length;
                    const pilotsPerGrade = Math.ceil(totalPilots / numRaces);
                    
                    if (avgSeedingPos <= pilotsPerGrade) {
                        grade = 'A';
                    } else if (avgSeedingPos <= pilotsPerGrade * 2) {
                        grade = 'B';
                    } else if (avgSeedingPos <= pilotsPerGrade * 3) {
                        grade = 'C';
                    } else {
                        grade = 'D';
                    }
                } else {
                    // Fallback: Assign grade based on race number within the round
                    // Race 1 = Grade A, Race 2 = Grade B, etc.
                    const raceNumber = race.race.RaceNumber || (raceIndex + 1);
                    grade = String.fromCharCode(65 + (raceNumber - 1)); // A=65, B=66, C=67...
                    

                }
                
                gradeAssignments[race.id] = {
                    raceId: race.id,
                    roundNumber: roundData.roundNumber,
                    grade: grade,
                    pilots: racePilots,
                    avgSeedingPosition: validPilotCount > 0 ? totalSeedingPos / validPilotCount : null
                };
                
                racesWithGrades.push({
                    grade: grade,
                    results: race.result,
                    raceId: race.id
                });
                

            });
            
            // Sort races by grade to ensure proper points calculation
            racesWithGrades.sort((a, b) => a.grade.charCodeAt(0) - b.grade.charCodeAt(0));
            
            // Calculate correct points for this round
            console.log(`→ Calculating grade-based points for Round ${roundData.roundNumber} (${racesWithGrades.length} races)`);
            
            // Calculate correct points for this round
            const roundPoints = calculateGradeBasedPoints(racesWithGrades);
            
            // Store corrected points for each race
            Object.entries(roundPoints).forEach(([pilotId, points]) => {
                if (!correctedPoints[roundId]) {
                    correctedPoints[roundId] = {};
                }
                correctedPoints[roundId][pilotId] = points;
            });
        }
    });
    
    return {
        racesByRound: racesByRound,
        timeTrialSeeding: sortedPilots,
        gradeAssignments: gradeAssignments,
        correctedPoints: correctedPoints
    };
}

// Helper function to load all event data - ULTRA ROBUST VERSION
async function loadAllEventData(dataPath) {
    const allData = {
        events: [],
        pilots: [],
        rounds: [],
        races: []
    };
    
    console.log(`🔍 Starting deep recursive scan in: ${dataPath}`);
    
    // Recursively find all JSON files
    const jsonFiles = await findJsonFiles(dataPath, 20); // Increase depth for thorough search
    console.log(`📂 Found ${jsonFiles.length} JSON files`);
    
    // Load and classify all JSON files
    const classifiedFiles = [];
    for (const filePath of jsonFiles) {
        const classified = await loadAndClassifyJsonFile(filePath);
        if (classified) {
            classifiedFiles.push(classified);
            
            // Log race files for debugging
            if (classified.type === 'race') {
                console.log(`🏁 Found race file: ${path.basename(path.dirname(filePath))}/${classified.fileName}`);
            }
        }
    }
    
    // Group files by type
    const filesByType = {
        event: classifiedFiles.filter(f => f.type === 'event'),
        pilots: classifiedFiles.filter(f => f.type === 'pilots'),
        rounds: classifiedFiles.filter(f => f.type === 'rounds'),
        race: classifiedFiles.filter(f => f.type === 'race'),
        result: classifiedFiles.filter(f => f.type === 'result')
    };
    
    console.log(`📊 File classification:`, {
        events: filesByType.event.length,
        pilots: filesByType.pilots.length,
        rounds: filesByType.rounds.length,
        races: filesByType.race.length,
        results: filesByType.result.length
    });
    
    // Process event files
    for (const eventFile of filesByType.event) {
        for (const event of eventFile.data) {
            if (event && event.Name) {
                allData.events.push(event);
            }
        }
    }
    
    // Process pilot files (deduplicate by ID)
    const pilotMap = new Map();
    for (const pilotFile of filesByType.pilots) {
        for (const pilot of pilotFile.data) {
            if (pilot && pilot.ID) {
                pilotMap.set(pilot.ID, pilot);
            }
        }
    }
    allData.pilots = Array.from(pilotMap.values());
    
    // Process rounds files and create a map of round ID to round data
    const roundMap = new Map();
    for (const roundFile of filesByType.rounds) {
        for (const round of roundFile.data) {
            if (round && round.RoundNumber !== undefined) {
                allData.rounds.push(round);
                roundMap.set(round.ID, round);
            }
        }
    }
    
    // Process race files - BE VERY FLEXIBLE HERE
    const resultsByRaceId = new Map();
    const resultsByDirectory = new Map();
    
    // First, index all results
    for (const resultFile of filesByType.result) {
        for (const result of resultFile.data) {
            if (result) {
                // Index by race ID if available
                if (result.Race) {
                    if (!resultsByRaceId.has(result.Race)) {
                        resultsByRaceId.set(result.Race, []);
                    }
                    resultsByRaceId.get(result.Race).push(result);
                }
                
                // Also index by directory
                const dir = resultFile.directory;
                if (!resultsByDirectory.has(dir)) {
                    resultsByDirectory.set(dir, []);
                }
                resultsByDirectory.get(dir).push(result);
            }
        }
    }
    
    // Process each race file
    for (const raceFile of filesByType.race) {
        for (const race of raceFile.data) {
            // Accept ANY object that looks like a race
            if (race && (
                race.Laps || 
                race.Detections || 
                race.RaceNumber !== undefined || 
                race.Start || 
                race.PilotChannels ||
                race.Round || 
                race.Event
            )) {
                // Extract race ID from various possible sources
                let raceId = race.ID || 
                           path.basename(raceFile.directory) || 
                           `${race.RaceNumber || 0}-${race.Round || 'unknown'}`;
                
                // Find matching results
                let matchingResults = [];
                
                // First try: by race ID
                if (race.ID && resultsByRaceId.has(race.ID)) {
                    matchingResults = resultsByRaceId.get(race.ID);
                }
                
                // Second try: by directory
                if (matchingResults.length === 0) {
                    const raceDir = raceFile.directory;
                    matchingResults = resultsByDirectory.get(raceDir) || [];
                }
                
                // Get round number from the race or from linked round
                let roundNumber = race.RoundNumber;
                let eventType = race.EventType;
                
                if ((roundNumber === undefined || eventType === undefined) && race.Round && roundMap.has(race.Round)) {
                    const linkedRound = roundMap.get(race.Round);
                    if (linkedRound) {
                        roundNumber = linkedRound.RoundNumber;
                        eventType = linkedRound.EventType;
                    }
                }
                
                // Add the race with all available information
                const raceEntry = {
                    id: raceId,
                    eventId: race.Event || path.basename(path.dirname(path.dirname(raceFile.filePath))),
                    race: race,
                    result: matchingResults.length > 0 ? matchingResults : null,
                    filePath: raceFile.filePath,
                    directory: raceFile.directory,
                    roundNumber: roundNumber,
                    eventType: eventType,
                    raceNumber: race.RaceNumber
                };
                
                allData.races.push(raceEntry);
                
                // Log successful race loading
                console.log(`✅ Loaded race: Round ${roundNumber || '?'}, Race ${race.RaceNumber || '?'} - ${matchingResults.length} results, Type: ${eventType || '?'}`);
            }
        }
    }
    
    console.log(`\n✅ Final data summary:`, {
        events: allData.events.length,
        pilots: allData.pilots.length,
        rounds: allData.rounds.length,
        races: allData.races.length,
        racesWithResults: allData.races.filter(r => r.result && r.result.length > 0).length,
        totalResults: allData.races.reduce((sum, r) => sum + (r.result ? r.result.length : 0), 0)
    });
    
    return allData;
}

// API Routes

// Get all available events
app.get('/api/events', async (req, res) => {
    try {
        const dataPath = getFPVTracksideDataPath();
        if (!dataPath) {
            return res.status(404).json({ 
                error: 'FPVTrackside data directory not found',
                message: 'Please ensure FPVTrackside is installed and has event data'
            });
        }

        const events = [];
        const eventDirs = await fs.readdir(dataPath);
        
        for (const eventDir of eventDirs) {
            const eventPath = path.join(dataPath, eventDir);
            const stat = await fs.stat(eventPath);
            
            if (stat.isDirectory()) {
                try {
                    // Use robust loading for each event directory
                    const eventData = await loadAllEventData(eventPath);
                    
                    if (eventData.events.length > 0) {
                        const event = eventData.events[0];
                        events.push({
                            id: eventDir,
                            name: event.Name || 'Unnamed Event',
                            start: event.Start,
                            eventType: event.EventType,
                            pilotsRegistered: event.PilotsRegistered || eventData.pilots.length,
                            path: eventPath,
                            raceCount: eventData.races.length,
                            pilotCount: eventData.pilots.length
                        });
                    }
                } catch (error) {
                    console.log(`⚠️  Skipping event directory ${eventDir}: ${error.message}`);
                }
            }
        }

        res.json(events);
    } catch (error) {
        console.error('Error getting events:', error);
        res.status(500).json({ error: 'Failed to load events' });
    }
});

// Get specific event data
app.get('/api/events/:eventId', async (req, res) => {
    try {
        const dataPath = getFPVTracksideDataPath();
        if (!dataPath) {
            return res.status(404).json({ error: 'FPVTrackside data directory not found' });
        }

        const eventId = req.params.eventId;
        const eventPath = path.join(dataPath, eventId);
        
        // Check if event directory exists
        if (!existsSync(eventPath)) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Use robust loading for this specific event directory
        const allData = await loadAllEventData(eventPath);
        
        // Filter data for this specific event
        const eventData = allData.events.find(e => e.Name) || allData.events[0];
        const races = allData.races.map(race => ({
            id: race.id,
            race: race.race,
            result: race.result
        }));

        if (!eventData) {
            return res.status(404).json({ error: 'Event data not found' });
        }

        res.json({
            event: eventData,
            pilots: allData.pilots,
            rounds: allData.rounds,
            races: races
        });

    } catch (error) {
        console.error('Error getting event data:', error);
        res.status(500).json({ error: 'Failed to load event data' });
    }
});

// Get all data (for compatibility with existing frontend)
app.get('/api/data', async (req, res) => {
    try {
        const dataPath = getFPVTracksideDataPath();
        if (!dataPath) {
            return res.status(404).json({ 
                error: 'FPVTrackside data directory not found',
                message: 'Please ensure FPVTrackside is installed and has event data'
            });
        }

        // Use the new robust loading system
        const allData = await loadAllEventData(dataPath);
        
        res.json(allData);
    } catch (error) {
        console.error('Error getting all data:', error);
        res.status(500).json({ error: 'Failed to load data' });
    }
});

// Performance Insights API Endpoints

// Excel-style fastest lap rankings
app.get('/api/insights/fastest-lap-rankings', async (req, res) => {
    try {
        const dataPath = getFPVTracksideDataPath();
        if (!dataPath) {
            return res.status(404).json({ error: 'FPVTrackside data directory not found' });
        }

        const groupSize = parseInt(req.query.groupSize) || 4; // Default group size from Excel
        const rankings = await calculateFastestLapRankings(dataPath, groupSize);
        
        res.json(rankings);
    } catch (error) {
        console.error('Error calculating fastest lap rankings:', error);
        res.status(500).json({ error: 'Failed to calculate fastest lap rankings' });
    }
});

// Hole shot performance analysis
app.get('/api/insights/hole-shot-analysis', async (req, res) => {
    try {
        const dataPath = getFPVTracksideDataPath();
        if (!dataPath) {
            return res.status(404).json({ error: 'FPVTrackside data directory not found' });
        }

        const holeShotData = await calculateHoleShotAnalysis(dataPath);
        
        res.json(holeShotData);
    } catch (error) {
        console.error('Error calculating hole shot analysis:', error);
        res.status(500).json({ error: 'Failed to calculate hole shot analysis' });
    }
});

// Performance gap analysis
app.get('/api/insights/performance-gaps', async (req, res) => {
    try {
        const dataPath = getFPVTracksideDataPath();
        if (!dataPath) {
            return res.status(404).json({ error: 'FPVTrackside data directory not found' });
        }

        const gapAnalysis = await calculatePerformanceGaps(dataPath);
        
        res.json(gapAnalysis);
    } catch (error) {
        console.error('Error calculating performance gaps:', error);
        res.status(500).json({ error: 'Failed to calculate performance gaps' });
    }
});

// Personal best tracking
app.get('/api/insights/personal-bests', async (req, res) => {
    try {
        const dataPath = getFPVTracksideDataPath();
        if (!dataPath) {
            return res.status(404).json({ error: 'FPVTrackside data directory not found' });
        }

        const personalBests = await calculatePersonalBests(dataPath);
        
        res.json(personalBests);
    } catch (error) {
        console.error('Error calculating personal bests:', error);
        res.status(500).json({ error: 'Failed to calculate personal bests' });
    }
});

// Get enhanced standings with grade information
app.get('/api/events/:eventId/enhanced-standings', async (req, res) => {
    try {
        const dataPath = getFPVTracksideDataPath();
        if (!dataPath) {
            return res.status(404).json({ error: 'FPVTrackside data directory not found' });
        }

        const eventId = req.params.eventId;
        const eventPath = path.join(dataPath, eventId);
        
        const raceAnalysis = await analyzeRaceStructure(eventPath);
        const allData = await loadAllEventData(eventPath);
        
        // Build enhanced standings with grade information
        const pilotStandings = {};
        
        // Initialize pilots
        allData.pilots.forEach(pilot => {
            pilotStandings[pilot.ID] = {
                pilot: pilot,
                qualifyingResults: [],
                raceResults: [],
                totalPoints: 0,
                correctedPoints: 0,
                grades: [],
                seedingPosition: null,
                bestLapTime: Infinity,
                avgLapTime: null,
                consistency: null,
                lapTimes: []
            };
        });
        
        // Add seeding positions
        raceAnalysis.timeTrialSeeding.forEach((seed, index) => {
            if (pilotStandings[seed.pilotId]) {
                pilotStandings[seed.pilotId].seedingPosition = index + 1;
                pilotStandings[seed.pilotId].seedingTime = seed.bestTime;
            }
        });
        
        // Process races with grade information
        allData.races.forEach(race => {
            if (!race.result) return;
            
            const gradeInfo = raceAnalysis.gradeAssignments[race.id];
            const roundNumber = race.roundNumber;
            const roundId = race.race.Round;
            
            race.result.forEach(result => {
                if (!pilotStandings[result.Pilot]) return;
                
                const standing = pilotStandings[result.Pilot];
                
                // Get corrected points if available
                const correctedPoints = raceAnalysis.correctedPoints[roundId] && 
                                      raceAnalysis.correctedPoints[roundId][result.Pilot] || 0;
                
                const roundData = {
                    round: roundNumber,
                    position: result.Position,
                    points: result.Points || 0,
                    correctedPoints: correctedPoints,
                    dnf: result.DNF || false,
                    grade: gradeInfo?.grade || null,
                    raceId: race.id
                };
                
                if (race.eventType === 'TimeTrial' && roundNumber <= 4) {
                    standing.qualifyingResults.push(roundData);
                } else if (race.eventType === 'Race' && roundNumber >= 5) {
                    standing.raceResults.push(roundData);
                    standing.totalPoints += result.Points || 0;
                    standing.correctedPoints += correctedPoints;
                    
                    // Track which grade the pilot raced in
                    if (gradeInfo) {
                        if (!standing.grades.includes(gradeInfo.grade)) {
                            standing.grades.push(gradeInfo.grade);
                        }
                    }
                }
            });
            
            // Process lap times for this race
            if (race.race && race.race.Laps) {
                race.race.Laps.forEach(lap => {
                    if (pilotStandings[lap.Pilot] && lap.Length > 0 && lap.Length < 200) {
                        const standing = pilotStandings[lap.Pilot];
                        standing.lapTimes.push(lap.Length);
                        standing.bestLapTime = Math.min(standing.bestLapTime, lap.Length);
                    }
                });
            }
        });
        
        // Calculate average lap times and consistency for each pilot
        Object.values(pilotStandings).forEach(standing => {
            if (standing.lapTimes.length > 0) {
                standing.avgLapTime = standing.lapTimes.reduce((a, b) => a + b, 0) / standing.lapTimes.length;
                
                // Calculate consistency (standard deviation)
                if (standing.lapTimes.length > 1) {
                    const mean = standing.avgLapTime;
                    const variance = standing.lapTimes.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / standing.lapTimes.length;
                    standing.consistency = Math.sqrt(variance);
                }
                
                // Convert Infinity to null for display
                if (standing.bestLapTime === Infinity) {
                    standing.bestLapTime = null;
                }
            }
        });
        
        // Sort by corrected points
        const standings = Object.values(pilotStandings)
            .sort((a, b) => b.correctedPoints - a.correctedPoints)
            .map((standing, index) => ({
                position: index + 1,
                ...standing
            }));
        
        console.log('Enhanced standings sample:', standings.slice(0, 2));
        
        res.json({
            standings: standings,
            raceStructure: raceAnalysis.racesByRound,
            gradeAssignments: raceAnalysis.gradeAssignments,
            correctedPoints: raceAnalysis.correctedPoints
        });
        
    } catch (error) {
        console.error('Error getting enhanced standings:', error);
        res.status(500).json({ error: 'Failed to load enhanced standings' });
    }
});

// Get race results with proper points calculation
app.get('/api/events/:eventId/standings', async (req, res) => {
    try {
        const dataPath = getFPVTracksideDataPath();
        if (!dataPath) {
            return res.status(404).json({ error: 'FPVTrackside data directory not found' });
        }

        const eventId = req.params.eventId;
        const eventPath = path.join(dataPath, eventId);
        
        const allData = await loadAllEventData(eventPath);
        
        // Calculate proper standings based on Winter Series format
        const pilotStandings = {};
        
        // Initialize pilots
        allData.pilots.forEach(pilot => {
            pilotStandings[pilot.ID] = {
                pilot: pilot,
                qualifyingRounds: [],
                raceRounds: [],
                totalPoints: 0,
                bestLapTime: Infinity,
                positions: []
            };
        });
        
        // Process races by round number
        allData.races.forEach(race => {
            if (!race.race || !race.result) return;
            
            const roundNumber = race.roundNumber || race.race.RoundNumber;
            const isQualifying = roundNumber <= 4;
            
            race.result.forEach(result => {
                if (!pilotStandings[result.Pilot]) return;
                
                const standing = pilotStandings[result.Pilot];
                const roundData = {
                    round: roundNumber,
                    position: result.Position,
                    points: result.Points || 0,
                    dnf: result.DNF || false
                };
                
                if (isQualifying) {
                    standing.qualifyingRounds.push(roundData);
                } else {
                    standing.raceRounds.push(roundData);
                    standing.totalPoints += result.Points || 0;
                }
                
                standing.positions.push(result.Position);
            });
            
            // Get lap times
            if (race.race.Laps) {
                race.race.Laps.forEach(lap => {
                    if (pilotStandings[lap.Pilot] && lap.Length > 0 && lap.Length < 200) {
                        pilotStandings[lap.Pilot].bestLapTime = Math.min(
                            pilotStandings[lap.Pilot].bestLapTime,
                            lap.Length
                        );
                    }
                });
            }
        });
        
        // Sort by total points
        const standings = Object.values(pilotStandings)
            .sort((a, b) => b.totalPoints - a.totalPoints)
            .map((standing, index) => ({
                position: index + 1,
                ...standing
            }));
        
        res.json(standings);
        
    } catch (error) {
        console.error('Error getting standings:', error);
        res.status(500).json({ error: 'Failed to load standings' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    const dataPath = getFPVTracksideDataPath();
    res.json({ 
        status: 'ok', 
        dataPathFound: !!dataPath,
        dataPath: dataPath 
    });
});

// Default route - serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`FPV Trackside Dashboard server running on http://localhost:${PORT}`);
    console.log(`Checking for FPVTrackside data...`);
    
    const dataPath = getFPVTracksideDataPath();
    if (dataPath) {
        console.log(`✅ FPVTrackside data found at: ${dataPath}`);
    } else {
        console.log(`❌ FPVTrackside data not found. Please ensure FPVTrackside is installed.`);
    }
});

module.exports = app; 