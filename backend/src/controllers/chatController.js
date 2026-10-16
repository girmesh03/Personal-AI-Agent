/**
 * @module controllers/chatController
 * @description Controller for Multi-Turn Streaming AI Chat Engine and Session Management.
 * Implements Express 5 Server-Sent Events (SSE) streaming with typed event frames
 * (thought, text, tool_call, tool_result, title, done, error).
 * Features autonomous recursive tool loops (maxSteps: 5) binding the 17-Tool Enterprise Matrix,
 * audio transcription via Addis AI / Gemini STT, attachment grounding, auto-titling,
 * turn persistence, linear pruning, and full session CRUD.
 */

import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import { GoogleGenAI } from '@google/genai';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { Chat } from '../models/Chat.js';
import { Audio } from '../models/Audio.js';
import { HTTP_STATUS, CHAT_CONSTANTS, ATTACHMENT_CONSTANTS, AUDIO_CONSTANTS, AI_MODELS, formatSttEngineDisplayName } from '../utils/constants.js';
import { User } from '../models/User.js';
import { NotFoundError, BadRequestError } from '../errors/CustomError.js';
import { assembleSystemPrompt } from '../utils/promptAssembler.js';
import { agentToolDeclarations, executeAgentTool } from '../tools/agentTools.js';
import { processAttachments } from '../utils/attachmentProcessor.js';
import { transcribeAudioDocument, transcribeAudio as transcribeAudioUtil } from '../utils/audioChunker.js';
import { dispatchToTelegram } from '../services/telegramService.js';
import { generatedDocumentRegistry } from '../services/documentGenerationService.js';

/**
 * Helper to emit a formatted Server-Sent Event frame.
 *
 * @param {import('express').Response} res - Express response stream.
 * @param {string} event - Event type name ('thought'|'text'|'tool_call'|'tool_result'|'title'|'done'|'error').
 * @param {object} data - Payload data.
 */
function sendSSE(res, event, data) {
  if (res.writableEnded || res.destroyed) return;
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch (_e) {
    // Socket already closed
  }
}

/**
 * Compiles a single user turn's parts with ground-truth fidelity across text, audio transcripts,
 * document text contexts, and inline base64 image vision parts. Zero dummy strings.
 *
 * @param {object} msg - User turn message subdocument.
 * @returns {Promise<Array<object>>} Gemini Content parts array.
 */
async function compileUserTurnParts(msg) {
  const parts = [];
  const textSections = [];

  const rawUserText = (msg.text || '').trim();
  if (rawUserText) {
    textSections.push(rawUserText);
  }

  // 1. Audio Transcriptions
  if (Array.isArray(msg.audioTranscriptions) && msg.audioTranscriptions.length > 0) {
    const validTranscriptions = msg.audioTranscriptions.filter((t) => t && typeof t === 'string' && t.trim());
    if (validTranscriptions.length > 0) {
      textSections.push(`[Transcribed Audio]:\n${validTranscriptions.join('\n\n')}`);
    }
  } else if (Array.isArray(msg.audios) && msg.audios.length > 0) {
    try {
      const rawAudios = Array.isArray(msg.audios) ? msg.audios : [];
      const audioIds = rawAudios
        .map((a) => (typeof a === 'object' && a !== null ? (a._id || a.id) : a))
        .filter((id) => id && /^[0-9a-fA-F]{24}$/.test(String(id)));
      if (audioIds.length > 0) {
        const audioDocs = await Audio.find({ _id: { $in: audioIds } });
        const transcriptions = audioDocs
          .map((a) => a.transcription)
          .filter((t) => t && t.trim());
        if (transcriptions.length > 0) {
          textSections.push(`[Transcribed Audio]:\n${transcriptions.join('\n\n')}`);
        }
      }
    } catch (err) {
      logger.warn(`[chatController] Could not rehydrate audio transcripts: ${err.message}`);
    }
  }

  // 2. Document Text Context & Inline Vision Parts
  let inlineParts = [];
  if (msg.documentTextContext && msg.documentTextContext.trim()) {
    textSections.push(`[Attached Document]:\n${msg.documentTextContext.trim()}`);
  } else if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
    try {
      const attResult = await processAttachments(msg.attachments);
      if (attResult.textContext) {
        textSections.push(`[Attached Document]:\n${attResult.textContext}`);
      }
      if (Array.isArray(attResult.inlineParts) && attResult.inlineParts.length > 0) {
        inlineParts = attResult.inlineParts;
      }
    } catch (err) {
      logger.warn(`[chatController] Could not rehydrate attachments: ${err.message}`);
    }
  }

  // If attachments had images and documentTextContext was already cached, extract vision parts
  if (inlineParts.length === 0 && Array.isArray(msg.attachments) && msg.attachments.length > 0) {
    try {
      const attResult = await processAttachments(msg.attachments);
      if (Array.isArray(attResult.inlineParts) && attResult.inlineParts.length > 0) {
        inlineParts = attResult.inlineParts;
      }
    } catch (_err) {
      // silent ignore
    }
  }

  const combinedText = textSections.join('\n\n').trim();
  if (combinedText) {
    parts.push({ text: combinedText });
  } else if (inlineParts.length === 0) {
    parts.push({ text: '(empty message)' });
  }

  if (inlineParts.length > 0) {
    parts.push(...inlineParts);
  }

  return parts;
}

/**
 * Builds the complete, ground-truth Gemini Contents History array across all turns.
 * Guarantees zero context amnesia on model fallback, retry, or multi-turn progression.
 *
 * @param {object} params
 * @param {object} params.chat - Chat document.
 * @param {object} params.userTurn - Active user turn.
 * @param {boolean} params.isContinue - Continuation turn flag.
 * @param {object} [params.stoppedTurn] - Stopped assistant turn if continuing.
 * @returns {Promise<Array<object>>} Formatted Gemini contents array.
 */
