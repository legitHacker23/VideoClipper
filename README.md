# YouTube Clip Downloader

A modern web application for downloading and trimming YouTube videos using yt-dlp.

## Features

- 🎥 Download YouTube videos with high quality
- ✂️ Trim videos using start/end timestamps
- 🎨 Beautiful, modern UI with liquid animations
- ⚡ Fast downloads using yt-dlp
- 📱 Responsive design

## Prerequisites

Before running this application, make sure you have the following installed:

1. **Node.js** (v16 or higher)
2. **yt-dlp** - YouTube downloader
   ```bash
   pip install yt-dlp
   ```
3. **ffmpeg** - For video processing
   ```bash
   # macOS
   brew install ffmpeg
   
   # Ubuntu/Debian
   sudo apt install ffmpeg
   
   # Windows
   # Download from https://ffmpeg.org/download.html
   ```

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd ytclips
   ```

2. Install server dependencies:
   ```bash
   npm install
   ```

3. Install client dependencies:
   ```bash
   cd client
   npm install
   ```

## Usage

1. Start the server:
   ```bash
   npm start
   ```

2. In a new terminal, start the frontend:
   ```bash
   cd client
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:5173`

4. Paste a YouTube URL and set your desired start/end times

5. Click "Download Clip" to get your trimmed video

## How It Works

The application uses:
- **yt-dlp** for downloading YouTube videos in the best available quality
- **ffmpeg** for trimming videos using the start/end parameters
- **React** frontend with a modern, animated UI
- **Express** backend API

The system downloads the full video first, then uses ffmpeg to create a clip from the specified start time to end time, ensuring high quality output.

## API Endpoints

- `POST /api/download` - Download and trim a video
  - Parameters: `url`, `start`, `end`, `filename`
- `POST /api/info` - Get video information
  - Parameters: `url`
- `POST /api/formats` - Get available video formats
  - Parameters: `url`
- `GET /api/progress` - Get download progress

## Troubleshooting

- **yt-dlp not found**: Make sure yt-dlp is installed and accessible from the command line
- **ffmpeg not found**: Install ffmpeg and ensure it's in your system PATH
- **Download fails**: Check that the YouTube URL is valid and the video is available

## License

ISC 