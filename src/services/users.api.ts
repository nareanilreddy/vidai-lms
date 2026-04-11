/* eslint-disable @typescript-eslint/no-explicit-any */
import { http } from "./http";
import { toSafePhotoUrl } from "../utils/mediaUrl";

export type UserGender = "Male" | "Female" | "Other";

export type UserRecord = {
  id: number;
  source: "local" | "client";
  firstName: string;
  lastName: string;
  gender: UserGender;
  dateOfJoining: string;
  dateOfBirth: string;
  roleId: number | null;
  role: string;
  username: string;
  mobileNumber: string;
  email: string;
  status: boolean;
  photo?: string | null;
};

type UserApiRecord = Record<string, unknown>;
type ApiWrapped<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

export type RoleRecord = {
  id: number;
  name: string;
};

type RoleApiRecord = {
  id: number;
  name: string;
};

type UserListResponse =
  | ApiWrapped<UserApiRecord[]>
  | UserApiRecord[]
  | {
      data?: UserApiRecord[];
      results?: UserApiRecord[];
    };

type UserSearchResponse =
  | ApiWrapped<UserApiRecord[]>
  | UserApiRecord[]
  | {
      data?: UserApiRecord[];
      results?: UserApiRecord[];
      objects?: UserApiRecord[];
    };

type UserSingleResponse = UserApiRecord | ApiWrapped<UserApiRecord>;

type RoleListResponse = RoleApiRecord[] | ApiWrapped<RoleApiRecord[]>;

export type UserCreateUpdatePayload = {
  username?: string;
  email?: string;
  password?: string;
  confirm_password?: string;
  first_name?: string;
  last_name?: string;
  gender?: string;
  date_of_joining?: string | null;
  date_of_birth?: string | null;
  mobile_no?: string;
  role?: number;
  photo?: File | string | null;
  remove_photo?: boolean;
};

type UserCreateFallbackPayload = UserCreateUpdatePayload & {
  mobile_number?: string;
  confirmPassword?: string;
  profile?: {
    first_name?: string;
    last_name?: string;
    gender?: string;
    date_of_joining?: string | null;
    date_of_birth?: string | null;
    mobile_no?: string;
    photo?: string | null;
    role?: number;
  };
};

const extractApiErrorMessage = (error: unknown): string => {
  const payload =
    (error as { response?: { data?: unknown } })?.response?.data ?? null;

  const GENERIC_MESSAGES = new Set([
    "Error occurred",
    "Request failed",
    "Internal Server Error",
  ]);

  const normalize = (value: unknown): string => {
    if (value == null) return "Request failed";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (Array.isArray(value)) {
      const first = value[0];
      return first == null ? "Request failed" : normalize(first);
    }

    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;

      const preferredKeys = Object.keys(obj).filter(
        (key) =>
          ![
            "message",
            "detail",
            "error",
            "request_id",
            "success",
            "status",
          ].includes(key),
      );

      if (preferredKeys.length > 0) {
        const key = preferredKeys[0];
        return `${key}: ${normalize(obj[key])}`;
      }

      if (typeof obj.detail === "string" && !GENERIC_MESSAGES.has(obj.detail)) {
        return obj.detail;
      }

      if (
        typeof obj.message === "string" &&
        !GENERIC_MESSAGES.has(obj.message)
      ) {
        return obj.message;
      }

      if (typeof obj.error === "string" && !GENERIC_MESSAGES.has(obj.error)) {
        return obj.error;
      }

      const firstEntry = Object.entries(obj)[0];
      if (!firstEntry) return "Request failed";

      const [key, val] = firstEntry;
      return `${key}: ${normalize(val)}`;
    }

    return "Request failed";
  };

  return normalize(payload);
};

const toSafeString = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
};

