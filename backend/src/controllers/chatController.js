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
import { HTTP_STATUS, CHAT_CONSTANTS, ATTACHMENT_CONSTANTS } from '../utils/constants.js';
import { NotFoundError, BadRequestError } from '../errors/CustomError.js';
import { assembleSystemPrompt } from '../utils/promptAssembler.js';
import { agentToolDeclarations, executeAgentTool } from '../tools/agentTools.js';
import { processAttachments } from '../utils/attachmentProcessor.js';
import { transcribeAudioDocument } from '../utils/audioChunker.js';

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
  const b = req.body || {};
  const requestedChatId = req.params.chatId || b.chatId;

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
        model: req.user.settings?.agentConfig?.defaultModel || CHAT_CONSTANTS.DEFAULT_MODEL,
        thinkingBudget:
          req.user.settings?.agentConfig?.defaultThinkingBudget ??
          CHAT_CONSTANTS.DEFAULT_THINKING_BUDGET,
        language: req.user.settings?.agentConfig?.defaultLanguage || CHAT_CONSTANTS.DEFAULT_LANGUAGE,
      },
    });
  }

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
              if (updated.transcription) {
                audioTranscriptions.push(updated.transcription);
              }
            } else {
              audioTranscriptions.push(audioDoc.transcription);
            }
          }
        } catch (audioErr) {
          logger.warn(`[chatController] Failed to transcribe audio ${audioId}: ${audioErr.message}`);
        }
      }
    }

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
        `[የድምፅ ቅጂ የተተነተነበት / Audio Transcription]:\n${audioTranscriptions.join('\n\n')}`
      );
    }
    if (attachmentTextContext) {
      partsForPrompt.push(
        `[የተያያዙ ፋይሎች ይዘት / Attached Files Content]:\n${attachmentTextContext}`
      );
    }

    const compiledUserMessageText = partsForPrompt.join('\n\n');

    // 6. Handle Linear Pruning for Message Edits or Retries
    if (typeof b.editTurnIndex === 'number' && b.editTurnIndex >= 0) {
      chat.messages = chat.messages.slice(0, b.editTurnIndex);
    } else if (typeof b.retryTurnIndex === 'number' && b.retryTurnIndex >= 0) {
      chat.messages = chat.messages.slice(0, b.retryTurnIndex);
    }

    // 7. Persist User Turn in Chat
    const userTurn = {
      id: b.id || new mongoose.Types.ObjectId().toString(),
      role: 'user',
      text: b.text || compiledUserMessageText,
      audios: Array.isArray(b.audios) ? b.audios : [],
      attachments: Array.isArray(b.attachments) ? b.attachments : [],
      createdAt: new Date(),
    };
    chat.messages.push(userTurn);

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
    const latestUserParts = [{ text: compiledUserMessageText }];
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
    const rawModel = chat.config?.model || CHAT_CONSTANTS.DEFAULT_MODEL;
    const modelName =
      rawModel === 'gemini-2.5-flash' || rawModel === 'gemini-2.5-flash-lite' || rawModel === 'gemini-3.5-flash'
        ? 'gemini-3.1-flash-lite'
        : rawModel;
    const thinkingBudget = chat.config?.thinkingBudget ?? CHAT_CONSTANTS.DEFAULT_THINKING_BUDGET;

    let fullText = '';
    let fullThought = '';
    const toolsCalled = [];
    let step = 0;
    const maxSteps = 5;
    let activeModel = modelName;

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
            streamErr.message?.includes('503');

          if (isQuota && activeModel !== 'gemini-3.1-flash-lite') {
            logger.warn(
              `[chatController] Model ${activeModel} hit quota. Failing over to gemini-3.1-flash-lite (attempt ${streamAttempts}/${maxStreamAttempts})...`
            );
            activeModel = 'gemini-3.1-flash-lite';
            await new Promise((r) => setTimeout(r, 600));
            continue;
          }

          if (isTransient && streamAttempts < maxStreamAttempts) {
            const alternateModel =
              activeModel === 'gemini-3.1-flash-lite'
                ? 'gemini-flash-lite-latest'
                : 'gemini-3.1-flash-lite';
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
          model: 'gemini-3.1-flash-lite',
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
      createdAt: new Date(),
    };
    chat.messages.push(assistantTurn);
    await chat.save();

    // 13. Send Completion Frame
    sendSSE(res, 'done', {
      chatId: chat._id.toString(),
      messageId: assistantTurn.id,
      title: chat.title,
    });
    res.end();
  } catch (err) {
    logger.error(`[chatController] Stream error: ${err.message}`, { stack: err.stack, cause: err.cause });
    console.error('[chatController] Full Stream Error:', err, 'cause:', err.cause);
    sendSSE(res, 'error', { message: err.message || 'Streaming failed.' });
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
  const chat = await Chat.findOne({
    _id: req.params.chatId,
    user: req.user._id,
    isArchived: false,
  }).populate('messages.audios');

  if (!chat) {
    throw new NotFoundError('Chat session not found.');
  }

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: {
      chat,
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

export default {
  streamChat,
  getChats,
  getChatById,
  pinChat,
  renameChat,
  deleteChat,
  uploadChatAttachments,
};
