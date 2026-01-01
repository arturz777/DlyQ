import React, {useEffect, useMemo, useRef, useState, useCallback} from 'react';
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
  AppState,
  FlatList,
} from 'react-native';
import {Audio} from 'expo-av';
import {useKeepAwake} from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import {WebView} from 'react-native-webview';
import {CommonActions, useFocusEffect} from '@react-navigation/native';
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
  declineOrder,
  fetchCourierFinance,
  fetchCourierHistory,
} from '../api/courierAPI';
import {logout} from '../api/authAPI';
import * as Notifications from 'expo-notifications';
import {Platform, Image} from 'react-native';

const WAREHOUSE_LOCATION = {lat: 59.51372, lng: 24.828888};
const SLIDE_WIDTH = 280;
const SLIDE_KNOB = 48;
const OFFER_TTL_MS = 15000;

const maskAddress = addr => {
  if (!addr) return '';
  return String(addr)
    .replace(/\b\d+[a-zA-Z]?(?:-\d+)?\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/(^,|,$)/g, '')
    .trim();
};

const shortName = (name='') => {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  return `${parts[0]} ${parts[1][0]}.`;
};

const routeLabel = o => {
  const from = maskAddress(o?.pickupAddress || 'Heki tee 4');
  const to = maskAddress(o?.deliveryAddress || '');
  return `${from} → ${to}`;
};

async function registerForPushNotificationsAsync() {
  try {
    const {status: existingStatus} = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const {status} = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      Alert.alert(
        'Уведомления',
        'Разрешите уведомления, чтобы получать заказы.',
      );
      return null;
    }

    const {data} = await Notifications.getDevicePushTokenAsync();
    if (!data) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
      });
    }

    return data;
  } catch (e) {
    console.log('registerForPushNotificationsAsync error:', e?.message || e);
    return null;
  }
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
  function setOrder(id, lat, lng){ ensureMarker('order_'+id, lat, lng, 'Заказ '+id); }
  function clearOrder(id){ removeMarker('order_'+id); }

  function setPickup(lat,lng,label){ ensureMarker('pickup', lat, lng, label || '🏪 Забор'); }
  function clearPickup(){ removeMarker('pickup'); }

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

  function handleMessage(e){
    try{
      const m = JSON.parse(e.data);
      if(m.type==='setUser') setUser(m.lat, m.lng);
      if(m.type==='setOrder') setOrder(m.id, m.lat, m.lng);
      if(m.type==='clearOrder') clearOrder(m.id);
      if(m.type==='setPickup') setPickup(m.lat, m.lng, m.label);
      if(m.type==='clearPickup') clearPickup();
      if(m.type==='route') drawRoute(m.id, m.coords);
      if(m.type==='clearRoute') clearRoute(m.id);
      if(m.type==='fit') fitToAll();
    }catch(_){}
  }

  // важно: iOS иногда шлёт в window, Android часто в document
  document.addEventListener('message', handleMessage);
  window.addEventListener('message', handleMessage);
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
  useKeepAwake();

  const webRef = useRef(null);
  const lastPosRef = useRef(null);

  const ringRef = useRef(null);
  const autoDeclineTimerRef = useRef(null);

  const shownOrderIdRef = useRef(null);

  const acceptProgress = useRef(new Animated.Value(0)).current;
  const acceptProgressAnimRef = useRef(null);
  const appState = useRef(AppState.currentState);
  const prevOrdersCountRef = useRef(0);
  const prevCurrentOrderRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [courierStatus, setCourierStatus] = useState('offline');
  const [orders, setOrders] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsMode, setStatsMode] = useState(null);
  const [statsRange, setStatsRange] = useState('day');
  const [statsDate, setStatsDate] = useState(new Date());

  const [history, setHistory] = useState([]);
  const [financeView, setFinanceView] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [webReady, setWebReady] = useState(false);
  const [finance, setFinance] = useState(null);
  const [nowTs, setNowTs] = useState(Date.now());

  const parseMinutes = (v) => {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  const m = s.match(/\d+/);
  return m ? Number(m[0]) : null;
};

