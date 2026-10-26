/**
 * @module models/Audio
 * @description Mongoose schema and model definition for standalone Audio recordings.
 * Scoped strictly to the authenticated supervisor (user: req.user._id).
 * Serves multi-purpose operational workflows: report narration, conversational voice input,
 * and standalone voice memos. Tracks disk storage paths, STT transcription status,
 * duration, and soft-archival lifecycle with partial index optimization.
 */

import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { BASE_SCHEMA_OPTIONS } from '../config/schemaOptions.js';
import { AUDIO_CONSTANTS } from '../utils/constants.js';

/**
 * @typedef {Object} IAudio
 * @property {import('mongoose').Types.ObjectId} _id - Unique audio media asset identifier.
 * @property {import('mongoose').Types.ObjectId} user - Owning supervisor user reference.
 * @property {string} fileName - Storage filename on disk.
 * @property {string} originalName - Original upload filename.
 * @property {string} mimeType - Audio MIME type.
 * @property {number} size - File size in bytes.
 * @property {string} path - Canonical relative filesystem storage path.
 * @property {string} url - Derived virtual HTTP access URL.
 * @property {number|null} duration - Audio duration in seconds.
 * @property {string} purpose - Operational purpose ('report_narration' | 'chat_voice_input' | 'general_memo').
 * @property {string|null} sttEngine - Engine used to transcribe this recording, if transcribed.
 * @property {string} transcription - Speech-to-text transcribed text.
 * @property {string} status - Ingestion and transcription status ('uploaded' | 'transcribing' | 'transcribed' | 'failed').
 * @property {string|null} error - Error message if transcription failed.
 * @property {boolean} isArchived - Soft-deletion archival flag.
 * @property {Date|null} archivedAt - Timestamp when audio was soft-archived.
 * @property {Date} createdAt - Document creation timestamp.
 * @property {Date} updatedAt - Document last modification timestamp.
 */

const audioSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Audio must belong to a supervisor.'],
      index: true,
    },
    fileName: {
      type: String,
      required: [true, 'Audio storage filename is required.'],
      trim: true,
    },
    originalName: {
      type: String,
      required: [true, 'Audio original filename is required.'],
      trim: true,
    },
    mimeType: {
      type: String,
      required: [true, 'Audio MIME type is required.'],
      enum: {
        values: AUDIO_CONSTANTS.ALLOWED_MIME_TYPES,
        message: '{VALUE} is not a supported audio MIME type.',
      },
      trim: true,
    },
    size: {
      type: Number,
      required: [true, 'Audio file size in bytes is required.'],
      min: [1, 'Audio file cannot be empty.'],
      max: [
        AUDIO_CONSTANTS.MAX_FILE_SIZE_BYTES,
        `Audio file size exceeds the ${AUDIO_CONSTANTS.MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit.`,
      ],
    },
    path: {
      type: String,
      required: [true, 'Audio relative storage path is required.'],
      trim: true,
    },
    duration: {
      type: Number,
      default: null, // Audio duration in seconds
      min: [0, 'Audio duration cannot be negative.'],
      max: [
        AUDIO_CONSTANTS.MAX_DURATION_SECONDS,
        `Audio duration cannot exceed ${AUDIO_CONSTANTS.MAX_DURATION_SECONDS} seconds.`,
      ],
    },
    purpose: {
      type: String,
      enum: AUDIO_CONSTANTS.PURPOSES,
      default: AUDIO_CONSTANTS.DEFAULT_PURPOSE,
      index: true,
    },
    sttEngine: {
      type: String,
      default: null, // Populated dynamically upon transcription; user default settings apply if omitted
    },
    transcription: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: AUDIO_CONSTANTS.STATUSES,
      default: AUDIO_CONSTANTS.DEFAULT_STATUS,
      index: true,
    },
    error: {
      type: String,
      default: null,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  BASE_SCHEMA_OPTIONS
);

/**
 * Derived virtual getter: url
 * Normalizes relative disk path to an accessible HTTP URL path.
 * @memberof audioSchema
 * @returns {string|null} Relative HTTP URL.
 */
audioSchema.virtual('url').get(function () {
  if (this.fileName) {
    return `/uploads/audios/${this.fileName}`;
  }
  if (!this.path) return null;
  const normalized = this.path.replace(/\\/g, '/');
  const uploadIdx = normalized.indexOf('/uploads/');
  if (uploadIdx !== -1) {
    return normalized.slice(uploadIdx);
  }
  const bareUploadIdx = normalized.indexOf('uploads/');
  if (bareUploadIdx !== -1) {
    return `/${normalized.slice(bareUploadIdx)}`;
  }
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
});

// Partial compound index for active audio directory listing (primary query path)
audioSchema.index(
  { user: 1, createdAt: -1 },
  { partialFilterExpression: { isArchived: false } }
);

// Partial compound index for archived audio sweeper and archive inspection
audioSchema.index(
  { user: 1, archivedAt: -1 },
  { partialFilterExpression: { isArchived: true } }
);

// Attach pagination plugin
audioSchema.plugin(mongoosePaginate);

export const Audio = mongoose.model('Audio', audioSchema);

export default Audio;
