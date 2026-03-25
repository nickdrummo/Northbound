import { Router, Request, Response } from 'express';
import { validateOrderInput } from '../validation/validateOrderInput';
import { generateUBL } from './ubl.service';
import { AppError, ok, fail } from '../errors';
import {
  listOrders,
  retrieveOrderByID,
  retrieveOrderXML,
  storeOrder,
  cancelOrder,
  updateOrderWithFullPayload,
} from './orders.manage';

const router = Router();

// Create-order handler: used for both POST / and POST /generate (Swagger uses POST /orders; we also support /v1/orders/generate)
async function handleCreateOrder(req: Request, res: Response): Promise<void> {
  const validationErrors = validateOrderInput(req.body);

  if (validationErrors.length > 0) {
    res.status(400).json(
      fail('Validation failed', {
        code: 'VALIDATION_ERROR',
        message: 'Request body failed validation',
        validationErrors,
      })
    );
    return;
  }

  try {
    const result = generateUBL(req.body);

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        await storeOrder(result.orderID, req.body, result.ubl_xml);
      } catch (error) {
        res.status(500).json(
          fail('Failed to store order', {
            code: 'STORE_ORDER_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
          })
        );
        return;
      }
    }

    res.status(201).json(
      ok('UBL order generated successfully', result)
    );
  } catch (err) {
    res.status(422).json(
      fail('Schema validation failure', {
        code: 'SCHEMA_VALIDATION_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    );
  }
}

router.post('/', handleCreateOrder);
router.post('/generate', handleCreateOrder);

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

router.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json(
        fail('Failed to retrieve order', {
          code: 'GET_ORDER_ERROR',
          message: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set',
        })
      );
    }

    const order = await retrieveOrderByID(String(req.params.id));

    if (!order) {
      return res.status(404).json(
        fail('Order not found', {
          code: 'ORDER_NOT_FOUND',
          message: 'Order with the given ID does not exist.',
        })
      );
    }

    return res.status(200).json(
      ok('Order retrieved successfully', order)
    );
  } catch (err) {
    return res.status(500).json(
      fail('Failed to retrieve order', {
        code: 'GET_ORDER_ERROR',
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

router.put('/:id/change', async (req: Request, res: Response) => {
  const isV2 = req.baseUrl === '/v2/orders';

  // Backward compatibility: v1 route still exists but is not implemented.
  if (!isV2) {
    return res.status(501).json(
      fail('Order change is not available on this API version.', {
        code: 'ORDER_CHANGE_USE_V2',
        message:
          'Use PUT /v2/orders/{orderID}/change with a full order payload (same shape as create).',
      })
    );
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    res.status(500).json(
      fail('Failed to update order', {
        code: 'UPDATE_ORDER_ERROR',
        message: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set',
      })
    );
    return;
  }

  const validationErrors = validateOrderInput(req.body);
  if (validationErrors.length > 0) {
    res.status(400).json(
      fail('Validation failed', {
        code: 'VALIDATION_ERROR',
        message: 'Request body failed validation',
        validationErrors,
      })
    );
    return;
  }

  try {
    const result = await updateOrderWithFullPayload(String(req.params.id), req.body);
    res.status(200).json(ok('Order updated successfully.', result));
  } catch (err: unknown) {
    if (err instanceof AppError) {
      res.status(err.status).json(
        fail(err.message, {
          code: err.code,
          message: err.message,
        })
      );
      return;
    }

    res.status(500).json(
      fail('Failed to update order', {
        code: 'UPDATE_ORDER_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    );
  }
});

router.post('/:id/cancel', async (req: Request, res: Response): Promise<void> => {
  const isV2 = req.baseUrl === '/v2/orders';

  // Backward compatibility: v1 route still exists but is not implemented.
  if (!isV2) {
    res.status(501).json(
      fail('Order cancel is not available on this API version.', {
        code: 'ORDER_CANCEL_USE_V2',
        message: 'Use POST /v2/orders/{orderID}/cancel.',
      })
    );
    return;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    res.status(500).json(
      fail('Failed to cancel order', {
        code: 'CANCEL_ORDER_ERROR',
        message: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set',
      })
    );
    return;
  }

  try {
    await cancelOrder(String(req.params.id));
    res.status(200).json(ok('Order cancelled successfully.', { orderID: String(req.params.id) }));
  } catch (err: unknown) {
    if (err instanceof AppError) {
      res.status(err.status).json(
        fail(err.message, {
          code: err.code,
          message: err.message,
        })
      );
      return;
    }

    res.status(500).json(
      fail('Failed to cancel order', {
        code: 'CANCEL_ORDER_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    );
  }
});

router.post('/:id/response', async (_req: Request, res: Response) => {
  return res.status(501).json(
    fail('Order response is not implemented in this version of the service.', {
      code: 'ORDER_RESPONSE_NOT_IMPLEMENTED',
      message:
        'Generating UBL OrderResponse documents is out of scope for the current MVP.',
    })
  );
});

router.patch('/:id/detail', async (_req: Request, res: Response) => {
  return res.status(501).json(
    fail('Order detail update is not implemented in this version of the service.', {
      code: 'ORDER_DETAIL_NOT_IMPLEMENTED',
      message:
        'Updating stored order metadata is not supported without additional persistence fields.',
    })
  );
});

export default router;