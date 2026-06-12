import { chatRoute } from "@/lib/chat/chatRoute";
import { withSessionMiddleware } from "@/lib/threads/session";

export const config = {
  runtime: "nodejs",
  // The tool loop streams SSE for the lifetime of a Claude conversation
  // turn; without these, Vercel's default duration and Next's response
  // limit would cut the stream off mid-thought.
  maxDuration: 90,
  api: {
    responseLimit: false,
  },
};

export default withSessionMiddleware(chatRoute);