const toAbsoluteMediaUrl = (value: unknown): string | null => {
  const raw = toSafeString(value).trim();
  if (!raw) return null;
  if (/^(https?:\/\/|blob:|data:)/i.test(raw)) {
    if (
      typeof window !== "undefined" &&
      window.location.protocol === "https:" &&
      /^http:\/\//i.test(raw)
    ) {
      return raw.replace(/^http:\/\//i, "https://");
    }
    return raw;
  }
  const absoluteUrl = `${API_ORIGIN}${raw.startsWith("/") ? "" : "/"}${raw}`;
  const secureUrl =
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    /^http:\/\//i.test(absoluteUrl)
      ? absoluteUrl.replace(/^http:\/\//i, "https://")
      : absoluteUrl;
  console.debug("[API] Media URL converted:", { raw, absoluteUrl: secureUrl });
  return secureUrl;
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "active", "enabled"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "inactive", "disabled"].includes(normalized)) {
      return false;
    }
  }
  return false;
};

const toGender = (value: unknown): UserGender => {
  const text = toSafeString(value).trim().toLowerCase();
  if (text === "male") {
    return "Male";
  }
  if (text === "female") {
    return "Female";
  }
  return "Other";
};

const normalizeUser = (
  raw: UserApiRecord,
  source: "local" | "client" = "local",
): UserRecord => {
  const roleFromObject =
    raw.role && typeof raw.role === "object"
      ? (raw.role as { id?: unknown; name?: unknown })
      : null;

  const resolvedRoleId =
    roleFromObject && roleFromObject.id != null
      ? Number(roleFromObject.id) || null
      : raw.role === null || raw.role === undefined
        ? null
        : Number(raw.role) || null;

  const resolvedRoleName =
    (roleFromObject ? toSafeString(roleFromObject.name) : "") ||
    toSafeString(raw.role_name ?? raw.user_role ?? raw.role);

  const firstName =
    toSafeString(raw.first_name) ||
    toSafeString(raw.firstName) ||
    toSafeString(raw.name).split(" ")[0] ||
    "";
  const lastName =
    toSafeString(raw.last_name) ||
    toSafeString(raw.lastName) ||
    toSafeString(raw.name).split(" ").slice(1).join(" ") ||
    "";

  return {
    id: Number(raw.id ?? 0),
    source,
    firstName,
    lastName,
    gender: toGender(raw.gender),
    dateOfJoining: toSafeString(raw.date_of_joining ?? raw.dateOfJoining),
    dateOfBirth: toSafeString(raw.date_of_birth ?? raw.dateOfBirth),
    roleId: resolvedRoleId,
    role: resolvedRoleName,
    username: toSafeString(raw.username ?? raw.user_name ?? raw.email),
    mobileNumber: toSafeString(
      raw.mobile_no ?? raw.mobile_number ?? raw.mobileNo,
    ),
    email: toSafeString(raw.email ?? raw.email_id),
    status: toBoolean(raw.is_active ?? raw.status),
    photo: toSafePhotoUrl(raw.photo),
  };
};

const buildUserRequestBody = (
  payload: UserCreateUpdatePayload,
): UserCreateUpdatePayload | FormData => {
  const shouldUseFormData =
    payload.photo instanceof File || payload.remove_photo === true;

  if (!shouldUseFormData) {
    return payload;
  }

  const formData = new FormData();

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;

    if (value instanceof File) {
      formData.append(key, value);
      continue;
    }

    formData.append(
      key,
      typeof value === "boolean" ? String(value) : String(value),
    );
  }

  return formData;
};

const extractSingleRecord = (payload: UserSingleResponse): UserApiRecord => {
  if (payload && typeof payload === "object" && "data" in payload) {
    const wrapped = payload as ApiWrapped<UserApiRecord>;
    if (wrapped.data && typeof wrapped.data === "object") {
      return wrapped.data;
    }
  }

  return payload as UserApiRecord;
};

const extractUserArray = (payload: UserListResponse): UserApiRecord[] => {
  console.log("Extracting users from:", payload);

  if (!payload) return [];

  // Case 1: wrapped { data: [...] }
  if (
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as any).data)
  ) {
    return (payload as any).data;
  }

  // Case 2: nested { data: { users: [...] } }
  if (
    typeof payload === "object" &&
    "data" in payload &&
    payload.data &&
    typeof payload.data === "object" &&
    Array.isArray((payload.data as any).users)
  ) {
    return (payload.data as any).users;
  }

  // Case 3: direct array
  if (Array.isArray(payload)) {
    return payload;
  }

  // Case 4: DRF pagination
  if (
    typeof payload === "object" &&
    "results" in payload &&
    Array.isArray((payload as any).results)
  ) {
    return (payload as any).results;
  }

  console.warn("No users found in payload shape:", payload);
  return [];
};

