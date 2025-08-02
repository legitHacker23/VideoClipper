const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { google } = require('googleapis');

// Configure Google OAuth Strategy
const configureGoogleAuth = (app) => {
  // Session configuration
  app.use(require('express-session')({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
  }));

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure Google Strategy
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

  // Serialize user for session
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  // Deserialize user from session
  passport.deserializeUser((user, done) => {
    done(null, user);
  });

  // Auth routes
  app.get('/auth/google', passport.authenticate('google'));

  app.get('/auth/google/callback', 
    passport.authenticate('google', { 
      failureRedirect: '/login',
      successRedirect: '/dashboard'
    })
  );

  app.get('/auth/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.redirect('/');
    });
  });

  // Check if user is authenticated
  app.get('/auth/status', (req, res) => {
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
};

// Create YouTube API client
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
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
};

module.exports = {
  configureGoogleAuth,
  createYouTubeClient,
  requireAuth
}; 