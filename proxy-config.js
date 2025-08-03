// Proxy configuration for yt-dlp
// This file contains proxy settings to help bypass YouTube's anti-bot measures

export const PROXY_CONFIGS = [
  // ===== PAID SERVICES (NOT FREE) =====
  // These require signup and payment, but are reliable for production use:
  // - ScrapingBee: https://www.scrapingbee.com/ (starts at $49/month)
  // - ZenRows: https://www.zenrows.com/ (starts at $29/month)  
  // - Bright Data: https://brightdata.com/ (starts at $500/month)
  
  // Example configurations (replace with your actual proxy URLs):
  // { proxy: 'http://username:password@proxy.scrapingbee.com:8080', name: 'scrapingbee' },
  // { proxy: 'http://username:password@proxy.zenrows.com:8001', name: 'zenrows' },
  // { proxy: 'http://username:password@proxy.brightdata.com:22225', name: 'brightdata' },
  
  // ===== FREE ALTERNATIVES =====
  // These are free but less reliable. They may not always work:
  
  // Free proxy list (updated regularly)
  { proxy: 'http://185.199.229.156:7492', name: 'free_proxy_1' },
  { proxy: 'http://185.199.228.220:7492', name: 'free_proxy_2' },
  { proxy: 'http://185.199.231.45:7492', name: 'free_proxy_3' },
  { proxy: 'http://185.199.230.102:7492', name: 'free_proxy_4' },
  
  // Additional free proxies (may be unreliable)
  { proxy: 'http://103.149.162.194:80', name: 'free_proxy_5' },
  { proxy: 'http://103.149.162.195:80', name: 'free_proxy_6' },
  { proxy: 'http://103.149.162.196:80', name: 'free_proxy_7' },
  
  // ===== NO PROXY OPTION =====
  // If you want to try without any proxy (may work in some cases)
  // { proxy: null, name: 'direct_connection' },
];

// Environment variable for proxy configuration
// Set YTDLP_PROXY in your environment to use a specific proxy
// Example: export YTDLP_PROXY="http://username:password@proxy.example.com:8080"

export const PROXY_SETTINGS = {
  // Timeout settings for proxy testing
  testTimeout: 15000, // 15 seconds
  
  // Retry settings
  maxRetries: 3,
  retryDelay: 2000, // 2 seconds base delay
  
  // Rate limiting
  requestsPerMinute: 10,
  
  // User agents to rotate
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  ]
};

// Function to get a random user agent
export function getRandomUserAgent() {
  return PROXY_SETTINGS.userAgents[Math.floor(Math.random() * PROXY_SETTINGS.userAgents.length)];
}

// Function to validate proxy URL format
export function validateProxyUrl(proxyUrl) {
  try {
    const url = new URL(proxyUrl);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
} 