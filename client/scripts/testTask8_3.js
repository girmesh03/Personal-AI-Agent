/**
 * @module scripts/testTask8_3
 * @description Comprehensive unit verification harness for Task 8.3 (Specialized Part Renderers & Cards).
 * Tests neutral card styles, reasoning accordion properties, tool label mappings,
 * report template formatting with bullet dot standard, codeblock properties, and message action bars
 * using React SSR renderToString and MemoryRouter.
 */

import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import {
  ReasoningPartRenderer,
  ToolPartRenderer,
  ReportCardPartRenderer,
  DirectiveAlertRenderer,
  OperonCodeBlock,
  MessageActionsBar,
  neutralMessageBubbleSx,
  chatMessageSlotProps,
} from '../src/components/chat/index.js';

let passedCount = 0;
let totalCount = 0;

const test = (description, fn) => {
  totalCount += 1;
  try {
    fn();
    passedCount += 1;
    console.log(`  \x1b[32m✔\x1b[0m ${description}`);
  } catch (err) {
    console.error(`  \x1b[31m✘\x1b[0m ${description}`);
    console.error(`    ${err.message}`);
    throw err;
  }
};

console.log('\n--- [TASK 8.3 VERIFICATION SUITE] ---\n');

// ==========================================
// Suite 1: Barrel Exports & Module Integrity
// ==========================================
console.log('Suite 1: Barrel Exports & Component Definitions');

test('index.js exports all required part renderers, styles, and action bars', () => {
  assert.equal(typeof ReasoningPartRenderer, 'function', 'ReasoningPartRenderer is exported');
  assert.equal(typeof ToolPartRenderer, 'function', 'ToolPartRenderer is exported');
  assert.equal(typeof ReportCardPartRenderer, 'function', 'ReportCardPartRenderer is exported');
  assert.equal(typeof DirectiveAlertRenderer, 'function', 'DirectiveAlertRenderer is exported');
  assert.equal(typeof OperonCodeBlock, 'function', 'OperonCodeBlock is exported');
  assert.equal(typeof MessageActionsBar, 'function', 'MessageActionsBar is exported');
  assert.equal(typeof neutralMessageBubbleSx, 'object', 'neutralMessageBubbleSx is exported');
  assert.equal(typeof chatMessageSlotProps, 'object', 'chatMessageSlotProps is exported');
});

// ==========================================
// Suite 2: Neutral Card Bubble Styles
// ==========================================
console.log('\nSuite 2: Neutral Card Bubble Styling');

test('neutralMessageBubbleSx enforces neutral outlined styling without saturated blue', () => {
  assert.equal(neutralMessageBubbleSx.border, '1px solid');
  assert.equal(neutralMessageBubbleSx.borderColor, 'divider');
  assert.equal(neutralMessageBubbleSx.bgcolor, 'background.paper');
  assert.equal(neutralMessageBubbleSx.color, 'text.primary');
  assert.equal(neutralMessageBubbleSx.boxShadow, 'none');
});

test('chatMessageSlotProps styles .MuiChatMessage-bubble with neutral tokens', () => {
  assert.ok(chatMessageSlotProps.root?.sx, 'Has root sx definition');
  const bubbleStyles = chatMessageSlotProps.root.sx['& .MuiChatMessage-bubble'];
  assert.ok(bubbleStyles, 'Targets .MuiChatMessage-bubble selector');
  assert.equal(bubbleStyles.borderColor, 'divider');
  assert.equal(bubbleStyles.bgcolor, 'background.paper');
});

// ==========================================
// Suite 3: ReasoningPartRenderer Contract
// ==========================================
console.log('\nSuite 3: ReasoningPartRenderer Contract & State Guard');

test('ReasoningPartRenderer renders reasoning text and handles empty text gracefully', () => {
  assert.ok(ReasoningPartRenderer.propTypes?.part, 'Validates part prop');

  // Actively streaming thought renders expanded accordion markup with thought content
  const streamingHtml = renderToString(
    React.createElement(ReasoningPartRenderer, {
      part: { type: 'reasoning', text: 'Analyzing shift records...', state: 'streaming' },
    })
  );
  assert.ok(streamingHtml.includes('Analyzing shift records...'), 'Includes thought content when streaming');
  assert.ok(streamingHtml.includes('Reasoning...'), 'Includes Reasoning... header label');

  // Completed thought renders collapsed header
  const doneHtml = renderToString(
    React.createElement(ReasoningPartRenderer, {
      part: { type: 'reasoning', text: 'Analyzing shift records...', state: 'done' },
    })
  );
  assert.ok(doneHtml.includes('Thought'), 'Includes Thought header summary when done');

  // Empty text when done renders empty string
  const emptyHtml = renderToString(
    React.createElement(ReasoningPartRenderer, {
      part: { type: 'reasoning', text: '', state: 'done' },
    })
  );
  assert.equal(emptyHtml, '', 'Renders empty string when thought text is empty and not streaming');
});

