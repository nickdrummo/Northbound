import { RecurringOrderInput } from '../orders/order.types';

export interface ValidationError {
  field: string;
  message: string;
}

const VALID_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'];

export function validateRecurringOrderInput(body: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!body || typeof body !== 'object') {
    return [{ field: 'body', message: 'Request body must be a JSON object' }];
  }

  // buyer
  if (!body.buyer || typeof body.buyer !== 'object') {
    errors.push({ field: 'buyer', message: 'buyer is required' });
  } else {
    if (!body.buyer.external_id) errors.push({ field: 'buyer.external_id', message: 'buyer.external_id is required' });
    if (!body.buyer.name) errors.push({ field: 'buyer.name', message: 'buyer.name is required' });
  }

  // seller
  if (!body.seller || typeof body.seller !== 'object') {
    errors.push({ field: 'seller', message: 'seller is required' });
  } else {
    if (!body.seller.external_id) errors.push({ field: 'seller.external_id', message: 'seller.external_id is required' });
    if (!body.seller.name) errors.push({ field: 'seller.name', message: 'seller.name is required' });
  }

  // currency
  if (!body.currency || typeof body.currency !== 'string') {
    errors.push({ field: 'currency', message: 'currency is required' });
  }

  // order_lines
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

  // frequency
  if (!body.frequency || !VALID_FREQUENCIES.includes(body.frequency)) {
    errors.push({ field: 'frequency', message: `frequency must be one of: ${VALID_FREQUENCIES.join(', ')}` });
  }

  // recur_interval
  if (typeof body.recur_interval !== 'number' || !Number.isInteger(body.recur_interval) || body.recur_interval < 1) {
    errors.push({ field: 'recur_interval', message: 'recur_interval must be a positive integer' });
  }

  // recur_start_date
  if (!body.recur_start_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.recur_start_date)) {
    errors.push({ field: 'recur_start_date', message: 'recur_start_date must be a valid date in YYYY-MM-DD format' });
  }

  // recur_end_date (optional)
  if (body.recur_end_date !== undefined && body.recur_end_date !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.recur_end_date)) {
      errors.push({ field: 'recur_end_date', message: 'recur_end_date must be a valid date in YYYY-MM-DD format' });
    } else if (body.recur_start_date && body.recur_end_date <= body.recur_start_date) {
      errors.push({ field: 'recur_end_date', message: 'recur_end_date must be after recur_start_date' });
    }
  }

  return errors;
}
