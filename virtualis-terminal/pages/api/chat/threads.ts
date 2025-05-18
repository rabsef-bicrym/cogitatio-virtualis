// cogitatio-virtualis/virtualis-terminal/pages/api/chat/threads.ts

import { NextApiRequest, NextApiResponse } from 'next'
import { withSessionMiddleware } from '@/lib/threads/session'
import { prisma } from '@/lib/threads/prisma'
import { claudeApi } from '@/lib/api/cogitator-claude'
import { handleHardCommand } from './hardCommands'
import { ThreadMessage as dbThreadMessage } from '@prisma/client'

// Content block types for Claude API messages
// IMPORTANT REQUIREMENT: Each ToolUseBlock MUST be immediately followed by a
// corresponding ToolResultBlock in the next message to Claude
type TextBlock = { type: 'text'; text: string }
type ToolUseBlock = { type: 'tool_use'; name: string; id: string; input: Record<string, unknown> }
type ToolResultBlock = { type: 'tool_result'; tool_use_id: string; content: string }
type ContentBlock = TextBlock | ToolResultBlock | ToolUseBlock

// Our internal representation
interface ThreadMessage {
  role: 'user' | 'assistant'
  content: ContentBlock[]
  timestamp: string
}

export const config = {
  runtime: 'nodejs',
};

// Convert a DB row into a ThreadMessage
function parseDbMessage(dbMsg: dbThreadMessage): ThreadMessage {
  let parsed: ContentBlock[] = []
  try {
    parsed = JSON.parse(dbMsg.content) as ContentBlock[]
  } catch (err) {
    console.error('Error parsing DB message:', err)
  }
  return {
    role: dbMsg.role as 'user' | 'assistant',
    content: parsed,
    timestamp: dbMsg.timestamp.toISOString(),
  }
}

/**
 * Store a brand-new message of either user or assistant role
 * 
 * IMPORTANT FOR CLAUDE TOOL HANDLING:
 * When storing a user message with a tool_result block, it MUST be stored 
 * separately from other message content and must immediately follow the 
 * message containing the tool_use block. This is critical for Claude's tool
 * calling protocol.
 */
async function storeMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  blocks: ContentBlock[]
) {
  await prisma.threadMessage.create({
    data: {
      sessionId,
      role,
      content: JSON.stringify(blocks),
    },
  })
}

// Append text to the last user message if the last was user, otherwise create new
/**
 * Check if a message consists solely of tool_result blocks.
 * This is important because we must never append regular text to a message
 * that contains only tool_result blocks, as this would break the Claude API
 * requirement that tool_result blocks must be in their own separate message.
 */
function isPureToolResult(msg: ThreadMessage): boolean {
  return (
    msg.role === 'user' &&
    msg.content.length > 0 &&
    msg.content.every(b => b.type === 'tool_result')
  );
}

/**
 * Append text to the last user message if the last was user, otherwise create new.
 * IMPORTANT: Never appends to a message that consists solely of tool_result blocks,
 * as this would break Claude's requirement that tool_result blocks must be in
 * their own separate message.
 */
async function appendUserText(sessionId: string, text: string, additionalBlocks: ContentBlock[] = []) {
  const lastMsgArr = await prisma.threadMessage.findMany({
    where: { sessionId },
    orderBy: { timestamp: 'desc' },
    take: 1,
  })
  const lastMsg = lastMsgArr[0]

  const newBlocks: ContentBlock[] = [{ type: 'text', text }, ...additionalBlocks]

  // Always create a new message if:
  // 1. There's no last message
  // 2. Last message is from assistant
  // 3. Last message is a pure tool_result message (critical for Claude's tool usage protocol)
  if (!lastMsg || lastMsg.role === 'assistant' || (lastMsg && isPureToolResult(parseDbMessage(lastMsg)))) {
    await storeMessage(sessionId, 'user', newBlocks)
    return
  }

  // If the last message was user and not a pure tool_result message, append to it
  const existing = parseDbMessage(lastMsg).content
  const updated = [...existing, ...newBlocks]
  await prisma.threadMessage.update({
    where: { id: lastMsg.id },
    data: { content: JSON.stringify(updated) },
  })
}


/**
 * Retrieve entire conversation in ascending order
 */
async function getThreadMessages(sessionId: string): Promise<ThreadMessage[]> {
  const dbMessages = await prisma.threadMessage.findMany({
    where: { sessionId },
    orderBy: { timestamp: 'asc' },
  })
  return dbMessages.map(parseDbMessage)
}

/**
 * A basic helper to correct unbalanced <reply> tags in a single text block.
 * - If there's a <reply> but no </reply>, we add </reply> at the end.
 * - If there's a </reply> but no <reply>, we prepend <reply>.
 */
function fixUnbalancedReplyTags(original: string): string {
  const hasOpen = original.includes('<reply>')
  const hasClose = original.includes('</reply>')

  // If there's an open with no close, add </reply> at the end.
  if (hasOpen && !hasClose) {
    return original + '</reply>'
  }
  // If there's a close with no open, add <reply> at the start.
  if (!hasOpen && hasClose) {
    return '<reply>' + original
  }
  return original
}

