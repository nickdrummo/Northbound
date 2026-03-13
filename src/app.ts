import express from 'express';
import healthRouter from './health/health.router';
import ordersRouter from './orders/orders.router';

const app = express();

app.use(express.json());
app.use('/health', healthRouter);
app.use('/v1/orders', ordersRouter);

export default app;
