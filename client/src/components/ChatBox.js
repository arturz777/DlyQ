import React, { useState, useEffect, useContext } from "react";
import { ChatContext } from "../context/ChatContext";
import { normalizeChatRole } from "../utils/chatRoles";
import { io } from "socket.io-client";
import styles from "./ChatBox.module.css";

const socket = io("https://zang-4.onrender.com", {
  withCredentials: true,
  transports: ["websocket", "polling"]
});

const ChatBox = ({
  userId,
  userRole,
  forceOpenChatId = null,
  chatId = null,
  onUnreadChange,
}) => {
  const [activeChatId, setActiveChatId] = useState(chatId || forceOpenChatId);
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [view, setView] = useState("chat");
  const { closeSupportChat } = useContext(ChatContext);
  const [unreadChats, setUnreadChats] = useState(new Set());

  useEffect(() => {
    if (chatId) {
      setActiveChatId(chatId);
    } else if (forceOpenChatId) {
      setActiveChatId(forceOpenChatId);
    }
  }, [chatId, forceOpenChatId]);

  useEffect(() => {
    const loadChats = () => {
      fetch(`https://zang-4.onrender.com/api/chat/user/${userId}`)
        .then((res) => res.json())
        .then((data) => {
          setChats(data);

          const unread = new Set();
          data.forEach((chat) => {
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
  }, [userId, forceOpenChatId, view]);

  useEffect(() => {
    if (!activeChatId) return;

    socket.emit("joinChat", activeChatId);

    const handleMessage = async (msg) => {
      const chatExists = chats.some((chat) => chat.id === msg.chatId);

      if (!chatExists) {
        try {
          const res = await fetch(
            `https://zang-4.onrender.com/api/chat/${msg.chatId}`
          );
          const newChat = await res.json();
          setChats((prev) => [newChat, ...prev]);
        } catch (err) {
          console.error("❌ Ошибка при загрузке чата:", err);
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
        setUnreadChats((prev) => {
          const updated = new Set(prev);
          updated.add(msg.chatId);
          return updated;
        });
      }

      if (msg.chatId === activeChatId) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    socket.on("receiveMessage", handleMessage);

    fetch(`https://zang-4.onrender.com/api/chat/${activeChatId}/messages`)
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

      if (!exists) {
        try {
          const res = await fetch(
            `https://zang-4.onrender.com/api/chat/${msg.chatId}`
          );
          const newChat = await res.json();

          setChats((prev) => [newChat, ...prev]);
        } catch (error) {
          console.error("❌ Ошибка при загрузке нового чата:", error);
        }
      } else {
        setChats((prevChats) =>
          prevChats.map((chat) =>
            chat.id === msg.chatId
              ? { ...chat, messages: [...(chat.messages || []), msg] }
              : chat
          )
        );
      }

      setUnreadChats((prev) => {
        const updated = new Set(prev);
        updated.add(msg.chatId);
        return updated;
      });
    };

    socket.on("newChatMessage", handleNewChatMessage);

    return () => {
      socket.off("newChatMessage", handleNewChatMessage);
    };
  }, [userRole]);

  const getSenderName = (msg) => {
    if (msg.senderId === userId) return "Вы";
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

    await fetch(`https://zang-4.onrender.com/api/chat/${id}/mark-read`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    socket.emit("readMessages", { chatId: id, userId });
  };
  

  const handleSend = async () => {
    if (!text.trim()) return;

    let chatId = activeChatId;

    const normalizedRole = ["client", "courier", "warehouse", "admin"].includes(
      userRole?.toLowerCase?.()
    )
      ? userRole.toLowerCase()
      : "client";

    if (!chatId) {
      const res = await fetch(`https://zang-4.onrender.com/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "support",
          participants: [
            {
              userId,
              role: normalizeChatRole(userRole),
            },
            { userId: 1, role: "admin" },
          ],
        }),
      });
      const chat = await res.json();
      chatId = chat.id;
      setChats((prev) => [chat, ...prev]);
      setActiveChatId(chatId);
    }

    const newMessage = {
      chatId,
      senderId: userId,
      senderRole: normalizeChatRole(userRole),
      text,
      createdAt: new Date().toISOString(),
      isRead: false,
    };

    socket.emit("sendMessage", newMessage);
    setText("");
  };

  return (
    <div className={styles.chatWrapper}>
      <div className={styles.chatHeader}>
        <button className={styles.closeButton} onClick={closeSupportChat}>
          ✖
        </button>
      </div>

      <button onClick={() => setView(view === "chat" ? "history" : "chat")}>
        {view === "chat" ? (
          <>
            📂 История{" "}
            {unreadChats.size > 0 && (
              <span className={styles.unreadDotButton} />
            )}
          </>
        ) : (
          "⬅️ Назад"
        )}
      </button>

      {view === "history" ? (
        <div className={styles.sidebar}>
          <h4>История чатов</h4>
          {chats
            .filter((chat) => chat.messages && chat.messages.length > 0)
            .map((chat) => (
              <div
                key={chat.id}
                className={`${styles.chatItem} ${
                  chat.id === activeChatId ? styles.active : ""
                }`}
                onClick={() => {
                  handleSelectChat(chat.id);
                  setView("chat");
                }}
              >
                <div className={styles.chatPreviewWrapper}>
                  <span className={styles.chatPreviewText}>
                    {chat.messages.length > 0 && chat.messages[0].text}
                  </span>
                  {unreadChats.has(chat.id) && (
                    <span className={styles.unreadDot} />
                  )}
                </div>
              </div>
            ))}
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
          </div>
          <div className={styles.inputArea}>
            <input
              type="text"
              value={text}
              placeholder="Введите сообщение..."
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button onClick={handleSend}>📨</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBox;
