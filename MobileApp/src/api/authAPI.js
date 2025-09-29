import {$host, $authHost} from './http';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {jwtDecode} from 'jwt-decode';

export const login = async (email, password) => {
  const {data} = await $host.post('/user/login', {email, password});
  const token = data?.accessToken || data?.token || data?.jwt;
  if (!token) throw new Error('NO_TOKEN_IN_RESPONSE');
  await AsyncStorage.setItem('token', token);
  return jwtDecode(token);
};

export const checkAuth = async () => {
  const {data} = await $authHost.get('/user/auth');
  const token = data?.accessToken || data?.token || data?.jwt;
  if (token) {
    await AsyncStorage.setItem('token', token);
    return jwtDecode(token);
  }

  const saved = await AsyncStorage.getItem('token');
  if (!saved) throw new Error('No token');
  return jwtDecode(saved);
};

export const logout = async () => {
  await AsyncStorage.removeItem('token');
};
