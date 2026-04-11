import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AppBar,
  Avatar,
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Popover,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import CalendarIcon from "@/assets/icons/calendar.svg";
import NotificationIcon from "@/assets/icons/notification.svg";
import MessageQuestionIcon from "@/assets/icons/message-question.svg";
import { DynamicBreadcrumbs } from "../../utils/BreadCrumbs";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchClinic,
  selectClinic,
  // setSelectedClinic,
  // selectClinic
} from "../../store/clinicSlice";
import type { AppDispatch } from "../../store";
import { clearAuth, selectUser, setUser } from "../../store/authSlice";
// import { fetchCampaign } from "../../store/campaignSlice";
import { fetchAllTemplates } from "../../store/templateSlice";
import PersonIcon from "@mui/icons-material/Person";
import EmailIcon from "@mui/icons-material/Email";
import BusinessIcon from "@mui/icons-material/Business";
import WorkIcon from "@mui/icons-material/Work";
import LogoutIcon from "@mui/icons-material/Logout";
import { clinicApi } from "../../services/clinic.api";
import { fetchLeads } from "../../store/leadSlice";
import { fetchUsers } from "../../store/userSlice";
import { authApi } from "../../services/auth.api";
import { toast } from "react-toastify";
import { getAvatarLetter } from "../../utils/avatar";
import { toSafePhotoUrl } from "../../utils/mediaUrl";

const MAX_PROFILE_PHOTO_SIZE = 20 * 1024 * 1024;

