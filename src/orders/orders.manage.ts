import { OrderInput, Party, OrderLine, RecurringOrderInput, RecurringOrder } from "./order.types"; 
import { createClient } from '@supabase/supabase-js';
import { generateUBL } from './ubl.service';
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
 * Used by PUT /v2/orders/:id/change — keeps the same order id.
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
 * Used by POST /v2/orders/:id/cancel.
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

// Upserts a party and returns its internal UUID
async function upsertParty(supabase: ReturnType<typeof createClient>, party: Party): Promise<string> {
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

    const { v4: uuidv4 } = await import('uuid');
    const id = uuidv4();

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