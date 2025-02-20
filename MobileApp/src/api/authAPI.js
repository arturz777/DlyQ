import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";

const API_URL = "http://192.168.130.245:5000/api"; // ЗАМЕНИ на свой IP

export const login = async (email, password) => {
	try {
	  const { data } = await axios.post(`${API_URL}/user/login`, { email, password });
	  console.log("Ответ от сервера:", data);
	  await AsyncStorage.setItem("token", data.token);
	  return data;
	} catch (error) {
	  console.error("Ошибка входа:", error.response ? error.response.data : error.message);
	  throw error;
	}
  };

export const checkAuth = async () => {
  const token = await AsyncStorage.getItem("token");

  if (!token) {
    throw new Error("No token found");
  }

  const { data } = await axios.get(`${API_URL}/user/auth`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  await AsyncStorage.setItem("token", data.token);
  return jwtDecode(data.token);
};

export const logout = async () => {
  await AsyncStorage.removeItem("token");
};
