const axios = require('axios');

const testImage = {
  filePixelHeight: 1000,
  filePixelWidth: 1000,
  imageType: 'NORMAL',
  imageHash: 'test-hash',
  referencedFileURL: "middle/b728a0b3-c320-455f-a1fe-ce9e59c43a6a.jpg",
  baseUrl: 'https://apitreewmedias-sandbox.treew.com/Images/',
  isAbsoluteUrl: false,
  _id: '698ddb3e2d4dc7f2d5b0c14f',
};

async function testDetection() {
  try {
    console.log('Enviando imagen para análisis...\n');

    const response = await axios.post('http://localhost:3000/api/detect-label', testImage, {
      timeout: 60000,
    });

    console.log('=== RESULTADO ===\n');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testDetection();