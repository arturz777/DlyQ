import React, { useContext } from "react";
import ChatBox from "../ChatBox";
import { ChatContext } from "../../context/ChatContext";
import { Context } from "../../index";
import styles from "./ChatModal.module.css";

const ChatModal = () => {
  const { supportChatVisible, supportChatId, closeSupportChat } = useContext(ChatContext);
  const { user } = useContext(Context);

 if (!supportChatVisible || !user.user?.id || !user.user?.role) return null;

  return (
    <div className={styles.modalWrapper}>
      <div className={styles.chatContainer}>
        <ChatBox
          userId={user.user.id}
          userRole={user.user.role}
          chatId={supportChatId}
        />
      </div>
    </div>
  );
};

export default ChatModal;
