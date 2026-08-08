import { logger } from '../_utils/logger.js';
import { errDetails } from './accounting.service.js';
import { REPAIR_OPERATIONS, type RiskLevel } from './repair-operations.registry.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Model id last verified against OpenRouter's catalog at the time this
// feature was built. Verify https://openrouter.ai/models still lists this
// slug before relying on it in production, and override via
// OPENROUTER_MODEL in .env if it has changed.
const DEFAULT_MODEL = 'openai/gpt-4o';
const REQUEST_TIMEOUT_MS = 30000;

export interface AiAnalysisInput {
  type: string;
  severity: string;
  description: string;
  entityRef?: string | null;
  currentValue?: number | null;
  expectedValue?: number | null;
  difference?: number | null;
  affectedRecords?: unknown;
}

export interface AiAnalysisResult {
  rootCause: string;
  explanation: string;
  proposedRepairType: string | null;
  proposedChangeDescription: string;
  confidence: number;
  riskLevel: RiskLevel;
  model: string;
}

export interface AiProvider {
  analyzeIssue(issue: AiAnalysisInput): Promise<AiAnalysisResult>;
}

const REPAIR_TYPE_ENUM = [...Object.keys(REPAIR_OPERATIONS), 'NONE'];

const DIAGNOSIS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'submit_diagnosis',
    description:
      'Submit a structured root-cause diagnosis and repair proposal for one detected accounting reconciliation issue.',
    parameters: {
      type: 'object',
      properties: {
        rootCause: { type: 'string', description: 'Short (1-2 sentence) most-likely root cause of this issue.' },
        explanation: { type: 'string', description: 'Plain-English explanation of the issue and its impact, for a non-technical Admin.' },
        proposedRepairType: {
          type: 'string',
          enum: REPAIR_TYPE_ENUM,
          description: "Key of the repair operation that would fix this, chosen ONLY from the given list. Use 'NONE' if no safe automated repair exists and a human must fix it manually.",
        },
        proposedChangeDescription: { type: 'string', description: 'One sentence describing what the proposed repair would concretely change.' },
        confidence: { type: 'number', minimum: 0, maximum: 1, description: 'Confidence in this diagnosis, 0.0 to 1.0.' },
        riskLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], description: 'Your own assessment of how risky it would be to apply this repair.' },
      },
      required: ['rootCause', 'explanation', 'proposedRepairType', 'proposedChangeDescription', 'confidence', 'riskLevel'],
    },
  },
};

/**
 * OpenRouter's Chat Completions API is OpenAI-compatible — same request/
 * response shape as the OpenAI SDK, just a different base URL and a
 * `provider/model` slug. Implemented via plain fetch rather than an SDK to
 * avoid an extra dependency for what is otherwise a single call.
 */
class OpenRouterAiProvider implements AiProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  }

  async analyzeIssue(issue: AiAnalysisInput): Promise<AiAnalysisResult> {
    const operationCatalog = Object.values(REPAIR_OPERATIONS)
      .map((op) => `- ${op.key}: ${op.description} (risk ceiling: ${op.maxRiskLevel}, applies to: ${op.applicableIssueTypes.join(', ')})`)
      .join('\n');

    // Only structured, already-computed diagnostic fields are sent — never a
    // raw DB dump, never unrelated records, never credentials.
    const issuePayload = {
      type: issue.type,
      severity: issue.severity,
      description: issue.description,
      entityRef: issue.entityRef ?? null,
      currentValue: issue.currentValue ?? null,
      expectedValue: issue.expectedValue ?? null,
      difference: issue.difference ?? null,
      affectedRecords: issue.affectedRecords ?? null,
    };

    const systemPrompt =
      'You are an accounting reconciliation auditor for a double-entry bookkeeping system. ' +
      'You NEVER modify data yourself — you only diagnose and propose a repair for a human Admin to review. ' +
      'You may only propose a repair operation from the fixed list below; if none of them safely fixes this ' +
      'issue, set proposedRepairType to NONE and explain that Admin review is required. ' +
      'Your riskLevel is advisory only — the system enforces its own fixed risk ceiling per operation ' +
      'regardless of what you say, so assess it honestly rather than trying to make something auto-executable.\n\n' +
      `Available repair operations:\n${operationCatalog}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:5173',
          'X-Title': 'KMLWJ AI Accounting Health & Auto-Repair',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1024,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Diagnose this detected accounting reconciliation issue:\n\n${JSON.stringify(issuePayload, null, 2)}` },
          ],
          tools: [DIAGNOSIS_TOOL],
          tool_choice: { type: 'function', function: { name: 'submit_diagnosis' } },
        }),
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`OpenRouter request failed (${response.status}): ${body.slice(0, 300)}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error('AI provider did not return a structured diagnosis');
    }

    let input: {
      rootCause: string;
      explanation: string;
      proposedRepairType: string;
      proposedChangeDescription: string;
      confidence: number;
      riskLevel: RiskLevel;
    };
    try {
      input = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error('AI provider returned malformed diagnosis JSON');
    }

    return {
      rootCause: input.rootCause,
      explanation: input.explanation,
      proposedRepairType: input.proposedRepairType === 'NONE' ? null : input.proposedRepairType,
      proposedChangeDescription: input.proposedChangeDescription,
      confidence: Math.max(0, Math.min(1, Number(input.confidence) || 0)),
      riskLevel: input.riskLevel,
      model: this.model,
    };
  }
}

let cachedProvider: AiProvider | null | undefined;

/** Returns null (never throws) when OPENROUTER_API_KEY is unset — callers must degrade gracefully. */
export function getAiProvider(): AiProvider | null {
  if (cachedProvider !== undefined) return cachedProvider;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    logger.warn('AI provider not configured — OPENROUTER_API_KEY is unset, AI Analyze will report issues as unanalyzed');
    cachedProvider = null;
    return null;
  }
  try {
    cachedProvider = new OpenRouterAiProvider(apiKey);
  } catch (err) {
    logger.error({ err: errDetails(err) }, 'Failed to initialize AI provider');
    cachedProvider = null;
  }
  return cachedProvider;
}
