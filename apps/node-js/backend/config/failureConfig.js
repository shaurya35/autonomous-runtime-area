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

module.exports = {
  isFailureMode,
  getFailureScenario,
  shouldFailRoute,
  getFailureDelayMs,
  getMongoUri,
  getJwtVerifySecret,
};
