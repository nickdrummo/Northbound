import {
    OrderInput,
    Party,
    OrderLine,
    RecurringOrderInput,
    RecurringOrderUpdate,
    RecurringOrder,
    OrderDetailPatch,
    OrderResponseInput,
    PartySession,
    PartyReport,
    PartyOrderSummary,
    CurrencyBreakdown,
    InvoiceInput,
    InvoiceLine,
    InvoiceTotals,
    InvoiceResult,
} from "./order.types";
import { createClient } from '@supabase/supabase-js';
import { generateUBL, generateOrderResponseUBL, generateInvoiceUBL } from './ubl.service';
import { AppError } from '../errors';
import dotenv from 'dotenv';

dotenv.config();

// Connect to the Supabase database using the URL and key, if configured
function getSupabase() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
    }
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
    );
}

type DispatchAdviceStatus =
    | 'CREATED'
    | 'RETRIEVED'
    | 'CANCELLED_ORDER'
    | 'CANCELLED_FULFILMENT'
    | 'ERROR';

// Saves a new order to the database. Matches schema: parties.id (uuid), orders.buyer_id/seller_id (uuid FK), order_lines.
export async function storeOrder(orderID: string, orderInput: OrderInput, _ublXml: string): Promise<void> {
    const supabase = getSupabase();

    // 1. Upsert buyer party and get parties.id (uuid)
    const { data: buyerRow, error: buyerErr } = await supabase
        .from('parties')
        .upsert(
            {
                external_id: orderInput.buyer.external_id,
                name: orderInput.buyer.name,
                email: orderInput.buyer.email ?? null,
                street: orderInput.buyer.street ?? null,
                city: orderInput.buyer.city ?? null,
                country: orderInput.buyer.country ?? null,
                postal_code: orderInput.buyer.postal_code ?? null,
            },
            { onConflict: 'external_id' }
        )
        .select('id')
        .single();

    if (buyerErr || !buyerRow) {
        throw new Error(`Failed to store buyer: ${buyerErr?.message ?? 'unknown'}`);
    }

    // 2. Upsert seller party and get parties.id (uuid)
    const { data: sellerRow, error: sellerErr } = await supabase
        .from('parties')
        .upsert(
            {
                external_id: orderInput.seller.external_id,
                name: orderInput.seller.name,
                email: orderInput.seller.email ?? null,
                street: orderInput.seller.street ?? null,
                city: orderInput.seller.city ?? null,
                country: orderInput.seller.country ?? null,
                postal_code: orderInput.seller.postal_code ?? null,
            },
            { onConflict: 'external_id' }
        )
        .select('id')
        .single();

    if (sellerErr || !sellerRow) {
        throw new Error(`Failed to store seller: ${sellerErr?.message ?? 'unknown'}`);
    }

    // 3. Insert order with buyer_id/seller_id as party UUIDs (schema: orders.buyer_id, orders.seller_id are uuid FK to parties.id)
    const { error: orderErr } = await supabase.from('orders').insert({
        id: orderID,
        buyer_id: buyerRow.id,
        seller_id: sellerRow.id,
        currency: orderInput.currency,
        issue_date: orderInput.issue_date,
        order_note: orderInput.order_note ?? null,
    });

    if (orderErr) {
        throw new Error(`Failed to store order: ${orderErr.message}`);
    }

    // 4. Insert order lines (schema: order_lines.order_id uuid, line_id, description, quantity, unit_price, unit_code)
    const lines = orderInput.order_lines.map((line) => ({
        order_id: orderID,
        line_id: line.line_id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        unit_code: line.unit_code ?? 'EA',
    }));

    const { error: linesError } = await supabase.from('order_lines').insert(lines);

    if (linesError) {
        throw new Error(`Failed to store order lines: ${linesError.message}`);
    }
}

// Retrieves a single order by its ID
export async function retrieveOrderByID(orderID: string) {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderID)
        .single();

    if (error) return null;
    return data;
}

/**
 * Replace an existing order with a new full payload (parties, header, lines), regenerate UBL.
 * Used by PUT /orders/:id/change (and `/v1/orders/...`) — keeps the same order id.
 */
