import express from 'express';
import dotenv from 'dotenv';
import healthRouter from './health/health.router';
import authRouter from './auth/routes';
import ordersRouter from './orders/orders.router';
import cors from 'cors';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use('/health', healthRouter);
app.use(authRouter);
app.use('/v1/orders', ordersRouter);

export default app;