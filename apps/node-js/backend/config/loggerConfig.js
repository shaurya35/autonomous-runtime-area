const winston = require('winston');
const failureConfig = require('./failureConfig');

const logLevel = process.env.LOG_LEVEL || 'info';

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'movie-box-backend' },
  transports: [
    new winston.transports.File({ filename: 'failure-logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'failure-logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

const getEffectiveLogLevel = () => {
  if (failureConfig.isFailureMode() && failureConfig.getFailureScenario() === 'debug-prod') {
    return 'debug';
  }
  return logLevel;
};

module.exports = {
  logger,
  getEffectiveLogLevel,
};
