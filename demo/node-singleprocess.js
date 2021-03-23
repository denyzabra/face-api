// @ts-nocheck

const fs = require('fs');
const process = require('process');
const path = require('path');
// eslint-disable-next-line import/no-extraneous-dependencies, node/no-unpublished-require
const log = require('@vladmandic/pilogger');
// eslint-disable-next-line import/no-extraneous-dependencies, node/no-unpublished-require, no-unused-vars
const tf = require('@tensorflow/tfjs-node');
// eslint-disable-next-line import/no-extraneous-dependencies, node/no-unpublished-require
const canvas = require('canvas');
const faceapi = require('../dist/face-api.node.js'); // this is equivalent to '@vladmandic/faceapi'

const modelPathRoot = '../model';
const imgPathRoot = './demo'; // modify to include your sample images
const minScore = 0.1;
const maxResults = 5;
let optionsSSDMobileNet;

async function image(input) {
  const img = canvas.loadImage(input);
  const c = canvas.createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, img.width, img.height);
  return c;
}

async function detect(tensor) {
  const result = await faceapi
    .detectAllFaces(tensor, optionsSSDMobileNet)
    .withFaceLandmarks()
    .withFaceExpressions()
    .withFaceDescriptors()
    .withAgeAndGender();
  return result;
}

async function main() {
  log.header();
  log.info('FaceAPI single-process test');

  faceapi.env.monkeyPatch({ Canvas: canvas.Canvas, Image: canvas.Image, ImageData: canvas.ImageData });

  await faceapi.tf.setBackend('tensorflow');
  await faceapi.tf.enableProdMode();
  await faceapi.tf.ENV.set('DEBUG', false);
  await faceapi.tf.ready();

  log.state(`Version: TensorFlow/JS ${faceapi.tf?.version_core} FaceAPI ${faceapi.version.faceapi} Backend: ${faceapi.tf?.getBackend()}`);

  log.info('Loading FaceAPI models');
  const modelPath = path.join(__dirname, modelPathRoot);
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
  await faceapi.nets.ageGenderNet.loadFromDisk(modelPath);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
  await faceapi.nets.faceExpressionNet.loadFromDisk(modelPath);
  optionsSSDMobileNet = new faceapi.SsdMobilenetv1Options({ minConfidence: minScore, maxResults });

  if (process.argv.length !== 3) {
    const t0 = process.hrtime.bigint();
    const dir = fs.readdirSync(imgPathRoot);
    for (const img of dir) {
      if (!img.toLocaleLowerCase().endsWith('.jpg')) continue;
      const tensor = await image(path.join(imgPathRoot, img));
      const result = await detect(tensor);
      log.data('Image:', img, 'Detected faces:', result.length);
      for (const i of result) {
        log.data('Gender:', Math.round(100 * i.genderProbability), 'probability', i.gender, 'with age', Math.round(10 * i.age) / 10);
      }
      tensor.dispose();
    }
    const t1 = process.hrtime.bigint();
    log.info('Processed', dir.length, 'images in', Math.trunc(parseInt(t1 - t0) / 1000 / 1000), 'ms');
  } else {
    const param = process.argv[2];
    if (fs.existsSync(param)) {
      const tensor = await image(param);
      const result = await detect(tensor);
      log.data('Image:', param, 'Detected faces:', result.length);
      for (const i of result) {
        log.data('Gender:', Math.round(100 * i.genderProbability), 'probability', i.gender, 'with age', Math.round(10 * i.age) / 10);
      }
      tensor.dispose();
    }
  }
}

main();