import React, { useContext } from "react";
import { ChatContext } from "../context/ChatContext";
import styles from "./ChatFab.module.css";

const ChatFab = () => {
 const { openSupportChat, chatVisible, unreadSupportMsgCount } = useContext(ChatContext);

  if (chatVisible) return null;

  return (
    <button
      type="button"
      className={styles.fab}
      onClick={openSupportChat}
      aria-label="Open chat"
      title="Chat"
    >
      💬
	  {unreadSupportMsgCount > 0 && (
    <span className={styles.badge}>
      {unreadSupportMsgCount > 9 ? "9+" : unreadSupportMsgCount}
    </span>
  )}
    </button>
  );
};

export default ChatFab;
