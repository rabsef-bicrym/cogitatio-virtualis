// cogitatio-virtualis/cogitatio-terminal/pages/api/chat/threads.ts

import { NextApiRequest, NextApiResponse } from 'next'
import { withSessionMiddleware } from '@/lib/threads/session'
import { prisma } from '@/lib/threads/prisma'
import { claudeApi } from '@/lib/api/cogitator-claude'
import { handleHardCommand } from './hardCommands'
import { ThreadMessage as dbThreadMessage } from '@prisma/client'

// Expand your ContentBlock union to include a tool_use block:
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

// Store a brand-new message of either user or assistant role
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
async function appendUserText(sessionId: string, text: string, additionalBlocks: ContentBlock[] = []) {
  const lastMsgArr = await prisma.threadMessage.findMany({
    where: { sessionId },
    orderBy: { timestamp: 'desc' },
    take: 1,
  })
  const lastMsg = lastMsgArr[0]

  const newBlocks: ContentBlock[] = [{ type: 'text', text }, ...additionalBlocks]

  if (!lastMsg || lastMsg.role === 'assistant') {
    await storeMessage(sessionId, 'user', newBlocks)
    return
  }

  // If the last message was user, append to it
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
        final += match[1].trim()
      }
    }
  }
  return final.trim()
}

/**
 * Gather all <reply> blocks in assistant messages after the last user message
 * that isn't just a tool_result. This allows multi-step replies to be returned
 * as a single string in the final response.
 */
async function parseAllAssistantRepliesSinceLastUserMessage(sessionId: string): Promise<string> {
  const thread = await getThreadMessages(sessionId)

  let startIndex = -1
  for (let i = thread.length - 1; i >= 0; i--) {
    const msg = thread[i]
    if (msg.role === 'user') {
      if (!(msg.content.length === 1 && msg.content[0].type === 'tool_result')) {
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
            combinedReplies += match[1].trim()
          }
        }
      }
    }
  }

  return combinedReplies || '<reply>...potential recoverable error detected - please proceed with next user input...</reply>'
}

/**
 * calls claude in a loop until it returns no more toolUse or we hit a max iteration
 */
async function handleClaudeResponse(sessionId: string): Promise<void> {
  const MAX_TURNS = 12
  let turnCount = 0

  while (turnCount < MAX_TURNS) {
    turnCount++

    // fetch entire conversation each iteration
    const entireThread = await getThreadMessages(sessionId)
    const { contentBlocks, reply, toolUse } = await claudeApi.chat(
      entireThread.map((m) => ({
        ...m,
        content: JSON.stringify(m.content),
      })) as any
    )

    // Ensure unbalanced <reply> tags are fixed in each text block
    const correctedBlocks = fixContentBlocks(contentBlocks)

    // If Claude provided no <reply>, add a fallback text block
    // (we do this *after* we've already fixed everything)
    if (!reply) {
      correctedBlocks.push({
        type: 'text',
        text: '<reply>...processing...</reply>',
      })
    }

    // Store all assistant blocks in the DB
    await storeMessage(sessionId, 'assistant', correctedBlocks)

    if (toolUse) {
      // Determine the slash command
      let commandStr = ''
      switch (toolUse.name) {
        case 'doc_id_command': {
          const did = toolUse.input.doc_id as string
          commandStr = `/doc_id ${did}`
          break
        }
        case 'docs_command': {
          const dt = toolUse.input.doc_type as string
          commandStr = `/docs ${dt}`
          break
        }
        case 'project_command': {
          const sub = toolUse.input.subcommand as string
          if (sub === 'type' && toolUse.input.subtype) {
            const subtype = toolUse.input.subtype as string
            commandStr = `/project type ${subtype}`
          } else {
            commandStr = `/project ${sub}`
          }
          break
        }
        case 'experience_command': {
          const sub = toolUse.input.subcommand as string
          if (sub) {
            commandStr = `/exp ${sub}`
          } else {
            commandStr = `/exp`
          }
          break
        }
        case 'other_command': {
          const st = toolUse.input.subtype as string
          commandStr = `/other ${st}`
          break
        }
        case 'search_vector_database': {
          const et = toolUse.input.embedding_type as string
          const q = toolUse.input.query as string
          commandStr = `/search ${et} ${q}`
          break
        }
        case 'status_command': {
          commandStr = `/status`
          break
        }
        default: {
          console.warn(`Unknown tool name encountered: ${toolUse.name} - skipping...`)
          break
        }
      }

      // run slash command
      const toolOutcome = await handleHardCommand(commandStr, true)

      // store the result in the conversation
      const toolResultBlock: ToolResultBlock = {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(toolOutcome),
      }
      await storeMessage(sessionId, 'user', [toolResultBlock])
    } else {
      // No more tool use; break
      break
    }
  }

  if (turnCount >= MAX_TURNS) {
    console.warn('Reached max iteration during handleClaudeResponse - possible infinite loop avoided.')
  }
}

/**
 * The main API route
 */
export default withSessionMiddleware(async function threadsHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // On first request the cookie won't exist yet, but will be set in the response
  // We need to read it from the response headers
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
    const { command } = req.body as { command?: string }
    if (!command || typeof command !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Missing or invalid "command" in request body',
      })
    }
  
    try {
      // If it's a slash command typed by the user:
      if (command.startsWith('/')) {
        const slashResp = await handleHardCommand(command)
  
        if (slashResp.success && slashResp.data) {
          // Convert the data to a string (assuming JSON.stringify for consistency)
          const dataString = JSON.stringify(slashResp.data, null, 2)
  
          // Append the command and the data to the user's message
          const dataBlock: TextBlock = {
            type: 'text',
            text: `<command_output_message>\n${slashResp.message}\n</command_output_message>\n<data>\n${dataString}\n</data>`,
          }
          await appendUserText(sessionId, command, [dataBlock])
        } else {
          // store the slash command in conversation
          await appendUserText(sessionId, command)
        }
  
        if (!slashResp.success && slashResp.data?.recoverable_failure) {
          // if slash command is recoverable, treat as normal text
          const fallbackAssistantText = `<reply>Could not run "${command}" as slash. Using fallback to LLM.</reply>`
          await storeMessage(sessionId, 'assistant', [{ type: 'text', text: fallbackAssistantText }])
  
          // now let Claude handle it
          await handleClaudeResponse(sessionId)
  
          // parse out all new <reply> blocks
          const finalReply = await parseAllAssistantRepliesSinceLastUserMessage(sessionId)
  
          return res.status(200).json({
            success: true,
            message: finalReply,
          })
        } else {
          return res.status(200).json({
            success: slashResp.success,
            message: slashResp.message,
            data: slashResp.success ? slashResp.data : undefined,
          })
        }
      }
  
      // otherwise, it's normal user text
      await appendUserText(sessionId, command)
      await handleClaudeResponse(sessionId)
  
      // gather all new <reply> blocks
      const final = await parseAllAssistantRepliesSinceLastUserMessage(sessionId)
  
      return res.status(200).json({
        success: true,
        message: final,
      })
    } catch (err: any) {
      console.error('[threadsHandler POST]', err)
      return res.status(500).json({
        success: false,
        message: `Server error: ${err.message || err}`,
      })
    }
  }

  // otherwise
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed`,
  })
})
