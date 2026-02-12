import { Bbox } from 'tesseract.js';

export interface ProductImage {
  filePixelHeight: number;
  filePixelWidth: number;
  imageType: 'NORMAL' | 'MINIATURE';
  imageHash: string;
  referencedFileURL: string;
  baseUrl: string;
  isAbsoluteUrl: boolean;
  _id: string;
  canBeFix?: boolean;
  isValid?: boolean;
}

export interface OCRWord {
  text: string;
  confidence: number;
  bbox: Bbox;
}

export interface OCRResult {
  text: string;
  confidence: number;
  words: OCRWord[];
}

export interface TextDensityAnalysis {
  totalTextArea: number;
  imageArea: number;
  textCoveragePercentage: number;
  textBlockCount: number;
  averageWordConfidence: number;
  wordsDetected: number;
}

export interface BarcodeQRAnalysis {
  hasBarcode: boolean;
  hasQRCode: boolean;
  confidence: number;
}

export interface LabelDetectionResult {
  isProductLabel: boolean;
  confidence: number;
  reasoning: string;
  metrics: {
    textCoverage: number;
    textBlockCount: number;
    wordCount: number;
    hasBarcode: boolean;
    hasQRCode: boolean;
    averageTextConfidence: number;
  };
  processingTimeMs: number;
}