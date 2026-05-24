/**
 * Check that environment variables are configured
 */
export function checkEnvironment() {
  if (!process.env.AI_URL) {
    throw new Error(
      "Missing AI_URL. This tells us which AI provider you're using."
    );
  }
  if (!process.env.AI_MODEL) {
    throw new Error("Missing AI_MODEL. The AI request needs a model name.");
  }
  if (!process.env.AI_KEY) {
    throw new Error("Missing AI_KEY. Your API key is not being picked up.");
  }
  console.log("AI provider URL:", process.env.AI_URL);
  console.log("AI model:", process.env.AI_MODEL);
}

/**
 * Auto-resize textarea to fit content
 */
export function autoResizeTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

/**
 * Toggle loading state for the request lifecycle.
 * When entering: hides output, resets textarea, animates button.
 * When exiting: shows output, restores button to compact state.
 */
export function setLoading(isLoading) {
  const generateButton = document.getElementById("generate-button");
  const buttonText = document.querySelector(".button-text");
  const userInput = document.getElementById("user-input");
  const outputContainer = document.getElementById("output-container");

  generateButton.disabled = isLoading;

  if (isLoading) {
    // Hide output and reset textarea
    outputContainer.classList.add("hidden");
    outputContainer.classList.remove("visible");
    userInput.style.height = "auto";

    // Animate generate button
    generateButton.classList.remove("compact");
    generateButton.classList.add("loading");
    buttonText.textContent = "Generating Lineup...";
  } else {
    // Show output
    outputContainer.classList.remove("hidden");
    outputContainer.classList.add("visible");

    // Restore generate button to compact state
    generateButton.classList.remove("loading");
    generateButton.classList.add("compact");
    buttonText.textContent = "Generate Lineup";
  }
}