export async function updateOrderWithFullPayload(
    orderID: string,
    orderInput: OrderInput
): Promise<{ orderID: string; ubl_xml: string }> {
    const supabase = getSupabase();

    const existing = await retrieveOrderByID(orderID);
    if (!existing) {
        throw new AppError(
            'ORDER_NOT_FOUND',
            'Order with the given ID does not exist.',
            404
        );
    }

    const { data: buyerRow, error: buyerErr } = await supabase
        .from('parties')
        .upsert(
            {
                external_id: orderInput.buyer.external_id,
                name: orderInput.buyer.name,
                email: orderInput.buyer.email ?? null,
                street: orderInput.buyer.street ?? null,
                city: orderInput.buyer.city ?? null,
                country: orderInput.buyer.country ?? null,
                postal_code: orderInput.buyer.postal_code ?? null,
            },
            { onConflict: 'external_id' }
        )
        .select('id')
        .single();

    if (buyerErr || !buyerRow) {
        throw new Error(`Failed to update buyer: ${buyerErr?.message ?? 'unknown'}`);
    }

    const { data: sellerRow, error: sellerErr } = await supabase
        .from('parties')
        .upsert(
            {
                external_id: orderInput.seller.external_id,
                name: orderInput.seller.name,
                email: orderInput.seller.email ?? null,
                street: orderInput.seller.street ?? null,
                city: orderInput.seller.city ?? null,
                country: orderInput.seller.country ?? null,
                postal_code: orderInput.seller.postal_code ?? null,
            },
            { onConflict: 'external_id' }
        )
        .select('id')
        .single();

    if (sellerErr || !sellerRow) {
        throw new Error(`Failed to update seller: ${sellerErr?.message ?? 'unknown'}`);
    }

    const { error: orderErr } = await supabase
        .from('orders')
        .update({
            buyer_id: buyerRow.id,
            seller_id: sellerRow.id,
            currency: orderInput.currency,
            issue_date: orderInput.issue_date,
            order_note: orderInput.order_note ?? null,
        })
        .eq('id', orderID);

    if (orderErr) {
        throw new Error(`Failed to update order: ${orderErr.message}`);
    }

    const { error: delErr } = await supabase
        .from('order_lines')
        .delete()
        .eq('order_id', orderID);

    if (delErr) {
        throw new Error(`Failed to clear order lines: ${delErr.message}`);
    }

    const lines = orderInput.order_lines.map((line) => ({
        order_id: orderID,
        line_id: line.line_id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        unit_code: line.unit_code ?? 'EA',
    }));

    const { error: insErr } = await supabase.from('order_lines').insert(lines);

    if (insErr) {
        throw new Error(`Failed to insert order lines: ${insErr.message}`);
    }

    const result = generateUBL(orderInput, orderID);
    return { orderID: result.orderID, ubl_xml: result.ubl_xml };
}

/**
 * Cancel (delete) an existing order.
 * Used by POST /orders/:id/cancel (and `/v1/orders/...`).
 */
export async function cancelOrder(orderID: string): Promise<{ orderID: string }> {
    const supabase = getSupabase();

    const existing = await retrieveOrderByID(orderID);
    if (!existing) {
        throw new AppError(
            'ORDER_NOT_FOUND',
            'Order with the given ID does not exist.',
            404
        );
    }

    const { error: delLinesErr } = await supabase
        .from('order_lines')
        .delete()
        .eq('order_id', orderID);

    if (delLinesErr) {
        throw new Error(`Failed to clear order lines: ${delLinesErr.message}`);
    }

    const { error: delOrderErr } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderID);

    if (delOrderErr) {
        throw new Error(`Failed to delete order: ${delOrderErr.message}`);
    }

    return { orderID };
}

export async function listOrders() {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('orders')
        .select('*');

    if (error) {
        throw new Error(`Failed to list orders: ${error.message}`);
    }

    return data;
}

