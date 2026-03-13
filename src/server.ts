import express from 'express';
import dotenv from 'dotenv';
import authRouter from './auth/routes';

dotenv.config();

const app = express();

app.use(express.json());
app.use(authRouter);

app.get('/health', (_req, res) => {
  return res.json({
    success: true,
    message: 'Service is operational.',
    data: {
      status: 'UP',
      version: '1.0.0',
    },
    error: null,
  });
});

const port = Number(process.env.PORT) || 3000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Northbound API listening on port ${port}`);
  });
}

export default app;

