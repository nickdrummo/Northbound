import { RecurringOrderUpdate } from '../orders/order.types';

export interface ValidationError {
  field: string;
  message: string;
}

const VALID_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'];

export function validateRecurringOrderUpdate(body: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return [{ field: 'body', message: 'Request body must be a JSON object' }];
  }

  if (Object.keys(body).length === 0) {
    return [{ field: 'body', message: 'Request body must contain at least one field to update' }];
  }

  // buyer (optional but if present must be valid)
  if (body.buyer !== undefined) {
    if (typeof body.buyer !== 'object' || !body.buyer) {
      errors.push({ field: 'buyer', message: 'buyer must be an object' });
    } else {
      if (!body.buyer.external_id) errors.push({ field: 'buyer.external_id', message: 'buyer.external_id is required' });
      if (!body.buyer.name) errors.push({ field: 'buyer.name', message: 'buyer.name is required' });
    }
  }

  // seller (optional but if present must be valid)
  if (body.seller !== undefined) {
    if (typeof body.seller !== 'object' || !body.seller) {
      errors.push({ field: 'seller', message: 'seller must be an object' });
    } else {
      if (!body.seller.external_id) errors.push({ field: 'seller.external_id', message: 'seller.external_id is required' });
      if (!body.seller.name) errors.push({ field: 'seller.name', message: 'seller.name is required' });
    }
  }

  // currency
  if (body.currency !== undefined && typeof body.currency !== 'string') {
    errors.push({ field: 'currency', message: 'currency must be a string' });
  }

  // frequency
  if (body.frequency !== undefined && !VALID_FREQUENCIES.includes(body.frequency)) {
    errors.push({ field: 'frequency', message: `frequency must be one of: ${VALID_FREQUENCIES.join(', ')}` });
  }

  // recur_interval
  if (body.recur_interval !== undefined) {
    if (typeof body.recur_interval !== 'number' || !Number.isInteger(body.recur_interval) || body.recur_interval < 1) {
      errors.push({ field: 'recur_interval', message: 'recur_interval must be a positive integer' });
    }
  }

  // recur_start_date
  if (body.recur_start_date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(body.recur_start_date)) {
    errors.push({ field: 'recur_start_date', message: 'recur_start_date must be a valid date in YYYY-MM-DD format' });
  }

  // recur_end_date
  if (body.recur_end_date !== undefined && body.recur_end_date !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.recur_end_date)) {
      errors.push({ field: 'recur_end_date', message: 'recur_end_date must be a valid date in YYYY-MM-DD format or null' });
    } else {
      const startDate = body.recur_start_date ?? null;
      if (startDate && body.recur_end_date <= startDate) {
        errors.push({ field: 'recur_end_date', message: 'recur_end_date must be after recur_start_date' });
      }
    }
  }

  // order_lines
  if (body.order_lines !== undefined) {
    if (!Array.isArray(body.order_lines) || body.order_lines.length === 0) {
      errors.push({ field: 'order_lines', message: 'order_lines must be a non-empty array' });
    } else {
      body.order_lines.forEach((line: any, i: number) => {
        if (!line.line_id) errors.push({ field: `order_lines[${i}].line_id`, message: 'line_id is required' });
        if (!line.description) errors.push({ field: `order_lines[${i}].description`, message: 'description is required' });
        if (typeof line.quantity !== 'number' || line.quantity <= 0) errors.push({ field: `order_lines[${i}].quantity`, message: 'quantity must be a positive number' });
        if (typeof line.unit_price !== 'number' || line.unit_price < 0) errors.push({ field: `order_lines[${i}].unit_price`, message: 'unit_price must be a non-negative number' });
      });
    }
  }

  return errors;
}
