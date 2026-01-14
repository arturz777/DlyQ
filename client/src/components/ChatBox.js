import React, { useState, useEffect, useContext, useRef, useMemo } from "react";
import { ChatContext } from "../context/ChatContext";
import { normalizeChatRole } from "../utils/chatRoles";
import { socket } from "../socket";
import { useTranslation } from "react-i18next";
import styles from "./ChatBox.module.css";

const API = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");

const isSameMsg = (a, b) => {
  if (!a || !b) return false;
  if (a.id && b.id) return String(a.id) === String(b.id);
  return (
    String(a.chatId) === String(b.chatId) &&
    String(a.senderId) === String(b.senderId) &&
    String(a.createdAt) === String(b.createdAt) &&
    String(a.text) === String(b.text)
  );
};

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
  const chatsRef = useRef([]);
  const activeChatIdRef = useRef(activeChatId);
  const didAutoSelectRef = useRef(false);
  const { t, i18n } = useTranslation();

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  const isAdmin = String(userRole || "").toLowerCase() === "admin";
  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) || null,
    [chats, activeChatId]
  );

  const isClosed = Boolean(activeChat?.closedAt);
  const canClose = isAdmin && isSupportChat(activeChat) && !isClosed;

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

          if (!didAutoSelectRef.current && !chatId && !forceOpenChatId) {
            const currentActive = activeChatIdRef.current;

            if (!currentActive && Array.isArray(data) && data.length > 0) {
              const sorted = [...data].sort(
                (a, b) => getLastTs(b) - getLastTs(a)
              );
              const lastChat = sorted[0];

              if (lastChat?.id) {
                didAutoSelectRef.current = true;
                setActiveChatId(lastChat.id);
                setView("chat");
              }
            }
          }

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
      const currentActiveChatId = activeChatIdRef.current;

      const currentChats = chatsRef.current || [];
      let chatObj = currentChats.find((c) => c.id === msg.chatId) || null;

      if (!chatObj) {
        try {
          const res = await fetch(`${API}/chat/${msg.chatId}`, {
            headers: { ...getAuthHeaders() },
          });
          const newChat = await res.json();
          chatObj = newChat;

          setChats((prev) =>
            prev.some((c) => c.id === newChat.id) ? prev : [newChat, ...prev]
          );
        } catch (err) {
          console.error(t("errorLoadChat", { ns: "chatBox" }), err);
        }
      } else {
        setChats((prevChats) =>
          prevChats.map((chat) => {
            if (chat.id !== msg.chatId) return chat;

            const prevMsgs = chat.messages || [];
            if (prevMsgs.some((m) => isSameMsg(m, msg))) return chat;

            return { ...chat, messages: [...prevMsgs, msg] };
          })
        );
      }

      if (
        chatObj &&
        isSupportChat(chatObj) &&
        (msg.chatId !== currentActiveChatId || msg.senderId !== userId)
      ) {
        setUnreadChats((prev) => {
          const updated = new Set(prev);
          updated.add(msg.chatId);
          onUnreadChange?.(updated);
          return updated;
        });
      }

      if (msg.chatId === currentActiveChatId) {
        setMessages((prev) =>
          prev.some((m) => isSameMsg(m, msg)) ? prev : [...prev, msg]
        );
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
  }, [activeChatId, userId]);

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

  useEffect(() => {
    const onChatClosed = ({ chatId, closedAt }) => {
      const ts = closedAt
        ? new Date(closedAt).toISOString()
        : new Date().toISOString();

      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, closedAt: ts } : c))
      );
    };

    socket.on("chatClosed", onChatClosed);
    return () => socket.off("chatClosed", onChatClosed);
  }, [activeChatId]);

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
    if (isClosed) return;
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
      socket.emit("joinChat", { chatId: id, userId });
    }

    socket.emit("sendMessage", {
      chatId: id,
      senderId: userId,
      senderRole: normalizeChatRole(userRole),
      text: text.trim(),
    });

    setText("");
  };

  const handleCloseChat = () => {
    if (!activeChatId) return;
    socket.emit("closeChat", { chatId: activeChatId, senderId: userId });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const visibleHistoryChats = useMemo(() => {
    const mode = isAdmin ? historyMode : "support";

    const base = chats
      .filter((c) => c.messages && c.messages.length > 0)
      .filter((c) =>
        mode === "support" ? isSupportChat(c) : !isSupportChat(c)
      );

    return base.sort((a, b) => {
      if (mode === "support") {
        const au = unreadChats.has(a.id) ? 1 : 0;
        const bu = unreadChats.has(b.id) ? 1 : 0;
        if (au !== bu) return bu - au;
      }
      return getLastTs(b) - getLastTs(a);
    });
  }, [chats, historyMode, unreadChats, isAdmin]);

  useEffect(() => {
    if (!isAdmin && historyMode !== "support") setHistoryMode("support");
  }, [isAdmin, historyMode]);

  const mode = isAdmin ? historyMode : "support";

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
          {canClose && (
            <button
              type="button"
              className={styles.headerAction}
              onClick={handleCloseChat}
              title="Закрыть чат"
            >
              Закрыть чат
            </button>
          )}

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
              {mode === "support" && unreadChats.size > 0 && (
                <span className={styles.unreadDotButton} />
              )}
            </h4>

            {isAdmin && (
              <button
                type="button"
                className={`${styles.headerAction} ${
                  mode === "archive" ? styles.segmentActive : ""
                }`}
                onClick={() =>
                  setHistoryMode((prev) =>
                    prev === "archive" ? "support" : "archive"
                  )
                }
                title={
                  mode === "archive" ? "Вернуться к поддержке" : "Открыть архив"
                }
              >
                Архив
              </button>
            )}
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
            {messages.map((msg) => {
              const isSystem = msg.senderRole === "system";

              return (
                <div
                  key={
                    msg.id || `${msg.chatId}-${msg.createdAt}-${msg.senderId}`
                  }
                  className={
                    isSystem
                      ? styles.messageSystem
                      : msg.senderId === userId
                      ? styles.messageOutgoing
                      : styles.messageIncoming
                  }
                >
                  {!isSystem && (
                    <div className={styles.sender}>{getSenderName(msg)}</div>
                  )}
                  <div className={styles.text}>{msg.text}</div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          {isClosed ? (
            <div className={styles.closedNotice}>
              Этот чат поддержки закрыт.
              {!isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveChatId(null);
                    setMessages([]);
                    setText("");
                    setView("chat");
                  }}
                  className={styles.newChatButton}
                >
                  Новый чат
                </button>
              )}
            </div>
          ) : (
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
          )}
        </div>
      )}
    </div>
  );
};

export default ChatBox;
