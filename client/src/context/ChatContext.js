import { createContext } from "react";

export const ChatContext = createContext({
  chatVisible: false,
  chatId: null,
  chatMode: null,
  openChat: (chatId, mode) => {},
  closeChat: () => {},
});
