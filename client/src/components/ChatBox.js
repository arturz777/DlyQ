import React, { useState, useEffect, useContext, useRef, useMemo } from "react";
import { ChatContext } from "../context/ChatContext";
import { normalizeChatRole } from "../utils/chatRoles";
import { socket } from "../socket";
import { useTranslation } from "react-i18next";
import styles from "./ChatBox.module.css";

const API = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const isSupportChat = (chat) => {
  return chat?.type === "support";
};

const getLastTs = (chat) => {
  const msgs = Array.isArray(chat?.messages) ? chat.messages : [];
  const last = msgs[msgs.length - 1] || msgs[0];
  const dt = last?.createdAt || chat?.updatedAt || chat?.createdAt;
  return dt ? new Date(dt).getTime() : 0;
};

const ChatBox = ({
  userId,
  userRole,
  chatId = null,
  forceOpenChatId = null,
  onUnreadChange,
  showHistory = true,
  onClose,
}) => {
  const [activeChatId, setActiveChatId] = useState(chatId || forceOpenChatId);
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [view, setView] = useState("chat");
  const [historyMode, setHistoryMode] = useState("support");
  const [unreadChats, setUnreadChats] = useState(new Set());
  const messagesEndRef = useRef(null);
  const { t, i18n } = useTranslation();

  useEffect(() => {
    if (chatId) {
      setActiveChatId(chatId);
    } else if (forceOpenChatId) {
      setActiveChatId(forceOpenChatId);
    }
  }, [chatId, forceOpenChatId]);

  useEffect(() => {
    if (!showHistory) return;

    const loadChats = () => {
      fetch(`${API}/chat/user/${userId}`, {
        headers: { ...getAuthHeaders() },
      })
        .then((res) => res.json())
        .then((data) => {
          setChats(data);

          const unread = new Set();
          data.forEach((chat) => {
            if (!isSupportChat(chat)) return;

            const hasUnread = chat.messages?.some(
              (msg) => !msg.isRead && msg.senderId !== userId
            );
            if (hasUnread) unread.add(chat.id);
          });

          setUnreadChats(unread);
          if (onUnreadChange) onUnreadChange(unread);
        })
        .catch(console.error);
    };

    loadChats();
  }, [userId, forceOpenChatId, view, showHistory]);

  useEffect(() => {
    if (!activeChatId) return;

    socket.emit("joinChat", { chatId: activeChatId, userId });

    const handleMessage = async (msg) => {
      const chatExists = chats.some((chat) => chat.id === msg.chatId);

      if (!chatExists) {
        try {
          const res = await fetch(`${API}/chat/${msg.chatId}`, {
            headers: { ...getAuthHeaders() },
          });
          const newChat = await res.json();

          if (
            isSupportChat(newChat) &&
            (msg.chatId !== activeChatId || msg.senderId !== userId)
          ) {
            setUnreadChats((prev) => {
              const updated = new Set(prev);
              updated.add(msg.chatId);
              onUnreadChange?.(updated);
              return updated;
            });
          }

          setChats((prev) => [newChat, ...prev]);
          return;
        } catch (err) {
          console.error(t("errorLoadChat", { ns: "chatBox" }), err);
        }
      }

      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat.id === msg.chatId
            ? { ...chat, messages: [...(chat.messages || []), msg] }
            : chat
        )
      );

      if (msg.chatId !== activeChatId || msg.senderId !== userId) {
        const ch = chats.find((c) => c.id === msg.chatId);
        if (isSupportChat(ch)) {
          setUnreadChats((prev) => {
            const updated = new Set(prev);
            updated.add(msg.chatId);
            if (onUnreadChange) onUnreadChange(updated);
            return updated;
          });
        }
      }

      if (msg.chatId === activeChatId) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    socket.on("receiveMessage", handleMessage);

    fetch(`${API}/chat/${activeChatId}/messages`, {
      headers: { ...getAuthHeaders() },
    })
      .then((res) => res.json())
      .then(setMessages)
      .catch(console.error);

    return () => {
      socket.off("receiveMessage", handleMessage);
    };
  }, [activeChatId]);

  useEffect(() => {
    if (userRole?.toLowerCase?.() !== "admin") return;

    socket.emit("joinAdminNotifications");

    const handleNewChatMessage = async (msg) => {
      const exists = chats.some((chat) => chat.id === msg.chatId);

      const addUnreadIfSupport = (chatObj) => {
        if (!isSupportChat(chatObj)) return;
        if (msg.senderId === userId && msg.chatId === activeChatId) return;

        setUnreadChats((prev) => {
          const updated = new Set(prev);
          updated.add(msg.chatId);
          onUnreadChange?.(updated);
          return updated;
        });
      };

      if (!exists) {
        try {
          const res = await fetch(`${API}/chat/${msg.chatId}`, {
            headers: { ...getAuthHeaders() },
          });
          const newChat = await res.json();

          addUnreadIfSupport(newChat);
          setChats((prev) => [newChat, ...prev]);
        } catch (error) {
          console.error(t("errorLoadNewChat", { ns: "chatBox" }), error);
        }
        return;
      }

      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat.id === msg.chatId
            ? { ...chat, messages: [...(chat.messages || []), msg] }
            : chat
        )
      );

      const existingChat = chats.find((c) => c.id === msg.chatId);
      addUnreadIfSupport(existingChat);
    };

    socket.on("newChatMessage", handleNewChatMessage);

    return () => {
      socket.off("newChatMessage", handleNewChatMessage);
    };
  }, [userRole, chats]);

  const getSenderName = (msg) => {
    if (msg.senderId === userId) return t("you", { ns: "chatBox" });
    if (msg.senderRole === "admin") return "Support";

    const chat = chats.find((c) => c.id === msg.chatId);
    const participant = chat?.participants?.find(
      (p) => p.userId === msg.senderId
    );
    return participant?.user?.firstName || msg.senderRole;
  };

  const handleSelectChat = async (id) => {
    setActiveChatId(id);
    setUnreadChats((prev) => {
      const updated = new Set(prev);
      updated.delete(id);
      return updated;
    });
    setView("chat");

    await fetch(`${API}/chat/${id}/mark-read`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ userId }),
    });
    socket.emit("readMessages", { chatId: id, userId });
  };

  const handleSend = async () => {
    if (!text.trim()) return;

    let id = activeChatId;

    if (!id) {
      const res = await fetch(`${API}/chat/support`, {
        method: "GET",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`support chat error: ${res.status}`);
      }

      const data = await res.json();
      id = data.chatId;
      setActiveChatId(id);
    }

    socket.emit("sendMessage", {
      chatId: id,
      senderId: userId,
      senderRole: normalizeChatRole(userRole),
      text: text.trim(),
    });

    setText("");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const visibleHistoryChats = useMemo(() => {
    const base = chats
      .filter((c) => c.messages && c.messages.length > 0)
      .filter((c) =>
        historyMode === "support" ? isSupportChat(c) : !isSupportChat(c)
      );

    return base.sort((a, b) => {
      if (historyMode === "support") {
        const au = unreadChats.has(a.id) ? 1 : 0;
        const bu = unreadChats.has(b.id) ? 1 : 0;
        if (au !== bu) return bu - au;
      }
      return getLastTs(b) - getLastTs(a);
    });
  }, [chats, historyMode, unreadChats]);

  return (
    <div className={styles.chatWrapper}>
      <div className={styles.chatHeader}>
        <div className={styles.headerLeft}>
          {showHistory && (
            <button
              type="button"
              className={styles.headerAction}
              onClick={() => setView(view === "chat" ? "history" : "chat")}
            >
              {view === "chat" ? (
                <>
                  {t("historyLabel", { ns: "chatBox" })}
                  {unreadChats.size > 0 && (
                    <span className={styles.unreadDotButton} />
                  )}
                </>
              ) : (
                t("back", { ns: "chatBox" })
              )}
            </button>
          )}
        </div>

        <div className={styles.headerRight}>
          <button
            className={styles.closeButton}
            onClick={onClose}
            type="button"
          >
            ✖
          </button>
        </div>
      </div>

      {showHistory && view === "history" ? (
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h4 className={styles.sidebarTitle}>
              {t("chatHistoryTitle", { ns: "chatBox" })}
            </h4>

            <div className={styles.segmented}>
              <button
                type="button"
                className={`${styles.segment} ${
                  historyMode === "support" ? styles.segmentActive : ""
                }`}
                onClick={() => setHistoryMode("support")}
              >
                Поддержка
                {unreadChats.size > 0 && <span className={styles.segmentDot} />}
              </button>

              <button
                type="button"
                className={`${styles.segment} ${
                  historyMode === "archive" ? styles.segmentActive : ""
                }`}
                onClick={() => setHistoryMode("archive")}
              >
                Архив
              </button>
            </div>
          </div>

          <div className={styles.historyList}>
            {visibleHistoryChats.map((chat) => (
              <div
                key={chat.id}
                className={`${styles.chatItem} ${
                  chat.id === activeChatId ? styles.active : ""
                }`}
                onClick={() => {
                  handleSelectChat(chat.id);
                  setView("chat");
                }}
                role="button"
                tabIndex={0}
              >
                <div className={styles.chatPreviewWrapper}>
                  <span className={styles.chatPreviewText}>
                    {chat.messages?.length
                      ? chat.messages[chat.messages.length - 1].text
                      : ""}
                  </span>
                  {unreadChats.has(chat.id) && (
                    <span className={styles.unreadDot} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.chatContainer}>
          <div className={styles.messages}>
            {messages.map((msg) => (
              <div
                key={msg.id || `${msg.chatId}-${msg.createdAt}-${msg.senderId}`}
                className={
                  msg.senderId === userId
                    ? styles.messageOutgoing
                    : styles.messageIncoming
                }
              >
                <div className={styles.sender}>{getSenderName(msg)}</div>
                <div className={styles.text}>{msg.text}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className={styles.inputArea}>
            <input
              type="text"
              value={text}
              placeholder={t("messagePlaceholder", { ns: "chatBox" })}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button onClick={handleSend} type="button">
              📨
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBox;
