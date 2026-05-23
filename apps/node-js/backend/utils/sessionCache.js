const failureConfig = require('../config/failureConfig');

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
    if (failureConfig.isFailureMode() && failureConfig.getFailureScenario() === 'memory-leak-cache') {
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

  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  size() {
    return this.cache.size;
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      isFull: this.cache.size >= this.maxSize,
    };
  }
}

module.exports = SessionCache;
