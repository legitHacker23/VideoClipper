import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import passport from 'passport';
import GoogleStrategy from 'passport-google-oauth20';
import session from 'express-session';
import { google } from 'googleapis';
import { PROXY_CONFIGS, PROXY_SETTINGS, getRandomUserAgent, validateProxyUrl } from './proxy-config.js';

// Make sure the pip‑installed yt‑dlp in ~/.local/bin is found first
process.env.PATH = `${process.env.HOME}/.local/bin:` + process.env.PATH;

// Load environment variables
dotenv.config();

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(bodyParser.json());

// Session configuration for OAuth
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: true,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    domain: process.env.NODE_ENV === 'production' ? '.onrender.com' : undefined
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Configure Google OAuth Strategy (only if credentials are available)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_REDIRECT_URI || "http://localhost:3001/auth/google/callback",
    scope: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ]
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Store tokens in user profile
      profile.accessToken = accessToken;
      profile.refreshToken = refreshToken;
      
      // Create or update user in your database here
      // For now, we'll just return the profile
      return done(null, profile);
    } catch (error) {
      return done(error, null);
    }
  }));
} else {
  console.warn('Google OAuth credentials not found. OAuth features will be disabled.');
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize user from session
passport.deserializeUser((user, done) => {
  done(null, user);
});

// Create YouTube API client helper
const createYouTubeClient = (accessToken) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.youtube({ version: 'v3', auth: oauth2Client });
};

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  console.log('requireAuth - checking authentication for:', req.path);
  console.log('Session authenticated:', req.isAuthenticated());
  console.log('Authorization header:', req.headers.authorization);
  
  // Check if user is authenticated via session
  if (req.isAuthenticated()) {
    console.log('User authenticated via session');
    return next();
  }
  
  // Check if user is authenticated via token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    console.log('Checking token:', token);
    const userData = tokenStore.get(token);
    if (userData) {
      console.log('User authenticated via token:', userData.displayName);
      // Add user info to request for API endpoints
      req.user = {
        id: userData.userId,
        displayName: userData.displayName,
        email: userData.email,
        accessToken: userData.accessToken
      };
      return next();
    } else {
      console.log('Token not found in store');
    }
  } else {
    console.log('No authorization header or invalid format');
  }
  
  console.log('Authentication failed');
  res.status(401).json({ error: 'Authentication required' });
};

// Global progress tracking
let downloadProgress = {
  status: 'idle',
  progress: 0,
  remaining: null,
  currentDownload: null
};

// In-memory token store for frontend authentication
const tokenStore = new Map();

// Add CORS support for frontend
app.use((req, res, next) => {
  // Allow specific origins for credentials
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://viralclipper.netlify.app'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
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

// OAuth Routes (only if OAuth is configured)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  app.get('/auth/google', passport.authenticate('google'));

  app.get('/auth/google/callback', 
    passport.authenticate('google', { 
      failureRedirect: '/login'
    }), (req, res) => {
      console.log('OAuth callback completed, user:', req.user ? req.user.displayName : 'No user');
      console.log('Session ID:', req.sessionID);
      console.log('Is authenticated:', req.isAuthenticated());
      console.log('Session data:', req.session);
      
      // Generate a temporary token for the frontend
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Store the token in memory and session
      tokenStore.set(token, {
        userId: req.user.id,
        displayName: req.user.displayName,
        email: req.user.emails?.[0]?.value,
        accessToken: req.user.accessToken
      });
      req.session.frontendToken = token;
      req.session.userId = req.user.id;
      
      // Save session before redirect
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
        } else {
          console.log('Session saved successfully with token:', token);
        }
        
        // Redirect to frontend with token
        const frontendUrl = process.env.NODE_ENV === 'production' 
          ? `https://viralclipper.netlify.app/?token=${token}`
          : `http://localhost:5173/?token=${token}`;
        
        console.log('Redirecting to frontend with token:', frontendUrl);
        res.redirect(frontendUrl);
      });
    }
  );
} else {
  // Fallback routes when OAuth is not configured
  app.get('/auth/google', (req, res) => {
    res.status(503).json({ error: 'OAuth not configured' });
  });

  app.get('/auth/google/callback', (req, res) => {
    res.status(503).json({ error: 'OAuth not configured' });
  });
}

app.get('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.redirect('/');
  });
});

// Redirect to frontend after OAuth success
app.get('/dashboard', (req, res) => {
  const frontendUrl = process.env.NODE_ENV === 'production' 
    ? 'https://viralclipper.netlify.app/'
    : 'http://localhost:5173/';
  console.log('Redirecting to frontend:', frontendUrl);
  res.redirect(frontendUrl);
});