export async function buildGeminiHistory({ chat, userTurn, isContinue, stoppedTurn }) {
  const geminiContents = [];

  if (isContinue && stoppedTurn) {
    const anchorIdx = chat.messages.findIndex((m) => m === userTurn);
    for (let i = 0; i < anchorIdx; i++) {
      const msg = chat.messages[i];
      if (msg.role === 'user') {
        const parts = await compileUserTurnParts(msg);
        geminiContents.push({ role: 'user', parts });
      } else if (msg.role === 'assistant') {
        geminiContents.push({
          role: 'model',
          parts: [{ text: msg.text || '(empty response)' }],
        });
      }
    }

    // Anchor user prompt
    const anchorParts = await compileUserTurnParts(userTurn);
    geminiContents.push({ role: 'user', parts: anchorParts });

    // Stopped model response
    geminiContents.push({
      role: 'model',
      parts: [{ text: stoppedTurn.text || '(empty response)' }],
    });

    // Seamless continuation prompt
    geminiContents.push({
      role: 'user',
      parts: [
        {
          text: 'Please continue generating directly from where you left off. Do not repeat what was already written or provide any conversational filler; seamlessly output the remaining content.',
        },
      ],
    });
  } else {
    // Standard history: all turns before the active user message
    const activeUserMsg = userTurn || chat.messages[chat.messages.length - 1];
    const anchorIdx = chat.messages.findIndex((m) => m === activeUserMsg);
    const historyLimit = anchorIdx !== -1 ? anchorIdx : chat.messages.length - 1;

    for (let i = 0; i < historyLimit; i++) {
      const msg = chat.messages[i];
      if (msg.role === 'user') {
        const parts = await compileUserTurnParts(msg);
        geminiContents.push({ role: 'user', parts });
      } else if (msg.role === 'assistant') {
        geminiContents.push({
          role: 'model',
          parts: [{ text: msg.text || '(empty response)' }],
        });
      }
    }

    // Active latest user turn
    const latestParts = await compileUserTurnParts(activeUserMsg);
    geminiContents.push({
      role: 'user',
      parts: latestParts,
    });
  }

  return geminiContents;
}

/**
 * Handles multi-turn streaming conversational turns over Server-Sent Events (SSE).
 *
 * @route POST /api/v1/chat/stream, POST /api/v1/chat/:chatId/stream
 * @access Private
 */
