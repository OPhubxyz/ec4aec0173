// Language: JavaScript (ES Modules) | File: brain/reasoning/validator.js | Runtime: Node.js >= 20
// External dependency: none

/**
 * Purpose: Post-generation validator for Luau output checking block balance, syntax hazards, and completeness.
 * Inputs: Raw LLM output string.
 * Outputs: Validation report { valid, errors, warnings, extractedLuau }.
 * Side effects: None.
 * Error modes: Handles empty or malformed strings without throwing.
 * Concurrency assumptions: Stateless validator; safe for concurrent invocations.
 * Performance characteristics: O(L) single-pass lexical/structural scan over output length L.
 */

function extractLuauBlocks(text) {
  const blocks = [];
  const fenceRegex = /```(?:luau|lua)?\s*\n([\s\S]*?)```/gi;
  let match;
  while ((match = fenceRegex.exec(text)) !== null) {
    if (match[1] && match[1].trim().length > 0) {
      blocks.push(match[1].trim());
    }
  }
  return blocks;
}

function stripStringsAndComments(source) {
  // Remove --[[ ... ]] block comments, -- line comments, [[ ... ]] long strings, and quoted strings
  return source
    .replace(/--\[\[[\s\S]*?\]\]/g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\[\[[\s\S]*?\]\]/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

function checkBlockBalance(code) {
  const cleaned = stripStringsAndComments(code);
  const errors = [];

  // Count block openers that require 'end'
  const openers = cleaned.match(/\b(function|if|for|while|repeat)\b/g) || [];
  const ends = cleaned.match(/\bend\b/g) || [];
  const untils = cleaned.match(/\buntil\b/g) || [];

  const ifCount = (cleaned.match(/\bif\b/g) || []).length;
  const elseifCount = (cleaned.match(/\belseif\b/g) || []).length;
  const endCount = ends.length;
  const repeatCount = (cleaned.match(/\brepeat\b/g) || []).length;

  const expectedEnds =
    (cleaned.match(/\bfunction\b/g) || []).length +
    ifCount +
    (cleaned.match(/\bfor\b/g) || []).length +
    (cleaned.match(/\bwhile\b/g) || []).length;

  if (endCount !== expectedEnds) {
    errors.push(`Block 'end' mismatch: found ${endCount} 'end', expected ${expectedEnds} (elseif=${elseifCount})`);
  }

  if (repeatCount !== untils.length) {
    errors.push(`Repeat/until mismatch: ${repeatCount} 'repeat' vs ${untils.length} 'until'`);
  }

  // Check unmatched parentheses and brackets
  const pairs = [
    ['(', ')', 'parentheses'],
    ['[', ']', 'brackets'],
    ['{', '}', 'braces'],
  ];

  for (const [openChar, closeChar, label] of pairs) {
    let depth = 0;
    for (let i = 0; i < cleaned.length; i += 1) {
      const ch = cleaned[i];
      if (ch === openChar) depth += 1;
      else if (ch === closeChar) depth -= 1;
      if (depth < 0) {
        errors.push(`Unmatched closing ${label} '${closeChar}'`);
        break;
      }
    }
    if (depth > 0) {
      errors.push(`Unclosed ${label} '${openChar}' (depth ${depth})`);
    }
  }

  return { errors, openersCount: openers.length };
}

export function validateLuauOutput(rawOutput) {
  const text = String(rawOutput || '').trim();
  const errors = [];
  const warnings = [];

  if (!text) {
    return {
      valid: false,
      errors: ['Empty output from model'],
      warnings,
      extractedLuau: [],
    };
  }

  const blocks = extractLuauBlocks(text);
  const candidates = blocks.length > 0 ? blocks : [text];

  for (let i = 0; i < candidates.length; i += 1) {
    const snippet = candidates[i];

    if (/\bTODO\b|\bFIXME\b|--\s*\.\.\./i.test(snippet)) {
      errors.push(`Snippet ${i + 1} contains incomplete placeholder/TODO marker`);
    }

    const { errors: balanceErrors } = checkBlockBalance(snippet);
    for (const bErr of balanceErrors) {
      errors.push(`Snippet ${i + 1}: ${bErr}`);
    }

    if (/\bwhile\s+true\s+do\b/i.test(snippet) && !/\btask\.wait\b|\bwait\s*\(/i.test(snippet)) {
      warnings.push(`Snippet ${i + 1}: 'while true do' without task.wait() risks freezing thread/execution`);
    }

    if (/\bgetfenv\b|\bsetfenv\b/.test(snippet) && !/\b--!nocheck\b/.test(snippet)) {
      warnings.push(`Snippet ${i + 1}: getfenv/setfenv disables Luau VM optimizations; add --!nocheck if strict linter complains`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    extractedLuau: blocks,
  };
}
