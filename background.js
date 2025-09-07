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
        provide the answer and only the answer (e.g A, B, C or D) and nothing else. and if the quize is to output code, output only the code  only.
        your mission is to identify what the text is asking and provide the answer or code if it is a code question. AND IF YOU ARE NOT SURE ABOUT THE ANSWER, USE THE GOOGLE SEARCH TOOL TO FIND THE MOST ACCURATE ANSWER.`;

      const requestData = {
        contents: [
          {
            parts: [{ text: `${SYSTEM_PROMPT}\n\n${text}` }],
          },
        ],
        tools: [
          {
            google_search: {},
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

  if (request.action === "callGeminiWithImage") {
    chrome.storage.sync.get(["endpoint", "key"], (credentials) => {
      if (!credentials.endpoint || !credentials.key) {
        sendResponse({
          success: false,
          error: "API credentials are not set in the extension popup.",
        });
        return;
      }
      const { endpoint, key: apiKey } = credentials;
      const SYSTEM_PROMPT = `You are a tech expert, knowledgeable across a wide range of topics including programming and software development. You will receive an image containing a quiz or question. Your mission is:
- Analyze the image and extract the question and options, even if the text is unclear.
- If the quiz has options, pick the most correct one (e.g A, B, C, or D).
- If the quiz requires code, output only the correct working code.
- If the text is not properly captured, use your best judgment to infer the question and answer.
- And if you are not sure about the answer, use the google search tool to find the most accurate answer.
Respond with only the answer (e.g A, B, C, or D) or the code, nothing else.`;

      const requestData = {
        contents: [
          {
            parts: [
              { text: SYSTEM_PROMPT },
              {
                inline_data: {
                  mime_type: "image/png",
                  data: request.image.split(",")[1],
                },
              },
            ],
          },
        ],
        tools: [
          {
            google_search: {},
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
