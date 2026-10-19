export interface PublicApiError {
  statusCode: number;
  body: {
    error: {
      code: 'REQUEST_ERROR' | 'INTERNAL_ERROR';
      message: string;
    };
  };
}

const clientMessages: Record<number, string> = {
  400: 'The request is invalid.',
  401: 'Authentication is required.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  405: 'This method is not supported for the requested resource.',
  409: 'The request conflicts with the current resource state.',
  413: 'The request is too large.',
  415: 'The request media type is not supported.',
  422: 'The request could not be validated.',
  429: 'Too many requests. Try again later.',
};

export function publicApiError(error: unknown): PublicApiError {
  const candidateStatus = error && typeof error === 'object' && 'statusCode' in error
    ? (error as { statusCode?: unknown }).statusCode
    : undefined;
  const statusCode = typeof candidateStatus === 'number' &&
    Number.isInteger(candidateStatus) &&
    candidateStatus >= 400 &&
    candidateStatus < 500
    ? candidateStatus
    : 500;

  if (statusCode < 500) {
    return {
      statusCode,
      body: {
        error: {
          code: 'REQUEST_ERROR',
          message: clientMessages[statusCode] ?? 'The request could not be processed.',
        },
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected server error occurred.',
      },
    },
  };
}