export const streamChat = asyncHandler(async (req, res) => {
  const b = req.validated?.body || req.body || {};
  const requestedChatId = req.validated?.params?.chatId || req.params.chatId || b.chatId;

  // 1. Resolve or initialize Chat document
  let chat;
  if (requestedChatId) {
    chat = await Chat.findOne({
      _id: requestedChatId,
      user: req.user._id,
      isArchived: false,
    });
    if (!chat) {
      throw new NotFoundError('Chat session not found or has been archived.');
    }
  } else {
    chat = new Chat({
      user: req.user._id,
      title: null,
      config: {
        model:
          (b.model && AI_MODELS.SUPPORTED.includes(b.model) ? b.model : null) ||
          (AI_MODELS.SUPPORTED.includes(req.user.settings?.agentConfig?.defaultModel)
            ? req.user.settings.agentConfig.defaultModel
            : AI_MODELS.DEFAULT),
        thinkingBudget:
          b.thinkingBudget ??
          req.user.settings?.agentConfig?.defaultThinkingBudget ??
          CHAT_CONSTANTS.DEFAULT_THINKING_BUDGET,
        language:
          b.language ||
          req.user.settings?.agentConfig?.defaultLanguage ||
          CHAT_CONSTANTS.DEFAULT_LANGUAGE,
      },
    });
  }

  // Apply per-turn config overrides to session if provided and supported
  if (b.model && AI_MODELS.SUPPORTED.includes(b.model)) {
    chat.config.model = b.model;
  }
  if (!AI_MODELS.SUPPORTED.includes(chat.config.model)) {
    chat.config.model = AI_MODELS.DEFAULT;
  }
  if (b.thinkingBudget !== undefined) {
    chat.config.thinkingBudget = b.thinkingBudget;
  }
  if (b.language) {
    chat.config.language = b.language;
  }

  // 2. Setup Server-Sent Events (SSE) Stream Headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  let isClientAborted = false;
  let persistAbortState = null;
  let userTurn = null;
  let stoppedTurn = null;
  let fullText = '';
  let fullThought = '';
  const toolsCalled = [];
  let activeModel =
    (b.model && AI_MODELS.SUPPORTED.includes(b.model) ? b.model : null) ||
    chat.config?.model ||
    req.user.settings?.agentConfig?.defaultModel ||
    AI_MODELS.DEFAULT;

  const handleClientClose = () => {
    if (!res.writableEnded) {
      isClientAborted = true;
      logger.info(`[chatController] Client socket closed / aborted by user for chat: ${requestedChatId || chat?._id}`);
    }
  };
  req.on('close', handleClientClose);
  res.on('close', handleClientClose);

  try {
    // 3. Modality Ingestion & Preparation
    const audioTranscriptions = [];
    let attachmentTextContext = '';
    let inlineParts = [];

    // Dynamically resolve active STT engine and human-friendly display label from SSOT constants
    const activeSttEngine =
      (b.sttEngine && AI_MODELS.STT_ENGINES.includes(b.sttEngine) ? b.sttEngine : null) ||
      (AI_MODELS.STT_ENGINES.includes(req.user.settings?.sttEngine) ? req.user.settings.sttEngine : null) ||
      AI_MODELS.DEFAULT_STT_ENGINE;
    const sttEngineLabel = formatSttEngineDisplayName(activeSttEngine);

    // 4. Handle Turn Type: Continuation vs Retry vs Edit vs Fresh Send
    const isContinue =
      b.continueTurn === true ||
      b.continueTurn === 'true';

    // Find if message ID is already registered in conversation (indicates retry / in-place regeneration)
    const existingMessageIdx = b.id
      ? chat.messages.findIndex(
          (m) => String(m.id) === String(b.id) || String(m._id) === String(b.id)
        )
      : -1;

    const isEdit = !isContinue && typeof b.editTurnIndex === 'number' && b.editTurnIndex >= 0;
    const isRetry =
      !isContinue &&
      !isEdit &&
      (b.isRetry === true ||
        b.isRetry === 'true' ||
        (typeof b.retryTurnIndex === 'number' && b.retryTurnIndex >= 0) ||
        Boolean(b.anchorUserMessageId) ||
        existingMessageIdx !== -1);

    userTurn = null;
    stoppedTurn = null;

    if (isContinue) {
      // CONTINUATION CONTRACT: Never create a new user turn.
      // Resume generating from the stopped assistant turn in chat.messages
      let targetIdx = -1;
      if (b.targetAssistantMessageId) {
        targetIdx = chat.messages.findIndex(
          (m) =>
            String(m.id) === String(b.targetAssistantMessageId) ||
            String(m._id) === String(b.targetAssistantMessageId)
        );
      }
      if (targetIdx === -1) {
        targetIdx = chat.messages.findLastIndex((m) => m.role === 'assistant');
      }

      if (targetIdx === -1 || chat.messages[targetIdx].role !== 'assistant') {
        throw new BadRequestError('Cannot continue: target assistant message not found.');
      }

      stoppedTurn = chat.messages[targetIdx];
      // Prune any turns after the stopped turn to maintain linear causality
      chat.messages = chat.messages.slice(0, targetIdx + 1);

      // Find anchor user turn preceding the stopped assistant turn
      const anchorIdx = chat.messages.slice(0, targetIdx).findLastIndex((m) => m.role === 'user');
      if (anchorIdx === -1) {
        throw new BadRequestError('Cannot continue: corresponding user message not found in conversation.');
      }
      userTurn = chat.messages[anchorIdx];

      // Re-hydrate multi-modal context from anchor user turn
      if (Array.isArray(userTurn.audioTranscriptions) && userTurn.audioTranscriptions.length > 0) {
        audioTranscriptions.push(...userTurn.audioTranscriptions);
      } else if (Array.isArray(userTurn.audios) && userTurn.audios.length > 0) {
        try {
          sendSSE(res, 'status', {
            stage: 'transcribing',
            message: `Transcribing audio note with ${sttEngineLabel}...`,
          });
          const existingAudios = await Audio.find({ _id: { $in: userTurn.audios }, user: req.user._id });
          for (const audioDoc of existingAudios) {
            if (!audioDoc.transcription || audioDoc.status !== 'transcribed') {
              const updated = await transcribeAudioDocument(audioDoc._id, {
                sttEngine: activeSttEngine,
              });
              if (updated?.transcription && updated.transcription.trim()) {
                audioTranscriptions.push(updated.transcription.trim());
              }
            } else if (audioDoc.transcription && audioDoc.transcription.trim()) {
              audioTranscriptions.push(audioDoc.transcription.trim());
            }
          }
        } catch (audioHydrateErr) {
          logger.warn(`[chatController] Failed to re-hydrate audio transcriptions for continue: ${audioHydrateErr.message}`);
        }
      }

      if (userTurn.documentTextContext && userTurn.documentTextContext.trim()) {
        attachmentTextContext = userTurn.documentTextContext.trim();
      }
      if (Array.isArray(userTurn.attachments) && userTurn.attachments.length > 0) {
        try {
          const attResult = await processAttachments(userTurn.attachments);
          if (!attachmentTextContext && attResult.textContext) {
            attachmentTextContext = attResult.textContext;
          }
          if (Array.isArray(attResult.inlineParts) && attResult.inlineParts.length > 0) {
            inlineParts.push(...attResult.inlineParts);
          }
        } catch (attHydrateErr) {
          logger.warn(`[chatController] Failed to re-hydrate attachments for continue: ${attHydrateErr.message}`);
        }
      }
    } else if (isRetry) {
      // RETRY CONTRACT: Never create a new user turn.
      // Re-hydrate multi-modal context strictly from the persisted database record!
      let anchorIdx = -1;
      if (b.anchorUserMessageId) {
        anchorIdx = chat.messages.findIndex(
          (m) =>
            String(m.id) === String(b.anchorUserMessageId) ||
            String(m._id) === String(b.anchorUserMessageId)
        );
      }

      if (anchorIdx === -1 && b.targetAssistantMessageId) {
        const targetAssistantIdx = chat.messages.findIndex(
          (m) =>
            String(m.id) === String(b.targetAssistantMessageId) ||
            String(m._id) === String(b.targetAssistantMessageId)
        );
        if (targetAssistantIdx !== -1) {
          anchorIdx = chat.messages.slice(0, targetAssistantIdx).findLastIndex((m) => m.role === 'user');
        }
      }

      if (anchorIdx === -1 && existingMessageIdx !== -1) {
        anchorIdx = existingMessageIdx;
      }

      if (anchorIdx === -1 && typeof b.retryTurnIndex === 'number' && b.retryTurnIndex > 0) {
        const candidateIdx = b.retryTurnIndex - 1;
        if (candidateIdx >= 0 && candidateIdx < chat.messages.length && chat.messages[candidateIdx].role === 'user') {
          anchorIdx = candidateIdx;
        }
      }

      if (anchorIdx === -1) {
        anchorIdx = chat.messages.findLastIndex((m) => m.role === 'user');
      }

      if (anchorIdx >= 0 && chat.messages[anchorIdx] && chat.messages[anchorIdx].role === 'user') {
        userTurn = chat.messages[anchorIdx];
        // Prune any assistant turns after the anchor user message to restore exact pre-retry turn sequence
        chat.messages = chat.messages.slice(0, anchorIdx + 1);
      } else {
        logger.warn(`[chatController] Could not find valid user turn for retry in chat: ${chat._id}`);
        throw new BadRequestError('Cannot retry: corresponding user message not found in conversation.');
      }

      // Re-hydrate audio recordings from MongoDB
      const shouldReTranscribe = Boolean(b.sttEngine) && Array.isArray(userTurn.audios) && userTurn.audios.length > 0;
      if (!shouldReTranscribe && Array.isArray(userTurn.audioTranscriptions) && userTurn.audioTranscriptions.length > 0) {
        audioTranscriptions.push(...userTurn.audioTranscriptions);
      } else if (Array.isArray(userTurn.audios) && userTurn.audios.length > 0) {
        try {
          sendSSE(res, 'status', {
            stage: 'transcribing',
            message: `Transcribing audio note with ${sttEngineLabel}...`,
          });
          const existingAudios = await Audio.find({ _id: { $in: userTurn.audios }, user: req.user._id });
          for (const audioDoc of existingAudios) {
            if (!audioDoc.transcription || audioDoc.status !== 'transcribed' || shouldReTranscribe) {
              const updated = await transcribeAudioDocument(audioDoc._id, {
                sttEngine: activeSttEngine,
              });
              if (updated?.transcription && updated.transcription.trim()) {
                audioTranscriptions.push(updated.transcription.trim());
              }
            } else if (audioDoc.transcription && audioDoc.transcription.trim()) {
              audioTranscriptions.push(audioDoc.transcription.trim());
            }
          }
          if (shouldReTranscribe && audioTranscriptions.length > 0) {
            userTurn.audioTranscriptions = [...audioTranscriptions];
          }
        } catch (audioHydrateErr) {
          logger.warn(`[chatController] Failed to re-hydrate audio transcriptions: ${audioHydrateErr.message}`);
        }
      }

      // Re-hydrate file attachments from verified disk files
      if (userTurn.documentTextContext && userTurn.documentTextContext.trim()) {
        attachmentTextContext = userTurn.documentTextContext.trim();
      }
      if (Array.isArray(userTurn.attachments) && userTurn.attachments.length > 0) {
        try {
          sendSSE(res, 'status', {
            stage: 'processing_attachments',
            message: 'Extracting document text...',
          });
          const attResult = await processAttachments(userTurn.attachments);
          if (!attachmentTextContext && attResult.textContext) {
            attachmentTextContext = attResult.textContext;
          }
          if (Array.isArray(attResult.inlineParts) && attResult.inlineParts.length > 0) {
            inlineParts.push(...attResult.inlineParts);
          }
        } catch (attHydrateErr) {
          logger.warn(`[chatController] Failed to re-hydrate attachments: ${attHydrateErr.message}`);
        }
      }
    } else {
      // FRESH SEND OR EDIT: Process incoming live audios and attachments
      if (Array.isArray(b.audios) && b.audios.length > 0) {
        sendSSE(res, 'status', {
          stage: 'transcribing',
          message: `Transcribing audio note with ${sttEngineLabel}...`,
        });
        for (const audioId of b.audios) {
          try {
            const audioDoc = await Audio.findOne({ _id: audioId, user: req.user._id });
            if (audioDoc) {
              if (!audioDoc.transcription || audioDoc.status !== 'transcribed') {
                const updated = await transcribeAudioDocument(audioDoc._id, {
                  sttEngine: activeSttEngine,
                });
                if (updated.transcription && updated.transcription.trim()) {
                  audioTranscriptions.push(updated.transcription.trim());
                }
              } else if (audioDoc.transcription && audioDoc.transcription.trim()) {
                audioTranscriptions.push(audioDoc.transcription.trim());
              }
            }
          } catch (audioErr) {
            logger.warn(`[chatController] Failed to transcribe audio ${audioId}: ${audioErr.message}`);
          }
        }
      }

      if (Array.isArray(b.attachments) && b.attachments.length > 0) {
        sendSSE(res, 'status', {
          stage: 'processing_attachments',
          message: 'Extracting document text...',
        });
        const attResult = await processAttachments(b.attachments);
        attachmentTextContext = attResult.textContext;
        inlineParts = attResult.inlineParts;
      }

      if (isEdit) {
        let editIdx = typeof b.editTurnIndex === 'number' ? b.editTurnIndex : -1;
        if (b.anchorUserMessageId) {
          const matchIdx = chat.messages.findIndex(
            (m) =>
              String(m.id) === String(b.anchorUserMessageId) ||
              String(m._id) === String(b.anchorUserMessageId)
          );
          if (matchIdx !== -1) {
            editIdx = matchIdx;
          }
        }
        if (editIdx >= 0) {
          if (editIdx === 0) {
            chat.title = null;
          }
          chat.messages = chat.messages.slice(0, editIdx);
        }
      }

      // Defensive Alternation Invariant Enforcement (Pillar 1)
      // Before pushing a new user turn, if the conversation ends with an un-paired user turn,
      // pair it with an assistant error record so the mathematical sequence is strictly preserved.
      if (!isEdit && chat.messages.length > 0) {
        const lastMsg = chat.messages[chat.messages.length - 1];
        if (lastMsg && lastMsg.role === 'user') {
          chat.messages.push({
            id: new mongoose.Types.ObjectId().toString(),
            role: 'assistant',
            text: '',
            isError: true,
            error: 'Previous turn was interrupted before response was completed.',
            createdAt: new Date(),
          });
        }
      }

      userTurn = {
        id: b.id || new mongoose.Types.ObjectId().toString(),
        role: 'user',
        text: (b.text && typeof b.text === 'string') ? b.text.trim() : '',
        audioTranscriptions,
        documentTextContext: attachmentTextContext || null,
        audios: Array.isArray(b.audios) ? b.audios : [],
        attachments: Array.isArray(b.attachments) ? b.attachments : [],
        createdAt: new Date(),
      };
      chat.messages.push(userTurn);
    }

    // 7. Compose the User Prompt validation
    const partsForPrompt = [];
    const promptText =
      (userTurn?.text && typeof userTurn.text === 'string' && userTurn.text.trim()) ||
      (b.text && typeof b.text === 'string' && b.text.trim()) ||
      '';
    if (promptText) {
      partsForPrompt.push(promptText);
    }
    if (audioTranscriptions.length > 0) {
      partsForPrompt.push(
        `[Transcribed Audio]:\n${audioTranscriptions.join('\n\n')}`
      );
    }
    if (attachmentTextContext) {
      partsForPrompt.push(
        `[Attached Document]:\n${attachmentTextContext}`
      );
    }

    const compiledUserMessageText = partsForPrompt.join('\n\n');

    if (!compiledUserMessageText.trim() && inlineParts.length === 0 && !isRetry && !isContinue) {
      throw new BadRequestError('No speech, text, or valid attachment content detected in message.');
    }

    // Persist user turn immediately and emit session event so client locks onto session ID before stream completes
    await chat.save();
    sendSSE(res, 'session', {
      chatId: chat._id.toString(),
      title: chat.title || 'New Chat',
    });

    // 8. Assemble Dynamic 6-Block System Prompt
    const systemPrompt = await assembleSystemPrompt({
      user: req.user,
      chatConfig: chat.config,
      customTurnPrompt: b.turnPrompt || '',
    });

    // 9. Build Gemini Contents History with Multi-Modal Fidelity
    const geminiContents = await buildGeminiHistory({
      chat,
      userTurn,
      isContinue,
      stoppedTurn,
    });

    // 10. Multi-Step Autonomous Tool Execution Loop (maxSteps: 5)
    const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in environment settings.');
    }

    const ai = new GoogleGenAI({ apiKey });
    const rawModel =
      b.model ||
      chat.config?.model ||
      req.user.settings?.agentConfig?.defaultModel ||
      AI_MODELS.DEFAULT;

    const modelName =
      rawModel && AI_MODELS.SUPPORTED.includes(rawModel)
        ? rawModel
        : AI_MODELS.DEFAULT;

    const thinkingBudget =
      b.thinkingBudget ??
      chat.config?.thinkingBudget ??
      req.user.settings?.agentConfig?.defaultThinkingBudget ??
      CHAT_CONSTANTS.DEFAULT_THINKING_BUDGET;

    fullText = '';
    fullThought = '';
    toolsCalled.length = 0;
    let step = 0;
    const maxSteps = 5;
    activeModel = modelName;
    let tokenUsage = { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 };

    let hasPersistedAbort = false;
    persistAbortState = async () => {
      if (hasPersistedAbort || !chat) return;
      hasPersistedAbort = true;
      try {
        if (isContinue && stoppedTurn) {
          if (fullText) {
            stoppedTurn.text = (stoppedTurn.text ? `${stoppedTurn.text} ` : '') + fullText;
          }
          if (fullThought) {
            stoppedTurn.thought = (stoppedTurn.thought ? `${stoppedTurn.thought}\n` : '') + fullThought;
          }
          stoppedTurn.isStopped = true;
          stoppedTurn.model = activeModel;
          await chat.save();
        } else {
          const lastMsg = chat.messages[chat.messages.length - 1];
          if (!lastMsg || lastMsg.role !== 'assistant') {
            const assistantTurn = {
              id: new mongoose.Types.ObjectId().toString(),
              role: 'assistant',
              text: fullText || '',
              thought: fullThought || null,
              toolCalls: toolsCalled,
              model: activeModel,
              usage: tokenUsage,
              isStopped: true,
              createdAt: new Date(),
            };
            chat.messages.push(assistantTurn);
            await chat.save();
          } else {
            lastMsg.isStopped = true;
            if (fullText) lastMsg.text = fullText;
            await chat.save();
          }
        }
      } catch (saveErr) {
        logger.error(`[chatController] Error persisting aborted turn: ${saveErr.message}`);
      }
    };

    while (step < maxSteps) {
      step++;

      let stepText = '';
      let stepThought = '';
      const functionCalls = [];
      const modelStepParts = [];

      let streamAttempts = 0;
      const maxStreamAttempts = 7;
      let streamSuccess = false;

      while (streamAttempts < maxStreamAttempts && !streamSuccess) {
        streamAttempts++;
        stepText = '';
        stepThought = '';
        functionCalls.length = 0;
        modelStepParts.length = 0;
        const textBeforeAttempt = fullText;
        const thoughtBeforeAttempt = fullThought;

        try {
          const responseStream = await ai.models.generateContentStream({
            model: activeModel,
            contents: geminiContents,
            config: {
              systemInstruction: systemPrompt,
              thinkingConfig: thinkingBudget > 0 ? { thinkingBudget, includeThoughts: true } : undefined,
              tools: [{ functionDeclarations: agentToolDeclarations }],
              temperature: chat.config?.temperature,
            },
          });

          for await (const chunk of responseStream) {
            if (isClientAborted) {
              break;
            }

            if (chunk.usageMetadata) {
              tokenUsage = {
                promptTokens: chunk.usageMetadata.promptTokenCount || tokenUsage.promptTokens,
                candidatesTokens: chunk.usageMetadata.candidatesTokenCount || tokenUsage.candidatesTokens,
                totalTokens: chunk.usageMetadata.totalTokenCount || tokenUsage.totalTokens,
              };
            }

            const candidate = chunk.candidates?.[0];
            if (!candidate) continue;

            const parts = candidate.content?.parts || [];
            for (const part of parts) {
              if (isClientAborted) break;
              if (part.thought) {
                const delta = part.text || '';
                stepThought += delta;
                fullThought += delta;
                sendSSE(res, 'thought', { delta });
              } else if (part.text) {
                const delta = part.text;
                stepText += delta;
                fullText += delta;
                sendSSE(res, 'text', { delta });
              } else if (part.functionCall) {
                functionCalls.push(part.functionCall);
                modelStepParts.push(part);
              }
            }
          }

          if (isClientAborted) {
            break;
          }

          streamSuccess = true;
        } catch (streamErr) {
          if (isClientAborted) {
            break;
          }
          fullText = textBeforeAttempt;
          fullThought = thoughtBeforeAttempt;

          const isQuota =
            streamErr.message?.includes('429') ||
            streamErr.status === 429 ||
            streamErr.message?.includes('RESOURCE_EXHAUSTED');

          const isTransient =
            streamErr.message?.includes('fetch failed') ||
            streamErr.cause?.code === 'ECONNRESET' ||
            streamErr.code === 'ECONNRESET' ||
            streamErr.status === 503 ||
            streamErr.message?.includes('503') ||
            streamErr.message?.includes('Incomplete JSON') ||
            streamErr.message?.includes('JSON segment');

          if (isQuota) {
            const mappedFallback = AI_MODELS.QUOTA_RETRY_MAP[activeModel] || AI_MODELS.FALLBACK;
            if (activeModel !== mappedFallback) {
              const backoffMs = Math.min(800 * Math.pow(1.5, streamAttempts) + Math.floor(Math.random() * 300), 3000);
              logger.warn(
                `[chatController] Model ${activeModel} hit quota limit. Failing over to ${mappedFallback} after ${backoffMs}ms (attempt ${streamAttempts}/${maxStreamAttempts})...`
              );
              sendSSE(res, 'reset_stream', {
                stage: 'model_failover',
                failedModel: activeModel,
                alternateModel: mappedFallback,
                attempt: streamAttempts,
                maxAttempts: maxStreamAttempts,
              });
              activeModel = mappedFallback;
              await new Promise((r) => setTimeout(r, backoffMs));
              continue;
            }
          }

          if (isTransient && streamAttempts < maxStreamAttempts) {
            const currentIdx = AI_MODELS.SUPPORTED.indexOf(activeModel);
            const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % AI_MODELS.SUPPORTED.length : 0;
            const alternateModel = AI_MODELS.SUPPORTED[nextIdx] || AI_MODELS.FALLBACK;
            const backoffMs = Math.min(1000 * Math.pow(1.5, streamAttempts) + Math.floor(Math.random() * 400), 4000);
            logger.warn(
              `[chatController] Transient error or high demand (${streamErr.message?.slice(0, 80)}...). Retrying with ${alternateModel} after ${backoffMs}ms (attempt ${streamAttempts}/${maxStreamAttempts})...`
            );
            sendSSE(res, 'reset_stream', {
              stage: 'model_failover',
              failedModel: activeModel,
              alternateModel,
              attempt: streamAttempts,
              maxAttempts: maxStreamAttempts,
            });
            activeModel = alternateModel;
            await new Promise((r) => setTimeout(r, backoffMs));
            continue;
          }

          throw streamErr;
        }
      }

      if (isClientAborted) {
        break;
      }

      // If no tools were invoked, response is complete
      if (functionCalls.length === 0) {
        break;
      }

      // Execute autonomous tools inside Mongoose ACID sessions
      const functionResponses = [];
      for (const fc of functionCalls) {
        if (isClientAborted) {
          break;
        }
        sendSSE(res, 'status', {
          stage: 'running_tool',
          message: `Executing ${fc.name}...`,
        });
        sendSSE(res, 'tool_call', { name: fc.name, args: fc.args });

        const session = await mongoose.startSession();
        let result;
        try {
          result = await executeAgentTool(fc.name, fc.args, {
            userId: req.user._id,
            session,
          });
        } finally {
          await session.endSession();
        }

        sendSSE(res, 'tool_result', { name: fc.name, result });
        toolsCalled.push({ name: fc.name, args: fc.args, result });

        functionResponses.push({
          functionResponse: {
            name: fc.name,
            response: result,
          },
        });
      }

      if (isClientAborted) {
        break;
      }

      // Append tool invocations and results to conversation for next reasoning step
      geminiContents.push({
        role: 'model',
        parts: modelStepParts,
      });
      geminiContents.push({
        role: 'user',
        parts: functionResponses,
      });
    }

    // Handle user stop / abort interruption before turn completion
    if (isClientAborted) {
      logger.info(`[chatController] Stream stopped by user for chat ${chat._id}. Persisting partial turn.`);
      if (typeof persistAbortState === 'function') {
        await persistAbortState();
      }
      if (!res.writableEnded) {
        res.end();
      }
      return;
    }

    // 11. First-Turn Auto-Titling (Turn 1 only)
    if (!chat.title && !isContinue) {
      try {
        const titlePrompt = `Summarize the user's intent in 3 to 5 words as a concise title. Output ONLY the title:\n"${userTurn.text.slice(0, 300)}"`;
        const titleRes = await ai.models.generateContent({
          model: AI_MODELS.DEFAULT,
          contents: [{ text: titlePrompt }],
        });
        const derivedTitle = (titleRes.text || 'New Conversation').trim().slice(0, 100);
        chat.title = derivedTitle;
        sendSSE(res, 'title', { title: derivedTitle });
      } catch (titleErr) {
        chat.title = 'New Conversation';
        sendSSE(res, 'title', { title: chat.title });
      }
    }

    // 12. Persist Assistant Turn to Chat Document
    let savedAssistantMessageId;
    if (isContinue && stoppedTurn) {
      if (fullText) {
        stoppedTurn.text = (stoppedTurn.text ? `${stoppedTurn.text} ` : '') + fullText;
      }
      if (fullThought) {
        stoppedTurn.thought = (stoppedTurn.thought ? `${stoppedTurn.thought}\n` : '') + fullThought;
      }
      stoppedTurn.isStopped = false;
      stoppedTurn.model = activeModel;
      if (tokenUsage && tokenUsage.totalTokens) {
        stoppedTurn.usage = tokenUsage;
      }
      await chat.save();
      savedAssistantMessageId = stoppedTurn.id || stoppedTurn._id.toString();
    } else {
      const assistantTurn = {
        id: new mongoose.Types.ObjectId().toString(),
        role: 'assistant',
        text: fullText,
        thought: fullThought || null,
        toolCalls: toolsCalled,
        model: activeModel,
        usage: tokenUsage,
        createdAt: new Date(),
      };
      chat.messages.push(assistantTurn);
      await chat.save();
      savedAssistantMessageId = assistantTurn.id;
    }

    // 13. Send Completion Frame
    sendSSE(res, 'done', {
      chatId: chat._id.toString(),
      messageId: savedAssistantMessageId,
      title: chat.title,
      model: activeModel,
      usage: tokenUsage,
    });
    res.end();
  } catch (err) {
    if (isClientAborted) {
      logger.info(`[chatController] Error caught after client abort; persisting partial turn for chat: ${chat?._id}`);
      if (typeof persistAbortState === 'function') {
        await persistAbortState();
      }
      if (!res.writableEnded) {
        res.end();
      }
      return;
    }

    logger.error(`[chatController] Stream error: ${err.message}`, { stack: err.stack, cause: err.cause });
    console.error('[chatController] Full Stream Error:', err, 'cause:', err.cause);

    const isQuota =
      err.message?.includes('429') ||
      err.status === 429 ||
      err.message?.includes('RESOURCE_EXHAUSTED');

    const reason = isQuota ? 'quota_exhausted' : 'server_error';
    const failedModel = typeof activeModel !== 'undefined' && activeModel ? activeModel : AI_MODELS.DEFAULT;
    const suggestedModels = AI_MODELS.SUPPORTED.filter((m) => m !== failedModel);

    // Guaranteed Assistant Persistence on Terminal Error (Pillar 1)
    // Strictly maintains U -> A -> U -> A alternating turn invariant in MongoDB
    if (chat && userTurn) {
      try {
        const lastMsg = chat.messages[chat.messages.length - 1];
        if (!lastMsg || lastMsg.role !== 'assistant') {
          const errorAssistantTurn = {
            id: new mongoose.Types.ObjectId().toString(),
            role: 'assistant',
            text: fullText || '',
            thought: fullThought || null,
            toolCalls: toolsCalled || [],
            model: failedModel,
            isError: true,
            error: isQuota
              ? `Model quota limit reached for ${failedModel}. Please select an alternative model.`
              : (err.message || 'Streaming failed.'),
            createdAt: new Date(),
          };
          chat.messages.push(errorAssistantTurn);
          await chat.save();
        } else {
          lastMsg.isError = true;
          lastMsg.error = err.message || 'Streaming failed.';
          if (fullText) lastMsg.text = fullText;
          await chat.save();
        }
      } catch (saveErr) {
        logger.error(`[chatController] Error persisting failed assistant turn: ${saveErr.message}`);
      }
    }

    sendSSE(res, 'error', {
      message: isQuota
        ? `Model quota limit reached for ${failedModel}. Please select an alternative model.`
        : (err.message || 'Streaming failed.'),
      failedModel,
      reason,
      suggestedModels,
    });
    res.end();
  }
});

