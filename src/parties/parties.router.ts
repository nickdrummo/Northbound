import { Router, Request, Response } from 'express';
import { ok, fail } from '../errors';
import { getOrdersByParty, getPartyInsightsSession, getPartyReport } from '../orders/orders.manage';

const router = Router();

function supabaseGuard(res: Response): boolean {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        res.status(500).json(
            fail('Service unavailable', {
                code: 'CONFIGURATION_ERROR',
                message: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set',
            })
        );
        return false;
    }
    return true;
}

// GET /parties/buyers/:externalID/orders
router.get('/buyers/:externalID/orders', async (req: Request, res: Response) => {
    if (!supabaseGuard(res)) return;

    try {
        const result = await getOrdersByParty(String(req.params.externalID), 'buyer');

        if (!result) {
            return res.status(404).json(
                fail('Buyer not found', {
                    code: 'PARTY_NOT_FOUND',
                    message: 'No buyer with the given external ID exists.',
                })
            );
        }

        return res.status(200).json(ok('Orders retrieved successfully', result));
    } catch (err) {
        return res.status(500).json(
            fail('Failed to retrieve orders', {
                code: 'LIST_ORDERS_ERROR',
                message: err instanceof Error ? err.message : 'Unknown error',
            })
        );
    }
});

// GET /parties/sellers/:externalID/orders
router.get('/sellers/:externalID/orders', async (req: Request, res: Response) => {
    if (!supabaseGuard(res)) return;

    try {
        const result = await getOrdersByParty(String(req.params.externalID), 'seller');

        if (!result) {
            return res.status(404).json(
                fail('Seller not found', {
                    code: 'PARTY_NOT_FOUND',
                    message: 'No seller with the given external ID exists.',
                })
            );
        }

        return res.status(200).json(ok('Orders retrieved successfully', result));
    } catch (err) {
        return res.status(500).json(
            fail('Failed to retrieve orders', {
                code: 'LIST_ORDERS_ERROR',
                message: err instanceof Error ? err.message : 'Unknown error',
            })
        );
    }
});

// GET /parties/buyers/:externalID/report
router.get('/buyers/:externalID/report', async (req: Request, res: Response) => {
    if (!supabaseGuard(res)) return;

    try {
        const result = await getPartyReport(String(req.params.externalID), 'buyer');

        if (!result) {
            return res.status(404).json(
                fail('Buyer not found', {
                    code: 'PARTY_NOT_FOUND',
                    message: 'No buyer with the given external ID exists.',
                })
            );
        }

        return res.status(200).json(ok('Report generated successfully', result));
    } catch (err) {
        return res.status(500).json(
            fail('Failed to generate report', {
                code: 'REPORT_ERROR',
                message: err instanceof Error ? err.message : 'Unknown error',
            })
        );
    }
});

// GET /parties/buyers/:externalID/insights
router.get('/buyers/:externalID/insights', async (req: Request, res: Response) => {
    if (!supabaseGuard(res)) return;

    try {
        const result = await getPartyInsightsSession(String(req.params.externalID), 'buyer');

        if (!result) {
            return res.status(404).json(
                fail('Buyer not found', {
                    code: 'PARTY_NOT_FOUND',
                    message: 'No buyer with the given external ID exists.',
                })
            );
        }

        return res.status(200).json(ok('Insights generated successfully', result));
    } catch (err) {
        return res.status(500).json(
            fail('Failed to generate insights', {
                code: 'INSIGHTS_ERROR',
                message: err instanceof Error ? err.message : 'Unknown error',
            })
        );
    }
});

// GET /parties/sellers/:externalID/report
router.get('/sellers/:externalID/report', async (req: Request, res: Response) => {
    if (!supabaseGuard(res)) return;

    try {
        const result = await getPartyReport(String(req.params.externalID), 'seller');

        if (!result) {
            return res.status(404).json(
                fail('Seller not found', {
                    code: 'PARTY_NOT_FOUND',
                    message: 'No seller with the given external ID exists.',
                })
            );
        }

        return res.status(200).json(ok('Report generated successfully', result));
    } catch (err) {
        return res.status(500).json(
            fail('Failed to generate report', {
                code: 'REPORT_ERROR',
                message: err instanceof Error ? err.message : 'Unknown error',
            })
        );
    }
});

// GET /parties/sellers/:externalID/insights
router.get('/sellers/:externalID/insights', async (req: Request, res: Response) => {
    if (!supabaseGuard(res)) return;

    try {
        const result = await getPartyInsightsSession(String(req.params.externalID), 'seller');

        if (!result) {
            return res.status(404).json(
                fail('Seller not found', {
                    code: 'PARTY_NOT_FOUND',
                    message: 'No seller with the given external ID exists.',
                })
            );
        }

        return res.status(200).json(ok('Insights generated successfully', result));
    } catch (err) {
        return res.status(500).json(
            fail('Failed to generate insights', {
                code: 'INSIGHTS_ERROR',
                message: err instanceof Error ? err.message : 'Unknown error',
            })
        );
    }
});

export default router;
