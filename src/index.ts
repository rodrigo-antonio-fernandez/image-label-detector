import express, { Request, Response } from 'express';
import { config } from './config';
import { Logger } from './utils/logger';
import { TesseractService } from './services/tesseractService';

const app = express();

app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Inicialización del servidor
async function startServer() {
  try {
    Logger.info('Inicializando servicio de detección de etiquetas...');

    // Inicializar Tesseract
    await TesseractService.initialize();

    // Iniciar servidor Express
    app.listen(config.port, () => {
      Logger.info(`Servidor iniciado en puerto ${config.port}`);
      Logger.info(`Health check: http://localhost:${config.port}/health`);
      Logger.info(`API endpoint: http://localhost:${config.port}/api/detect-label`);
    });
  } catch (error) {
    Logger.error('Error iniciando servidor', error);
    process.exit(1);
  }
}

// Manejo de cierre graceful
process.on('SIGTERM', async () => {
  Logger.info('SIGTERM recibido, cerrando servidor...');
  await TesseractService.terminate();
  process.exit(0);
});

process.on('SIGINT', async () => {
  Logger.info('SIGINT recibido, cerrando servidor...');
  await TesseractService.terminate();
  process.exit(0);
});

// Iniciar servidor
startServer();