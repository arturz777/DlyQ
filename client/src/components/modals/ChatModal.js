import React, { useContext } from "react";
import { Link } from "react-router-dom";
import ChatBox from "../ChatBox";
import { ChatContext } from "../../context/ChatContext";
import { Context } from "../../index";
import { useTranslation } from "react-i18next";
import styles from "./ChatModal.module.css";

const ChatModal = () => {
  const { chatVisible, chatId, chatMode, chatHint, closeChat } =
    useContext(ChatContext);
  const { user } = useContext(Context);
  const { t, i18n } = useTranslation();

  if (!chatVisible) return null;

  const isAuthed = !!user.user?.id && !!localStorage.getItem("token");

  return (
    <div className={styles.modalWrapper} onClick={closeChat}>
      <div
        className={styles.chatContainer}
        onClick={(e) => e.stopPropagation()}
      >
        {!isAuthed ? (
          <div className={styles.guestBox}>
            <div className={styles.guestTitle}>
              {t("you are not registered", { ns: "auth" })}
            </div>
            <div className={styles.guestText}>
              {t("log in or sign up to contact support", { ns: "auth" })}
            </div>

            <div className={styles.guestActions}>
              <Link
                to="/login"
                className={styles.guestBtnPrimary}
                onClick={closeChat}
              >
                {t("login", { ns: "auth" })}
              </Link>
              <Link
                to="/registration"
                className={styles.guestBtn}
                onClick={closeChat}
              >
                {t("registration", { ns: "auth" })}
              </Link>
              <button
                className={styles.guestBtn}
                onClick={closeChat}
                type="button"
              >
                {t("close", { ns: "auth" })}
              </button>
            </div>
          </div>
        ) : (
          <ChatBox
            userId={user.user.id}
            userRole={user.user.role}
            chatId={chatId}
            showHistory={chatMode === "support"}
            onClose={closeChat}
            emptyHint={chatHint}
          />
        )}
      </div>
    </div>
  );
};

export default ChatModal;
