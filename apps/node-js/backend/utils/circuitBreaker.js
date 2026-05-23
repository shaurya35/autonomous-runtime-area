const CircuitBreaker = require('opossum');
const failureConfig = require('../config/failureConfig');

const createRedisCircuitBreaker = (redisClient) => {
  const options = {
    timeout: 3000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    name: 'redis-circuit-breaker',
  };

  const breaker = new CircuitBreaker(async (operation) => {
    if (failureConfig.isFailureMode() && failureConfig.getFailureScenario() === 'redis-down') {
      throw new Error('Simulated Redis service down');
    }
    return operation();
  }, options);

  breaker.on('open', () => {
    console.warn('Circuit breaker opened: Redis service is unreachable');
  });

  breaker.on('halfOpen', () => {
    console.info('Circuit breaker half-open: attempting to reconnect to Redis');
  });

  breaker.on('close', () => {
    console.info('Circuit breaker closed: Redis service recovered');
  });

  return breaker;
};

module.exports = {
  createRedisCircuitBreaker,
};
