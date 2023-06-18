(async () => {
  const scrapeCurrentConvButton = document.getElementById("scrape-current-conversation");
  const scrapeAllConvsButton = document.getElementById("scrape-all-conversations");

  scrapeCurrentConvButton.onclick = function (event) {
    event.preventDefault();

    chrome.tabs.query({ active: true, lastFocusedWindow: true })
      .then(([tab]) => {
        return chrome.tabs.sendMessage(tab.id, { command: "scrape_visible_conversation" });
      })
      .then((response) => {
        console.log({ response });
      })
  };

  scrapeAllConvsButton.onclick = function (event) {
    event.preventDefault();

    chrome.tabs.query({ active: true, lastFocusedWindow: true })
      .then(([tab]) => {
        return chrome.tabs.sendMessage(tab.id, { command: "scrape_all_conversations" });
      })
      .then((response) => {
        console.log({ response });
      })
  };
})();
