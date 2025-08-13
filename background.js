chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "captureTab") {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, function (dataUrl) {
      sendResponse({ dataUrl: dataUrl });
    });
    return true;
  }
});
