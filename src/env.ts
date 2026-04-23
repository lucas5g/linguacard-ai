import z from "zod";

export const env = z.object({
  DATABASE_URL: z.url(),
  OPENROUTER_API_KEY: z.string(), 
}).parse(process.env);

