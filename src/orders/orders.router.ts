import { Router, Request, Response } from 'express';
import {
  validateOrderInput,
  validatePartyCountryUpdate,
  validateOrderDetailPatch,
  validateOrderResponseInput,
} from '../validation/validateOrderInput';
import { validateRecurringOrderUpdate } from '../validation/validateRecurringOrderUpdate';
import { generateUBL } from './ubl.service';
import { AppError, ok, fail } from '../errors';
import {
  listOrders,
  retrieveOrderByID,
  retrieveOrderXML,
  storeOrder,
  createRecurringOrder,
  deleteRecurringOrder,
  updateRecurringOrder,
  cancelOrder,
  updateOrderPartyCountry,
  updateOrderWithFullPayload,
  patchOrderDetail,
  generateOrderResponseForOrder,
  syncDispatchAdviceXml,
  upsertDispatchAdvicesForOrder,
  generateInvoiceForOrder,
} from './orders.manage';
import { validateRecurringOrderInput } from '../validation/validateRecurringOrderInput';
import type { OrderResponseInput } from './order.types';
import {
  devexCreateDespatchFromOrderXml,
  devexListDespatches,
  devexRetrieveDespatch,
} from '../integrations/devexDespatch';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
// Keep API routes protected in normal runtime, but allow unit tests to exercise
// handlers without having to generate JWTs.
if (process.env.NODE_ENV !== 'test') {
  router.use(requireAuth);
}

/** Forward DevEx JSON (or text) response to the Express response. */
async function forwardDevexResponse(
  res: Response,
  devexRes: globalThis.Response
): Promise<void> {
  const text = await devexRes.text();
  const ct = devexRes.headers.get('content-type') ?? '';
  res.status(devexRes.status);
  if (ct.includes('application/json')) {
    res.type('application/json').send(text);
  } else {
    res.type(ct || 'text/plain').send(text);
  }
}

function tryParseJson<T = unknown>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

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

