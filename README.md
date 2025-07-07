# FPV Trackside Dashboard

A web-based dashboard for viewing and analyzing FPVTrackside racing data. This Node.js server automatically loads your FPVTrackside event data and presents it in a beautiful, interactive dashboard.

## Features

- 🚀 **Auto-loading**: Automatically finds and loads FPVTrackside data from standard installation locations
- 📊 **Comprehensive Analytics**: Championship standings, race results, performance trends, and pilot statistics
- 🎯 **Real-time Data**: Serves data directly from your FPVTrackside installation
- 🌐 **Web-based**: Access from any browser on your network
- 🔄 **CORS Enabled**: API can be accessed from other applications

## Quick Start

### Prerequisites

- Node.js (version 14 or higher)
- FPVTrackside installed with race data

### Installation

1. **Clone or download this repository**

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Open your browser and navigate to:**
   ```
   http://localhost:3000
   ```

The dashboard will automatically detect and load your FPVTrackside data!

## How It Works

The server automatically searches for FPVTrackside data in these locations:
- `%USERPROFILE%\AppData\Local\FPVTrackside\events`
- Current project directory (if data was copied here)

If data is found, it will be automatically loaded when you visit the dashboard.

## API Endpoints

The server provides RESTful API endpoints with CORS enabled:

- `GET /api/health` - Server health and data path status
- `GET /api/events` - List all available events
- `GET /api/events/:eventId` - Get specific event data
- `GET /api/data` - Get all data (events, pilots, races, rounds)

### Example API Usage

```javascript
// Check if server and data are available
fetch('http://localhost:3000/api/health')
  .then(response => response.json())
  .then(data => console.log(data));

// Get all events
fetch('http://localhost:3000/api/events')
  .then(response => response.json())
  .then(events => console.log(events));

// Get all data
fetch('http://localhost:3000/api/data')
  .then(response => response.json())
  .then(data => console.log(data));
```

## Dashboard Features

### Championship Standings
- Overall points standings
- Race-only results
- Time trial standings
- Performance metrics

### Race Analytics
- Lap time analysis
- Consistency ratings
- DNF tracking
- Win/podium statistics

### Performance Trends
- Interactive charts showing pilot improvement over time
- Lap time progression
- Consistency metrics

### Pilot Analysis
- Individual pilot cards with detailed statistics
- Best lap times
- Recent form analysis
- Head-to-head comparisons

## Development

### Development Mode
```bash
npm run dev
```
This uses nodemon for automatic server restarts when files change.

### File Structure
```
FPVTracksideDashboard/
├── public/           # Static web files
│   ├── index.html   # Main dashboard page
│   ├── script.js    # Dashboard JavaScript
│   └── style.css    # Styling
├── server.js        # Node.js server
├── package.json     # Dependencies
└── README.md        # This file
```

## Troubleshooting

### Data Not Found
If the dashboard shows "FPVTrackside data not found":

1. **Check FPVTrackside Installation**: Ensure FPVTrackside is installed and has race data
2. **Verify Data Location**: Look for data in `%USERPROFILE%\AppData\Local\FPVTrackside\events`
3. **Manual Selection**: Click "Load Event Data" to manually select your events folder

### Server Won't Start
- Ensure Node.js is installed
- Check if port 3000 is available
- Run `npm install` to ensure dependencies are installed

### CORS Issues
The server includes CORS headers for all API endpoints. If you're accessing from a different origin, the API will work correctly.

## Network Access

To access the dashboard from other devices on your network:

1. Find your computer's IP address
2. Access the dashboard at `http://[YOUR_IP]:3000`
3. Ensure your firewall allows connections on port 3000

## License

MIT License - Feel free to modify and distribute as needed.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

Enjoy analyzing your FPV racing data! 🚁✨