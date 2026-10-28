/**
 * @module services/telegramService
 * @description Enterprise outbound Telegram broadcast engine supporting multi-modal delivery
 * (native Semantic HTML text, expandable blockquotes, and dynamic sharp SVG-to-PNG image cards).
 * Enforces Zero Artificial Wrapper Law, Telegram native limits (4,096 chars, 50MB files),
 * and dual live/stub mode with zero-failure invariants.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';
import { TELEGRAM_CONSTANTS } from '../utils/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lazy memoized embedded font definitions for SVG rendering
let cachedFontDefs = null;

function getEmbeddedFontDefs() {
  if (cachedFontDefs !== null) return cachedFontDefs;
  try {
    const regularPath = path.resolve(__dirname, '../assets/fonts/NotoSansEthiopic-Regular.woff');
    const boldPath = path.resolve(__dirname, '../assets/fonts/NotoSansEthiopic-Bold.woff');

    let regularBase64 = '';
    let boldBase64 = '';

    if (fs.existsSync(regularPath)) {
      regularBase64 = fs.readFileSync(regularPath).toString('base64');
    }
    if (fs.existsSync(boldPath)) {
      boldBase64 = fs.readFileSync(boldPath).toString('base64');
    }

    if (regularBase64 || boldBase64) {
      cachedFontDefs = `
    <defs>
      <style>
        ${regularBase64 ? `@font-face {
          font-family: 'Noto Sans Ethiopic';
          src: url('data:font/woff;charset=utf-8;base64,${regularBase64}') format('woff');
          font-weight: normal;
          font-style: normal;
        }` : ''}
        ${boldBase64 ? `@font-face {
          font-family: 'Noto Sans Ethiopic';
          src: url('data:font/woff;charset=utf-8;base64,${boldBase64}') format('woff');
          font-weight: bold;
          font-style: normal;
        }` : ''}
      </style>
    </defs>`;
    } else {
      cachedFontDefs = '';
    }
  } catch (err) {
    cachedFontDefs = '';
  }
  return cachedFontDefs;
}

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
 * Estimates character advance width in pixels based on font size and script geometry.
 * Ethiopic glyph advance: ~0.60 * fontSize (normal) / 0.62 * fontSize (bold).
 * Latin glyph advance: ~0.50 * fontSize (normal) / 0.52 * fontSize (bold).
 * Narrow punctuation: ~0.28 * fontSize.
 * Space: ~0.30 * fontSize.
 *
 * @param {string} ch - Character
 * @param {number} fontSize - Base font size in px
 * @param {boolean} [isBold=false] - Whether bold weight
 * @returns {number} Estimated pixel advance
 */
function estimateCharWidth(ch, fontSize, isBold = false) {
  const code = ch.charCodeAt(0);
  if (ch === ' ') return fontSize * 0.30;
  if (code >= 0x1200 && code <= 0x137f) {
    return fontSize * (isBold ? 0.62 : 0.60);
  }
  if (['i', 'l', 'I', '1', '.', ':', ',', ';', '!', '|', '\'', '"', '`'].includes(ch)) {
    return fontSize * 0.28;
  }
  if (['m', 'w', 'M', 'W', '@', '%'].includes(ch)) {
    return fontSize * 0.82;
  }
  return fontSize * (isBold ? 0.52 : 0.50);
}

/**
 * Measures total advance width of a string in pixels.
 *
 * @param {string} text - Input text
 * @param {number} fontSize - Font size in px
 * @param {boolean} [isBold=false] - Bold flag
 * @returns {number} Width in px
 */
function measureTextWidth(text, fontSize, isBold = false) {
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    w += estimateCharWidth(text[i], fontSize, isBold);
  }
  return w;
}

/**
 * Strips inline markdown tokens for accurate character geometry measurement.
 * @param {string} [text='']
 * @returns {string}
 */
function stripMarkdown(text = '') {
  return text.replace(/(\*\*|__|\*|_|~~|\^|~)/g, '');
}

