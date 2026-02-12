import {
  ProductImage,
  LabelDetectionResult,
  TextDensityAnalysis,
  BarcodeQRAnalysis,
  OCRResult,
} from "../types";
import { TesseractService } from "./tesseractService";
import { ImageAnalysisService } from "./imageAnalysisService";
import { ImageProcessor } from "../utils/imageProcessor";
import { Logger } from "../utils/logger";
import { config } from "../config";

export class LabelDetectionService {
  /**
   * Detecta si una imagen es una etiqueta de producto
   */
  static async detectLabel(image: ProductImage): Promise<LabelDetectionResult> {
    const startTime = Date.now();
    Logger.info(`Analizando imagen: ${image._id}`);

    try {
      // 1. Construir URL completa
      const imageUrl = ImageProcessor.buildImageUrl(image);
      Logger.info(`URL completa de imagen: ${imageUrl}`);

      // 2. Descargar imagen
      Logger.info("Descargando imagen...");
      const imageBuffer = await ImageProcessor.downloadImage(imageUrl);
      Logger.info(`Imagen descargada: ${imageBuffer.length} bytes`);

      // 3. Obtener dimensiones
      const dimensions = await ImageProcessor.getImageDimensions(imageBuffer);
      Logger.info(
        `Dimensiones originales: ${dimensions.width}x${dimensions.height}`,
      );

      // 4. Preprocesar imagen (versión simple primero)
      Logger.info("Preprocesando imagen...");
      const preprocessedImage =
        await ImageProcessor.preprocessForOCR(imageBuffer);
      Logger.info(`Imagen preprocesada: ${preprocessedImage.length} bytes`);

      // GUARDAR IMAGEN PREPROCESADA PARA DEBUG
      const fs = require("fs");
      const path = require("path");
      const debugDir = path.join(__dirname, "../../debug-images");
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      const debugPath = path.join(debugDir, `preprocessed-${image._id}.png`);
      fs.writeFileSync(debugPath, preprocessedImage);
      Logger.info(`Imagen preprocesada guardada en: ${debugPath}`);

      // 5. Realizar OCR
      Logger.info("Iniciando OCR...");
      const ocrResult = await TesseractService.recognizeText(preprocessedImage);
      Logger.info(
        `OCR completado: ${ocrResult.words.length} palabras detectadas`,
      );
      Logger.info(
        `Texto completo detectado: "${ocrResult.text.substring(0, 500)}"`,
      );

      if (ocrResult.words.length === 0) {
        Logger.warn("⚠️ No se detectaron palabras. Posibles causas:");
        Logger.warn("  - La imagen no se descargó correctamente");
        Logger.warn("  - El preprocesamiento eliminó todo el contenido");
        Logger.warn("  - Tesseract no está configurado correctamente");
        Logger.warn("  - El idioma del modelo no coincide con el texto");
      }

      // 6. Analizar densidad de texto
      const textDensity = ImageAnalysisService.analyzeTextDensity(
        ocrResult,
        dimensions.width,
        dimensions.height,
      );

      // 7. Detectar códigos QR/barras
      const barcodeQRAnalysis = ImageAnalysisService.detectBarcodeQR(ocrResult);

      // 8. Detectar información nutricional
      const hasNutritionalInfo =
        ImageAnalysisService.hasNutritionalInfo(ocrResult);

      // 9. Calcular score y determinar si es etiqueta
      const detectionResult = this.calculateLabelScore(
        textDensity,
        barcodeQRAnalysis,
        hasNutritionalInfo,
        ocrResult,
      );

      const processingTime = Date.now() - startTime;

      const result: LabelDetectionResult = {
        isProductLabel: detectionResult.isLabel,
        confidence: detectionResult.confidence,
        reasoning: detectionResult.reasoning,
        metrics: {
          textCoverage: textDensity.textCoveragePercentage,
          textBlockCount: textDensity.textBlockCount,
          wordCount: textDensity.wordsDetected,
          hasBarcode: barcodeQRAnalysis.hasBarcode,
          hasQRCode: barcodeQRAnalysis.hasQRCode,
          averageTextConfidence: textDensity.averageWordConfidence,
        },
        processingTimeMs: processingTime,
      };

      Logger.info(`Detección completada para imagen ${image._id}`, {
        isLabel: result.isProductLabel,
        confidence: (result.confidence * 100).toFixed(2) + "%",
        processingTimeMs: processingTime,
      });

      return result;
    } catch (error) {
      Logger.error(`Error analizando imagen ${image._id}`, error);
      throw error;
    }
  }

