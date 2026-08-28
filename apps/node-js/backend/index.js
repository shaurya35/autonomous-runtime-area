const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const failureConfig = require('./config/failureConfig');
const { injectFailure } = require('./middleware/failureInjection');
const { logger } = require('./config/loggerConfig');
const SessionCache = require('./utils/sessionCache');
const { createRedisCircuitBreaker } = require('./utils/circuitBreaker');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const sessionCache = new SessionCache(parseInt(process.env.SESSION_CACHE_SIZE || '100', 10));

let redisCircuitBreaker = null;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// MongoDB connection
mongoose.connect(failureConfig.getMongoUri(), {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  logger.info('MongoDB connected');
  // Initialize Redis circuit breaker after DB connection
  redisCircuitBreaker = createRedisCircuitBreaker({});
})
.catch(err => {
  logger.error('MongoDB connection failed', { error: err.message });
});

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  favorites: [{ type: Number }], // TMDb movie IDs
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Access denied' });

  try {
    const verified = jwt.verify(token, failureConfig.getJwtVerifySecret());
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ message: 'Invalid token' });
  }
};

// Routes

// Register
app.post('/api/auth/register', injectFailure('auth'), async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({
      username,
      email,
      password: hashedPassword,
      favorites: []
    });

    await user.save();

    // Create token
    const token = jwt.sign(
      { _id: user._id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key'
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

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create token
    const token = jwt.sign(
      { _id: user._id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key'
    );

    res.json({
      token,
      user: { _id: user._id, username: user.username, email: user.email }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get user profile
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get user favorites
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
    logger.info('Favorites retrieved from DB and cached', { userId: req.user._id, cacheSize: sessionCache.size() });
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

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, { env: process.env.NODE_ENV || 'development' });
});
