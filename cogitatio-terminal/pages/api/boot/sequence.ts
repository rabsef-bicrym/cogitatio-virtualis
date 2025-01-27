// cogitatio-virtualis/cogitatio-terminal/pages/api/boot/sequence.ts

import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { vectorApi } from '@/lib/api/vector';
import { bootGenerator } from '@/lib/api/boot-sequence-generator';
import { haikuGenerator } from '@/lib/api/haiku-generator';
import { getRandomFallbackMessages } from '@/lib/fallbacks/boot-messages';
import { getRandomFallbackHaiku } from '@/lib/fallbacks/haiku-messages';
/**
 * Loads the specified prompt file from the prompts directory
 */
async function loadPrompt(filename: string): Promise<string> {
  const promptPath = path.join(process.cwd(), 'lib', 'prompts', filename);
  return fs.readFile(promptPath, 'utf-8');
}

export interface BootSequenceResponse {
  boot: string[];
  haiku: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BootSequenceResponse | { error: string; code: string }>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
    });
  }

  try {
    // Load both prompts in parallel
    const [bootPrompt, haikuPrompt] = await Promise.all([
      loadPrompt('boot-sequence.md'),
      loadPrompt('haiku-sequence.md'),
    ]);

    // Get separate context texts for boot and haiku
    const [bootTexts, haikuTexts] = await Promise.all([
      vectorApi.getRandomTexts(3),
      vectorApi.getRandomTexts(2),
    ]);

    // Generate sequences in parallel
    const [bootMessages, haikuText] = await Promise.allSettled([
      bootGenerator.generateSequence(bootPrompt, bootTexts.texts),
      haikuGenerator.generateHaiku(haikuPrompt, haikuTexts.texts),
    ]);

    // Use results or fallbacks as appropriate
    const finalBootMessages =
      bootMessages.status === 'fulfilled'
        ? bootMessages.value
        : getRandomFallbackMessages();

    const finalHaiku =
      haikuText.status === 'fulfilled'
        ? haikuText.value
        : getRandomFallbackHaiku();

    // Format the response
    const bootResponse: BootSequenceResponse = {
      boot: finalBootMessages,
      haiku: finalHaiku,
    };

    return res.status(200).json(bootResponse);
  } catch (error) {
    console.error('Boot sequence error:', error);
    return res.status(500).json({
      error: 'Failed to initialize boot sequence',
      code: 'BOOT_SEQUENCE_FAILED',
    });
  }
}
