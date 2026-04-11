import { useState, type SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import logo from "../assets/icons/Vidai-logo.svg";
import loginLogo from "../assets/icons/Login_Logo_Vidai.webp";
import styles from "../styles/VidaiLogin.module.css";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../store";
import { setAuth } from "../store/authSlice";
import type { AuthUser } from "../types/auth.types";
import { authApi } from "../services/auth.api";
import {
  LANGUAGE_OPTIONS,
  STORAGE_LANGUAGE_KEY,
  TRANSLATIONS,
  type LanguageCode,
} from "../utils/languages";
import {
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
} from "@mui/material";
import { toast } from "react-toastify";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

const toAbsoluteMediaUrl = (value: unknown): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
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
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    /^http:\/\//i.test(absoluteUrl)
  ) {
    return absoluteUrl.replace(/^http:\/\//i, "https://");
  }
  return absoluteUrl;
};

function resolveInitialLanguage(): LanguageCode {
  const raw = (localStorage.getItem(STORAGE_LANGUAGE_KEY) || "").trim();
  const byCode = LANGUAGE_OPTIONS.find((opt) => opt.code === raw)?.code;
  if (byCode) return byCode;

  const normalized = raw.toLowerCase();
  const legacyMap: Record<string, LanguageCode> = {
    english: "en",
    hindi: "hi",
    espanol: "es",
    portugues: "pt",
  };

  return legacyMap[normalized] || "en";
}

const buildAuthUserFromLogin = (
  token: string,
  loginIdentifier: string,
  resolvedRole?: string,
  permissions?: Record<string, unknown>,
  user?: Record<string, unknown>,
): AuthUser => {
  const nestedRole =
    user?.role && typeof user.role === "object"
      ? (user.role as { name?: unknown }).name
      : undefined;

  const designation = String(
    resolvedRole ??
      user?.role ??
      user?.designation ??
      user?.designation_label ??
      user?.role_name ??
      user?.user_role ??
      nestedRole ??
      "",
  ).trim();
  const designationLower = designation.toLowerCase();

  const hasSuperFlag =
    user?.is_superuser === true ||
    String(user?.is_superuser || "").toLowerCase() === "true";
  const hasAdminFlag =
    user?.is_staff === true ||
    String(user?.is_staff || "").toLowerCase() === "true";

  const isSuperAdmin =
    hasSuperFlag ||
    designationLower === "super admin" ||
    designationLower === "super_admin" ||
    designationLower === "super-admin" ||
    designationLower === "superadmin";
  const isAdmin = hasAdminFlag || designationLower === "admin" || isSuperAdmin;

  const nestedProfile =
    user?.profile && typeof user.profile === "object"
      ? (user.profile as Record<string, unknown>)
      : null;

  const resolvedPhoto = toSafePhotoUrl(user?.photo ?? nestedProfile?.photo) ?? "";

  return {
    access: token,
    user_id: Number(user?.user_id ?? user?.id ?? 0) || 0,
    username: String(user?.username ?? loginIdentifier),
    first_name: String(user?.first_name ?? ""),
    last_name: String(user?.last_name ?? ""),
    email: String(user?.email ?? ""),
    designation,
    designation_label: designation,
    tenant: "",
    tenant_id: 0,
    is_staff: isAdmin,
    is_superuser: isSuperAdmin,
    language_id: 0,
    language_code: "",
    language_name: "",
    permissions: (permissions as AuthUser["permissions"]) ?? { modules: [] },
    clinics: [],
    photo: resolvedPhoto,
    profile_loaded: false,
  };
};

