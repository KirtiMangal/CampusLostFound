import multer from 'multer';
import AppError from '../utils/AppError.js';

export const MAX_ITEM_IMAGES = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_ITEM_IMAGES, fields: 12, parts: 18 },
  fileFilter(_req, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new AppError('Only JPEG, PNG, or WebP images are allowed.', 400, 'INVALID_IMAGE_TYPE'));
      return;
    }
    callback(null, true);
  },
}).array('images', MAX_ITEM_IMAGES);

function detectedMime(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export function validateItemImages(req, res, next) {
  upload(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        const tooMany = error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE';
        const tooLarge = error.code === 'LIMIT_FILE_SIZE';
        next(new AppError(tooMany ? 'You can upload up to 5 images.' : tooLarge ? 'Each image must be 5 MB or smaller.' : 'Invalid image upload.', 400, tooMany ? 'TOO_MANY_IMAGES' : tooLarge ? 'IMAGE_TOO_LARGE' : 'INVALID_IMAGE_UPLOAD'));
        return;
      }
      next(error);
      return;
    }
    const files = req.files || [];
    for (const file of files) {
      const actualMime = detectedMime(file.buffer);
      if (!actualMime || actualMime !== file.mimetype) {
        next(new AppError('One or more files are not valid JPEG, PNG, or WebP images.', 400, 'INVALID_IMAGE_TYPE'));
        return;
      }
    }
    next();
  });
}
