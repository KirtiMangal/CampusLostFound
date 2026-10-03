import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'node:stream';
import AppError from '../utils/AppError.js';

function configure() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new AppError('Image uploads are not configured on this server.', 503, 'CLOUDINARY_NOT_CONFIGURED');
  }
  cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });
}

export async function uploadImage(buffer) {
  configure();
  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream({
      folder: 'campusfind/items',
      resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 2000, height: 2000, crop: 'limit' }],
    }, (error, result) => {
      if (error || !result?.secure_url || !result?.public_id) {
        reject(error || new Error('Cloudinary returned an incomplete upload result.'));
        return;
      }
      resolve({ url: result.secure_url, publicId: result.public_id });
    });
    Readable.from(buffer).pipe(upload);
  });
}

export async function deleteImage(publicId) {
  configure();
  const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
  if (result?.result !== 'ok' && result?.result !== 'not found') throw new Error(`Cloudinary deletion returned ${result?.result || 'no result'}.`);
  return result;
}

export async function deleteImages(images = []) {
  const outcomes = await Promise.allSettled(images.filter((image) => image?.publicId).map((image) => deleteImage(image.publicId)));
  const failures = outcomes.filter((outcome) => outcome.status === 'rejected').length;
  if (failures) console.error('Cloudinary image cleanup failed:', { count: failures });
}