export async function retrieveOrderXML(orderID: string): Promise<string> {
    const supabase = getSupabase();

    //Get order
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderID)
        .single();

    if (orderError || !order) {
        throw new Error('Order not found');
    }

    // Get buyer 
    const { data: buyer, error: buyerError } = await supabase
        .from('parties')
        .select('*')
        .eq('id', order.buyer_id)
        .single();

    if (buyerError || !buyer) {
        throw new Error('Buyer not found');
    }

    //Get seller
    const { data: seller, error: sellerError } = await supabase
        .from('parties')
        .select('*')
        .eq('id', order.seller_id)
        .single();

    if (sellerError || !seller) {
        throw new Error('Seller not found');
    }

    //Get order lines
    const { data: lines, error: linesError } = await supabase
        .from('order_lines')
        .select('*')
        .eq('order_id', orderID);

    if (linesError) {
        throw new Error(`Failed to retrieve order lines: ${linesError.message}`);
    }

    const rebuiltOrderInput: OrderInput = {
        buyer: {
            external_id: buyer.external_id,
            name: buyer.name,
            email: buyer.email,
            street: buyer.street,
            city: buyer.city,
            country: buyer.country,
            postal_code: buyer.postal_code,
        },
        seller: {
            external_id: seller.external_id,
            name: seller.name,
            email: seller.email,
            street: seller.street,
            city: seller.city,
            country: seller.country,
            postal_code: seller.postal_code,
        },
        currency: order.currency,
        issue_date: order.issue_date,
        order_note: order.order_note,
        order_lines: (lines ?? []).map((line: any) => ({
            line_id: line.line_id,
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unit_price,
            unit_code: line.unit_code,
        })),
    };

    const result = generateUBL(rebuiltOrderInput, order.id);
    return result.ubl_xml;
}

/**
 * Records DevEx despatch advice IDs in Supabase for an order.
 * Upserts on `devex_advice_id` so retries don't create duplicates.
 */
export async function upsertDispatchAdvicesForOrder(
    orderID: string,
    devexAdviceIDs: string[],
    status: DispatchAdviceStatus = 'CREATED'
): Promise<void> {
    const supabase = getSupabase();

    if (devexAdviceIDs.length === 0) return;

    const nowIso = new Date().toISOString();
    const rows = devexAdviceIDs.map((id) => ({
        order_id: orderID,
        devex_advice_id: id,
        status,
        updated_at: nowIso,
    }));

    const { error } = await supabase
        .from('dispatch_advices')
        .upsert(rows, { onConflict: 'devex_advice_id' });

    if (error) {
        throw new Error(`Failed to store dispatch advice ids: ${error.message}`);
    }
}

/**
 * Update a stored dispatch advice row with retrieved XML and sync timestamp.
 * Falls back to upsert (by devex_advice_id) if the row doesn't exist yet.
 */
export async function syncDispatchAdviceXml(params: {
    orderID: string;
    devexAdviceID: string;
    dispatchXml: string;
    status?: DispatchAdviceStatus;
}): Promise<void> {
    const supabase = getSupabase();
    const nowIso = new Date().toISOString();
    const status = params.status ?? 'RETRIEVED';

    const { error } = await supabase.from('dispatch_advices').upsert(
        {
            order_id: params.orderID,
            devex_advice_id: params.devexAdviceID,
            status,
            dispatch_xml: params.dispatchXml,
            last_synced_at: nowIso,
            updated_at: nowIso,
        },
        { onConflict: 'devex_advice_id' }
    );

    if (error) {
        throw new Error(`Failed to sync dispatch advice: ${error.message}`);
    }
}

// Upserts a party and returns its internal UUID (shared helper)
async function upsertParty(supabase: ReturnType<typeof getSupabase>, party: Party): Promise<string> {
    const { data, error } = await supabase
        .from('parties')
        .upsert(
            {
                external_id: party.external_id,
                name: party.name,
                email: party.email ?? null,
                street: party.street ?? null,
                city: party.city ?? null,
                country: party.country ?? null,
                postal_code: party.postal_code ?? null,
            },
            { onConflict: 'external_id' }
        )
        .select('id')
        .single();

    if (error || !data) {
        throw new Error(`Failed to upsert party: ${error?.message ?? 'unknown'}`);
    }
    return data.id;
}

