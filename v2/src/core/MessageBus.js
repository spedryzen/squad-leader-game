// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/**
 * MessageBus provides an event-driven Publish/Subscribe system for decoupling game components.
 */
export class MessageBus {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe a callback function to a specific event.
   * @param {string} event - The name of the event to listen for.
   * @param {Function} callback - The callback function to execute when event is published.
   * @returns {Function} Unsubscribe function.
   */
  subscribe(event, callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('MessageBus callback must be a function');
    }
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    return () => this.unsubscribe(event, callback);
  }

  /**
   * Unsubscribe a callback function from a specific event.
   * @param {string} event - The event name.
   * @param {Function} callback - The registered callback function.
   */
  unsubscribe(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Publish an event to all subscribed listeners.
   * @param {string} event - The name of the event being published.
   * @param {*} [payload=null] - Optional payload data to pass to callbacks.
   */
  publish(event, payload = null) {
    if (this.listeners.has(event)) {
      const callbacks = Array.from(this.listeners.get(event));
      for (const callback of callbacks) {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error executing listener for event "${event}":`, error);
        }
      }
    }
  }

  /**
   * Clear all registered event listeners.
   */
  clear() {
    this.listeners.clear();
  }
}
