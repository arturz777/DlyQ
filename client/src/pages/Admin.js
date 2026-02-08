import React, { useState, useEffect, useContext } from "react";
import { Context } from "../index";
import { fetchDevices } from "../http/deviceAPI";
import { fetchUserChats } from "../http/chatAPI";
import AdminSettings from "../components/AdminSettings";
import AdminOrdersTab from "../components/AdminOrdersTab";
import AdminDevicesTab from "../components/AdminDevicesTab";
import AdminMakesModelsTab from "../components/AdminMakesModelsTab";
import AdminTypesTab from "../components/AdminTypesTab";
import AdminSubtypesTab from "../components/AdminSubtypesTab";
import AdminBrandsTab from "../components/AdminBrandsTab";
import AdminCouriers from "../components/AdminCouriers";
import AdminAccounting from "../components/AdminAccounting";
import AdminSellerPicker from "../components/AdminSellerPicker";
import ChatBox from "../components/ChatBox";
import SellerAdminPage from "./SellerAdminPage";
import { socket } from "../socket";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.css";
import styles from "./Admin.module.css";
import AdminSellersTab from "../components/AdminSellersTab";

const Admin = () => {
  const { user } = useContext(Context);

  const [devices, setDevices] = useState([]);
  const [activeSellerId, setActiveSellerId] = useState(null);
  const [unreadChats, setUnreadChats] = useState(new Set());

  useEffect(() => {
    fetchDevices(undefined, undefined, undefined, 1, 1000)
      .then((data) => setDevices(data.rows || data || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!user?.user?.id) return;

    fetchUserChats(user.user.id)
      .then((data) => {
        const unread = new Set();
        (data || []).forEach((chat) => {
          const hasUnread = chat.messages?.some(
            (msg) => !msg.isRead && msg.senderId !== user.user.id,
          );
          if (hasUnread) unread.add(chat.id);
        });
        setUnreadChats(unread);
      })
      .catch((e) => console.error("fetch chats error:", e));
  }, [user?.user?.id]);

  useEffect(() => {
    const role = String(user?.user?.role || "").toUpperCase();
    if (role !== "ADMIN") return;

    const join = () => {
      socket.emit("joinAdminNotifications");
      console.log("🔔 Админ подключен к admin_notifications");
    };

    join();
    socket.on("connect", join);

    return () => {
      socket.off("connect", join);
    };
  }, [user?.user?.role]);

  return (
    <div className={styles.adminPanelContainer}>
      <Tabs>
        <TabList>
          <Tab>Устройства</Tab>
          <Tab>Типы</Tab>
          <Tab>Марки/Модели</Tab>
          <Tab>Подтипы</Tab>
          <Tab>Бренды</Tab>
          <Tab>Заказы</Tab>
          <Tab>
            Чат поддержки{" "}
            {unreadChats.size > 0 && <span style={{ color: "red" }}>●</span>}
          </Tab>
          <Tab>Бухгалтерия</Tab>
          <Tab>Настройки</Tab>
          <Tab>Курьеры</Tab>
          <Tab>Магазины</Tab>
          <Tab>Меню</Tab>
        </TabList>

        <TabPanel>
          <AdminDevicesTab />
        </TabPanel>

        <TabPanel>
          <AdminTypesTab />
        </TabPanel>

        <TabPanel>
          <AdminMakesModelsTab />
        </TabPanel>

        <TabPanel>
          <AdminSubtypesTab />
        </TabPanel>

        <TabPanel>
          <AdminBrandsTab />
        </TabPanel>

        <TabPanel>
          <AdminOrdersTab />
        </TabPanel>

        <TabPanel>
          <h2>Чат с клиентами</h2>
          <ChatBox
            userId={user.user.id}
            userRole="admin"
            onUnreadChange={(set) => setUnreadChats(set)}
          />
        </TabPanel>

        <TabPanel>
          <AdminAccounting devices={devices} />
        </TabPanel>

        <TabPanel>
          <AdminSettings />
        </TabPanel>

        <TabPanel>
          <AdminCouriers />
        </TabPanel>

        <TabPanel>
          <AdminSellersTab
            activeSellerId={activeSellerId}
            onSelectSeller={setActiveSellerId}
          />
        </TabPanel>

        <TabPanel>
          <div style={{ padding: 12 }}>
            <AdminSellerPicker
              value={activeSellerId}
              onChange={setActiveSellerId}
            />
          </div>

          {activeSellerId ? (
            <SellerAdminPage sellerId={activeSellerId} />
          ) : (
            <div style={{ padding: 12 }}>Выберите магазин</div>
          )}
        </TabPanel>
      </Tabs>
    </div>
  );
};

export default Admin;