// Creates a new recurring order template in the database
export async function createRecurringOrder(input: RecurringOrderInput): Promise<RecurringOrder> {
    const supabase = getSupabase();

    const buyerId = await upsertParty(supabase, input.buyer);
    const sellerId = await upsertParty(supabase, input.seller);

    const { randomUUID } = await import('crypto');
    const id = randomUUID();

    const { data, error } = await supabase
        .from('orders')
        .insert({
            id,
            buyer_id: buyerId,
            seller_id: sellerId,
            currency: input.currency,
            issue_date: input.recur_start_date,
            order_note: input.order_note ?? null,
            is_recurring: true,
            frequency: input.frequency,
            recur_interval: input.recur_interval,
            recur_start_date: input.recur_start_date,
            recur_end_date: input.recur_end_date ?? null,
        })
        .select()
        .single();

    if (error || !data) {
        throw new Error(`Failed to create recurring order: ${error?.message ?? 'unknown'}`);
    }

    const lines = input.order_lines.map((line) => ({
        order_id: id,
        line_id: line.line_id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        unit_code: line.unit_code ?? 'EA',
    }));

    const { error: linesError } = await supabase.from('order_lines').insert(lines);

    if (linesError) {
        throw new Error(`Failed to store recurring order lines: ${linesError.message}`);
    }

    return data as RecurringOrder;
}

export async function deleteRecurringOrder(orderID: string): Promise<RecurringOrder | null> {
    const supabase = getSupabase();

    const { data: existing, error: fetchErr } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderID)
        .eq('is_recurring', true)
        .single();

    if (fetchErr || !existing) {
        return null;
    }

    const { error: delLinesErr } = await supabase
        .from('order_lines')
        .delete()
        .eq('order_id', orderID);

    if (delLinesErr) {
        throw new Error(`Failed to delete order lines: ${delLinesErr.message}`);
    }

    const { error: delOrderErr } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderID);

    if (delOrderErr) {
        throw new Error(`Failed to delete recurring order: ${delOrderErr.message}`);
    }

    return existing as RecurringOrder;
}

export async function updateOrderPartyCountry(
  orderID: string,
  role: 'buyer' | 'seller',
  country: string
) {
  const supabase = getSupabase();
  const normalisedCountry = country.trim().toUpperCase();

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderID)
    .single();

  if (orderError || !order) {
    return null;
  }

  const partyID = role === 'buyer' ? order.buyer_id : order.seller_id;

  const { error: updateError } = await supabase
    .from('parties')
    .update({ country: normalisedCountry })
    .eq('id', partyID);

  if (updateError) {
    throw new Error(`Failed to update ${role} country: ${updateError.message}`);
  }

  const { data: buyer, error: buyerError } = await supabase
    .from('parties')
    .select('*')
    .eq('id', order.buyer_id)
    .single();

  if (buyerError || !buyer) {
    throw new Error('Buyer not found');
  }

  const { data: seller, error: sellerError } = await supabase
    .from('parties')
    .select('*')
    .eq('id', order.seller_id)
    .single();

  if (sellerError || !seller) {
    throw new Error('Seller not found');
  }

  const { data: lines, error: linesError } = await supabase
    .from('order_lines')
    .select('*')
    .eq('order_id', orderID);

  if (linesError) {
    throw new Error(`Failed to retrieve order lines: ${linesError.message}`);
  }

  const rebuiltOrderInput: OrderInput = {
    buyer: {
      external_id: buyer.external_id,
      name: buyer.name,
      email: buyer.email,
      street: buyer.street,
      city: buyer.city,
      country: buyer.country,
      postal_code: buyer.postal_code,
    },
    seller: {
      external_id: seller.external_id,
      name: seller.name,
      email: seller.email,
      street: seller.street,
      city: seller.city,
      country: seller.country,
      postal_code: seller.postal_code,
    },
    currency: order.currency,
    issue_date: order.issue_date,
    order_note: order.order_note,
    order_lines: (lines ?? []).map((line: any) => ({
      line_id: line.line_id,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
      unit_code: line.unit_code,
    })),
  };

  const result = generateUBL(rebuiltOrderInput, order.id);

  return {
    orderID: order.id,
    role,
    country: normalisedCountry,
    currency: order.currency,
    issue_date: order.issue_date,
    order_note: order.order_note,
    buyer: rebuiltOrderInput.buyer,
    seller: rebuiltOrderInput.seller,
    order_lines: rebuiltOrderInput.order_lines,
    ubl_xml: result.ubl_xml,
  };

}