/**
 * Pixel-aware word wrapping utility respecting exact glyph geometry.
 *
 * @param {string} text - Input text to wrap
 * @param {number} maxWidth - Maximum allowed line width in px
 * @param {number} fontSize - Font size in px
 * @param {boolean} [isBold=false] - Bold flag
 * @returns {string[]} Array of wrapped line strings
 */
function wrapTextPixels(text, maxWidth, fontSize, isBold = false) {
  const words = text.split(/\s+/);
  const lines = [];
  let curLine = '';
  let curWidth = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const cleanWord = stripMarkdown(word);
    const wordWidth = measureTextWidth(cleanWord, fontSize, isBold);
    const spaceWidth = curLine ? measureTextWidth(' ', fontSize, isBold) : 0;

    if (curWidth + spaceWidth + wordWidth <= maxWidth) {
      curLine = curLine ? `${curLine} ${word}` : word;
      curWidth += spaceWidth + wordWidth;
    } else {
      if (curLine) {
        lines.push(curLine);
      }
      if (wordWidth > maxWidth) {
        let chunk = '';
        let chunkW = 0;
        for (let c = 0; c < word.length; c++) {
          const cw = estimateCharWidth(word[c], fontSize, isBold);
          if (chunkW + cw > maxWidth && chunk) {
            lines.push(chunk);
            chunk = word[c];
            chunkW = cw;
          } else {
            chunk += word[c];
            chunkW = cw;
          }
        }
        curLine = chunk;
        curWidth = chunkW;
      } else {
        curLine = word;
        curWidth = wordWidth;
      }
    }
  }
  if (curLine) {
    lines.push(curLine);
  }
  return lines;
}

/**
 * Dynamically generates a high-contrast, mobile-optimized document sheet image card
 * for ANY text payload (reports, ad-hoc announcements, executive memos, daily logs)
 * at standard non-negotiable 1440px 2K resolution using sharp and SVG vector rendering.
 * Implements Single Formatting Pipeline to completely eliminate nested stroke bloating.
 *
 * @param {string} text - Content text (reports, memos, or ad-hoc messages)
 * @param {Object} [options={}] - Dynamic styling options
 * @returns {Promise<Buffer>} PNG image buffer
 */
