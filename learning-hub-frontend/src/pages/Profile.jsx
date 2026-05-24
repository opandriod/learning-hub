import { useEffect, useMemo, useState } from "react";
import API from "../api/api";
import ThemeToggle from "../components/ThemeToggle";
import { getProfilePhoto, getStudyStreak, isStaffRole, saveProfilePhoto } from "../utils/achievements";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const blockedIndianMobileNumbers = new Set([
  "0000000000",
  "1111111111",
  "2222222222",
  "3333333333",
  "4444444444",
  "5555555555",
  "6666666666",
  "7777777777",
  "8888888888",
  "9999999999",
  "1234567890",
  "0123456789",
  "9876543210",
]);

function getIndianLocalDigits(value) {
  let digits = (value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  return digits;
}

function validateAndNormalizePhoneInput(value) {
  const raw = (value || "").trim();
  if (!raw) return { phone: "", error: "" };

  const local10 = getIndianLocalDigits(raw);

  if (local10.length !== 10) {
    return { phone: "", error: "Phone number must be a valid 10-digit Indian mobile number." };
  }

  if (!["6", "7", "8", "9"].includes(local10[0])) {
    return { phone: "", error: "Phone number must start with 6, 7, 8, or 9." };
  }

  if (new Set(local10).size === 1 || blockedIndianMobileNumbers.has(local10)) {
    return { phone: "", error: "Please enter a real phone number, not a repeated or test number." };
  }

  return { phone: `+91${local10}`, error: "" };
}

function Profile() {
  const [profile, setProfile] = useState(null);
  const [semesterId, setSemesterId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [message, setMessage] = useState("");
  const [detailsMessage, setDetailsMessage] = useState("");
  const [photoMessage, setPhotoMessage] = useState("");
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  const [detailsForm, setDetailsForm] = useState({
    name: "",
    phone: "",
    email: "",
  });

  const loadProfile = async () => {
    const res = await API.get("/auth/me");
    setProfile(res.data);
    setSemesterId(res.data.semester_id || "");
    return res.data;
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        await loadProfile();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const averageScore = useMemo(() => {
    if (!profile?.recent_quiz_results?.length) return 0;
    const total = profile.recent_quiz_results.reduce((sum, item) => sum + item.percentage, 0);
    return Math.round(total / profile.recent_quiz_results.length);
  }, [profile]);

  const phoneEmailMatch = profile?.email?.match(/^phone_(\d+)@learninghub\.local$/i);
  const isGeneratedPhoneEmail = Boolean(phoneEmailMatch);
  const isGeneratedPhoneName = /^phone\s+\d+$/i.test(profile?.name || "");
  const phoneFromGeneratedEmail = phoneEmailMatch ? `+${phoneEmailMatch[1]}` : "";

  const displayName = isGeneratedPhoneName ? "Not set" : profile?.name || "Not set";
  const displayEmail = isGeneratedPhoneEmail ? "Not linked" : profile?.email || "Not linked";
  const displayPhone = profile?.phone || profile?.mobile || phoneFromGeneratedEmail || "Not linked";
  const isStaff = isStaffRole(profile || {});
  const studyStreakDays = getStudyStreak(profile || {});
  const profilePhoto = profile?.profile_photo || getProfilePhoto(profile || {});
  const profilePhotoUnlocked = isStaff || Boolean(profilePhoto) || studyStreakDays >= 30;
  const profileInitials = (displayName && displayName !== "Not set" ? displayName : profile?.email || "LH").slice(0, 2).toUpperCase();

  const startEditingDetails = () => {
    setDetailsMessage("");
    setDetailsForm({
      name: displayName === "Not set" ? "" : displayName,
      phone: displayPhone === "Not linked" ? "" : displayPhone,
      email: displayEmail === "Not linked" ? "" : displayEmail,
    });
    setEditingDetails(true);
  };

  const cancelEditingDetails = () => {
    setDetailsMessage("");
    setEditingDetails(false);
  };

  const handleDetailsChange = (field, value) => {
    setDetailsForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleDetailsSave = async () => {
    try {
      setSaving(true);
      setDetailsMessage("");

      const name = detailsForm.name.trim();
      const { phone, error: phoneError } = validateAndNormalizePhoneInput(detailsForm.phone);

      if (!name) {
        setDetailsMessage("Please enter your real name.");
        return;
      }

      if (phoneError) {
        setDetailsMessage(phoneError);
        return;
      }

      await API.put("/auth/me", {
        name,
        phone,
        semester_id: semesterId || undefined,
      });

      const updatedProfile = await loadProfile();
      localStorage.setItem("name", updatedProfile.name || name);
      if (updatedProfile.semester_id) {
        localStorage.setItem("semester_id", updatedProfile.semester_id);
      }

      setEditingDetails(false);
      setDetailsMessage("Account details updated successfully.");
    } catch (err) {
      setDetailsMessage(err.response?.data?.error || "Failed to update account details.");
    } finally {
      setSaving(false);
    }
  };

  const handleSemesterUpdate = async () => {
    try {
      setSaving(true);
      setMessage("");
      await API.put("/auth/me", { semester_id: semesterId });
      localStorage.setItem("semester_id", semesterId);
      await loadProfile();
      setMessage("Semester updated successfully");
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to update semester");
    } finally {
      setSaving(false);
    }
  };

  const handleProfilePhotoUpload = (event) => {
    const file = event.target.files?.[0];
    setPhotoMessage("");
    if (!file) return;
    if (!profilePhotoUnlocked) {
      setPhotoMessage("Profile photo upload unlocks after a 30-day study streak.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setPhotoMessage("Please choose a valid image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoMessage("Please choose an image under 2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || "");
      setPhotoSaving(true);
      try {
        await API.put("/auth/me", { profile_photo: dataUrl });
        saveProfilePhoto(profile || {}, dataUrl);
        setProfile((prev) => ({ ...(prev || {}), profile_photo: dataUrl }));
        setPhotoMessage("Profile photo updated. It will now sync on your other devices.");
      } catch (err) {
        saveProfilePhoto(profile || {}, dataUrl);
        setProfile((prev) => ({ ...(prev || {}), profile_photo: dataUrl }));
        setPhotoMessage(err.response?.data?.error || "Saved on this device, but could not sync to server.");
      } finally {
        setPhotoSaving(false);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  if (loading) {
    return <div className="pageWrap"><div className="card skeletonCard"><div className="skeleton skeletonLine" style={{width:"45%",height:32}}></div><div className="skeleton skeletonLine" style={{width:"90%"}}></div><div className="skeleton skeletonLine" style={{width:"75%"}}></div></div></div>;
  }

  if (!profile) {
    return <div className="pageWrap"><h1>Profile not found</h1></div>;
  }

  return (
    <div className="pageWrap">
      <div className="pageHeader profileHeaderCard">
        <div>
          <h1>My Profile</h1>
          <p className="muted">View your progress and update your account details.</p>
        </div>
      </div>

      <div className="card profilePhotoManagerCard">
        <button
          type="button"
          className={`profilePhotoLarge ${profilePhoto ? "hasPhoto" : ""}`}
          onClick={() => profilePhoto && setPhotoPreviewOpen(true)}
          title={profilePhoto ? "Click to view profile photo" : "Default Learning Hub profile logo"}
        >
          {profilePhoto ? <img src={profilePhoto} alt="Profile" /> : <img src="/logo-website.png" alt="Learning Hub default profile" />}
        </button>
        <div className="profilePhotoManagerText">
          <span className="studentKicker">Profile picture</span>
          <h2>{displayName}</h2>
          <p className="muted">
            {profilePhotoUnlocked
              ? "Upload your profile picture here. Click the image to view it larger."
              : "Profile photo upload unlocks after a 30-day study streak. The Learning Hub logo is shown until then."}
          </p>
          <label className={`uploadMiniButton ${profilePhotoUnlocked ? "" : "locked"}`}>
            {photoSaving ? "Saving..." : profilePhotoUnlocked ? "Upload photo" : "Locked"}
            <input type="file" accept="image/*" onChange={handleProfilePhotoUpload} disabled={!profilePhotoUnlocked || photoSaving} />
          </label>
          {photoMessage ? <p className="muted smallText profileMiniAlert">{photoMessage}</p> : null}
        </div>
      </div>

      {photoPreviewOpen && profilePhoto ? (
        <div className="photoPreviewOverlay" role="dialog" aria-modal="true" onClick={() => setPhotoPreviewOpen(false)}>
          <button type="button" className="photoPreviewClose" onClick={() => setPhotoPreviewOpen(false)}>×</button>
          <img src={profilePhoto} alt="Profile preview" onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}

      <div className="statsGrid profileStatsGrid">
        <div className="statCard profileStatCard"><h3>{profile.courses_count}</h3><p>Courses</p></div>
        <div className="statCard profileStatCard"><h3>{profile.completed_lessons}</h3><p>Completed Lessons</p></div>
        <div className="statCard profileStatCard"><h3>{profile.mock_test_total_score}</h3><p>Total Mock Score</p></div>
        <div className="statCard profileStatCard"><h3>{averageScore}%</h3><p>Avg Quiz Score</p></div>
      </div>

      <div className="gridTwo">
        <div className="card editableProfileCard">
          <div className="cardTitleRow">
            <h2>Account Details</h2>
            {!editingDetails ? (
              <button type="button" className="secondaryButton smallActionButton" onClick={startEditingDetails}>
                Edit
              </button>
            ) : null}
          </div>

          {!editingDetails ? (
            <>
              <div className="infoList">
                <p><strong>Name:</strong> {displayName}</p>
                <p><strong>Phone:</strong> {displayPhone}</p>
                <p><strong>Email:</strong> {displayEmail}</p>
                <p><strong>Role:</strong> {profile.role}</p>
                <p><strong>Status:</strong> {profile.status}</p>
              </div>

              {detailsMessage ? <p className="alertSuccess profileMiniAlert">{detailsMessage}</p> : null}
              {displayName === "Not set" || displayEmail === "Not linked" || displayPhone === "Not linked" ? (
                <p className="muted smallText profileHint">
                  Tip: Add your name and phone number here. Login email changes must use Supabase Auth confirmation so the account stays synced.
                </p>
              ) : null}
            </>
          ) : (
            <div className="profileEditForm">
              <label>
                <span>Full Name</span>
                <input
                  type="text"
                  value={detailsForm.name}
                  onChange={(e) => handleDetailsChange("name", e.target.value)}
                  placeholder="Enter your full name"
                />
              </label>

              <label>
                <span>Phone Number</span>
                <input
                  type="tel"
                  value={detailsForm.phone}
                  onChange={(e) => handleDetailsChange("phone", e.target.value)}
                  placeholder="+919876543210"
                />
                <small className="muted">Indian mobile only. Example: +919876543210. Obvious fake numbers are rejected.</small>
              </label>

              <label>
                <span>Email Address</span>
                <input
                  type="email"
                  value={detailsForm.email}
                  readOnly
                  placeholder="name@gmail.com"
                />
                <small className="muted">Login email is managed by Supabase Auth. Do not change it directly in the profile table.</small>
              </label>

              {detailsMessage ? <p className="alertError profileMiniAlert">{detailsMessage}</p> : null}

              <div className="profileEditActions">
                <button type="button" onClick={handleDetailsSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Details"}
                </button>
                <button type="button" className="secondaryButton" onClick={cancelEditingDetails} disabled={saving}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="card profileSettingsCard">
          <h2>Settings</h2>
          <p className="muted">Change your app theme and current semester from your profile.</p>

          <div className="profileThemeRow">
            <div>
              <strong>Theme</strong>
              <p className="muted smallText">Default, Light, or Dark mode</p>
            </div>
            <ThemeToggle profile={profile} />
          </div>

          <div className="settingsDivider" />

          <label className="profileSettingLabel">
            <span>Current Semester</span>
            <select value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
              <option value="">Select semester</option>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
              <option value="3">Semester 3</option>
              <option value="4">Semester 4</option>
              <option value="5">Semester 5</option>
              <option value="6">Semester 6</option>
            </select>
          </label>
          <button onClick={handleSemesterUpdate} disabled={saving} className="primaryButton">
            {saving ? "Saving..." : "Save Semester"}
          </button>
          {message ? <p className="muted" style={{ marginTop: 12 }}>{message}</p> : null}
        </div>
      </div>

      <div className="card recentQuizProfileCard">
        <h2>Recent Quiz Results</h2>
        {!(profile.recent_quiz_results || []).length ? (
          <p className="muted">No quiz attempts yet.</p>
        ) : (
          <div className="simpleList">
            {(profile.recent_quiz_results || []).map((item, index) => (
              <div key={index} className="listRow">
                <div>
                  <strong>{item.course_title}</strong>
                  <p className="muted smallText">{item.lesson_title}</p>
                </div>
                <span>{item.percentage}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Profile;
