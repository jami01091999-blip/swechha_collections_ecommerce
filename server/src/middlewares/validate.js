import { HttpError } from '../utils/HttpError.js';

/** Validates req[source] with a zod schema and replaces it with the parsed value. */
export const validate =
  (schema, source = 'body') =>
  (req, res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      return next(new HttpError(400, result.error.issues.map((i) => i.message).join(' ')));
    }
    // req.query is a getter in Express 5; assigning keeps working on Express 4.
    req[source] = result.data;
    next();
  };