export async function generateTextImageCard(text = '', options = {}) {
  const reportText = text;
  const C = TELEGRAM_CONSTANTS.IMAGE_CARD;
  const width = options.width || C.WIDTH;
  const paddingX = options.paddingX || C.PADDING_X;
  const baseFontSize = options.fontSize || C.BASE_FONT_SIZE;
  const sectionFontSize = options.sectionFontSize || Math.round(baseFontSize * 1.16);
  const lineHeight = options.lineHeight || Math.round(baseFontSize * 1.26);
  const sectionTopGap = options.sectionTopGap !== undefined ? options.sectionTopGap : C.SECTION_TOP_GAP;
  const sectionBottomGap = options.sectionBottomGap !== undefined ? options.sectionBottomGap : C.SECTION_BOTTOM_GAP;
  const paragraphGap = options.paragraphGap !== undefined ? options.paragraphGap : C.PARAGRAPH_GAP;
  const bulletGap = options.bulletGap !== undefined ? options.bulletGap : C.INTER_BULLET_GAP;
  const bulletIndent = options.bulletIndent || C.BULLET_INDENT;
  const bulletRadius = options.bulletRadius || C.BULLET_RADIUS;
  const textColor = options.textColor || C.TEXT_COLOR;
  const bgColor = options.bgColor || C.BG_COLOR;
  const fontFamily = options.fontFamily || C.FONT_FAMILY;
  const letterSpacingAttr = options.letterSpacing ? ` letter-spacing="${options.letterSpacing}px"` : '';

  const align = options.align || 'left';
  const textAnchorAttr = align === 'center' ? ' text-anchor="middle"' : (align === 'right' ? ' text-anchor="end"' : '');
  const anchorX = align === 'center' ? Math.round(width / 2) : (align === 'right' ? width - paddingX : paddingX);

  // Synthetic bold stroke settings ensuring cross-platform Ethiopic bolding
  const boldStrokeBody = `stroke="${textColor}" stroke-width="1.1" paint-order="stroke fill"`;
  const boldStrokeHeader = `stroke="${textColor}" stroke-width="1.3" paint-order="stroke fill"`;

  const usableWidth = width - 2 * paddingX;
  const bulletUsableWidth = usableWidth - bulletIndent;
  const maxLineSafety = 45; // Safety buffer ensuring right margin >= 100px

  const lines = reportText.split('\n');
  const elements = [];
  let currentY = paddingX + 15;

  /**
   * Single Formatting Pipeline: Parses inline Markdown tokens without nested stroke stacking.
   * Disambiguates bold, italic, underline, strikethrough, superscript, and subscript.
   *
   * @param {string} text - Raw text containing inline markdown
   * @param {boolean} [isParentBold=false] - Whether enclosing <text> already has bold stroke
   * @returns {string} Sanitized SVG <tspan> markup
   */
  function formatInlineSpans(text, isParentBold = false) {
    if (!text) return '';
    const regex = /(\*\*[^*]+\*\*|(?<!\*)\*[^*]+\*(?!\*)|(?<!_)_[^_]+_(?!_)|__[^_]+__|~~[^~]+~~|\^[^^]+\^|~[^~]+~)/g;
    const parts = text.split(regex);
    return parts.map((part) => {
      if (!part) return '';
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        const inner = part.slice(2, -2);
        const stroke = isParentBold ? '' : ` ${boldStrokeBody}`;
        return `<tspan font-weight="bold"${stroke}>${escapeHtml(inner)}</tspan>`;
      }
      if (
        (part.startsWith('*') && part.endsWith('*') && part.length > 2) ||
        (part.startsWith('_') && part.endsWith('_') && part.length > 2)
      ) {
        const inner = part.slice(1, -1);
        return `<tspan font-style="italic">${escapeHtml(inner)}</tspan>`;
      }
      if (part.startsWith('__') && part.endsWith('__') && part.length > 4) {
        const inner = part.slice(2, -2);
        return `<tspan text-decoration="underline">${escapeHtml(inner)}</tspan>`;
      }
      if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4) {
        const inner = part.slice(2, -2);
        return `<tspan text-decoration="line-through">${escapeHtml(inner)}</tspan>`;
      }
      if (part.startsWith('^') && part.endsWith('^') && part.length > 2) {
        const inner = part.slice(1, -1);
        return `<tspan font-size="${Math.round(baseFontSize * 0.72)}" baseline-shift="super">${escapeHtml(inner)}</tspan>`;
      }
      if (part.startsWith('~') && part.endsWith('~') && part.length > 2) {
        const inner = part.slice(1, -1);
        return `<tspan font-size="${Math.round(baseFontSize * 0.72)}" baseline-shift="sub">${escapeHtml(inner)}</tspan>`;
      }
      return escapeHtml(part);
    }).join('');
  }

  const isAllBold = Boolean(options.allBold || options.bold);
  const defaultWeight = isAllBold ? 'bold' : 'normal';
  const bodyStroke = isAllBold ? ` ${boldStrokeBody}` : '';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) {
      currentY += paragraphGap;
      continue;
    }

    // Clean markdown wrapping if present
    const cleanLine = rawLine.replace(/^\s*(#+\s*|\*\*|\*)/, '').replace(/(\*\*|\*)\s*$/, '').trim();

    // Markdown-compliant Bullet Detection:
    // A bullet must start with '•', '- ', or an asterisk followed by space ('* ')
    const isBullet = rawLine.startsWith('•') || rawLine.startsWith('- ') || /^\*\s+/.test(rawLine);

    // Numbered list detection: '1. ', '2. ', etc.
    const numMatch = !isBullet ? rawLine.match(/^(\d+)[\.\)]\s+(.*)$/) : null;

    // Zero-Hardcoding Section Header Detection:
    // A line is a section header if it is not a bullet/number, and ends with ':' (or Ethiopic '፡' / '፦')
    // with no following value on the same line.
    const isSectionHeader = (
      !isBullet &&
      !numMatch &&
      (cleanLine.endsWith(':') || cleanLine.endsWith('፡') || cleanLine.endsWith('፦')) &&
      !cleanLine.slice(0, -1).includes(':')
    );

    const underlineAttr = (options.underline || (isSectionHeader && options.underlineHeaders))
      ? ' text-decoration="underline"'
      : '';

    if (isSectionHeader) {
      currentY += sectionTopGap;
      elements.push(
        `<text x="${anchorX}" y="${currentY}" font-family='${fontFamily}' font-size="${sectionFontSize}" font-weight="bold" fill="${textColor}" ${boldStrokeHeader} xml:space="preserve"${underlineAttr}${letterSpacingAttr}${textAnchorAttr}>${escapeHtml(cleanLine)}</text>`
      );
      currentY += lineHeight + sectionBottomGap;
    } else if (isBullet) {
      const bulletContent = rawLine.replace(/^([•\-]\s*|\*\s+)/, '').trim();
      const wrapped = wrapTextPixels(bulletContent, bulletUsableWidth - maxLineSafety, baseFontSize, isAllBold);

      const textIndentX = paddingX + bulletIndent;
      const bulletOffset = Math.min(22, Math.max(14, Math.round(baseFontSize * 0.45)));
      const bulletCenterX = textIndentX - bulletOffset;

      elements.push(
        `<circle cx="${bulletCenterX}" cy="${currentY - Math.round(baseFontSize * 0.32)}" r="${bulletRadius}" fill="${textColor}" />`
      );

      for (let j = 0; j < wrapped.length; j++) {
        elements.push(
          `<text x="${textIndentX}" y="${currentY}" font-family='${fontFamily}' font-size="${baseFontSize}" font-weight="${defaultWeight}" fill="${textColor}"${bodyStroke} xml:space="preserve"${letterSpacingAttr}>${formatInlineSpans(wrapped[j], isAllBold)}</text>`
        );
        currentY += lineHeight;
      }
      currentY += bulletGap;
    } else if (numMatch) {
      const numLabel = `${numMatch[1]}. `;
      const numContent = numMatch[2].trim();
      const numWidth = measureTextWidth(numLabel, baseFontSize, true);
      const numIndentX = paddingX + Math.max(bulletIndent, numWidth + 10);
      const wrapped = wrapTextPixels(numContent, usableWidth - (numIndentX - paddingX) - maxLineSafety, baseFontSize, isAllBold);

      elements.push(
        `<text x="${paddingX}" y="${currentY}" font-family='${fontFamily}' font-size="${baseFontSize}" font-weight="bold" fill="${textColor}"${bodyStroke} xml:space="preserve"${letterSpacingAttr}>${escapeHtml(numLabel)}</text>`
      );

      for (let j = 0; j < wrapped.length; j++) {
        const lineX = j === 0 ? paddingX + numWidth : numIndentX;
        elements.push(
          `<text x="${lineX}" y="${currentY}" font-family='${fontFamily}' font-size="${baseFontSize}" font-weight="${defaultWeight}" fill="${textColor}"${bodyStroke} xml:space="preserve"${letterSpacingAttr}>${formatInlineSpans(wrapped[j], isAllBold)}</text>`
        );
        currentY += lineHeight;
      }
      currentY += bulletGap;
    } else {
      // Key-Value Line Detection (supporting optional markdown bold syntax like **Key:** Value or Key: Value)
      const kvMatch = rawLine.match(/^(\*{0,2})([^:\n፡፦]+?)(:|፦|፡)(\*{0,2})\s+(.*)$/);
      if (kvMatch && kvMatch[2].trim().length < 35 && align === 'left') {
        const keyPart = `${kvMatch[2].trim()}${kvMatch[3]}`;
        const valuePart = kvMatch[5].replace(/\*{1,2}$/, '').trim();

        const keyW = measureTextWidth(keyPart + ' ', baseFontSize, true);
        const wrappedVal = wrapTextPixels(valuePart, usableWidth - keyW - maxLineSafety, baseFontSize, isAllBold);

        const keyStroke = isAllBold ? '' : ` ${boldStrokeBody}`;
        if (wrappedVal.length <= 1) {
          elements.push(
            `<text x="${paddingX}" y="${currentY}" font-family='${fontFamily}' font-size="${baseFontSize}" fill="${textColor}" xml:space="preserve"${letterSpacingAttr}><tspan font-weight="bold"${keyStroke}>${escapeHtml(keyPart)} </tspan><tspan font-weight="${defaultWeight}"${bodyStroke}>${formatInlineSpans(wrappedVal[0] || valuePart, isAllBold)}</tspan></text>`
          );
          currentY += lineHeight;
        } else {
          elements.push(
            `<text x="${paddingX}" y="${currentY}" font-family='${fontFamily}' font-size="${baseFontSize}" fill="${textColor}" xml:space="preserve"${letterSpacingAttr}><tspan font-weight="bold"${keyStroke}>${escapeHtml(keyPart)} </tspan><tspan font-weight="${defaultWeight}"${bodyStroke}>${formatInlineSpans(wrappedVal[0], isAllBold)}</tspan></text>`
          );
          currentY += lineHeight;
          for (let j = 1; j < wrappedVal.length; j++) {
            elements.push(
              `<text x="${paddingX + keyW}" y="${currentY}" font-family='${fontFamily}' font-size="${baseFontSize}" font-weight="${defaultWeight}" fill="${textColor}"${bodyStroke} xml:space="preserve"${letterSpacingAttr}>${formatInlineSpans(wrappedVal[j], isAllBold)}</text>`
            );
            currentY += lineHeight;
          }
        }
      } else {
        const wrapped = wrapTextPixels(rawLine, usableWidth - maxLineSafety, baseFontSize, isAllBold);
        for (let j = 0; j < wrapped.length; j++) {
          elements.push(
            `<text x="${anchorX}" y="${currentY}" font-family='${fontFamily}' font-size="${baseFontSize}" font-weight="${defaultWeight}" fill="${textColor}"${bodyStroke} xml:space="preserve"${letterSpacingAttr}${textAnchorAttr}>${formatInlineSpans(wrapped[j], isAllBold)}</text>`
          );
          currentY += lineHeight;
        }
      }
    }
  }

  const finalHeight = Math.ceil(currentY + paddingX);

  // Render card border if requested
  const borderMarkup = options.border ? (() => {
    const bWidth = options.borderWidth || 3;
    const bColor = options.borderColor || textColor;
    const bRadius = options.borderRadius || 16;
    const bMargin = Math.max(16, Math.round(paddingX * 0.35));
    return `<rect x="${bMargin}" y="${bMargin}" width="${width - 2 * bMargin}" height="${finalHeight - 2 * bMargin}" fill="none" stroke="${bColor}" stroke-width="${bWidth}" rx="${bRadius}"/>`;
  })() : '';

  const fontDefs = getEmbeddedFontDefs();
  const svg = `<svg width="${width}" height="${finalHeight}" viewBox="0 0 ${width} ${finalHeight}" xmlns="http://www.w3.org/2000/svg" xml:space="preserve">
    ${fontDefs}
    <rect width="${width}" height="${finalHeight}" fill="${bgColor}"/>
    ${borderMarkup}
    ${elements.join('\n    ')}
  </svg>`;

  const { default: sharp } = await import('sharp');
  return sharp(Buffer.from(svg))
    .png({ quality: 100, compressionLevel: 6 })
    .toBuffer();
}