/**
 * Lists paginated chat sessions for the authenticated supervisor.
 *
 * @route GET /api/v1/chat
 * @access Private
 */
export const getChats = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || CHAT_CONSTANTS.PAGE_LIMIT_DEFAULT;
  const isArchived = req.query.archived === 'true' || req.query.archived === true;

  const query = {
    user: req.user._id,
    isArchived,
  };

  if (req.query.pinned === 'true' || req.query.pinned === true) {
    query.isPinned = true;
  }

  if (req.query.search && typeof req.query.search === 'string') {
    query.title = { $regex: req.query.search.trim(), $options: 'i' };
  }

  const options = {
    page,
    limit,
    sort: { isPinned: -1, updatedAt: -1 },
    select: '_id title isPinned config updatedAt createdAt',
    lean: true,
  };

  const result = await Chat.paginate(query, options);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: {
      chats: result.docs,
      pagination: {
        page: result.page,
        limit: result.limit,
        totalDocs: result.totalDocs,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      },
    },
  });
});

/**
 * Retrieves a single chat session with full turn history.
 *
 * @route GET /api/v1/chat/:chatId
 * @access Private
 */
export const getChatById = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 30;
  const beforeParam = req.query.before;

  const rawChat = await Chat.findOne({
    _id: req.params.chatId,
    user: req.user._id,
    isArchived: false,
  }).select('messages._id');

  if (!rawChat) {
    throw new NotFoundError('Chat session not found.');
  }

  const totalMessages = rawChat.messages ? rawChat.messages.length : 0;
  let startIndex = 0;
  let count = limit;

  if (beforeParam !== undefined && beforeParam !== null) {
    const beforeIdx = parseInt(beforeParam, 10);
    if (!isNaN(beforeIdx) && beforeIdx > 0) {
      startIndex = Math.max(0, beforeIdx - limit);
      count = beforeIdx - startIndex;
    }
  } else {
    // Initial fetch: newest messages
    startIndex = Math.max(0, totalMessages - limit);
    count = totalMessages - startIndex;
  }

  const chat = await Chat.findOne({
    _id: req.params.chatId,
    user: req.user._id,
    isArchived: false,
  })
    .slice('messages', [startIndex, count])
    .populate('messages.audios');

  const hasMore = startIndex > 0;
  const cursor = hasMore ? String(startIndex) : null;

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: {
      chat,
      totalMessages,
      hasMore,
      cursor,
    },
  });
});

