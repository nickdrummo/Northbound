import express from 'express';
import dotenv from 'dotenv';
import healthRouter from './health/health.router';
import authRouter from './auth/routes';
import ordersRouter from './orders/orders.router';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { join } from 'path';

dotenv.config();

const app = express();

app.use(cors());
const swaggerDocument = parse(readFileSync(join(__dirname, '../swagger.yaml'), 'utf8'));

app.use(express.json());
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/health', healthRouter);
app.use(authRouter);
app.use('/v1/orders', ordersRouter);

export default app;
