import React, { useState, useEffect } from "react";
import { fetchProfile, updateProfile, changePassword } from "../http/userAPI";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import styles from "./ProfileSettings.module.css";

const ProfileSettings = ({ onBack }) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [editField, setEditField] = useState(null);
  const [errors, setErrors] = useState({}); // ✅ Добавили useState для ошибок
  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    phone: "",
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [cookiePreferences, setCookiePreferences] = useState({
    analytics: false,
    marketing: false,
    functional: false,
    personalization: false,
  });

  useEffect(() => {
    fetchProfile().then((data) => {
      setProfile({
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        phone: data.phone || "",
      });
    });
  }, []);

  const handleEdit = (field) => {
    setEditField(field);
    setErrors({});
  };

 const handleSave = async () => {
    if (editField === "password") {
      await handlePasswordChange();
    } else {
      if (!profile[editField]) {
        setErrors((prev) => ({
          ...prev,
          [editField]: t("emptyField", { ns: "profileSettings" }),
        }));
        return;
      }

      try {
        await updateProfile(profile);
        setEditField(null);
        toast.success(t("updateSuccess", { ns: "profileSettings" }));
      } catch (error) {
        toast.error(
          error.response?.data?.message ||
            t("updateError", { ns: "profileSettings" })
        );
      }
    }
  };

  const handlePasswordChange = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordData;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrors({
        currentPassword: !currentPassword
          ? t("emptyField", { ns: "profileSettings" })
          : "",
        newPassword: !newPassword
          ? t("emptyField", { ns: "profileSettings" })
          : "",
        confirmPassword: !confirmPassword
          ? t("emptyField", { ns: "profileSettings" })
          : "",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t("passwordMismatch", { ns: "profileSettings" }));
      return;
    }

    try {
      await changePassword({ currentPassword, newPassword });
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setEditField(null);
      toast.success(t("passwordUpdateSuccess", { ns: "profileSettings" }));
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          t("passwordUpdateError", { ns: "profileSettings" })
      );
    }

    useEffect(() => {
      const savedPreferences = JSON.parse(
        localStorage.getItem("cookiePreferences")
      );
      if (savedPreferences) {
        setCookiePreferences(savedPreferences);
      }
    }, []);
  };

  const handleCookieChange = (type) => {
    setCookiePreferences((prev) => {
      const updatedPreferences = { ...prev, [type]: !prev[type] };
      localStorage.setItem(
        "cookiePreferences",
        JSON.stringify(updatedPreferences)
      );
      return updatedPreferences;
    });
  };

  useEffect(() => {
    const savedPreferences = JSON.parse(
      localStorage.getItem("cookiePreferences")
    );
    if (savedPreferences) {
      setCookiePreferences(savedPreferences);
    }
  }, []);

  return (
    <div className={styles.settingsWrapper}>
      <div className={styles.mainContent}>
        <div className={styles.buttonsContainer}>
          <button className={styles.backButton} onClick={() => navigate(-1)}>
            {t("back", { ns: "userProfile" })}
          </button>
        </div>

        <div className={styles.profileContainer}>
          <h1 className={styles.settingsHeader}>
            {t("settingsHeader", { ns: "profileSettings" })}
          </h1>

          {["firstName", "lastName", "phone"].map((field) => (
            <div key={field} className={styles.profileItem}>
              <span>
                {field === "firstName"
                  ? t("firstName", { ns: "profileSettings" })
                  : field === "lastName"
                  ? t("lastName", { ns: "profileSettings" })
                  : t("phone", { ns: "profileSettings" })}
                :
              </span>
              {editField === field ? (
                <>
                  <input
                    type="text"
                    value={profile[field]}
                    onChange={(e) =>
                      setProfile({ ...profile, [field]: e.target.value })
                    }
                  />
                  {errors[field] && (
                    <span className={styles.errorText}>{errors[field]}</span>
                  )}
                </>
              ) : (
                <span>{profile[field]}</span>
              )}
              <button
                className={styles.editButton}
                onClick={() =>
                  editField === field ? handleSave() : handleEdit(field)
                }
              >
                {editField === field
                  ? t("save", { ns: "profileSettings" })
                  : t("edit", { ns: "profileSettings" })}
              </button>
            </div>
          ))}

          <div className={styles.profileItem}>
            <span>{t("password", { ns: "profileSettings" })}</span>
            {editField === "password" ? (
              <div className={styles.passwordInputs}>
                {["currentPassword", "newPassword", "confirmPassword"].map(
                  (field, index) => (
                    <div key={index}>
                      <input
                        type="password"
                        placeholder={
                          field === "currentPassword"
                            ? t("currentPassword", { ns: "profileSettings" })
                            : field === "newPassword"
                            ? t("newPassword", { ns: "profileSettings" })
                            : t("confirmPassword", { ns: "profileSettings" })
                        }
                        value={passwordData[field]}
                        onChange={(e) =>
                          setPasswordData({
                            ...passwordData,
                            [field]: e.target.value,
                          })
                        }
                      />
                      {errors[field] && (
                        <span className={styles.errorText}>
                          {errors[field]}
                        </span>
                      )}
                    </div>
                  )
                )}
              </div>
            ) : (
              <span>*******</span>
            )}
            <button
              className={styles.editButton}
              onClick={() =>
                editField === "password" ? handleSave() : handleEdit("password")
              }
            >
              {editField === "password"
                ? t("save", { ns: "profileSettings" })
                : t("edit", { ns: "profileSettings" })}
            </button>
          </div>

          <div className={styles.cookieSettings}>
            <h3 className={styles.cookieHeaderTitle}>
              {t("cookieHeader", { ns: "profileSettings" })}
            </h3>

            <label className={styles.cookieOption}>
              <div className={styles.checkboxWrapper}>
                <input
                  type="checkbox"
                  checked={cookiePreferences.analytics}
                  onChange={() => handleCookieChange("analytics")}
                />
              </div>
              <span>{t("analytics", { ns: "profileSettings" })}</span>
            </label>

            <label className={styles.cookieOption}>
              <div className={styles.checkboxWrapper}>
                <input
                  type="checkbox"
                  checked={cookiePreferences.marketing}
                  onChange={() => handleCookieChange("marketing")}
                />
              </div>
              <span>{t("marketing", { ns: "profileSettings" })}</span>
            </label>

            <label className={styles.cookieOption}>
              <div className={styles.checkboxWrapper}>
                <input
                  type="checkbox"
                  checked={cookiePreferences.functional}
                  onChange={() => handleCookieChange("functional")}
                />
              </div>
              <span>{t("functional", { ns: "profileSettings" })}</span>
            </label>

            <label className={styles.cookieOption}>
              <div className={styles.checkboxWrapper}>
                <input
                  type="checkbox"
                  checked={cookiePreferences.personalization}
                  onChange={() => handleCookieChange("personalization")}
                />
              </div>
              <span>{t("personalization", { ns: "profileSettings" })}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
