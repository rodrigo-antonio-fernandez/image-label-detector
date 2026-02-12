import Tesseract, { createWorker, PSM, Word } from 'tesseract.js';
import { OCRResult } from '../types';
import { config } from '../config';
import { Logger } from '../utils/logger';

export class TesseractService {
  private static workerPool: Tesseract.Worker[] = [];
  private static isInitialized = false;

  /**
   * Inicializa el pool de workers de Tesseract
   */
  static async initialize(): Promise<void> {
    if (this.isInitialized) return;

    Logger.info(`Inicializando pool de ${config.tesseract.workerPoolSize} workers de Tesseract...`);

    const workerPromises = Array.from({ length: config.tesseract.workerPoolSize }, async (_, index) => {
      const worker = await createWorker(config.tesseract.lang, 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            Logger.debug(`Worker ${index}: ${m.status} - ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: '1',
      });

      return worker;
    });

    this.workerPool = await Promise.all(workerPromises);
    this.isInitialized = true;
    Logger.info('Pool de workers de Tesseract inicializado correctamente');
  }

  /**
   * Obtiene un worker disponible del pool
   */
  private static async getWorker(): Promise<Tesseract.Worker> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Simple round-robin
    const worker = this.workerPool[Math.floor(Math.random() * this.workerPool.length)];
    if (!worker) {
      throw new Error('No hay workers disponibles en el pool');
    }
    return worker;
  }

  /**
   * Extrae todas las palabras de la estructura de bloques
   */
  private static extractWords(data: Tesseract.Page): Word[] {
    const words: Word[] = [];

    if (data.blocks) {
      for (const block of data.blocks) {
        if (block.paragraphs) {
          for (const paragraph of block.paragraphs) {
            if (paragraph.lines) {
              for (const line of paragraph.lines) {
                if (line.words) {
                  words.push(...line.words);
                }
              }
            }
          }
        }
      }
    }

    return words;
  }

  /**
   * Realiza OCR en una imagen
   */
  static async recognizeText(imageBuffer: Buffer): Promise<OCRResult> {
    const startTime = Date.now();
    const worker = await this.getWorker();

    try {
      Logger.debug('Iniciando reconocimiento OCR...');

      const result = await worker.recognize(imageBuffer);

      // Extraer todas las palabras de la estructura jerárquica
      const allWords = this.extractWords(result.data);

      const words = allWords.map((word) => ({
        text: word.text,
        confidence: word.confidence,
        bbox: word.bbox,
      }));

      const ocrResult: OCRResult = {
        text: result.data.text,
        confidence: result.data.confidence,
        words,
      };

      const processingTime = Date.now() - startTime;
      Logger.info(`OCR completado en ${processingTime}ms`, {
        wordsDetected: words.length,
        confidence: result.data.confidence.toFixed(2),
        textLength: result.data.text.length,
      });

      Logger.debug('Texto detectado (primeros 500 caracteres):', result.data.text.substring(0, 500));

      return ocrResult;
    } catch (error) {
      Logger.error('Error en reconocimiento OCR', error);
      throw error;
    }
  }

  /**
   * Realiza OCR en múltiples variantes y selecciona el mejor resultado
   */
  static async recognizeTextMultiVariant(imageBuffers: Buffer[]): Promise<OCRResult> {
    Logger.info(`Procesando ${imageBuffers.length} variantes de imagen`);

    const results = await Promise.all(
      imageBuffers.map((buffer, index) => 
        this.recognizeText(buffer).catch((error) => {
          Logger.warn(`Error en variante ${index}`, error);
          return null;
        })
      )
    );

    // Filtrar resultados válidos
    const validResults = results.filter((r): r is OCRResult => r !== null);

    if (validResults.length === 0) {
      throw new Error('No se pudo procesar ninguna variante de la imagen');
    }

    // Seleccionar el mejor resultado (más palabras detectadas con buena confianza)
    const bestResult = validResults.reduce((best, current) => {
      const bestScore = best.words.length * (best.confidence / 100);
      const currentScore = current.words.length * (current.confidence / 100);
      return currentScore > bestScore ? current : best;
    });

    Logger.info('Mejor resultado seleccionado', {
      wordsDetected: bestResult.words.length,
      confidence: bestResult.confidence.toFixed(2),
    });

    return bestResult;
  }

  /**
   * Cierra todos los workers
   */
  static async terminate(): Promise<void> {
    Logger.info('Cerrando workers de Tesseract...');
    await Promise.all(this.workerPool.map((worker) => worker.terminate()));
    this.workerPool = [];
    this.isInitialized = false;
    Logger.info('Workers de Tesseract cerrados');
  }
}