import axios from "axios";

const $host = axios.create({ 
	baseURL: process.env.REACT_APP_API_URL,
	withCredentials: true
});

const $authHost = axios.create({
	baseURL: process.env.REACT_APP_API_URL,
	withCredentials: true
});

const authInterceptor = config => { 
	const token = localStorage.getItem('token');
	if (token) {
		config.headers.authorization = `Bearer ${token}`;
	}
	return config;
};

$authHost.interceptors.request.use(authInterceptor);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

$authHost.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes("/user/login") &&
      !originalRequest.url.includes("/user/registration")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.authorization = `Bearer ${token}`;
          return $authHost(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await $host.post(
          "/user/refresh",
          {},
          { withCredentials: true }
        );

        const newToken = response.data.accessToken;
        localStorage.setItem("token", newToken);

        $authHost.defaults.headers.authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);

        originalRequest.headers.authorization = `Bearer ${newToken}`;
        return $authHost(originalRequest);
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem("token");
        return Promise.resolve({ data: null });
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response?.status === 401) {
      return Promise.resolve({ data: null });
    }

    return Promise.reject(error);
  }
);


export {
	$host,
	$authHost
};
