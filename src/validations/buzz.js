import { z } from "zod";

export const SendBuzzSchema = z.object({
  receiverId: z.number().positive(),
});