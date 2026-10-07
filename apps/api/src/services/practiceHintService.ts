import { z } from 'zod';
import { groqChatJson } from './groqAiService';

const hintSchema = z.object({
  hint: z.string().min(1).max(800),
});

export type PracticeHintInput = {
  title: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  language: string;
  sourceCode: string;
  status: string;
  feedback: string;
  publicCases: Array<{
    name: string;
    passed: boolean;
    message?: string;
    expected?: string;
    actual?: string;
  }>;
};

/**
 * Conceptual hint only — must not reveal a full solution or hidden tests.
 */
export async function generatePracticeHint(input: PracticeHintInput): Promise<string | null> {
  if (!process.env.GROQ_API_KEY?.trim()) {
    return null;
  }

  const system = `You are a coding mentor for practice problems.
Given a failed submission, write ONE short conceptual hint (2-4 sentences).
Rules:
- Do NOT provide a full solution or complete code.
- Do NOT invent or reveal hidden test cases.
- Focus on the likely conceptual bug suggested by the public diagnostics.
- Be specific to the problem statement and error category.
Respond with JSON only: {"hint":"..."}.`;

  const user = JSON.stringify({
    problem: {
      title: input.title,
      description: input.description.slice(0, 2000),
      inputFormat: input.inputFormat,
      outputFormat: input.outputFormat,
      constraints: input.constraints,
    },
    submission: {
      language: input.language,
      status: input.status,
      feedback: input.feedback,
      publicCaseDiagnostics: input.publicCases.slice(0, 5),
      sourceCodePreview: input.sourceCode.slice(0, 2500),
    },
  });

  try {
    const raw = await groqChatJson(system, user);
    const text = raw.trim().replace(/^```(?:json)?\s*([\s\S]*?)```$/m, '$1').trim();
    const parsed = hintSchema.parse(JSON.parse(text));
    return parsed.hint.trim();
  } catch (err) {
    console.warn('[practiceHint] failed', err);
    return null;
  }
}
