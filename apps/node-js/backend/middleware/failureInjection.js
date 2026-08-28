const {
  isFailureMode,
  getFailureScenario,
  shouldFailRoute,
  getFailureDelayMs,
} = require('../config/failureConfig');

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

module.exports = {
  injectFailure,
};
