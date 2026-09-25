/** An error whose message is safe to show to the user. `extra` fields (e.g. code, retryAfter) are added to the JSON. */
export class HttpError extends Error {
  constructor(status, message, extra = undefined) {
    super(message);
    this.status = status;
    this.expose = true;
    this.extra = extra;
  }
}
