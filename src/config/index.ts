import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  baseImageUrl: process.env.BASE_IMAGE_URL || '',
  tesseract: {
    lang: process.env.TESSERACT_LANG || 'spa+eng',
    workerPoolSize: parseInt(process.env.TESSERACT_WORKER_POOL_SIZE || '4'),
  },
  detection: {
    textCoverageThreshold: parseFloat(process.env.LABEL_TEXT_COVERAGE_THRESHOLD || '0.25'),
    textBlockThreshold: parseInt(process.env.LABEL_TEXT_BLOCK_THRESHOLD || '5'),
    wordCountThreshold: parseInt(process.env.LABEL_WORD_COUNT_THRESHOLD || '20'),
    minConfidenceThreshold: parseFloat(process.env.MIN_CONFIDENCE_THRESHOLD || '0.70'),
  },
};