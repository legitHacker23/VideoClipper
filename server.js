import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(bodyParser.json());

// Global progress tracking
let downloadProgress = {
  status: 'idle',
  progress: 0,
  remaining: null,
  currentDownload: null
};

// Add CORS support for frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Check if yt-dlp is available
async function checkYtDlp() {
  try {
    await execAsync('yt-dlp --version');
    console.log('yt-dlp is available');
    return true;
  } catch (error) {
    console.error('yt-dlp not found. Please install it first:');
    console.error('pip install yt-dlp');
    console.error('or visit: https://github.com/yt-dlp/yt-dlp');
    return false;
  }
}

// Extract video ID from YouTube URL
function extractVideoId(url) {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

app.post('/api/download', async (req, res) => {
  try {
    const { url, filename = `video-${Date.now()}.mp4`, start = 0, end = 10, filepath } = req.body;
    
    // Initialize progress tracking
    downloadProgress = {
      status: 'downloading',
      progress: 0,
      remaining: null,
      currentDownload: filename,
      stage: 'downloading_video'
    };
    
    const baseFilePath = path.join(__dirname, 'downloads', path.parse(filename).name);
    
    if (!fs.existsSync(path.join(__dirname, 'downloads'))) {
      fs.mkdirSync(path.join(__dirname, 'downloads'));
    }

    // Check if yt-dlp is available
    if (!(await checkYtDlp())) {
      return res.status(500).json({ error: 'yt-dlp is not installed' });
    }

    // Extract video ID
    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    console.log('Processing video:', videoId, `(clip: ${start}s to ${end}s)`);

    // Always use the default downloads directory for temporary files and processing
    const tempDir = path.join(__dirname, 'downloads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const fullVideoPath = path.join(tempDir, `full-${filename}`);
    const tempOutputPath = path.join(tempDir, filename);
    
    // Determine the final output directory based on user selection (only for the final file)
    let finalOutputDir = tempDir; // Default to temp directory
    if (filepath && filepath.trim()) {
      const userHome = process.env.HOME || process.env.USERPROFILE;
      
      switch (filepath.toLowerCase()) {
        case 'downloads':
          finalOutputDir = path.join(userHome, 'Downloads');
          break;
        case 'desktop':
          finalOutputDir = path.join(userHome, 'Desktop');
          break;
        case 'documents':
          finalOutputDir = path.join(userHome, 'Documents');
          break;
        case 'music':
          finalOutputDir = path.join(userHome, 'Music');
          break;
        case 'videos':
          finalOutputDir = path.join(userHome, 'Videos');
          break;
        case 'pictures':
          finalOutputDir = path.join(userHome, 'Pictures');
          break;
        case 'custom':
          // For custom paths, we'll use the default downloads folder
          finalOutputDir = path.join(__dirname, 'downloads');
          break;
        default:
          // If it's a custom path, try to resolve it safely
          try {
            const customPath = path.resolve(filepath.trim());
            if (customPath.startsWith(userHome || __dirname)) {
              finalOutputDir = customPath;
            }
          } catch (error) {
            console.log('Invalid custom path, using default:', error.message);
          }
      }
      
      // Ensure the final output directory exists
      if (!fs.existsSync(finalOutputDir)) {
        try {
          fs.mkdirSync(finalOutputDir, { recursive: true });
        } catch (error) {
          console.log('Could not create final directory, using default:', error.message);
          finalOutputDir = tempDir;
        }
      }
    }
    
    const outputPath = path.join(finalOutputDir, filename);

    // Download the video using yt-dlp with best quality and progress tracking
    console.log('Downloading video with yt-dlp...');
    
    // Use spawn to capture real-time output
    const ytdlpProcess = spawn('yt-dlp', [
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--progress-template', 'download:%(progress.downloaded_bytes)s/%(progress.total_bytes)s/%(progress.speed)s/%(progress.eta)s',
      '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '--no-check-certificates',
      '--extractor-args', 'youtube:player_client=android',
      '-o', fullVideoPath,
      url
    ]);

    await new Promise((resolve, reject) => {
      ytdlpProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('yt-dlp output:', output);
        
        // Parse progress from yt-dlp output
        const progressMatch = output.match(/download:(\d+)\/(\d+)\/([^\/]+)\/(\d+)/);
        if (progressMatch) {
          const [, downloaded, total, speed, eta] = progressMatch;
          const progressPercent = Math.round((parseInt(downloaded) / parseInt(total)) * 100);
          
          downloadProgress = {
            ...downloadProgress,
            progress: progressPercent,
            downloaded: parseInt(downloaded),
            total: parseInt(total),
            speed: speed,
            remaining: parseInt(eta),
            stage: 'downloading_video'
          };
        }
      });

      ytdlpProcess.stderr.on('data', (data) => {
        console.log('yt-dlp stderr:', data.toString());
      });

      ytdlpProcess.on('close', async (code) => {
        if (code === 0) {
          console.log('yt-dlp download completed');
          resolve();
        } else {
          reject(new Error(`yt-dlp process exited with code ${code}`));
        }
      });
    });

    // Update progress for ffmpeg stage
    downloadProgress = {
      ...downloadProgress,
      stage: 'creating_clip',
      progress: 50
    };

    // Check if the file was downloaded
    if (!fs.existsSync(fullVideoPath)) {
      // yt-dlp might have added an extension, let's find the actual file
      const files = fs.readdirSync(path.join(__dirname, 'downloads'));
      const downloadedFile = files.find(file => file.startsWith(`full-${path.parse(filename).name}`));
      
      if (downloadedFile) {
        const actualPath = path.join(__dirname, 'downloads', downloadedFile);
        fs.renameSync(actualPath, fullVideoPath);
      } else {
        throw new Error('Video download failed - no file found');
      }
    }

    // Verify the file was downloaded correctly
    const stats = fs.statSync(fullVideoPath);
    if (stats.size === 0) {
      throw new Error('Downloaded file is empty');
    }
    console.log(`Downloaded file size: ${stats.size} bytes`);

                console.log('Creating clip...');
            const duration = end - start;
            await execAsync(`ffmpeg -i "${fullVideoPath}" -ss ${start} -t ${duration} -c copy "${tempOutputPath}"`);

            // Verify the clip was created
            const clipStats = fs.statSync(tempOutputPath);
            if (clipStats.size === 0) {
              throw new Error('Generated clip is empty');
            }
            console.log(`Clip file size: ${clipStats.size} bytes`);

            // Move the final file to the user's selected location
            let finalOutputPath = tempOutputPath;
            if (finalOutputDir !== tempDir) {
              console.log(`Moving file to: ${outputPath}`);
              fs.copyFileSync(tempOutputPath, outputPath);
              fs.unlinkSync(tempOutputPath); // Remove the temp file
              finalOutputPath = outputPath;
            }

            console.log('Clip created and moved to final location. Sending file...');

            // Update progress to completed
            downloadProgress = {
              status: 'completed',
              progress: 100,
              remaining: 0,
              stage: 'sending_file'
            };

            res.writeHead(200, {
              'Content-Type': 'video/mp4',
              'Content-Length': clipStats.size,
              'Content-Disposition': `attachment; filename="${filename}"`
            });

            fs.createReadStream(finalOutputPath).pipe(res);

            res.on('finish', () => {
              fs.unlink(fullVideoPath, () => {});
              // Only delete the final file if it's in the temp directory
              if (finalOutputDir === tempDir) {
                fs.unlink(outputPath, () => {});
              }
              console.log('Temporary files cleaned up');
              
              // Reset progress
              downloadProgress = {
                status: 'idle',
                progress: 0,
                remaining: null,
                currentDownload: null
              };
            });

  } catch (error) {
    console.error('Download error:', error);
    
    // Reset progress on error
    downloadProgress = {
      status: 'error',
      progress: 0,
      remaining: null,
      currentDownload: null,
      error: error.message
    };
    
    res.status(500).json({
      error: 'Download failed',
      details: error.message,
      stack: error.stack
    });
  }
});

