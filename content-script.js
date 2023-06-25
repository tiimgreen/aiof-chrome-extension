let autoReplyEnabled = true;

const CHAT_MAIN_CONTAINER_IDENT = ".b-chats__conversations-content";

const CHAT_LIST_IDENT = ".b-chats__list-wrapper";
const CHAT_LIST_ITEM_IDENT = ".b-chats__item";
const CHAT_LIST_ITEM_LINK_IDENT = ".b-chats__item__link";
const CHAT_LIST_ITEM_UNREAD_IDENT = ".b-chats__item__uread-count";

const MESSAGE_WINDOW_IDENT = ".b-chat__messages-wrapper";
const MESSAGE_BLOCKS_IDENT = ".b-chat__item-message";
const MESSAGE_BLOCK_DATE_IDENT = ".b-chat__messages__time";
const MESSAGE_IDENT = ".b-chat__message";
const MESSAGE_TEXT_CONT_IDENT = ".b-chat__message__text";
const MESSAGE_TIME_IDENT = ".b-chat__message__time";
const MESSAGE_SUBSCRIBE_BLOCK = ".b-subscribe-block";
const MESSAGE_PAYMENT_STATE_IDENT = ".b-chat__message__payment-state";

const CHAT_SCROLLBAR_CONTAINER_IDENT = ".b-chats__scrollbar";

const DATE_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ([12][0-9]|3[01]|[1-9])(, (20\d\d))?$/;
const HOUR_12_TIME_REGEX = /^(1[0-2]|0?[1-9]):([0-5]?[0-9])( ?([ap]m))?$/;

const POST_MESSAGES_URL = "https://us-central1-aoif-390417.cloudfunctions.net/postMessages";
// const POST_MESSAGES_URL = "https://sdddd.free.beeceptor.com";

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

const AVATAR_IMG_SRC_REGEX = /^https:\/\/public\.onlyfans\.com\/files\/thumbs(\/[^\/]+)*\/([0-9]+)\/avatar\.jpg$/;



const script = document.createElement("script");
script.src = chrome.runtime.getURL("inject.js");
script.onload = function () {
  this.remove();
};
(document.head || document.documentElement).appendChild(script);

document.addEventListener("of_messages_received", function (e) {
  const { list, hasMore } = JSON.parse(e.detail);

  const chatUsername = getCurrentChatUsername();

  let creator;
  let consumer;

  // get list of unique IDs of chat participants
  const participantIds = list
    .map(({ fromUser }) => fromUser.id)
    .filter((value, index, array) => array.indexOf(value) === index);

  // must be the other participant
  const otherUserId = participantIds.filter((id) => id !== currentUserId)[0];

  if (isCreator) {
    creator = {
      id: currentUserId,
      username: currentUsername,
    };

    consumer = {
      id: otherUserId,
      username: chatUsername,
    };
  } else {
    creator = {
      id: otherUserId,
      username: chatUsername,
    };

    consumer = {
      id: currentUserId,
      username: currentUsername,
    };
  }

  const formattedMessages = list.map(({ id, text, createdAt, fromUser }) => {
    return {
      id,
      text,
      from_user_id: fromUser.id,
      sent_at: createdAt,
    };
  });

  // if (formattedMessages.length > 0) {
  //   postMessages(formattedMessages, creator, consumer)
  //     .catch((error) => {
  //       console.log(error);
  //     });
  // }
});



const newMessageObserver = new MutationObserver(function (mutationsList) {
  mutationsList.forEach(function (mutation) {
    console.log({ mutation });
  });
});

const waitForElem = async (selector) => {
  return new Promise(resolve => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        resolve(document.querySelector(selector));
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
};

let currentUsername = null;
let currentUserId = null;

// TODO: change this
const isCreator = false;

waitForElem(".l-sidebar__avatar")
  .then((currentUserAvatar) => {
    currentUsername = currentUserAvatar.getAttribute("href").substring(1);
  });

waitForElem(".g-avatar__img-wrapper > img")
  .then((avatarImg) => {
    const match = avatarImg.getAttribute("src").match(AVATAR_IMG_SRC_REGEX);
    currentUserId = Number(match[2]);
  });


waitForElem(CHAT_LIST_IDENT)
  .then(() => {
    ingestUnreadMessages();
  });

const postMessages = async (messages, creator, consumer) => {
  return fetch(POST_MESSAGES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      data: {
        messages,
        creator,
        consumer,
      },
    }),
  })
    .then((res) => res.json())
}

