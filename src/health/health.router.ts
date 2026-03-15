import { Router, type Request, type Response } from 'express';
import { ok } from '../errors';

const router = Router();
const startTime = Date.now();

router.get('/', (_req: Request, res: Response) => {
  return res.status(200).json(
    ok('Service is operational.', {
      status: 'UP',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      version: process.env.npm_package_version ?? 'unknown',
    })
  );
});

export default router;