(function () {
  const RANDOM_ID = Math.random().toString(36).substring(2, 10);
  const CONSTANTS = {
    uploadButtonID: `btn-${RANDOM_ID}`,
    outputElementID: `out-${RANDOM_ID}`,
    scriptId: `script-${RANDOM_ID}`,
  };

  let worker = null;
  let shadowHost, shadowRoot;

  // Create hidden shadow DOM container
  function createShadowHost() {
    shadowHost = document.createElement("div");
    shadowHost.id = `host-${RANDOM_ID}`;
    shadowHost.style.all = "unset";
    shadowHost.style.position = "fixed";
    shadowHost.style.bottom = "10px";
    shadowHost.style.left = "10px";
    shadowHost.style.zIndex = "10000";
    document.body.appendChild(shadowHost);
    shadowRoot = shadowHost.attachShadow({ mode: "closed" });
    return shadowRoot;
  }

  async function initialize() {
    try {
      if (!shadowRoot) createShadowHost();
      await initializeComponents();
      initFullscreenListener();
    } catch (error) {
      console.error("Initialization error:", error);
    }
  }

  function initFullscreenListener() {
    document.addEventListener("fullscreenchange", handleFullscreen);
    document.addEventListener("webkitfullscreenchange", handleFullscreen);
  }

  function handleFullscreen() {
    const isFullscreen =
      document.fullscreenElement || document.webkitFullscreenElement;
    shadowHost.style.display = isFullscreen ? "none" : "block";
  }

  async function initializeComponents() {
    if (!document.getElementById(CONSTANTS.scriptId)) {
      await loadTesseract();
    }

    if (!shadowRoot.getElementById(CONSTANTS.outputElementID)) {
      createOutputElement();
    }

    if (!shadowRoot.getElementById(CONSTANTS.uploadButtonID)) {
      addCaptureButton();
    }

    worker = await createWorker();
  }

  async function loadTesseract() {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.id = CONSTANTS.scriptId;
      script.src = chrome.runtime.getURL("scripts/tesseract.min.js");
      document.head.appendChild(script);
      script.onload = resolve;
    });
  }

  function createOutputElement() {
    const outputElement = document.createElement("div");
    outputElement.id = CONSTANTS.outputElementID;
    outputElement.style.cssText = `
      position: absolute; bottom: 50px; left: 0;
      width: 280px; max-height: 350px; overflow-y: auto;
      background: rgba(30,30,30,0.9); color: #e0e0e0;
      border: 1px solid #444; border-radius: 8px;
      padding: 12px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-size: 13px; display: none; backdrop-filter: blur(5px);
    `;
    shadowRoot.appendChild(outputElement);
  }

  function addCaptureButton() {
    const btn = document.createElement("button");
    btn.id = CONSTANTS.uploadButtonID;
    btn.innerHTML = "📝";
    btn.style.cssText = `
      position: relative; background: #2c2c2c;
      border: none; border-radius: 50%; cursor: pointer;
      width: 36px; height: 36px; display: flex;
      justify-content: center; align-items: center;
      z-index: 10000; box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      color: white; font-size: 16px;
    `;
    shadowRoot.appendChild(btn);
    btn.addEventListener("click", captureAndProcess);
  }

  async function createWorker() {
    return Tesseract.createWorker("eng", 1, {
      workerPath: chrome.runtime.getURL(
        "scripts/tesseract.js@v5.0.4_dist_worker.min.js"
      ),
      corePath: chrome.runtime.getURL("scripts/"),
      langPath: chrome.runtime.getURL("scripts/languages/"),
      logger: () => {},
    });
  }

  function captureAndProcess() {
    chrome.runtime.sendMessage({ action: "captureTab" }, (response) => {
      if (response?.dataUrl) processImage(response.dataUrl);
    });
  }

  async function processImage(dataUrl) {
    const outputElement = shadowRoot.getElementById(CONSTANTS.outputElementID);
    outputElement.style.display = "block";
    outputElement.innerHTML =
      '<div style="padding:10px;text-align:center">Processing...</div>';

    try {
      const {
        data: { text },
      } = await worker.recognize(dataUrl);
      const aiResponse = await sendToGemini(text);

      outputElement.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div>Analysis Result</div>
          <button style="background:transparent;border:none;color:#aaa;cursor:pointer;font-size:18px">×</button>
        </div>
        <div style="background:#252525;padding:12px;border-radius:6px;white-space:pre-wrap;font-size:13px">
          ${aiResponse}
        </div>
        <button style="margin-top:12px;padding:8px;width:100%;background:#404040;border:none;border-radius:4px;color:white;cursor:pointer">
          Copy Text
        </button>
      `;

      outputElement.querySelector("button").addEventListener("click", () => {
        navigator.clipboard.writeText(aiResponse);
      });

      outputElement
        .querySelector('button[style*="background:transparent"]')
        .addEventListener("click", () => {
          outputElement.style.display = "none";
        });
    } catch (error) {
      outputElement.innerHTML = `<div style="color:#ff6b6b;padding:10px">Error: ${error.message}</div>`;
    }
  }

  async function sendToGemini(text) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: "callGemini", text: text },
        (response) => {
          if (chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }

          if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error || "An unknown error occurred."));
          }
        }
      );
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