const getPrepLeftMin = (o) => {
  const mins = parseMinutes(o?.processingTime);
  const start = o?.processingStartTime ? new Date(o.processingStartTime).getTime() : null;
  if (!mins || !start) return null;
  const end = start + mins * 60 * 1000;
  const left = Math.ceil((end - Date.now()) / 60000);
  return Math.max(0, left);
};

  const startOfDay = d =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const addDays = (d, n) => new Date(d.getTime() + n * 24 * 60 * 60 * 1000);

  const getBounds = (range, date) => {
    const d0 = startOfDay(date);

    if (range === 'day') {
      return {from: d0.toISOString(), to: addDays(d0, 1).toISOString()};
    }

    if (range === 'week') {
      // неделя с понедельника
      const day = d0.getDay(); // 0 вс ... 1 пн
      const diffToMon = (day + 6) % 7;
      const mon = addDays(d0, -diffToMon);
      return {from: mon.toISOString(), to: addDays(mon, 7).toISOString()};
    }

    // month
    const first = new Date(d0.getFullYear(), d0.getMonth(), 1, 0, 0, 0, 0);
    const next = new Date(d0.getFullYear(), d0.getMonth() + 1, 1, 0, 0, 0, 0);
    return {from: first.toISOString(), to: next.toISOString()};
  };

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

  const getPickupPoint = o => {
    if (o?.pickupLat != null && o?.pickupLng != null) {
      return {lat: o.pickupLat, lng: o.pickupLng};
    }
    return WAREHOUSE_LOCATION;
  };

  const getPickupLabel = o => `📍 ${o?.pickupAddress || 'Heki tee 4'}`;

  const clearMapForOrderId = useCallback(
    orderId => {
      if (!webReady || !orderId) return;
      webRef.current?.postMessage(
        JSON.stringify({type: 'clearOrder', id: orderId}),
      );
      webRef.current?.postMessage(
        JSON.stringify({type: 'clearRoute', id: orderId}),
      );
    },
    [webReady],
  );

  const clearPickupMarker = useCallback(() => {
    if (!webReady) return;
    webRef.current?.postMessage(JSON.stringify({type: 'clearPickup'}));
  }, [webReady]);

  const showOrderOnMap = useCallback(
    o => {
      if (!webReady || !o) return;

      if (shownOrderIdRef.current && shownOrderIdRef.current !== o.id) {
        clearMapForOrderId(shownOrderIdRef.current);
      }
      shownOrderIdRef.current = o.id;

      const pickup = getPickupPoint(o);

      webRef.current?.postMessage(
        JSON.stringify({
          type: 'setPickup',
          lat: pickup.lat,
          lng: pickup.lng,
          label: getPickupLabel(o),
        }),
      );

      if (o.deliveryLat != null && o.deliveryLng != null) {
        webRef.current?.postMessage(
          JSON.stringify({
            type: 'setOrder',
            id: o.id,
            lat: o.deliveryLat,
            lng: o.deliveryLng,
          }),
        );
      }

      webRef.current?.postMessage(JSON.stringify({type: 'fit'}));
    },
    [webReady, clearMapForOrderId],
  );

  const loadOrdersOnce = useCallback(async () => {
    try {
      const data = await fetchActiveOrders();
      const list = data || [];

      if (!list.length) {
        setOrders([]);
        setCurrentOrder(null);

        if (shownOrderIdRef.current) {
          clearMapForOrderId(shownOrderIdRef.current);
          shownOrderIdRef.current = null;
        }
        clearPickupMarker();

        return;
      }

      const active = list.find(
        o =>
          o.courierId != null &&
          (o.status === 'Waiting for courier' ||
            o.status === 'Ready for pickup' ||
            o.status === 'Accepted' ||
            o.status === 'Arrived at pickup' ||
            o.status === 'In transit' ||
            o.status === 'Picked up' ||
            o.status === 'Arrived at destination'),
      );

      if (active) {
        setCurrentOrder(active);
        setOrders(list.filter(o => o.id !== active.id));

        showOrderOnMap(active);
        return;
      }

      setCurrentOrder(null);
      setOrders(list);

      const first = list[0];
      if (first) showOrderOnMap(first);
    } catch (e) {
      console.log('orders error:', e?.message || e);
    }
  }, [showOrderOnMap, clearMapForOrderId, clearPickupMarker]);

  useEffect(() => {
    if (!statsOpen || !statsMode) return;

    const run = async () => {
      setStatsLoading(true);
      try {
        const {from, to} = getBounds(statsRange, statsDate);

        if (statsMode === 'history') {
          const list = await fetchCourierHistory({from, to});
          setHistory(list || []);
        } else {
          const data = await fetchCourierFinance({from, to});
          setFinanceView(data || null);
        }
      } finally {
        setStatsLoading(false);
      }
    };

    run();
  }, [statsOpen, statsMode, statsRange, statsDate]);

  useEffect(() => {
    if (webReady) {
      loadOrdersOnce();
    }
  }, [webReady, loadOrdersOnce]);

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

  useFocusEffect(
    useCallback(() => {
      if (courierStatus === 'online') {
        loadOrdersOnce();
      }
      return () => {};
    }, [courierStatus, loadOrdersOnce]),
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        const {sound} = await Audio.Sound.createAsync(
          require('../../assets/sounds/courier_alert.wav'),
          {volume: 1.0, isLooping: true},
        );

        if (mounted) ringRef.current = sound;
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
          if (mounted && self?.status) setCourierStatus(self.status);
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
  }, [loadOrdersOnce]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (mounted && token) {
          await savePushToken(token);
        }
      } catch (e) {
        console.log('push token error:', e?.message || e);
      }
    })();

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      () => {
        if (courierStatus === 'online') loadOrdersOnce();
      },
    );

    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      if (courierStatus === 'online') loadOrdersOnce();
    });

    return () => {
      mounted = false;
      responseSub?.remove();
      receivedSub?.remove();
    };
  }, [courierStatus, loadOrdersOnce]);

  useEffect(() => {
    if (!webReady || !lastPosRef.current) return;
    const {lat, lng} = lastPosRef.current;
    webRef.current?.postMessage(JSON.stringify({type: 'setUser', lat, lng}));
    webRef.current?.postMessage(JSON.stringify({type: 'fit'}));
  }, [webReady]);

  useEffect(() => {
    const onWarehouseOrder = newOrder => {
      if (courierStatus !== 'online' || currentOrder) return;

      startRinging();
      Alert.alert('Новый заказ!', `Заказ №${newOrder.id} добавлен.`);
      loadOrdersOnce();
    };

    const onOrderReady = updatedOrder => {
      setCurrentOrder(cur =>
        cur && updatedOrder.id === cur.id ? {...cur, ...updatedOrder} : cur,
      );
    };

    const onOrderStatusUpdate = updatedOrder => {
      setCurrentOrder(cur =>
        cur && updatedOrder.id === cur.id ? {...cur, ...updatedOrder} : cur,
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
  }, [socket, currentOrder, courierStatus, loadOrdersOnce]);

  useEffect(() => {
    if (!currentOrder && orders.length === 0) stopRinging();
  }, [currentOrder, orders.length]);

  useEffect(() => {
    return () => {
      try {
        socket.removeAllListeners();
        socket.disconnect();
      } catch {}
    };
  }, [socket]);

  useEffect(() => {
    if (courierStatus !== 'online' || currentOrder) {
      prevOrdersCountRef.current = orders.length;
      return;
    }
    if (!currentOrder && orders.length > prevOrdersCountRef.current) {
      startRinging();
    }
    prevOrdersCountRef.current = orders.length;
  }, [orders.length, courierStatus, currentOrder]);

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

  useEffect(() => {
    if (autoDeclineTimerRef.current) {
      clearTimeout(autoDeclineTimerRef.current);
      autoDeclineTimerRef.current = null;
    }

    if (acceptProgressAnimRef.current) {
      acceptProgressAnimRef.current.stop();
      acceptProgressAnimRef.current = null;
    }
    acceptProgress.setValue(0);

    if (courierStatus !== 'online') return;
    if (currentOrder) return;

    const firstOrder = orders[0] || null;
    if (!firstOrder) return;

    const expiresAtMs = firstOrder.offerExpiresAt
      ? new Date(firstOrder.offerExpiresAt).getTime()
      : null;

    if (!expiresAtMs) return;

    const now = Date.now();
    let msLeft = expiresAtMs - now;

    if (msLeft <= 0) {
      loadOrdersOnce();
      return;
    }

    startRinging();

    const elapsed = Math.max(0, OFFER_TTL_MS - msLeft);
    const initialProgress = Math.min(elapsed / OFFER_TTL_MS, 1);

    acceptProgress.setValue(initialProgress);

    acceptProgressAnimRef.current = Animated.timing(acceptProgress, {
      toValue: 1,
      duration: msLeft,
      useNativeDriver: false,
    });

    acceptProgressAnimRef.current.start(({finished}) => {
      if (finished) acceptProgressAnimRef.current = null;
    });

    autoDeclineTimerRef.current = setTimeout(() => {
      loadOrdersOnce();
      stopRinging();
      setCourierStatus('offline');
    }, msLeft);

    return () => {
      if (autoDeclineTimerRef.current) {
        clearTimeout(autoDeclineTimerRef.current);
        autoDeclineTimerRef.current = null;
      }
      if (acceptProgressAnimRef.current) {
        acceptProgressAnimRef.current.stop();
        acceptProgressAnimRef.current = null;
      }
      acceptProgress.setValue(0);
    };
  }, [courierStatus, currentOrder, orders, acceptProgress, loadOrdersOnce]);

  useEffect(() => {
    const wasBusy = !!prevCurrentOrderRef.current;
    const isFreeNow = !currentOrder;

    if (
      courierStatus === 'online' &&
      wasBusy &&
      isFreeNow &&
      orders.length > 0
    ) {
      startRinging();
    }

    prevCurrentOrderRef.current = currentOrder;
  }, [courierStatus, currentOrder, orders.length]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      const wasBackground =
        appState.current === 'background' || appState.current === 'inactive';
      const isActiveNow = nextState === 'active';

      if (wasBackground && isActiveNow) {
        (async () => {
          try {
            const self = await fetchCourierSelf();
            if (self?.status) setCourierStatus(self.status);

            if (self?.status === 'online') {
              await loadOrdersOnce();
            } else {
              setOrders([]);
              setCurrentOrder(null);
              stopRinging();
            }
          } catch (e) {
            console.log('AppState sync error:', e?.message || e);
          }
        })();
      }

      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [loadOrdersOnce]);

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
        setCurrentOrder(null);

        if (shownOrderIdRef.current) {
          clearMapForOrderId(shownOrderIdRef.current);
          shownOrderIdRef.current = null;
        }
        clearPickupMarker();
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

  const drawRoute = async (id, start, end) => {
    if (
      start?.lat == null ||
      start?.lng == null ||
      end?.lat == null ||
      end?.lng == null
    )
      return;

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

  useEffect(() => {
    if (!webReady || !currentOrder) return;

    const o = currentOrder;
    const isParcelLocal = o.orderType === 'parcel';

    (async () => {
      webRef.current?.postMessage(
        JSON.stringify({type: 'clearRoute', id: o.id}),
      );
      if (isParcelLocal) {
        if (
          (o.status === 'Accepted' || o.status === 'Arrived at pickup') &&
          o.pickupLat != null &&
          o.pickupLng != null
        ) {
          await drawRoute(
            o.id,
            lastPosRef.current || WAREHOUSE_LOCATION,
            getPickupPoint(o),
          );
        }

        if (
          o.status === 'In transit' &&
          o.deliveryLat != null &&
          o.deliveryLng != null
        ) {
          await drawRoute(o.id, lastPosRef.current || getPickupPoint(o), {
            lat: o.deliveryLat,
            lng: o.deliveryLng,
          });
        }
        return;
      }
      if (o.status === 'Accepted') {
        await drawRoute(
          o.id,
          lastPosRef.current || WAREHOUSE_LOCATION,
          getPickupPoint(o),
        );
      }

      if (
        o.status === 'Picked up' &&
        o.deliveryLat != null &&
        o.deliveryLng != null
      ) {
        await drawRoute(o.id, lastPosRef.current || getPickupPoint(o), {
          lat: o.deliveryLat,
          lng: o.deliveryLng,
        });
      }
    })();
  }, [
    webReady,
    currentOrder?.id,
    currentOrder?.status,
    currentOrder?.orderType,
  ]);

  const handleAcceptOrder = async orderId => {
    try {
      const o = await acceptOrder(orderId);

      if (autoDeclineTimerRef.current) {
        clearTimeout(autoDeclineTimerRef.current);
        autoDeclineTimerRef.current = null;
      }
      if (acceptProgressAnimRef.current) {
        acceptProgressAnimRef.current.stop();
        acceptProgressAnimRef.current = null;
      }
      acceptProgress.setValue(0);

      setOrders(prev => prev.filter(ord => ord.id !== orderId));
      stopRinging();
      setCurrentOrder(o);
      showOrderOnMap(o);

      if (lastPosRef.current) {
        const pickupPoint = getPickupPoint(o);
        await drawRoute(o.id, lastPosRef.current, pickupPoint);
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось принять заказ');
    }
  };

  const handleUpdateStatus = async st => {
    if (!currentOrder) return;
    const order = currentOrder;

    try {
      await updateDeliveryStatus(order.id, st);
      setCurrentOrder(c => (c ? {...c, status: st} : c));

      const isParcelLocal = order.orderType === 'parcel';

      if (webReady) {
        webRef.current?.postMessage(
          JSON.stringify({type: 'clearRoute', id: order.id}),
        );
      }

      if (
        !isParcelLocal &&
        st === 'Picked up' &&
        order.deliveryLat != null &&
        order.deliveryLng != null
      ) {
        await drawRoute(order.id, lastPosRef.current || WAREHOUSE_LOCATION, {
          lat: order.deliveryLat,
          lng: order.deliveryLng,
        });
      }

      if (
        isParcelLocal &&
        st === 'In transit' &&
        order.deliveryLat != null &&
        order.deliveryLng != null
      ) {
        await drawRoute(order.id, lastPosRef.current || getPickupPoint(order), {
          lat: order.deliveryLat,
          lng: order.deliveryLng,
        });
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось обновить статус');
    }
  };

  const handleCompleteDelivery = async () => {
    if (!currentOrder) return;

    try {
      await completeDelivery(currentOrder.id);

      if (webReady) {
        webRef.current?.postMessage(JSON.stringify({type: 'clearPickup'}));
        webRef.current?.postMessage(
          JSON.stringify({type: 'clearOrder', id: currentOrder.id}),
        );
        webRef.current?.postMessage(
          JSON.stringify({type: 'clearRoute', id: currentOrder.id}),
        );
      }

      if (shownOrderIdRef.current === currentOrder.id) {
        shownOrderIdRef.current = null;
      }

      setCurrentOrder(null);
      await loadOrdersOnce();
    } catch {
      Alert.alert('Ошибка', 'Не удалось завершить заказ');
    }
  };

  const declineOrderLocally = async orderId => {
    if (autoDeclineTimerRef.current) {
      clearTimeout(autoDeclineTimerRef.current);
      autoDeclineTimerRef.current = null;
    }
    if (acceptProgressAnimRef.current) {
      acceptProgressAnimRef.current.stop();
      acceptProgressAnimRef.current = null;
    }
    acceptProgress.setValue(0);

    stopRinging();
    setOrders(prev => prev.filter(o => o.id !== orderId));

    if (shownOrderIdRef.current === orderId) {
      clearMapForOrderId(orderId);
      shownOrderIdRef.current = null;
      clearPickupMarker();
    }

    try {
      await declineOrder(orderId);
      await loadOrdersOnce();
    } catch (e) {
      console.log('decline error:', e?.message || e);
    }
  };

  const openExternalRoute = () => {
    const o = currentOrder;
    if (!o) return;

    let destLat, destLng;

    const isParcel = o.orderType === 'parcel';

    if (
      o.status === 'Waiting for courier' ||
      o.status === 'Ready for pickup' ||
      o.status === 'Accepted' ||
      (isParcel &&
        (o.status === 'Accepted' || o.status === 'Arrived at pickup'))
    ) {
      const pickupPoint = getPickupPoint(o);
      destLat = pickupPoint.lat;
      destLng = pickupPoint.lng;
    } else {
      destLat = o.deliveryLat;
      destLng = o.deliveryLng;
    }

    if (destLat == null || destLng == null) return;

    const url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;
    Linking.openURL(url).catch(() => {});
  };

  const handleLogout = async () => {
    try {
      await toggleCourierStatus('offline');
    } catch {}

    try {
      socket.removeAllListeners();
      socket.disconnect();
    } catch {}

    if (shownOrderIdRef.current) {
      clearMapForOrderId(shownOrderIdRef.current);
      shownOrderIdRef.current = null;
    }
    clearPickupMarker();

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

  const toNum = v => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const money = v => `${toNum(v).toFixed(2)} €`;

  const formatCourierIncome = o => {
    const net = toNum(o?.courierFee);

    if (o?.orderType === 'parcel') {
      const w = toNum(o?.courierCommission);
      if (w > 0) return `${money(net)} (комиссия ${money(w)})`;
    }

    return money(net);
  };

  const formatNetWithheld = o => {
    const net = Number(o?.courierFee || 0);
    const w = Number(o?.courierCommission || 0);
    const netStr = net ? `${net.toFixed(2)} €` : '';
    const wStr = w ? ` (удержано ${w.toFixed(2)} €)` : '';
    return netStr + wStr;
  };

  const progressWidth = acceptProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const pickupAddress = currentOrder?.pickupAddress || 'Heki tee 4';

  const currentAddressLabel = useMemo(() => {
    if (!currentOrder) return '';

    const isParcelLocal = currentOrder.orderType === 'parcel';

    if (isParcelLocal) {
      if (
        currentOrder.status === 'Accepted' ||
        currentOrder.status === 'Arrived at pickup'
      ) {
        return `📍 ${pickupAddress}`;
      }
      return `📍 ${currentOrder.deliveryAddress}`;
    }

    if (
      currentOrder.status === 'Waiting for courier' ||
      currentOrder.status === 'Ready for pickup' ||
      currentOrder.status === 'Accepted'
    ) {
      return `📍 ${pickupAddress}`;
    }

    return `📍 ${currentOrder.deliveryAddress}`;
  }, [currentOrder, pickupAddress]);

  const isParcel = currentOrder?.orderType === 'parcel';

  useEffect(() => {
  if (!currentOrder) return;
  const id = setInterval(() => setNowTs(Date.now()), 30000);
  return () => clearInterval(id);
}, [currentOrder?.id]);

  const leftMin = getPrepLeftMin(currentOrder);

  const callCustomer = () => {
  const phone = currentOrder?.customerPhone;
  if (!phone) {
    Alert.alert('Телефон не указан');
    return;
  }

  const normalized = String(phone).replace(/[^\d+]/g, '');
  const url = `tel:${normalized}`;
  Linking.openURL(url).catch(() => Alert.alert('Ошибка', 'Не удалось открыть звонок'));
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

      {courierStatus === 'online' && !currentOrder && firstOrder && (
        <TouchableOpacity
          style={styles.declineBtn}
          onPress={() => declineOrderLocally(firstOrder.id)}>
          <Text style={styles.declineBtnText}>Отклонить</Text>
        </TouchableOpacity>
      )}

      {currentOrder && (
        <TouchableOpacity style={styles.mapBtn} onPress={openExternalRoute}>
          <Image
            source={require('../../assets/icons/google-maps.png')}
            style={styles.mapBtnIconImage}
          />
        </TouchableOpacity>
      )}

        {currentOrder && (
  <TouchableOpacity style={styles.callBtn} onPress={callCustomer}>
    <Text style={{fontSize: 18}}>📞</Text>
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
            <>
              {firstOrder?.customerName ? (
                <Text style={styles.infoText}>
                  Доставка к - {firstOrder.customerName}
                </Text>
              ) : null}
              <SlideAction
                label={(() => {
                  const price = formatCourierFee(firstOrder);
                  return `✅ Принять заказ${price ? ` • ${price}` : ''}`;
                })()}
                onComplete={() => handleAcceptOrder(firstOrder.id)}
              />

              <View style={styles.timerBarContainer}>
                <View style={styles.timerBarTrack}>
                  <Animated.View
                    style={[styles.timerBarFill, {width: progressWidth}]}
                  />
                </View>
              </View>
            </>
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
              {currentOrder?.customerName ? (
                <Text style={styles.infoText}>
                  Доставка к - {currentOrder.customerName}
                </Text>
              ) : null}
              <Text style={styles.orderAddr} numberOfLines={1}>
                {currentAddressLabel}
              </Text>

              {isParcel && currentOrder.status === 'Accepted' && (
                <SlideAction
                  label="📍 Прибыл в пункт A"
                  onComplete={() => handleUpdateStatus('Arrived at pickup')}
                />
              )}

              {isParcel && currentOrder.status === 'Arrived at pickup' && (
                <SlideAction
                  label="✅ Забрал заказ"
                  onComplete={() => handleUpdateStatus('In transit')}
                />
              )}

              {isParcel && currentOrder.status === 'In transit' && (
                <SlideAction
                  label="📍 Прибыл в пункт B"
                  onComplete={() =>
                    handleUpdateStatus('Arrived at destination')
                  }
                />
              )}

              {isParcel && currentOrder.status === 'Arrived at destination' && (
                <SlideAction
                  label="✅ Доставлено"
                  onComplete={handleCompleteDelivery}
                />
              )}

              {!isParcel &&
                (currentOrder.status === 'Accepted' ||
                  currentOrder.status === 'Waiting for courier') && (
                 <Text style={styles.infoText}>
  ⏳ Заказ готовится{leftMin != null ? ` • ждать ~${leftMin} мин` : ''}
</Text>
                )}

              {!isParcel && currentOrder.status === 'Ready for pickup' && (
                <SlideAction
                  label="✅ Забрал заказ"
                  onComplete={() => handleUpdateStatus('Picked up')}
                />
              )}

              {!isParcel && currentOrder.status === 'Picked up' && (
                <SlideAction
                  label="📍 Прибыл к клиенту"
                  onComplete={() =>
                    handleUpdateStatus('Arrived at destination')
                  }
                />
              )}

              {!isParcel &&
                currentOrder.status === 'Arrived at destination' && (
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
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.fullModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Меню</Text>
            <TouchableOpacity onPress={() => setMenuOpen(false)}>
              <Text style={styles.modalClose}>×</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <TouchableOpacity
              style={styles.fullMenuItem}
              onPress={() => setMenuOpen(false)}>
              <Text style={styles.fullMenuItemText}>👤 Профиль</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.fullMenuItem}
              onPress={() => {
                setMenuOpen(false);
                setStatsMode('history');
                setStatsOpen(true);
              }}>
              <Text style={styles.fullMenuItemText}>📜 История заказов</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.fullMenuItem}
              onPress={() => {
                setMenuOpen(false);
                setStatsMode('finance');
                setStatsOpen(true);
              }}>
              <Text style={styles.fullMenuItemText}>💰 Финансы</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.fullMenuItem}
              onPress={() => setMenuOpen(false)}>
              <Text style={styles.fullMenuItemText}>🛟 Поддержка</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.fullMenuItem, styles.fullMenuItemDanger]}
              onPress={handleLogout}>
              <Text
                style={[
                  styles.fullMenuItemText,
                  styles.fullMenuItemDangerText,
                ]}>
                🚪 Выйти
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={statsOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setStatsOpen(false)}>
        <View style={styles.fullModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {statsMode === 'history' ? '📜 История заказов' : '💰 Финансы'}
            </Text>

            <TouchableOpacity onPress={() => setStatsOpen(false)}>
              <Text style={styles.modalClose}>×</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabsRow}>
            {['day', 'week', 'month'].map(r => (
              <TouchableOpacity
                key={r}
                onPress={() => setStatsRange(r)}
                style={[
                  styles.tab,
                  statsRange === r ? styles.tabActive : styles.tabInactive,
                ]}>
                <Text
                  style={
                    statsRange === r ? styles.tabTextActive : styles.tabText
                  }>
                  {r === 'day' ? 'День' : r === 'week' ? 'Неделя' : 'Месяц'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modalBody}>
            {statsLoading && <ActivityIndicator />}

            {!statsLoading && statsMode === 'finance' && financeView && (
              <View style={{gap: 10}}>
                <Text>
                  Процент принятых заказов: {financeView.acceptRate ?? 100}%
                </Text>
                <Text>Выполненные заказы: {financeView.trips}</Text>
                <Text>
                  Вычеты: {Number(financeView.withheld || 0).toFixed(2)} €
                </Text>
                <Text>
                  Бонусы: {Number(financeView.bonuses || 0).toFixed(2)} €
                </Text>
                <Text>
                  Чаевые: {Number(financeView.tips || 0).toFixed(2)} €
                </Text>
                <Text style={{fontWeight: '700'}}>
                  Ваш заработок (чистый доход):{' '}
                  {Number(financeView.net || 0).toFixed(2)} €
                </Text>
              </View>
            )}

            {!statsLoading && statsMode === 'history' && (
              <View style={{flex: 1}}>
                {!history?.length ? (
                  <Text style={{color: '#6b7280'}}>
                    Нет выполненных заказов за период.
                  </Text>
                ) : (
                  <FlatList
                    data={history}
                    keyExtractor={(item, idx) => String(item?.id ?? idx)}
                    contentContainerStyle={{paddingBottom: 20}}
                    renderItem={({item: o}) => {
                      const dt =
                        o?.deliveredAt ||
                        o?.delivered_at ||
                        o?.completedAt ||
                        o?.createdAt;
                      const when = dt
                        ? new Date(dt).toLocaleString('ru-RU')
                        : '';

                      const orderSum =
                        o?.totalPrice ??
                        o?.total ??
                        o?.amount ??
                        o?.sum ??
                        o?.orderTotal ??
                        null;

                      const net =
                        o?.net ?? o?.courierNet ?? o?.courierFee ?? null;

                      const kind = String(o?.kind || '').toLowerCase();

                      const typeLabel =
                        kind === 'parcel'
                          ? '📦 Доставка посылки'
                          : kind === 'market'
                          ? '🛒 DlyQ Market'
                          : `🍔 ${o?.sellerName || 'Restaurant'}`;

                      const from = maskAddress(
                        o?.pickupAddress || o?.pickup_address || '',
                      );
                      const to = maskAddress(
                        o?.deliveryAddress || o?.delivery_address || '',
                      );

                      return (
                        <View style={styles.historyCard}>
                          <View style={styles.historyTopRow}>
                            <View style={{flex: 1, minWidth: 0}}>
                              <Text style={styles.historyType}>
                                {typeLabel}
                              </Text>
                              <Text
                                style={styles.historyDate}
                                numberOfLines={1}>
                                {when}
                              </Text>
                            </View>

                            <View style={{alignItems: 'flex-end'}}>
                              {orderSum != null && (
                                <Text style={styles.historyAmount}>
                                  Сумма: {Number(orderSum || 0).toFixed(2)} €
                                </Text>
                              )}
                              {net != null && (
                                <Text style={styles.historyNet}>
                                  Доход: {Number(net || 0).toFixed(2)} €
                                </Text>
                              )}
                              {o?.customerName ? (
                                <Text style={styles.historyRoute}>
                                  Клиент: {o.customerName}
                                </Text>
                              ) : null}
                            </View>
                          </View>

                          <View style={{marginTop: 10, gap: 6}}>
                            {!!from && (
                              <Text
                                style={styles.historyRoute}
                                numberOfLines={2}>
                                Откуда: {from}
                              </Text>
                            )}
                            {!!to && (
                              <Text
                                style={styles.historyRoute}
                                numberOfLines={2}>
                                Куда: {to}
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    }}
                  />
                )}
              </View>
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
  declineBtn: {
    position: 'absolute',
    top: 18,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  declineBtnText: {
    fontSize: 14,
    color: '#b91c1c',
    fontWeight: '600',
  },
  timerBarContainer: {
    width: SLIDE_WIDTH,
    marginTop: 6,
  },
  timerBarTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  timerBarFill: {
    height: 4,
    borderRadius: 999,
    backgroundColor: '#22c55e',
  },
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
  orderAddr: {
    marginBottom: 6,
    marginTop: 4,
    color: '#111827',
    fontWeight: '500',
  },
  fullModal: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalClose: {
    fontSize: 32,
    lineHeight: 32,
    color: '#111827',
  },
  modalBody: {
    flex: 1,
    padding: 16,
  },
  fullMenuItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  fullMenuItemText: {
    fontSize: 16,
    color: '#111827',
  },
  fullMenuItemDanger: {
    marginTop: 10,
    borderBottomWidth: 0,
  },
  fullMenuItemDangerText: {
    color: '#b91c1c',
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: '#111827',
  },
  tabInactive: {
    backgroundColor: '#e5e7eb',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  tabText: {
    color: '#111827',
    fontWeight: '600',
  },
  historyCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  loading: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
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
  mapBtnIconImage: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  callBtn: {
  position: 'absolute',
  top: 18,
  right: 62,
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
  historyCard: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    marginBottom: 10,
  },
  historyTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  historyType: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  historyDate: {
    marginTop: 4,
    fontSize: 13,
    color: '#374151',
  },
  historyAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  historyNet: {
    marginTop: 3,
    fontSize: 12,
    color: '#374151',
  },
  historyRoute: {
    fontSize: 13,
    color: '#111827',
  },
});
