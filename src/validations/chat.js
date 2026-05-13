import { z } from "zod";

export const SendMessageSchema = z.object({
  receiverId: z.number(),
  content: z.string().min(1).max(1000),
});