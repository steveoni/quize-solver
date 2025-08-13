function saveCredentials() {
  const endpoint = document.getElementById("apiEndpoint").value.trim();
  const key = document.getElementById("apiKey").value.trim();
  const statusDiv = document.getElementById("status");

  chrome.storage.sync.set({ endpoint, key }, () => {
    statusDiv.textContent = "Credentials saved!";
    setTimeout(() => {
      statusDiv.textContent = "";
    }, 2000);
  });
}

function triggerCapture() {
  const statusDiv = document.getElementById("status");
  statusDiv.textContent = "Triggering OCR in page...";

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "triggerOCR" });
      statusDiv.textContent = "OCR capture triggered!";
      setTimeout(() => {
        statusDiv.textContent = "";
      }, 2000);
    } else {
      statusDiv.textContent = "No active tab found";
    }
  });
}

document.getElementById("saveBtn").addEventListener("click", saveCredentials);
document.getElementById("captureBtn").addEventListener("click", triggerCapture);

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(["endpoint", "key"], (result) => {
    if (result.endpoint)
      document.getElementById("apiEndpoint").value = result.endpoint;
    if (result.key) document.getElementById("apiKey").value = result.key;
  });
});