/**
 * Backward compatibility alias for generateTextImageCard.
 * @constant
 */
export const generateReportImageCard = generateTextImageCard;

/**
 * Normalizes a Telegram Chat ID or Channel Username to standard format.
 * Automatically prefixes `-100` for 9+ digit numeric channel/supergroup IDs
 * while safely preserving public `@channel_name` handles and negative channel IDs.
 *
 * @param {string|number|null} chatId - Raw chat identifier
 * @returns {string|null} Normalized chat identifier
 */
export function normalizeTelegramChatId(chatId) {
  if (chatId === null || chatId === undefined) return null;
  const str = String(chatId).trim();
  if (!str) return null;
  if (str.startsWith('@')) return str;
  if (/^\d{9,}$/.test(str)) {
    return `-100${str}`;
  }
  if (/^-\d{9,}$/.test(str) && !str.startsWith('-100')) {
    return `-100${str.slice(1)}`;
  }
  return str;
}

/**
 * Resolves destination Telegram chat ID for a given operational channel.
 * Automatically normalizes channel IDs with the required -100 prefix.
 *
 * @param {Object} [user] - Mongoose user document
 * @param {string} [channel='management'] - Operational channel ('management' | 'maintenance' | 'general')
 * @returns {string|null} Resolved chat ID or null
 */
