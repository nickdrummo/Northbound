import { OrderInput, Party, OrderLine } from "./order.types"; 
import { createClient } from '@supabase/supabase-js';
import { generateUBL } from './ubl.service';
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