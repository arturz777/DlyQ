import React, { useState, useEffect } from "react";
import { View, Text, Button, StyleSheet, Alert, Platform, Dimensions } from "react-native";
import { WebView } from "react-native-webview";
import { fetchActiveOrders, acceptOrder, updateDeliveryStatus, completeDelivery, updateCourierLocation } from "../api/courierAPI";
import { logout } from "../api/authAPI";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");
const WAREHOUSE_LOCATION = { lat: 59.513720, lng: 24.828888 };
const { width, height } = Dimensions.get("window");

const CourierScreen = ({ navigation }) => {
  const [orders, setOrders] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [courierStatus, setCourierStatus] = useState("offline");
  const [region, setRegion] = useState({
    latitude: WAREHOUSE_LOCATION.latitude,
    longitude: WAREHOUSE_LOCATION.longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  useEffect(() => {
    const requestLocationPermission = async () => {
      if (Platform.OS === "android") {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert("Ошибка", "Разрешение на доступ к геолокации отклонено.");
          return;
        }
      }
      Geolocation.getCurrentPosition(
        (position) => {
          setRegion({
            ...region,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => console.error("Ошибка получения геолокации:", error),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    };

    requestLocationPermission();
  }, []);

  // ✅ Функция выхода
  const handleLogout = async () => {
    await logout();
    Alert.alert("Выход", "Вы вышли из системы.");

    // 🔹 `reset()` удаляет текущий стек экранов
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  };

  useEffect(() => {
    loadOrders();
    socket.on("warehouseOrder", (newOrder) => {
      Alert.alert("Новый заказ!", `Заказ №${newOrder.id} добавлен.`);
      setOrders((prevOrders) => [...prevOrders, newOrder]);
    });
    return () => socket.off("warehouseOrder");
  }, []);

  useEffect(() => {
    if (courierStatus === "online") {
      const interval = setInterval(sendLocationUpdate, 10000);
      return () => clearInterval(interval);
    }
  }, [courierStatus]);

  const loadOrders = async () => {
    try {
      const data = await fetchActiveOrders();
      setOrders(data);
    } catch (error) {
      Alert.alert("Ошибка", "Не удалось загрузить заказы");
    }
  };

  const handleAcceptOrder = async (orderId) => {
    try {
      const order = await acceptOrder(orderId);
      setCurrentOrder(order);
    } catch (error) {
      Alert.alert("Ошибка", "Не удалось принять заказ");
    }
  };

  const handleUpdateStatus = async (status) => {
    if (!currentOrder) return;
    try {
      await updateDeliveryStatus(currentOrder.id, status);
      setCurrentOrder({ ...currentOrder, status });
    } catch (error) {
      Alert.alert("Ошибка", "Не удалось обновить статус");
    }
  };

  const handleCompleteOrder = async () => {
    if (!currentOrder) return;
    try {
      await completeDelivery(currentOrder.id);
      setCurrentOrder(null);
      setOrders([]);
    } catch (error) {
      Alert.alert("Ошибка", "Не удалось завершить заказ");
    }
  };

  // ✅ Функция обновления местоположения
  const sendLocationUpdate = async () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            await updateCourierLocation(latitude, longitude);
            console.log(`📍 Новое местоположение: ${latitude}, ${longitude}`);
          } catch (error) {
            console.error("Ошибка обновления местоположения:", error);
          }
        },
        (error) => console.error("Ошибка получения геолокации:", error),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
  };

  return (
    <View style={styles.container}>
      <MapView style={styles.map} region={region} showsUserLocation={true}>
        <Marker coordinate={WAREHOUSE_LOCATION} title="Склад" />
      </MapView>
      {currentOrder ? (
        <View>
          <Text>Текущий заказ: {currentOrder.id}</Text>
          <Text>Статус: {currentOrder.status}</Text>
          <Button title="Забрал заказ" onPress={() => handleUpdateStatus("Picked up")} />
          <Button title="Прибыл к клиенту" onPress={() => handleUpdateStatus("Arrived at destination")} />
          <Button title="Доставлено" onPress={handleCompleteOrder} />
        </View>
      ) : orders.length > 0 ? (
        <Button title="Принять заказ" onPress={() => handleAcceptOrder(orders[0].id)} />
      ) : (
        <Text>Нет активных заказов</Text>
      )}

      {/* ✅ Кнопка выхода */}
      <Button title="🚪 Выйти" onPress={handleLogout} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  webView: {
    width: "100%",
    height: "100%",
  },
  messageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  message: {
    fontSize: 18,
    color: "gray",
  },
});

export default CourierScreen;