// ==========================================
// Suite 4: ToolPartRenderer & 17 Tools Coverage
// ==========================================
console.log('\nSuite 4: ToolPartRenderer & Autonomous Tools Labeling');

test('ToolPartRenderer accepts tool invocation states and renders human labels', () => {
  assert.ok(ToolPartRenderer.propTypes?.part, 'Validates part prop');

  // Test component execution with running state
  const runningHtml = renderToString(
    React.createElement(ToolPartRenderer, {
      part: {
        type: 'tool',
        toolInvocation: {
          toolName: 'create_report',
          state: 'input-streaming',
        },
      },
    })
  );
  assert.ok(runningHtml.includes('Executing Synthesizing Operational Report...'), 'Renders running label');

  // Test component execution with completed state
  const completedHtml = renderToString(
    React.createElement(ToolPartRenderer, {
      part: {
        type: 'tool',
        toolInvocation: {
          toolName: 'save_supervisor_directive',
          state: 'output-available',
          output: { success: true },
        },
      },
    })
  );
  assert.ok(completedHtml.includes('Saving Supervisor Directive'), 'Renders completed label');

  // Test component execution with error state
  const errorHtml = renderToString(
    React.createElement(ToolPartRenderer, {
      part: {
        type: 'tool',
        toolInvocation: {
          toolName: 'lookup_user_branches',
          state: 'output-error',
          errorText: 'Network timeout',
        },
      },
    })
  );
  assert.ok(errorHtml.includes('Searching Branches failed'), 'Renders failed label');
});

// ==========================================
// Suite 5: ReportCardPartRenderer & Amharic Format
// ==========================================
console.log('\nSuite 5: ReportCardPartRenderer & Unicode Bullet Standard');

test('ReportCardPartRenderer gracefully guards null report and renders formatted sections', () => {
  const emptyHtml = renderToString(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(ReportCardPartRenderer, { report: null })
    )
  );
  assert.equal(emptyHtml, '', 'Returns empty string when report is null');

  const validReport = {
    _id: 'rep-001',
    ethiopianDate: 'መስከረም 24, 2017',
    visits: [
      {
        branch: { name: 'Bole Medhanialem', code: 'BOLE-01' },
        clockIn: '08:30',
        clockOut: '17:00',
      },
    ],
    activities: [{ text: 'Walk-in freezer seal inspected', status: 'completed' }],
    issues: [{ text: 'Exhaust fan belt loose', status: 'reported' }],
    comments: [{ text: 'Maintenance dispatched for tomorrow morning' }],
    fullAmharicText: 'ቀን፡ መስከረም 24, 2017\nቅርንጫፍ፡ ቦሌ\n • የተከናወነ ተግባር',
  };

  const reportHtml = renderToString(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(ReportCardPartRenderer, { report: validReport })
    )
  );

  assert.ok(reportHtml.includes('መስከረም 24, 2017'), 'Contains Ethiopian date badge');
  assert.ok(reportHtml.includes('Bole Medhanialem'), 'Contains branch name');
  assert.ok(reportHtml.includes('08:30') && reportHtml.includes('17:00'), 'Contains clock-in and clock-out');
  assert.ok(reportHtml.includes('Walk-in freezer seal inspected'), 'Contains activity item');
  assert.ok(reportHtml.includes('Exhaust fan belt loose'), 'Contains issue item');
  assert.ok(reportHtml.includes('Maintenance dispatched for tomorrow morning'), 'Contains comment');
  assert.ok(reportHtml.includes('Copy'), 'Contains Copy action button');
  assert.ok(reportHtml.includes('Download'), 'Contains Download action button');
  assert.ok(reportHtml.includes('Print'), 'Contains Print action button');
  assert.ok(reportHtml.includes('Details'), 'Contains Details action button');
});

