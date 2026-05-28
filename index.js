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
const sportSelect = document.getElementById("sport-select");
const platformSelect = document.getElementById("platform-select");
const checklistPlatform = document.getElementById("check-platform");
const checklistBudget = document.getElementById("check-budget");
const checklistPositions = document.getElementById("check-positions");
const checklistConstraints = document.getElementById("check-constraints");

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
  sportSelect.addEventListener("change", syncInputState);
  platformSelect.addEventListener("change", syncInputState);

  templateButtons.forEach((button) => {
    button.addEventListener("click", () => {
      userInput.value = button.dataset.template || "";
      const sport = button.dataset.sport;
      userInput.placeholder = sportPlaceholders[sport] || sportPlaceholders.default;
      sportSelect.value = sport || "";
      userInput.focus();
      syncInputState();
    });
  });

  userInput.placeholder = sportPlaceholders.default;
  syncInputState();
  checkApiHealth();
}

function syncInputState() {
  const rawInput = userInput.value;
  const trimmedInput = rawInput.trim();
  const length = rawInput.length;
  const hasInput = trimmedInput.length > 0;
  const selectedPlatform = platformSelect.value;
  const selectedSport = sportSelect.value;

  charCount.textContent = `${length} / ${userInput.maxLength}`;
  generateButton.disabled = !hasInput;
  autoResizeTextarea(userInput);
  updateReadinessChecklist({
    text: trimmedInput.toLowerCase(),
    selectedPlatform,
    selectedSport,
  });
}

function clearRequest() {
  userInput.value = "";
  lastLineupText = "";
  copyButton.disabled = true;
  sportSelect.value = "";
  platformSelect.value = "";
  userInput.placeholder = sportPlaceholders.default;
  syncInputState();
  renderEmptyState();
  userInput.focus();
}

function buildLeagueContext({ selectedSport, selectedPlatform }) {
  const contextLines = [
    "Instructions:",
    "- Use the user's prompt to determine sport, platform, roster slots, salary cap, scoring format, and any player constraints.",
    "- If the prompt mentions a known DFS platform, apply its roster rules.",
    "- If the user includes roster details, follow them exactly.",
    "- Prioritize lineup balance, salary efficiency, matchup leverage, and upside/floor tradeoffs.",
    "- Do not write introductions or conclusions. Start directly with the lineup recommendation.",
  ];

  if (selectedSport) {
    contextLines.push(`- Preferred sport: ${selectedSport}.`);
  }

  if (selectedPlatform) {
    contextLines.push(`- Preferred platform: ${selectedPlatform}.`);
  }

  return contextLines.join("\n");
}

function updateReadinessChecklist({ text, selectedPlatform, selectedSport }) {
  const hasPlatform =
    Boolean(selectedPlatform) || /\b(fanduel|draftkings|yahoo|espn|sleeper)\b/.test(text);
  const hasBudgetContext = /\$?\d{2,3}(,\d{3})?|\bsalary\b|\bcap\b|\bscoring\b/.test(text);
  const hasLineupStructure =
    Boolean(selectedSport) ||
    /\b(qb|rb|wr|te|dst|d\/st|flex|pg|sg|sf|pf|c|util|1b|2b|3b|ss|of|sp|rp)\b/.test(text);
  const hasConstraints = /\b(lock|must|avoid|fade|injury|questionable|out|stack|limit)\b/.test(text);

  checklistPlatform.classList.toggle("is-complete", hasPlatform);
  checklistBudget.classList.toggle("is-complete", hasBudgetContext);
  checklistPositions.classList.toggle("is-complete", hasLineupStructure);
  checklistConstraints.classList.toggle("is-complete", hasConstraints);
}

function buildUserRequestContext(requestDetails, selectedSport, selectedPlatform) {
  const context = [];

  if (selectedSport) {
    context.push(`Sport: ${selectedSport}`);
  }

  if (selectedPlatform) {
    context.push(`Platform: ${selectedPlatform}`);
  }

  if (context.length === 0) {
    return requestDetails;
  }

  return [
    `User-selected context: ${context.join(" | ")}`,
    requestDetails,
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
  const selectedSport = sportSelect.value;
  const selectedPlatform = platformSelect.value;
  const requestWithContext = buildUserRequestContext(requestDetails, selectedSport, selectedPlatform);

  const userPrompt = `${buildLeagueContext({ selectedSport, selectedPlatform })}\n\nUser request:\n${requestWithContext}`;

  setLoading(true);
  copyButton.disabled = true;
  renderLoadingState();

  try {
    const response = await fetch("/api/lineup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userPrompt }),
    });
    const responseText = await response.text();
    let data = {};
    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error("The lineup service returned an invalid response. Please try again.");
      }
    }

    if (!response.ok) {
      throw new Error(data.message || `Lineup request failed (${response.status}).`);
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
