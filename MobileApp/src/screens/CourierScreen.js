import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  PanResponder,
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import {Audio} from 'expo-av';
import * as Haptics from 'expo-haptics';
import {WebView} from 'react-native-webview';
import {CommonActions} from '@react-navigation/native';
import * as Location from 'expo-location';
import {io} from 'socket.io-client';
import {SOCKET_URL, SOCKET_PATH} from '../config/api';
import {
  fetchActiveOrders,
  acceptOrder,
  toggleCourierStatus,
  updateDeliveryStatus,
  completeDelivery,
  updateCourierLocation,
  fetchCourierSelf,
  savePushToken,
} from '../api/courierAPI';
import {logout} from '../api/authAPI';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import {Platform} from 'react-native';

const WAREHOUSE_LOCATION = {lat: 59.51372, lng: 24.828888};
const SLIDE_WIDTH = 280;
const SLIDE_KNOB = 48;

async function registerForPushNotificationsAsync() {
  let token;

  if (!Constants.isDevice) {
    console.log('Push уведомления работают только на реальном устройстве');
    return null;
  }

  const {status: existingStatus} = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const {status} = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    Alert.alert('Уведомления', 'Разрешите уведомления, чтобы получать заказы.');
    return null;
  }

  // Получаем Expo push token
  const pushTokenData = await Notifications.getExpoPushTokenAsync();
  token = pushTokenData.data;

  // Для Android настраиваем канал, чтобы был звук и приоритет
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
    });
  }

  return token;
}

const leafletHtml = center => `
<!DOCTYPE html><html><head>
<meta name="viewport" content="initial-scale=1, width=device-width" />
<link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>
<style>
  html,body,#map{height:100%;margin:0;padding:0}
  .leaflet-control-attribution{font-size:11px}
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
<script>
 const map = L.map('map', { zoomControl: false }).setView([${center.lat},${center.lng}], 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19, attribution:'&copy; OpenStreetMap'}).addTo(map);

  const markers = {};
  const polylines = {};

  function ensureMarker(key, lat, lng, label){
    if(markers[key]){ markers[key].setLatLng([lat,lng]); return; }
    const m = L.marker([lat,lng]).addTo(map);
    if(label) m.bindPopup(label);
    markers[key] = m;
  }
  function removeMarker(key){
    if(markers[key]){ map.removeLayer(markers[key]); delete markers[key]; }
  }

  function setUser(lat,lng){ ensureMarker('user', lat, lng, 'Вы'); }
  function setWarehouse(lat,lng){ ensureMarker('warehouse', lat, lng, '📦 Склад'); }
  function setOrder(id, lat, lng){ ensureMarker('order_'+id, lat, lng, 'Заказ '+id); }
  function clearOrder(id){ removeMarker('order_'+id); }

  function fitToAll(){
    const list = Object.values(markers);
    if(!list.length) return;
    const group = L.featureGroup(list);
    try { map.fitBounds(group.getBounds().pad(0.2)); } catch(e){}
  }

  function drawRoute(id, coords){
    const key = 'route_'+id;
    if(polylines[key]){ map.removeLayer(polylines[key]); delete polylines[key]; }
    if(!Array.isArray(coords) || !coords.length) return;
    polylines[key] = L.polyline(coords, { weight: 4 }).addTo(map);
  }
  function clearRoute(id){
    const key = 'route_'+id;
    if(polylines[key]){ map.removeLayer(polylines[key]); delete polylines[key]; }
  }

  setWarehouse(${WAREHOUSE_LOCATION.lat}, ${WAREHOUSE_LOCATION.lng});

  document.addEventListener('message', (e)=>{
    try{
      const m = JSON.parse(e.data);
      if(m.type==='setUser') setUser(m.lat, m.lng);
      if(m.type==='setOrder') setOrder(m.id, m.lat, m.lng);
      if(m.type==='clearOrder') clearOrder(m.id);
      if(m.type==='route') drawRoute(m.id, m.coords);
      if(m.type==='clearRoute') clearRoute(m.id);
      if(m.type==='fit') fitToAll();
    }catch(_){}
  });
</script>
</body></html>
`;

