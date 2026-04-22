"use client";

import { useEffect, useState } from "react";
import { getApiBase } from "@/lib/apiBase";

export default function ProfilePage() {
  const apiBase = getApiBase();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${apiBase}/me/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load profile");
        const data = await res.json();
        setProfile(data);
        setName(data.name || "");
        setUsername(data.username || "");
      } catch (error) {
        setMessage(error.message || "Could not load profile");
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [apiBase]);

  const saveProfile = async () => {
    setSaving(true);
    setMessage("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiBase}/me/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, username, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to update profile");
      }
      const data = await res.json();
      setProfile(data);
      setPassword("");
      setMessage("Profile updated successfully.");
    } catch (error) {
      setMessage(error.message || "Could not update profile");
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const token = localStorage.getItem("token");
      const form = new FormData();
      form.append("image", file);
      const res = await fetch(`${apiBase}/me/profile-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to upload image");
      }
      const data = await res.json();
      setProfile(data);
      setMessage("Profile image updated.");
    } catch (error) {
      setMessage(error.message || "Could not upload image");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  if (loading) return <div style={{ color: "var(--text-muted)" }}>Loading profile...</div>;

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.6rem" }}>My Profile</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
        View and update your profile details, password, and photo.
      </p>
      {message && <div style={{ marginBottom: "0.8rem", color: "#f59e0b" }}>{message}</div>}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              overflow: "hidden",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              background: "rgba(255,255,255,0.06)",
            }}
          >
            {profile?.profile_image_url ? (
              <img src={`${apiBase}${profile.profile_image_url}`} alt={profile.name || profile.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              (profile?.name || profile?.username || "U")
                .split(/\s+/)
                .slice(0, 2)
                .map((n) => n[0]?.toUpperCase() || "")
                .join("")
            )}
          </div>
          <div>
            <label className="btn-primary" style={{ cursor: uploading ? "not-allowed" : "pointer", opacity: uploading ? 0.8 : 1 }}>
              {uploading ? "Uploading..." : "Upload Image"}
              <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={uploadImage} style={{ display: "none" }} disabled={uploading} />
            </label>
          </div>
        </div>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <input className="input-field glass" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input-field glass" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input className="input-field glass" type="password" placeholder="New password (optional)" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="btn-primary" onClick={saveProfile} disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