router.delete('/recurring/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await deleteRecurringOrder(String(req.params.id));

    if (result === null) {
      res.status(404).json(
        fail('Recurring order not found', {
          code: 'RECURRING_ORDER_NOT_FOUND',
          message: 'Recurring order with the given ID does not exist.',
        })
      );
      return;
    }

    const orderID =
      typeof result === 'string'
        ? result
        : 'orderID' in (result as any)
          ? (result as any).orderID
          : (result as any).id;

    res.status(200).json(ok('Recurring order deleted successfully', { orderID }));
  } catch (err) {
    res.status(500).json(
      fail('Failed to delete recurring order', {
        code: 'DELETE_RECURRING_ORDER_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    );
  }
});

router.post('/recurring', async (req: Request, res: Response): Promise<void> => {
  const validationErrors = validateRecurringOrderInput(req.body);

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
    const recurringOrder = await createRecurringOrder(req.body);
    res.status(201).json(
      ok('Recurring order created successfully', recurringOrder)
    );
  } catch (err) {
    res.status(500).json(
      fail('Failed to create recurring order', {
        code: 'CREATE_RECURRING_ORDER_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    );
  }
});

/**
 * List Despatch Advice records from the integrated DevEx API (Category 2).
 * Registered before `GET /:id` so `despatch` is not captured as an order UUID.
 */
router.get('/despatch/list', async (_req: Request, res: Response) => {
  try {
    const devexRes = await devexListDespatches();
    await forwardDevexResponse(res, devexRes);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('DEVEX_API_KEY') ? 503 : 502;
    res.status(status).json(
      fail('DevEx despatch list failed', {
        code: 'DEVEX_DESPATCH_ERROR',
        message,
      })
    );
  }
});

router.get('/', async (req: Request, res: Response) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(500).json(
      fail('Failed to retrieve orders', {
        code: 'LIST_ORDERS_ERROR',
        message: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set',
      })
    );
  }

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

/**
 * Create Despatch Advice at DevEx using this order's UBL Order XML.
 * @see https://devex.cloud.tcore.network/api-docs/ — POST /api/v1/despatch/create
 */
router.post('/:id/despatch', async (req: Request, res: Response) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    res.status(500).json(
      fail('Failed to create despatch advice', {
        code: 'DESPATCH_CREATE_ERROR',
        message: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set',
      })
    );
    return;
  }

  let orderXml: string;
  try {
    orderXml = await retrieveOrderXML(String(req.params.id));
  } catch {
    res.status(404).json(
      fail('Order not found', {
        code: 'ORDER_NOT_FOUND',
        message: 'Order with the given ID does not exist.',
      })
    );
    return;
  }

  try {
    const devexRes = await devexCreateDespatchFromOrderXml(orderXml);
    const text = await devexRes.text();
    const ct = devexRes.headers.get('content-type') ?? '';

    // If DevEx created advice IDs successfully, store them locally.
    if (devexRes.ok && ct.includes('application/json')) {
      const json = tryParseJson<{ success?: boolean; adviceIds?: string[] }>(text);
      const adviceIds = json?.adviceIds?.filter((x) => typeof x === 'string') ?? [];
      if (json?.success === true && adviceIds.length > 0) {
        try {
          await upsertDispatchAdvicesForOrder(String(req.params.id), adviceIds, 'CREATED');
        } catch (dbErr) {
          // Don't fail the integration call if local persistence fails; return DevEx response.
          // (You can surface this later via logs / monitoring.)
          void dbErr;
        }
      }
    }

    res.status(devexRes.status);
    if (ct.includes('application/json')) {
      res.type('application/json').send(text);
    } else {
      res.type(ct || 'text/plain').send(text);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('DEVEX_API_KEY') ? 503 : 502;
    res.status(status).json(
      fail('DevEx despatch create failed', {
        code: 'DEVEX_DESPATCH_ERROR',
        message,
      })
    );
  }
});

/**
 * Retrieve Despatch Advice from DevEx for this order.
 * Query: `adviceId` (UUID) uses DevEx search-type=advice-id.
 * Omit `adviceId` to search by this order's UBL XML (search-type=order); URLs can be large.
 */
router.get('/:id/despatch', async (req: Request, res: Response) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    res.status(500).json(
      fail('Failed to retrieve despatch advice', {
        code: 'DESPATCH_RETRIEVE_ERROR',
        message: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set',
      })
    );
    return;
  }

  const adviceId = req.query.adviceId;
  let devexRes: globalThis.Response;
  let orderIdForStore = String(req.params.id);

  try {
    if (typeof adviceId === 'string' && adviceId.trim() !== '') {
      devexRes = await devexRetrieveDespatch('advice-id', adviceId.trim());
    } else {
      let orderXml: string;
      try {
        orderXml = await retrieveOrderXML(String(req.params.id));
      } catch {
        res.status(404).json(
          fail('Order not found', {
            code: 'ORDER_NOT_FOUND',
            message: 'Order with the given ID does not exist.',
          })
        );
        return;
      }
      devexRes = await devexRetrieveDespatch('order', orderXml);
    }

    const text = await devexRes.text();
    const ct = devexRes.headers.get('content-type') ?? '';

    // If we retrieved a despatch advice successfully, store XML + sync timestamp.
    if (devexRes.ok && ct.includes('application/json')) {
      const json = tryParseJson<{ ['despatch-advice']?: string; ['advice-id']?: string }>(text);
      const despatchXml = json?.['despatch-advice'];
      const devexAdviceId = json?.['advice-id'];
      if (typeof despatchXml === 'string' && typeof devexAdviceId === 'string') {
        try {
          await syncDispatchAdviceXml({
            orderID: orderIdForStore,
            devexAdviceID: devexAdviceId,
            dispatchXml: despatchXml,
            status: 'RETRIEVED',
          });
        } catch (dbErr) {
          void dbErr;
        }
      }
    }

    res.status(devexRes.status);
    if (ct.includes('application/json')) {
      res.type('application/json').send(text);
    } else {
      res.type(ct || 'text/plain').send(text);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('DEVEX_API_KEY') ? 503 : 502;
    res.status(status).json(
      fail('DevEx despatch retrieve failed', {
        code: 'DEVEX_DESPATCH_ERROR',
        message,
      })
    );
  }
});

router.patch('/recurring/:id', async (req: Request, res: Response): Promise<void> => {
  const validationErrors = validateRecurringOrderUpdate(req.body);

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
    const updated = await updateRecurringOrder(String(req.params.id), req.body);
    res.status(200).json(ok('Recurring order updated successfully', updated));
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.status).json(
        fail(err.message, { code: err.code, message: err.message })
      );
      return;
    }
    res.status(500).json(
      fail('Failed to update recurring order', {
        code: 'UPDATE_RECURRING_ORDER_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    );
  }
});

router.put('/:id/change', async (req: Request, res: Response) => {
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

router.post('/:id/response', async (req: Request, res: Response) => {
  const validationErrors = validateOrderResponseInput(req.body);
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
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      res.status(500).json(
        fail('Failed to generate order response', {
          code: 'ORDER_RESPONSE_ERROR',
          message: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set',
        })
      );
      return;
    }

    const body = req.body as {
      response_code: string;
      issue_date?: string;
      note?: string;
    };

    const responseInput: OrderResponseInput = {
      response_code: body.response_code,
    };
    if (body.issue_date !== undefined) {
      responseInput.issue_date = body.issue_date;
    }
    if (body.note !== undefined) {
      responseInput.note = body.note;
    }

    const result = await generateOrderResponseForOrder(String(req.params.id), responseInput);

    if (result === null) {
      res.status(404).json(
        fail('Order not found', {
          code: 'ORDER_NOT_FOUND',
          message: 'Order with the given ID does not exist.',
        })
      );
      return;
    }

    res.status(201).json(
      ok('UBL OrderResponse generated successfully.', {
        orderID: result.orderID,
        responseID: result.responseID,
        ubl_xml: result.ubl_xml,
      })
    );
  } catch (err: unknown) {
    res.status(500).json(
      fail('Failed to generate order response', {
        code: 'ORDER_RESPONSE_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    );
  }
});

router.patch('/:id/detail', async (req: Request, res: Response) => {
  const validationErrors = validateOrderDetailPatch(req.body);
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
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      res.status(500).json(
        fail('Failed to update order detail', {
          code: 'UPDATE_ORDER_DETAIL_ERROR',
          message: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set',
        })
      );
      return;
    }

    const body = req.body as {
      currency?: string;
      issue_date?: string;
      order_note?: string | null;
    };

    const result = await patchOrderDetail(String(req.params.id), body);

    if (result === null) {
      res.status(404).json(
        fail('Order not found', {
          code: 'ORDER_NOT_FOUND',
          message: 'Order with the given ID does not exist.',
        })
      );
      return;
    }

    res.status(200).json(ok('Order detail updated successfully.', result));
  } catch (err: unknown) {
    if (err instanceof AppError) {
      res.status(err.status).json(
        fail(err.message, { code: err.code, message: err.message })
      );
      return;
    }
    res.status(500).json(
      fail('Failed to update order detail', {
        code: 'UPDATE_ORDER_DETAIL_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    );
  }
});

router.patch('/:orderID/party-country', async (req: Request, res: Response) => {
  const validationErrors = validatePartyCountryUpdate(req.body);

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
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json(
        fail('Failed to update order party country', {
          code: 'UPDATE_ORDER_ERROR',
          message: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set',
        })
      );
    }
    const { role, country } = req.body;
    const result = await updateOrderPartyCountry(req.params.orderID as string, role, country);

    if (result === null) {
      return res.status(404).json(
        fail('Order not found', {
          code: 'ORDER_NOT_FOUND',
          message: 'Order with the given ID does not exist.',
        })
      );
    }

    return res.status(200).json(
      ok('Order party country updated successfully', result)
    );
  } catch (error) {
    return res.status(500).json(
      fail('Failed to update order party country', {
        code: 'UPDATE_ORDER_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    );
  }
});

// POST /orders/:id/invoice
router.post('/:id/invoice', async (req: Request, res: Response): Promise<void> => {
  // Add validation here
  const body = req.body ?? {};
  
  if (body.tax_rate !== undefined) {
    if (typeof body.tax_rate !== 'number' || isNaN(body.tax_rate)) {
      res.status(400).json(fail('Validation failed', {
        code: 'VALIDATION_ERROR',
        message: 'tax_rate must be a number',
      }));
      return;
    }
    if (body.tax_rate < 0 || body.tax_rate > 1) {
      res.status(400).json(fail('Validation failed', {
        code: 'VALIDATION_ERROR',
        message: 'tax_rate must be between 0 and 1',
      }));
      return;
    }
  }

  if (body.issue_date !== undefined) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(body.issue_date) || isNaN(Date.parse(body.issue_date))) {
      res.status(400).json(fail('Validation failed', {
        code: 'VALIDATION_ERROR',
        message: 'issue_date must be a valid date in YYYY-MM-DD format',
      }));
      return;
    }
  }
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    res.status(500).json(
      fail('Failed to generate invoice', {
        code: 'INVOICE_ERROR',
        message: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set',
      })
    );
    return;
  }

  try {
    const result = await generateInvoiceForOrder(String(req.params.id), body);

    if (result === null) {
      res.status(404).json(
        fail('Order not found', {
          code: 'ORDER_NOT_FOUND',
          message: 'Order with the given  ID does not exist.',
        })
      );
      return;
    }

    res.status(201).json(
      ok('UBL Invoice generated successfully.', result)
    );
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
      fail('Failed to generate invoice', {
        code: 'INVOICE_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    );
  }
});
export default router;