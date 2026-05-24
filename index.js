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
const scoringFormat = document.getElementById("scoring-format");
const qbCount = document.getElementById("qb-count");
const rbCount = document.getElementById("rb-count");
const wrCount = document.getElementById("wr-count");
const teCount = document.getElementById("te-count");
const flexCount = document.getElementById("flex-count");
const defenseFormat = document.getElementById("defense-format");
const kickerIncluded = document.getElementById("kicker-included");

let lastLineupText = "";

function start() {
  userInput.addEventListener("input", syncInputState);
  lineupForm.addEventListener("submit", handleLineupRequest);
  clearButton.addEventListener("click", clearRequest);
  copyButton.addEventListener("click", copyLineup);

  templateButtons.forEach((button) => {
    button.addEventListener("click", () => {
      userInput.value = button.dataset.template;
      if (button.dataset.mode === "season") {
        scoringFormat.value = "PPR";
        defenseFormat.value = "D/ST";
        kickerIncluded.checked = true;
      }
      userInput.focus();
      syncInputState();
    });
  });

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
  resetLeagueFormat();
  syncInputState();
  renderEmptyState();
  userInput.focus();
}

function resetLeagueFormat() {
  scoringFormat.value = "PPR";
  qbCount.value = "1";
  rbCount.value = "2";
  wrCount.value = "2";
  teCount.value = "1";
  flexCount.value = "1";
  defenseFormat.value = "D/ST";
  kickerIncluded.checked = true;
}

function buildLeagueContext() {
  const defenseText = defenseFormat.value === "None"
    ? "no defense slot"
    : `${defenseFormat.value} defense`;
  const kickerText = kickerIncluded.checked ? "includes kicker" : "no kicker";

  return [
    "League format:",
    `- Scoring: ${scoringFormat.value}`,
    `- Starting lineup slots: ${qbCount.value} QB, ${rbCount.value} RB, ${wrCount.value} WR, ${teCount.value} TE, ${flexCount.value} FLEX, ${defenseText}, ${kickerText}`,
    "- If this is a season-long request, recommend starters and explain bench decisions.",
    "- If this is a DFS request, prioritize the user's salary cap and player pool over the season-long roster settings.",
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