// Simple endpoint to get video info
app.post('/api/info', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Check if yt-dlp is available
    if (!(await checkYtDlp())) {
      return res.status(500).json({ error: 'yt-dlp is not installed' });
    }

    // Get video info using yt-dlp
    const infoCommand = `yt-dlp --dump-json --user-agent "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" --no-check-certificates --extractor-args "youtube:player_client=android" --no-warnings --quiet "${url}"`;
    const { stdout } = await execAsync(infoCommand);
    
    const videoInfo = JSON.parse(stdout);
    
    res.json({
      success: true,
      title: videoInfo.title,
      duration: videoInfo.duration,
      author: videoInfo.uploader,
      viewCount: videoInfo.view_count,
      uploadDate: videoInfo.upload_date,
      description: videoInfo.description?.substring(0, 200) + '...',
      thumbnail: videoInfo.thumbnail
    });
  } catch (error) {
    console.error('Error in /api/info:', error);
    
    // If YouTube blocks the request, return a fallback response
    if (error.message.includes('Sign in to confirm you\'re not a bot') || error.message.includes('bot')) {
      res.json({
        success: true,
        title: 'Video Title (YouTube Bot Detection Active)',
        duration: 600,
        author: 'YouTube Channel',
        viewCount: 0,
        uploadDate: '20250101',
        description: 'YouTube is currently blocking automated requests. Please try again later or use a different video.',
        thumbnail: 'https://via.placeholder.com/480x360?text=Video+Unavailable'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to fetch video info',
        details: error.message 
      });
    }
  }
});

// Endpoint to get available formats
app.post('/api/formats', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Check if yt-dlp is available
    if (!(await checkYtDlp())) {
      return res.status(500).json({ error: 'yt-dlp is not installed' });
    }

    // Get available formats using yt-dlp
    const formatsCommand = `yt-dlp --list-formats --user-agent "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" --no-check-certificates --extractor-args "youtube:player_client=android" "${url}"`;
    const { stdout } = await execAsync(formatsCommand);
    
    // Parse the formats output
    const lines = stdout.split('\n').filter(line => line.trim());
    const formats = [];
    
    for (const line of lines) {
      // Skip header lines
      if (line.includes('ID') && line.includes('EXT')) continue;
      if (line.includes('---')) continue;
      
      const parts = line.split(/\s+/);
      if (parts.length >= 4) {
        formats.push({
          id: parts[0],
          extension: parts[1],
          resolution: parts[2],
          note: parts.slice(3).join(' ')
        });
      }
    }

    res.json({
      success: true,
      formats: formats
    });
  } catch (error) {
    console.error('Error in /api/formats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch video formats',
      details: error.message 
    });
  }
});

// Progress endpoint for frontend
app.get('/api/progress', (req, res) => {
  res.json(downloadProgress);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`yt-dlp Server running on port ${PORT}`);
  checkYtDlp(); // Check on startup
});