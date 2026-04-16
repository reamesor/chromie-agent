import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as readline from "node:readline";
import OpenAI from "openai";

const here = dirname(fileURLToPath(import.meta.url));
const charPath = join(here, "..", "characters", "chromie.json");

function loadPrompt() {
  const envPath = process.env.CHROMIE_CHARACTER_PATH?.trim();
  const path = envPath && existsSync(envPath) ? envPath : charPath;
  const c = JSON.parse(readFileSync(path, "utf8"));
  const lines = [
    `You are ${c.name}, an in-character agent.`,
    "",
    "Bio:",
    ...(c.bio || []).map((s) => `- ${s}`),
    "",
    "Lore:",
    ...(c.lore || []).map((s) => `- ${s}`),
    "",
    "Knowledge:",
    ...(c.knowledge || []).map((s) => `- ${s}`),
    "",
    "Style (all):",
    ...((c.style && c.style.all) || []).map((s) => `- ${s}`),
    "",
    "Style (chat):",
    ...((c.style && c.style.chat) || []).map((s) => `- ${s}`),
    "",
    "Stay in character. Reply concisely unless the user asks for detail.",
  ];
  return { name: c.name || "Chromie", system: lines.join("\n"), path };
}

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error("Set OPENAI_API_KEY in chromie-lite/.env or the environment.");
    process.exit(1);
  }

  const { name, system, path } = loadPrompt();
  console.log(`📄 ${path}\n`);
  console.log(`💬 ${name} (lite OpenAI CLI — not the full elizaOS runtime). Type 'exit' to quit.\n`);

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = [{ role: "system", content: system }];

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = () => {
    rl.question("You: ", async (input) => {
      const text = input.trim();
      if (!text) {
        ask();
        return;
      }
      if (text.toLowerCase() === "exit") {
        console.log("\n👋 Goodbye!");
        rl.close();
        process.exit(0);
      }

      messages.push({ role: "user", content: text });
      process.stdout.write(`${name}: `);
      const stream = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages,
        stream: true,
      });

      let full = "";
      for await (const chunk of stream) {
        const t = chunk.choices[0]?.delta?.content || "";
        full += t;
        process.stdout.write(t);
      }
      messages.push({ role: "assistant", content: full });
      console.log("\n");
      ask();
    });
  };
  ask();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
