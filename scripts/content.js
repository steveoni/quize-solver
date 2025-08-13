const CONSTANTS = {
  uploadButtonID: "ocr-capture-button",
  outputElementID: "ocr-result-output",
  scriptId: "image-to-text-content-script",
};

let worker = null;
let initializingPromise = null;

async function initialize() {
  if (initializingPromise) {
    return initializingPromise;
  }

  initializingPromise = new Promise(async (resolve, reject) => {
    if (document.getElementById(CONSTANTS.scriptId)) {
      console.log("Already loaded Tesseract script");
      try {
        // Script already loaded, just initialize components
        await initializeComponents(false);
        resolve();
      } catch (error) {
        console.error("Error initializing worker: ", error);
        reject(error);
      }
    } else {
      const script = document.createElement("script");
      script.id = CONSTANTS.scriptId;
      script.src = chrome.runtime.getURL("scripts/tesseract.min.js");
      (document.head || document.documentElement).appendChild(script);

      script.onload = async function () {
        console.log("Loaded Tesseract script");
        try {
          await initializeComponents(true);
          resolve();
        } catch (error) {
          console.error("Error initializing worker: ", error);
          reject(error);
        }
      };

      script.onerror = function (error) {
        console.error("Failed to load Tesseract script: ", error);
        reject(error);
      };
    }
  }).finally(() => {
    console.log("Initialization process completed");
    initializingPromise = null;
  });

  return initializingPromise;
}

async function initializeComponents(initial = true) {
  if (!document.getElementById(CONSTANTS.outputElementID)) {
    createOutputElement();
  }

  if (!document.getElementById(CONSTANTS.uploadButtonID)) {
    addCaptureButton();
  }

  if (initial || !worker) {
    worker = await createWorker();
  }
}

function createOutputElement() {
  const outputElement = document.createElement("div");
  outputElement.id = CONSTANTS.outputElementID;
  outputElement.style.position = "fixed";
  outputElement.style.bottom = "70px";
  outputElement.style.left = "20px";
  outputElement.style.width = "300px";
  outputElement.style.maxHeight = "400px";
  outputElement.style.overflowY = "auto";
  outputElement.style.backgroundColor = "rgba(255, 255, 255, 0.95)";
  outputElement.style.color = "#000";
  outputElement.style.border = "1px solid #ccc";
  outputElement.style.borderRadius = "5px";
  outputElement.style.padding = "10px";
  outputElement.style.zIndex = "10000";
  outputElement.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.2)";
  outputElement.style.fontSize = "14px";
  outputElement.style.display = "none";
  document.body.appendChild(outputElement);
}

function addCaptureButton() {
  const btn = document.createElement("button");
  btn.id = CONSTANTS.uploadButtonID;
  btn.textContent = "OCR";
  btn.style.position = "fixed";
  btn.style.bottom = "20px";
  btn.style.left = "20px";
  btn.style.backgroundColor = "#343640";
  btn.style.border = "none";
  btn.style.borderRadius = "50%";
  btn.style.cursor = "pointer";
  btn.style.width = "48px";
  btn.style.height = "48px";
  btn.style.display = "flex";
  btn.style.justifyContent = "center";
  btn.style.alignItems = "center";
  btn.style.zIndex = "10000";
  btn.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.2)";

  btn.addEventListener("mouseenter", function () {
    btn.style.transform = "scale(1.1)";
    btn.style.transition = "transform 0.2s";
  });

  btn.addEventListener("mouseleave", function () {
    btn.style.transform = "scale(1)";
  });

  btn.addEventListener("click", captureAndProcess);
  document.body.appendChild(btn);
}

async function createWorker() {
  console.log("Initializing Tesseract worker...");

  // Display loading message
  //   showProgressMessage("Initializing OCR engine...");

  const worker = await Tesseract.createWorker("eng", 1, {
    workerPath: chrome.runtime.getURL(
      "scripts/tesseract.js@v5.0.4_dist_worker.min.js"
    ),
    corePath: chrome.runtime.getURL("scripts/"),
    langPath: chrome.runtime.getURL("scripts/languages/"),
    logger: (m) => {
      console.log(m);
      if (m.status === "recognizing text") {
        updateProgressMessage(m.status, m.progress);
      }
    },
  });

  await worker.setParameters({
    preserve_interword_spaces: "1",
  });
  hideProgressMessage();
  return worker;
}

