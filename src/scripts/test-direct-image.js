const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Función para extraer palabras de la estructura jerárquica
function extractWords(data) {
  const words = [];
  
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

async function testDirectOCR() {
  console.log('=== TEST DIRECTO DE OCR ===\n');

  const imageUrl = 'https://apitreewmedias-sandbox.treew.com/Images/middle/4bbe9cd6-5ca2-4614-b4e7-703804bbee6c.jpg';
  
  try {
    // 1. Descargar imagen
    console.log('1. Descargando imagen...');
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    const imageBuffer = Buffer.from(response.data);
    console.log(`   ✓ Descargada: ${imageBuffer.length} bytes\n`);

    // 2. Verificar dimensiones originales
    console.log('2. Analizando imagen original...');
    const metadata = await sharp(imageBuffer).metadata();
    console.log(`   Dimensiones: ${metadata.width}x${metadata.height}`);
    console.log(`   Formato: ${metadata.format}`);
    console.log(`   Espacio de color: ${metadata.space}\n`);

    // 3. Guardar imagen original
    const debugDir = path.join(__dirname, '../debug-images');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    const originalPath = path.join(debugDir, 'original.jpg');
    fs.writeFileSync(originalPath, imageBuffer);
    console.log(`   ✓ Imagen original guardada: ${originalPath}\n`);

    // 4. Test con imagen ORIGINAL (sin preprocesar)
    console.log('3. OCR en imagen ORIGINAL (sin preprocesar)...');
    console.log('   (esto puede tardar 30-60 segundos...)\n');
    
    const worker1 = await Tesseract.createWorker('spa+eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          process.stdout.write(`\r   Progreso: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    const result1 = await worker1.recognize(imageBuffer);
    console.log('\n');
    
    const words1 = extractWords(result1.data);
    
    console.log(`   Palabras detectadas: ${words1.length}`);
    console.log(`   Confianza: ${result1.data.confidence.toFixed(2)}%`);
    console.log(`   Bloques: ${result1.data.blocks ? result1.data.blocks.length : 0}`);
    console.log(`   Texto (primeros 500 caracteres):`);
    console.log(`   "${result1.data.text.substring(0, 500)}"`);
    console.log(`\n   Primeras 10 palabras detectadas:`);
    words1.slice(0, 10).forEach((word, i) => {
      console.log(`     ${i + 1}. "${word.text}" (confianza: ${word.confidence.toFixed(1)}%)`);
    });
    console.log('');
    
    await worker1.terminate();

    // 5. Preprocesar imagen - Versión 1 (greyscale + normalize)
    console.log('4. Preprocesando imagen (Versión 1: greyscale + normalize)...');
    const preprocessed1 = await sharp(imageBuffer)
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: false })
      .greyscale()
      .normalize()
      .sharpen()
      .toBuffer();
    
    const preprocessedPath1 = path.join(debugDir, 'preprocessed-v1.png');
    fs.writeFileSync(preprocessedPath1, preprocessed1);
    console.log(`   ✓ Imagen guardada: ${preprocessedPath1}\n`);

    // 6. Test con imagen PREPROCESADA v1
    console.log('5. OCR en imagen PREPROCESADA v1...');
    console.log('   (esto puede tardar 30-60 segundos...)\n');
    
    const worker2 = await Tesseract.createWorker('spa+eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          process.stdout.write(`\r   Progreso: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    const result2 = await worker2.recognize(preprocessed1);
    console.log('\n');
    
    const words2 = extractWords(result2.data);
    
    console.log(`   Palabras detectadas: ${words2.length}`);
    console.log(`   Confianza: ${result2.data.confidence.toFixed(2)}%`);
    console.log(`   Texto (primeros 500 caracteres):`);
    console.log(`   "${result2.data.text.substring(0, 500)}"\n`);
    
    await worker2.terminate();

    // 7. Preprocesar imagen - Versión 2 (solo resize)
    console.log('6. Preprocesando imagen (Versión 2: solo resize)...');
    const preprocessed2 = await sharp(imageBuffer)
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: false })
      .toBuffer();
    
    const preprocessedPath2 = path.join(debugDir, 'preprocessed-v2.png');
    fs.writeFileSync(preprocessedPath2, preprocessed2);
    console.log(`   ✓ Imagen guardada: ${preprocessedPath2}\n`);

    // 8. Test con imagen PREPROCESADA v2
    console.log('7. OCR en imagen PREPROCESADA v2...');
    console.log('   (esto puede tardar 30-60 segundos...)\n');
    
    const worker3 = await Tesseract.createWorker('spa+eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          process.stdout.write(`\r   Progreso: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    const result3 = await worker3.recognize(preprocessed2);
    console.log('\n');
    
    const words3 = extractWords(result3.data);
    
    console.log(`   Palabras detectadas: ${words3.length}`);
    console.log(`   Confianza: ${result3.data.confidence.toFixed(2)}%`);
    console.log(`   Texto (primeros 500 caracteres):`);
    console.log(`   "${result3.data.text.substring(0, 500)}"\n`);
    
    await worker3.terminate();

    // 9. Comparación final
    console.log('\n=== RESUMEN COMPARATIVO ===');
    console.log(`Original (sin procesar):     ${words1.length} palabras (confianza: ${result1.data.confidence.toFixed(2)}%)`);
    console.log(`Preprocesada v1 (greyscale): ${words2.length} palabras (confianza: ${result2.data.confidence.toFixed(2)}%)`);
    console.log(`Preprocesada v2 (solo size): ${words3.length} palabras (confianza: ${result3.data.confidence.toFixed(2)}%)`);
    
    console.log('\n=== ANÁLISIS ===');
    if (words1.length > 0) {
      console.log('✓ Tesseract funciona correctamente');
      console.log(`✓ Mejor resultado: ${words1.length >= words2.length && words1.length >= words3.length ? 'Original' : words2.length >= words3.length ? 'Preprocesada v1' : 'Preprocesada v2'}`);
      
      // Detectar palabras clave de etiquetas
      const textLower = result1.data.text.toLowerCase();
      const keywords = ['calor', 'proteína', 'grasa', 'carbohidrato', 'ingrediente', 'natural', 'producto'];
      const foundKeywords = keywords.filter(k => textLower.includes(k));
      
      console.log(`\n✓ Palabras clave encontradas: ${foundKeywords.join(', ')}`);
      
      if (foundKeywords.length >= 3) {
        console.log('✓ CONCLUSIÓN: Esta imagen SÍ es una etiqueta de producto');
      } else {
        console.log('⚠ CONCLUSIÓN: Pocas palabras clave detectadas, pero hay texto');
      }
      
    } else if (words2.length > 0 || words3.length > 0) {
      console.log('⚠ El preprocesamiento mejora la detección');
    } else {
      console.log('❌ PROBLEMA: No se detectó texto en ninguna versión');
      console.log('\nPosibles causas:');
      console.log('  1. Los modelos de idioma no están correctamente instalados');
      console.log('  2. La imagen es demasiado compleja o tiene baja resolución');
      console.log('  3. El texto está en un ángulo o perspectiva difícil');
      console.log('\nIntenta ejecutar: node scripts/download-tessdata.js');
    }

    console.log(`\n✓ Revisa las imágenes guardadas en: ${debugDir}`);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  }
}

testDirectOCR();