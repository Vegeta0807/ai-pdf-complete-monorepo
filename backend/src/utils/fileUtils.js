const fs = require('fs');
const path = require('path');

/**
 * Create uploads directory if it doesn't exist
 */
function createUploadsDir() {
  const uploadDir = process.env.UPLOAD_DIR || 'uploads';
  
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`📁 Created uploads directory: ${uploadDir}`);
  }
}

/**
 * Get file size in human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if file exists
 * @param {string} filePath - Path to file
 * @returns {boolean} - True if file exists
 */
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

/**
 * Delete file safely
 * @param {string} filePath - Path to file
 * @returns {boolean} - True if deleted successfully
 */
function deleteFile(filePath) {
  try {
    if (fileExists(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Deleted file: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Failed to delete file ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Get file extension
 * @param {string} filename - File name
 * @returns {string} - File extension (lowercase)
 */
function getFileExtension(filename) {
  return path.extname(filename).toLowerCase();
}

/**
 * Validate file type
 * @param {string} filename - File name
 * @param {Array<string>} allowedTypes - Allowed file extensions
 * @returns {boolean} - True if file type is allowed
 */
function isValidFileType(filename, allowedTypes = ['.pdf']) {
  const extension = getFileExtension(filename);
  return allowedTypes.includes(extension);
}

/**
 * Clean filename for safe storage
 * @param {string} filename - Original filename
 * @returns {string} - Cleaned filename
 */
function cleanFilename(filename) {
  // Remove special characters and spaces
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
}

/**
 * Generate unique filename
 * @param {string} originalName - Original filename
 * @returns {string} - Unique filename with timestamp
 */
function generateUniqueFilename(originalName) {
  const timestamp = Date.now();
  const extension = getFileExtension(originalName);
  const baseName = path.basename(originalName, extension);
  const cleanName = cleanFilename(baseName);
  
  return `${cleanName}_${timestamp}${extension}`;
}

module.exports = {
  createUploadsDir,
  formatFileSize,
  fileExists,
  deleteFile,
  getFileExtension,
  isValidFileType,
  cleanFilename,
  generateUniqueFilename
};