const Header = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const dbClinic = useSelector(selectClinic);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  type DropdownClinic = { id: number; name: string; isDefault: boolean };

  const [dbClinics, setDbClinics] = useState<DropdownClinic[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<number | null>(null);
  const [photoAnchorEl, setPhotoAnchorEl] = useState<HTMLElement | null>(null);
  const [isPhotoUpdating, setIsPhotoUpdating] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const lastFetchedClinicIdRef = useRef<number | null>(null);

  const userClinics = useMemo<DropdownClinic[]>(() => {
    const raw = Array.isArray(user?.clinics) ? user.clinics : [];
    return raw
      .map((clinic) => {
        const clinicId =
          typeof clinic?.clinic_id === "number"
            ? clinic.clinic_id
            : (clinic as { id?: unknown })?.id;
        const clinicName =
          clinic?.clinic__name ||
          (clinic as { clinic_name?: string })?.clinic_name ||
          (clinic as { name?: string })?.name;
        if (typeof clinicId !== "number" || !clinicName) return null;

        return {
          id: clinicId,
          name: clinicName,
          isDefault: clinic.is_default === true,
        };
      })
      .filter((clinic): clinic is DropdownClinic => clinic !== null);
  }, [user]);

  const clinics = dbClinics.length > 0 ? dbClinics : userClinics;

  const displayClinicName =
    clinics.find((clinic) => clinic.id === selectedClinicId)?.name ||
    dbClinic?.name ||
    "-";

  const [clinicAnchor, setClinicAnchor] = useState<null | HTMLElement>(null);

  const handleClinicOpen = (e: React.MouseEvent<HTMLElement>) =>
    setClinicAnchor(e.currentTarget);

  const handleClinicClose = () => setClinicAnchor(null);

  /* ================= ICON MENU STATE ================= */
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [activeMenu, setActiveMenu] = useState<
    "calendar" | "notification" | "help" | null
  >(null);

  useEffect(() => {
    const loadClinics = async () => {
      try {
        const res = await clinicApi.list();
        const payload = res.data as
          | {
              results?: Array<{ id: number; name: string }>;
              data?: Array<{ id: number; name: string }>;
            }
          | Array<{ id: number; name: string }>;

        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.results)
            ? payload.results
            : Array.isArray(payload?.data)
              ? payload.data
              : [];

        const normalized = list
          .map((clinic) => {
            if (typeof clinic?.id !== "number" || !clinic?.name) return null;
            return { id: clinic.id, name: clinic.name, isDefault: false };
          })
          .filter((clinic): clinic is DropdownClinic => clinic !== null);

        if (normalized.length > 0) {
          setDbClinics(normalized);
        }
      } catch {
        // Keep fallback to profile clinics if list endpoint is unavailable.
      }
    };

    loadClinics();
  }, []);

  useEffect(() => {
    if (clinics.length === 0) return;
    if (
      selectedClinicId &&
      clinics.some((clinic) => clinic.id === selectedClinicId)
    ) {
      return;
    }

    const storedClinicId =
      Number(localStorage.getItem("clinic_id") || 0) || null;
    const allowedClinics = userClinics.length > 0 ? userClinics : clinics;
    const validStored =
      storedClinicId &&
      allowedClinics.some((clinic) => clinic.id === storedClinicId)
        ? storedClinicId
        : null;
    const defaultClinicId =
      allowedClinics.find((clinic) => clinic.isDefault)?.id ||
      allowedClinics[0]?.id ||
      null;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedClinicId(validStored || defaultClinicId);
  }, [clinics, selectedClinicId, userClinics]);

  useEffect(() => {
    const hydrateClinic = async () => {
      if (!selectedClinicId) return;
      if (lastFetchedClinicIdRef.current === selectedClinicId) return;

      lastFetchedClinicIdRef.current = selectedClinicId;
      await dispatch(fetchClinic(selectedClinicId));
      await dispatch(fetchLeads());
    };

    hydrateClinic();
  }, [dispatch, selectedClinicId]);

  useEffect(() => {
    // dispatch(fetchCampaign());
    dispatch(fetchAllTemplates());
  }, [dispatch]);

  const handleIconClick = (
    event: React.MouseEvent<HTMLElement>,
    type: "calendar" | "notification" | "help",
  ) => {
    setAnchorEl(event.currentTarget);
    setActiveMenu(type);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setActiveMenu(null);
  };

  const [userAnchorEl, setUserAnchorEl] = useState<null | HTMLElement>(null);
  const handleUserMenuOpen = (e: React.MouseEvent<HTMLElement>) =>
    setUserAnchorEl(e.currentTarget);
  const handleUserMenuClose = () => setUserAnchorEl(null);
  const handlePhotoPopoverOpen = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setPhotoAnchorEl(e.currentTarget);
  };
  const handlePhotoPopoverClose = () => setPhotoAnchorEl(null);
  const handleLogout = () => {
    handleUserMenuClose();
    dispatch(clearAuth());
    navigate("/login", { replace: true });
  };

  const iconMenus = [
    { icon: CalendarIcon, type: "calendar" },
    { icon: NotificationIcon, type: "notification" },
    { icon: MessageQuestionIcon, type: "help" },
  ] as const;

  const displayUserName =
    `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() ||
    user?.username ||
    user?.email ||
    "-";
  const avatarLetter = getAvatarLetter(
    user?.first_name,
    user?.username,
    user?.email,
  );
  const canManageOwnPhoto = Boolean(user?.id || user?.user_id);

  const applyUpdatedProfile = (updatedProfile: Record<string, unknown>) => {
    if (!user) return;

    const nextPhoto =
      typeof updatedProfile.photo === "string"
        ? updatedProfile.photo.trim() || undefined
        : updatedProfile.photo === null
          ? undefined
          : user.photo;

    dispatch(
      setUser({
        ...user,
        first_name:
          typeof updatedProfile.first_name === "string"
            ? updatedProfile.first_name
            : user.first_name,
        last_name:
          typeof updatedProfile.last_name === "string"
            ? updatedProfile.last_name
            : user.last_name,
        photo: nextPhoto,
      }),
    );
  };

  const handleProfilePhotoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_PROFILE_PHOTO_SIZE) {
      toast.error("Profile photo must be 20MB or smaller");
      e.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("photo", file);

    setIsPhotoUpdating(true);
    try {
      const updatedProfile = await authApi.updateMyPhoto(formData);
      applyUpdatedProfile(updatedProfile as Record<string, unknown>);
      toast.success("Profile photo updated successfully");
      await dispatch(fetchUsers());
      handlePhotoPopoverClose();
    } catch (error) {
      console.error("Failed to update profile photo", error);
      toast.error("Failed to update profile photo");
    } finally {
      setIsPhotoUpdating(false);
      e.target.value = "";
    }
  };

  const handleDeleteProfilePhoto = async () => {
    setIsPhotoUpdating(true);
    try {
      const formData = new FormData();
      formData.append("remove_photo", "true");
      const updatedProfile = await authApi.updateMyPhoto(formData);
      applyUpdatedProfile(updatedProfile as Record<string, unknown>);
      toast.success("Profile photo removed successfully");
      await dispatch(fetchUsers());
      handlePhotoPopoverClose();
      setIsPreviewOpen(false);
    } catch (error) {
      console.error("Failed to remove profile photo", error);
      toast.error("Failed to remove profile photo");
    } finally {
      setIsPhotoUpdating(false);
    }
  };

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        bgcolor: "background.default",
        borderRadius: 2,
        color: "text.primary",
      }}
    >
      <Toolbar sx={{ justifyContent: "space-between", py: 2 }}>
        {/* LEFT: Breadcrumbs */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <DynamicBreadcrumbs />
        </Box>

        {/* RIGHT */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box>
            <Box
              onClick={handleClinicOpen}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                cursor: "pointer",
                background: "#f3f4f6",
                px: 2,
                py: 1,
                borderRadius: 2,
              }}
            >
              <Typography variant="body2">
                Clinic: <b>{displayClinicName}</b>
              </Typography>
              <ArrowDropDownIcon />
            </Box>

            <Menu
              anchorEl={clinicAnchor}
              open={Boolean(clinicAnchor)}
              onClose={handleClinicClose}
            >
              {clinics.map((c) => (
                <MenuItem
                  key={c.id}
                  onClick={async () => {
                    setSelectedClinicId(c.id);
                    handleClinicClose();
                  }}
                >
                  {c.name || "-"}
                </MenuItem>
              ))}
            </Menu>
          </Box>

          {iconMenus.map(({ icon, type }) => (
            <IconButton
              key={type}
              onClick={(e) => handleIconClick(e, type)}
              sx={{
                width: 48,
                height: 48,
                backgroundColor: "#fff",
                borderRadius: 1,
              }}
            >
              <Box component="img" src={icon} width={24} />
            </IconButton>
          ))}

          {/* USER */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Avatar
              src={toSafePhotoUrl(user?.photo) || undefined}
              onClick={handlePhotoPopoverOpen}
              sx={{
                width: 36,
                height: 36,
                borderRadius: "10px",
                bgcolor: "#F3E8E2",
                color: "#A4471C",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {avatarLetter}
            </Avatar>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                cursor: "pointer",
              }}
              onClick={handleUserMenuOpen}
            >
              <Box sx={{ display: { xs: "none", sm: "block" } }}>
                <Typography fontWeight={600}>{displayUserName}</Typography>

                <Typography fontSize={12} color="#6b7280">
                  {user?.designation_label || user?.designation || "—"}
                </Typography>
              </Box>
              <IconButton size="small">
                <ArrowDropDownIcon />
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Toolbar>

      {/* ICON MENU */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {activeMenu === "calendar" && (
          <MenuItem disabled>No events for today</MenuItem>
        )}
        {activeMenu === "notification" && (
          <MenuItem disabled>No notifications</MenuItem>
        )}
        {activeMenu === "help" && <MenuItem disabled>No messages</MenuItem>}
      </Menu>

      {/* USER MENU */}
      <Menu
        anchorEl={userAnchorEl}
        open={Boolean(userAnchorEl)}
        onClose={handleUserMenuClose}
      >
        <MenuItem disabled>
          <PersonIcon sx={{ mr: 1 }} />
          {displayUserName}
        </MenuItem>

        <MenuItem disabled>
          <EmailIcon sx={{ mr: 1 }} />
          {user?.email || "-"}
        </MenuItem>

        <MenuItem disabled>
          <BusinessIcon sx={{ mr: 1 }} />
          {displayClinicName}
        </MenuItem>

        {(user?.designation_label || user?.designation) && (
          <MenuItem disabled>
            <WorkIcon sx={{ mr: 1 }} />
            {user?.designation_label || "-"}
          </MenuItem>
        )}

        <MenuItem onClick={handleLogout} sx={{ color: "red", fontWeight: 600 }}>
          <LogoutIcon sx={{ mr: 1 }} />
          Logout
        </MenuItem>
      </Menu>

      <Popover
        open={Boolean(photoAnchorEl)}
        anchorEl={photoAnchorEl}
        onClose={handlePhotoPopoverClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          sx: {
            mt: 1,
            p: 1.5,
            borderRadius: 3,
            width: 260,
          },
        }}
      >
        <Stack spacing={1.5} alignItems="center">
          <Avatar
            src={toSafePhotoUrl(user?.photo) || undefined}
            onClick={() => {
              if (user?.photo) {
                setIsPreviewOpen(true);
              }
            }}
            sx={{
              width: 180,
              height: 180,
              fontSize: 56,
              fontWeight: 700,
              bgcolor: "#F3E8E2",
              color: "#A4471C",
              cursor: user?.photo ? "zoom-in" : "default",
            }}
          >
            {avatarLetter}
          </Avatar>
          <Typography fontWeight={600} textAlign="center">
            {displayUserName}
          </Typography>
          <Divider flexItem />
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              onClick={() => profilePhotoInputRef.current?.click()}
              disabled={!canManageOwnPhoto || isPhotoUpdating}
              sx={{ bgcolor: "#F6F6F6" }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton
              onClick={handleDeleteProfilePhoto}
              disabled={!user?.photo || !canManageOwnPhoto || isPhotoUpdating}
              sx={{ bgcolor: "#FFF1F1", color: "#D32F2F" }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
            {isPhotoUpdating && <CircularProgress size={22} />}
          </Stack>
        </Stack>
      </Popover>

      <Dialog
        open={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        maxWidth="xs"
      >
        <DialogContent sx={{ p: 1.5 }}>
          <Avatar
            src={toSafePhotoUrl(user?.photo) || undefined}
            sx={{
              width: 320,
              height: 320,
              maxWidth: "80vw",
              maxHeight: "80vw",
              bgcolor: "#F3E8E2",
              color: "#A4471C",
              fontSize: 96,
              fontWeight: 700,
            }}
          >
            {avatarLetter}
          </Avatar>
        </DialogContent>
      </Dialog>

      <input
        ref={profilePhotoInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleProfilePhotoFileChange}
      />
    </AppBar>
  );
};

export default Header;
