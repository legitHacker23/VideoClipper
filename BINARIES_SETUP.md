# Binary Setup for YTClips Desktop

## Required Binaries

The Electron app requires `yt-dlp` and `ffmpeg` binaries to be placed in the `/bin` directory.

### Download Links

#### yt-dlp
- **macOS**: https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos
- **Windows**: https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe
- **Linux**: https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp

#### ffmpeg
- **macOS**: Download from https://evermeet.cx/ffmpeg/ or https://ffmpeg.org/download.html
- **Windows**: Download from https://ffmpeg.org/download.html
- **Linux**: Download from https://ffmpeg.org/download.html

### Setup Instructions

1. Download the appropriate binaries for your platform
2. Place them in the `/bin` directory with these exact names:
   - `yt-dlp_macos` (macOS)
   - `yt-dlp.exe` (Windows)
   - `ffmpeg-macos` (macOS)
   - `ffmpeg.exe` (Windows)

3. Make them executable:
   ```bash
   chmod +x bin/yt-dlp_macos bin/ffmpeg-macos
   ```

4. For Windows, ensure the .exe files are in the bin directory

### Testing

After placing the binaries, you can test the setup:

```bash
npm run dev
```

This should start:
- Vite dev server on :5173
- Express server on :3001  
- Electron window that loads the app

## Build

To create installers:

```bash
npm run build
```

This will create platform-specific installers in the `dist/` directory. 