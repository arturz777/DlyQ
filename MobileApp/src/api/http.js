import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_URL} from '../config/api';

export const $host = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

export const $authHost = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

$authHost.interceptors.request.use(async config => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (!config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
});

$authHost.interceptors.response.use(
  r => r,
  async err => {
    if (err?.response?.status === 401) {
      await AsyncStorage.removeItem('token');
    }
    return Promise.reject(err);
  },
);
