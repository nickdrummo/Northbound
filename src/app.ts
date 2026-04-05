import express from 'express';
import dotenv from 'dotenv';
import healthRouter from './health/health.router';
import authRouter from './auth/auth.routes';
import ordersRouter from './orders/orders.router';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { join } from 'path';

dotenv.config();

const app = express();

app.use(cors());
const swaggerDocument = parse(readFileSync(join(__dirname, '../openapi.yaml'), 'utf8'));

app.use(express.json());

// Root: redirect to API docs so the base URL is useful
app.get('/', (_req, res) => {
  res.redirect(302, '/docs');
});

app.use('/health', healthRouter);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use(authRouter);
// `/orders` and `/v1/orders` mount the same router (backward-compatible alias).
app.use('/orders', ordersRouter);
app.use('/v1/orders', ordersRouter);

export default app;