// Show progress message
function showProgressMessage(message) {
  let progressElement = document.getElementById("ocr-progress-message");
  if (!progressElement) {
    progressElement = document.createElement("div");
    progressElement.id = "ocr-progress-message";
    progressElement.style.position = "fixed";
    progressElement.style.top = "50%";
    progressElement.style.left = "50%";
    progressElement.style.transform = "translate(-50%, -50%)";
    progressElement.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    progressElement.style.color = "#fff";
    progressElement.style.padding = "20px";
    progressElement.style.borderRadius = "10px";
    progressElement.style.zIndex = "10001";
    progressElement.style.textAlign = "center";

    const progressBar = document.createElement("div");
    progressBar.id = "ocr-progress-bar";
    progressBar.style.width = "200px";
    progressBar.style.height = "10px";
    progressBar.style.backgroundColor = "#444";
    progressBar.style.borderRadius = "5px";
    progressBar.style.marginTop = "10px";

    const progressFill = document.createElement("div");
    progressFill.id = "ocr-progress-fill";
    progressFill.style.width = "0%";
    progressFill.style.height = "100%";
    progressFill.style.backgroundColor = "#4caf50";
    progressFill.style.borderRadius = "5px";
    progressFill.style.transition = "width 0.3s";

    progressBar.appendChild(progressFill);
    progressElement.appendChild(progressBar);

    document.body.appendChild(progressElement);
  }

  progressElement.innerHTML = `<div>${message}</div>`;
  const progressBar = document.createElement("div");
  progressBar.id = "ocr-progress-bar";
  progressBar.style.width = "200px";
  progressBar.style.height = "10px";
  progressBar.style.backgroundColor = "#444";
  progressBar.style.borderRadius = "5px";
  progressBar.style.marginTop = "10px";

  const progressFill = document.createElement("div");
  progressFill.id = "ocr-progress-fill";
  progressFill.style.width = "0%";
  progressFill.style.height = "100%";
  progressFill.style.backgroundColor = "#4caf50";
  progressFill.style.borderRadius = "5px";

  progressBar.appendChild(progressFill);
  progressElement.appendChild(progressBar);
}

// Update progress message
function updateProgressMessage(status, progress) {
  const progressElement = document.getElementById("ocr-progress-message");
  const progressFill = document.getElementById("ocr-progress-fill");

  if (progressElement && progressFill) {
    const percentage = Math.round(progress * 100);
    progressElement.firstChild.textContent = `${status} (${percentage}%)`;
    progressFill.style.width = `${percentage}%`;
  }
}

// Hide progress message
function hideProgressMessage() {
  const progressElement = document.getElementById("ocr-progress-message");
  if (progressElement) {
    progressElement.remove();
  }
}

function captureAndProcess() {
  const outputElement = document.getElementById(CONSTANTS.outputElementID);
  outputElement.style.display = "block";
  outputElement.innerHTML = "Capturing screenshot...";

  chrome.runtime.sendMessage({ action: "captureTab" }, function (response) {
    if (response && response.dataUrl) {
      processImage(response.dataUrl);
    } else {
      outputElement.innerHTML = "Error capturing screenshot.";
    }
  });
}