/**
 * A utility that walks through all text blocks in the new Claude response
 * and ensures each is balanced w.r.t. <reply> tags.
 */
function fixContentBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.map((block) => {
    if (block.type === 'text') {
      return {
        ...block,
        text: fixUnbalancedReplyTags(block.text),
      }
    }
    return block
  })
}

/**
 * Extract <reply> text from an assistant message's blocks (may contain multiple).
 * Properly preserves newlines in the original text to ensure they render correctly.
 */
function parseAssistantReply(blocks: ContentBlock[]): string {
  const re = /<reply>([\s\S]*?)<\/reply>/g
  let final = ''
  for (const block of blocks) {
    if (block.type === 'text') {
      let match: RegExpExecArray | null
      while ((match = re.exec(block.text)) !== null) {
        if (final) {
          final += '\n'
        }
        // Keep the original text without trimming to preserve newlines
        final += match[1]
      }
    }
  }
  return final.trim()
}

/**
 * Gather all <reply> blocks in assistant messages after the last user message
 * that isn't just a tool_result. This allows multi-step replies to be returned
 * as a single string in the final response.
 * 
 * The adjusted logic uses the isPureToolResult helper to properly identify 
 * user messages that should be skipped when collecting assistant replies.
 */
async function parseAllAssistantRepliesSinceLastUserMessage(sessionId: string): Promise<string> {
  const thread = await getThreadMessages(sessionId)

  let startIndex = -1
  for (let i = thread.length - 1; i >= 0; i--) {
    const msg = thread[i]
    if (msg.role === 'user') {
      // Skip any user messages that are pure tool_result messages
      if (!isPureToolResult(msg)) {
        startIndex = i
        break
      }
    }
  }

  let combinedReplies = ''
  const replyRegex = /<reply>([\s\S]*?)<\/reply>/g

  for (let i = startIndex + 1; i < thread.length; i++) {
    const msg = thread[i]
    if (msg.role === 'assistant') {
      for (const block of msg.content) {
        if (block.type === 'text') {
          let match: RegExpExecArray | null
          while ((match = replyRegex.exec(block.text)) !== null) {
            if (combinedReplies) {
              combinedReplies += '\n\n'
            }
            // Preserve original formatting and newlines by not trimming the content
            combinedReplies += match[1]
          }
        }
      }
    }
  }

  return combinedReplies || '<reply>...potential recoverable error detected - please proceed with next user input...</reply>'
}

/**
 * Modified Claude handler with streaming support
 */
/**
 * Handles Claude API responses, managing tool calls and message streaming
 * This function is responsible for properly organizing the message flow
 * to ensure all tool_use blocks are followed immediately by tool_result blocks
 * as required by Claude's API
 */
export async function handleClaudeResponse(
  sessionId: string,
  onProgress: (message: string, eventType: 'partial' | 'complete') => Promise<void>
): Promise<void> {
  const MAX_TURNS = 12
  let turnCount = 0

  while (turnCount < MAX_TURNS) {
    turnCount++

    // Fetch entire conversation each iteration
    // Fetch the entire conversation history for context
    const entireThread = await getThreadMessages(sessionId)
    
    // Send the thread to Claude API
    // If Claude responds with a tool_use block, we must immediately follow up
    // with a corresponding tool_result block in the next message
    const { contentBlocks, reply } = await claudeApi.chat(
      entireThread.map((m) => ({
        ...m,
        content: JSON.stringify(m.content),
      })) as any
    )
    
    const toolUses = contentBlocks
      .filter((b: ContentBlock): b is ToolUseBlock => b.type === 'tool_use');

    // Ensure unbalanced <reply> tags are fixed in each text block
    const correctedBlocks = fixContentBlocks(contentBlocks)

    // If Claude provided no <reply>, add a fallback text block
    if (!reply) {
      correctedBlocks.push({
        type: 'text',
        text: '<reply>...processing...</reply>',
      })
    }

    // Store all assistant blocks in the DB
    await storeMessage(sessionId, 'assistant', correctedBlocks)

    // Extract and stream immediate reply
    const assistantReply = parseAssistantReply(correctedBlocks)
    if (assistantReply) {
      // Ensure we're not stripping newlines when sending to client
      if (toolUses.length) {
        // This is a partial response as more tool calls are pending
        await onProgress(assistantReply, 'partial')
      } else {
        // This is a complete response - no more tool calls
        await onProgress(assistantReply, 'complete')
        break
      }
    }

    if (toolUses.length) {
      // Log when multiple tool uses are detected to help with debugging
      if (toolUses.length > 1) {
        console.log(`[handleClaudeResponse] Processing ${toolUses.length} tool calls in a single turn`);
      }

      const resultBlocks: ToolResultBlock[] = [];

      for (const tu of toolUses) {
        let commandStr = '';
        switch (tu.name) {
          case 'doc_id_command': {
            const did = tu.input.doc_id as string
            commandStr = `/doc_id ${did}`
            break
          }
          case 'docs_command': {
            const dt = tu.input.doc_type as string
            commandStr = `/docs ${dt}`
            break
          }
          case 'project_command': {
            const sub = tu.input.subcommand as string
            if (sub === 'type' && tu.input.subtype) {
              const subtype = tu.input.subtype as string
              commandStr = `/project type ${subtype}`
            } else {
              commandStr = `/project ${sub}`
            }
            break
          }
          case 'experience_command': {
            const sub = tu.input.subcommand as string
            if (sub) {
              commandStr = `/exp ${sub}`
            } else {
              commandStr = `/exp`
            }
            break
          }
          case 'other_command': {
            const st = tu.input.subtype as string
            commandStr = `/other ${st}`
            break
          }
          case 'search_vector_database': {
            const et = tu.input.embedding_type as string
            const q = tu.input.query as string
            commandStr = `/search ${et} ${q}`
            break
          }
          case 'status_command': {
            commandStr = `/status`
            break
          }
          default: {
            console.warn(`Unknown tool name encountered: ${tu.name} - skipping...`)
            break
          }
        }

        // Run slash command and get result
        const toolOutcome = await handleHardCommand(commandStr, true);
        
        // Add the result to our collection
        resultBlocks.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(toolOutcome),
        });
      }

      // Create ONE user message containing ALL the tool results, as required by Claude API
      // This ensures that all tool_result blocks are sent together in a single message,
      // preventing the 400 error when Claude sees tool_use IDs without matching tool_result blocks
      await storeMessage(sessionId, 'user', resultBlocks);
    } else {
      // No tool uses - we can break out of the loop
      break;
    }
  }

  if (turnCount >= MAX_TURNS) {
    console.warn('Reached max iteration during handleClaudeResponse - possible infinite loop avoided.')
  }

  return
}

