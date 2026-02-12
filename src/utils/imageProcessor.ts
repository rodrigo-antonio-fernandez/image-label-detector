import sharp from 'sharp';
import axios from 'axios';

export class ImageProcessor {
  /**
   * Descarga una imagen desde una URL
   */
  static async downloadImage(url: string): Promise<Buffer> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });
      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Error descargando imagen: ${error}`);
    }
  }

  /**
   * Preprocesa la imagen para mejorar el OCR
   * Versión mejorada que preserva más detalles
   */
  static async preprocessForOCR(imageBuffer: Buffer): Promise<Buffer> {
    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      // Si la imagen es muy pequeña, ampliarla primero
      const minSize = 1500;
      let resizeOptions: any = {
        fit: 'inside',
        withoutEnlargement: false, // Permitir agrandar imágenes pequeñas
      };

      if (metadata.width && metadata.height) {
        if (metadata.width < minSize || metadata.height < minSize) {
          resizeOptions = {
            width: Math.max(metadata.width * 2, minSize),
            height: Math.max(metadata.height * 2, minSize),
            fit: 'inside',
          };
        } else {
          resizeOptions = {
            width: 2500,
            height: 2500,
            fit: 'inside',
            withoutEnlargement: true,
          };
        }
      }

      return await image
        .resize(resizeOptions)
        .greyscale()
        .normalize() // Mejora el contraste
        .sharpen({ sigma: 1.5 }) // Afila un poco más
        .threshold(128) // Binarización adaptativa
        .toBuffer();
    } catch (error) {
      throw new Error(`Error preprocesando imagen: ${error}`);
    }
  }

  /**
   * Preprocesa con múltiples variantes para mejor OCR
   */
  static async preprocessMultipleVariants(imageBuffer: Buffer): Promise<Buffer[]> {
    const variants: Buffer[] = [];

    try {
      const baseImage = sharp(imageBuffer);

      // Variante 1: Original mejorado
      variants.push(
        await baseImage
          .clone()
          .resize(2500, 2500, { fit: 'inside', withoutEnlargement: false })
          .normalize()
          .sharpen()
          .toBuffer()
      );

      // Variante 2: Escala de grises con binarización
      variants.push(
        await baseImage
          .clone()
          .resize(2500, 2500, { fit: 'inside', withoutEnlargement: false })
          .greyscale()
          .normalize()
          .threshold(128)
          .toBuffer()
      );

      // Variante 3: Alto contraste
      variants.push(
        await baseImage
          .clone()
          .resize(2500, 2500, { fit: 'inside', withoutEnlargement: false })
          .greyscale()
          .linear(1.5, -(128 * 1.5) + 128) // Aumentar contraste
          .toBuffer()
      );

      return variants;
    } catch (error) {
      throw new Error(`Error generando variantes de imagen: ${error}`);
    }
  }

  /**
   * Obtiene las dimensiones de la imagen
   */
  static async getImageDimensions(imageBuffer: Buffer): Promise<{ width: number; height: number }> {
    const metadata = await sharp(imageBuffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  }

  /**
   * Construye la URL completa de la imagen
   */
  static buildImageUrl(image: { baseUrl: string; referencedFileURL: string; isAbsoluteUrl?: boolean }): string {
    if (image.isAbsoluteUrl) {
      return image.referencedFileURL;
    }
    return `${image.baseUrl}${image.referencedFileURL}`;
  }
}