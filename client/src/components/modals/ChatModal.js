import React, { useContext } from "react";
import ChatBox from "../ChatBox";
import { ChatContext } from "../../context/ChatContext";
import { Context } from "../../index";
import styles from "./ChatModal.module.css";

const ChatModal = () => {
  const { chatVisible, chatId, chatMode, closeChat } = useContext(ChatContext);
  const { user } = useContext(Context);

  if (!chatVisible) return null;

  const fallbackUser = {
    id:
      user.user?.id ??
      (localStorage.guestId ||= "guest_" + crypto.randomUUID()),
    role: user.user?.role ?? "guest",
  };

  return (
    <div className={styles.modalWrapper} onClick={closeChat}>
      <div className={styles.chatContainer} onClick={(e) => e.stopPropagation()}>
        <ChatBox
          userId={fallbackUser.id}
          userRole={fallbackUser.role}
          chatId={chatId}
          showHistory={chatMode === "support"}
          onClose={closeChat}
        />
      </div>
    </div>
  );
};

export default ChatModal;
