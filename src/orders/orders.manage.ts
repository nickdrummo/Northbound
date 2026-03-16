import { OrderInput, Party, OrderLine } from "./order.types"; 
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { generateUBL } from './ubl.service';

dotenv.config();

// Connect to the Supabase database using the URL and key
function getSupabase() {
    return createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!
    );
}

// Saves a new order to the database
export async function storeOrder(orderID: string, orderInput: OrderInput, ublXml: string): Promise<void> {
    const supabase = getSupabase();

    const newOrder = {
        id: orderID,
        buyer_id: orderInput.buyer.external_id,
        seller_id: orderInput.seller.external_id,
        currency: orderInput.currency,
        issue_date: orderInput.issue_date,
        order_note: orderInput.order_note ?? '',
    };

    const { error } = await supabase.from('orders').insert(newOrder);
    if (error) {
        throw new Error(`Failed to store order: ${error.message}`);
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