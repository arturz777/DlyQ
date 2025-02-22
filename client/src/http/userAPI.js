import {$authHost, $host} from "./index";
import { jwtDecode } from "jwt-decode";

export const registration = async (email, password, firstName, lastName, phone) => {
    const {data} = await $host.post('user/registration', {
      email, 
      password,
      firstName,
    lastName,
    phone,
    })
    localStorage.setItem('token', data.token)
    return jwtDecode(data.token);
}

export const login = async (email, password) => {
  const { data } = await $host.post("user/login", { email, password });
  localStorage.setItem("token", data.token);
  return jwtDecode(data.token);
}

// Проверка авторизации
export const check = async () => {
  const token = localStorage.getItem("token"); // Получаем токен из localStorage

  if (!token) {
    throw new Error("No token found");
  }

  // Передаем токен в заголовке Authorization
  const { data } = await $authHost.get("user/auth", {
    headers: {
      Authorization: `Bearer ${token}`, // Передаем токен в заголовке
    },
  });

  localStorage.setItem("token", data.token); // Сохраняем новый токен, если он обновился
  return jwtDecode(data.token); // Декодируем и возвращаем данные токена
};

export const fetchProfile = async () => {
  const { data } = await $authHost.get("user/profile");
  return data;
};

export const updateProfile = async (profileData) => {
  const { data } = await $authHost.put("user/profile", profileData);
  return data;
};

export const changePassword = async (passwordData) => {
  const { data } = await $authHost.put("user/change-password", passwordData);
  return data;
};