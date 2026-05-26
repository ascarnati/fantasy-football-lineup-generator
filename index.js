import { marked } from "marked";
import DOMPurify from "dompurify";
import { autoResizeTextarea, setApiStatus, setLoading } from "./utils.js";

const lineupForm = document.getElementById("lineup-form");
const userInput = document.getElementById("user-input");
const outputContainer = document.getElementById("output-container");
const outputContent = document.getElementById("output-content");
const generateButton = document.getElementById("generate-button");
const clearButton = document.getElementById("clear-button");
const copyButton = document.getElementById("copy-button");
const charCount = document.getElementById("char-count");
const templateButtons = document.querySelectorAll(".template-chip");

let lastLineupText = "";

const sportPlaceholders = {
  football:
    "Tell me your goal, player pool, and constraints. Example: Set my best fantasy NFL lineup with Josh Allen, Christian McCaffrey, and Justin Jefferson under $50,000. Include the platform you are drafting on, note injuries, bye weeks, must-start players, and suspicious price changes.",
  basketball:
    "Tell me your goal, player pool, and constraints. Example: Set my best fantasy NBA lineup with Luka Dončić, Jayson Tatum, and Nikola Jokic under $60,000. Include the platform you are drafting on, note injuries, stacks, matchup pace, and players to avoid.",
  baseball:
    "Tell me your goal, player pool, and constraints. Example: Set my best fantasy MLB lineup with Mike Trout, Aaron Judge, and a high-leverage pitcher under $35,000. Include the platform you are drafting on, note weather, handedness, lineup protection, and stacking preference.",
  default:
    "Tell me your goal, player pool, and constraints. Include sport, platform, roster slots, salary cap, injuries, and players to avoid.",
};

function start() {
  userInput.addEventListener("input", syncInputState);
  lineupForm.addEventListener("submit", handleLineupRequest);
  clearButton.addEventListener("click", clearRequest);
  copyButton.addEventListener("click", copyLineup);

  templateButtons.forEach((button) => {
    button.addEventListener("click", () => {
      userInput.value = button.dataset.template || "";
      const sport = button.dataset.sport;
      userInput.placeholder = sportPlaceholders[sport] || sportPlaceholders.default;
      userInput.focus();
      syncInputState();
    });
  });

  userInput.placeholder = sportPlaceholders.default;
  syncInputState();
  checkApiHealth();
}

function syncInputState() {
  const length = userInput.value.length;
  const hasInput = userInput.value.trim().length > 0;

  charCount.textContent = `${length} / ${userInput.maxLength}`;
  generateButton.disabled = !hasInput;
  autoResizeTextarea(userInput);
}

function clearRequest() {
  userInput.value = "";
  lastLineupText = "";
  copyButton.disabled = true;
  userInput.placeholder = sportPlaceholders.default;
  syncInputState();
  renderEmptyState();
  userInput.focus();
}

function buildLeagueContext() {
  return [
    "Instructions:",
    "- Use the user's prompt to determine sport, platform, roster slots, salary cap, scoring format, and any player constraints.",
    "- If the prompt mentions a known DFS platform, apply its roster rules.",
    "- If the user includes roster details, follow them exactly.",
    "- Prioritize lineup balance, salary efficiency, matchup leverage, and upside/floor tradeoffs.",
    "- Do not write introductions or conclusions. Start directly with the lineup recommendation.",
  ].join("\n");
}

async function checkApiHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();

    if (!response.ok || !data.ok) {
      const missing = data.missing?.join(", ") || "server config";
      setApiStatus({ ok: false, label: `Missing ${missing}` });
      return;
    }

    setApiStatus({ ok: true, label: data.model || "API ready" });
  } catch (error) {
    console.error(error);
    setApiStatus({ ok: false, label: "API offline" });
  }
}

async function handleLineupRequest(e) {
  e.preventDefault();

  const requestDetails = userInput.value.trim();
  if (!requestDetails) return;

  const userPrompt = `${buildLeagueContext()}\n\nUser request:\n${requestDetails}`;

  setLoading(true);
  copyButton.disabled = true;
  renderLoadingState();

  try {
    const response = await fetch("/api/lineup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userPrompt }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Something went wrong.");
    }

    lastLineupText = data.lineup;
    const html = marked.parse(lastLineupText);
    outputContainer.className = "";
    outputContent.innerHTML = DOMPurify.sanitize(html);
    copyButton.disabled = false;
  } catch (error) {
    console.error(error);
    lastLineupText = "";
    renderErrorState(error.message);
  } finally {
    setLoading(false);
    syncInputState();
  }
}

async function copyLineup() {
  if (!lastLineupText) return;

  try {
    await navigator.clipboard.writeText(lastLineupText);
    copyButton.textContent = "Copied";
    window.setTimeout(() => {
      copyButton.textContent = "Copy";
    }, 1400);
  } catch (error) {
    console.error(error);
    copyButton.textContent = "Copy failed";
    window.setTimeout(() => {
      copyButton.textContent = "Copy";
    }, 1400);
  }
}

function renderEmptyState() {
  outputContainer.className = "empty-state";
  outputContent.innerHTML = `
    <p class="empty-title">Your lineup analysis will appear here.</p>
    <p class="empty-copy">
      Add a salary cap, scoring format, roster slots, must-start players, and any players you want to avoid for stronger results.
    </p>
  `;
}

function renderLoadingState() {
  outputContainer.className = "empty-state";
  outputContent.innerHTML = `
    <p class="empty-title">Building lineup recommendations...</p>
    <p class="empty-copy">
      Comparing roster construction, salary usage, upside, floor, and matchup context.
    </p>
  `;
}

function renderErrorState(message) {
  outputContainer.className = "error-state";
  outputContent.textContent =
    message || "Sorry, I can't access what I need right now. Please try again in a bit.";
}

start();
