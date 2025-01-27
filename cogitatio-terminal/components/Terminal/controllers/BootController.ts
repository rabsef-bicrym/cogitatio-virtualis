// cogitatio-virtualis/cogitatio-terminal/components/Terminal/controllers/BootController.ts

import { BaseController } from './BaseController';
import {
  ControllerState,
  BootState,
} from '@/components/Terminal/controllers/types';
import type { TerminalHandle } from '@/components/Terminal/types/terminal';
import {
  sendLine,
  sendMultiLine,
  sendMessage,
} from '@/components/Terminal/utils/printUtils';
import {
  ASCII_STYLES,
  COGITATIO_LOGO_LINES,
} from '@/components/Terminal/config/ascii.config';

interface BootControllerConfig {
  onBootComplete?: () => void;
}

export class BootController extends BaseController {
  state: BootState = {
    status: 'initializing',
    messages: [],
    error: null,
  };

  constructor(private config: BootControllerConfig = {}) {
    super();
    console.log('[BootController] Initialized');
  }

  public getName(): string {
    return 'BootController';
  }

  public async mount(terminal: TerminalHandle): Promise<void> {
    console.log('[BootController] Mount started');
    this.terminal = terminal;

    this.setStatus('active');

    try {
      await this.runBootSequence();
    } catch (error) {
      console.error('[BootController] Mount error:', error);
      this.setStatus('error');
      throw error; // Propagate to terminal
    }
  }

  public async unmount(): Promise<void> {
    if (!this.terminal) return;

    try {
      // Remove custom styling
      this.updateConfig({
        theme: {
          customCSS: '',
        },
      });

      await this.clear();
      this.terminal = null;
    } catch (error) {
      console.error('[BootController] Unmount error:', error);
      this.setStatus('error');
      throw error;
    }
  }

  private async runBootSequence(): Promise<void> {
    await this.enqueueOperation(async () => {
      // Initialize Loading
      await this.setLoading(true);

      // Initial boot message with original timing
      await this.print(sendMessage('Initializing boot sequence...\n', 'info'));
      // await this.delay(500);

      // Fetch and start boot sequence
      const { boot, haiku } = await this.fetchBootSequence();
      await this.printBootMessages(boot);

      // Clear and show ASCII art
      await this.clear();
      await this.printAsciiArt();

      // Prepare for haiku
      await this.printHaiku(haiku);
      await this.delay(3500);

      // Final cleanup
      await this.clear();
      this.updateConfig({
        theme: {
          customCSS: '', // Clear custom ASCII styling
        },
      });

      // Signal completion after final cleanup pause
      await this.setLoading(false);
      this.setStatus('complete');
      this.config.onBootComplete?.();
    });
  }

  private async fetchBootSequence() {
    try {
      const response = await fetch('/api/boot/sequence');
      if (!response.ok) {
        this.setStatus('error');
        throw new Error(`Boot sequence fetch failed: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('[BootController] Boot sequence fetch error:', error);
      this.setStatus('error');
      throw error;
    }
  }

  private async printBootMessages(messages: string[]) {
    for (const message of messages) {
      await this.print(sendMessage(message, 'system'));
      // Maintain original random delay behavior
      await this.delay(Math.random() * 2000 + 50);
    }
  }

  private async printAsciiArt(): Promise<void> {
    // Configure terminal for ASCII art display
    this.updateConfig({
      theme: {
        customCSS: ASCII_STYLES,
      },
    });

    // Print each line of the ASCII art
    for (const line of COGITATIO_LOGO_LINES) {
      await this.print(sendLine(line.words, line.options));
    }

    // Allow time to view the complete logo
    await this.delay(1500);
  }

  private async printHaiku(haiku: string): Promise<void> {
    await this.print(sendMessage(haiku, 'assistant'));
    await this.delay(2000); // Original pause for haiku appreciation
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