const extractUserSearchArray = (
  payload: UserSearchResponse,
): UserApiRecord[] => {
  if (payload && typeof payload === "object" && "data" in payload) {
    const wrapped = payload as ApiWrapped<UserApiRecord[]>;
    if (Array.isArray(wrapped.data)) {
      return wrapped.data;
    }
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "results" in payload &&
    Array.isArray(payload.results)
  ) {
    return payload.results;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "objects" in payload &&
    Array.isArray(payload.objects)
  ) {
    return payload.objects;
  }

  return [];
};

const extractRoleArray = (payload: RoleListResponse): RoleApiRecord[] => {
  if (payload && typeof payload === "object" && "data" in payload) {
    const wrapped = payload as ApiWrapped<RoleApiRecord[]>;
    if (Array.isArray(wrapped.data)) {
      return wrapped.data;
    }
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return [];
};

const getAuthToken = (): string | null =>
  localStorage.getItem("auth_token") ||
  localStorage.getItem("authToken") ||
  sessionStorage.getItem("auth_token") ||
  sessionStorage.getItem("authToken");

const ensureAuthToken = (): void => {
  if (!getAuthToken()) {
    throw new Error("Session expired. Please login again.");
  }
};

const toFallbackCreatePayload = (
  payload: UserCreateUpdatePayload,
): UserCreateFallbackPayload => {
  const fallbackPhoto =
    payload.photo instanceof File ? undefined : payload.photo;

  const profile = {
    first_name: payload.first_name,
    last_name: payload.last_name,
    gender: payload.gender,
    date_of_joining: payload.date_of_joining,
    date_of_birth: payload.date_of_birth,
    mobile_no: payload.mobile_no,
    photo: fallbackPhoto,
    role: payload.role,
  };

  return {
    username: payload.username,
    email: payload.email,
    password: payload.password,
    confirm_password: payload.confirm_password,
    first_name: payload.first_name,
    last_name: payload.last_name,
    gender: payload.gender,
    date_of_joining: payload.date_of_joining,
    date_of_birth: payload.date_of_birth,
    mobile_no: payload.mobile_no,
    role: payload.role,
    photo: fallbackPhoto,
    remove_photo: payload.remove_photo,
    mobile_number: payload.mobile_no,
    confirmPassword: payload.confirm_password,
    profile,
  };
};

const shouldRetryCreateWithFallback = (error: unknown): boolean => {
  const status = (error as { response?: { status?: number } })?.response
    ?.status;
  if (status === 404 || status === 405) {
    return true;
  }

  if (status !== 400) {
    return false;
  }

  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (!data || typeof data !== "object") {
    return false;
  }

  const keys = Object.keys(data as Record<string, unknown>);
  return keys.some((key) =>
    [
      "profile",
      "mobile_number",
      "non_field_errors",
      "confirmPassword",
    ].includes(key),
  );
};

export const usersApi = {
  listLocal: async (): Promise<UserRecord[]> => {
    const token =
      localStorage.getItem("auth_token") || localStorage.getItem("authToken");
    if (!token) {
      return [];
    }

    if (sessionStorage.getItem("users_list_denied") === "1") {
      return [];
    }

    try {
      const response = await http.get<UserListResponse>("/users/list/");
      sessionStorage.removeItem("users_list_denied");
      return extractUserArray(response.data).map((user) =>
        normalizeUser(user, "local"),
      );
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401 || status === 403) {
        // Some roles cannot access this endpoint. Treat as empty dataset.
        sessionStorage.setItem("users_list_denied", "1");
        return [];
      }

      if (status === 404 || status === 405 || status === 500) {
        try {
          const fallbackResponse = await http.get<UserListResponse>("/users/");
          sessionStorage.removeItem("users_list_denied");
          return extractUserArray(fallbackResponse.data).map((user) =>
            normalizeUser(user, "local"),
          );
        } catch (fallbackError) {
          const fallbackStatus = (
            fallbackError as { response?: { status?: number } }
          )?.response?.status;

          if (
            fallbackStatus === 401 ||
            fallbackStatus === 403 ||
            fallbackStatus === 404 ||
            fallbackStatus === 405 ||
            fallbackStatus === 500
          ) {
            return [];
          }

          throw fallbackError;
        }
      }

      throw error;
    }
  },

  listClient: async (): Promise<UserRecord[]> => {
    const token =
      localStorage.getItem("auth_token") || localStorage.getItem("authToken");
    if (!token) {
      return [];
    }

    const enableUsersProxy =
      (
        import.meta.env.VITE_ENABLE_STAGE_USERS_PROXY ?? "false"
      ).toLowerCase() === "true";

    if (!enableUsersProxy) {
      return [];
    }

    if (sessionStorage.getItem("users_search_denied") === "1") {
      return [];
    }

    try {
      const response = await http.get<UserSearchResponse>("/users-search/", {
        params: {
          limit: 200,
          offset: 0,
          search: "",
        },
      });

      sessionStorage.removeItem("users_search_denied");

      return extractUserSearchArray(response.data).map((user) =>
        normalizeUser(user, "client"),
      );
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401 || status === 403) {
        // Some roles cannot access this endpoint. Treat as empty dataset.
        sessionStorage.setItem("users_search_denied", "1");
        return [];
      }
      throw error;
    }
  },

  list: async (): Promise<UserRecord[]> => {
    const [localResult, clientResult] = await Promise.allSettled([
      usersApi.listLocal(),
      usersApi.listClient(),
    ]);

    const localUsers =
      localResult.status === "fulfilled" ? localResult.value : [];
    const clientUsers =
      clientResult.status === "fulfilled" ? clientResult.value : [];

    return [...localUsers, ...clientUsers];
  },

  getById: async (userId: number): Promise<UserRecord> => {
    const response = await http.get<UserSingleResponse>(`/users/${userId}/`);
    return normalizeUser(extractSingleRecord(response.data));
  },

  listRoles: async (): Promise<RoleRecord[]> => {
    const response = await http.get<RoleListResponse>("/roles/list/");
    return extractRoleArray(response.data).map((role) => ({
      id: Number(role.id),
      name: toSafeString(role.name),
    }));
  },

  create: async (payload: UserCreateUpdatePayload): Promise<UserRecord> => {
    try {
      ensureAuthToken();
      const requestBody = buildUserRequestBody(payload);
      const response = await http.post<UserSingleResponse>(
        "/users/",
        requestBody,
      );
      return normalizeUser(extractSingleRecord(response.data));
    } catch (error) {
      if (shouldRetryCreateWithFallback(error)) {
        try {
          const fallbackPayload =
            payload.photo instanceof File || payload.remove_photo === true
              ? buildUserRequestBody(payload)
              : toFallbackCreatePayload(payload);
          const fallbackResponse = await http.post<UserSingleResponse>(
            "/users/create/",
            fallbackPayload,
          );
          return normalizeUser(extractSingleRecord(fallbackResponse.data));
        } catch (fallbackError) {
          throw new Error(extractApiErrorMessage(fallbackError));
        }
      }

      throw new Error(extractApiErrorMessage(error));
    }
  },

  update: async (
    userId: number,
    payload: UserCreateUpdatePayload,
  ): Promise<UserRecord> => {
    try {
      ensureAuthToken();
      const requestBody = buildUserRequestBody(payload);
      const response = await http.put<UserSingleResponse>(
        `/users/${userId}/update/`,
        requestBody,
      );
      return normalizeUser(extractSingleRecord(response.data));
    } catch (error) {
      throw new Error(extractApiErrorMessage(error));
    }
  },

  patchStatus: async (userId: number, isActive: boolean): Promise<void> => {
    ensureAuthToken();
    await http.patch(`/users/${userId}/status/`, {
      is_active: isActive,
    });
  },

  remove: async (userId: number): Promise<void> => {
    ensureAuthToken();
    await http.delete(`/users/${userId}/delete/`);
  },
};
