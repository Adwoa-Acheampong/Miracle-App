import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-loaded Gemini Client
let aiClient: GoogleGenAI | null = null;

function getGemini() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey.trim() !== "") {
      aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
      console.log("Gemini API initialized successfully.");
    } else {
      console.warn("GEMINI_API_KEY is missing or placeholder. Running in Offline/Serene Fallback Mode.");
    }
  }
  return aiClient;
}

// Deep, contemplative fallback database of sacred reflections & scripture 
// ensuring a premium standalone experience even when offline/without key.
const CONTEMPLATIVE_FALLBACKS = [
  {
    scripture: "“To live is so startling it leaves little time for other occupations.”",
    reflection: "In the quiet stillness of the obsidian paths, the mind learns that true motion is not about speed, but about depth. Let the emerald water wash away the clutter of expectations, revealing the pristine architecture of the present moment.",
    action: "Observe the subtle rise and fall of your breath. For three cycles, let each inhalation be a return, and each exhalation be a release."
  },
  {
    scripture: "“There are only two ways to live your life. One is as though nothing is a miracle. The other is as though everything is a miracle.”",
    reflection: "The miracle is not a suspension of natural order, but a sudden alignment with it. A leaf catching the morning light, a hand offered in silence, a memory that brings peace—these are the emerald gems scattered across your path.",
    action: "Recall one moment of unexpected kindness you received this week. Hold it in your mind like a warm light."
  },
  {
    scripture: "“The world is full of magical things, patiently waiting for our senses to grow sharper.”",
    reflection: "Look past the surface tension of daily noise. Underneath the static, a deeper frequency is hummed by the earth. Each spark of awareness you cultivate acts as a catalyst, transforming the dark stone of routine into a glowing trail of grace.",
    action: "Touch a physical surface near you. Spend ten seconds feeling its texture, temperature, and weight with absolute focus."
  }
];

const MIRACLE_SEARCH_FALLBACKS = [
  {
    title: "The Whispering Fern",
    description: "You discover a tiny green shoot growing through a microscopic fissure in the obsidian architecture. Against all physical odds, it has drawn moisture from the humid fog and turned it into perfect green cells. It is a slow, silent explosion of vital force.",
    insight: "Life does not wait for ideal conditions to manifest its beauty. It begins exactly where it is.",
    sparkles: 15
  },
  {
    title: "The Harmonic Ripple",
    description: "As you gaze into the deep emerald waters, three distinct ripples expand outward and meet. Instead of creating chaotic turbulence, they form an intricate, symmetrical pattern of interlocking circles before dissolving back into stillness.",
    insight: "Every choice we make radiates outward. In the grand design, even our small gestures find their perfect chord.",
    sparkles: 20
  },
  {
    title: "The Golden Alignment",
    description: "For a brief, unrepeatable second, the sparse Miracle Sparkles in the air drift into a perfectly straight vertical line, illuminating the dark architecture like a pillar of light, before scattering once more into the atmosphere.",
    insight: "Moments of perfect clarity are brief. Do not try to grasp them—simply be thankful you were there to witness them.",
    sparkles: 25
  }
];

