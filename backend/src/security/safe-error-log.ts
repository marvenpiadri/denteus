export interface SafeErrorLogFields {
  errorType: string;
  errorCode?: string;
  httpStatus?: number;
}

/**
 * Produces diagnostic metadata without logging error messages, SQL details,
 * request values, or stack traces that may contain clinical information.
 */
export function safeErrorLogFields(error: unknown): SafeErrorLogFields {
  const fields: SafeErrorLogFields = {
    errorType: error instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error.name) ? error.name : 'UnknownError',
  };

  if (!error || typeof error !== 'object') return fields;

  if ('code' in error && typeof error.code === 'string' && /^[A-Z0-9_]{2,16}$/.test(error.code)) {
    fields.errorCode = error.code;
  }

  if ('statusCode' in error && typeof error.statusCode === 'number' && Number.isInteger(error.statusCode)) {
    fields.httpStatus = error.statusCode;
  }

  return fields;
}