const scrapeVisibleConversation = async () => {
  return new Promise((resolve) => {
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

      let username = null;
      if (messageAvatarLinkElem) {
        // sent from someone else
        const avatarHref = messageAvatarLinkElem.getAttribute("href");
        username = avatarHref.substring(1);
      } else {
        // sent from current user
        username = currentUsername;
      }

      let type = "plain-text";

      if (messageElem.querySelector(MESSAGE_SUBSCRIBE_BLOCK)) {
        type = "locked-content";
      } else if (messageElem.querySelector(".img-responsive")) {
        type = "image";
      } else if (messageElem.querySelector(".video-js")) {
        type = "video";
      }

      return {
        type: type,
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
        const todayMatch = messageBlockDateText === "Today";
        const yesterdayMatch = messageBlockDateText === "Yesterday";

        let dateObject = null;
        if (dateMatch) {
          dateObject = {
            year: dateMatch[4] ? Number(dateMatch[4]) : Number(new Date().getFullYear()),
            month: MONTHS.indexOf(dateMatch[1]),
            date: Number(dateMatch[2]),
          };
        } else if (todayMatch) {
          dateObject = {
            year: Number(new Date().getFullYear()),
            month: Number(new Date().getMonth()),
            date: Number(new Date().getDate()),
          };
        } else if (yesterdayMatch) {
          const date = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 1);

          dateObject = {
            year: date.getFullYear(),
            month: date.getMonth(),
            date: date.getDate(),
          };
        } else {
          console.log("unmatched text", messageBlockDateText);
        }

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

    function scrollUp() {
      const chatScrollWindow = document.querySelector(CHAT_SCROLLBAR_CONTAINER_IDENT);
      chatScrollWindow.scrollTo({ top: 0, behavior: "smooth" });
    };

    const observer = new MutationObserver(function (mutationsList) {
      mutationsList.forEach(function (mutation) {
        if (mutation.type === "childList") {
          if (mutation.addedNodes.length > 0) {
            // nodes added, scroll again
            setTimeout(() => {
              scrollUp();

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
      console.log("Done scraping");
      console.log(allMessages);
      resolve(allMessages);
    };

    observer.observe(messageWindow, { subtree: true, childList: true });

    scrollUp();

    // if nothing happens after 5 seconds disconnect observer
    disconnectTimeout = setTimeout(disconnectObserver, 5000);
  });
};

const getCurrentChatUsername = () => {
  const mainContentElem = document.querySelector(CHAT_MAIN_CONTAINER_IDENT);
  const chatHeader = mainContentElem.querySelector(".b-chat__header__title");
  const nameWrapper = chatHeader.querySelector(".g-user-realname__wrapper");

  return nameWrapper.getAttribute("href").substring(1);
};

const isOnChatForCreator = async (creatorUsername) => {
  return getCurrentChatUsername() === creatorUsername;
};

const waitForChatToChangeToCreator = async (creatorUsername) => {
  return new Promise((resolve) => {
    const mainContentElem = document.querySelector(CHAT_MAIN_CONTAINER_IDENT);

    if (isOnChatForCreator(creatorUsername)) {
      resolve(true);
    }

    const observer = new MutationObserver(function (mutationsList) {
      mutationsList.forEach(function (mutation) {
        if (mutation.type === "childList") {
          observer.disconnect();
          if (isOnChatForCreator(creatorUsername)) {
            resolve(true);
          }
        }
      });
    });

    observer.observe(mainContentElem, { subtree: true, childList: true });
  });
};

const scrapeAllConversations = async () => {
  const chatList = document.querySelector(CHAT_LIST_IDENT);
  const chatListItems = [...chatList.querySelectorAll(CHAT_LIST_ITEM_IDENT)];

  for (const chatListItem of chatListItems) {
    const avatarLink = chatListItem.querySelector("a.g-avatar");
    const creatorUsername = avatarLink.getAttribute("href").substring(1);

    const contentChangePromise = waitForChatToChangeToCreator(creatorUsername);
    chatListItem.querySelector(CHAT_LIST_ITEM_LINK_IDENT).click();

    await contentChangePromise;

    const messages = await scrapeVisibleConversation();
    console.log(messages);
  }
};

const ingestUnreadMessages = () => {
  const chatList = document.querySelector(CHAT_LIST_IDENT);
  const chatListItems = [...chatList.querySelectorAll(CHAT_LIST_ITEM_IDENT)];

  const itemsWithUnread = chatListItems.filter((chatListItem) => {
    return Boolean(chatListItem.querySelector(CHAT_LIST_ITEM_UNREAD_IDENT));
  });

  // for (const unreadChat of itemsWithUnread) {
  //   const chatLink = unreadChat.querySelector(CHAT_LIST_ITEM_LINK_IDENT);
  //   chatLink.click();
  //   break;
  // }
}

const setAutoReplyEnabled = (enabled) => {
  autoReplyEnabled = enabled;

  if (autoReplyEnabled) {
    const chatList = document.querySelector(CHAT_LIST_IDENT);
    newMessageObserver.observe(chatList, { subtree: true, childList: true });
  } else {
    newMessageObserver.disconnect();
  }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.command) {
    case "scrape_all_conversations":
      scrapeAllConversations();
      sendResponse({ message: "received" });
    case "scrape_visible_conversation":
      scrapeVisibleConversation();
      sendResponse({ message: "received" });
    case "set_auto_reply_enabled":
      setAutoReplyEnabled(request.value);
      sendResponse({ message: "received" });
    default:
      sendResponse({ message: "unrecognised-command" });
  }
});
