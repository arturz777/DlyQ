import { createContext } from "react";

export const ChatContext = createContext({
  chatVisible: false,
  chatId: null,
  chatMode: null,
  chatHint: null,
  openChat: (chatId, mode, hint) => {},
  closeChat: () => {},
});