/**
 * Partial update of header fields on a **non-recurring** order; regenerates UBL Order XML.
 * Recurring templates must use PATCH /orders/recurring/:id.
 */
export async function patchOrderDetail(
    orderID: string,
    patch: OrderDetailPatch
): Promise<{
    orderID: string;
    currency: string;
    issue_date: string;
    order_note: string | null;
    ubl_xml: string;
} | null> {
    const supabase = getSupabase();

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderID)
        .single();

    if (orderError || !order) {
        return null;
    }

    if (order.is_recurring === true) {
        throw new AppError(
            'USE_RECURRING_PATCH',
            'Recurring orders must be updated with PATCH /orders/recurring/{id}.',
            400
        );
    }

    const orderFields: Record<string, unknown> = {};
    if (patch.currency !== undefined) {
        orderFields.currency = patch.currency;
    }
    if (patch.issue_date !== undefined) {
        orderFields.issue_date = patch.issue_date;
    }
    if (patch.order_note !== undefined) {
        orderFields.order_note =
            patch.order_note === '' || patch.order_note === null ? null : patch.order_note;
    }

    if (Object.keys(orderFields).length === 0) {
        throw new AppError('VALIDATION_ERROR', 'No valid fields to update.', 400);
    }

    const { error: updateErr } = await supabase
        .from('orders')
        .update(orderFields)
        .eq('id', orderID);

    if (updateErr) {
        throw new Error(`Failed to update order: ${updateErr.message}`);
    }

    const { data: refreshed, error: refetchErr } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderID)
        .single();

    if (refetchErr || !refreshed) {
        throw new Error('Failed to retrieve order after update');
    }

    const { data: buyer, error: buyerError } = await supabase
        .from('parties')
        .select('*')
        .eq('id', refreshed.buyer_id)
        .single();

    if (buyerError || !buyer) {
        throw new Error('Buyer not found');
    }

    const { data: seller, error: sellerError } = await supabase
        .from('parties')
        .select('*')
        .eq('id', refreshed.seller_id)
        .single();

    if (sellerError || !seller) {
        throw new Error('Seller not found');
    }

    const { data: lines, error: linesError } = await supabase
        .from('order_lines')
        .select('*')
        .eq('order_id', orderID);

    if (linesError) {
        throw new Error(`Failed to retrieve order lines: ${linesError.message}`);
    }

    const rebuiltOrderInput: OrderInput = {
        buyer: {
            external_id: buyer.external_id,
            name: buyer.name,
            email: buyer.email,
            street: buyer.street,
            city: buyer.city,
            country: buyer.country,
            postal_code: buyer.postal_code,
        },
        seller: {
            external_id: seller.external_id,
            name: seller.name,
            email: seller.email,
            street: seller.street,
            city: seller.city,
            country: seller.country,
            postal_code: seller.postal_code,
        },
        currency: refreshed.currency,
        issue_date: refreshed.issue_date,
        order_note: refreshed.order_note,
        order_lines: (lines ?? []).map((line: any) => ({
            line_id: line.line_id,
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unit_price,
            unit_code: line.unit_code,
        })),
    };

    const result = generateUBL(rebuiltOrderInput, refreshed.id);

    return {
        orderID: refreshed.id,
        currency: refreshed.currency,
        issue_date: refreshed.issue_date,
        order_note: refreshed.order_note,
        ubl_xml: result.ubl_xml,
    };
}

