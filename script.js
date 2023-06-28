let autoReplyEnabled = false;

const scrapeCurrentConvButton = document.getElementById("scrape-current-conversation");
const scrapeAllConvsButton = document.getElementById("scrape-all-conversations");
const toggleAutoReply = document.getElementById("toggle-auto-reply");

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

toggleAutoReply.onclick = function (event) {
  event.preventDefault();

  autoReplyEnabled = !autoReplyEnabled;
  console.log({ autoReplyEnabled });

  chrome.tabs.query({ active: true, lastFocusedWindow: true })
    .then(([tab]) => {
      return chrome.tabs.sendMessage(tab.id, { command: "set_auto_reply_enabled", value: autoReplyEnabled });
    })
    .then((response) => {
      console.log({ response });
      if (response.message == "received") {
        toggleAutoReply.innerText = autoReplyEnabled ? "Disable auto-reply" : "Enable auto-reply";
        document.getElementById("auto-reply-status").innerText = autoReplyEnabled ? "enabled" : "disabled";
      }
    })
};