async function processImage(dataUrl) {
  try {
    const outputElement = document.getElementById(CONSTANTS.outputElementID);
    showProgressMessage("Processing screenshot...");

    const { data } = await worker.recognize(dataUrl);
    const text = data.text;

    hideProgressMessage();
    const headerDiv = document.createElement("div");
    headerDiv.style.display = "flex";
    headerDiv.style.justifyContent = "space-between";
    headerDiv.style.alignItems = "center";
    headerDiv.style.marginBottom = "10px";

    const headerTitle = document.createElement("h3");
    headerTitle.textContent = "AI Analysis";
    headerTitle.style.color = "#000";
    headerTitle.style.margin = "0";

    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "✕";
    closeBtn.style.backgroundColor = "transparent";
    closeBtn.style.border = "none";
    closeBtn.style.color = "#666";
    closeBtn.style.fontSize = "16px";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.padding = "4px 8px";
    closeBtn.title = "Close";
    closeBtn.addEventListener("click", function () {
      outputElement.style.display = "none";
    });

    headerDiv.appendChild(headerTitle);
    headerDiv.appendChild(closeBtn);

    outputElement.innerHTML = "";
    outputElement.appendChild(headerDiv);

    const loadingIndicator = document.createElement("div");
    loadingIndicator.textContent = "Analyzing text with AI...";
    loadingIndicator.style.color = "#666";
    loadingIndicator.style.padding = "10px";
    loadingIndicator.style.textAlign = "center";
    outputElement.appendChild(loadingIndicator);

    const responseArea = document.createElement("div");
    responseArea.style.marginTop = "10px";
    outputElement.appendChild(responseArea);

    try {
      const aiResponse = await sendToGemini(text);

      loadingIndicator.remove();

      responseArea.innerHTML = `
        <div style="color: #000; background-color: #f5f5f5; padding: 10px; border-radius: 4px; white-space: pre-wrap;">${aiResponse}</div>
      `;

      const copyBtn = document.createElement("button");
      copyBtn.textContent = "Copy to clipboard";
      copyBtn.style.marginTop = "10px";
      copyBtn.style.padding = "8px 12px";
      copyBtn.style.cursor = "pointer";
      copyBtn.style.backgroundColor = "#4285f4";
      copyBtn.style.color = "white";
      copyBtn.style.border = "none";
      copyBtn.style.borderRadius = "4px";
      copyBtn.addEventListener("click", function () {
        navigator.clipboard.writeText(aiResponse).then(() => {
          copyBtn.textContent = "Copied!";
          setTimeout(() => {
            copyBtn.textContent = "Copy to clipboard";
          }, 2000);
        });
      });
      outputElement.appendChild(copyBtn);
    } catch (apiError) {
      loadingIndicator.remove();

      responseArea.innerHTML = `
        <div style="color: red; padding: 10px; background-color: #ffeeee; border-radius: 4px;">
          Error: ${apiError.message}
        </div>
      `;
    }
  } catch (err) {
    console.error(err);
    hideProgressMessage();
    const outputElement = document.getElementById(CONSTANTS.outputElementID);
    outputElement.innerHTML = `<div style="color: red; font-weight: bold;">Error processing image: ${err.message}</div>`;

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.style.marginTop = "10px";
    closeBtn.style.padding = "8px 12px";
    closeBtn.style.cursor = "pointer";
    closeBtn.addEventListener("click", function () {
      outputElement.style.display = "none";
    });
    outputElement.appendChild(closeBtn);
  }
}

async function sendToGemini(text) {
  const credentials = await new Promise((resolve) => {
    chrome.storage.sync.get(["endpoint", "key"], (result) => {
      resolve(result);
    });
  });

  const { endpoint, key: apiKey } = credentials;

  if (!endpoint || !apiKey) {
    throw new Error(
      "API credentials not set. Please set them in the extension popup."
    );
  }

  const SYSTEM_PROMPT = `You are a tech expert, knowledgeable accross a wide range of topics including programming, software development. i want you to look at the text. identify if it is a question and answer (with options) if so
        provide the answer and only the answer (either A, B, C or D) and nothing else. and if the quize is to output code, output only the code  only.
        your mission is to identify what the text is asking and provide the answer or code if it is a code question.
        make sure your answer is correct without mistakes`;

  const requestData = {
    contents: [
      {
        parts: [
          {
            text: `${SYSTEM_PROMPT}\n\n${text}`,
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `API Error: ${errorData.error?.message || response.statusText}`
      );
    }

    const responseData = await response.json();
    return responseData.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Gemini API error:", error);
    throw error;
  }
}

document.addEventListener("DOMContentLoaded", initialize);

if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  initialize();
}
