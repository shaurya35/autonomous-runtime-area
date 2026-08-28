const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ========================================
// FAILURE CONFIGURATION
// ========================================
const env = process.env;

const normalize = (value) => String(value || '').trim();

const failureEnabled = normalize(env.FAILURE_INJECTION).toLowerCase() === 'true';
const failureScenario = normalize(env.FAILURE_SCENARIO).toLowerCase();
const failureDelayMs = parseInt(normalize(env.FAILURE_DELAY_MS) || '0', 10) || 0;

const isFailureMode = () => failureEnabled;
const getFailureScenario = () => failureScenario;
const getFailureDelayMs = () => failureDelayMs;

const shouldFailRoute = (routeType) => {
  if (!failureEnabled) return false;
  const routeMap = {
    auth: ['auth-server-error', 'auth-invalid-credentials', 'jwt-invalid', 'auth-route-error', 'debug-prod'],
    favorites: ['favorites-service-down', 'auth-server-error', 'auth-invalid-credentials', 'jwt-invalid', 'redis-down', 'debug-prod'],
    db: ['db-wrong-name', 'db-unreachable'],
  };
  return routeMap[routeType]?.includes(failureScenario) ?? false;
};

const getMongoUri = () => {
  const uri = env.MONGODB_URI || 'mongodb://localhost:27017/moviebox';
  if (!failureEnabled) return uri;
  if (failureScenario === 'db-wrong-name') {
    return uri.replace(/\/([^/?]+)(\?|$)/, '/moviebox_broken$2');
  }
  return uri;
};

const getJwtVerifySecret = () => {
  if (failureEnabled && failureScenario === 'jwt-invalid') {
    return `${env.JWT_SECRET || 'secret'}_invalid`;
  }
  return env.JWT_SECRET || 'your-secret-key';
};

// ========================================
// LOGGER
// ========================================
const logger = {
  info: (msg, data) => console.log(`[INFO] ${msg}`, data ? JSON.stringify(data) : ''),
  warn: (msg, data) => console.warn(`[WARN] ${msg}`, data ? JSON.stringify(data) : ''),
  error: (msg, data) => console.error(`[ERROR] ${msg}`, data ? JSON.stringify(data) : ''),
};

// ========================================
// SESSION CACHE
// ========================================
class SessionCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.accessOrder = [];
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
    }
    this.cache.set(key, value);
    this.accessOrder.push(key);

    // SRE-0016: Simulate memory leak by not evicting old items
    if (isFailureMode() && getFailureScenario() === 'memory-leak-cache') {
      return;
    }

    if (this.cache.size > this.maxSize) {
      const oldestKey = this.accessOrder.shift();
      this.cache.delete(oldestKey);
    }
  }

  get(key) {
    if (this.cache.has(key)) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      this.accessOrder.push(key);
      return this.cache.get(key);
    }
    return null;
  }

  delete(key) {
    this.cache.delete(key);
    this.accessOrder = this.accessOrder.filter(k => k !== key);
  }

  size() {
    return this.cache.size;
  }
}

const sessionCache = new SessionCache(parseInt(process.env.SESSION_CACHE_SIZE || '100', 10));

// ========================================
// FAILURE INJECTION MIDDLEWARE
// ========================================
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const injectFailure = (routeType) => async (req, res, next) => {
  if (!isFailureMode()) {
    return next();
  }

  const delayMs = getFailureDelayMs();
  if (delayMs > 0) {
    await delay(delayMs);
  }

  if (!shouldFailRoute(routeType)) {
    return next();
  }

  const scenario = getFailureScenario();
  res.set('X-Failure-Scenario', scenario);

  switch (scenario) {
    case 'auth-server-error':
      return res.status(500).json({ message: 'Simulated authentication service failure' });
    case 'auth-invalid-credentials':
      return res.status(401).json({ message: 'Simulated invalid credentials' });
    case 'jwt-invalid':
      return next();
    case 'favorites-service-down':
      return res.status(503).json({ message: 'Simulated favorites service unavailable' });
    case 'redis-down':
      return res.status(503).json({ message: 'Simulated Redis service down - circuit breaker open' });
    case 'debug-prod':
      return next();
    case 'auth-route-error':
      throw new Error('Simulated route failure');
    default:
      return next();
  }
};

// ========================================
// EXPRESS MIDDLEWARE
// ========================================
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// ========================================
// MONGODB CONNECTION
// ========================================
mongoose.connect(getMongoUri(), {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  logger.info('MongoDB connected');
})
.catch(err => {
  logger.error('MongoDB connection failed', { error: err.message });
});

// ========================================
// USER SCHEMA
// ========================================
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  favorites: [{ type: Number }],
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// ========================================
// AUTH MIDDLEWARE
// ========================================
const authenticateToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Access denied' });

  try {
    const verified = jwt.verify(token, getJwtVerifySecret());
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ message: 'Invalid token' });
  }
};

// ========================================
// ROUTES
// ========================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    failureMode: isFailureMode(),
    failureScenario: getFailureScenario(),
  });
});

// Register
app.post('/api/auth/register', injectFailure('auth'), async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      username,
      email,
      password: hashedPassword,
      favorites: []
    });

    await user.save();

    const token = jwt.sign(
      { _id: user._id, username: user.username },
      getJwtVerifySecret()
    );

    res.status(201).json({
      token,
      user: { _id: user._id, username: user.username, email: user.email }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login
app.post('/api/auth/login', injectFailure('auth'), async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { _id: user._id, username: user.username },
      getJwtVerifySecret()
    );

    res.json({
      token,
      user: { _id: user._id, username: user.username, email: user.email }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get profile
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get favorites
app.get('/api/favorites', injectFailure('favorites'), authenticateToken, async (req, res) => {
  try {
    const cacheKey = `favorites-${req.user._id}`;
    let cachedFavs = sessionCache.get(cacheKey);
    
    if (cachedFavs) {
      logger.info('Favorites retrieved from cache', { userId: req.user._id });
      return res.json(cachedFavs);
    }

    const user = await User.findById(req.user._id);
    sessionCache.set(cacheKey, user.favorites);
    logger.info('Favorites retrieved from DB and cached', { userId: req.user._id });
    res.json(user.favorites);
  } catch (err) {
    logger.error('Failed to get favorites', { error: err.message });
    res.status(500).json({ message: err.message });
  }
});

// Add to favorites
app.post('/api/favorites/:movieId', injectFailure('favorites'), authenticateToken, async (req, res) => {
  try {
    const movieId = parseInt(req.params.movieId);
    const user = await User.findById(req.user._id);

    if (!user.favorites.includes(movieId)) {
      user.favorites.push(movieId);
      await user.save();
      const cacheKey = `favorites-${req.user._id}`;
      sessionCache.delete(cacheKey);
      logger.info('Movie added to favorites', { userId: req.user._id, movieId });
    }

    res.json(user.favorites);
  } catch (err) {
    logger.error('Failed to add to favorites', { error: err.message });
    res.status(500).json({ message: err.message });
  }
});

// Remove from favorites
app.delete('/api/favorites/:movieId', authenticateToken, async (req, res) => {
  try {
    const movieId = parseInt(req.params.movieId);
    const user = await User.findById(req.user._id);

    user.favorites = user.favorites.filter(id => id !== movieId);
    await user.save();

    res.json(user.favorites);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Error', { message: err.message });
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Failure Mode: ${isFailureMode()}`);
  if (isFailureMode()) {
    console.log(`Failure Scenario: ${getFailureScenario()}`);
  }
  console.log(`========================================\n`);
});

module.exports = app;