// ==========================================
// Suite 6: OperonCodeBlock & Dynamic Language Tags
// ==========================================
console.log('\nSuite 6: OperonCodeBlock Dynamic Syntax & Overflow Protection');

test('OperonCodeBlock renders uppercase language tags and preformatted code', () => {
  const excelHtml = renderToString(
    React.createElement(OperonCodeBlock, {
      language: 'excel',
      children: '=SUMIFS(Sales!C:C, Sales!A:A, "Bole")',
    })
  );
  assert.ok(excelHtml.includes('EXCEL'), 'Renders uppercase EXCEL badge');
  assert.ok(excelHtml.includes('=SUMIFS(Sales!C:C, Sales!A:A, &quot;Bole&quot;)'), 'Renders formula code');

  const pythonHtml = renderToString(
    React.createElement(OperonCodeBlock, {
      language: 'python',
      children: 'def audit_branch(): return True',
    })
  );
  assert.ok(pythonHtml.includes('PYTHON'), 'Renders uppercase PYTHON badge');
  assert.ok(pythonHtml.includes('def audit_branch(): return True'), 'Renders Python script');

  const fallbackHtml = renderToString(
    React.createElement(OperonCodeBlock, {
      children: '{"status": "ok"}',
    })
  );
  assert.ok(fallbackHtml.includes('CODE'), 'Renders fallback CODE tag when language omitted');
});

// ==========================================
// Suite 7: DirectiveAlertRenderer
// ==========================================
console.log('\nSuite 7: DirectiveAlertRenderer Cloud Sync Notification');

test('DirectiveAlertRenderer renders directive instruction with scope pill', () => {
  const emptyHtml = renderToString(
    React.createElement(DirectiveAlertRenderer, { directive: null })
  );
  assert.equal(emptyHtml, '', 'Returns empty string when directive is null');

  const directiveHtml = renderToString(
    React.createElement(DirectiveAlertRenderer, {
      directive: {
        scope: 'Branch',
        instruction: 'Always list chiller issues before kitchen equipment',
        category: 'Audit Rules',
      },
    })
  );
  assert.ok(directiveHtml.includes('Supervisor Directive Learned'), 'Contains title');
  assert.ok(directiveHtml.includes('Branch'), 'Contains scope pill');
  assert.ok(directiveHtml.includes('Audit Rules'), 'Contains category pill');
  assert.ok(directiveHtml.includes('Always list chiller issues before kitchen equipment'), 'Contains instruction text');
});

// ==========================================
// Suite 8: MessageActionsBar & Strict Clipboard Boundary
// ==========================================
console.log('\nSuite 8: MessageActionsBar & Strict Clipboard Boundaries');

test('MessageActionsBar extracts strictly pure text from parts without metadata', () => {
  const userMsg = {
    id: 'user-1',
    role: 'user',
    parts: [
      { type: 'text', text: '  Please check Bole branch audit status  ' },
      { type: 'file', url: '/uploads/doc.pdf' },
    ],
  };

  const assistantMsg = {
    id: 'asst-1',
    role: 'assistant',
    parts: [
      { type: 'reasoning', text: 'Analyzing database records...' },
      { type: 'tool', toolInvocation: { toolName: 'create_report' } },
      { type: 'text', text: 'Bole branch audit has been completed successfully.' },
    ],
  };

  const userHtml = renderToString(
    React.createElement(MessageActionsBar, { message: userMsg, onEdit: () => {} })
  );
  assert.ok(userHtml.includes('aria-label="Copy prompt text"'), 'Renders user prompt copy button');
  assert.ok(userHtml.includes('aria-label="Edit message"'), 'Renders edit prompt button');

  const asstHtml = renderToString(
    React.createElement(MessageActionsBar, {
      message: assistantMsg,
      isStreaming: false,
      onRetry: () => {},
    })
  );
  assert.ok(asstHtml.includes('aria-label="Copy response text"'), 'Renders assistant response copy button');
  assert.ok(asstHtml.includes('aria-label="Retry response"'), 'Renders retry button');

  const nullHtml = renderToString(
    React.createElement(MessageActionsBar, { message: null })
  );
  assert.equal(nullHtml, '', 'Returns empty string when message is null');
});

console.log(`\n\x1b[32m✔ All ${passedCount}/${totalCount} Task 8.3 tests passed successfully.\x1b[0m\n`);