function SlideAction({label, onComplete, disabled, danger = false}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [done, setDone] = useState(false);

  const labelOpacity = translateX.interpolate({
    inputRange: [0, SLIDE_WIDTH - SLIDE_KNOB - 4],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => !disabled && !done,
      onPanResponderMove: (_, gesture) => {
        if (disabled || done) return;
        const x = Math.min(
          Math.max(0, gesture.dx),
          SLIDE_WIDTH - SLIDE_KNOB - 4,
        );
        translateX.setValue(x);
      },
      onPanResponderRelease: (_, gesture) => {
        if (disabled || done) return;
        const successPoint = SLIDE_WIDTH * 0.6;
        if (gesture.dx > successPoint) {
          Animated.timing(translateX, {
            toValue: SLIDE_WIDTH - SLIDE_KNOB - 4,
            duration: 120,
            useNativeDriver: false,
          }).start(() => {
            setDone(true);
            onComplete && onComplete();
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        }
      },
    }),
  ).current;

  return (
    <View style={slideStyles.container}>
      <Animated.View
        pointerEvents="none"
        style={[
          slideStyles.cover,
          {
            width: Animated.add(translateX, SLIDE_KNOB),
          },
        ]}
      />

      <Animated.Text
        style={[slideStyles.label, {opacity: done ? 0 : labelOpacity}]}>
        {label}
      </Animated.Text>

      <Animated.View
        style={[
          slideStyles.knob,
          {backgroundColor: danger ? '#ef4444' : '#22c55e'},
          {transform: [{translateX}]},
          disabled || done ? {backgroundColor: '#9ca3af'} : null,
        ]}
        {...panResponder.panHandlers}>
        <Text style={slideStyles.knobText}>{'>'}</Text>
      </Animated.View>
    </View>
  );
}

const slideStyles = StyleSheet.create({
  container: {
    width: SLIDE_WIDTH,
    height: 50,
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cover: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#e5e7eb',
  },
  label: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    color: '#111827',
    fontWeight: '600',
  },
  knob: {
    width: SLIDE_KNOB,
    height: 42,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  knobText: {
    color: '#fff',
    fontSize: 18,
  },
});

export default function CourierScreen({navigation}) {
  const webRef = useRef(null);
  const lastPosRef = useRef(null);
  const ringRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [courierStatus, setCourierStatus] = useState('offline');
  const [orders, setOrders] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [webReady, setWebReady] = useState(false);
  const prevOrdersCountRef = useRef(0);

  const socket = useMemo(
    () =>
      io(SOCKET_URL, {
        path: SOCKET_PATH,
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        timeout: 10000,
      }),
    [],
  );

  const loadOrdersOnce = async () => {
    try {
      const data = await fetchActiveOrders();
      const list = data || [];

      if (!list.length) {
        setOrders([]);
        setCurrentOrder(null);
        return;
      }

      // Ищем заказ, который уже назначен этому курьеру
      const assigned = list.find(o => o.courierId != null);

      if (assigned) {
        setCurrentOrder(assigned);

        // Остальные — свободные заказы (без курьера)
        const free = list.filter(
          o => o.id !== assigned.id && o.courierId == null,
        );
        setOrders(free);

        if (
          webReady &&
          assigned.deliveryLat != null &&
          assigned.deliveryLng != null
        ) {
          webRef.current?.postMessage(
            JSON.stringify({
              type: 'setOrder',
              id: assigned.id,
              lat: assigned.deliveryLat,
              lng: assigned.deliveryLng,
            }),
          );
          webRef.current?.postMessage(JSON.stringify({type: 'fit'}));
        }
      } else {
        // Нет назначенного заказа — просто кладём все как свободные
        setOrders(list);

        const first = list[0];
        if (
          webReady &&
          first?.deliveryLat != null &&
          first?.deliveryLng != null
        ) {
          webRef.current?.postMessage(
            JSON.stringify({
              type: 'setOrder',
              id: first.id,
              lat: first.deliveryLat,
              lng: first.deliveryLng,
            }),
          );
          webRef.current?.postMessage(JSON.stringify({type: 'fit'}));
        }
      }
    } catch (e) {
      console.log('orders error:', e?.message || e);
    }
  };

  const startRinging = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      if (ringRef.current) {
        await ringRef.current.setPositionAsync(0);
        await ringRef.current.setIsLoopingAsync(true);
        await ringRef.current.playAsync();
      }
    } catch (e) {
      console.log('startRinging error:', e);
    }
  };

  const stopRinging = async () => {
    try {
      if (ringRef.current) {
        await ringRef.current.stopAsync();
        await ringRef.current.setIsLoopingAsync(false);
        await ringRef.current.setPositionAsync(0);
      }
    } catch (e) {
      console.log('stopRinging error:', e);
    }
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        const {sound} = await Audio.Sound.createAsync(
          require('../../assets/sounds/order_alert.wav'),
          {volume: 1.0, isLooping: true},
        );

        if (mounted) {
          ringRef.current = sound;
        }
      } catch (e) {
        console.log('audio init error:', e);
      }
    })();

    return () => {
      mounted = false;
      if (ringRef.current) {
        ringRef.current.unloadAsync();
        ringRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        try {
          const self = await fetchCourierSelf();
          if (mounted && self?.status) {
            setCourierStatus(self.status);
          }
        } catch (e) {
          console.log('self courier error:', e?.message || e);
        }

        const {status} = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Ошибка', 'Разрешение на геолокацию отклонено.');
          return;
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!mounted) return;

        lastPosRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        await loadOrdersOnce();
      } catch (e) {
        console.log('init error:', e?.message || e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (mounted && token) {
          await savePushToken(token);
          console.log('Expo push token сохранён:', token);
        }
      } catch (e) {
        console.log('push token error:', e?.message || e);
      }
    })();

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      response => {},
    );

    return () => {
      mounted = false;
      responseSub?.remove();
    };
  }, []);

  useEffect(() => {
    if (!webReady || !lastPosRef.current) return;
    const {lat, lng} = lastPosRef.current;
    webRef.current?.postMessage(JSON.stringify({type: 'setUser', lat, lng}));
    webRef.current?.postMessage(JSON.stringify({type: 'fit'}));
  }, [webReady]);

  useEffect(() => {
    const onWarehouseOrder = newOrder => {
      startRinging();
      Alert.alert('Новый заказ!', `Заказ №${newOrder.id} добавлен.`);
      setOrders(prev => [...prev, newOrder]);
      if (
        webReady &&
        newOrder?.deliveryLat != null &&
        newOrder?.deliveryLng != null
      ) {
        webRef.current?.postMessage(
          JSON.stringify({
            type: 'setOrder',
            id: newOrder.id,
            lat: newOrder.deliveryLat,
            lng: newOrder.deliveryLng,
          }),
        );
      }
    };
    const onOrderReady = updatedOrder => {
      setCurrentOrder(cur =>
        cur && updatedOrder.id === cur.id ? updatedOrder : cur,
      );
    };
    const onOrderStatusUpdate = updatedOrder => {
      setCurrentOrder(cur =>
        cur && updatedOrder.id === cur.id ? updatedOrder : cur,
      );
    };

    socket.on('warehouseOrder', onWarehouseOrder);
    socket.on('orderReady', onOrderReady);
    socket.on('orderStatusUpdate', onOrderStatusUpdate);

    return () => {
      socket.off('warehouseOrder', onWarehouseOrder);
      socket.off('orderReady', onOrderReady);
      socket.off('orderStatusUpdate', onOrderStatusUpdate);
    };
  }, [socket, webReady]);

  useEffect(() => {
    return () => {
      try {
        socket.removeAllListeners();
        socket.disconnect();
      } catch {}
    };
  }, [socket]);

  useEffect(() => {
    if (courierStatus !== 'online') {
      prevOrdersCountRef.current = orders.length;
      return;
    }

    if (orders.length > prevOrdersCountRef.current) {
      startRinging();
    }

    prevOrdersCountRef.current = orders.length;
  }, [orders.length, courierStatus]);

  useEffect(() => {
    if (courierStatus !== 'online') return;
    let stopped = false;

    const tick = async () => {
      try {
        const p = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (stopped) return;
        const {latitude, longitude} = p.coords;
        lastPosRef.current = {lat: latitude, lng: longitude};
        await updateCourierLocation(latitude, longitude);
        if (webReady) {
          webRef.current?.postMessage(
            JSON.stringify({type: 'setUser', lat: latitude, lng: longitude}),
          );
        }
      } catch (e) {
        console.log('geo update error:', e?.message || e);
      }
    };

    tick();
    const id = setInterval(tick, 10000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [courierStatus, webReady]);

  const handleToggleStatus = async () => {
    try {
      const next = courierStatus === 'online' ? 'offline' : 'online';
      await toggleCourierStatus(next);
      setCourierStatus(next);
      if (next === 'online') {
        await loadOrdersOnce();
      } else {
        stopRinging();
        setOrders([]);
      }
    } catch (e) {
      const code = e?.response?.status;
      const msg = e?.response?.data?.message;
      if (code === 404) {
        Alert.alert(
          'Курьер не найден',
          'Создай запись курьера в базе с id = id пользователя из токена.',
        );
      } else if (code === 401) {
        Alert.alert('Авторизация', 'Сессия истекла. Войдите заново.');
        navigation.replace('Login');
      } else {
        Alert.alert('Ошибка', msg || 'Не удалось изменить статус.');
      }
    }
  };

  const handleAcceptOrder = async orderId => {
    try {
      const o = await acceptOrder(orderId);
      stopRinging();
      setCurrentOrder(o);
      if (o?.deliveryLat && o?.deliveryLng) {
        await drawRouteFromWarehouse(o.id, WAREHOUSE_LOCATION, {
          lat: o.deliveryLat,
          lng: o.deliveryLng,
        });
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось принять заказ');
    }
  };

  const handleUpdateStatus = async st => {
    if (!currentOrder) return;
    try {
      await updateDeliveryStatus(currentOrder.id, st);
      setCurrentOrder(c => (c ? {...c, status: st} : c));
    } catch {
      Alert.alert('Ошибка', 'Не удалось обновить статус');
    }
  };

  const handleCompleteDelivery = async () => {
    if (!currentOrder) return;
    try {
      await completeDelivery(currentOrder.id);
      if (webReady) {
        webRef.current?.postMessage(
          JSON.stringify({type: 'clearOrder', id: currentOrder.id}),
        );
        webRef.current?.postMessage(
          JSON.stringify({type: 'clearRoute', id: currentOrder.id}),
        );
      }
      setCurrentOrder(null);
      setOrders([]);
    } catch {
      Alert.alert('Ошибка', 'Не удалось завершить заказ');
    }
  };

  const drawRouteFromWarehouse = async (id, start, end) => {
    if (!start?.lat || !start?.lng || !end?.lat || !end?.lng) return;
    try {
      const API_KEY =
        '5b3ce3597851110001cf624889e39f2834a84a62aaca04f731838a64';
      const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${API_KEY}&start=${start.lng},${start.lat}&end=${end.lng},${end.lat}`;
      const res = await fetch(url);
      const data = await res.json();
      const coords =
        data?.features?.[0]?.geometry?.coordinates?.map(c => [c[1], c[0]]) ||
        [];
      if (webReady) {
        webRef.current?.postMessage(
          JSON.stringify({type: 'route', id, coords}),
        );
        webRef.current?.postMessage(JSON.stringify({type: 'fit'}));
      }
    } catch (e) {
      console.log('route error:', e?.message || e);
    }
  };

  const openExternalRoute = () => {
    const o = currentOrder;
    if (o?.deliveryLat && o?.deliveryLng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${o.deliveryLat},${o.deliveryLng}`;
      Linking.openURL(url).catch(() => {});
    }
  };

  const handleLogout = async () => {
    try {
      await toggleCourierStatus('offline');
    } catch {}
    try {
      socket.removeAllListeners();
      socket.disconnect();
    } catch {}
    await logout();
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{name: 'Login'}],
      }),
    );
  };

  const firstOrder = orders[0] || null;

  const formatCourierFee = order => {
    if (!order || order.courierFee == null) return '';
    const value = Number(order.courierFee);
    if (Number.isNaN(value)) return '';
    return `${value.toFixed(2)} €`;
  };

  return (
    <View style={styles.root}>
      <WebView
        ref={webRef}
        source={{
          html: leafletHtml({
            lat: WAREHOUSE_LOCATION.lat,
            lng: WAREHOUSE_LOCATION.lng,
          }),
        }}
        style={styles.map}
        originWhitelist={['*']}
        onLoad={() => setWebReady(true)}
      />

      <TouchableOpacity style={styles.burger} onPress={() => setMenuOpen(true)}>
        <Text style={styles.burgerText}>☰</Text>
      </TouchableOpacity>

      {currentOrder?.deliveryLat && currentOrder?.deliveryLng && (
        <TouchableOpacity style={styles.mapBtn} onPress={openExternalRoute}>
          <Text style={styles.mapBtnIcon}>🗺️</Text>
        </TouchableOpacity>
      )}

      <View style={styles.bottomBar}>
        {courierStatus === 'online' && !currentOrder && !firstOrder && (
          <Text style={styles.infoText}>🔎 Поиск заказа...</Text>
        )}

        <View style={styles.centerControls}>
          {courierStatus === 'offline' && (
            <SlideAction
              label="🟢 Выйти в онлайн"
              onComplete={handleToggleStatus}
            />
          )}

          {courierStatus === 'online' && !currentOrder && firstOrder && (
            <SlideAction
              label={(() => {
                const price = formatCourierFee(firstOrder);
                return `✅ Принять заказ${price ? ` • ${price}` : ''}`;
              })()}
              onComplete={() => handleAcceptOrder(firstOrder.id)}
            />
          )}

          {courierStatus === 'online' && !currentOrder && !firstOrder && (
            <SlideAction
              label="🔴 Выйти в оффлайн"
              onComplete={handleToggleStatus}
              danger
            />
          )}

          {courierStatus === 'online' && currentOrder && (
            <>
              <Text style={styles.orderAddr} numberOfLines={1}>
                📍 {currentOrder.deliveryAddress}
              </Text>

              {currentOrder.status === 'Waiting for courier' && (
                <Text style={styles.infoText}>⏳ Заказ готовится...</Text>
              )}

              {currentOrder.status === 'Ready for pickup' && (
                <SlideAction
                  label="📦 Забрал заказ"
                  onComplete={() => handleUpdateStatus('Picked up')}
                />
              )}

              {currentOrder.status === 'Picked up' && (
                <SlideAction
                  label="📍 Прибыл к клиенту"
                  onComplete={() =>
                    handleUpdateStatus('Arrived at destination')
                  }
                />
              )}

              {currentOrder.status === 'Arrived at destination' && (
                <SlideAction
                  label="✅ Доставлено"
                  onComplete={handleCompleteDelivery}
                />
              )}
            </>
          )}
        </View>
      </View>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.overlay} onTouchEnd={() => setMenuOpen(false)}>
          <View style={styles.menu} onStartShouldSetResponder={() => true}>
            <TouchableOpacity
              style={styles.menuClose}
              onPress={() => setMenuOpen(false)}>
              <Text style={styles.menuCloseText}>×</Text>
            </TouchableOpacity>
            <Text style={styles.menuHeader}>Меню</Text>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setMenuOpen(false)}>
              <Text style={styles.menuItemText}>👤 Профиль</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setMenuOpen(false)}>
              <Text style={styles.menuItemText}>📦 Доставленные заказы</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setMenuOpen(false)}>
              <Text style={styles.menuItemText}>💰 Финансы</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setMenuOpen(false)}>
              <Text style={styles.menuItemText}>🛟 Поддержка</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <Text style={styles.menuItemText}>🚪 Выйти</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#fff'},
  map: {flex: 1},
  burger: {
    position: 'absolute',
    top: 18,
    left: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    elevation: 3,
  },
  burgerText: {fontSize: 18},
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
  },
  centerControls: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {color: '#374151', marginVertical: 6},
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  menu: {width: '86%', backgroundColor: '#fff', borderRadius: 14, padding: 16},
  menuClose: {position: 'absolute', top: 6, right: 10, zIndex: 10},
  menuCloseText: {fontSize: 26},
  menuHeader: {fontSize: 18, fontWeight: '700', marginBottom: 12},
  menuItem: {paddingVertical: 10},
  menuItemText: {fontSize: 16},
  loading: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderAddr: {
    marginBottom: 6,
    marginTop: 4,
    color: '#111827',
    fontWeight: '500',
  },
  mapBtn: {
    position: 'absolute',
    top: 18,
    right: 16,
    backgroundColor: '#fff',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  mapBtnIcon: {
    fontSize: 20,
  },
});