/**
 * Updates configuration parameters for an existing chat session.
 *
 * @route PATCH /api/v1/chat/:chatId/config
 * @access Private
 */
export const updateChatConfig = asyncHandler(async (req, res) => {
  const b = req.validated?.body || req.body || {};
  const chatId = req.validated?.params?.chatId || req.params.chatId;

  const chat = await Chat.findOne({
    _id: chatId,
    user: req.user._id,
    isArchived: false,
  });

  if (!chat) {
    throw new NotFoundError('Chat session not found.');
  }

  if (b.model && AI_MODELS.SUPPORTED.includes(b.model)) chat.config.model = b.model;
  if (b.thinkingBudget !== undefined) chat.config.thinkingBudget = b.thinkingBudget;
  if (b.language) chat.config.language = b.language;
  if (b.prompt !== undefined) chat.config.prompt = b.prompt;

  await chat.save();

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Chat configuration updated successfully.',
    data: {
      chat: {
        _id: chat._id,
        config: chat.config,
      },
    },
  });
});

/**
 * Toggles pinned state of a chat session.
 *
 * @route PATCH /api/v1/chat/:chatId/pin
 * @access Private
 */
export const pinChat = asyncHandler(async (req, res) => {
  const chat = await Chat.findOne({
    _id: req.params.chatId,
    user: req.user._id,
    isArchived: false,
  });

  if (!chat) {
    throw new NotFoundError('Chat session not found.');
  }

  chat.isPinned = !chat.isPinned;
  await chat.save();

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: chat.isPinned ? 'Chat pinned to sidebar.' : 'Chat unpinned.',
    data: {
      chat: {
        _id: chat._id,
        isPinned: chat.isPinned,
      },
    },
  });
});

