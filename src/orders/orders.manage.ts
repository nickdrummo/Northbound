import { OrderInput } from "./order.types"; 
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config();
// Connect to the Supabase database using the URL and key
function getSupabase() {
    return createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!
    );
}

// Stores a new order to the database
// Taking orderID, orderInput(additional info on the order), and generated XML
export async function storeOrder(orderID: string, orderInput: OrderInput, ublXml: string){
    // create struct of the new Order
    const supabase = getSupabase();
    const newOrder = {
        id: orderID,
        buyer_id: orderInput.buyer.external_id,
        seller_id: orderInput.seller.external_id,
        currency: orderInput.currency,
        issue_date: orderInput.issue_date,
        order_note: orderInput.order_note ?? '',
    };

    // insert newOrder to Supa database
    const { error } = await supabase.from('orders').insert(newOrder);
    if (error) {
        throw new Error(`Failed to store order: ${error.message}`)
    };
}

export async function retrieveOrderByID(orderID: string) {
    // Go to orders table and find the row where the orderID matches
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('orders')
        .select('*')            // get all columns
        .eq('id', orderID)
        .single();

    if (error) {
        return null
    };
    return data;
}