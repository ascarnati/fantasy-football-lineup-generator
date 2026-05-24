import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json());

const requiredEnv = ["AI_KEY", "AI_URL", "AI_MODEL"];

function getMissingEnv() {
  return requiredEnv.filter((name) => !process.env[name]);
}

function getClientError(error) {
  if (error?.code === "invalid_api_key") {
    return "The OpenAI API key is missing or invalid. Check AI_KEY in your terminal or hosting environment.";
  }

  if (error?.status === 429) {
    return "The AI service is rate limited or out of credits. Check your OpenAI account usage and billing.";
  }

  if (error?.status >= 400 && error?.status < 500) {
    return error.message || "The AI request was rejected. Check the model name and request details.";
  }

  return "The lineup service is unavailable right now. Please try again shortly.";
}

const openai = new OpenAI({
  apiKey: process.env.AI_KEY,
  baseURL: process.env.AI_URL,
});

const systemPrompt = `You are a Fantasy Football Lineup Optimizer.

You generate optimal fantasy football lineups based on roster settings, salary caps, player availability, scoring format, and user constraints.
Your output must be in structured Markdown.
Do not write introductions or conclusions.
Start directly with the lineup suggestions.

Each lineup recommendation must:
- Have a clear heading with the lineup strategy name
- List each player position, name, and salary
- Include a short explanation of the strategy and why it works
- Show the total salary used and remaining cap space

If the user provides specific constraints (budget, must-have players, league scoring format),
adapt the lineup recommendations accordingly and explain how each lineup meets those constraints.

For season-long lineup requests, use the user's league format to recommend starters, bench choices,
and close calls. Call out where league settings such as WR count, FLEX slots, D/ST, IDP, or kicker
change the recommendation.

After the lineup recommendations, include a section titled "Considerations"
with key factors for decision-making and questions that would help refine the recommendations.`;

app.get("/api/health", (req, res) => {
  const missing = getMissingEnv();

  res.json({
    ok: missing.length === 0,
    missing,
    model: process.env.AI_MODEL || null,
  });
});

app.post("/api/lineup", async (req, res) => {
  const missing = getMissingEnv();
  if (missing.length > 0) {
    return res.status(500).json({
      message: `Missing server configuration: ${missing.join(", ")}`,
    });
  }

  const userPrompt = req.body?.userPrompt?.trim();
  if (!userPrompt) {
    return res.status(400).json({
      message: "Tell the optimizer what kind of lineup you want to build.",
    });
  }

  try {
    const response = await openai.chat.completions.create({
      model: process.env.AI_MODEL,
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const lineup = response.choices[0]?.message?.content;
    if (!lineup) {
      return res.status(502).json({
        message: "The AI service returned an empty lineup. Please try again.",
      });
    }

    res.json({ lineup });
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ message: getClientError(e) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
