(async () => {
  function scrape() {
    const MESSAGE_WINDOW_IDENT = ".b-chat__messages-wrapper";
    const MESSAGE_BLOCKS_IDENT = ".b-chat__item-message";
    const MESSAGE_BLOCK_DATE_IDENT = ".b-chat__messages__time";
    const MESSAGE_IDENT = ".b-chat__message";
    const MESSAGE_TEXT_CONT_IDENT = ".b-chat__message__text";
    const MESSAGE_TIME_IDENT = ".b-chat__message__time";

    const CHAT_SCROLLBAR_CONTAINER_IDENT = ".b-chats__scrollbar";

    const DATE_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ([12][0-9]|3[01]|[1-9])(, (20\d\d))?$/;
    const HOUR_12_TIME_REGEX = /^(1[0-2]|0?[1-9]):([0-5]?[0-9])( ?([ap]m))?$/;

    const MONTHS = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec"
    ];

    const messageWindow = document.querySelector(MESSAGE_WINDOW_IDENT);

    function hashString(string) {
      let hash = 0;
      let i;
      let chr;

      if (string.length === 0) return hash;

      for (i = 0; i < string.length; i++) {
        chr = string.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
      }

      return hash;
    }

    async function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    };

    function getPlainText(node) {
      if (node.nodeType === 3) { // 3 == text node
        return node.nodeValue;
      } else {
        return [...node.childNodes].map((childNode) => getPlainText(childNode)).join(" ");
      }
    };

    function transformMessageBlock(messageElem, dateObject) {
      const messageBodyElem = messageElem.querySelector(MESSAGE_TEXT_CONT_IDENT);
      const messageTimeElem = messageElem.querySelector(MESSAGE_TIME_IDENT);
      const messageAvatarLinkElem = messageElem.querySelector("a.g-avatar");

      let timeObject = null;
      const messageTimeSpanChilds = messageTimeElem.querySelectorAll("span");

      [...messageTimeSpanChilds].forEach((spanElem) => {
        const match = spanElem.innerText.trim().match(HOUR_12_TIME_REGEX);

        if (match) {
          timeObject = {
            hour: Number(match[1]),
            minute: Number(match[2]),
            ampm: match[4],
          };
        }
      });

      const datetimeString = new Date(
        dateObject.year,
        dateObject.month,
        dateObject.date,
        timeObject.ampm === "am" ? timeObject.hour : timeObject.hour + 12,
        timeObject.minute
      ).toISOString();

      const text = getPlainText(messageBodyElem);

      const avatarHref = messageAvatarLinkElem.getAttribute("href");
      const username = avatarHref.substring(1);

      return {
        text: text,
        datetime: datetimeString,
        hash: hashString(`${datetimeString}_${text}`),
        from: username,
      };
    }

    function grabMessages() {
      const messageBlocks = [...messageWindow.querySelectorAll(MESSAGE_BLOCKS_IDENT)];

      const messages = [];

      for (const messageBlockElem of messageBlocks) {
        const messageBlockDateElem = messageBlockElem.querySelector(`${MESSAGE_BLOCK_DATE_IDENT} > span[title]`);
        const messageBlockDateText = messageBlockDateElem.innerText.trim();

        const dateMatch = messageBlockDateText.match(DATE_REGEX);

        const dateObject = {
          year: dateMatch[4] ? Number(dateMatch[4]) : Number(new Date().getFullYear()),
          month: MONTHS.indexOf(dateMatch[1]),
          date: Number(dateMatch[2]),
        };

        const messageBlockElems = [...messageBlockElem.querySelectorAll(MESSAGE_IDENT)];

        if (messageBlockElems.length > 0) {
          const firstMessage = transformMessageBlock(messageBlockElems[0], dateObject);

          if (mostRecentMessageHash !== null && firstMessage.hash === mostRecentMessageHash) {
            // if we encounter a message block we've already seen, break as we've already
            // scraped all succeeding messageBlockElems
            break;
          }
        }

        messages.push(...messageBlockElems.map((messageElem) => transformMessageBlock(messageElem, dateObject)));
      }

      return messages;
    };

    let disconnectTimeout = null;
    const allMessages = [];
    let mostRecentMessageHash = null;

    function scrollUpAndScrape() {
      const chatScrollWindow = document.querySelector(CHAT_SCROLLBAR_CONTAINER_IDENT);
      chatScrollWindow.scrollTo({ top: 0, behavior: "smooth" });

      const messages = grabMessages();

      if (messages.length > 0) {
        mostRecentMessageHash = messages[0].hash;
      }

      allMessages.push(...messages);
    };

    const observer = new MutationObserver(function (mutationsList) {
      mutationsList.forEach(function (mutation) {
        if (mutation.type === "childList") {
          if (mutation.addedNodes.length > 0) {
            // nodes added, scroll again
            setTimeout(() => {
              scrollUpAndScrape();

              clearTimeout(disconnectTimeout);
              // if nothing happens after 5 seconds disconnect observer
              disconnectTimeout = setTimeout(disconnectObserver, 5000);
            }, 1000);
          }
        }
      });
    });

    function disconnectObserver() {
      observer.disconnect();
      console.log(allMessages);
    };

    observer.observe(messageWindow, { subtree: false, childList: true });

    scrollUpAndScrape();

    // if nothing happens after 5 seconds disconnect observer
    disconnectTimeout = setTimeout(disconnectObserver, 5000);
  }

  async function init() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrape,
    });
  }

  const initButton = document.getElementById("initialise");

  initButton.onclick = function (event) {
    event.preventDefault();
    init();
  };
})();
