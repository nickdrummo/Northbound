import { ValidationError } from './validation/validateOrderInput';
export interface ErrorDetail {
  code: string;
  message: string;
  validationErrors?: ValidationError[];
}

export interface StandardResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T | null;
  error: ErrorDetail | null;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function ok<T>(message: string, data: T): StandardResponse<T> {
  return {
    success: true,
    message,
    data,
    error: null,
  };
}

export function fail(message: string, error: ErrorDetail): StandardResponse<null> {
  return {
    success: false,
    message,
    data: null,
    error,
  };
}

