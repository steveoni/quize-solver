chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "captureTab") {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, function (dataUrl) {
      sendResponse({ dataUrl: dataUrl });
    });
    return true;
  }

  if (request.action === "callGemini") {
    chrome.storage.sync.get(["endpoint", "key"], (credentials) => {
      if (!credentials.endpoint || !credentials.key) {
        sendResponse({
          success: false,
          error: "API credentials are not set in the extension popup.",
        });
        return;
      }
      const { endpoint, key: apiKey } = credentials;
      const text = request.text;
      const SYSTEM_PROMPT = `You are a tech expert, knowledgeable accross a wide range of topics including programming, software development. i want you to look at the text. identify if it is a question and answer (with options) if so
        provide the answer and only the answer (either A, B, C or D) and nothing else. and if the quize is to output code, output only the code  only.
        your mission is to identify what the text is asking and provide the answer or code if it is a code question`;

      const requestData = {
        contents: [
          {
            parts: [{ text: `${SYSTEM_PROMPT}\n\n${text}` }],
          },
        ],
      };
      fetch(`${endpoint}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      })
        .then((response) => {
          if (!response.ok) {
            return response.json().then((err) => {
              throw new Error(
                err.error?.message || `HTTP error! status: ${response.status}`
              );
            });
          }
          return response.json();
        })
        .then((data) => {
          const aiResponse = data.candidates[0].content.parts[0].text;
          sendResponse({ success: true, data: aiResponse });
        })
        .catch((error) => {
          console.error("Gemini API error in background script:", error);
          sendResponse({ success: false, error: error.message });
        });
    });

    return true;
  }
});
