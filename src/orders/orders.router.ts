import { Router, Request, Response } from 'express';
import { validateOrderInput } from './ubl.validator';
import { generateUBL } from './ubl.service';

const router = Router();

router.post('/generate', (req: Request, res: Response) => {
  const validation = validateOrderInput(req.body);

  if (!validation.valid) {
    return res.status(400).json({
      error: 'Missing UBL fields',
      details: validation.errors,
    });
  }

  try {
    const result = generateUBL(req.body);
    return res.status(201).json(result);
  } catch (err) {
    return res.status(422).json({
      error: 'Schema validation failure',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;
