/**
 * @module services/telegramService
 * @description Enterprise outbound Telegram broadcast engine supporting multi-modal delivery
 * (native Semantic HTML text, expandable blockquotes, and dynamic sharp SVG-to-PNG image cards).
 * Enforces Zero Artificial Wrapper Law, Telegram native limits (4,096 chars, 50MB files),
 * and dual live/stub mode with zero-failure invariants.
 */

import sharp from 'sharp';
import { env } from '../config/env.js';
import { TELEGRAM_CONSTANTS } from '../utils/constants.js';

/**
 * Escapes standard HTML special characters.
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text = '') {
  return String(text).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return char;
    }
  });
}

/**
 * Deterministically transpiles Markdown to Telegram-compliant HTML.
 * Handles bold (**text**), italic (*text*), code (`code` and ```code```),
 * expandable blockquotes (> line), and links ([text](url)).
 * Standardizes on HTML to avoid Telegram's MarkdownV2 escaping pitfalls.
 *
 * @param {string} markdown - Input Markdown string
 * @returns {string} Telegram HTML formatted string
 */
export function markdownToTelegramHtml(markdown = '') {
  if (!markdown || typeof markdown !== 'string') return '';

  const lines = markdown.split('\n');
  const processedLines = [];
  let inBlockquote = false;
  let blockquoteBuffer = [];

  const flushBlockquote = () => {
    if (blockquoteBuffer.length > 0) {
      processedLines.push(`<blockquote expandable>${blockquoteBuffer.join('\n')}</blockquote>`);
      blockquoteBuffer = [];
      inBlockquote = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const quoteMatch = line.match(/^>\s?(.*)$/);

    if (quoteMatch) {
      inBlockquote = true;
      blockquoteBuffer.push(escapeHtml(quoteMatch[1]));
    } else {
      flushBlockquote();
      processedLines.push(escapeHtml(line));
    }
  }
  flushBlockquote();

  let html = processedLines.join('\n');

  // Multi-line code blocks: ```code``` -> <pre>code</pre>
  html = html.replace(/```([\s\S]*?)```/g, (_match, code) => `<pre>${code.trim()}</pre>`);

  // Inline code: `code` -> <code>code</code>
  html = html.replace(/`([^`]+)`/g, (_match, code) => `<code>${code}</code>`);

  // Bold: **text** or __text__ -> <b>text</b>
  html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  html = html.replace(/__([^_]+)__/g, '<b>$1</b>');

  // Italic: *text* or _text_ -> <i>text</i> (excluding already matched bold)
  html = html.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1<i>$2</i>$3');

  // Links: [label](url) -> <a href="url">label</a>
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  return html;
}

/**
 * Splits message text into chunks that strictly respect Telegram's 4,096 UTF-8 character limit.
 * Chunks along paragraph boundaries (\n\n) first, then line breaks (\n).
 *
 * @param {string} text - Message text or HTML
 * @param {number} [maxLimit=4096] - Maximum character count per chunk
 * @returns {string[]} Array of chunked messages
 */
export function chunkTelegramMessage(text = '', maxLimit = TELEGRAM_CONSTANTS.MAX_MESSAGE_LENGTH) {
  if (!text) return [];
  if (text.length <= maxLimit) return [text];

  const chunks = [];
  const paragraphs = text.split('\n\n');
  let currentChunk = '';

  for (const para of paragraphs) {
    if ((currentChunk + '\n\n' + para).trim().length <= maxLimit) {
      currentChunk = currentChunk ? `${currentChunk}\n\n${para}` : para;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      if (para.length <= maxLimit) {
        currentChunk = para;
      } else {
        // Paragraph itself exceeds maxLimit; split by individual lines
        const lines = para.split('\n');
        for (const line of lines) {
          if ((currentChunk + '\n' + line).trim().length <= maxLimit) {
            currentChunk = currentChunk ? `${currentChunk}\n${line}` : line;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk.trim());
              currentChunk = '';
            }
            if (line.length <= maxLimit) {
              currentChunk = line;
            } else {
              // Line itself exceeds maxLimit; hard split by character bound
              for (let i = 0; i < line.length; i += maxLimit) {
                chunks.push(line.slice(i, i + maxLimit));
              }
            }
          }
        }
      }
    }
  }

  if (currentChunk && currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Simple word wrap utility for Ethiopic / Latin text.
 * @param {string} text
 * @param {number} maxChars
 * @returns {string[]}
 */
function wrapText(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + ' ' + word).length <= maxChars) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Dynamically generates a high-contrast, mobile-optimized document sheet image card
 * using sharp and SVG rendering based on field-verified layout specifications.
 *
 * @param {string} reportText - Formatted report text or ad-hoc message
 * @returns {Promise<Buffer>} PNG image buffer
 */
export async function generateReportImageCard(reportText = '') {
  const C = TELEGRAM_CONSTANTS.IMAGE_CARD;
  const width = C.WIDTH;
  const paddingX = C.PADDING_X;
  const maxCharsPerLine = 48;
  const maxCharsBulletHanging = 44;

  const lines = reportText.split('\n');
  const elements = [];
  let currentY = 60;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) {
      currentY += 12;
      continue;
    }

    // Detect section headers (ends with colon and has section keywords or is distinct header)
    const isSectionHeader = (
      rawLine.endsWith(':') &&
      (rawLine.includes('ስራዎች') || rawLine.includes('ጉዳዮች') || rawLine.includes('አስተያየት') ||
       rawLine.includes('ሪፖርት') || rawLine.includes('ተግባራት') || rawLine.includes('Activities') ||
       rawLine.includes('Issues') || rawLine.includes('Remarks'))
    );

    if (isSectionHeader) {
      currentY += C.SECTION_TOP_GAP;
      const textWidthApprox = rawLine.length * 17;
      const lineStartX = Math.max(paddingX, (width - textWidthApprox) / 2);
      const lineEndX = Math.min(width - paddingX, (width + textWidthApprox) / 2);

      elements.push(`
        <text x="${width / 2}" y="${currentY}" 
              text-anchor="middle" 
              font-family="${C.FONT_FAMILY}" 
              font-size="${C.SECTION_FONT_SIZE}" 
              font-weight="bold" 
              fill="${C.TEXT_COLOR}">${escapeHtml(rawLine)}</text>
        <line x1="${lineStartX}" y1="${currentY + 6}" x2="${lineEndX}" y2="${currentY + 6}" stroke="${C.TEXT_COLOR}" stroke-width="2" />
      `);
      currentY += C.SECTION_BOTTOM_GAP + 28;
    } else if (rawLine.startsWith('•') || rawLine.startsWith('-') || rawLine.startsWith('*')) {
      const bulletContent = rawLine.replace(/^[•\-\*]\s*/, '').trim();
      const wrapped = wrapText(bulletContent, maxCharsBulletHanging);

      const bulletCenterX = paddingX + 8;
      const textIndentX = paddingX + C.BULLET_INDENT;

      elements.push(`
        <circle cx="${bulletCenterX}" cy="${currentY - 8}" r="${C.BULLET_RADIUS}" fill="${C.TEXT_COLOR}" />
      `);

      for (let j = 0; j < wrapped.length; j++) {
        elements.push(`
          <text x="${textIndentX}" y="${currentY}" 
                font-family="${C.FONT_FAMILY}" 
                font-size="${C.BASE_FONT_SIZE}" 
                font-weight="normal" 
                fill="${C.TEXT_COLOR}">${escapeHtml(wrapped[j])}</text>
        `);
        currentY += C.LINE_HEIGHT;
      }
      currentY += C.INTER_BULLET_GAP;
    } else {
      const colonIdx = rawLine.indexOf(':');
      if (colonIdx !== -1 && colonIdx < 25) {
        elements.push(`
          <text x="${paddingX}" y="${currentY}" 
                font-family="${C.FONT_FAMILY}" 
                font-size="${C.BASE_FONT_SIZE}" 
                font-weight="normal" 
                fill="${C.TEXT_COLOR}">
            <tspan font-weight="bold">${escapeHtml(rawLine.substring(0, colonIdx + 1))}</tspan>${escapeHtml(rawLine.substring(colonIdx + 1))}
          </text>
        `);
      } else {
        const wrapped = wrapText(rawLine, maxCharsPerLine);
        for (const line of wrapped) {
          elements.push(`
            <text x="${paddingX}" y="${currentY}" 
                  font-family="${C.FONT_FAMILY}" 
                  font-size="${C.BASE_FONT_SIZE}" 
                  font-weight="normal" 
                  fill="${C.TEXT_COLOR}">${escapeHtml(line)}</text>
          `);
          currentY += C.LINE_HEIGHT;
        }
      }
      currentY += C.LINE_HEIGHT;
    }
  }

  const finalHeight = currentY + 40;

  const svg = `<svg width="${width}" height="${finalHeight}" viewBox="0 0 ${width} ${finalHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${finalHeight}" fill="${C.BG_COLOR}"/>
    ${elements.join('\n')}
  </svg>`;

  return sharp(Buffer.from(svg))
    .png({ quality: 100 })
    .toBuffer();
}

/**
 * Resolves destination Telegram chat ID for a given operational channel.
 * @param {Object} [user] - Mongoose user document
 * @param {string} [channel='management'] - Operational channel ('management' | 'maintenance' | 'general')
 * @returns {string|null} Resolved chat ID or null
 */
export function resolveChannelChatId(user, channel = 'management') {
  const normChannel = String(channel).toLowerCase();
  const userTelegram = user?.settings?.telegram || {};

  if (normChannel === 'maintenance') {
    return userTelegram.maintenanceChatId || env.TELEGRAM_MAINTENANCE_CHAT_ID || null;
  }
  if (normChannel === 'general') {
    return userTelegram.generalChatId || env.TELEGRAM_GENERAL_CHAT_ID || null;
  }
  // Default to management
  return userTelegram.managementChatId || env.TELEGRAM_MANAGEMENT_CHAT_ID || null;
}

/**
 * Resolves Telegram Bot Token from user settings or system environment.
 * @param {Object} [user] - Mongoose user document
 * @returns {string} Bot token
 */
export function resolveBotToken(user) {
  return user?.settings?.telegram?.botToken || env.TELEGRAM_BOT_TOKEN || '';
}

/**
 * Dispatches an outbound message or image card to Telegram.
 * Handles rate-limiting (HTTP 429) backoff, automatic fallbacks, and zero-failure stubbing.
 *
 * @param {Object} params
 * @param {Object} [params.user] - Authenticated supervisor user object
 * @param {string} [params.targetChannel='management'] - 'management' | 'maintenance' | 'general'
 * @param {string} params.text - Authentic message text or serialized report
 * @param {string} [params.customNote] - Optional prefix remark
 * @param {boolean} [params.asImage=false] - Whether to render and broadcast as an image card
 * @returns {Promise<Object>} Structured broadcast result
 */
export async function dispatchToTelegram({
  user,
  targetChannel = 'management',
  text = '',
  customNote,
  asImage = false,
  botToken: tokenOverride,
  chatId: chatIdOverride,
}) {
  const channel = TELEGRAM_CONSTANTS.CHANNELS.includes(targetChannel) ? targetChannel : 'management';
  const botToken = tokenOverride !== undefined ? tokenOverride : resolveBotToken(user);
  const chatId = chatIdOverride !== undefined ? chatIdOverride : resolveChannelChatId(user, channel);

  // Assemble full authentic text with optional customNote prefix
  let fullText = text ? text.trim() : '';
  if (customNote && typeof customNote === 'string' && customNote.trim()) {
    fullText = `${customNote.trim()}\n\n${fullText}`;
  }

  const isUserDisabled = user?.settings?.telegram?.enabled === false;
  const isLiveConfigured = Boolean(env.TELEGRAM_ENABLED && !isUserDisabled && botToken && chatId);

  // If live broadcast is not configured, return clean functional stub (Zero-Failure Invariant)
  if (!isLiveConfigured) {
    return {
      success: true,
      ok: true,
      isStub: true,
      channel,
      mode: asImage ? 'image' : 'text',
      messageId: `stub-tg-${Date.now()}`,
      message: `Telegram broadcast simulated in functional stub mode for channel "${channel}".`,
      textPreview: fullText.slice(0, 200),
    };
  }

  const apiBase = `https://api.telegram.org/bot${botToken}`;

  // =========================================================================
  // Mode C: Rendered Document Image Card Delivery
  // =========================================================================
  if (asImage) {
    try {
      const imageBuffer = await generateReportImageCard(fullText);
      const blob = new Blob([imageBuffer], { type: 'image/png' });
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('photo', blob, 'operational_report.png');

      const res = await fetch(`${apiBase}/sendPhoto`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.ok) {
        const msgId = data.result.message_id;
        const groupUsername = data.result.chat.username;
        const cleanChatId = String(chatId).replace(/^-100/, '');
        const deepLink = groupUsername
          ? `https://t.me/${groupUsername}/${msgId}`
          : `https://t.me/c/${cleanChatId}/${msgId}`;

        return {
          success: true,
          ok: true,
          isStub: false,
          channel,
          mode: 'image',
          messageId: msgId,
          deepLink,
          chatTitle: data.result.chat.title || null,
        };
      }
      console.warn('[telegramService] sendPhoto failed from API:', data.description, '- falling back to text mode');
    } catch (imgErr) {
      console.warn('[telegramService] generateReportImageCard error:', imgErr.message, '- falling back to text mode');
    }
  }

  // =========================================================================
  // Mode A / B: Native Semantic HTML Text Delivery (with Expandable Quotes)
  // =========================================================================
  const htmlContent = markdownToTelegramHtml(fullText);
  const chunks = chunkTelegramMessage(htmlContent);
  const dispatchedMessageIds = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    let attempts = 0;
    let sent = false;

    while (attempts < 3 && !sent) {
      attempts++;
      try {
        const res = await fetch(`${apiBase}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: chunk,
            parse_mode: 'HTML',
          }),
        });

        const data = await res.json();

        if (data.ok) {
          dispatchedMessageIds.push(data.result.message_id);
          sent = true;
        } else if (res.status === 429) {
          const retryAfterSec = data.parameters?.retry_after || TELEGRAM_CONSTANTS.RATE_LIMIT.RETRY_AFTER_DEFAULT_SEC;
          console.warn(`[telegramService] Rate limit hit. Waiting ${retryAfterSec}s before retry...`);
          await new Promise((resolve) => setTimeout(resolve, retryAfterSec * 1000));
        } else {
          console.error('[telegramService] Telegram sendMessage error:', data.description);
          break;
        }
      } catch (netErr) {
        console.warn(`[telegramService] Network error during sendMessage (attempt ${attempts}/3):`, netErr.message, netErr.cause?.code || '');
        if (attempts < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1500 * attempts));
        }
      }
    }
  }

  if (dispatchedMessageIds.length > 0) {
    const primaryId = dispatchedMessageIds[0];
    const cleanChatId = String(chatId).replace(/^-100/, '');
    const deepLink = `https://t.me/c/${cleanChatId}/${primaryId}`;

    return {
      success: true,
      ok: true,
      isStub: false,
      channel,
      mode: 'text',
      fallbackFromImage: asImage,
      messageId: primaryId,
      allMessageIds: dispatchedMessageIds,
      deepLink,
    };
  }

  // Graceful fallback if live network failed completely
  return {
    success: false,
    ok: false,
    isStub: true,
    channel,
    mode: 'text',
    error: 'Failed to deliver message to Telegram Bot API. Network or permission error.',
  };
}

export default {
  escapeHtml,
  markdownToTelegramHtml,
  chunkTelegramMessage,
  generateReportImageCard,
  resolveChannelChatId,
  resolveBotToken,
  dispatchToTelegram,
};
