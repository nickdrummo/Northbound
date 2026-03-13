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

  if (!isNonEmptyString(value.partyId)) {
    errors.push({
      field: `${fieldName}.partyId`,
      message: `${fieldName}.partyId is required`,
    });
  }

  if (!isNonEmptyString(value.partyName)) {
    errors.push({
      field: `${fieldName}.partyName`,
      message: `${fieldName}.partyName is required`,
    });
  }

  if (!isNonEmptyString(value.countryCode)) {
    errors.push({
      field: `${fieldName}.countryCode`,
      message: `${fieldName}.countryCode is required`,
    });
  }
}

function validateOrderLine(
  value: unknown,
  index: number,
  errors: ValidationError[]
): void {
  const prefix = `orderLines[${index}]`;

  if (!isPlainObject(value)) {
    errors.push({
      field: prefix,
      message: `${prefix} must be an object`,
    });
    return;
  }

  if (
    typeof value.lineNumber !== 'number' ||
    !Number.isInteger(value.lineNumber) ||
    value.lineNumber <= 0
  ) {
    errors.push({
      field: `${prefix}.lineNumber`,
      message: `${prefix}.lineNumber must be a positive integer`,
    });
  }

  if (!isNonEmptyString(value.itemId)) {
    errors.push({
      field: `${prefix}.itemId`,
      message: `${prefix}.itemId is required`,
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

  if (!isNonNegativeNumber(value.unitPrice)) {
    errors.push({
      field: `${prefix}.unitPrice`,
      message: `${prefix}.unitPrice must be a non-negative number`,
    });
  }
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

  if (!isNonEmptyString(body.currencyCode)) {
    errors.push({
      field: 'currencyCode',
      message: 'currencyCode is required',
    });
  }

  if (!Array.isArray(body.orderLines)) {
    errors.push({
      field: 'orderLines',
      message: 'orderLines is required and must be an array',
    });
  } else if (body.orderLines.length === 0) {
    errors.push({
      field: 'orderLines',
      message: 'orderLines must contain at least one item',
    });
  } else {
    body.orderLines.forEach((line, index) => {
      validateOrderLine(line, index, errors);
    });
  }

  return errors;
}