class FPVDashboard {
    constructor() {
        this.eventData = null;
        this.pilots = {};
        this.races = [];
        this.rounds = {};
        this.results = [];
        this.activeFilters = {
            eventType: 'all',
            validOnly: 'all',
            roundFilter: 'all'
        };
        this.isUserTriggered = false;
        this.init();
    }

    /*
     * Note about file loading:
     * - When opened as file:// (double-clicking HTML), browsers block fetch() due to CORS
     * - This is a security feature - browsers don't allow local file access from file:// URLs
     * - The File System Access API (File picker) works around this limitation
     * - For auto-loading to work, serve this file from a local web server
     */

    setupDragAndDrop() {
        const dropZone = document.getElementById('dataSource');
        
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });

        // Highlight drop zone when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
        });

        // Handle dropped files
        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleFiles(files);
        }, false);
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    generateHelperScript() {
        const batchScript = `@echo off
REM FPVTrackside Dashboard Auto-Sync Script
REM This script copies your FPVTrackside events data to the dashboard location

echo FPVTrackside Dashboard Data Sync
echo ================================

REM Check if FPVTrackside data exists
set "SOURCE_PATH=%LOCALAPPDATA%\\FPVTrackside\\events"
if not exist "%SOURCE_PATH%" (
echo Error: FPVTrackside events folder not found at:
echo %SOURCE_PATH%
echo.
echo Please make sure FPVTrackside is installed and has race data.
pause
exit /b 1
)

REM Get the directory where this script is located
set "DASHBOARD_PATH=%~dp0"

echo Source: %SOURCE_PATH%
echo Target: %DASHBOARD_PATH%
echo.

REM Copy the events data
echo Copying FPVTrackside events data...
robocopy "%SOURCE_PATH%" "%DASHBOARD_PATH%" *.json /S /NJH /NJS /NDL /NC /NS
if %errorlevel% leq 1 (
echo.
echo ✓ Data copied successfully!
echo.
echo You can now open the dashboard HTML file to see your data.
echo The dashboard will auto-load data when served from a local web server.
) else (
echo.
echo ✗ Error copying data. Error level: %errorlevel%
)

echo.
pause
`;

        // Create and download the batch file
        const blob = new Blob([batchScript], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sync-fpv-data.bat';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        // Show instructions
        document.getElementById('dataStatus').innerHTML = `
            <div style="color: #ffd93d;">📄 Helper script downloaded!</div>
            <div style="font-size: 0.9em; color: #888; margin-top: 5px;">
                1. Run "sync-fpv-data.bat" in the same folder as this HTML file<br/>
                2. It will copy your FPVTrackside data here automatically<br/>
                3. Then serve this folder with a local web server for auto-loading<br/>
                <button onclick="dashboard.generateServerScript()" style="margin-top: 8px; padding: 4px 8px; background: #333; border: 1px solid #555; color: #fff; border-radius: 3px; cursor: pointer; font-size: 0.8em;">
                    📁 Also generate local server script
                </button>
            </div>
        `;
    }

    generateServerScript() {
        const serverScript = `@echo off
REM FPVTrackside Dashboard Local Server
REM This script starts a simple web server to serve the dashboard

echo FPVTrackside Dashboard - Local Server
echo ======================================

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
echo Error: Python is not installed or not in PATH
echo.
echo Please install Python from: https://www.python.org/downloads/
echo Make sure to check "Add Python to PATH" during installation
pause
exit /b 1
)

REM Get the current directory
set "DASHBOARD_DIR=%~dp0"
cd /d "%DASHBOARD_DIR%"

echo Starting local web server at: http://localhost:8000
echo.
echo ✓ Dashboard will be available at: http://localhost:8000
echo ✓ Data auto-loading will work when served this way
echo.
echo Press Ctrl+C to stop the server
echo.

REM Start Python HTTP server
python -m http.server 8000

pause
`;

        // Create and download the server script
        const blob = new Blob([serverScript], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'start-dashboard-server.bat';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        // Update status
        document.getElementById('dataStatus').innerHTML = `
            <div style="color: #6bcf7f;">📄 Server script downloaded!</div>
            <div style="font-size: 0.9em; color: #888; margin-top: 5px;">
                Complete setup instructions:<br/>
                1. Run "sync-fpv-data.bat" to copy your race data<br/>
                2. Run "start-dashboard-server.bat" to serve the dashboard<br/>
                3. Open <a href="http://localhost:8000" style="color: #ffd93d;">http://localhost:8000</a> in your browser<br/>
                4. Dashboard will auto-load your data! 🚀
            </div>
        `;
    }

    init() {
        const loadDataBtn = document.getElementById('loadDataBtn');
        const browseBtn = document.getElementById('browseBtn');
        const fileInput = document.getElementById('fileInput');

        // Auto-load data on page load
        this.autoLoadData();

        loadDataBtn.addEventListener('click', () => {
            this.isUserTriggered = true;
            this.autoLoadData();
        });

        browseBtn.addEventListener('click', () => {
            fileInput.click();
        });

        const generateHelperBtn = document.getElementById('generateHelperBtn');
        generateHelperBtn.addEventListener('click', () => {
            this.generateHelperScript();
        });

        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Setup drag and drop
        this.setupDragAndDrop();

        // Setup filters
        document.querySelectorAll('.filter-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filterType = e.target.dataset.filter || e.target.dataset.valid;
                const filterGroup = e.target.dataset.filter ? 'eventType' : 'validOnly';
                
                // Update active state
                e.target.parentElement.querySelectorAll('.filter-button').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Update filter
                this.activeFilters[filterGroup] = filterType === 'all' ? 'all' : filterType;
                
                // Re-render
                this.renderDashboard();
            });
        });

        // Setup round selector
        document.getElementById('roundSelector').addEventListener('change', (e) => {
            this.activeFilters.roundFilter = e.target.value;
            this.renderDashboard();
        });

        // Setup tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                e.target.classList.add('active');
                document.getElementById(tabName).classList.add('active');
            });
        });
    }

    async autoLoadData() {
        const dataStatus = document.getElementById('dataStatus');
        
        // Try to load from server API first
        try {
            dataStatus.textContent = 'Loading FPVTrackside data from server...';
            await this.loadFromServerAPI();
            return;
        } catch (error) {
            console.log('Could not auto-load from server API:', error.message);
            
            // If server API fails and user clicked the button, try File System Access API
            if (this.isUserTriggered) {
                if ('showDirectoryPicker' in window) {
                    try {
                        const dirHandle = await window.showDirectoryPicker({
                            id: 'fpv-events',
                            mode: 'read',
                            startIn: 'documents'
                        });
                        
                        await this.loadFromDirectoryHandle(dirHandle);
                        return;
                    } catch (error) {
                        if (error.name !== 'AbortError') {
                            console.error('Directory picker error:', error);
                            this.showError('Error accessing directory: ' + error.message);
                        }
                        return;
                    }
                } else {
                    this.showError('File System Access API not supported. Please use "Browse for Folder" instead.');
                }
            } else {
                // Show instructions for initial load
                this.showInitialInstructions();
            }
        }
    }

    async loadFromServerAPI() {
        this.showLoading(true);
        this.hideError();
        
        try {
            // First check if server is available
            const healthResponse = await fetch('/api/health');
            if (!healthResponse.ok) {
                throw new Error('Server not available');
            }
            
            const healthData = await healthResponse.json();
            if (!healthData.dataPathFound) {
                throw new Error('FPVTrackside data directory not found on server');
            }
            
            // Load data from server API
            const response = await fetch('/api/data');
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Convert server data format to expected format
            const fileMap = {};
            
            // Process events
            if (data.events && data.events.length > 0) {
                fileMap['Event.json'] = data.events;
            }
            
            // Process pilots
            if (data.pilots && data.pilots.length > 0) {
                fileMap['Pilots.json'] = data.pilots;
            }
            
            // Process rounds
            if (data.rounds && data.rounds.length > 0) {
                fileMap['Rounds.json'] = data.rounds;
            }
            
            // Process races
            if (data.races && data.races.length > 0) {
                for (const race of data.races) {
                    if (race.race) {
                        fileMap[`${race.id}/Race.json`] = [race.race];
                    }
                    if (race.result) {
                        fileMap[`${race.id}/Result.json`] = [race.result];
                    }
                }
            }
            
            if (Object.keys(fileMap).length === 0) {
                throw new Error('No FPVTrackside data found');
            }
            
            await this.processEventData(fileMap);
            this.renderDashboard();
            
            document.getElementById('dataStatus').innerHTML = `
                <div style="color: #6bcf7f;">✅ FPVTrackside data loaded successfully</div>
                <div style="font-size: 0.9em; color: #888; margin-top: 5px;">
                    Auto-loaded from: <code style="background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 3px;">${healthData.dataPath}</code><br/>
                    <small style="color: #666;">Found ${data.events?.length || 0} events, ${data.pilots?.length || 0} pilots, ${data.races?.length || 0} races</small>
                </div>
            `;
            
        } catch (error) {
            throw error;
        } finally {
            this.showLoading(false);
        }
    }

    showInitialInstructions() {
        const dataStatus = document.getElementById('dataStatus');
        
        dataStatus.innerHTML = `
            <div style="color: #ffd93d;">📁 FPVTrackside data not found</div>
            <div style="font-size: 0.9em; color: #888; margin-top: 5px;">
                Server couldn't find FPVTrackside data in standard locations.<br/>
                Click "Load Event Data" to manually select your events folder<br/>
                <small style="color: #666;">Standard location: <code style="background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 3px;">%LOCALAPPDATA%\\FPVTrackside\\events</code></small>
            </div>
        `;
    }

    async loadFromDirectoryHandle(dirHandle) {
        this.showLoading(true);
        this.hideError();
        
        try {
            const fileMap = {};
            
            // Recursively read all JSON files
            await this.readDirectoryRecursive(dirHandle, '', fileMap);
            
            if (Object.keys(fileMap).length === 0) {
                throw new Error('No JSON files found in the selected directory');
            }
            
            // Store the directory handle for future use
            if (dirHandle.name) {
                localStorage.setItem('fpv-trackside-folder-name', dirHandle.name);
                localStorage.setItem('fpv-trackside-last-loaded', Date.now().toString());
            }
            
            await this.processEventData(fileMap);
            this.renderDashboard();
            
            const folderName = dirHandle.name || 'selected folder';
            document.getElementById('dataStatus').innerHTML = `
                <div style="color: #6bcf7f;">✓ Event data loaded successfully</div>
                <div style="font-size: 0.9em; color: #888; margin-top: 5px;">
                    Loaded ${Object.keys(fileMap).length} files from "${folderName}"<br/>
                    <small style="color: #666;">Folder will be remembered for next session</small>
                </div>
            `;
        } catch (error) {
            this.showError('Error loading data: ' + error.message);
            console.error(error);
        } finally {
            this.showLoading(false);
        }
    }

    async readDirectoryRecursive(dirHandle, path, fileMap) {
        for await (const [name, handle] of dirHandle.entries()) {
            const fullPath = path ? `${path}/${name}` : name;
            
            if (handle.kind === 'file' && name.endsWith('.json')) {
                const file = await handle.getFile();
                const content = await file.text();
                fileMap[fullPath] = JSON.parse(content);
            } else if (handle.kind === 'directory') {
                await this.readDirectoryRecursive(handle, fullPath, fileMap);
            }
        }
    }

    async loadFromRelativePath() {
        const eventFolder = 'ffc970eb-b4d6-4f27-bd0b-e7c5b08ee8c9';
        
        // Core files to load
        const coreFiles = [
            'Event.json',
            'Pilots.json', 
            'Rounds.json'
        ];
        
        const fileMap = {};
        let foundAny = false;
        
        // Load core files
        for (const filename of coreFiles) {
            try {
                const response = await fetch(`${eventFolder}/${filename}`);
                if (response.ok) {
                    const data = await response.json();
                    fileMap[filename] = data;
                    foundAny = true;
                }
            } catch (error) {
                console.log(`Could not load ${filename}:`, error.message);
            }
        }
        
        // Load race data from subfolders
        const raceFolders = [
            '059e9b16-9d1b-428b-8560-055679a96bc2',
            '09b0d827-07d5-4252-9907-4359a50ecd43',
            '0d374b3a-edb3-4c62-8cbe-fe2792d07685',
            '140da860-9c08-48e1-bb89-e2445a353a3e',
            '28bf04b2-00b8-46c9-9a5c-a934622c7f5a',
            '36bbc443-2681-437c-81fd-783ee789d80a',
            '3a13c854-2e66-448f-8885-2b0a8b1df736',
            '435c53a1-1b15-457d-8352-b22bba502bce',
            '45a3c721-3ab0-4dca-90f7-65a5127d6ef3',
            '5141fffd-95f6-4e70-add8-f998cc9c59eb',
            '57a6a3dc-3649-4215-a80f-82ad00b84913',
            '5b09711e-add0-4906-8d11-43e71597e76c',
            '5c5f879e-6f00-4ff8-a8ff-60dd4d82da49',
            '5fee59b8-1fc0-4fcf-babb-973f7625e3b9',
            '67b80149-ad0f-47c1-a1a2-d51724f04016',
            '69360ee3-d7b4-4537-971d-5d18073b4699',
            '7444ec03-4061-46eb-bc00-7dfbb3d8eb81',
            '78f5f6e1-7614-4b37-bf3a-c0a17f085e35',
            '79f91931-2def-489b-b28e-a0e63b889663',
            '7b8e8e85-63d4-445e-b82b-3200cc04fa59',
            '7e9c08b8-03f1-481e-a9a8-eac49e43802b',
            '90b4494a-6264-432f-8b0e-56f04eec2547',
            '9c7f44cb-0e74-46e0-b5fc-1728e0b02b7e',
            'a8bc9a28-d72c-4fb3-8f3a-cc45c349e2df',
            'ac670f57-dc38-4278-91f9-c4fbdce49599',
            'ad61dd8e-054a-4e0a-8199-722366b308ed',
            'ae5f0891-ec84-42fe-bc36-54bf286262f9',
            'b5f7a963-ddc6-497b-8167-5940492ae32c',
            'b6264aa5-cb27-45c8-beca-5c8339e457a0',
            'b93f4c69-f223-4772-bfb4-b1c40ca4aba8',
            'b9af2564-7f93-470d-beca-575cf6743826',
            'c611d97a-6792-4362-8590-d0b3d4afe066',
            'c7759e5a-f3ae-4618-9d78-380430b02f02',
            'd53acd9f-cf1d-4da1-a3ea-1002829d20c6',
            'd9dd0c75-fb2d-4d0b-af84-88cc990b18cf',
            'dba0c132-d4de-4048-a6ec-28a659cf4e8d',
            'dca312f6-3afc-49e7-9bb2-fbab60454975',
            'e639c332-e0bd-460b-9b56-47611fe2b521',
            'ed2e9db1-25f1-413b-abfc-f4a30ea5f593',
            'f09ce580-6517-48c4-909d-38608bf5f1fc',
            'f11fbddf-f076-42f8-8ed0-02e6d6a821db',
            'f19ff894-1937-43d6-aa57-c4d6fffdaaea',
            'f6ee897e-d6f2-4d55-bc48-6b9a96861bb5',
            'fc1bdeef-564f-4cc0-b212-753939166d8e'
        ];
        
        // Load race and result files
        for (const raceFolder of raceFolders) {
            const raceFiles = ['Race.json', 'Result.json'];
            
            for (const filename of raceFiles) {
                try {
                    const response = await fetch(`${eventFolder}/${raceFolder}/${filename}`);
                    if (response.ok) {
                        const data = await response.json();
                        fileMap[`${raceFolder}/${filename}`] = data;
                        foundAny = true;
                    }
                } catch (error) {
                    // Not all folders have both files, so this is expected
                    console.log(`Could not load ${raceFolder}/${filename}:`, error.message);
                }
            }
        }
        
        if (!foundAny) {
            throw new Error('No files could be loaded from the expected path');
        }
        
        this.showLoading(true);
        await this.processEventData(fileMap);
        this.renderDashboard();
        this.showLoading(false);
        
        const dataStatus = document.getElementById('dataStatus');
                            dataStatus.innerHTML = `
                <div style="color: #6bcf7f;">✓ Event data loaded successfully</div>
                <div style="font-size: 0.9em; color: #888; margin-top: 5px;">
                    Loaded ${Object.keys(fileMap).length} files from ${eventFolder}<br/>
                    <small style="color: #666;">Auto-loaded from local server</small>
                </div>
            `;
    }

    showAutoLoadInstructions() {
        const dataStatus = document.getElementById('dataStatus');
        dataStatus.innerHTML = `
            <div style="color: #ffd93d; margin-bottom: 10px;">⚠️ Automatic loading not available</div>
            <div style="font-size: 0.9em; line-height: 1.4;">
                To use auto-loading, either:<br>
                • Use a modern browser and click "Load Event Data" to select the folder<br>
                • Or click "Browse for Folder" to manually select your event data<br>
                • Or serve this file from a local web server in the same directory as your data
            </div>
        `;
    }

    async handleFiles(files) {
        this.showLoading(true);
        this.hideError();

        try {
            const fileMap = {};
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i].webkitGetAsEntry ? files[i].webkitGetAsEntry() : files[i];
                const path = file.webkitRelativePath || file.name;
                
                if (path.endsWith('.json')) {
                    const content = await this.readFile(files[i]);
                    fileMap[path] = JSON.parse(content);
                }
            }

            await this.processEventData(fileMap);
            this.renderDashboard();
        } catch (error) {
            this.showError('Error processing files: ' + error.message);
            console.error(error);
        } finally {
            this.showLoading(false);
        }
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    async processEventData(fileMap) {
        // Process Event.json
        const eventFile = Object.keys(fileMap).find(path => path.endsWith('Event.json'));
        if (eventFile) {
            this.eventData = fileMap[eventFile][0];
        }

        // Process pilots.json
        const pilotsFile = Object.keys(fileMap).find(path => path.endsWith('pilots.json') || path.endsWith('Pilots.json'));
        if (pilotsFile) {
            const pilotsData = fileMap[pilotsFile];
            pilotsData.forEach(pilot => {
                this.pilots[pilot.ID] = {
                    ...pilot,
                    races: [],
                    timeTrials: [],
                    laps: [],
                    results: [],
                    stats: {
                        totalRaces: 0,
                        totalTimeTrials: 0,
                        wins: 0,
                        podiums: 0,
                        dnfs: 0,
                        points: 0,
                        racePoints: 0,
                        bestLap: Infinity,
                        totalLaps: 0,
                        avgLap: 0,
                        positions: [],
                        lapTimes: []
                    }
                };
            });
        }

        // Process Rounds.json
        const roundsFile = Object.keys(fileMap).find(path => path.endsWith('Rounds.json'));
        if (roundsFile) {
            const roundsData = fileMap[roundsFile];
            roundsData.forEach(round => {
                this.rounds[round.ID] = round;
            });
        }

        // Process Result.json files
        const resultFiles = Object.keys(fileMap).filter(path => path.includes('Result.json'));
        resultFiles.forEach(resultPath => {
            const results = fileMap[resultPath];
            results.forEach(result => {
                this.results.push(result);
                const pilot = this.pilots[result.Pilot];
                if (pilot) {
                    pilot.results.push(result);
                    pilot.stats.points += result.Points || 0;
                    if (result.ResultType === 'Race') {
                        pilot.stats.racePoints += result.Points || 0;
                    }
                }
            });
        });

        // Process race files
        const raceFiles = Object.keys(fileMap).filter(path => path.includes('Race.json') && !path.includes('_Race.json'));
        
        for (const racePath of raceFiles) {
            const raceData = fileMap[racePath];
            if (raceData && raceData.length > 0) {
                const race = raceData[0];
                if (race.Valid) {
                    const processedRace = await this.processRace(race);
                    if (processedRace) {
                        this.races.push(processedRace);
                    }
                }
            }
        }

        // Calculate pilot statistics
        this.calculatePilotStats();
    }

    async processRace(race) {
        const round = this.rounds[race.Round];
        if (!round) return null;

        const detectionMap = {};
        race.Detections?.forEach(d => {
            detectionMap[d.ID] = d;
        });

        const raceLaps = [];
        const pilotLaps = {};

        race.Laps?.forEach(lap => {
            const detection = detectionMap[lap.Detection];
            if (!detection || !detection.Valid) return;

            const pilotId = detection.Pilot;
            if (!pilotLaps[pilotId]) {
                pilotLaps[pilotId] = [];
            }

            const lapData = {
                lapNumber: lap.LapNumber,
                length: lap.LengthSeconds,
                startTime: lap.StartTime,
                endTime: lap.EndTime,
                pilotId: pilotId,
                pilotName: this.pilots[pilotId]?.Name || 'Unknown',
                valid: detection.Valid
            };

            pilotLaps[pilotId].push(lapData);
            raceLaps.push(lapData);

            // Update pilot lap data
            if (this.pilots[pilotId]) {
                this.pilots[pilotId].laps.push({
                    ...lapData,
                    raceNumber: race.RaceNumber,
                    roundId: race.Round,
                    eventType: round.EventType
                });
                this.pilots[pilotId].stats.lapTimes.push(lap.LengthSeconds);
            }
        });

        // Get results for this race
        const raceResults = this.results.filter(r => r.Race === race.ID);
        
        return {
            id: race.ID,
            raceNumber: race.RaceNumber,
            roundId: race.Round,
            roundNumber: round.RoundNumber,
            eventType: round.EventType,
            valid: round.Valid,
            laps: raceLaps,
            pilotLaps: pilotLaps,
            results: raceResults,
            targetLaps: race.TargetLaps,
            startTime: race.Start,
            endTime: race.End
        };
    }

    calculatePilotStats() {
        // Process race results
        this.races.forEach(race => {
            race.results.forEach(result => {
                const pilot = this.pilots[result.Pilot];
                if (!pilot) return;

                if (race.eventType === 'Race') {
                    pilot.stats.totalRaces++;
                    pilot.stats.positions.push(result.Position);
                    
                    if (result.Position === 1) pilot.stats.wins++;
                    if (result.Position <= 3) pilot.stats.podiums++;
                    if (result.DNF) pilot.stats.dnfs++;
                    
                    pilot.races.push({
                        raceId: race.id,
                        raceNumber: race.raceNumber,
                        roundNumber: race.roundNumber,
                        position: result.Position,
                        points: result.Points,
                        dnf: result.DNF
                    });
                } else if (race.eventType === 'TimeTrial') {
                    pilot.stats.totalTimeTrials++;
                    pilot.timeTrials.push({
                        raceId: race.id,
                        raceNumber: race.raceNumber,
                        roundNumber: race.roundNumber,
                        laps: race.pilotLaps[result.Pilot] || []
                    });
                }
            });
        });

        // Calculate aggregate stats
        Object.values(this.pilots).forEach(pilot => {
            const validLaps = pilot.stats.lapTimes.filter(time => time > 0 && time < 200);
            
            if (validLaps.length > 0) {
                pilot.stats.bestLap = Math.min(...validLaps);
                pilot.stats.avgLap = validLaps.reduce((sum, time) => sum + time, 0) / validLaps.length;
                pilot.stats.totalLaps = validLaps.length;
            }
        });
    }

    getFilteredRaces() {
        return this.races.filter(race => {
            if (this.activeFilters.eventType !== 'all' && race.eventType !== this.activeFilters.eventType) {
                return false;
            }
            if (this.activeFilters.validOnly === 'true' && !race.valid) {
                return false;
            }
            if (this.activeFilters.roundFilter !== 'all' && race.id !== this.activeFilters.roundFilter) {
                return false;
            }
            return true;
        });
    }

    populateRoundSelector() {
        const selector = document.getElementById('roundSelector');
        const currentValue = selector.value;
        
        // Clear existing options except "All Rounds"
        selector.innerHTML = '<option value="all">All Rounds</option>';
        
        // Group races by round and event type
        const roundGroups = {};
        this.races.forEach(race => {
            const key = `${race.eventType}-R${race.roundNumber}`;
            if (!roundGroups[key]) {
                roundGroups[key] = {
                    eventType: race.eventType,
                    roundNumber: race.roundNumber,
                    races: []
                };
            }
            roundGroups[key].races.push(race);
        });
        
        // Sort rounds by event type and round number
        const sortedGroups = Object.values(roundGroups).sort((a, b) => {
            if (a.eventType !== b.eventType) {
                return a.eventType === 'Race' ? -1 : 1;
            }
            return a.roundNumber - b.roundNumber;
        });
        
        // Add options for each race
        sortedGroups.forEach(group => {
            group.races.forEach(race => {
                const option = document.createElement('option');
                option.value = race.id;
                option.textContent = `${race.eventType} R${race.roundNumber} - Race ${race.raceNumber}`;
                selector.appendChild(option);
            });
        });
        
        // Restore previous selection if it still exists
        if (currentValue && Array.from(selector.options).some(opt => opt.value === currentValue)) {
            selector.value = currentValue;
        }
    }

    renderDashboard() {
        document.getElementById('dashboard').classList.remove('hidden');
        setTimeout(() => {
            document.getElementById('dashboard').classList.add('show');
        }, 100);

        // Show event info
        if (this.eventData) {
            document.getElementById('eventInfo').textContent = this.eventData.Name || 'FPV Racing Event';
        }

        this.populateRoundSelector();
        this.renderStats();
        this.renderChampionshipStandings();
        this.renderPerformanceChart();
        this.renderPilotCards();
        this.renderRoundResults();
    }

    renderStats() {
        const filteredRaces = this.getFilteredRaces();
        const isRoundSpecific = this.activeFilters.roundFilter !== 'all';
        
        // Update title to reflect if we're showing round-specific data
        const eventInfo = document.getElementById('eventInfo');
        if (isRoundSpecific && this.eventData) {
            const selectedRace = this.races.find(r => r.id === this.activeFilters.roundFilter);
            if (selectedRace) {
                eventInfo.textContent = `${this.eventData.Name || 'FPV Racing Event'} - ${selectedRace.eventType} Round ${selectedRace.roundNumber}`;
            }
        } else if (this.eventData) {
            eventInfo.textContent = this.eventData.Name || 'FPV Racing Event';
        }

        // Get pilots that participated in filtered races
        let activePilots;
        if (isRoundSpecific) {
            const raceIds = filteredRaces.map(r => r.id);
            const raceResults = this.results.filter(r => raceIds.includes(r.Race));
            const participatingPilotIds = [...new Set(raceResults.map(r => r.Pilot))];
            activePilots = Object.values(this.pilots).filter(p => participatingPilotIds.includes(p.ID));
        } else {
            // Show all registered pilots (not just those with race results)
            activePilots = Object.values(this.pilots);
        }
        
        document.getElementById('totalPilots').textContent = activePilots.length;
        
        if (this.eventData && !isRoundSpecific) {
            document.getElementById('pilotsRegistered').textContent = `${this.eventData.PilotsRegistered} registered`;
        } else if (isRoundSpecific) {
            document.getElementById('pilotsRegistered').textContent = `in this round`;
        }

        const raceCount = filteredRaces.filter(r => r.eventType === 'Race').length;
        const ttCount = filteredRaces.filter(r => r.eventType === 'TimeTrial').length;
        
        document.getElementById('totalRaces').textContent = filteredRaces.length;
        if (isRoundSpecific) {
            const selectedRace = filteredRaces[0];
            document.getElementById('raceBreakdown').textContent = selectedRace ? `${selectedRace.eventType} Round ${selectedRace.roundNumber}` : '';
        } else {
            document.getElementById('raceBreakdown').textContent = `${raceCount} races, ${ttCount} time trials`;
        }
        
        const totalLaps = filteredRaces.reduce((sum, race) => sum + race.laps.length, 0);
        document.getElementById('totalLaps').textContent = totalLaps;
        document.getElementById('avgLapsPerRace').textContent = filteredRaces.length > 0 
            ? `${(totalLaps / filteredRaces.length).toFixed(1)} avg per race` 
            : '';

        // Fastest lap - from filtered races only
        let allLaps;
        if (isRoundSpecific) {
            allLaps = filteredRaces.flatMap(race => race.laps.map(lap => lap.length)).filter(time => time > 0 && time < 200);
        } else {
            allLaps = activePilots.flatMap(pilot => pilot.stats.lapTimes).filter(time => time > 0 && time < 200);
        }
        
        if (allLaps.length > 0) {
            const fastestTime = Math.min(...allLaps);
            let fastestPilot;
            
            if (isRoundSpecific) {
                // Find pilot with fastest lap in this round
                for (const race of filteredRaces) {
                    const fastestLap = race.laps.find(lap => lap.length === fastestTime);
                    if (fastestLap) {
                        fastestPilot = { Name: fastestLap.pilotName };
                        break;
                    }
                }
            } else {
                fastestPilot = activePilots.find(p => p.stats.bestLap === fastestTime);
            }
            
            document.getElementById('fastestLap').textContent = `${fastestTime.toFixed(3)}s`;
            document.getElementById('fastestPilot').textContent = fastestPilot ? `by ${fastestPilot.Name}` : '';
        }

        // Completion rate - from filtered races only
        let relevantResults;
        if (isRoundSpecific) {
            const raceIds = filteredRaces.map(r => r.id);
            relevantResults = this.results.filter(r => raceIds.includes(r.Race));
        } else {
            relevantResults = this.results.filter(r => r.ResultType === 'Race');
        }
        
        const totalStarts = relevantResults.length;
        const totalDNFs = relevantResults.filter(r => r.DNF).length;
        const completionRate = totalStarts > 0 ? ((totalStarts - totalDNFs) / totalStarts * 100).toFixed(1) : '-';
        const dnfRate = totalStarts > 0 ? (totalDNFs / totalStarts * 100).toFixed(1) : '-';
        
        document.getElementById('completionRate').textContent = completionRate + '%';
        document.getElementById('dnfRate').textContent = dnfRate + '%';

        // Average consistency - from participating pilots
        let consistencyLaps;
        if (isRoundSpecific) {
            consistencyLaps = filteredRaces.flatMap(race => 
                Object.values(race.pilotLaps).map(pilotLaps => 
                    pilotLaps.map(lap => lap.length).filter(time => time > 0 && time < 200)
                )
            );
        } else {
            consistencyLaps = activePilots.map(p => p.stats.lapTimes);
        }
        
        const consistencies = consistencyLaps.map(lapTimes => this.calculateConsistency(lapTimes)).filter(c => c !== '-');
        if (consistencies.length > 0) {
            const avgConsistency = consistencies.reduce((sum, c) => sum + parseFloat(c), 0) / consistencies.length;
            document.getElementById('avgConsistency').textContent = avgConsistency.toFixed(1) + '%';
        } else {
            document.getElementById('avgConsistency').textContent = '-';
        }
    }

    renderChampionshipStandings() {
        const filteredRaces = this.getFilteredRaces();
        const isRoundSpecific = this.activeFilters.roundFilter !== 'all';
        
        // Overall standings
        const tbody = document.querySelector('#championshipTable tbody');
        tbody.innerHTML = '';

        let sortedPilots;
        if (isRoundSpecific) {
            // Show round-specific results
            const raceIds = filteredRaces.map(r => r.id);
            const roundResults = this.results.filter(r => raceIds.includes(r.Race));
            const roundPilotStats = {};
            
            // Calculate stats for this round only
            roundResults.forEach(result => {
                const pilot = this.pilots[result.Pilot];
                if (!pilot) return;
                
                if (!roundPilotStats[result.Pilot]) {
                    roundPilotStats[result.Pilot] = {
                        pilot: pilot,
                        points: 0,
                        races: 0,
                        wins: 0,
                        podiums: 0,
                        dnfs: 0,
                        positions: [],
                        lapTimes: []
                    };
                }
                
                const stats = roundPilotStats[result.Pilot];
                stats.points += result.Points || 0;
                stats.races += 1;
                stats.positions.push(result.Position);
                
                if (result.Position === 1) stats.wins++;
                if (result.Position <= 3) stats.podiums++;
                if (result.DNF) stats.dnfs++;
                
                // Get lap times for this race
                const race = filteredRaces.find(r => r.id === result.Race);
                if (race && race.pilotLaps[result.Pilot]) {
                    stats.lapTimes.push(...race.pilotLaps[result.Pilot].map(lap => lap.length).filter(t => t > 0 && t < 200));
                }
            });
            
            sortedPilots = Object.values(roundPilotStats).sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.wins !== a.wins) return b.wins - a.wins;
                return b.podiums - a.podiums;
            });
        } else {
            // Show overall stats for all registered pilots
            sortedPilots = Object.values(this.pilots)
                .map(pilot => ({
                    pilot: pilot,
                    points: pilot.stats.points,
                    races: pilot.stats.totalRaces,
                    wins: pilot.stats.wins,
                    podiums: pilot.stats.podiums,
                    dnfs: pilot.stats.dnfs,
                    lapTimes: pilot.stats.lapTimes
                }))
                .sort((a, b) => {
                    if (b.points !== a.points) return b.points - a.points;
                    if (b.wins !== a.wins) return b.wins - a.wins;
                    return b.podiums - a.podiums;
                });
        }

        sortedPilots.forEach((pilotData, index) => {
            const pilot = pilotData.pilot;
            const consistency = this.calculateConsistency(pilotData.lapTimes);
            const consistencyClass = parseFloat(consistency) < 10 ? 'good' : parseFloat(consistency) < 20 ? 'warning' : '';
            
            const bestLap = pilotData.lapTimes.length > 0 ? Math.min(...pilotData.lapTimes) : Infinity;
            const avgLap = pilotData.lapTimes.length > 0 ? pilotData.lapTimes.reduce((sum, t) => sum + t, 0) / pilotData.lapTimes.length : 0;
            
            const row = tbody.insertRow();
            row.innerHTML = `
                <td class="position-${index + 1}">${index + 1}</td>
                <td style="font-weight: bold;">${pilot.Name}</td>
                <td>${pilotData.points}</td>
                <td>${pilotData.races}</td>
                <td>${pilotData.wins}</td>
                <td>${pilotData.podiums}</td>
                <td class="${pilotData.dnfs > 0 ? 'dnf' : ''}">${pilotData.dnfs}</td>
                <td class="lap-time ${bestLap < Infinity ? 'best-lap' : ''}">${
                    bestLap < Infinity ? bestLap.toFixed(3) + 's' : '-'
                }</td>
                <td class="lap-time">${avgLap > 0 ? avgLap.toFixed(3) + 's' : '-'}</td>
                <td>${consistency}<span class="metric-badge ${consistencyClass}">${
                    consistencyClass === 'good' ? 'Excellent' : consistencyClass === 'warning' ? 'Good' : 'Improving'
                }</span></td>
            `;
        });

        // Update section title
        const standingsTitle = document.getElementById('standingsTitle');
        if (isRoundSpecific) {
            const selectedRace = filteredRaces[0];
            if (selectedRace) {
                standingsTitle.textContent = `${selectedRace.eventType} Round ${selectedRace.roundNumber} Results`;
            }
        } else {
            standingsTitle.textContent = 'Championship Standings';
        }

        // Race standings
        this.renderRaceStandings();
        
        // Time trial standings
        this.renderTimeTrialStandings();
    }

    renderRaceStandings() {
        const tbody = document.querySelector('#raceStandingsTable tbody');
        tbody.innerHTML = '';

        const racePilots = Object.values(this.pilots)
            .filter(pilot => pilot.stats.totalRaces > 0)
            .sort((a, b) => {
                if (b.stats.racePoints !== a.stats.racePoints) return b.stats.racePoints - a.stats.racePoints;
                return b.stats.wins - a.stats.wins;
            });

        racePilots.forEach((pilot, index) => {
            const winRate = (pilot.stats.wins / pilot.stats.totalRaces * 100).toFixed(1);
            const avgPosition = pilot.stats.positions.length > 0 
                ? (pilot.stats.positions.reduce((sum, pos) => sum + pos, 0) / pilot.stats.positions.length).toFixed(1)
                : '-';
            const dnfRate = (pilot.stats.dnfs / pilot.stats.totalRaces * 100).toFixed(1);
            
            const row = tbody.insertRow();
            row.innerHTML = `
                <td class="position-${index + 1}">${index + 1}</td>
                <td style="font-weight: bold;">${pilot.Name}</td>
                <td>${pilot.stats.racePoints}</td>
                <td>${pilot.stats.totalRaces}</td>
                <td>${pilot.stats.wins}</td>
                <td>${winRate}%</td>
                <td>${avgPosition}</td>
                <td class="${parseFloat(dnfRate) > 20 ? 'dnf' : ''}">${dnfRate}%</td>
            `;
        });
    }

    renderTimeTrialStandings() {
        const tbody = document.querySelector('#timeTrialTable tbody');
        tbody.innerHTML = '';

        const ttPilots = Object.values(this.pilots)
            .filter(pilot => pilot.timeTrials.length > 0)
            .map(pilot => {
                const ttLaps = pilot.timeTrials.flatMap(tt => tt.laps);
                const bestConsecutive = this.findBestConsecutiveLaps(ttLaps, this.eventData?.PBLaps || 3);
                return { ...pilot, bestConsecutive };
            })
            .sort((a, b) => {
                if (!a.bestConsecutive && !b.bestConsecutive) return 0;
                if (!a.bestConsecutive) return 1;
                if (!b.bestConsecutive) return -1;
                return a.bestConsecutive.totalTime - b.bestConsecutive.totalTime;
            });

        ttPilots.forEach((pilot, index) => {
            const consistency = this.calculateConsistency(pilot.stats.lapTimes);
            const improvement = pilot.timeTrials.length > 1 ? this.calculateImprovement(pilot.timeTrials) : '-';
            
            const row = tbody.insertRow();
            row.innerHTML = `
                <td class="position-${index + 1}">${index + 1}</td>
                <td style="font-weight: bold;">${pilot.Name}</td>
                <td class="lap-time best-lap">${
                    pilot.bestConsecutive 
                        ? pilot.bestConsecutive.totalTime.toFixed(3) + 's' 
                        : '-'
                }</td>
                <td class="lap-time">${
                    pilot.stats.bestLap < Infinity ? pilot.stats.bestLap.toFixed(3) + 's' : '-'
                }</td>
                <td>${pilot.timeTrials.length}</td>
                <td>${improvement}</td>
                <td>${consistency}</td>
            `;
        });
    }

    findBestConsecutiveLaps(laps, count) {
        if (!laps || laps.length < count) return null;
        
        let bestTotal = Infinity;
        let bestLaps = null;
        
        for (let i = 0; i <= laps.length - count; i++) {
            const consecutive = laps.slice(i, i + count);
            const total = consecutive.reduce((sum, lap) => sum + (lap.length || 0), 0);
            
            if (total < bestTotal && total > 0) {
                bestTotal = total;
                bestLaps = consecutive;
            }
        }
        
        return bestLaps ? {
            laps: bestLaps,
            totalTime: bestTotal,
            avgTime: bestTotal / count
        } : null;
    }

    calculateImprovement(timeTrials) {
        if (timeTrials.length < 2) return '-';
        
        const firstTT = timeTrials[0];
        const lastTT = timeTrials[timeTrials.length - 1];
        
        const firstAvg = firstTT.laps.reduce((sum, lap) => sum + (lap.length || 0), 0) / firstTT.laps.length;
        const lastAvg = lastTT.laps.reduce((sum, lap) => sum + (lap.length || 0), 0) / lastTT.laps.length;
        
        const improvement = ((firstAvg - lastAvg) / firstAvg * 100).toFixed(1);
        return improvement > 0 ? `+${improvement}%` : `${improvement}%`;
    }

    calculateConsistency(lapTimes) {
        const validLaps = lapTimes.filter(time => time > 0 && time < 200);
        if (validLaps.length < 2) return '-';

        const mean = validLaps.reduce((sum, time) => sum + time, 0) / validLaps.length;
        const variance = validLaps.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / validLaps.length;
        const stdDev = Math.sqrt(variance);
        
        const consistency = (stdDev / mean) * 100;
        return consistency.toFixed(1);
    }

    renderPerformanceChart() {
        const ctx = document.getElementById('performanceChart').getContext('2d');
        
        // Destroy existing chart if it exists
        if (this.performanceChart) {
            this.performanceChart.destroy();
        }

        const topPilots = Object.values(this.pilots)
            .filter(pilot => pilot.stats.totalRaces > 2)
            .sort((a, b) => b.stats.points - a.stats.points)
            .slice(0, 8);

        const colors = [
            '#ff6b6b', '#ffd93d', '#6bcf7f', '#4ecdc4', '#45b7d1',
            '#f9a826', '#ee5a24', '#a55eea'
        ];

        const datasets = topPilots.map((pilot, index) => {
            const raceData = pilot.races.map((race, raceIndex) => ({
                x: raceIndex + 1,
                y: race.position,
                dnf: race.dnf
            }));

            return {
                label: pilot.Name,
                data: raceData,
                borderColor: colors[index % colors.length],
                backgroundColor: colors[index % colors.length] + '20',
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                tension: 0.2,
                pointStyle: raceData.map(d => d.dnf ? 'crossRot' : 'circle'),
                pointBackgroundColor: raceData.map(d => d.dnf ? '#ff4444' : colors[index % colors.length])
            };
        });

        this.performanceChart = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#fff',
                            padding: 10,
                            font: { size: 12 }
                        }
                    },
                    title: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const pilot = context.dataset.label;
                                const position = context.parsed.y;
                                const dnf = context.raw.dnf;
                                return `${pilot}: ${dnf ? 'DNF' : 'P' + position}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        display: true,
                        title: {
                            display: true,
                            text: 'Race Number',
                            color: '#888'
                        },
                        grid: {
                            color: '#333'
                        },
                        ticks: {
                            color: '#888',
                            stepSize: 1
                        }
                    },
                    y: {
                        display: true,
                        reverse: true,
                        title: {
                            display: true,
                            text: 'Position',
                            color: '#888'
                        },
                        grid: {
                            color: '#333'
                        },
                        ticks: {
                            color: '#888',
                            stepSize: 1,
                            callback: function(value) {
                                return 'P' + value;
                            }
                        },
                        min: 0.5,
                        max: Math.max(...topPilots.map(p => Math.max(...p.races.map(r => r.position)))) + 0.5
                    }
                }
            }
        });
    }

    renderPilotCards() {
        const pilotCards = document.getElementById('pilotCards');
        pilotCards.innerHTML = '';

        const topPilots = Object.values(this.pilots)
            .sort((a, b) => b.stats.points - a.stats.points)
            .slice(0, 8);

        topPilots.forEach((pilot, index) => {
            const card = document.createElement('div');
            card.className = 'pilot-card';
            
            const winRate = pilot.stats.totalRaces > 0 
                ? ((pilot.stats.wins / pilot.stats.totalRaces) * 100).toFixed(1) 
                : '0';
            const podiumRate = pilot.stats.totalRaces > 0 
                ? ((pilot.stats.podiums / pilot.stats.totalRaces) * 100).toFixed(1)
                : '0';
            const consistency = this.calculateConsistency(pilot.stats.lapTimes);
            const recentForm = this.getRecentForm(pilot);
            
            card.innerHTML = `
                <div class="pilot-header">
                    <div class="pilot-name">${pilot.Name}</div>
                    <div class="pilot-rank">#${index + 1} Overall</div>
                </div>
                <div class="pilot-stats">
                    <div class="pilot-stat">
                        <div style="font-size: 1.5em; font-weight: bold; color: #ff6b6b;">${pilot.stats.points}</div>
                        <div style="color: #888; font-size: 0.9em;">Total Points</div>
                    </div>
                    <div class="pilot-stat">
                        <div style="font-size: 1.5em; font-weight: bold; color: #ffd93d;">${pilot.stats.wins}</div>
                        <div style="color: #888; font-size: 0.9em;">Wins</div>
                    </div>
                    <div class="pilot-stat">
                        <div style="font-size: 1.5em; font-weight: bold; color: #6bcf7f;">${winRate}%</div>
                        <div style="color: #888; font-size: 0.9em;">Win Rate</div>
                    </div>
                    <div class="pilot-stat">
                        <div style="font-size: 1.5em; font-weight: bold; color: #4ecdc4;">${
                            pilot.stats.bestLap < Infinity ? pilot.stats.bestLap.toFixed(3) + 's' : '-'
                        }</div>
                        <div style="color: #888; font-size: 0.9em;">Best Lap</div>
                    </div>
                </div>
                <div style="margin-top: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <small style="color: #888;">Consistency</small>
                        <small style="color: #888;">${consistency}%</small>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${100 - Math.min(parseFloat(consistency) || 0, 100)}%"></div>
                    </div>
                </div>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #333;">
                    <small style="color: #888;">Recent Form: ${recentForm}</small>
                </div>
            `;
            
            pilotCards.appendChild(card);
        });
    }

    getRecentForm(pilot) {
        const recentRaces = pilot.races.slice(-5);
        if (recentRaces.length === 0) return 'No races yet';
        
        return recentRaces.map(race => {
            if (race.dnf) return '❌';
            if (race.position === 1) return '🥇';
            if (race.position === 2) return '🥈';
            if (race.position === 3) return '🥉';
            return race.position;
        }).join(' ');
    }

    renderRoundResults() {
        const roundResults = document.getElementById('roundResults');
        roundResults.innerHTML = '';

        const filteredRaces = this.getFilteredRaces();
        const isRoundSpecific = this.activeFilters.roundFilter !== 'all';
        
        // Update section title
        const roundResultsTitle = document.getElementById('roundResultsTitle');
        if (isRoundSpecific && filteredRaces.length > 0) {
            const selectedRace = filteredRaces[0];
            roundResultsTitle.textContent = `${selectedRace.eventType} Round ${selectedRace.roundNumber} - Detailed Results`;
        } else {
            roundResultsTitle.textContent = 'Round-by-Round Results';
        }
        
        const groupedByRound = {};
        
        filteredRaces.forEach(race => {
            const roundKey = `${race.eventType}_R${race.roundNumber}`;
            if (!groupedByRound[roundKey]) {
                groupedByRound[roundKey] = {
                    eventType: race.eventType,
                    roundNumber: race.roundNumber,
                    races: []
                };
            }
            groupedByRound[roundKey].races.push(race);
        });

        Object.values(groupedByRound).forEach(round => {
            round.races.forEach(race => {
                const raceCard = document.createElement('div');
                raceCard.className = 'race-card';
                
                // Highlight the selected race
                if (isRoundSpecific && race.id === this.activeFilters.roundFilter) {
                    raceCard.style.border = '2px solid #ff6b6b';
                    raceCard.style.boxShadow = '0 5px 20px rgba(255, 107, 107, 0.4)';
                }
                
                const typeClass = race.eventType === 'TimeTrial' ? 'timetrial' : '';
                
                let resultsHTML = '';
                if (race.results && race.results.length > 0) {
                    race.results
                        .sort((a, b) => a.Position - b.Position)
                        .forEach(result => {
                            const pilot = this.pilots[result.Pilot];
                            const pilotLaps = race.pilotLaps[result.Pilot] || [];
                            const bestLap = pilotLaps.length > 0 
                                ? Math.min(...pilotLaps.map(l => l.length).filter(t => t > 0))
                                : null;
                            
                            resultsHTML += `
                                <div style="display: flex; justify-content: space-between; margin: 8px 0; align-items: center;">
                                    <span class="${result.DNF ? 'dnf' : `position-${result.Position}`}">
                                        ${result.Position}. ${pilot?.Name || 'Unknown'}
                                        ${result.DNF ? ' (DNF)' : ''}
                                    </span>
                                    <div style="text-align: right;">
                                        ${bestLap ? `<span class="lap-time">${bestLap.toFixed(3)}s</span>` : ''}
                                        ${result.Points > 0 ? `<span style="color: #ffd93d; margin-left: 10px;">+${result.Points}pts</span>` : ''}
                                    </div>
                                </div>
                            `;
                        });
                } else {
                    resultsHTML = '<div style="color: #888; text-align: center; padding: 20px;">No results available</div>';
                }

                // Add lap times section for round-specific view
                let lapTimesHTML = '';
                if (isRoundSpecific && race.pilotLaps && Object.keys(race.pilotLaps).length > 0) {
                    lapTimesHTML = '<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #333;"><h4 style="color: #ff6b6b; margin-bottom: 10px;">Lap Times</h4>';
                    
                    Object.entries(race.pilotLaps).forEach(([pilotId, laps]) => {
                        const pilot = this.pilots[pilotId];
                        if (pilot && laps.length > 0) {
                            const validLaps = laps.filter(lap => lap.length > 0 && lap.length < 200);
                            const bestLap = validLaps.length > 0 ? Math.min(...validLaps.map(l => l.length)) : null;
                            
                            lapTimesHTML += `
                                <div style="margin-bottom: 10px;">
                                    <div style="font-weight: bold; color: #ffd93d;">${pilot.Name}</div>
                                    <div style="font-size: 0.9em; color: #aaa;">
                                        ${validLaps.length} laps • Best: ${bestLap ? bestLap.toFixed(3) + 's' : 'N/A'}
                                    </div>
                                    <div style="font-family: monospace; font-size: 0.8em; color: #888;">
                                        ${validLaps.slice(0, 10).map(l => l.length.toFixed(3)).join(' | ')}
                                        ${validLaps.length > 10 ? '...' : ''}
                                    </div>
                                </div>
                            `;
                        }
                    });
                    lapTimesHTML += '</div>';
                }

                raceCard.innerHTML = `
                    <div class="race-header">
                        <span class="race-number">Round ${race.roundNumber} - Race ${race.raceNumber}</span>
                        <span class="race-type ${typeClass}">${race.eventType}</span>
                    </div>
                    ${resultsHTML}
                    ${lapTimesHTML}
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #333;">
                        <small style="color: #666;">Target: ${race.targetLaps} laps • Total laps: ${race.laps.length}</small>
                    </div>
                `;
                
                roundResults.appendChild(raceCard);
            });
        });
    }

    showLoading(show) {
        document.getElementById('loading').classList.toggle('hidden', !show);
    }

    showError(message) {
        const errorEl = document.getElementById('error');
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }

    hideError() {
        document.getElementById('error').classList.add('hidden');
    }
}

// Initialize dashboard
const dashboard = new FPVDashboard();

// Make dashboard globally accessible for inline onclick handlers
window.dashboard = dashboard;