// 1. API: Reflect Endpoint
app.post("/api/reflect", async (req, res) => {
  const { theme, input } = req.body;
  const ai = getGemini();

  if (!ai) {
    // Return a random beautiful fallback
    const fallback = CONTEMPLATIVE_FALLBACKS[Math.floor(Math.random() * CONTEMPLATIVE_FALLBACKS.length)];
    return res.json({ ...fallback, mode: "fallback" });
  }

  try {
    const prompt = `You are a quiet, deeply contemplative, wise, and spiritual guide for a game of reflection called 'Miracle'.
The player is interacting with an element in a dark, sacred, beautiful world.
Theme: "${theme || "General contemplation"}"
User input/feeling: "${input || "Silent seeking"}"

Generate a highly polished, poetic, and serene response structured exactly as JSON.
The tone must be peaceful, dignified, matching 'Cormorant Garamond italic' style. Avoid any hype, emoji, or loud phrasing.

Return a JSON object matching this schema:
{
  "scripture": "A brief quote of deep wisdom, spiritual passage, or poetic insight (10-20 words). It should feel ancient and reassuring.",
  "reflection": "A deeply moving paragraph (50-80 words) exploring the theme, connecting it to the obsidian path and the living emerald state of the world.",
  "action": "A single gentle, physical or mental action (e.g., breathing, touch, memory) for the player to do right now (10-15 words)."
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scripture: { type: Type.STRING },
            reflection: { type: Type.STRING },
            action: { type: Type.STRING },
          },
          required: ["scripture", "reflection", "action"],
        },
      },
    });

    const data = JSON.parse(response.text || "{}");
    return res.json({ ...data, mode: "gemini" });
  } catch (error: any) {
    console.error("Gemini reflect error:", error);
    const fallback = CONTEMPLATIVE_FALLBACKS[0];
    return res.json({ ...fallback, error: error.message, mode: "fallback" });
  }
});

// 2. API: Miracle Search Endpoint
app.post("/api/miracle/search", async (req, res) => {
  const { category } = req.body;
  const ai = getGemini();

  if (!ai) {
    const fallback = MIRACLE_SEARCH_FALLBACKS[Math.floor(Math.random() * MIRACLE_SEARCH_FALLBACKS.length)];
    return res.json({ ...fallback, mode: "fallback" });
  }

  try {
    const prompt = `You are a quiet, deeply contemplative scribe of the Miracle Game.
The player has initiated a search for a subtle everyday miracle in the category of: "${category || "Life"}"

Generate an inspiring, deeply observant "Everyday Miracle" event that they have discovered in their environment.
Return a JSON object matching this schema:
{
  "title": "A short, beautiful title for the miracle (e.g., 'The Silent Alchemist')",
  "description": "A detailed, poetic description (40-60 words) of a subtle, miraculous event happening in nature, human connection, or geometry.",
  "insight": "A brief philosophical core takeaway (10-15 words).",
  "sparkles": "A number representing the intensity of sparkles unlocked (integer between 10 and 30)"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            insight: { type: Type.STRING },
            sparkles: { type: Type.INTEGER },
          },
          required: ["title", "description", "insight", "sparkles"],
        },
      },
    });

    const data = JSON.parse(response.text || "{}");
    return res.json({ ...data, mode: "gemini" });
  } catch (error: any) {
    console.error("Gemini search error:", error);
    const fallback = MIRACLE_SEARCH_FALLBACKS[0];
    return res.json({ ...fallback, error: error.message, mode: "fallback" });
  }
});

// 3. API: Miracle Journal / Offering Endpoint
app.post("/api/miracle/journal", async (req, res) => {
  const { journalText } = req.body;
  const ai = getGemini();

  if (!ai) {
    return res.json({
      blessing: "Your gratitude has been placed in the deep waters of remembrance. Even in silence, thankfulness transforms the stones beneath our feet.",
      sparkles: 20,
      mode: "fallback"
    });
  }

  try {
    const prompt = `You are the guardian of the Well of Whispers. A traveler has offered this real-world miracle or expression of gratitude they witnessed today:
"${journalText || "I saw a warm smile from a stranger today"}"

Respond with a quiet, beautiful, customized 'blessing' or contemplative response (40-60 words) that honors their observation and deepens their awareness of miracles in daily life.

Return a JSON object matching this schema:
{
  "blessing": "The customized reflection/blessing",
  "sparkles": "An integer representing spark reward based on their depth (between 15 and 40)"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            blessing: { type: Type.STRING },
            sparkles: { type: Type.INTEGER },
          },
          required: ["blessing", "sparkles"],
        },
      },
    });

    const data = JSON.parse(response.text || "{}");
    return res.json({ ...data, mode: "gemini" });
  } catch (error: any) {
    console.error("Gemini journal error:", error);
    return res.json({
      blessing: "Your offering is accepted. The ripples of your awareness expand outward, calming the deep waters of the soul.",
      sparkles: 15,
      mode: "fallback"
    });
  }
});

// Setup Vite or Static assets serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
