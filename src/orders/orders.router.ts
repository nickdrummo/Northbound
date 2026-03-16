import { Router, Request, Response } from 'express';
import { validateOrderInput } from '../validation/validateOrderInput';
import { generateUBL } from './ubl.service';
import { ok, fail } from '../errors';
import { listOrders, retrieveOrderXML } from './orders.manage';

const router = Router();

router.post('/generate', (req: Request, res: Response) => {
  const validationErrors = validateOrderInput(req.body);

  if (validationErrors.length > 0) {
    return res.status(400).json(
      fail('Validation failed', {
        code: 'VALIDATION_ERROR',
        message: 'Request body failed validation',
        validationErrors,
      })
    );
  }

  try {
    const result = generateUBL(req.body);

    return res.status(201).json(
      ok('UBL order generated successfully', result)
    );
  } catch (err) {
    return res.status(422).json(
      fail('Schema validation failure', {
        code: 'SCHEMA_VALIDATION_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    );
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const orders = await listOrders();

    return res.status(200).json(
      ok('Orders retrieved successfully', orders)
    );
  } catch (err) {
    return res.status(500).json(
      fail('Failed to retrieve orders', {
        code: 'LIST_ORDERS_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    );
  }
});

router.get('/:id/xml', async (req: Request, res: Response) => {
  try {
    const xml = await retrieveOrderXML(String(req.params.id));

    return res.status(200).type('application/xml').send(xml);
  } catch (err) {
    return res.status(404).json(
      fail('Failed to retrieve order XML', {
        code: 'RETRIEVE_ORDER_XML_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    );
  }
});

export default router;