export function resolveChannelChatId(user, channel = 'management') {
  const normChannel = String(channel).toLowerCase();
  const userTelegram = user?.integrations?.telegram || {};

  let rawChatId = null;
  if (normChannel === 'maintenance') {
    rawChatId = userTelegram.maintenanceChatId || null;
  } else if (normChannel === 'general') {
    rawChatId = userTelegram.generalChatId || null;
  } else {
    // Default to management
    rawChatId = userTelegram.managementChatId || null;
  }

  return normalizeTelegramChatId(rawChatId);
}

/**
 * Resolves Telegram Bot Token from user integrations.
 * Strictly adheres to multi-tenant tenant isolation: zero runtime leakage to system .env.
 *
 * @param {Object} [user] - Mongoose user document
 * @returns {string} Bot token
 */
export function resolveBotToken(user) {
  return user?.integrations?.telegram?.botToken || '';
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
  options = {},
  botToken: tokenOverride,
  chatId: chatIdOverride,
}) {
  const channel = TELEGRAM_CONSTANTS.CHANNELS.includes(targetChannel) ? targetChannel : 'management';
  const botToken = tokenOverride !== undefined ? tokenOverride : resolveBotToken(user);
  const chatId = chatIdOverride !== undefined ? chatIdOverride : resolveChannelChatId(user, channel);

  const cleanText = text ? text.trim() : '';
  const hasCustomNote = Boolean(customNote && typeof customNote === 'string' && customNote.trim());
  const noteText = hasCustomNote ? customNote.trim() : '';

  // For text messages, prefix customNote if provided
  const fullText = hasCustomNote ? `${noteText}\n\n${cleanText}` : cleanText;

  const userTelegram = user?.integrations?.telegram || {};
  const isUserDisabled = userTelegram.enabled === false;
  const isUserConnected = userTelegram.connected !== false;
  const isLiveConfigured = Boolean(isUserConnected && !isUserDisabled && botToken && chatId);

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
      // Merge user saved image card options with explicit call options
      const mergedOptions = {
        ...(user?.integrations?.telegram?.imageCardOptions || {}),
        ...options,
      };
      const imageBuffer = await generateTextImageCard(cleanText, mergedOptions);
      const blob = new Blob([imageBuffer], { type: 'image/png' });
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('photo', blob, 'telegram_message_card.png');
      if (hasCustomNote) {
        formData.append('caption', noteText);
      }

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
  let lastError = null;

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
          lastError = data.description || `Telegram API error (${res.status})`;
          break;
        }
      } catch (netErr) {
        console.warn(`[telegramService] Network error during sendMessage (attempt ${attempts}/3):`, netErr.message, netErr.cause?.code || '');
        lastError = netErr.message || 'Network connection error';
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

  // Live network or permission failure (never report as a successful stub)
  return {
    success: false,
    ok: false,
    isStub: false,
    channel,
    mode: 'text',
    error: lastError || 'Failed to deliver message to Telegram Bot API. Network or permission error.',
  };
}

export default {
  escapeHtml,
  markdownToTelegramHtml,
  chunkTelegramMessage,
  generateTextImageCard,
  generateReportImageCard,
  resolveChannelChatId,
  resolveBotToken,
  dispatchToTelegram,
};
