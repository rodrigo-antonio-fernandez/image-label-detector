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
  correctedImgRef?: string;
  isRequiredForOffer?: boolean;
  main: boolean;  
}

export interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
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