/**
 * Manually renames a chat session title.
 *
 * @route PATCH /api/v1/chat/:chatId/title
 * @access Private
 */
export const renameChat = asyncHandler(async (req, res) => {
  const title = (req.body.title || '').trim();
  if (!title) {
    throw new BadRequestError('Chat title is required.');
  }

  const chat = await Chat.findOne({
    _id: req.params.chatId,
    user: req.user._id,
    isArchived: false,
  });

  if (!chat) {
    throw new NotFoundError('Chat session not found.');
  }

  chat.title = title;
  await chat.save();

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Chat title updated successfully.',
    data: {
      chat: {
        _id: chat._id,
        title: chat.title,
      },
    },
  });
});

/**
 * Deletes a chat session permanently.
 *
 * @route DELETE /api/v1/chat/:chatId
 * @access Private
 */
export const deleteChat = asyncHandler(async (req, res) => {
  const chat = await Chat.findOneAndDelete({
    _id: req.params.chatId,
    user: req.user._id,
  });

  if (!chat) {
    throw new NotFoundError('Chat session not found.');
  }

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Chat session deleted successfully.',
    data: null,
  });
});

/**
 * Uploads 1 to 5 voice recordings for conversational chat turn grounding.
 * Validates cumulative batch size (<=50MB) and persists Audio documents with purpose 'chat_voice_input'.
 * Executes within a Mongoose transaction session.
 *
 * @route POST /api/v1/chat/upload-audio
 * @access Private
 */