/** Build a UBL OrderResponse document for an existing stored order (any order row). */
export async function generateOrderResponseForOrder(
    orderID: string,
    input: OrderResponseInput
): Promise<{ orderID: string; responseID: string; ubl_xml: string } | null> {
    const existing = await retrieveOrderByID(orderID);
    if (!existing) {
        return null;
    }

    const issueDate =
        input.issue_date ?? new Date().toISOString().slice(0, 10);

    const ublParams: {
        referencedOrderID: string;
        responseCode: string;
        issueDate: string;
        note?: string;
    } = {
        referencedOrderID: orderID,
        responseCode: input.response_code,
        issueDate,
    };
    if (input.note !== undefined) {
        ublParams.note = input.note;
    }
    const { responseID, ubl_xml } = generateOrderResponseUBL(ublParams);

    return { orderID, responseID, ubl_xml };
}

/**
 * Update an existing recurring order with a partial payload.
 * Only provided fields are updated. If order_lines is provided, they are replaced entirely.
 * Used by PATCH /orders/recurring/:id
 */
export async function updateRecurringOrder(
    orderID: string,
    update: RecurringOrderUpdate
): Promise<RecurringOrder> {
    const supabase = getSupabase();

    // Verify the order exists and is recurring
    const { data: existing, error: fetchErr } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderID)
        .eq('is_recurring', true)
        .single();

    if (fetchErr || !existing) {
        throw new AppError(
            'RECURRING_ORDER_NOT_FOUND',
            'Recurring order with the given ID does not exist.',
            404
        );
    }

    // Validate recur_end_date against the effective start date (from request or existing DB value)
    if ('recur_end_date' in update && update.recur_end_date != null) {
        const effectiveStartDate = update.recur_start_date ?? existing.recur_start_date;
        if (effectiveStartDate && update.recur_end_date <= effectiveStartDate) {
            throw new AppError(
                'VALIDATION_ERROR',
                'recur_end_date must be after recur_start_date',
                400
            );
        }
    }

    // Build the fields to update on the orders table
    const orderFields: Record<string, unknown> = {};

    if (update.buyer !== undefined) {
        orderFields.buyer_id = await upsertParty(supabase, update.buyer);
    }
    if (update.seller !== undefined) {
        orderFields.seller_id = await upsertParty(supabase, update.seller);
    }
    if (update.currency !== undefined) orderFields.currency = update.currency;
    if (update.order_note !== undefined) orderFields.order_note = update.order_note;
    if (update.frequency !== undefined) orderFields.frequency = update.frequency;
    if (update.recur_interval !== undefined) orderFields.recur_interval = update.recur_interval;
    if (update.recur_start_date !== undefined) orderFields.recur_start_date = update.recur_start_date;
    if ('recur_end_date' in update) orderFields.recur_end_date = update.recur_end_date ?? null;

    if (Object.keys(orderFields).length > 0) {
        const { error: updateErr } = await supabase
            .from('orders')
            .update(orderFields)
            .eq('id', orderID);

        if (updateErr) {
            throw new Error(`Failed to update recurring order: ${updateErr.message}`);
        }
    }

    // Replace order lines if provided
    if (update.order_lines !== undefined) {
        // Fetch existing lines first so we can restore them if insert fails
        const { data: existingLines, error: fetchLinesErr } = await supabase
            .from('order_lines')
            .select('*')
            .eq('order_id', orderID);

        if (fetchLinesErr) {
            throw new Error(`Failed to fetch existing order lines: ${fetchLinesErr.message}`);
        }

        const { error: delErr } = await supabase
            .from('order_lines')
            .delete()
            .eq('order_id', orderID);

        if (delErr) {
            throw new Error(`Failed to clear order lines: ${delErr.message}`);
        }

        const lines = update.order_lines.map((line) => ({
            order_id: orderID,
            line_id: line.line_id,
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unit_price,
            unit_code: line.unit_code ?? 'EA',
        }));

        const { error: insErr } = await supabase.from('order_lines').insert(lines);

        if (insErr) {
            // Attempt to restore original lines to avoid data loss
            if (existingLines && existingLines.length > 0) {
                await supabase.from('order_lines').insert(existingLines);
            }
            throw new Error(`Failed to insert updated order lines: ${insErr.message}`);
        }
    }

    // Return the updated record
    const { data: updated, error: refetchErr } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderID)
        .single();

    if (refetchErr || !updated) {
        throw new Error('Failed to retrieve updated recurring order');
    }

    return updated as RecurringOrder;
}

