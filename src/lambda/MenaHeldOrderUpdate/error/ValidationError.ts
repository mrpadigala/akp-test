export default class ValidationError extends Error {
  readonly status = 422;
}
