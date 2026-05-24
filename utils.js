export function autoResizeTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 520)}px`;
}

export function setLoading(isLoading) {
  const generateButton = document.getElementById("generate-button");
  const buttonText = document.querySelector(".button-text");

  generateButton.disabled = isLoading;
  generateButton.classList.toggle("loading", isLoading);
  buttonText.textContent = isLoading ? "Generating..." : "Generate Lineup";
}

export function setApiStatus({ ok, label }) {
  const apiStatus = document.getElementById("api-status");

  apiStatus.classList.toggle("ready", ok);
  apiStatus.classList.toggle("warning", !ok);
  apiStatus.lastChild.textContent = ` ${label}`;
}
