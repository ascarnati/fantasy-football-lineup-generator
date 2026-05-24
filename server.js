import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json());

// Initialize an OpenAI client for your provider using env vars
const openai = new OpenAI({
  apiKey: process.env.AI_KEY,
  baseURL: process.env.AI_URL,
});

// Initialize messages array with system prompt
const messages = [
  {
    role: "system",
    content: `You are a Fantasy Football Lineup Optimizer.

You generate optimal fantasy football lineups based on salary caps and player availability.
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

After the lineup recommendations, include a section titled "Considerations"
with key factors for decision-making and questions that would help refine the recommendations.`,
  },
];

app.post("/api/lineup", async (req, res) => {
  // Extract userPrompt from req.body and add to messages
  const { userPrompt } = req.body

  messages.push({
    role: "user",
    content: userPrompt
  })

  try {
    // Send chat completions request
    const response = await openai.chat.completions.create({
      model: process.env.AI_MODEL,
      messages,
    });

    // Extract content and send back as JSON
    const lineup = response.choices[0].message.content
    console.log(lineup)

    res.json({ lineup });
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: `It's not you, it's us. 
    Something went wrong on the server` })
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
