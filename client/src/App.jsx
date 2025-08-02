import { useState, useEffect } from 'react';
import './App.css';

export default function App() {
  // API helper function
  const getApiUrl = (endpoint) => {
    const baseUrl = window.location.hostname === 'localhost' 
      ? '' 
      : 'https://videoclipper-backend.onrender.com';
    return `${baseUrl}/api/${endpoint}`;
  };

  const [url, setUrl] = useState('');
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(10);
  const [max, setMax] = useState(600);
  const [downloading, setDownloading] = useState(false);
  const [filename, setFilename] = useState('clip.mp4');
  const [filepath, setFilepath] = useState('');
  const [remainingTime, setRemainingTime] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStage, setDownloadStage] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);

  const formatTime = (seconds) => {
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const handleStartChange = (newStart) => {
    const minEnd = newStart + 3;
    if (minEnd <= end) {
      setStart(newStart);
    } else {
      setStart(newStart);
      setEnd(minEnd);
    }
  };

  const handleEndChange = (newEnd) => {
    const maxStart = newEnd - 3;
    if (maxStart >= start) {
      setEnd(newEnd);
    } else {
      setEnd(newEnd);
      setStart(maxStart);
    }
  };

  const pollDownloadProgress = () => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(getApiUrl('progress'));
        const data = await res.json();
        
        if (data.status === 'downloading') {
          setRemainingTime(data.remaining);
          setDownloadProgress(data.progress || 0);
          setDownloadStage(data.stage || 'downloading');
        } else if (data.status === 'completed') {
          clearInterval(interval);
          setRemainingTime(null);
          setDownloadProgress(100);
          setDownloadStage('completed');
        } else if (data.status === 'error') {
          clearInterval(interval);
          setRemainingTime(null);
          setDownloadProgress(0);
          setDownloadStage('error');
          alert('Download failed: ' + (data.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('Error polling progress:', error);
      }
    }, 1000);
  };

  const [showFolderPicker, setShowFolderPicker] = useState(false);

  const handleFolderPicker = () => {
    setShowFolderPicker(true);
  };

  const selectFolder = (folderPath) => {
    setFilepath(folderPath);
    setShowFolderPicker(false);
  };

  const commonFolders = [
    { name: 'Downloads', path: 'downloads', icon: '📁' },
    { name: 'Desktop', path: 'desktop', icon: '🖥️' },
    { name: 'Documents', path: 'documents', icon: '📄' },
    { name: 'Music', path: 'music', icon: '🎵' },
    { name: 'Videos', path: 'videos', icon: '🎬' },
    { name: 'Pictures', path: 'pictures', icon: '🖼️' },
    { name: 'Custom Path', path: 'custom', icon: '🔧' }
  ];

  const handleDownload = async () => {
    if (!url.trim()) {
      alert('Please enter a YouTube URL');
      return;
    }
    
    setDownloading(true);
    pollDownloadProgress();

    const res = await fetch(getApiUrl('download'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, start, end, filename, filepath }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      alert('Download failed: ' + errorText);
      setDownloading(false);
      return;
    }

    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setDownloading(false);
  };

  useEffect(() => {
    if (!url.includes('youtube.com')) {
      setVideoInfo(null);
      return;
    }

    const fetchDuration = async () => {
      try {
        const res = await fetch(getApiUrl('info'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });

        if (res.ok) {
          const data = await res.json();
          const duration = data.duration || 600;
          setMax(duration);
          setStart(0);
          setEnd(Math.min(10, duration));
          setVideoInfo(data);
        }
      } catch (error) {
        console.error('Error fetching video info:', error);
      }
    };

    const timeoutId = setTimeout(fetchDuration, 1000);
    return () => clearTimeout(timeoutId);
  }, [url]);

  const clipDuration = end - start;
  const isValidClip = clipDuration >= 3;

  return (
    <div className="app-container">
      <div className="header-section">
        <div className="liquid-logo">
          <div className="logo-core">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </div>
          <div className="liquid-ripple"></div>
          <div className="liquid-ripple"></div>
          <div className="liquid-ripple"></div>
        </div>
        <h1 className="liquid-title">YouTube Clip</h1>
        <p className="liquid-subtitle">Download and trim your favorite videos</p>
      </div>

      <div className="main-content">
        <div className="liquid-card input-card">
          <div className="card-glow"></div>
          <div className="input-group">
            <label htmlFor="url-input" className="liquid-label">
              <div className="label-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
                </svg>
              </div>
              YouTube URL
            </label>
            <div className="liquid-input-wrapper">
              <input
                id="url-input"
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="Paste YouTube link here..."
                className="liquid-input"
              />
              <div className="input-glow"></div>
            </div>
          </div>

          {videoInfo && (
            <div className="video-preview">
              <div className="video-thumbnail">
                <img 
                  src={`https://img.youtube.com/vi/${url.match(/[?&]v=([^&]+)/)?.[1]}/maxresdefault.jpg`} 
                  alt="Video thumbnail"
                  onError={(e) => {
                    e.target.src = `https://img.youtube.com/vi/${url.match(/[?&]v=([^&]+)/)?.[1]}/hqdefault.jpg`;
                  }}
                />
                <div className="play-overlay">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
                <div className="thumbnail-glow"></div>
              </div>
              <div className="video-details">
                <h3>{videoInfo.title || 'Video Title'}</h3>
                <p className="duration">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  {formatTime(max)}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="liquid-card timeline-card">
          <div className="card-glow"></div>
          <h2 className="liquid-heading">Clip Duration</h2>
          
          <div className="dual-slider-container">
            <div className="time-display-row">
              <div className="time-display start-time">
                <span className="time-label">Start</span>
                <span className="time-value">{formatTime(start)}</span>
              </div>
              <div className="time-display end-time">
                <span className="time-label">End</span>
                <span className="time-value">{formatTime(end)}</span>
              </div>
            </div>

            <div className="liquid-slider-wrapper">
              <div className="slider-track">
                <div 
                  className="slider-range" 
                  style={{
                    left: `${(start / max) * 100}%`,
                    width: `${((end - start) / max) * 100}%`
                  }}
                ></div>
                <input
                  type="range"
                  min={0}
                  max={max - 3}
                  step={1}
                  value={start}
                  onChange={e => handleStartChange(Number(e.target.value))}
                  className="slider-input start-slider"
                />
                <input
                  type="range"
                  min={3}
                  max={max}
                  step={1}
                  value={end}
                  onChange={e => handleEndChange(Number(e.target.value))}
                  className="slider-input end-slider"
                />
              </div>
            </div>

            <div className="clip-duration">
              <span className={`duration-text ${!isValidClip ? 'invalid' : ''}`}>
                {isValidClip ? `Total: ${formatTime(clipDuration)}` : `Minimum 3 seconds required`}
              </span>
            </div>
          </div>
        </div>

        <div className="liquid-card settings-card">
          <div className="card-glow"></div>
          <h2 className="liquid-heading">Settings</h2>
          
          <div className="settings-grid">
            <div className="setting-group">
              <label htmlFor="filename-input" className="liquid-label">Filename</label>
              <div className="liquid-input-wrapper">
                <input
                  id="filename-input"
                  type="text"
                  value={filename}
                  onChange={e => setFilename(e.target.value)}
                  placeholder="my-clip.mp4"
                  className="liquid-input"
                />
                <div className="input-glow"></div>
              </div>
            </div>

            <div className="setting-group">
              <label htmlFor="filepath-input" className="liquid-label">Save Location</label>
              <div className="folder-picker-wrapper">
                <div className="folder-display">
                  <span className="folder-path">
                    {filepath || 'Default downloads folder'}
                  </span>
                  <button 
                    type="button"
                    onClick={handleFolderPicker}
                    className="folder-picker-button"
                    disabled={downloading}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
                    </svg>
                    Browse
                  </button>
                </div>
                <div className="input-glow"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="liquid-card download-card">
          <div className="card-glow"></div>
          <button
            onClick={handleDownload}
            disabled={downloading || !url.trim() || !isValidClip}
            className={`liquid-button ${downloading ? 'downloading' : ''} ${!isValidClip ? 'disabled' : ''}`}
          >
            <div className="button-glow"></div>
            {downloading ? (
              <>
                <div className="liquid-spinner"></div>
                Downloading...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
                Download Clip
              </>
            )}
          </button>

          {downloading && (
            <div className="progress-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${downloadProgress}%` }}
                ></div>
              </div>
              <div className="progress-info">
                <span className="progress-stage">{downloadStage}</span>
                <span className="progress-percentage">{downloadProgress}%</span>
                {remainingTime !== null && (
                  <span className="progress-time">{remainingTime}s remaining</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Folder Picker Modal */}
      {showFolderPicker && (
        <div className="modal-overlay" onClick={() => setShowFolderPicker(false)}>
          <div className="folder-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select Save Location</h3>
              <button 
                className="modal-close"
                onClick={() => setShowFolderPicker(false)}
              >
                ×
              </button>
            </div>
            <div className="folder-list">
              {commonFolders.map((folder) => (
                <button
                  key={folder.path}
                  className="folder-option"
                  onClick={() => selectFolder(folder.path)}
                >
                  <span className="folder-icon">{folder.icon}</span>
                  <span className="folder-name">{folder.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}