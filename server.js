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
                const eventFilePath = path.join(eventPath, 'Event.json');
                if (existsSync(eventFilePath)) {
                    const eventData = await readJSONFile(eventFilePath);
                    if (eventData && eventData.length > 0) {
                        events.push({
                            id: eventDir,
                            name: eventData[0].Name,
                            start: eventData[0].Start,
                            eventType: eventData[0].EventType,
                            pilotsRegistered: eventData[0].PilotsRegistered,
                            path: eventPath
                        });
                    }
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

        const eventPath = path.join(dataPath, req.params.eventId);
        
        // Read all the event files
        const eventData = await readJSONFile(path.join(eventPath, 'Event.json'));
        const pilotsData = await readJSONFile(path.join(eventPath, 'Pilots.json'));
        const roundsData = await readJSONFile(path.join(eventPath, 'Rounds.json'));

        if (!eventData) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Get race data
        const races = [];
        if (eventData[0].Races) {
            for (const raceId of eventData[0].Races) {
                const raceFilePath = path.join(eventPath, raceId, 'Race.json');
                const resultFilePath = path.join(eventPath, raceId, 'Result.json');
                
                const raceData = await readJSONFile(raceFilePath);
                const resultData = await readJSONFile(resultFilePath, true); // Silent for Result.json
                
                if (raceData) {
                    races.push({
                        id: raceId,
                        race: raceData,
                        result: resultData
                    });
                }
            }
        }

        res.json({
            event: eventData[0],
            pilots: pilotsData || [],
            rounds: roundsData || [],
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

        const allData = {
            events: [],
            pilots: [],
            rounds: [],
            races: []
        };

        const eventDirs = await fs.readdir(dataPath);
        let totalRacesFound = 0;
        let totalResultsFound = 0;
        
        for (const eventDir of eventDirs) {
            const eventPath = path.join(dataPath, eventDir);
            const stat = await fs.stat(eventPath);
            
            if (stat.isDirectory()) {
                // Read event data
                const eventData = await readJSONFile(path.join(eventPath, 'Event.json'));
                const pilotsData = await readJSONFile(path.join(eventPath, 'Pilots.json'));
                const roundsData = await readJSONFile(path.join(eventPath, 'Rounds.json'));

                if (eventData && eventData.length > 0) {
                    allData.events.push(eventData[0]);
                    
                    if (pilotsData) {
                        allData.pilots.push(...pilotsData);
                    }
                    
                    if (roundsData) {
                        allData.rounds.push(...roundsData);
                    }

                    // Get race data
                    if (eventData[0].Races) {
                        for (const raceId of eventData[0].Races) {
                            const raceFilePath = path.join(eventPath, raceId, 'Race.json');
                            const resultFilePath = path.join(eventPath, raceId, 'Result.json');
                            
                            const raceData = await readJSONFile(raceFilePath);
                            const resultData = await readJSONFile(resultFilePath, true); // Silent for Result.json
                            
                            if (raceData) {
                                totalRacesFound++;
                                if (resultData) totalResultsFound++;
                                
                                allData.races.push({
                                    id: raceId,
                                    eventId: eventDir,
                                    race: raceData[0],
                                    result: resultData ? resultData[0] : null
                                });
                            }
                        }
                    }
                }
            }
        }

        console.log(`📊 Data loaded: ${allData.events.length} events, ${allData.pilots.length} pilots, ${totalRacesFound} races (${totalResultsFound} with results)`);
        res.json(allData);
    } catch (error) {
        console.error('Error getting all data:', error);
        res.status(500).json({ error: 'Failed to load data' });
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