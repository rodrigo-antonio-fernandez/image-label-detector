import express, { Request, Response } from "express";
import { config } from "./config";
import { Logger } from "./utils/logger";
import { TesseractService } from "./services/tesseractService";
import { LabelDetectionService } from "./services/labelDetectionService";
import { ProductImage } from "./types";

const app = express();

app.use(express.json({ limit: "50mb" }));

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Analizar una sola imagen
app.post("/api/detect-label", async (req: Request, res: Response) => {
  try {
    const image: ProductImage = req.body;

    if (!image || !image.referencedFileURL) {
      return res.status(400).json({
        error: "Imagen inválida. Se requiere referencedFileURL",
      });
    }

    const result = await LabelDetectionService.detectLabel(image);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    Logger.error("Error en /api/detect-label", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error interno del servidor",
    });
  }
});

// Analizar múltiples imágenes
app.post("/api/detect-labels-batch", async (req: Request, res: Response) => {
  try {
    const images: ProductImage[] = req.body.images;

    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        error: "Se requiere un array de imágenes no vacío",
      });
    }

    const results = await LabelDetectionService.detectLabelsInBatch(images);

    // Convertir Map a objeto para JSON
    const resultsObject: Record<string, any> = {};
    results.forEach((value, key) => {
      resultsObject[key] = value;
    });

    res.json({
      success: true,
      totalProcessed: results.size,
      data: resultsObject,
    });
  } catch (error: any) {
    Logger.error("Error en /api/detect-labels-batch", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error interno del servidor",
    });
  }
});

// Inicialización del servidor
async function startServer() {
  try {
    Logger.info("Inicializando servicio de detección de etiquetas...");

    // Inicializar Tesseract
    await TesseractService.initialize();

    // Iniciar servidor Express
    app.listen(config.port, () => {
      Logger.info(`Servidor iniciado en puerto ${config.port}`);
      Logger.info(`Health check: http://localhost:${config.port}/health`);
      Logger.info(
        `API endpoint: http://localhost:${config.port}/api/detect-label`,
      );
    });
  } catch (error) {
    Logger.error("Error iniciando servidor", error);
    process.exit(1);
  }
}

// Manejo de cierre graceful
process.on("SIGTERM", async () => {
  Logger.info("SIGTERM recibido, cerrando servidor...");
  await TesseractService.terminate();
  process.exit(0);
});

process.on("SIGINT", async () => {
  Logger.info("SIGINT recibido, cerrando servidor...");
  await TesseractService.terminate();
  process.exit(0);
});

// Iniciar servidor
startServer();