// Returns the order history for a party identified by external_id and role
export async function getOrdersByParty(
    externalID: string,
    role: 'buyer' | 'seller'
): Promise<PartySession | null> {
    const supabase = getSupabase();

    const { data: partyRow, error: partyErr } = await supabase
        .from('parties')
        .select('*')
        .eq('external_id', externalID)
        .single();

    if (partyErr || !partyRow) {
        return null;
    }

    const column = role === 'buyer' ? 'buyer_id' : 'seller_id';

    const { data: orders, error: ordersErr } = await supabase
        .from('orders')
        .select('*')
        .eq(column, partyRow.id)
        .order('issue_date', { ascending: true });

    if (ordersErr) {
        throw new Error(`Failed to retrieve orders: ${ordersErr.message}`);
    }

    const orderRows = orders ?? [];

    // Fetch all order lines in one query
    const orderIds = orderRows.map((o: any) => o.id);
    let linesByOrderId: Record<string, OrderLine[]> = {};

    if (orderIds.length > 0) {
        const { data: lines, error: linesErr } = await supabase
            .from('order_lines')
            .select('*')
            .in('order_id', orderIds);

        if (linesErr) {
            throw new Error(`Failed to retrieve order lines: ${linesErr.message}`);
        }

        for (const line of lines ?? []) {
            if (!linesByOrderId[line.order_id]) {
                linesByOrderId[line.order_id] = [];
            }
            (linesByOrderId[line.order_id] as OrderLine[]).push({
                line_id: line.line_id,
                description: line.description,
                quantity: line.quantity,
                unit_price: line.unit_price,
                unit_code: line.unit_code,
            });
        }
    }

    const party: Party = {
        external_id: partyRow.external_id,
        name: partyRow.name,
        email: partyRow.email ?? undefined,
        street: partyRow.street ?? undefined,
        city: partyRow.city ?? undefined,
        country: partyRow.country ?? undefined,
        postal_code: partyRow.postal_code ?? undefined,
    };

    return {
        party,
        role,
        orders: orderRows.map((order: any) => ({
            order_id: order.id,
            currency: order.currency,
            issue_date: order.issue_date,
            order_note: order.order_note ?? null,
            is_recurring: order.is_recurring ?? false,
            order_lines: linesByOrderId[order.id] ?? [],
        })),
    };
}

// Returns an aggregated spending/sales report for a party
export async function getPartyReport(
    externalID: string,
    role: 'buyer' | 'seller'
): Promise<PartyReport | null> {
    const session = await getOrdersByParty(externalID, role);
    if (!session) return null;

    const orderSummaries: PartyOrderSummary[] = session.orders.map((order) => {
        const orderValue = order.order_lines.reduce(
            (sum, line) => sum + line.quantity * line.unit_price,
            0
        );
        return {
            order_id: order.order_id,
            currency: order.currency,
            issue_date: order.issue_date,
            order_note: order.order_note,
            order_value: Math.round(orderValue * 100) / 100,
            line_count: order.order_lines.length,
        };
    });

    const totalValue = orderSummaries.reduce((sum, o) => sum + o.order_value, 0);
    const orderCount = orderSummaries.length;
    const avgOrderValue = orderCount > 0 ? totalValue / orderCount : 0;

    const currencies: Record<string, CurrencyBreakdown> = {};
    for (const o of orderSummaries) {
        if (!currencies[o.currency]) {
            currencies[o.currency] = { order_count: 0, total_value: 0 };
        }
        const cb = currencies[o.currency] as CurrencyBreakdown;
        cb.order_count++;
        cb.total_value = Math.round((cb.total_value + o.order_value) * 100) / 100;
    }

    const sortedDates = orderSummaries.map((o) => o.issue_date).filter(Boolean).sort();

    return {
        party: session.party,
        role,
        order_count: orderCount,
        total_value: Math.round(totalValue * 100) / 100,
        avg_order_value: Math.round(avgOrderValue * 100) / 100,
        currencies,
        first_order_date: sortedDates[0] ?? null,
        last_order_date: sortedDates[sortedDates.length - 1] ?? null,
        orders: orderSummaries,
    };
}


