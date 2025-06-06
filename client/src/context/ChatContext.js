import { createContext } from "react";

export const ChatContext = createContext({
  supportChatVisible: false,
  supportChatId: null,
  openSupportChat: () => {},
  closeSupportChat: () => {},
});
