// Lets you write: throw new ApiError(404, "Room not found")
export default class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}