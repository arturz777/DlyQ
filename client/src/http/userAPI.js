import {$authHost, $host} from "./index";
import { jwtDecode } from "jwt-decode";

const getLang = () => {
  const l = (localStorage.getItem("i18nextLng") || "est")
    .toLowerCase()
    .split("-")[0];

  if (l === "et") return "est";
  if (l === "ru") return "ru";
  if (l === "en") return "en";
  if (l === "est") return "est";
  return "est";
};

export const registration = async (
  email,
  password,
  firstName,
  lastName,
  phone
) => {
  const language = getLang();

  const { data } = await $host.post(
    "/user/registration",
    { email, password, firstName, lastName, phone, language },
    { withCredentials: true, headers: { "x-lang": language } }
  );

  localStorage.setItem("token", data.accessToken);
  return { user: jwtDecode(data.accessToken), token: data.accessToken };
};

export const login = async (email, password) => {
  const language = getLang();

  const response = await $host.post(
    "/user/login",
    { email, password, language },
    { withCredentials: true, headers: { "x-lang": language } }
  );

  const accessToken = response.data.accessToken;
  localStorage.setItem("token", accessToken);
  return jwtDecode(accessToken);
};

export const check = async () => {
  try {
    const { data } = await $authHost.get("/user/auth");
    localStorage.setItem("token", data.accessToken);
    return jwtDecode(data.accessToken);
  } catch (error) {
    return null;
  }
};

export const fetchProfile = async () => {
  try {
    const { data } = await $authHost.get("/user/profile");
    return data;
  } catch (e) {
    return null; 
  }
};


export const updateProfile = async (profileData) => {
  const { data } = await $authHost.put("/user/profile", profileData);
  return data;
};

export const changePassword = async (passwordData) => {
  const { data } = await $authHost.put("/user/change-password", passwordData);
  return data;
};

export const googleLogin = async (token) => {
  const language = getLang();

  const { data } = await $host.post(
    "/user/google-login",
    { token, language },
    { withCredentials: true, headers: { "x-lang": language } }
  );

  localStorage.setItem("token", data.accessToken);
  return jwtDecode(data.accessToken);
};
