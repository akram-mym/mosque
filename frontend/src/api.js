
import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000/api/",
});

let refreshPromise;

api.interceptors.request.use((config) => {
  const isTokenRequest =
    config.url === "token/" || config.url === "token/refresh/";
  const accessToken = sessionStorage.getItem("access");

  if (!isTokenRequest && accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    const isTokenRequest =
      request?.url === "token/" || request?.url === "token/refresh/";

    if (
      error.response?.status !== 401 ||
      !request ||
      request._retry ||
      isTokenRequest
    ) {
      return Promise.reject(error);
    }

    const refreshToken = sessionStorage.getItem("refresh");
    if (!refreshToken) {
      sessionStorage.removeItem("access");
      sessionStorage.removeItem("refresh");
      window.dispatchEvent(new Event("auth:session-expired"));
      return Promise.reject(error);
    }

    request._retry = true;
    try {
      if (!refreshPromise) {
        refreshPromise = api
          .post("token/refresh/", { refresh: refreshToken })
          .then((response) => {
            const { access, refresh } = response.data;
            sessionStorage.setItem("access", access);
            if (refresh) sessionStorage.setItem("refresh", refresh);
            return access;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const accessToken = await refreshPromise;
      request.headers.Authorization = `Bearer ${accessToken}`;
      return api(request);
    } catch (refreshError) {
      if ([400, 401].includes(refreshError.response?.status)) {
        sessionStorage.removeItem("access");
        sessionStorage.removeItem("refresh");
        window.dispatchEvent(new Event("auth:session-expired"));
      }
      return Promise.reject(refreshError);
    }
  }
);

export default api;
