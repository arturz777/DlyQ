import React, { useContext, useEffect, useRef } from "react";
import { ChatContext } from "../context/ChatContext";
import { Context } from "../index";
import { socket } from "../socket";

const API = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const ChatNotifier = () => {
  const { user } = useContext(Context);
  const { chatVisible, setUnreadSupportMsgCount } = useContext(ChatContext);

  const userId = user.user?.id;
  const isAuthed = !!userId && !!localStorage.getItem("token");

  const role = String(user.user?.role || "").toLowerCase();
  const isAdmin = role === "admin";

  useEffect(() => {
    if (!isAuthed || !isAdmin) return;

    const syncAdminUnread = async () => {
      try {
        const res = await fetch(`${API}/chat/user/${userId}`, {
          headers: { ...getAuthHeaders() },
        });
        const chats = await res.json();

        let cnt = 0;
        (chats || []).forEach((c) => {
          if (c?.type !== "support") return;
          const msgs = Array.isArray(c.messages) ? c.messages : [];
          const hasUnread = msgs.some(
            (m) => !m.isRead && String(m.senderId) !== String(userId)
          );
          if (hasUnread) cnt += 1;
        });

        setUnreadSupportMsgCount(Math.min(cnt, 99));
      } catch (e) {
        console.error(e);
      }
    };

    const join = () => socket.emit("joinAdminNotifications");
    join();
    socket.on("connect", join);

    syncAdminUnread();

    let t = null;
    const scheduleSync = () => {
      clearTimeout(t);
      t = setTimeout(syncAdminUnread, 200);
    };

    const onAdminMsg = (msg) => {
      scheduleSync();
    };

    socket.on("newChatMessage", onAdminMsg);

    return () => {
      clearTimeout(t);
      socket.off("newChatMessage", onAdminMsg);
      socket.off("connect", join);
    };
  }, [isAuthed, isAdmin, userId, chatVisible, setUnreadSupportMsgCount]);

  const supportChatIdRef = useRef(null);
  const joinedChatIdRef = useRef(null);

  const joinSupportRoom = (chatId) => {
    if (!chatId) return;
    if (String(joinedChatIdRef.current) === String(chatId)) return;
    joinedChatIdRef.current = chatId;
    socket.emit("joinChat", { chatId, userId });
  };

  const syncUnreadFromServer = async (chatId) => {
    const res = await fetch(`${API}/chat/${chatId}/messages`, {
      headers: { ...getAuthHeaders() },
    });
    const msgs = await res.json();

    const count = (Array.isArray(msgs) ? msgs : []).filter(
      (m) => !m.isRead && String(m.senderId) !== String(userId)
    ).length;

    setUnreadSupportMsgCount(count);
  };

  const initSupport = async () => {
    const res = await fetch(`${API}/chat/support`, {
      method: "GET",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    });
    if (!res.ok) return;

    const data = await res.json();
    const chatId = data?.chatId;
    if (!chatId) return;

    supportChatIdRef.current = chatId;
    joinSupportRoom(chatId);
    await syncUnreadFromServer(chatId);
  };

  useEffect(() => {
    if (!isAuthed || isAdmin) return;

    const onConnect = () => {
      const chatId = supportChatIdRef.current;
      if (chatId) joinSupportRoom(chatId);
    };
    socket.on("connect", onConnect);

    initSupport().catch(console.error);

    const id = setInterval(() => {
      if (!chatVisible) initSupport().catch(() => {});
    }, 30000);

    return () => {
      clearInterval(id);
      socket.off("connect", onConnect);
    };
  }, [isAuthed, isAdmin, userId, chatVisible]);

  useEffect(() => {
    if (!isAuthed || isAdmin) return;

    const onReceive = (msg) => {
      if (chatVisible) return;
      if (!supportChatIdRef.current) return;
      if (String(msg.chatId) !== String(supportChatIdRef.current)) return;
      if (String(msg.senderId) === String(userId)) return;

      setUnreadSupportMsgCount((prev) => Math.min(prev + 1, 99));
    };

    socket.on("receiveMessage", onReceive);
    return () => socket.off("receiveMessage", onReceive);
  }, [isAuthed, isAdmin, userId, chatVisible, setUnreadSupportMsgCount]);

  return null;
};

export default ChatNotifier;
