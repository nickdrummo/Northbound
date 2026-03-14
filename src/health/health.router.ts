import { Router, type Request, type Response } from 'express';

const router = Router();
const startTime = Date.now();

router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: process.env.npm_package_version ?? 'unknown',
  });
});

export default router;