export const uploadChatAudios = asyncHandler(async (req, res) => {
  const files = req.files || [];

  if (files.length === 0) {
    throw new BadRequestError('At least one audio file is required.');
  }

  // Validate cumulative batch size cap (50MB)
  const totalBatchBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
  if (totalBatchBytes > AUDIO_CONSTANTS.MAX_BATCH_SIZE_BYTES) {
    for (const file of files) {
      try {
        await fs.promises.unlink(file.path);
      } catch (_) {}
    }
    throw new BadRequestError(
      `Cumulative audio upload size exceeds the ${AUDIO_CONSTANTS.MAX_BATCH_SIZE_BYTES / (1024 * 1024)}MB batch limit.`
    );
  }

  const session = await mongoose.startSession();
  try {
    let createdAudios;

    await session.withTransaction(async () => {
      const audioPayloads = files.map((file) => {
        let cleanMime = (file.mimetype || '').split(';')[0].trim().toLowerCase();
        if (cleanMime === 'video/webm' || (file.originalname && file.originalname.toLowerCase().endsWith('.webm'))) {
          cleanMime = 'audio/webm';
        }
        return {
          user: req.user._id,
          fileName: file.filename,
          originalName: file.originalname,
          mimeType: cleanMime || 'audio/webm',
          size: file.size,
          path: file.path.replace(/\\/g, '/'),
          purpose: 'chat_voice_input',
          status: 'uploaded',
        };
      });

      createdAudios = await Audio.create(audioPayloads, { session });
    });

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Audio files uploaded successfully',
      data: {
        audios: createdAudios,
      },
    });
  } finally {
    await session.endSession();
  }
});

