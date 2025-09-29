import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
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
} from '../api/courierAPI';
import {logout} from '../api/authAPI';

const WAREHOUSE_LOCATION = {lat: 59.51372, lng: 24.828888};

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
  const map = L.map('map').setView([${center.lat},${center.lng}], 12);
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

export default function CourierScreen({navigation}) {
  const webRef = useRef(null);
  const lastPosRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [courierStatus, setCourierStatus] = useState('offline');
  const [orders, setOrders] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [webReady, setWebReady] = useState(false);

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
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
    if (!webReady || !lastPosRef.current) return;
    const {lat, lng} = lastPosRef.current;
    webRef.current?.postMessage(JSON.stringify({type: 'setUser', lat, lng}));
    webRef.current?.postMessage(JSON.stringify({type: 'fit'}));
  }, [webReady]);

  useEffect(() => {
    const onWarehouseOrder = newOrder => {
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
      try {
        socket.removeAllListeners();
        socket.disconnect();
      } catch {}
    };
  }, [socket, webReady]);

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

  const loadOrdersOnce = async () => {
    try {
      const data = await fetchActiveOrders();
      setOrders(data || []);
      const target =
        (data &&
          data[0] && {
            lat: data[0].deliveryLat,
            lng: data[0].deliveryLng,
            id: data[0].id,
          }) ||
        null;
      if (target && webReady) {
        webRef.current?.postMessage(
          JSON.stringify({
            type: 'setOrder',
            id: target.id,
            lat: target.lat,
            lng: target.lng,
          }),
        );
        webRef.current?.postMessage(JSON.stringify({type: 'fit'}));
      }
    } catch (e) {
      console.log('orders error:', e?.message || e);
    }
  };

  const handleToggleStatus = async () => {
    try {
      const next = courierStatus === 'online' ? 'offline' : 'online';
      await toggleCourierStatus(next);
      setCourierStatus(next);
      if (next === 'online') {
        await loadOrdersOnce();
      } else {
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

      <View style={styles.bottomBar}>
        {courierStatus === 'offline' ? (
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={handleToggleStatus}>
            <Text style={styles.btnPrimaryText}>🟢 Выйти в онлайн</Text>
          </TouchableOpacity>
        ) : currentOrder ? (
          <TouchableOpacity
            style={styles.btnGrey}
            onPress={() => setOrderModalOpen(true)}>
            <Text style={styles.btnGreyText}>📦 Детали заказа</Text>
          </TouchableOpacity>
        ) : orders.length > 0 ? (
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => handleAcceptOrder(orders[0].id)}>
            <Text style={styles.btnPrimaryText}>✅ Принять заказ</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.infoText}>🔎 Поиск заказа...</Text>
        )}
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

      <Modal
        visible={orderModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setOrderModalOpen(false)}>
        <View
          style={styles.overlay}
          onTouchEnd={() => setOrderModalOpen(false)}>
          <View
            style={styles.orderModal}
            onStartShouldSetResponder={() => true}>
            <TouchableOpacity
              style={styles.menuClose}
              onPress={() => setOrderModalOpen(false)}>
              <Text style={styles.menuCloseText}>×</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>📦 Информация</Text>

            {courierStatus === 'online' && !currentOrder && (
              <>
                <Text style={styles.infoText}>🔎 Поиск заказа...</Text>
                <TouchableOpacity
                  style={styles.btnDanger}
                  onPress={handleToggleStatus}>
                  <Text style={styles.btnDangerText}>🔴 Выключить</Text>
                </TouchableOpacity>
              </>
            )}

            {courierStatus === 'offline' && (
              <>
                <Text style={styles.infoText}>
                  Вы офлайн. Включите онлайн, чтобы получать заказы.
                </Text>
                <TouchableOpacity
                  style={styles.btnPrimary}
                  onPress={handleToggleStatus}>
                  <Text style={styles.btnPrimaryText}>🟢 Выйти в онлайн</Text>
                </TouchableOpacity>
              </>
            )}

            {currentOrder && (
              <>
                <Text style={styles.infoText}>
                  <Text style={{fontWeight: '600'}}>Адрес:</Text>{' '}
                  {currentOrder.deliveryAddress}
                </Text>
                <Text style={styles.infoText}>
                  <Text style={{fontWeight: '600'}}>Статус:</Text>{' '}
                  {currentOrder.status === 'Ready for pickup'
                    ? '📦 Готово к доставке!'
                    : currentOrder.status}
                </Text>

                {currentOrder.status === 'Picked up' &&
                  currentOrder.deliveryLat &&
                  currentOrder.deliveryLng && (
                    <TouchableOpacity
                      style={styles.btnGrey}
                      onPress={openExternalRoute}>
                      <Text style={styles.btnGreyText}>🗺 Открыть маршрут</Text>
                    </TouchableOpacity>
                  )}

                {currentOrder.status === 'Ready for pickup' && (
                  <TouchableOpacity
                    style={styles.btnPrimary}
                    onPress={() => handleUpdateStatus('Picked up')}>
                    <Text style={styles.btnPrimaryText}>📦 Забрал заказ</Text>
                  </TouchableOpacity>
                )}

                {currentOrder.status === 'Picked up' && (
                  <TouchableOpacity
                    style={styles.btnPrimary}
                    onPress={() =>
                      handleUpdateStatus('Arrived at destination')
                    }>
                    <Text style={styles.btnPrimaryText}>
                      📍 Прибыл к клиенту
                    </Text>
                  </TouchableOpacity>
                )}

                {currentOrder.status === 'Arrived at destination' && (
                  <TouchableOpacity
                    style={styles.btnSuccess}
                    onPress={handleCompleteDelivery}>
                    <Text style={styles.btnSuccessText}>✅ Доставлено</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
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
  btnPrimary: {
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  btnPrimaryText: {color: '#fff', fontWeight: '600'},
  btnDanger: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 8,
  },
  btnDangerText: {color: '#fff', fontWeight: '600'},
  btnSuccess: {
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 8,
  },
  btnSuccessText: {color: '#fff', fontWeight: '600'},
  btnGrey: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  btnGreyText: {color: '#111827', fontWeight: '600'},
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
  orderModal: {
    width: '92%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: {fontSize: 18, fontWeight: '700', marginBottom: 8},
  loading: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
