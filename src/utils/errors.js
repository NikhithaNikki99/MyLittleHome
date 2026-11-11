// Thrown for bad user input; the message is safe to show in the UI.
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}