export default function VidaiLogin() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>(
    resolveInitialLanguage,
  );
  const [error, setError] = useState("");
  const [isExternalLogin, setIsExternalLogin] = useState<boolean>(false);
  const t = TRANSLATIONS[language];

  const handleSubmit = async (event: SyntheticEvent) => {
    // Sanitize
    if (loading) return;
    event.preventDefault();
    setError("");

    // Validations
    if (!username.trim() || !password.trim()) {
      const msg = t.emptyFields;
      setError(msg);
      toast.error(msg);
      return;
    }

    try {
      setLoading(true);
      const mode = isExternalLogin ? "EXT" : "INT";
      const loginRes = await authApi.login(
        { username: username.trim(), password: password.trim() },
        mode,
      );

      const authUser = buildAuthUserFromLogin(
        loginRes.token,
        username,
        loginRes.role,
        loginRes.permissions,
        loginRes.user as Record<string, unknown>,
      );

      dispatch(
        setAuth({
          token: loginRes.token,
          refresh: loginRes.refresh,
          user: authUser,
          loginType: mode,
        }),
      );

      localStorage.setItem(STORAGE_LANGUAGE_KEY, language);
      toast.success("Login successful!");

      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      let msg = t.genericError;

      const responseData = (
        err as {
          response?: {
            data?: {
              message?: string;
              detail?: string;
              errors?: Array<{
                code?: string;
                detail?: string;
              }>;
            };
          };
        }
      )?.response?.data;

      const error = responseData?.errors?.[0];

      const code = error?.code;

      if (code === "no_active_account") {
        msg = t.loginFailed;
      } else if (responseData?.message) {
        msg = responseData.message;
      } else if (responseData?.detail) {
        msg = responseData.detail;
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setError(msg);
      toast.error(msg);
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthModeToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsExternalLogin(e.target.checked);
  };

  const handleLanguageChange = (event: SelectChangeEvent<LanguageCode>) => {
    const nextLanguage = event.target.value as LanguageCode;
    setLanguage(nextLanguage);
    localStorage.setItem(STORAGE_LANGUAGE_KEY, nextLanguage);
    setError("");
  };

  return (
    <div className={styles.loginPage}>
      <section className={styles.heroPanel}>
        <img className={styles.heroImage} src={loginLogo} alt="" />
        <p className={styles.heroTagline}>
          {t.heroPrefix}
          {t.heroAccent ? (
            <>
              {" "}
              <span className={styles.heroTaglineAccent}>{t.heroAccent}</span>
            </>
          ) : null}
        </p>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.topSection}>
          <div className={styles.languageWrap}>
            <FormControl
              size="small"
              variant="outlined"
              className={styles.languageSelect}
            >
              <InputLabel id="language-label">{t.languageLabel}</InputLabel>

              <Select
                labelId="language-label"
                id="language-select"
                value={language}
                onChange={handleLanguageChange}
                label={t.languageLabel}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <MenuItem key={option.code} value={option.code}>
                    {t.languageOptions[option.code]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>

          <img className={styles.logo} src={logo} alt="Vidai" />
        </div>

        <div className={styles.formContent}>
          <form className={styles.loginForm} onSubmit={handleSubmit}>
            <div className={styles.inputGroup}>
              <User size={18} className={styles.inputIcon} aria-hidden="true" />
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={t.usernamePlaceholder}
                autoComplete="username"
                className={styles.inputField}
              />
            </div>

            <div className={styles.inputGroup}>
              <Lock size={18} className={styles.inputIcon} aria-hidden="true" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t.passwordPlaceholder}
                autoComplete="current-password"
                className={styles.inputField}
              />
              <button
                type="button"
                className={styles.eyeButton}
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? t.hidePassword : t.showPassword}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {error ? <p className={styles.errorText}>{error}</p> : null}

            <FormControlLabel
              control={
                <Checkbox
                  checked={isExternalLogin}
                  onChange={handleAuthModeToggle}
                  size="small"
                />
              }
              label="Use client portal login"
            />

            <button
              className={styles.loginButton}
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <CircularProgress
                    size={16}
                    color="inherit"
                    style={{ marginRight: 8 }}
                  />
                  Logging in...
                </>
              ) : (
                t.loginButton
              )}
            </button>

            <button type="button" className={styles.forgotButton}>
              {t.forgotPassword}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
