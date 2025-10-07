/**
 * Custom validation error for input validation failures
 * Provides clear error messages for debugging and user feedback
 */
export class ValidationError extends Error {
  public readonly code: string;
  public readonly field?: string;
  public readonly value?: any;

  constructor(
    message: string,
    code: string = 'VALIDATION_ERROR',
    field?: string,
    value?: any
  ) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.field = field;
    this.value = value;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, ValidationError);
  }

  /**
   * Create a validation error for a specific field
   */
  static forField(field: string, value: any, message: string): ValidationError {
    return new ValidationError(
      `Validation failed for field '${field}': ${message}`,
      'FIELD_VALIDATION_ERROR',
      field,
      value
    );
  }

  /**
   * Create a validation error for a range violation
   */
  static outOfRange(field: string, value: number, min: number, max: number): ValidationError {
    return new ValidationError(
      `Value ${value} for field '${field}' is out of range [${min}, ${max}]`,
      'RANGE_VALIDATION_ERROR',
      field,
      value
    );
  }

  /**
   * Create a validation error for required field
   */
  static required(field: string): ValidationError {
    return new ValidationError(
      `Field '${field}' is required`,
      'REQUIRED_FIELD_ERROR',
      field,
      undefined
    );
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      field: this.field,
      value: this.value,
    };
  }
}