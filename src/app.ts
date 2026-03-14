import express from 'express';
import healthRouter from './health/health.router';
import authRouter from './auth/routes';

const app = express();

app.use(express.json());
app.use('/health', healthRouter);
app.use(authRouter);

export default app;
