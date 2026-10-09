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
import { HTTP_STATUS, CHAT_CONSTANTS, ATTACHMENT_CONSTANTS, AI_MODELS } from '../utils/constants.js';
import { NotFoundError, BadRequestError } from '../errors/CustomError.js';
import { assembleSystemPrompt } from '../utils/promptAssembler.js';
import { agentToolDeclarations, executeAgentTool } from '../tools/agentTools.js';
import { processAttachments } from '../utils/attachmentProcessor.js';
import { transcribeAudioDocument, transcribeAudio as transcribeAudioUtil } from '../utils/audioChunker.js';

/**
 * Helper to emit a formatted Server-Sent Event frame.
 *
 * @param {import('express').Response} res - Express response stream.
 * @param {string} event - Event type name ('thought'|'text'|'tool_call'|'tool_result'|'title'|'done'|'error').
 * @param {object} data - Payload data.
 */
function sendSSE(res, event, data) {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
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

  console.log('b', b)

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

    console.log('chat', chat)

  // 2. Setup Server-Sent Events (SSE) Stream Headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  try {
    // 3. Audio Ingestion & Transcription (Pillar 2 / Composites)
    const audioTranscriptions = [];
    if (Array.isArray(b.audios) && b.audios.length > 0) {
      for (const audioId of b.audios) {
        try {
          const audioDoc = await Audio.findOne({ _id: audioId, user: req.user._id });
          if (audioDoc) {
            if (!audioDoc.transcription || audioDoc.status !== 'transcribed') {
              const updated = await transcribeAudioDocument(audioDoc._id, {
                sttEngine: req.user.settings?.sttEngine,
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

      console.log('audioTranscriptions', audioTranscriptions)

    // 4. Attachment Ingestion & Grounding (Pillar 1 / Composites)
    let attachmentTextContext = '';
    let inlineParts = [];
    if (Array.isArray(b.attachments) && b.attachments.length > 0) {
      const attResult = await processAttachments(b.attachments);
      attachmentTextContext = attResult.textContext;
      inlineParts = attResult.inlineParts;
    }

    // 5. Compose the User Prompt
    const partsForPrompt = [];
    if (b.text && typeof b.text === 'string' && b.text.trim()) {
      partsForPrompt.push(b.text.trim());
    }
    if (audioTranscriptions.length > 0) {
      partsForPrompt.push(
        `[Transcribed Audio Notes]:\n${audioTranscriptions.join('\n\n')}`
      );
    }
    if (attachmentTextContext) {
      partsForPrompt.push(
        `[Attached Document Content]:\n${attachmentTextContext}`
      );
    }

    const compiledUserMessageText = partsForPrompt.join('\n\n');

      console.log('compiledUserMessageText', compiledUserMessageText)

    // 6. Handle Linear Pruning for Message Edits or Retries
    const isRetry = typeof b.retryTurnIndex === 'number' && b.retryTurnIndex >= 0;
    const isEdit = typeof b.editTurnIndex === 'number' && b.editTurnIndex >= 0;

    if (isEdit) {
      chat.messages = chat.messages.slice(0, b.editTurnIndex);
    } else if (isRetry) {
      chat.messages = chat.messages.slice(0, b.retryTurnIndex);
    }

    if (!compiledUserMessageText.trim() && inlineParts.length === 0 && !isRetry) {
      throw new BadRequestError('No speech, text, or valid attachment content detected in message.');
    }

    const hasNewUserInput =
      (b.text && typeof b.text === 'string' && b.text.trim().length > 0) ||
      (Array.isArray(b.audios) && b.audios.length > 0) ||
      (Array.isArray(b.attachments) && b.attachments.length > 0);

    // 7. Persist User Turn in Chat (or reuse preceding turn if retry without new inputs)
    let userTurn = null;
    if (isRetry && !hasNewUserInput) {
      const lastMsg = chat.messages[chat.messages.length - 1];
      if (lastMsg && lastMsg.role === 'user') {
        userTurn = lastMsg;
      }
    }

    if (!userTurn) {
      userTurn = {
        id: b.id || new mongoose.Types.ObjectId().toString(),
        role: 'user',
        text: b.text || compiledUserMessageText,
        audios: Array.isArray(b.audios) ? b.audios : [],
        attachments: Array.isArray(b.attachments) ? b.attachments : [],
        createdAt: new Date(),
      };
      chat.messages.push(userTurn);
    }

    // Persist user turn immediately and emit session event so client locks onto session ID before stream completes
    await chat.save();
    sendSSE(res, 'session', {
      chatId: chat._id.toString(),
      title: chat.title || 'New Chat',
    });

    console.log('userTurn', userTurn)
    console.log('chat', chat)

    // 8. Assemble Dynamic 6-Block System Prompt
    const systemPrompt = await assembleSystemPrompt({
      user: req.user,
      chatConfig: chat.config,
      customTurnPrompt: b.turnPrompt || '',
    });

    // 9. Build Gemini Contents History
    const geminiContents = [];

    for (let i = 0; i < chat.messages.length - 1; i++) {
      const msg = chat.messages[i];
      if (msg.role === 'user') {
        geminiContents.push({
          role: 'user',
          parts: [{ text: msg.text || '' }],
        });
      } else if (msg.role === 'assistant') {
        geminiContents.push({
          role: 'model',
          parts: [{ text: msg.text || '' }],
        });
      }
    }

    // Append latest user turn with inline multimodal parts if any
    const latestUserMsg = chat.messages[chat.messages.length - 1];
    const latestUserText = (compiledUserMessageText || latestUserMsg?.text || '').trim();
    const latestUserParts = [{ text: latestUserText }];
    if (inlineParts.length > 0) {
      latestUserParts.push(...inlineParts);
    }
    geminiContents.push({
      role: 'user',
      parts: latestUserParts,
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

    let fullText = '';
    let fullThought = '';
    const toolsCalled = [];
    let step = 0;
    const maxSteps = 5;
    let activeModel = modelName;
    let tokenUsage = { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 };

    while (step < maxSteps) {
      step++;

      let stepText = '';
      let stepThought = '';
      const functionCalls = [];
      const modelStepParts = [];

      let streamAttempts = 0;
      const maxStreamAttempts = 5;
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

          streamSuccess = true;
        } catch (streamErr) {
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
              logger.warn(
                `[chatController] Model ${activeModel} hit quota limit. Failing over to ${mappedFallback} (attempt ${streamAttempts}/${maxStreamAttempts})...`
              );
              activeModel = mappedFallback;
              await new Promise((r) => setTimeout(r, 600));
              continue;
            }
          }

          if (isTransient && streamAttempts < maxStreamAttempts) {
            const alternateModel =
              activeModel === AI_MODELS.DEFAULT
                ? AI_MODELS.FALLBACK
                : AI_MODELS.DEFAULT;
            logger.warn(
              `[chatController] Transient error or high demand (${streamErr.message?.slice(0, 80)}...). Retrying with ${alternateModel} (attempt ${streamAttempts}/${maxStreamAttempts})...`
            );
            activeModel = alternateModel;
            await new Promise((r) => setTimeout(r, 1200));
            continue;
          }

          throw streamErr;
        }
      }

      // If no tools were invoked, response is complete
      if (functionCalls.length === 0) {
        break;
      }

      // Execute autonomous tools inside Mongoose ACID sessions
      const functionResponses = [];
      for (const fc of functionCalls) {
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

    // 11. First-Turn Auto-Titling (Turn 1 only)
    if (!chat.title) {
      try {
        const titlePrompt = `Summarize the user's intent in 3 to 5 words as a concise title. Output ONLY the title:\n"${userTurn.text.slice(0, 300)}"`;
        const titleRes = await ai.models.generateContent({
          model: AI_MODELS.DEFAULT,
          contents: [{ text: titlePrompt }],
        });
        const derivedTitle = (titleRes.text || 'Operational Discussion').trim().slice(0, 100);
        chat.title = derivedTitle;
        sendSSE(res, 'title', { title: derivedTitle });
      } catch (titleErr) {
        chat.title = 'Operational Discussion';
        sendSSE(res, 'title', { title: chat.title });
      }
    }

    // 12. Persist Assistant Turn to Chat Document
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

    // 13. Send Completion Frame
    sendSSE(res, 'done', {
      chatId: chat._id.toString(),
      messageId: assistantTurn.id,
      title: chat.title,
      model: activeModel,
      usage: tokenUsage,
    });
    res.end();
  } catch (err) {
    logger.error(`[chatController] Stream error: ${err.message}`, { stack: err.stack, cause: err.cause });
    console.error('[chatController] Full Stream Error:', err, 'cause:', err.cause);

    const isQuota =
      err.message?.includes('429') ||
      err.status === 429 ||
      err.message?.includes('RESOURCE_EXHAUSTED');

    const reason = isQuota ? 'quota_exhausted' : 'server_error';
    const failedModel = typeof activeModel !== 'undefined' && activeModel ? activeModel : AI_MODELS.DEFAULT;
    const suggestedModels = AI_MODELS.SUPPORTED.filter((m) => m !== failedModel);

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

export default {
  streamChat,
  getChats,
  getChatById,
  updateChatConfig,
  pinChat,
  renameChat,
  deleteChat,
  uploadChatAttachments,
  transcribeAudio,
};
