const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * File upload utility for handling various file types
 */
class FileUploadService {
  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || 'uploads';
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
    this.allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    this.allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
    this.allowedAudioTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'];
    this.allowedDocumentTypes = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    
    this.initializeDirectories();
  }

  /**
   * Initialize upload directories
   */
  async initializeDirectories() {
    try {
      const directories = [
        this.uploadDir,
        path.join(this.uploadDir, 'avatars'),
        path.join(this.uploadDir, 'recordings'),
        path.join(this.uploadDir, 'documents'),
        path.join(this.uploadDir, 'temp'),
        path.join(this.uploadDir, 'thumbnails')
      ];

      for (const dir of directories) {
        try {
          await fs.access(dir);
        } catch {
          await fs.mkdir(dir, { recursive: true });
          console.log(`Created directory: ${dir}`);
        }
      }
    } catch (error) {
      console.error('Error initializing upload directories:', error);
    }
  }

  /**
   * Generate unique filename
   * @param {string} originalName - Original filename
   * @param {string} prefix - Filename prefix
   * @returns {string} Unique filename
   */
  generateUniqueFilename(originalName, prefix = '') {
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    
    return `${prefix}${name}-${timestamp}-${random}${ext}`;
  }

  /**
   * Get file type category
   * @param {string} mimeType - File MIME type
   * @returns {string} File category
   */
  getFileCategory(mimeType) {
    if (this.allowedImageTypes.includes(mimeType)) return 'image';
    if (this.allowedVideoTypes.includes(mimeType)) return 'video';
    if (this.allowedAudioTypes.includes(mimeType)) return 'audio';
    if (this.allowedDocumentTypes.includes(mimeType)) return 'document';
    return 'other';
  }

  /**
   * Avatar upload configuration
   */
  getAvatarUpload() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, path.join(this.uploadDir, 'avatars'));
      },
      filename: (req, file, cb) => {
        const filename = this.generateUniqueFilename(file.originalname, 'avatar-');
        cb(null, filename);
      }
    });

    const fileFilter = (req, file, cb) => {
      if (this.allowedImageTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
      }
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB for avatars
        files: 1
      }
    });
  }

  /**
   * Document upload configuration
   */
  getDocumentUpload() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, path.join(this.uploadDir, 'documents'));
      },
      filename: (req, file, cb) => {
        const filename = this.generateUniqueFilename(file.originalname, 'doc-');
        cb(null, filename);
      }
    });

    const fileFilter = (req, file, cb) => {
      const allowedTypes = [
        ...this.allowedImageTypes,
        ...this.allowedVideoTypes,
        ...this.allowedAudioTypes,
        ...this.allowedDocumentTypes
      ];

      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Please check allowed file types.'));
      }
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: this.maxFileSize,
        files: 5 // Allow up to 5 files
      }
    });
  }

  /**
   * Memory upload for processing before saving
   */
  getMemoryUpload() {
    const fileFilter = (req, file, cb) => {
      const allowedTypes = [
        ...this.allowedImageTypes,
        ...this.allowedVideoTypes,
        ...this.allowedAudioTypes,
        ...this.allowedDocumentTypes
      ];

      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type.'));
      }
    };

    return multer({
      storage: multer.memoryStorage(),
      fileFilter,
      limits: {
        fileSize: this.maxFileSize,
        files: 10
      }
    });
  }

  /**
   * Save file from buffer
   * @param {Buffer} buffer - File buffer
   * @param {string} originalName - Original filename
   * @param {string} mimeType - File MIME type
   * @param {string} category - File category
   * @param {string} userId - User ID (optional)
   * @returns {Promise<object>} File information
   */
  async saveFileFromBuffer(buffer, originalName, mimeType, category = null, userId = null) {
    try {
      const fileCategory = category || this.getFileCategory(mimeType);
      const filename = this.generateUniqueFilename(originalName, `${fileCategory}-`);
      const filepath = path.join(this.uploadDir, fileCategory === 'image' ? 'avatars' : 'documents', filename);

      await fs.writeFile(filepath, buffer);

      const stats = await fs.stat(filepath);

      return {
        filename,
        originalName,
        filepath,
        size: stats.size,
        mimeType,
        category: fileCategory,
        uploadedBy: userId,
        uploadedAt: new Date(),
        url: `/uploads/${fileCategory === 'image' ? 'avatars' : 'documents'}/${filename}`
      };
    } catch (error) {
      console.error('Error saving file from buffer:', error);
      throw new Error('Failed to save file');
    }
  }

  /**
   * Delete file
   * @param {string} filepath - File path to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(filepath) {
    try {
      await fs.unlink(filepath);
      console.log(`File deleted: ${filepath}`);
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  /**
   * Get file information
   * @param {string} filepath - File path
   * @returns {Promise<object>} File information
   */
  async getFileInfo(filepath) {
    try {
      const stats = await fs.stat(filepath);
      const ext = path.extname(filepath);
      const name = path.basename(filepath, ext);

      return {
        name,
        extension: ext,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      };
    } catch (error) {
      console.error('Error getting file info:', error);
      return null;
    }
  }

  /**
   * Generate thumbnail for images
   * @param {string} imagePath - Original image path
   * @param {number} width - Thumbnail width
   * @param {number} height - Thumbnail height
   * @returns {Promise<string>} Thumbnail path
   */
  async generateThumbnail(imagePath, width = 150, height = 150) {
    try {
      // This would require sharp or jimp for image processing
      // For now, returning the original path as placeholder
      console.log(`Generating thumbnail for ${imagePath} (${width}x${height})`);
      
      // TODO: Implement actual thumbnail generation
      // const sharp = require('sharp');
      // const thumbnailPath = path.join(this.uploadDir, 'thumbnails', `thumb-${path.basename(imagePath)}`);
      // await sharp(imagePath)
      //   .resize(width, height)
      //   .jpeg({ quality: 80 })
      //   .toFile(thumbnailPath);
      // return thumbnailPath;

      return imagePath; // Temporary return original path
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return imagePath;
    }
  }

  /**
   * Validate file
   * @param {object} file - File object
   * @param {object} options - Validation options
   * @returns {object} Validation result
   */
  validateFile(file, options = {}) {
    const {
      maxSize = this.maxFileSize,
      allowedTypes = null,
      required = false
    } = options;

    const result = {
      isValid: true,
      errors: []
    };

    // Check if file is required
    if (required && !file) {
      result.isValid = false;
      result.errors.push('File is required');
      return result;
    }

    if (file) {
      // Check file size
      if (file.size > maxSize) {
        result.isValid = false;
        result.errors.push(`File size exceeds limit of ${maxSize / (1024 * 1024)}MB`);
      }

      // Check file type
      const allowedFileTypes = allowedTypes || [
        ...this.allowedImageTypes,
        ...this.allowedVideoTypes,
        ...this.allowedAudioTypes,
        ...this.allowedDocumentTypes
      ];

      if (!allowedFileTypes.includes(file.mimetype)) {
        result.isValid = false;
        result.errors.push('Invalid file type');
      }

      // Check filename
      if (file.originalname && !/^[a-zA-Z0-9._-]+$/.test(file.originalname)) {
        result.isValid = false;
        result.errors.push('Invalid characters in filename');
      }
    }

    return result;
  }

  /**
   * Clean up old files
   * @param {number} daysOld - Days to consider as old
   * @param {string} directory - Directory to clean (optional)
   * @returns {Promise<object>} Cleanup result
   */
  async cleanupOldFiles(daysOld = 30, directory = null) {
    try {
      const targetDir = directory || path.join(this.uploadDir, 'temp');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const files = await fs.readdir(targetDir);
      let deletedCount = 0;

      for (const file of files) {
        const filepath = path.join(targetDir, file);
        const stats = await fs.stat(filepath);

        if (stats.birthtime < cutoffDate) {
          await this.deleteFile(filepath);
          deletedCount++;
        }
      }

      console.log(`Cleaned up ${deletedCount} old files from ${targetDir}`);
      return {
        success: true,
        deletedCount,
        directory: targetDir
      };
    } catch (error) {
      console.error('Error during cleanup:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get upload statistics
   * @returns {Promise<object>} Upload statistics
   */
  async getUploadStats() {
    try {
      const stats = {
        totalFiles: 0,
        totalSize: 0,
        categories: {
          avatars: { count: 0, size: 0 },
          documents: { count: 0, size: 0 },
          recordings: { count: 0, size: 0 },
          thumbnails: { count: 0, size: 0 }
        }
      };

      const directories = Object.keys(stats.categories);

      for (const dir of directories) {
        const dirPath = path.join(this.uploadDir, dir);
        
        try {
          const files = await fs.readdir(dirPath);
          
          for (const file of files) {
            const filepath = path.join(dirPath, file);
            const fileStats = await fs.stat(filepath);
            
            if (fileStats.isFile()) {
              stats.categories[dir].count++;
              stats.categories[dir].size += fileStats.size;
              stats.totalFiles++;
              stats.totalSize += fileStats.size;
            }
          }
        } catch (error) {
          console.warn(`Directory ${dirPath} not accessible:`, error.message);
        }
      }

      return stats;
    } catch (error) {
      console.error('Error getting upload stats:', error);
      return null;
    }
  }

  /**
   * Process uploaded files
   * @param {array} files - Array of uploaded files
   * @param {string} userId - User ID
   * @returns {Promise<array>} Processed file information
   */
  async processUploadedFiles(files, userId) {
    const processedFiles = [];

    for (const file of files) {
      try {
        const fileInfo = {
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          category: this.getFileCategory(file.mimetype),
          uploadedBy: userId,
          uploadedAt: new Date(),
          path: file.path,
          url: `/uploads/${file.filename}`
        };

        // Generate thumbnail for images
        if (this.allowedImageTypes.includes(file.mimetype)) {
          fileInfo.thumbnailPath = await this.generateThumbnail(file.path);
          fileInfo.thumbnailUrl = `/uploads/thumbnails/${path.basename(fileInfo.thumbnailPath)}`;
        }

        processedFiles.push(fileInfo);
      } catch (error) {
        console.error('Error processing file:', error);
      }
    }

    return processedFiles;
  }

  /**
   * Move file to different directory
   * @param {string} currentPath - Current file path
   * @param {string} newPath - New file path
   * @returns {Promise<boolean>} Success status
   */
  async moveFile(currentPath, newPath) {
    try {
      // Ensure destination directory exists
      const destDir = path.dirname(newPath);
      await fs.mkdir(destDir, { recursive: true });

      // Move file
      await fs.rename(currentPath, newPath);
      console.log(`File moved from ${currentPath} to ${newPath}`);
      return true;
    } catch (error) {
      console.error('Error moving file:', error);
      return false;
    }
  }

  /**
   * Copy file
   * @param {string} sourcePath - Source file path
   * @param {string} destPath - Destination file path
   * @returns {Promise<boolean>} Success status
   */
  async copyFile(sourcePath, destPath) {
    try {
      // Ensure destination directory exists
      const destDir = path.dirname(destPath);
      await fs.mkdir(destDir, { recursive: true });

      // Copy file
      await fs.copyFile(sourcePath, destPath);
      console.log(`File copied from ${sourcePath} to ${destPath}`);
      return true;
    } catch (error) {
      console.error('Error copying file:', error);
      return false;
    }
  }
}

// Create singleton instance
const fileUploadService = new FileUploadService();

module.exports = fileUploadService;