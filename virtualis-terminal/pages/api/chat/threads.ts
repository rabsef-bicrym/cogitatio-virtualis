import { chatRoute } from "@/lib/chat/chatRoute";
import { withSessionMiddleware } from "@/lib/threads/session";

export const config = {
  runtime: "nodejs",
};

export default withSessionMiddleware(chatRoute);