/**
 * The main API route with SSE streaming
 */
export default withSessionMiddleware(async function threadsHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Session handling remains identical
  const sessionId = req.cookies?.cogitatio_session || 
                   res.getHeader('Set-Cookie')?.toString().match(/cogitatio_session=([^;]+)/)?.[1];

  if (!sessionId) {
    console.error('[threadsHandler] Failed to get session ID from either cookie or response headers');
    return res.status(500).json({
      success: false,
      message: 'Internal session error'
    });
  }

  if (req.method === 'GET') {
    // GET handler remains unchanged
    try {
      const messages = await prisma.threadMessage.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'asc' },
      })
      const data = messages.map(parseDbMessage)
      return res.status(200).json({
        success: true,
        message: 'OK',
        data,
      })
    } catch (error: any) {
      console.error('[threadsHandler GET] Error:', error)
      return res.status(500).json({
        success: false,
        message: `Server error: ${error.message || error}`,
      })
    }
  }

  if (req.method === 'POST') {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders(); // Send headers immediately

    const sendEvent = (data: object) => {
      // The original event data serialization - no changes
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const { command } = req.body as { command?: string }
      if (!command || typeof command !== 'string') {
        sendEvent({ success: false, message: 'Missing or invalid command' });
        return res.end();
      }

      // Handle slash commands
      if (command.startsWith('/')) {
        const slashResp = await handleHardCommand(command);
        
        if (slashResp.success && slashResp.data) {
          const dataString = JSON.stringify(slashResp.data, null, 2);
          const dataBlock: TextBlock = {
            type: 'text',
            text: `<command_output_message>\n${slashResp.message}\n</command_output_message>\n<data>\n${dataString}\n</data>`,
          }
          await appendUserText(sessionId, command, [dataBlock]);
        } else {
          await appendUserText(sessionId, command);
        }

        if (!slashResp.success && slashResp.data?.recoverable_failure) {
          // Fallback to LLM with streaming
          await storeMessage(sessionId, 'assistant', [{ 
            type: 'text', 
            text: `<reply>Could not run "${command}" as slash. Using fallback to LLM.</reply>` 
          }]);

          await handleClaudeResponse(sessionId, async (message, eventType) => {
            sendEvent({ type: eventType, message });
          });

        } else {
          sendEvent({
            type: 'complete',
            success: slashResp.success,
            message: slashResp.message,
            data: slashResp.success ? slashResp.data : undefined
          });
        }
        return res.end();
      }

      // Handle normal text input with streaming
      await appendUserText(sessionId, command);
      
      await handleClaudeResponse(sessionId, async (message, eventType) => {
        sendEvent({ type: eventType, message });
      });

    } catch (err: any) {
      console.error('[threadsHandler POST]', err);
      sendEvent({
        type: 'error',
        success: false,
        message: `Server error: ${err.message || err}`
      });
    }
    
    return res.end();
  }

  // Handle other methods
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed`,
  })
})
