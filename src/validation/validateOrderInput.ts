export interface ValidationError {
  field: string;
  message: string;
}

type JsonObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isValidDateString(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false;
  }

  // simple YYYY-MM-DD check
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(value)) {
    return false;
  }

  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function validateOptionalString(
  value: unknown,
  fieldPath: string,
  errors: ValidationError[]
): void {
  if (value !== undefined && !isNonEmptyString(value)) {
    errors.push({
      field: fieldPath,
      message: `${fieldPath} must be a non-empty string when provided`,
    });
  }
}

function validateParty(
  fieldName: 'buyer' | 'seller',
  value: unknown,
  errors: ValidationError[]
): void {
  if (!isPlainObject(value)) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be an object`,
    });
    return;
  }

  if (!isNonEmptyString(value.external_id)) {
    errors.push({
      field: `${fieldName}.external_id`,
      message: `${fieldName}.external_id is required`,
    });
  }

  if (!isNonEmptyString(value.name)) {
    errors.push({
      field: `${fieldName}.name`,
      message: `${fieldName}.name is required`,
    });
  }

  validateOptionalString(value.email, `${fieldName}.email`, errors);
  validateOptionalString(value.street, `${fieldName}.street`, errors);
  validateOptionalString(value.city, `${fieldName}.city`, errors);
  validateOptionalString(value.country, `${fieldName}.country`, errors);
  validateOptionalString(value.postal_code, `${fieldName}.postal_code`, errors);
}

function validateOrderLine(
  value: unknown,
  index: number,
  errors: ValidationError[]
): void {
  const prefix = `order_lines[${index}]`;

  if (!isPlainObject(value)) {
    errors.push({
      field: prefix,
      message: `${prefix} must be an object`,
    });
    return;
  }

  if (!isNonEmptyString(value.line_id)) {
    errors.push({
      field: `${prefix}.line_id`,
      message: `${prefix}.line_id is required`,
    });
  }

  if (!isNonEmptyString(value.description)) {
    errors.push({
      field: `${prefix}.description`,
      message: `${prefix}.description is required`,
    });
  }

  if (!isPositiveNumber(value.quantity)) {
    errors.push({
      field: `${prefix}.quantity`,
      message: `${prefix}.quantity must be a positive number`,
    });
  }

  if (!isNonNegativeNumber(value.unit_price)) {
    errors.push({
      field: `${prefix}.unit_price`,
      message: `${prefix}.unit_price must be a non-negative number`,
    });
  }

  validateOptionalString(value.unit_code, `${prefix}.unit_code`, errors);
}

export function validateOrderInput(body: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isPlainObject(body)) {
    return [
      {
        field: 'body',
        message: 'Request body must be a JSON object',
      },
    ];
  }

  if (!isPlainObject(body.buyer)) {
    errors.push({
      field: 'buyer',
      message: 'buyer is required and must be an object',
    });
  } else {
    validateParty('buyer', body.buyer, errors);
  }

  if (!isPlainObject(body.seller)) {
    errors.push({
      field: 'seller',
      message: 'seller is required and must be an object',
    });
  } else {
    validateParty('seller', body.seller, errors);
  }

  if (!isNonEmptyString(body.currency)) {
    errors.push({
      field: 'currency',
      message: 'currency is required',
    });
  }

  if (!isValidDateString(body.issue_date)) {
    errors.push({
      field: 'issue_date',
      message: 'issue_date is required and must be a valid YYYY-MM-DD date',
    });
  }

  validateOptionalString(body.order_note, 'order_note', errors);

  if (!Array.isArray(body.order_lines)) {
    errors.push({
      field: 'order_lines',
      message: 'order_lines is required and must be an array',
    });
  } else if (body.order_lines.length === 0) {
    errors.push({
      field: 'order_lines',
      message: 'order_lines must contain at least one item',
    });
  } else {
    body.order_lines.forEach((line, index) => {
      validateOrderLine(line, index, errors);
    });
  }

  return errors;
}