// Redirect to frontend login page
app.get('/login', (req, res) => {
  const frontendUrl = process.env.NODE_ENV === 'production' 
    ? 'https://viralclipper.netlify.app/'
    : 'http://localhost:5173/';
  console.log('Redirecting to frontend (login):', frontendUrl);
  res.redirect(frontendUrl);
});

// Check authentication status
app.get('/auth/status', (req, res) => {
  console.log('Auth status check - Session ID:', req.sessionID);
  console.log('Is authenticated:', req.isAuthenticated());
  console.log('User:', req.user ? req.user.displayName : 'No user');
  console.log('Origin:', req.headers.origin);
  console.log('Cookie header:', req.headers.cookie ? 'Present' : 'Missing');
  
  if (req.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: {
        id: req.user.id,
        displayName: req.user.displayName,
        email: req.user.emails?.[0]?.value
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Verify frontend token
app.get('/auth/verify-token', (req, res) => {
  const { token } = req.query;
  console.log('Token verification request for token:', token);
  
  if (!token) {
    return res.json({ authenticated: false, error: 'No token provided' });
  }
  
  // Check in-memory token store
  const userData = tokenStore.get(token);
  if (userData) {
    console.log('Token verified successfully from memory store');
    res.json({
      authenticated: true,
      user: {
        id: userData.userId,
        displayName: userData.displayName,
        email: userData.email
      }
    });
  } else {
    console.log('Token verification failed - token not found in memory store');
    console.log('Available tokens:', Array.from(tokenStore.keys()));
    res.json({ authenticated: false, error: 'Invalid token' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    oauth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    environment: process.env.NODE_ENV || 'development'
  });
});

// OAuth-protected video info endpoint using YouTube Data API
app.post('/api/info-oauth', requireAuth, async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    // Create YouTube client with user's access token
    const youtube = createYouTubeClient(req.user.accessToken);

    // Get video details using YouTube Data API
    const response = await youtube.videos.list({
      part: 'snippet,contentDetails,statistics',
      id: videoId
    });

    if (!response.data.items || response.data.items.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const video = response.data.items[0];
    const snippet = video.snippet;
    const contentDetails = video.contentDetails;
    const statistics = video.statistics;

    // Convert duration from ISO 8601 to seconds
    const durationMatch = contentDetails.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    const hours = parseInt(durationMatch[1] || 0);
    const minutes = parseInt(durationMatch[2] || 0);
    const seconds = parseInt(durationMatch[3] || 0);
    const durationInSeconds = hours * 3600 + minutes * 60 + seconds;

    res.json({
      success: true,
      title: snippet.title,
      duration: durationInSeconds,
      author: snippet.channelTitle,
      viewCount: parseInt(statistics.viewCount || 0),
      uploadDate: snippet.publishedAt.split('T')[0].replace(/-/g, ''),
      description: snippet.description?.substring(0, 200) + '...',
      thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url
    });

  } catch (error) {
    console.error('Error in /api/info-oauth:', error);
    
    if (error.code === 401) {
      res.status(401).json({ 
        error: 'YouTube access token expired. Please sign in again.',
        type: 'token_expired'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to fetch video info',
        details: error.message 
      });
    }
  }
});

// Add proxy configuration and retry logic
// Function to test proxy connectivity
async function testProxy(proxyUrl) {
  try {
    const testProcess = spawn('curl', [
      '--proxy', proxyUrl,
      '--connect-timeout', '10',
      '--max-time', '30',
      'https://www.youtube.com'
    ]);
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        testProcess.kill();
        resolve(false);
      }, PROXY_SETTINGS.testTimeout);
      
      testProcess.on('close', (code) => {
        clearTimeout(timeout);
        resolve(code === 0);
      });
    });
  } catch (error) {
    return false;
  }
}

// Function to get a working proxy
async function getWorkingProxy() {
  const proxyFromEnv = process.env.YTDLP_PROXY;
  if (proxyFromEnv) {
    console.log('Using proxy from environment variable');
    return { proxy: proxyFromEnv, name: 'env' };
  }
  
  // Test proxies in parallel
  const proxyTests = PROXY_CONFIGS.map(async (config) => {
    const isWorking = await testProxy(config.proxy);
    return { ...config, isWorking };
  });
  
  const results = await Promise.all(proxyTests);
  const workingProxies = results.filter(r => r.isWorking);
  
  if (workingProxies.length > 0) {
    const selectedProxy = workingProxies[Math.floor(Math.random() * workingProxies.length)];
    console.log(`Selected working proxy: ${selectedProxy.name}`);
    return selectedProxy;
  }
  
  console.log('No working proxies found, will try without proxy');
  return null;
}

