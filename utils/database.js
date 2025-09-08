const mongoose = require('mongoose');

/**
 * Database connection utility
 */
class DatabaseManager {
  constructor() {
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5 seconds
  }

  /**
   * Connect to MongoDB
   * @param {string} uri - MongoDB connection URI
   * @param {object} options - Mongoose connection options
   * @returns {Promise} Connection promise
   */
  async connect(uri = process.env.MONGODB_URI, options = {}) {
    try {
      const defaultOptions = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: parseInt(process.env.CONNECTION_POOL_SIZE) || 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
        bufferMaxEntries: 0,
        family: 4 // Use IPv4, skip trying IPv6
      };

      const connectionOptions = { ...defaultOptions, ...options };

      if (!uri) {
        throw new Error('MongoDB URI is required');
      }

      console.log('Connecting to MongoDB...');
      await mongoose.connect(uri, connectionOptions);
      
      this.isConnected = true;
      this.connectionRetries = 0;
      
      console.log('MongoDB connected successfully');
      this.setupEventListeners();
      
      return mongoose.connection;
    } catch (error) {
      console.error('MongoDB connection error:', error);
      await this.handleConnectionError(uri, options);
    }
  }

  /**
   * Handle connection errors with retry logic
   * @param {string} uri - MongoDB connection URI
   * @param {object} options - Connection options
   */
  async handleConnectionError(uri, options) {
    this.connectionRetries++;
    
    if (this.connectionRetries <= this.maxRetries) {
      console.log(`Retrying MongoDB connection (${this.connectionRetries}/${this.maxRetries}) in ${this.retryDelay / 1000} seconds...`);
      
      await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      return this.connect(uri, options);
    } else {
      console.error('Max connection retries reached. Exiting...');
      process.exit(1);
    }
  }

  /**
   * Setup database event listeners
   */
  setupEventListeners() {
    const db = mongoose.connection;

    db.on('connected', () => {
      console.log('Mongoose connected to MongoDB');
      this.isConnected = true;
    });

    db.on('error', (error) => {
      console.error('Mongoose connection error:', error);
      this.isConnected = false;
    });

    db.on('disconnected', () => {
      console.log('Mongoose disconnected from MongoDB');
      this.isConnected = false;
      
      // Attempt to reconnect if not in test environment
      if (process.env.NODE_ENV !== 'test') {
        this.reconnect();
      }
    });

    db.on('reconnected', () => {
      console.log('Mongoose reconnected to MongoDB');
      this.isConnected = true;
    });

    // Handle application termination
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
  }

  /**
   * Attempt to reconnect to database
   */
  async reconnect() {
    if (!this.isConnected && this.connectionRetries < this.maxRetries) {
      try {
        console.log('Attempting to reconnect to MongoDB...');
        await mongoose.connect();
      } catch (error) {
        console.error('Reconnection failed:', error);
        this.connectionRetries++;
        
        setTimeout(() => this.reconnect(), this.retryDelay);
      }
    }
  }

  /**
   * Graceful shutdown
   * @param {string} signal - Shutdown signal
   */
  async gracefulShutdown(signal) {
    console.log(`${signal} received. Shutting down gracefully...`);
    
    try {
      await mongoose.connection.close();
      console.log('MongoDB connection closed.');
      process.exit(0);
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Check database health
   * @returns {Promise<object>} Health status
   */
  async checkHealth() {
    try {
      const state = mongoose.connection.readyState;
      const states = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
      };

      const isHealthy = state === 1;
      
      if (isHealthy) {
        // Perform a simple operation to verify database responsiveness
        await mongoose.connection.db.admin().ping();
      }

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        state: states[state],
        readyState: state,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get database statistics
   * @returns {Promise<object>} Database stats
   */
  async getStats() {
    try {
      if (!this.isConnected) {
        throw new Error('Database not connected');
      }

      const db = mongoose.connection.db;
      const stats = await db.stats();
      const collections = await db.listCollections().toArray();

      return {
        database: stats.db,
        collections: stats.collections,
        objects: stats.objects,
        avgObjSize: stats.avgObjSize,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        indexes: stats.indexes,
        indexSize: stats.indexSize,
        fileSize: stats.fileSize,
        collectionNames: collections.map(col => col.name),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      throw error;
    }
  }

  /**
   * Create database indexes for better performance
   */
  async createIndexes() {
    try {
      console.log('Creating database indexes...');

      // User model indexes
      const User = require('../models/user.model');
      await User.createIndexes();

      // Call model indexes
      const Call = require('../models/call.model');
      await Call.createIndexes();

      console.log('Database indexes created successfully');
    } catch (error) {
      console.error('Error creating indexes:', error);
    }
  }

  /**
   * Clean up old data
   * @param {number} daysOld - Days to consider as old
   */
  async cleanup(daysOld = 30) {
    try {
      console.log(`Cleaning up data older than ${daysOld} days...`);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // Clean up old calls
      const Call = require('../models/call.model');
      const oldCallsResult = await Call.deleteMany({
        status: 'ended',
        endedAt: { $lt: cutoffDate }
      });

      console.log(`Cleaned up ${oldCallsResult.deletedCount} old calls`);

      return {
        callsDeleted: oldCallsResult.deletedCount,
        cutoffDate: cutoffDate.toISOString()
      };
    } catch (error) {
      console.error('Error during cleanup:', error);
      throw error;
    }
  }

  /**
   * Backup database
   * @param {string} backupPath - Path to store backup
   */
  async backup(backupPath) {
    try {
      console.log('Creating database backup...');
      
      // This is a simplified backup - in production, use mongodump
      const collections = await mongoose.connection.db.listCollections().toArray();
      const backup = {};

      for (const collection of collections) {
        const collectionData = await mongoose.connection.db
          .collection(collection.name)
          .find({})
          .toArray();
        backup[collection.name] = collectionData;
      }

      // In a real implementation, you'd write this to a file or cloud storage
      console.log(`Backup completed for ${collections.length} collections`);
      
      return {
        collections: collections.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error creating backup:', error);
      throw error;
    }
  }

  /**
   * Get connection status
   * @returns {object} Connection status
   */
  getConnectionStatus() {
    const state = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    return {
      isConnected: this.isConnected,
      state: states[state],
      readyState: state,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name,
      retries: this.connectionRetries
    };
  }

  /**
   * Close database connection
   */
  async disconnect() {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        this.isConnected = false;
        console.log('Database connection closed');
      }
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  }

  /**
   * Transaction helper
   * @param {function} callback - Transaction callback
   * @returns {Promise} Transaction result
   */
  async transaction(callback) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Paginate query results
   * @param {object} model - Mongoose model
   * @param {object} query - Query object
   * @param {object} options - Pagination options
   * @returns {Promise<object>} Paginated results
   */
  async paginate(model, query = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      sort = { createdAt: -1 },
      populate = '',
      select = ''
    } = options;

    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      model
        .find(query)
        .select(select)
        .populate(populate)
        .sort(sort)
        .skip(skip)
        .limit(limit),
      model.countDocuments(query)
    ]);

    return {
      data,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    };
  }
}

// Create singleton instance
const databaseManager = new DatabaseManager();

module.exports = databaseManager;