// Centralized error messages following Nielsen's Heuristic #9
// Help users recognize, diagnose, and recover from errors

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: {
    title: 'Invalid Credentials',
    message: 'The email or password you entered is incorrect. Please check and try again.',
    action: 'If you forgot your password, click "Forgot password?" below.',
  },
  ACCOUNT_LOCKED: {
    title: 'Account Locked',
    message: 'Your account has been locked due to multiple failed login attempts.',
    action: 'Please contact support at support@overmatch.digital or wait 30 minutes.',
  },
  NETWORK_ERROR: {
    title: 'Connection Problem',
    message: 'Unable to connect to our servers. Please check your internet connection.',
    action: 'Try refreshing the page or check your network settings.',
  },
  SESSION_EXPIRED: {
    title: 'Session Expired',
    message: 'Your session has expired for security reasons.',
    action: 'Please sign in again to continue.',
  },
  UNAUTHORIZED: {
    title: 'Access Denied',
    message: "You don't have permission to access this resource.",
    action: 'Please contact your administrator if you believe this is an error.',
  },
  SERVER_ERROR: {
    title: 'Server Error',
    message: "We're experiencing technical difficulties. Our team has been notified.",
    action: 'Please try again in a few minutes. If the problem persists, contact support.',
  },
} as const;

export const FORM_ERRORS = {
  REQUIRED_FIELD: (fieldName: string) => ({
    message: `${fieldName} is required`,
    action: `Please enter your ${fieldName.toLowerCase()}`,
  }),
  INVALID_EMAIL: {
    message: 'Please enter a valid email address',
    action: 'Example: john.doe@company.com',
  },
  PASSWORD_TOO_SHORT: {
    message: 'Password must be at least 8 characters',
    action: 'Use a mix of letters, numbers, and symbols for better security',
  },
  PASSWORDS_DONT_MATCH: {
    message: 'Passwords do not match',
    action: 'Please ensure both password fields contain the same value',
  },
  INVALID_DATE: {
    message: 'Please enter a valid date',
    action: 'Use format: MM/DD/YYYY',
  },
  FILE_TOO_LARGE: (maxSize: string) => ({
    message: `File size exceeds ${maxSize} limit`,
    action: 'Please choose a smaller file or compress it',
  }),
  UNSUPPORTED_FILE_TYPE: (supportedTypes: string[]) => ({
    message: 'File type not supported',
    action: `Supported types: ${supportedTypes.join(', ')}`,
  }),
} as const;

export const DATA_ERRORS = {
  NOT_FOUND: {
    title: 'Not Found',
    message: 'The requested item could not be found.',
    action: 'It may have been moved or deleted. Try searching or return to the dashboard.',
  },
  SAVE_FAILED: {
    title: 'Save Failed',
    message: 'Unable to save your changes.',
    action: 'Please check your data and try again. Your work has been preserved.',
  },
  DELETE_FAILED: {
    title: 'Delete Failed',
    message: 'Unable to delete the item.',
    action: 'The item may be in use or protected. Please try again later.',
  },
  LOAD_FAILED: {
    title: 'Loading Error',
    message: 'Unable to load the requested data.',
    action: 'Please refresh the page or try again later.',
  },
  DUPLICATE_ENTRY: {
    title: 'Duplicate Entry',
    message: 'An item with this name already exists.',
    action: 'Please choose a different name or edit the existing item.',
  },
} as const;

// Helper function to get error details from error code
export function getErrorDetails(errorCode: string) {
  switch (errorCode) {
    case 'CredentialsSignin':
      return AUTH_ERRORS.INVALID_CREDENTIALS;
    case 'SessionRequired':
      return AUTH_ERRORS.SESSION_EXPIRED;
    case 'AccessDenied':
      return AUTH_ERRORS.UNAUTHORIZED;
    case 'Configuration':
    case 'ServerError':
      return AUTH_ERRORS.SERVER_ERROR;
    default:
      return {
        title: 'Error',
        message: 'An unexpected error occurred.',
        action: 'Please try again or contact support if the problem persists.',
      };
  }
}
