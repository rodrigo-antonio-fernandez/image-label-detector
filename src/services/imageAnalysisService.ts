import { OCRResult, TextDensityAnalysis, BarcodeQRAnalysis } from "../types";
import { Logger } from "../utils/logger";

export class ImageAnalysisService {
  /**
   * Calcula similitud entre dos strings (Levenshtein distance simplificada)
   */
  private static similarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(
      longer.toLowerCase(),
      shorter.toLowerCase(),
    );
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calcula distancia de Levenshtein
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    // Crear matriz con dimensiones adecuadas
    const matrix: number[][] = Array(len2 + 1)
      .fill(null)
      .map(() => Array(len1 + 1).fill(0));

    // Inicializar primera columna y primera fila
    for (let i = 0; i <= len2; i++) {
      const row = matrix[i];
      if (row) {
        row[0] = i;
      }
    }
    for (let j = 0; j <= len1; j++) {
      const row = matrix[0];
      if (row) {
        row[j] = j;
      }
    }

    // Llenar la matriz
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        const currentRow = matrix[i];
        const prevRow = matrix[i - 1];

        if (currentRow && prevRow) {
          if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
            currentRow[j] = prevRow[j - 1] ?? 0;
          } else {
            const diagCost = prevRow[j - 1] ?? 0;
            const leftCost = currentRow[j - 1] ?? 0;
            const topCost = prevRow[j] ?? 0;

            currentRow[j] = Math.min(
              diagCost + 1, // substitución
              leftCost + 1, // inserción
              topCost + 1, // eliminación
            );
          }
        }
      }
    }

    const lastRow = matrix[len2];
    return lastRow ? (lastRow[len1] ?? 0) : 0;
  }

  /**
   * Busca una palabra en el texto con tolerancia a errores
   */
  private static fuzzySearch(
    text: string,
    keyword: string,
    threshold: number = 0.75,
  ): boolean {
    const textLower = text.toLowerCase();
    const keywordLower = keyword.toLowerCase();

    // Búsqueda exacta primero
    if (textLower.includes(keywordLower)) {
      return true;
    }

    // Búsqueda fuzzy: divide el texto en palabras y busca similares
    const words = textLower.split(/\s+/);

    for (const word of words) {
      if (word.length >= keywordLower.length - 2) {
        // Solo comparar palabras de longitud similar
        const sim = this.similarity(word, keywordLower);
        if (sim >= threshold) {
          Logger.debug(
            `Fuzzy match: "${word}" ≈ "${keywordLower}" (${(sim * 100).toFixed(1)}%)`,
          );
          return true;
        }
      }
    }

    // Búsqueda de substring parcial
    const keywordParts = keywordLower.split(/\s+/);
    const matchedParts = keywordParts.filter(
      (part) => part.length > 3 && textLower.includes(part),
    );

    if (matchedParts.length >= Math.ceil(keywordParts.length * 0.6)) {
      Logger.debug(
        `Partial match: ${matchedParts.length}/${keywordParts.length} partes de "${keyword}"`,
      );
      return true;
    }

    return false;
  }

  /**
   * Analiza la densidad de texto en la imagen
   */
  static analyzeTextDensity(
    ocrResult: OCRResult,
    imageWidth: number,
    imageHeight: number,
  ): TextDensityAnalysis {
    const imageArea = imageWidth * imageHeight;

    if (ocrResult.words && ocrResult.words.length > 0) {
      return this.analyzeFromWords(ocrResult, imageArea);
    }

    if (ocrResult.text && ocrResult.text.trim().length > 0) {
      Logger.warn(
        "No se detectaron palabras estructuradas, analizando texto plano",
      );
      return this.analyzeFromPlainText(
        ocrResult,
        imageArea,
        imageWidth,
        imageHeight,
      );
    }

    return {
      totalTextArea: 0,
      imageArea,
      textCoveragePercentage: 0,
      textBlockCount: 0,
      averageWordConfidence: 0,
      wordsDetected: 0,
    };
  }

  private static analyzeFromWords(
    ocrResult: OCRResult,
    imageArea: number,
  ): TextDensityAnalysis {
    let totalTextArea = 0;
    const textBlocks: Array<{ x: number; y: number }> = [];

    ocrResult.words.forEach((word) => {
      const wordWidth = word.bbox.x1 - word.bbox.x0;
      const wordHeight = word.bbox.y1 - word.bbox.y0;
      const wordArea = wordWidth * wordHeight;
      totalTextArea += wordArea;

      const centerX = (word.bbox.x0 + word.bbox.x1) / 2;
      const centerY = (word.bbox.y0 + word.bbox.y1) / 2;
      textBlocks.push({ x: centerX, y: centerY });
    });

    const blockCount = this.countTextBlocks(textBlocks, 1000, 1000);
    const textCoveragePercentage = (totalTextArea / imageArea) * 100;
    const averageWordConfidence =
      ocrResult.words.length > 0
        ? ocrResult.words.reduce((sum, word) => sum + word.confidence, 0) /
          ocrResult.words.length
        : 0;

    return {
      totalTextArea,
      imageArea,
      textCoveragePercentage,
      textBlockCount: blockCount,
      averageWordConfidence,
      wordsDetected: ocrResult.words.length,
    };
  }

  private static analyzeFromPlainText(
    ocrResult: OCRResult,
    imageArea: number,
    imageWidth: number,
    imageHeight: number,
  ): TextDensityAnalysis {
    const text = ocrResult.text.trim();
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const wordsDetected = words.length;

    const avgCharWidth = 10;
    const avgCharHeight = 15;
    const estimatedTextArea = text.length * avgCharWidth * avgCharHeight;
    const textCoveragePercentage = Math.min(
      (estimatedTextArea / imageArea) * 100,
      100,
    );

    const lines = text.split("\n").filter((line) => line.trim().length > 0);
    const textBlockCount = Math.max(Math.floor(lines.length / 2), 1);
    const averageWordConfidence = ocrResult.confidence;

    Logger.debug("Análisis desde texto plano", {
      caracteres: text.length,
      palabras: wordsDetected,
      líneas: lines.length,
      bloques: textBlockCount,
      cobertura: textCoveragePercentage.toFixed(2) + "%",
    });

    return {
      totalTextArea: estimatedTextArea,
      imageArea,
      textCoveragePercentage,
      textBlockCount,
      averageWordConfidence,
      wordsDetected,
    };
  }

  private static countTextBlocks(
    points: Array<{ x: number; y: number }>,
    imageWidth: number,
    imageHeight: number,
  ): number {
    if (points.length === 0) return 0;

    const gridSize = 5;
    const cellWidth = imageWidth / gridSize;
    const cellHeight = imageHeight / gridSize;

    const occupiedCells = new Set<string>();

    points.forEach((point) => {
      const cellX = Math.floor(point.x / cellWidth);
      const cellY = Math.floor(point.y / cellHeight);
      occupiedCells.add(`${cellX},${cellY}`);
    });

    return occupiedCells.size;
  }

  /**
   * Detecta presencia de códigos QR o códigos de barras
   */
  static detectBarcodeQR(ocrResult: OCRResult): BarcodeQRAnalysis {
    const text = ocrResult.text;

    const qrPatterns = ["qr", "scan", "escanea", "código", "codigo"];
    const barcodePatterns = ["barras", "ean", "upc", "código", "codigo"];

    const hasQRKeywords = qrPatterns.some((pattern) =>
      this.fuzzySearch(text, pattern, 0.7),
    );
    const hasBarcodeKeywords = barcodePatterns.some((pattern) =>
      this.fuzzySearch(text, pattern, 0.7),
    );

    const longNumberSequences = text.match(/\d{8,}/g);

    const analysis: BarcodeQRAnalysis = {
      hasQRCode: hasQRKeywords,
      hasBarcode:
        hasBarcodeKeywords ||
        (longNumberSequences !== null && longNumberSequences.length > 0),
      confidence:
        hasQRKeywords || hasBarcodeKeywords
          ? 0.8
          : longNumberSequences
            ? 0.6
            : 0.3,
    };

    Logger.debug("Análisis de códigos completado", analysis);

    return analysis;
  }

  /**
   * Detecta si el texto contiene información nutricional típica
   * Versión mejorada con múltiples estrategias
   */
  static hasNutritionalInfo(ocrResult: OCRResult): boolean {
    const text = ocrResult.text;
    const textLower = text.toLowerCase();

    // Estrategia 1: Búsqueda de keywords (exacta y fuzzy)
    const nutritionalKeywords = [
      "informacion nutricional",
      "información nutricional",
      "nutricional",
      "calorias",
      "calorías",
      "proteina",
      "proteína",
      "grasa",
      "carbohidrato",
      "kcal",
      "nutricion",
    ];

    const matchedKeywords: string[] = [];
    for (const keyword of nutritionalKeywords) {
      if (this.fuzzySearch(text, keyword, 0.7)) {
        matchedKeywords.push(keyword);
      }
    }

    // Estrategia 2: Buscar patrones estructurales de tablas nutricionales
    // Típicamente tienen formato: "palabra | número unidad"
    const hasTablePattern = /\|\s*\d+/g.test(text); // Pipe seguido de números
    const hasMultiplePipes = (text.match(/\|/g) || []).length >= 3; // Múltiples pipes (tabla)

    // Estrategia 3: Buscar patrones numéricos con unidades
    const nutritionalUnits = text.match(
      /\d+[\.,]?\d*\s*(g|mg|kcal|cal|gr)\b/gi,
    );
    const hasMultipleUnits = nutritionalUnits && nutritionalUnits.length >= 3;

    // Estrategia 4: Buscar palabras cortas típicas de tablas nutricionales
    const shortNutritionalWords = [
      "cal",
      "kcal",
      "grasa",
      "prot",
      "carb",
      "fibr",
    ];
    const shortMatches = shortNutritionalWords.filter((word) =>
      textLower.includes(word),
    ).length;

    // Estrategia 5: Detectar estructura de "Por cada X gr/ml"
    const hasPortionInfo = /por\s+(cada|100|cad)/i.test(text);

    // Estrategia 6: Buscar palabras parciales que indiquen nutrición
    // (útil cuando OCR corrompe las palabras)
    const partialMatches = [
      /nutri/i, // nutrición, nutricional
      /calor/i, // calorías
      /prote/i, // proteína
      /carbo/i, // carbohidratos
      /informa.*nutri/i, // información nutricional
    ];
    const partialMatchCount = partialMatches.filter((pattern) =>
      pattern.test(text),
    ).length;

    // Decisión final con múltiples factores
    const hasNutritionalInfo =
      matchedKeywords.length >= 1 || // Al menos 1 keyword encontrada
      (hasTablePattern && hasMultiplePipes) || // Estructura de tabla
      hasMultipleUnits || // Múltiples unidades nutricionales
      shortMatches >= 2 || // Al menos 2 palabras cortas nutricionales
      (hasPortionInfo && nutritionalUnits && nutritionalUnits.length >= 2) || // Porción + unidades
      partialMatchCount >= 2; // Al menos 2 coincidencias parciales

    Logger.debug("Análisis de información nutricional", {
      keywordsEncontradas: matchedKeywords.length,
      keywords: matchedKeywords,
      tieneTabla: hasTablePattern,
      multiplePipes: hasMultiplePipes,
      unidadesNutricionales: nutritionalUnits?.length || 0,
      palabrasCortas: shortMatches,
      infoProcion: hasPortionInfo,
      coincidenciasParciales: partialMatchCount,
      esInfoNutricional: hasNutritionalInfo,
    });

    return hasNutritionalInfo;
  }

  /**
   * Detecta ingredientes en el texto
   */
  static hasIngredients(ocrResult: OCRResult): boolean {
    const text = ocrResult.text;

    const ingredientKeywords = [
      "ingrediente",
      "ingredientes",
      "contiene",
      "leche",
      "azucar",
      "azúcar",
      "agua",
      "natural",
      "cultivo",
      "probiotico",
      "probiótico",
    ];

    const matchedCount = ingredientKeywords.filter((keyword) =>
      this.fuzzySearch(text, keyword, 0.75),
    ).length;

    return matchedCount >= 2;
  }

  /**
   * Detecta información de temperatura/almacenamiento
   */
  static hasStorageInfo(ocrResult: OCRResult): boolean {
    const text = ocrResult.text;

    const storageKeywords = [
      "temperatura",
      "almacena",
      "refrigera",
      "conserva",
      "grados",
      "°c",
      "almacenaje",
    ];

    return storageKeywords.some((keyword) =>
      this.fuzzySearch(text, keyword, 0.75),
    );
  }

  /**
   * Detecta información del fabricante/distribuidor
   */
  static hasManufacturerInfo(ocrResult: OCRResult): boolean {
    const text = ocrResult.text;

    const manufacturerKeywords = [
      "producto",
      "fabricado",
      "elaborado",
      "distribuido",
      "comercializado",
      "industria",
      "empresa",
      "hecho en",
    ];

    return manufacturerKeywords.some((keyword) =>
      this.fuzzySearch(text, keyword, 0.75),
    );
  }
}