// Function to get a random proxy from the list (fallback)
function getRandomProxy() {
  const proxyFromEnv = process.env.YTDLP_PROXY;
  if (proxyFromEnv) {
    return { proxy: proxyFromEnv, name: 'env' };
  }
  
  if (PROXY_CONFIGS.length > 0) {
    return PROXY_CONFIGS[Math.floor(Math.random() * PROXY_CONFIGS.length)];
  }
  
  return null;
}

// Function to download with yt-dlp with retry logic
async function downloadWithYtDlp(url, outputPath, maxRetries = PROXY_SETTINGS.maxRetries) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Download attempt ${attempt}/${maxRetries}`);
      
      const proxyConfig = await getWorkingProxy();
      const userAgent = getRandomUserAgent();
      
      const ytDlpArgs = [
        '-f', 'best[ext=mp4]/best',
        '--merge-output-format', 'mp4',
        '--progress-template', 'download:%(progress.downloaded_bytes)s/%(progress.total_bytes)s/%(progress.speed)s/%(progress.eta)s',
        '--user-agent', userAgent,
        '--add-header', 'Accept-Language:en-US,en;q=0.9',
        '--add-header', 'Accept-Encoding:gzip, deflate, br',
        '--add-header', 'DNT:1',
        '--add-header', 'Connection:keep-alive',
        '--add-header', 'Upgrade-Insecure-Requests:1',
        '--add-header', 'Sec-Fetch-Dest:document',
        '--add-header', 'Sec-Fetch-Mode:navigate',
        '--add-header', 'Sec-Fetch-Site:none',
        '--add-header', 'Sec-Fetch-User:?1',
        '--add-header', 'Cache-Control:max-age=0',
        '--no-check-certificates',
        '--retries', '3',
        '--fragment-retries', '3',
        '--sleep-interval', '2',
        '--max-sleep-interval', '5',
        '--throttledratelimit', '100000',
        '--concurrent-fragments', '1',
        '--max-downloads', '1',
        '--no-playlist',
        '--no-warnings',
        '--quiet',
        '-o', outputPath,
        url
      ];

      // Add proxy if available
      if (proxyConfig) {
        console.log(`Using proxy: ${proxyConfig.name}`);
        ytDlpArgs.unshift('--proxy', proxyConfig.proxy);
      } else {
        console.log('No proxy configured, using direct connection');
      }

      const ytdlpProcess = spawn('yt-dlp', ytDlpArgs);

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

      // If we get here, download was successful
      return;
      
    } catch (error) {
      lastError = error;
      console.log(`Download attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        const delay = PROXY_SETTINGS.retryDelay * attempt; // Exponential backoff
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`All download attempts failed. Last error: ${lastError.message}`);
}

// OAuth-protected download endpoint
app.post('/api/download-oauth', requireAuth, async (req, res) => {
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
    const tempOutputPath = path.join(tempDir, `clip-${filename}`);
    
    // Determine final output directory
    const finalOutputDir = filepath ? path.dirname(filepath) : tempDir;
    const outputPath = filepath || path.join(tempDir, filename);
    
    // Ensure output directory exists
    if (!fs.existsSync(finalOutputDir)) {
      fs.mkdirSync(finalOutputDir, { recursive: true });
    }

    // Download video using YouTube Data API + direct download
    console.log('Getting video URL from YouTube Data API...');
    
    // Create YouTube client with user's access token
    const youtube = createYouTubeClient(req.user.accessToken);
    
    // Get video details and streaming URLs
    const response = await youtube.videos.list({
      part: 'snippet,contentDetails',
      id: videoId
    });

    if (!response.data.items || response.data.items.length === 0) {
      throw new Error('Video not found or access denied');
    }

    // For now, let's try a different approach - use yt-dlp with better user agent and headers
    console.log('Downloading video with yt-dlp (with improved settings)...');
    
    await downloadWithYtDlp(url, fullVideoPath);

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

    // Create clip using ffmpeg
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

// Progress endpoint for frontend
app.get('/api/progress', (req, res) => {
  res.json(downloadProgress);
});

// Modified original endpoints that require authentication
app.post('/api/download', async (req, res) => {
  res.status(401).json({ 
    error: 'Authentication required. Please use /api/download-oauth with Google OAuth.',
    type: 'auth_required'
  });
});

app.post('/api/info', async (req, res) => {
  res.status(401).json({ 
    error: 'Authentication required. Please use /api/info-oauth with Google OAuth.',
    type: 'auth_required'
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Video Clipper Server running on port ${PORT}`);
  console.log(`OAuth enabled: ${!!process.env.GOOGLE_CLIENT_ID}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Auth status: http://localhost:${PORT}/auth/status`);
  checkYtDlp(); // Check on startup
});