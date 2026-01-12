import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";
dotenv.config();

export const XiaomiModel = new ChatOpenAI({
  model: process.env.OPEN_ROUTER_XIAOMI_MODEL,
  apiKey: process.env.OPEN_ROUTER_API_KEY,
  maxTokens: 1000,
  configuration: {
    baseURL: process.env.OPEN_ROUTER_BASE_URL,
  },
});