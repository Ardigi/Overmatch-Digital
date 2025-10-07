import { useCallback, useEffect, useState } from 'react';

interface ValidationRule {
  test: (value: string) => boolean;
  message: string;
}

interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: ValidationRule[];
}

interface FormValidation {
  [key: string]: FieldValidation;
}

interface FormErrors {
  [key: string]: string | undefined;
}

interface TouchedFields {
  [key: string]: boolean;
}

export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  validationRules: FormValidation
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<TouchedFields>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Validate a single field
  const validateField = useCallback(
    (name: string, value: string): string | undefined => {
      const rules = validationRules[name];
      if (!rules) return undefined;

      // Required field validation
      if (rules.required && !value.trim()) {
        return `${name.charAt(0).toUpperCase() + name.slice(1)} is required`;
      }

      // Email validation
      if (name === 'email' && value && !emailRegex.test(value)) {
        return 'Please enter a valid email address';
      }

      // Min length validation
      if (rules.minLength && value.length < rules.minLength) {
        return `Must be at least ${rules.minLength} characters`;
      }

      // Max length validation
      if (rules.maxLength && value.length > rules.maxLength) {
        return `Must be no more than ${rules.maxLength} characters`;
      }

      // Pattern validation
      if (rules.pattern && value && !rules.pattern.test(value)) {
        return 'Invalid format';
      }

      // Custom validation rules
      if (rules.custom) {
        for (const rule of rules.custom) {
          if (!rule.test(value)) {
            return rule.message;
          }
        }
      }

      return undefined;
    },
    [validationRules]
  );

  // Validate all fields
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;

    Object.keys(validationRules).forEach((fieldName) => {
      const error = validateField(fieldName, values[fieldName] || '');
      if (error) {
        newErrors[fieldName] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [values, validateField, validationRules]);

  // Handle field change with real-time validation
  const handleChange = useCallback(
    (name: string, value: string) => {
      setValues((prev) => ({ ...prev, [name]: value }));

      // Only validate if field has been touched
      if (touched[name]) {
        const error = validateField(name, value);
        setErrors((prev) => ({ ...prev, [name]: error }));
      }
    },
    [touched, validateField]
  );

  // Handle field blur
  const handleBlur = useCallback(
    (name: string) => {
      setTouched((prev) => ({ ...prev, [name]: true }));

      // Validate on blur
      const error = validateField(name, values[name] || '');
      setErrors((prev) => ({ ...prev, [name]: error }));
    },
    [values, validateField]
  );

  // Handle form submission
  const handleSubmit = useCallback(
    async (onSubmit: (values: T) => Promise<void> | void) => {
      setIsSubmitting(true);

      // Touch all fields
      const allTouched: TouchedFields = {};
      Object.keys(validationRules).forEach((key) => {
        allTouched[key] = true;
      });
      setTouched(allTouched);

      // Validate form
      if (validateForm()) {
        try {
          await onSubmit(values);
        } catch (error) {
          console.error('Form submission error:', error);
        }
      }

      setIsSubmitting(false);
    },
    [values, validateForm, validationRules]
  );

  // Reset form
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  // Check if field has error
  const hasError = useCallback(
    (name: string): boolean => {
      return touched[name] && !!errors[name];
    },
    [touched, errors]
  );

  // Get field error message
  const getError = useCallback(
    (name: string): string | undefined => {
      return touched[name] ? errors[name] : undefined;
    },
    [touched, errors]
  );

  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    hasError,
    getError,
    isValid: Object.keys(errors).length === 0,
  };
}

// Pre-built validation rules
export const validationRules = {
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  password: {
    required: true,
    minLength: 8,
    custom: [
      {
        test: (value: string) => /[A-Z]/.test(value),
        message: 'Password must contain at least one uppercase letter',
      },
      {
        test: (value: string) => /[0-9]/.test(value),
        message: 'Password must contain at least one number',
      },
    ],
  },
  confirmPassword: (password: string) => ({
    required: true,
    custom: [
      {
        test: (value: string) => value === password,
        message: 'Passwords do not match',
      },
    ],
  }),
};