  /**
   * Calcula el score de probabilidad de que sea una etiqueta
   */
  private static calculateLabelScore(
    textDensity: TextDensityAnalysis,
    barcodeQR: BarcodeQRAnalysis,
    hasNutritionalInfo: boolean,
    ocrResult: OCRResult,
  ): { isLabel: boolean; confidence: number; reasoning: string } {
    let score = 0;
    const reasons: string[] = [];
    const maxScore = 100;

    Logger.debug("Calculando score de etiqueta", {
      textCoverage: textDensity.textCoveragePercentage.toFixed(2),
      textBlocks: textDensity.textBlockCount,
      words: textDensity.wordsDetected,
      avgConfidence: textDensity.averageWordConfidence.toFixed(2),
      textLength: ocrResult.text.length,
    });

    // Criterio 0: Cantidad mínima de texto (nuevo - muy importante)
    const textLength = ocrResult.text.trim().length;
    if (textLength > 100) {
      score += 15;
      reasons.push(
        `Cantidad significativa de texto detectado: ${textLength} caracteres`,
      );
    } else if (textLength > 50) {
      score += 8;
      reasons.push(`Texto detectado: ${textLength} caracteres`);
    }

    // Criterio 1: Cobertura de texto (peso: 20 puntos)
    const textCoverageRatio = textDensity.textCoveragePercentage / 100;
    if (textCoverageRatio > 0.1) {
      const textScore = Math.min(20, (textCoverageRatio / 0.4) * 20);
      score += textScore;
      reasons.push(
        `Cobertura de texto: ${textDensity.textCoveragePercentage.toFixed(2)}%`,
      );
    }

    // Criterio 2: Cantidad de bloques de texto (peso: 15 puntos)
    if (textDensity.textBlockCount >= 5) {
      score += 15;
      reasons.push(`Múltiples bloques de texto: ${textDensity.textBlockCount}`);
    } else if (textDensity.textBlockCount >= 3) {
      score += 10;
      reasons.push(`Varios bloques de texto: ${textDensity.textBlockCount}`);
    } else if (textDensity.textBlockCount >= 2) {
      score += 5;
      reasons.push(`Algunos bloques de texto: ${textDensity.textBlockCount}`);
    }

    // Criterio 3: Cantidad de palabras (peso: 15 puntos)
    if (textDensity.wordsDetected >= 30) {
      score += 15;
      reasons.push(`Alto número de palabras: ${textDensity.wordsDetected}`);
    } else if (textDensity.wordsDetected >= 20) {
      score += 12;
      reasons.push(
        `Número moderado-alto de palabras: ${textDensity.wordsDetected}`,
      );
    } else if (textDensity.wordsDetected >= 10) {
      score += 8;
      reasons.push(`Número moderado de palabras: ${textDensity.wordsDetected}`);
    } else if (textDensity.wordsDetected >= 5) {
      score += 4;
      reasons.push(`Algunas palabras detectadas: ${textDensity.wordsDetected}`);
    }

    // Criterio 4: Información nutricional (peso: 20 puntos) - INDICADOR MUY FUERTE
    if (hasNutritionalInfo) {
      score += 20;
      reasons.push("✓ Contiene información nutricional (indicador muy fuerte)");
    }

    // Criterio 5: Ingredientes (peso: 10 puntos)
    const hasIngredients = ImageAnalysisService.hasIngredients(ocrResult);
    if (hasIngredients) {
      score += 10;
      reasons.push("✓ Contiene lista de ingredientes");
    }

    // Criterio 6: Información de almacenamiento (peso: 5 puntos)
    const hasStorageInfo = ImageAnalysisService.hasStorageInfo(ocrResult);
    if (hasStorageInfo) {
      score += 5;
      reasons.push("✓ Contiene información de temperatura/almacenamiento");
    }

    // Criterio 7: Información del fabricante (peso: 5 puntos)
    const hasManufacturerInfo =
      ImageAnalysisService.hasManufacturerInfo(ocrResult);
    if (hasManufacturerInfo) {
      score += 5;
      reasons.push("✓ Contiene información del fabricante/distribuidor");
    }

    // Criterio 8: Presencia de códigos QR/Barras (peso: 5 puntos)
    if (barcodeQR.hasQRCode || barcodeQR.hasBarcode) {
      score += 5;
      const codes = [];
      if (barcodeQR.hasQRCode) codes.push("QR");
      if (barcodeQR.hasBarcode) codes.push("código de barras");
      reasons.push(`✓ Contiene ${codes.join(" y/o ")}`);
    }

    // Calcular confianza (0-1)
    const confidence = Math.min(score / maxScore, 1);

    // Determinar si es etiqueta con un threshold bajo (45% de score)
    const isLabel = score >= 45;

    const reasoning =
      reasons.length > 0
        ? reasons.join("; ")
        : "No se detectaron características de etiqueta";

    Logger.info("Score final calculado", {
      score,
      confidence: (confidence * 100).toFixed(2) + "%",
      isLabel,
      reasoning,
    });

    return {
      isLabel,
      confidence,
      reasoning,
    };
  }

  /**
   * Procesa múltiples imágenes en lote
   */
  static async detectLabelsInBatch(
    images: ProductImage[],
  ): Promise<Map<string, LabelDetectionResult>> {
    Logger.info(`Procesando lote de ${images.length} imágenes`);

    const results = new Map<string, LabelDetectionResult>();

    // Procesar imágenes en paralelo (con límite de concurrencia)
    const concurrencyLimit = config.tesseract.workerPoolSize;
    const chunks = this.chunkArray(images, concurrencyLimit);

    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map((image) => this.detectLabel(image)),
      );

      chunkResults.forEach((result, index) => {
        const image = chunk[index];
        if (!image) return;
        const imageId = image._id;
        if (result.status === "fulfilled") {
          results.set(imageId, result.value);
        } else {
          Logger.error(`Error procesando imagen ${imageId}`, result.reason);
          results.set(imageId, {
            isProductLabel: false,
            confidence: 0,
            reasoning: `Error: ${result.reason}`,
            metrics: {
              textCoverage: 0,
              textBlockCount: 0,
              wordCount: 0,
              hasBarcode: false,
              hasQRCode: false,
              averageTextConfidence: 0,
            },
            processingTimeMs: 0,
          });
        }
      });
    }

    Logger.info(`Lote completado: ${results.size} imágenes procesadas`);

    return results;
  }

  /**
   * Divide un array en chunks
   */
  private static chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
