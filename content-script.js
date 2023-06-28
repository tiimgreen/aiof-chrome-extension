let autoReplyEnabled = false;
let scapingMessages = false;
let disconnectMessageObserverTimeout = null;

const CHAT_INFORMATION = {};

const CHAT_MAIN_CONTAINER_IDENT = ".b-chats__conversations-content";
const CHAT_LIST_IDENT = ".b-chats__list-wrapper";
const CHAT_LIST_ITEM_IDENT = ".b-chats__item";
const CHAT_LIST_ITEM_LINK_IDENT = ".b-chats__item__link";
const CHAT_LIST_ITEM_UNREAD_IDENT = ".b-chats__item__uread-count";
const CHAT_SCROLLBAR_CONTAINER_IDENT = ".b-chats__scrollbar";

const MESSAGE_WINDOW_IDENT = ".b-chat__messages-wrapper";
const MESSAGE_BLOCKS_IDENT = ".b-chat__item-message";
const MESSAGE_BLOCK_DATE_IDENT = ".b-chat__messages__time";
const MESSAGE_IDENT = ".b-chat__message";
const MESSAGE_TEXT_CONT_IDENT = ".b-chat__message__text";
const MESSAGE_TIME_IDENT = ".b-chat__message__time";
const MESSAGE_SUBSCRIBE_BLOCK = ".b-subscribe-block";
const MESSAGE_PAYMENT_STATE_IDENT = ".b-chat__message__payment-state";

const DATE_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ([12][0-9]|3[01]|[1-9])(, (20\d\d))?$/;
const HOUR_12_TIME_REGEX = /^(1[0-2]|0?[1-9]):([0-5]?[0-9])( ?([ap]m))?$/;

const POST_MESSAGES_URL = "https://us-central1-aoif-390417.cloudfunctions.net/postMessages";
// const POST_MESSAGES_URL = "https://sdddd.free.beeceptor.com";

const AVATAR_IMG_SRC_REGEX = /^https:\/\/public\.onlyfans\.com\/files\/thumbs(\/[^\/]+)*\/([0-9]+)\/avatar\.jpg$/;

const createLock = () => {
  const queue = [];
  let active = false;

  return async (fn) => {
    console.log({ queue });

    let deferredResolve;
    let deferredReject;

    const deferred = new Promise((resolve, reject) => {
      deferredResolve = resolve;
      deferredReject = reject;
    });

    const exec = async () => {
      await fn().then(deferredResolve, deferredReject);

      if (queue.length > 0) {
        queue.shift()();
      } else {
        active = false;
      }
    };

    if (active) {
      queue.push(exec);
    } else {
      active = true;
      exec();
    }

    return deferred;
  };
};

const eventQueueLock = createLock();

// inject script
const script = document.createElement("script");
script.src = chrome.runtime.getURL("inject.js");
script.onload = function () {
  this.remove();
};
(document.head || document.documentElement).appendChild(script);

// conversation loaded
document.addEventListener("aiof_messages_received", function (e) {
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

  const formattedMessages = list.map((message) => {
    return {
      id: message.id,
      text: message.text,
      from_user_id: message.fromUser.id,
      sent_at: message.createdAt,
    };
  });

  console.log({ formattedMessages });

  // if (formattedMessages.length > 0) {
  //   postMessages(formattedMessages, creator, consumer)
  //     .then((res) => res.json())
  //     .then((response) => {
  //       if (response?.message === "Success") {
  //         // save most recent message to prevent unnecessary POSTs

  //         if (response.chat_id in CHAT_INFORMATION) {
  //           CHAT_INFORMATION[response.chat_id].oldest_message_id = response.oldest_message_id;
  //           CHAT_INFORMATION[response.chat_id].most_recent_message_id = response.most_recent_message_id;
  //         } else {
  //           CHAT_INFORMATION[response.chat_id] = {
  //             oldest_message_id: response.oldest_message_id,
  //             most_recent_message_id: response.most_recent_message_id,
  //           };
  //         }
  //       }

  //       console.log({ CHAT_INFORMATION });
  //     })
  //     .catch((error) => {
  //       console.log(error);
  //     });
  // }
});

// live message received
document.addEventListener("aiof_new_message_received", function (e) {
  if (!autoReplyEnabled) {
    return;
  }

  const body = JSON.parse(e.detail);

  // const formattedMessages = .map((message) => {

  //   return {
  //     id: message.id,
  //     from_username: message.username,
  //   };
  // });

  eventQueueLock(async () => {
    const updatedChats = Object.values(body);

    for (const updatedChat of updatedChats) {
      const chatLink = document.querySelector(`${CHAT_LIST_ITEM_LINK_IDENT}[href="/my/chats/chat/${updatedChat.id}/"]`);
      chatLink.click();

      await scrapeVisibleConversation();
    }
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
};

const scrapeVisibleConversation = async () => {
  return new Promise((resolve) => {
    const messageWindow = document.querySelector(MESSAGE_WINDOW_IDENT);

    const scrollUpMessageWindow = () => {
      const chatScrollWindow = document.querySelector(CHAT_SCROLLBAR_CONTAINER_IDENT);
      chatScrollWindow.scrollTo({ top: 0, behavior: "smooth" });
    };

    const messageWindowObserver = new MutationObserver(function (mutationsList) {
      mutationsList.forEach(function (mutation) {
        if (mutation.type === "childList") {
          if (mutation.addedNodes.length > 0) {
            // nodes added, scroll again
            setTimeout(() => {
              scrollUpMessageWindow();

              clearTimeout(disconnectMessageObserverTimeout);

              // if nothing happens after 5 seconds disconnect observer
              disconnectMessageObserverTimeout = setTimeout(() => {
                messageWindowObserver.disconnect();
                console.log("Done scraping");
                resolve(true);
              }, 5000);
            }, 1000);
          }
        }
      });
    });

    // if we receive a cancel event (already ingested messages then stop)
    document.addEventListener("aiof_stop_ingesting_messages", function stopIngestingMessagesListener() {
      document.removeEventListener("aiof_stop_ingesting_messages", stopIngestingMessagesListener);

      console.log("Cancel ingest, already have these messages")
      messageWindowObserver.disconnect();
      resolve(true);
    });

    messageWindowObserver.observe(messageWindow, { subtree: true, childList: true });

    scrollUpMessageWindow();

    // if nothing happens after 5 seconds disconnect observer
    disconnectMessageObserverTimeout = setTimeout(() => {
      messageWindowObserver.disconnect();
      console.log("Done scraping");
      resolve(true);
    }, 5000);
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

    await scrapeVisibleConversation();
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
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.command) {
    case "scrape_all_conversations":
      eventQueueLock(async () => {
        scapingMessages = true;
        await scrapeAllConversations();
        scapingMessages = false;
      });

      sendResponse({ message: "received" });
    case "scrape_visible_conversation":
      eventQueueLock(async () => {
        scapingMessages = true;
        await scrapeVisibleConversation();
        scapingMessages = false;
      });

      sendResponse({ message: "received" });
    case "set_auto_reply_enabled":
      setAutoReplyEnabled(request.value);
      sendResponse({ message: "received" });
    default:
      sendResponse({ message: "unrecognised-command" });
  }
});
