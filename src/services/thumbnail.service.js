// ============================================
// Thumbnail Service — Generate and manage thumbnails
// ============================================

const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

const {
  STORAGE_BASE,
  THUMBNAIL_BASE,
  THUMB_MAX_WIDTH,
  THUMB_QUALITY
} = require('../config');

const getOriginalPath = (username, filename) => path.join(STORAGE_BASE, username, filename);
const getThumbnailFilename = (filename) => `${filename}.thumb.jpg`;
const getThumbnailPath = (username, filename) =>
  path.join(THUMBNAIL_BASE, username, getThumbnailFilename(filename));

const ensureThumbnail = async (username, filename) => {
  const originalPath = getOriginalPath(username, filename);

  if (!fs.existsSync(originalPath)) {
    const err = new Error('Source image not found');
    err.code = 'ENOENT';
    throw err;
  }

  const thumbPath = getThumbnailPath(username, filename);
  const thumbDir = path.dirname(thumbPath);

  if (!fs.existsSync(thumbDir)) {
    fs.mkdirSync(thumbDir, { recursive: true });
  }

  const sourceStat = fs.statSync(originalPath);

  if (fs.existsSync(thumbPath)) {
    const thumbStat = fs.statSync(thumbPath);
    if (thumbStat.mtimeMs >= sourceStat.mtimeMs) {
      return thumbPath;
    }
  }

  const image = await Jimp.read(originalPath);
  if (image.bitmap.width > THUMB_MAX_WIDTH) {
    image.resize(THUMB_MAX_WIDTH, Jimp.AUTO);
  }

  await image.quality(THUMB_QUALITY).writeAsync(thumbPath);
  return thumbPath;
};

const deleteThumbnail = (username, filename) => {
  const thumbPath = getThumbnailPath(username, filename);
  if (fs.existsSync(thumbPath)) {
    fs.unlinkSync(thumbPath);
  }
};

const deleteUserThumbnailFolder = (username) => {
  const userThumbDir = path.join(THUMBNAIL_BASE, username);
  if (fs.existsSync(userThumbDir)) {
    fs.rmSync(userThumbDir, { recursive: true, force: true });
  }
};

module.exports = {
  ensureThumbnail,
  getThumbnailPath,
  getOriginalPath,
  deleteThumbnail,
  deleteUserThumbnailFolder
};