/**
 * Uploads 1 to 5 attachments for chat message turns.
 * Validates cumulative batch size (<=50MB) and returns attachment metadata.
 *
 * @route POST /api/v1/chat/upload-attachments
 * @access Private
 */
export const uploadChatAttachments = asyncHandler(async (req, res) => {
  const files = req.files || [];

  if (files.length === 0) {
    throw new BadRequestError('At least one attachment file is required.');
  }

  const totalBatchBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
  if (totalBatchBytes > ATTACHMENT_CONSTANTS.MAX_BATCH_SIZE_BYTES) {
    for (const file of files) {
      try {
        await fs.promises.unlink(file.path);
      } catch (_) {}
    }
    throw new BadRequestError(
      `Cumulative attachment batch size cannot exceed ${ATTACHMENT_CONSTANTS.MAX_BATCH_SIZE_BYTES / (1024 * 1024)}MB.`
    );
  }

  const attachments = files.map((file) => ({
    fileName: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    path: path.relative(process.cwd(), file.path).replace(/\\/g, '/'),
    url: `/uploads/attachments/${file.filename}`,
  }));

  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: 'Attachments uploaded successfully.',
    data: {
      attachments,
    },
  });
});

/**
 * Ingests a single voice recording and returns the transcribed text.
 * Used for live voice dictation into the composer without persisting a message turn.
 *
 * @route POST /api/v1/chat/transcribe-audio
 * @access Private
 */
export const transcribeAudio = asyncHandler(async (req, res) => {
  const file =
    req.file ||
    req.files?.audio?.[0] ||
    req.files?.audios?.[0] ||
    req.files?.file?.[0] ||
    null;

  if (!file) {
    throw new BadRequestError('No audio recording uploaded for transcription.');
  }

  const engine =
    req.body?.engine ||
    req.body?.sttEngine ||
    req.user?.settings?.sttEngine ||
    AI_MODELS.DEFAULT_STT_ENGINE;
  const language = req.body?.language || 'am';

  if (file.size === 0) {
    fs.promises.unlink(file.path).catch(() => {});
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        text: '',
        duration: 0,
        engine,
        noAudioDetected: true,
      },
    });
  }

  try {
    const result = await transcribeAudioUtil(file.path, {
      sttEngine: engine,
      language,
      mimeType: file.mimetype,
    });

    const text = (result.text || '').trim();
    const noAudioDetected = !text || result.noAudioDetected === true;

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        text,
        duration: result.duration || 0,
        engine: result.engine,
        noAudioDetected,
      },
    });
  } finally {
    // Defensively clean up the temporary dictation audio file from disk
    fs.promises.unlink(file.path).catch((unlinkErr) => {
      logger.warn(
        `[chatController] Could not unlink temp dictation audio ${file.path}: ${unlinkErr.message}`
      );
    });
  }
});

/**
 * Quick manual broadcast of message text to Telegram.
 *
 * @function shareToTelegramDirect
 * @route POST /api/v1/chat/share-telegram
 * @access Private (Area Supervisor)
 */
export const shareToTelegramDirect = asyncHandler(async (req, res) => {
  const {
    text,
    targetChannel = 'management',
    asImage = false,
    customNote,
    fontSize,
    lineSpacing,
    bold,
    underlineHeaders,
    options = {},
  } = req.body;
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new BadRequestError('Message text is required for Telegram sharing.');
  }

  const mergedOptions = { ...options };
  if (fontSize) mergedOptions.fontSize = fontSize;
  if (lineSpacing) mergedOptions.lineSpacing = lineSpacing;
  if (bold) mergedOptions.allBold = true;
  if (underlineHeaders) mergedOptions.underlineHeaders = true;

  const user = await User.findById(req.user._id).lean();
  const result = await dispatchToTelegram({
    user,
    targetChannel,
    text: text.trim(),
    customNote,
    asImage: Boolean(asImage),
    options: mergedOptions,
  });

  res.status(HTTP_STATUS.OK).json({
    success: result.ok || result.success || false,
    data: result,
  });
});

/**
 * Securely streams a generated document file for download.
 *
 * @function downloadGeneratedDocument
 * @route GET /api/v1/chat/downloads/:fileId
 * @access Private (Area Supervisor)
 */
export const downloadGeneratedDocument = asyncHandler(async (req, res) => {
  const { fileId } = req.params;
  if (!fileId || typeof fileId !== 'string' || !/^[0-9a-fA-F]{32}$/.test(fileId)) {
    throw new BadRequestError('Invalid document download identifier.');
  }

  const meta = generatedDocumentRegistry.get(fileId);
  const docsDir = path.resolve(process.cwd(), 'backend/uploads/generated_documents');

  let targetFilePath = null;
  let targetFileName = 'document';
  let targetMime = 'application/octet-stream';

  if (meta) {
    targetFilePath = meta.filePath;
    targetFileName = meta.fileName;
    targetMime = meta.mimeType;
  } else if (fs.existsSync(docsDir)) {
    const files = fs.readdirSync(docsDir);
    const match = files.find((f) => f.startsWith(`${fileId}_`));
    if (match) {
      targetFilePath = path.join(docsDir, match);
      targetFileName = match.replace(`${fileId}_`, '');
      const ext = path.extname(targetFileName).toLowerCase();
      if (ext === '.pdf') targetMime = 'application/pdf';
      else if (ext === '.docx') targetMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      else if (ext === '.xlsx') targetMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      else if (ext === '.csv') targetMime = 'text/csv';
      else if (ext === '.md') targetMime = 'text/markdown';
      else if (ext === '.json') targetMime = 'application/json';
    }
  }

  if (!targetFilePath || !fs.existsSync(targetFilePath)) {
    throw new NotFoundError('The requested document was not found or has expired.');
  }

  res.setHeader('Content-Type', targetMime);
  res.setHeader('Content-Disposition', `attachment; filename="${targetFileName}"`);
  const stream = fs.createReadStream(targetFilePath);
  stream.pipe(res);
});

export default {
  streamChat,
  getChats,
  getChatById,
  updateChatConfig,
  pinChat,
  renameChat,
  deleteChat,
  uploadChatAttachments,
  uploadChatAudios,
  transcribeAudio,
  shareToTelegramDirect,
  downloadGeneratedDocument,
};
