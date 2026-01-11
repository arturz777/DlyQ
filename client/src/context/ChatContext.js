import { createContext } from "react";

export const ChatContext = createContext({
  chatVisible: false,
  chatId: null,
  chatMode: support | delivery | restaurant,
  openChat: (chatId, mode) => {},
  closeChat: () => {},
});
