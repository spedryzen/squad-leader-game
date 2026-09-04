// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/**
 * GameEngine is the central coordinator/orchestrator for the Squad Leader: Vietnam OOP architecture.
 */
export class GameEngine {
  /**
   * @param {import('./MessageBus.js').MessageBus} messageBus - The central message bus instance.
   */
  constructor(messageBus) {
    if (!messageBus) {
      throw new Error('GameEngine requires a valid MessageBus instance.');
    }
    this.messageBus = messageBus;
    this.isRunning = false;
    this.state = null;
  }

  /**
   * Initialize the game engine and broadcast the boot event.
   */
  init() {
    this.isRunning = true;
    this.messageBus.publish('GAME_BOOTED', {
      timestamp: Date.now(),
      engine: this
    });
  }

  /**
   * Stop or pause engine execution.
   */
  stop() {
    this.isRunning = false;
    this.messageBus.publish('GAME_STOPPED', {
      timestamp: Date.now()
    });
  }
}