/**
 * Generates a UBL Invoice from a stored order.
 * Pulls order, buyer, seller, and lines from Supabase,
 * computes totals, and returns a full InvoiceResult with UBL XML.
 */
export async function generateInvoiceForOrder(
    orderID: string,
    input: InvoiceInput
): Promise<InvoiceResult | null> {
    const supabase = getSupabase();

    // Fetch the order
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderID)
        .single();

    if (orderError || !order) return null;

    // Fetch buyer
    const { data: buyer, error: buyerError } = await supabase
        .from('parties')
        .select('*')
        .eq('id', order.buyer_id)
        .single();

    if (buyerError || !buyer) throw new Error('Buyer not found');

    // Fetch seller
    const { data: seller, error: sellerError } = await supabase
        .from('parties')
        .select('*')
        .eq('id', order.seller_id)
        .single();

    if (sellerError || !seller) throw new Error('Seller not found');

    // Fetch order lines
    const { data: lines, error: linesError } = await supabase
        .from('order_lines')
        .select('*')
        .eq('order_id', orderID);

    if (linesError) throw new Error(`Failed to retrieve order lines: ${linesError.message}`);

    // Compute invoice lines and totals
    const taxRate = input.tax_rate ?? 0;

    const invoiceLines: InvoiceLine[] = (lines ?? []).map((line: any) => ({
        line_id: line.line_id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        unit_code: line.unit_code ?? 'EA',
        line_total: Math.round(line.quantity * line.unit_price * 100) / 100,
    }));

    const lineExtensionAmount =
        Math.round(invoiceLines.reduce((sum, l) => sum + l.line_total, 0) * 100) / 100;
    const taxAmount = Math.round(lineExtensionAmount * taxRate * 100) / 100;
    const taxInclusiveAmount = Math.round((lineExtensionAmount + taxAmount) * 100) / 100;

    const totals: InvoiceTotals = {
        line_extension_amount: lineExtensionAmount,
        tax_amount: taxAmount,
        tax_inclusive_amount: taxInclusiveAmount,
        payable_amount: taxInclusiveAmount,
    };

    // Generate invoice ID and issue date
    const { randomUUID } = await import('crypto');
    const invoiceID = randomUUID();
    const issueDate = input.issue_date ?? new Date().toISOString().slice(0, 10);

    // Build parties in the shape generateInvoiceUBL expects
    const buyerParty: Party = {
        external_id: buyer.external_id,
        name: buyer.name,
        email: buyer.email ?? undefined,
        street: buyer.street ?? undefined,
        city: buyer.city ?? undefined,
        country: buyer.country ?? undefined,
        postal_code: buyer.postal_code ?? undefined,
    };

    const sellerParty: Party = {
        external_id: seller.external_id,
        name: seller.name,
        email: seller.email ?? undefined,
        street: seller.street ?? undefined,
        city: seller.city ?? undefined,
        country: seller.country ?? undefined,
        postal_code: seller.postal_code ?? undefined,
    };

    // Generate UBL XML
    const { ubl_xml } = generateInvoiceUBL({
        invoiceID,
        orderID,
        issueDate,
        currency: order.currency,
        buyer: buyerParty,
        seller: sellerParty,
        invoiceLines,
        totals,
        invoiceNote: input.invoice_note,
        taxRate,
    });

    return {
        invoice_id: invoiceID,
        order_id: orderID,
        issue_date: issueDate,
        currency: order.currency,
        buyer: buyerParty,
        seller: sellerParty,
        invoice_lines: invoiceLines,
        totals,
        invoice_note: input.invoice_note,
        ubl_xml,
    };
}