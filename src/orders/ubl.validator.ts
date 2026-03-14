import { OrderInput } from './order.types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateOrderInput(body: any): ValidationResult {
  const errors: string[] = [];

  if (!body.buyer) errors.push('buyer is required');
  else {
    if (!body.buyer.external_id) errors.push('buyer.external_id is required');
    if (!body.buyer.name) errors.push('buyer.name is required');
  }

  if (!body.seller) errors.push('seller is required');
  else {
    if (!body.seller.external_id) errors.push('seller.external_id is required');
    if (!body.seller.name) errors.push('seller.name is required');
  }

  if (!body.currency) errors.push('currency is required');
  if (!body.issue_date) errors.push('issue_date is required');
  if (typeof body.totalAmount !== 'number') errors.push('totalAmount must be a number');

  if (!Array.isArray(body.order_lines) || body.order_lines.length === 0) {
    errors.push('order_lines must be a non-empty array');
  } else {
    body.order_lines.forEach((line: any, i: number) => {
      if (!line.description) errors.push(`order_lines[${i}].description is required`);
      if (typeof line.quantity !== 'number') errors.push(`order_lines[${i}].quantity must be a number`);
      if (typeof line.unit_price !== 'number') errors.push(`order_lines[${i}].unit_price must be a number`);
    });
  }

  return { valid: errors.length === 0, errors };
}
