import { useEffect, useMemo, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./App.css";
import api from "./api";

const emptyMember = {
  member_picture: null,
  name: "",
  mobile_no: "",
  Father_name: "",
  village: "",
  member_type: "General",
};
function formatMemberDisplayId(value) {
  if (!value) return "—";
  const parts = String(value).split("-");
  // যদি ফরম্যাট "00002-01-0002" এরকম হয়
  if (parts.length >= 3) {
    return `${parts[1]}-${parts[2]}`; // "01-0002" রিটার্ন করবে
  }
  return value;
}
function formatDateTime(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function calculateAgeYears(birthDate) {
  if (!birthDate) return null;

  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const birthdayHasPassed =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() &&
      today.getDate() >= birth.getDate());

  if (!birthdayHasPassed) age -= 1;
  return age;
}

function titleCaseName(value) {
  return value
    .toLowerCase()
    .replace(/(^|\s)\S/g, (character) => character.toUpperCase());
}

const menuItems = [
  { name: "Dashboard", icon: "bi-grid-1x2-fill" },
  { name: "Members", icon: "bi-people-fill" },
  { name: "Donations", icon: "bi-cash-stack" },
  { name: "Donation Categories", icon: "bi-tags-fill" },
  { name: "Donation Years", icon: "bi-calendar3" },
  { name: "User Profiles", icon: "bi-person-badge-fill" },
  { name: "Receitbook", icon: "bi-receipt-cutoff", adminOnly: true },
];

const memberCountVillages = [
  ["all", "All"],
  ["fakirbari", "Fakirbari"],
  ["borobari", "Borobari"],
  ["horinatola", "Horinatola"],
  ["khalishpur", "Rosulpur"],
  ["chanpur", "Chanpur"],
];
const villageSelectionOptions = memberCountVillages.slice(1);
const villageCodeToValue = {
  "01": "fakirbari",
  "02": "borobari",
  "03": "horinatola",
  "04": "khalishpur",
  "05": "chanpur",
};
const villageValueToCode = {
  fakirbari: "01",
  borobari: "02",
  horinatola: "03",
  khalishpur: "04",
  rosulpur: "04",
  chanpur: "05",
};

function normalizeVillageValue(value) {
  return villageCodeToValue[value] || value;
}

function formatDonationMemberId(value) {
  const [, village, villageSequence] = String(value).split("-");
  const villageCode = villageValueToCode[village?.toLowerCase()] || village;

  return villageCode && villageSequence
    ? `${villageCode}-${villageSequence}`
    : String(value);
}

const pageConfig = {
  Members: {
    endpoint: "accounts/members/",
    columns: [
      ["id", "ID"],
      ["member_picture", "Picture"],
      ["name", "Name"],
      ["mobile_no", "Mobile"],
      ["Father_name", "Father's Name"],
      ["village", "Village"],
      ["member_type", "Member Type"],
    ],
  },
  Donations: {
    endpoint: "accounts/donations/",
    idField: "donation_id",
    addLabel: "Add Donation",
    columns: [
      ["donation_id", "ID"],
      ["member_name", "Member"],       // ✅ Serializer থেকে আসা নাম
      ["receit_id", "Receipt"],        // ✅ Receipt Book ID
      ["category_name", "Category"],   // ✅ Serializer থেকে আসা ক্যাটাগরি নাম
      ["donation_amount", "Amount"],
      ["paid_by", "Paid By"],
      ["donation_date", "Date"],
      ["year_name", "Year"],           // ✅ Serializer থেকে আসা ইয়ারের নাম
    ],
    formFields: [
      {
        key: "receit_id", 
        label: "Receipt Book",
        type: "select",
        optionsEndpoint: "accounts/receitbooks/",
        optionId: "receit_id",
        optionLabel: "receit_id",
        required: true,
      },
      {
        key: "member",                   // ✅ এখানে member_id এর বদলে member হবে
        label: "Member",
        type: "select",
        optionsEndpoint: "accounts/donation-members/",
        optionId: "id",
        optionLabel: "name",
        optionLabelWithId: true,
        required: true,                  // মেম্বার ছাড়া ডোনেশন নিতে না চাইলে
      },
      {
        key: "donation_category",
        label: "Category",
        type: "select",
        optionsEndpoint: "accounts/donation-categories/",
        optionId: "category_id",
        optionLabel: "category_name",
      },
      {
        key: "donation_amount",
        label: "Amount",
        type: "number",
        required: true,
        default: "0.00",
      },
      {
        key: "paid_by",                  // ✅ এই ফিল্ডটি বাদ পড়েছিল
        label: "Paid By",
        type: "select",
        required: true,
        options: [
          ["cash", "Cash"],
          ["bkash", "Bkash"],
          ["nagad", "Nagad"],
          ["rocket", "Rocket"],
        ],
        default: "cash",
      },
      {
        key: "donation_date",            // ✅ এই ফিল্ডটিও বাদ পড়েছিল
        label: "Date",
        type: "date",
        required: true,
      },
      {
        key: "year_id",
        label: "Donation Year",
        type: "select",
        optionsEndpoint: "accounts/donation-years/?active_only=true",
        optionId: "year_id",
        optionLabel: "year_name",
      },
      { 
        key: "description", 
        label: "Description", 
        type: "textarea" 
      },
    ],
  },
  "Donation Categories": {
    endpoint: "accounts/donation-categories/",
    idField: "category_id",
    addLabel: "Add Categories",
    columns: [
      ["category_id", "ID"],
      ["category_name", "Category Name"],
      ["status", "Status"],
    ],
    formFields: [
      { key: "category_name", label: "Category Name", type: "text", required: true },
      { key: "status", label: "Active", type: "checkbox" },
    ],
  },
  "Donation Years": {
    endpoint: "accounts/donation-years/",
    idField: "year_id",
    addLabel: "Add Year",
    columns: [
      ["year_id", "ID"],
      ["year_name", "Year"],
      ["status", "Status"],
    ],
    formFields: [
      { key: "year_name", label: "Year", type: "text", required: true },
      { key: "status", label: "Active", type: "checkbox" },
    ],
  },
  Receitbook: {
    endpoint: "accounts/receitbooks/",
    idField: "receit_id",
    addLabel: "Add Receitbook",
    columns: [
      ["receit_id", "Receipt Book ID"],
      ["for_user_username", "Assigned User"],
      ["prefix", "Prefix"],
      ["start_number", "Start Number"],
      ["end_number", "End Number"],
      ["receit_status", "Status"],
    ],
    formFields: [
      {
        key: "for_user",
        label: "Assigned User",
        type: "select",
        optionsEndpoint: "accounts/user-profiles/",
        optionId: "user",
        optionLabel: "username",
        required: true,
      },
      { key: "prefix", label: "Prefix", type: "text", required: true, default: "RCPT" },
      {
        key: "start_number",
        label: "Start Number",
        type: "number",
        required: true,
        min: 1,
        default: 1,
      },
      {
        key: "end_number",
        label: "End Number",
        type: "number",
        required: true,
        min: 1,
        default: 100,
      },
      {
        key: "receit_status",
        label: "Status",
        type: "select",
        required: true,
        options: [
          ["unused", "Unused"],
          ["used", "Used"],
          ["Rejected", "Rejected"],
        ],
        default: "unused",
      },
      { key: "description", label: "Description", type: "textarea" },
    ],
  },
  "User Profiles": {
    endpoint: "accounts/user-profiles/",
    idField: "profile_id",
    addLabel: "Add Profile",
    columns: [
      ["user_picture", "Picture"],
      ["username", "Username"],
      ["user_role", "Role"],
      ["village_selected_id", "Village"],
    ],
    formFields: [
      { key: "email", label: "Email (optional)", type: "email" },
      { key: "user_picture", label: "Profile Picture", type: "file" },
      {
        key: "is_staff",
        label: "Grant Django admin-site access (is_staff)",
        type: "checkbox",
        default: false,
      },
      {
        key: "village_selected_id",
        label: "Village access",
        type: "multiselect",
        options: villageSelectionOptions,
      },
      {
        key: "user_role",
        label: "Role",
        type: "select",
        required: true,
        options: [
          ["admin", "Admin"],
          ["manager", "Manager"],
          ["assistance", "Assistance"],
          ["member", "Member"],
          ["viewer", "Viewer"],
        ],
      },
      { key: "status", label: "Active", type: "checkbox" },
    ],
  },
};

function authConfig(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

function getList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function AccountAvatar({ picture, username }) {
  return (
    <div className="avatar">
      {picture ? (
        <img src={picture} alt={`${username || "User"} profile`} />
      ) : (
        <i className="bi bi-person-fill" aria-hidden="true" />
      )}
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [accessToken, setAccessToken] = useState(
    () => sessionStorage.getItem("access") || ""
  );
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(
    () => Boolean(sessionStorage.getItem("access"))
  );
  const [profileRetry, setProfileRetry] = useState(0);

  const [activePage, setActivePage] = useState("Dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);

  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberForm, setMemberForm] = useState(emptyMember);
  const [editingMember, setEditingMember] = useState(null);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberMessage, setMemberMessage] = useState("");
  const [memberError, setMemberError] = useState("");
  const isAdmin = Boolean(profile?.is_superuser || profile?.user_role === "admin");
  const canEditMembers = isAdmin || profile?.user_role === "manager";
  const memberVillageOptions = isAdmin
    ? villageSelectionOptions
    : villageSelectionOptions.filter(([value]) =>
        (profile?.village_selected_id || [])
          .map(normalizeVillageValue)
          .includes(value)
      );

  useEffect(() => {
    function handleSessionExpired() {
      setAccessToken("");
      setProfile(null);
      setProfileLoading(false);
      setAuthError("Your session has expired. Please log in again.");
    }

    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () =>
      window.removeEventListener("auth:session-expired", handleSessionExpired);
  }, []);

  useEffect(() => {
    if (!accessToken) {
      setProfile(null);
      setProfileLoading(false);
      return undefined;
    }

    let cancelled = false;
    setProfileLoading(true);

    api
      .get("accounts/profile/", authConfig(accessToken))
      .then((response) => {
        if (!cancelled) {
          setProfile(response.data);
          setProfileLoading(false);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setProfile(null);
        setProfileLoading(false);
        if (error.response?.status === 401) {
          sessionStorage.removeItem("access");
          sessionStorage.removeItem("refresh");
          setAccessToken("");
          setAuthError("Your session has expired. Please log in again.");
        } else if (error.response?.status >= 500) {
          setAuthError(
            `The server could not load your account (HTTP ${error.response.status}). Check the backend logs and apply any pending database migrations.`
          );
        } else {
          setAuthError(
            "Could not load your account. Please check the server and try again."
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, profileRetry]);

  useEffect(() => {
    if (!accessToken || !["Members", "MemberCount"].includes(activePage)) {
      return undefined;
    }

    let cancelled = false;
    setMembersLoading(true);
    setMemberError("");

    api
      .get("accounts/members/", authConfig(accessToken))
      .then((response) => {
        if (!cancelled) setMembers(getList(response.data));
      })
      .catch((error) => {
        if (cancelled) return;

        const status = error.response?.status;
        const detail = error.response?.data?.detail;
        setMemberError(
          status >= 500
            ? `The Members API returned an error (HTTP ${status}). Please check the backend logs.`
            : detail
              ? `Could not load members: ${detail}`
              : status
                ? `Could not load members (HTTP ${status}). Please check the Members API.`
                : "Could not reach the Members API. Please check the server connection."
        );
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activePage, accessToken]);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthMessage("");
    setAuthError("");
    setAuthLoading(true);

    try {
      if (mode === "register") {
        await api.post("accounts/register/", { username, email, password });
        setAuthMessage("Registration successful. Please sign in.");
        setMode("login");
        setPassword("");
      } else {
        const response = await api.post("token/", { username, password });
        sessionStorage.setItem("access", response.data.access);
        sessionStorage.setItem("refresh", response.data.refresh);
        setProfile(null);
        setProfileLoading(true);
        setAccessToken(response.data.access);
      }
    } catch (error) {
      const data = error.response?.data;
      setAuthError(
        typeof data === "string"
          ? data
          : data
            ? JSON.stringify(data)
            : "Request failed. Please check the server and try again."
      );
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("access");
    sessionStorage.removeItem("refresh");
    setAccessToken("");
    setProfile(null);
    setProfileLoading(false);
    setActivePage("Dashboard");
    setMode("login");
    setPassword("");
    setAuthMessage("");
    setAuthError("");
    setMobileOpen(false);
  }

  async function handleMemberSubmit(event) {
    event.preventDefault();
    setMemberMessage("");
    setMemberError("");
    setMemberLoading(true);

    try {
      const data = new FormData();
      Object.entries(memberForm).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== "") {
          data.append(key, value);
        }
      });
      if (editingMember) {
        await api.patch(
          `accounts/members/${editingMember.id}/`,
          data,
          authConfig(accessToken)
        );
        setMemberMessage("Member updated successfully.");
      } else {
        await api.post("accounts/members/", data, authConfig(accessToken));
        setMemberMessage("Member added successfully.");
      }
      setEditingMember(null);
      setMemberForm({ ...emptyMember });
      const response = await api.get("accounts/members/", authConfig(accessToken));
      setMembers(getList(response.data));
      setActivePage("Members");
    } catch (error) {
      const data = error.response?.data;
      setMemberError(
        data ? JSON.stringify(data) : "Failed to save member. Please try again."
      );
    } finally {
      setMemberLoading(false);
    }
  }

  async function handleMemberDelete(member) {
    if (!window.confirm(`Delete the member record for ${member.name}?`)) return;

    setMemberError("");
    setMemberMessage("");
    try {
      await api.delete(`accounts/members/${member.id}/`, authConfig(accessToken));
      setMemberMessage("Member deleted successfully.");
      const response = await api.get("accounts/members/", authConfig(accessToken));
      setMembers(getList(response.data));
    } catch (error) {
      const data = error.response?.data;
      setMemberError(
        data ? JSON.stringify(data) : "Failed to delete member. Please try again."
      );
    }
  }

  if (!accessToken) {
    return (
      <div className="login-screen">
        <form className="login-card" onSubmit={handleAuthSubmit}>
          <div className="brand-icon"><i className="bi bi-moon-stars-fill" /></div>
          <h3 className="fw-bold mt-3 mb-1">Mosque Management</h3>
          <p className="text-secondary mb-4">Sign in to manage your dashboard</p>

          <div className="btn-group w-100 mb-3" role="group" aria-label="Authentication mode">
            <button
              type="button"
              className={`btn ${mode === "login" ? "btn-success" : "btn-outline-success"}`}
              onClick={() => { setMode("login"); setAuthMessage(""); setAuthError(""); }}
            >
              Login
            </button>
            <button
              type="button"
              className={`btn ${mode === "register" ? "btn-success" : "btn-outline-success"}`}
              onClick={() => { setMode("register"); setAuthMessage(""); setAuthError(""); }}
            >
              Register
            </button>
          </div>

          {authMessage && <div className="alert alert-success">{authMessage}</div>}
          {authError && <div className="alert alert-danger">{authError}</div>}

          <label className="form-label mt-2">Username</label>
          <input
            className="form-control form-control-lg"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />

          {mode === "register" && (
            <>
              <label className="form-label mt-3">Email</label>
              <input
                type="email"
                className="form-control form-control-lg"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </>
          )}

          <label className="form-label mt-3" htmlFor="auth-password">
            Password
          </label>
          <div className="password-input-wrap">
            <input
              id="auth-password"
              type={showAuthPassword ? "text" : "password"}
              className="form-control form-control-lg"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
            <button
              type="button"
              className="password-visibility-toggle"
              onClick={() => setShowAuthPassword((visible) => !visible)}
              aria-label={showAuthPassword ? "Hide password" : "Show password"}
              aria-pressed={showAuthPassword}
            >
              <i
                className={`bi ${showAuthPassword ? "bi-eye-slash" : "bi-eye"}`}
                aria-hidden="true"
              />
            </button>
          </div>

          <button className="btn btn-success btn-lg w-100 mt-4" type="submit" disabled={authLoading}>
            {authLoading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="login-screen">
        <div className="text-center">
          <div className="spinner-border text-success" role="status" />
          <p className="text-secondary mt-3">Loading your account...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="login-screen">
        <div className="text-center">
          <div className="alert alert-danger">
            {authError || "Could not load your account."}
          </div>
          {accessToken && (
            <button
              type="button"
              className="btn btn-success"
              onClick={() => {
                setAuthError("");
                setProfileRetry((attempt) => attempt + 1);
              }}
            >
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-icon"><i className="bi bi-moon-stars-fill" /></div>
          <div>
            <strong>Mosque Admin</strong>
            <small>Management System</small>
          </div>
        </div>

        <div className="sidebar-label">MAIN MENU</div>
        <nav className="sidebar-nav">
          {menuItems
            .filter((item) => !item.adminOnly || isAdmin)
            .map((item) => (
            <button
              type="button"
              key={item.name}
              className={`sidebar-link ${activePage === item.name || (activePage === "Add Member" && item.name === "Members") ? "active" : ""}`}
              onClick={() => {
                setActivePage(item.name);
                setMobileOpen(false);
                setMemberMessage("");
                setMemberError("");
              }}
            >
              <i className={`bi ${item.icon}`} />
              <span>{item.name}</span>
              {activePage === item.name && <i className="bi bi-chevron-right ms-auto" />}
            </button>
            ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="admin-mini">
            <AccountAvatar
              picture={profile.user_picture}
              username={profile.username || username}
            />
            <div className="text-truncate">
              <strong>{profile.username || username}</strong>
              <small>{profile.user_role || "Signed in"}</small>
            </div>
          </div>
          <button type="button" className="sidebar-link logout-link" onClick={handleLogout}>
            <i className="bi bi-box-arrow-left" /><span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="d-flex align-items-center gap-3">
            <button
              type="button"
              className="mobile-toggle"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label="Toggle navigation"
            >
              <i className="bi bi-list" />
            </button>
            <div>
              <h5 className="mb-0 fw-bold">{activePage}</h5>
              <small className="text-secondary">Mosque management portal</small>
            </div>
          </div>
          <div className="topbar-user">
            <AccountAvatar
              picture={profile.user_picture}
              username={profile.username || username}
            />
            <div className="d-none d-sm-block">
              <strong>{profile.username || username}</strong>
              <small>{profile.user_role || "Account"}</small>
            </div>
          </div>
        </header>

        <section className="page-body">
          {activePage === "Dashboard" && <Dashboard token={accessToken} profile={profile} onNavigate={setActivePage} />}
          {activePage === "Members" && (
            <MembersPage
              members={members}
              loading={membersLoading}
              error={memberError}
              message={memberMessage}
              token={accessToken}
              canAdd={canEditMembers}
              canEdit={canEditMembers}
              canDelete={isAdmin}
              onMemberUpdated={(updatedMember) =>
                setMembers((current) =>
                  current.map((member) =>
                    member.id === updatedMember.id ? updatedMember : member
                  )
                )
              }
              onAdd={() => {
                setMemberForm({ ...emptyMember });
                setEditingMember(null);
                setMemberMessage("");
                setMemberError("");
                setActivePage("Add Member");
              }}
              onEdit={(member) => {
                setMemberForm({
                  member_picture: null,
                  name: member.name || "",
                  mobile_no: member.mobile_no || "",
                  Father_name: member.Father_name || "",
                  village: member.village || "",
                  member_type: member.member_type || "General",
                });
                setEditingMember(member);
                setMemberMessage("");
                setMemberError("");
                setActivePage("Add Member");
              }}
              onDelete={handleMemberDelete}
              onMemberCount={() => setActivePage("MemberCount")}
            />
          )}
          {activePage === "MemberCount" && (
            <MemberCountPage
              members={members}
              loading={membersLoading}
              error={memberError}
              onBack={() => setActivePage("Members")}
            />
          )}
          {activePage === "Add Member" && (
            <AddMemberPage
              form={memberForm}
              setForm={setMemberForm}
              villageOptions={memberVillageOptions}
              editingMember={editingMember}
              loading={memberLoading}
              message={memberMessage}
              error={memberError}
              onSubmit={handleMemberSubmit}
              onCancel={() => setActivePage("Members")}
            />
          )}
          {pageConfig[activePage] && activePage !== "Members" && (
            <GenericManagementPage
              page={activePage}
              token={accessToken}
              profile={profile}
              canAddUser={isAdmin}
              canEditDonation={isAdmin}
              canManageReceitbook={isAdmin}
            />
          )}
        </section>

        <footer className="page-footer">
          Mosque Management System · {new Date().getFullYear()}
        </footer>
      </main>
    </div>
  );
}

function Dashboard({ token, profile, onNavigate }) {
  const [stats, setStats] = useState({
    members: 0,
    donations: 0,
    categories: 0,
    years: 0,
    users: 0,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const endpoints = [
      "accounts/members/",
      "accounts/donations/",
      "accounts/donation-categories/",
      "accounts/donation-years/",
      "accounts/user-profiles/",
    ];

    Promise.allSettled(endpoints.map((endpoint) => api.get(endpoint, authConfig(token))))
      .then((results) => {
        if (cancelled) return;
        const count = (result) => {
          if (result.status !== "fulfilled") return 0;
          const data = result.value.data;
          return Array.isArray(data) ? data.length : data?.count ?? data?.results?.length ?? 0;
        };
        setStats({
          members: count(results[0]),
          donations: count(results[1]),
          categories: count(results[2]),
          years: count(results[3]),
          users: count(results[4]),
        });
      })
      .finally(() => { if (!cancelled) setLoaded(true); });

    return () => { cancelled = true; };
  }, [token]);

  const cards = [
    { label: "Total Members", value: stats.members, icon: "bi-people-fill", color: "green", page: "Members" },
    { label: "Donations", value: stats.donations, icon: "bi-cash-stack", color: "green", page: "Donations" },
    { label: "Donation Categories", value: stats.categories, icon: "bi-tags-fill", color: "blue", page: "Donation Categories" },
    { label: "Donation Years", value: stats.years, icon: "bi-calendar-check-fill", color: "orange", page: "Donation Years" },
    { label: "User Profiles", value: stats.users, icon: "bi-person-badge-fill", color: "purple", page: "User Profiles" },
  ];

  return (
    <>
      <div className="welcome-banner">
        <div>
          <span className="welcome-tag">ADMIN OVERVIEW</span>
          <h2>Welcome back, {profile.username || "Admin"}</h2>
          <p>Manage members and donation settings from one place.</p>
        </div>
        <i className="bi bi-bar-chart-line-fill welcome-art" />
      </div>

      <div className="row g-3 mt-2">
        {cards.map((card) => (
          <div className="col-12 col-sm-6 col-xl-3" key={card.label}>
            <button type="button" className={`stat-card stat-card-button${card.page === "Donation Years" ? " donation-years-card" : ""}`} onClick={() => onNavigate(card.page)}>
              <div className={`stat-icon ${card.color}`}><i className={`bi ${card.icon}`} /></div>
              <p>{card.label}</p>
              <h3>{loaded ? card.value.toLocaleString() : "—"}</h3>
              <small>View records <i className="bi bi-arrow-up-right ms-1" /></small>
            </button>
          </div>
        ))}

      </div>

      <div className="content-card mt-4">
        <h5 className="fw-bold mb-1">Quick actions</h5>
        <p className="text-secondary mb-3">Open a section to review and manage records.</p>
        <div className="d-flex flex-wrap gap-2">
          {menuItems.filter((item) => item.name !== "Dashboard").map((item) => (
            <button key={item.name} className="btn btn-outline-success" type="button" onClick={() => onNavigate(item.name)}>
              <i className={`bi ${item.icon} me-2`} />{item.name}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function MembersPage({
  members,
  loading,
  error,
  message,
  token,
  canAdd,
  canEdit,
  canDelete,
  onMemberUpdated,
  onAdd,
  onEdit,
  onDelete,
  onMemberCount,
}) {
  const [viewingMember, setViewingMember] = useState(null);
  const [detailsForm, setDetailsForm] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const memberFields = [
    ["id", "Member ID"],
    ["name", "Name"],
    ["mobile_no", "Mobile"],
    ["Father_name", "Father's Name"],
    ["village", "Village"],
    ["member_type", "Member Type"],
    ["user_id", "Linked User ID"],
    ["entry_by", "Entered By"],
    ["created_at", "Created"],
    ["updated_at", "Last Updated"],
  ];
  const editableMemberFields = [
    ["name", "Name", "text"],
    ["mobile_no", "Mobile", "tel"],
    ["Father_name", "Father's Name", "text"],
    ["village", "Village", "select"],
    ["member_type", "Member Type", "text"],
  ];

  async function openMemberDetails(member) {
    setViewingMember(member);
    setDetailsForm(null);
    setDetailsLoading(true);
    setEditingDetails(false);
    setDetailsError("");
    try {
      const response = await api.get(
        `accounts/members/${member.id}/`,
        authConfig(token)
      );
      setViewingMember(response.data);
      setDetailsForm({
        ...response.data,
        member_profiles: (response.data.member_profiles || []).map((profile) => ({
          ...profile,
        })),
      });
    } catch (error) {
      const data = error.response?.data;
      setDetailsError(
        data
          ? typeof data === "string"
            ? data
            : JSON.stringify(data)
          : "Could not load the latest member details. Please try again."
      );
    } finally {
      setDetailsLoading(false);
    }
  }

  async function saveMemberDetails() {
    setSavingDetails(true);
    setDetailsError("");
    try {
      const payload = {
        name: detailsForm.name,
        mobile_no: detailsForm.mobile_no,
        Father_name: detailsForm.Father_name,
        village: detailsForm.village,
        member_type: detailsForm.member_type,
        member_profiles: detailsForm.member_profiles.map(
          ({ id, birth_date, gender, status, age_status, maritus_status }) => ({
            ...(id != null ? { id } : {}),
            birth_date: birth_date || null,
            gender,
            status,
            age_status,
            maritus_status,
          })
        ),
      };
      const response = await api.patch(
        `accounts/members/${viewingMember.id}/`,
        payload,
        authConfig(token)
      );
      setViewingMember(response.data);
      setDetailsForm(response.data);
      setEditingDetails(false);
      onMemberUpdated(response.data);
    } catch (error) {
      const data = error.response?.data;
      setDetailsError(
        data
          ? typeof data === "string"
            ? data
            : JSON.stringify(data)
          : "Could not save member details. Please check the server and try again."
      );
    } finally {
      setSavingDetails(false);
    }
  }

  return (
    <>
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold mb-1">Members Management</h2>
          <p className="text-secondary mb-0">View and manage mosque membership records.</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button type="button" className="btn btn-outline-success" onClick={onMemberCount}>
            <i className="bi bi-bar-chart-fill me-2" />MemberCount
          </button>
          {canAdd && (
            <button type="button" className="btn btn-success" onClick={onAdd}>
              <i className="bi bi-plus-lg me-2" />Add Member
            </button>
          )}
        </div>
      </div>
      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-warning">{error}</div>}
      <div className="content-card">
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>ID</th><th>Picture</th><th>Name</th><th>Mobile</th>
                <th>Father's Name</th><th>Village</th><th>Member Type</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-5"><span className="spinner-border spinner-border-sm text-success me-2" />Loading members...</td></tr>
              ) : members.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-secondary py-5">No members found yet.</td></tr>
              ) : members.map((member) => (
                <tr key={member.id}>
                  <td>{member.id}</td>
                  <td>
                    {member.member_picture ? (
                      <img
                        src={member.member_picture}
                        alt={`${member.name} profile`}
                        className="user-picture-thumbnail"
                      />
                    ) : (
                      <span className="user-picture-placeholder">
                        <i className="bi bi-person-fill" aria-hidden="true" />
                      </span>
                    )}
                  </td>
                  <td className="fw-semibold">{member.name}</td><td>{member.mobile_no}</td>
                  <td>{member.Father_name}</td><td>{member.village}</td><td>{member.member_type}</td>
                  <td className="text-end text-nowrap">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-success me-2"
                        disabled={detailsLoading}
                        onClick={() => openMemberDetails(member)}
                        aria-label={`ViewModel ${member.name}`}
                      >
                        ViewModel
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary me-2"
                          onClick={() => onEdit(member)}
                          aria-label={`Edit ${member.name}`}
                        >
                          <i className="bi bi-pencil-square" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => onDelete(member)}
                          aria-label={`Delete ${member.name}`}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <small className="text-secondary">{members.length} member(s)</small>
      </div>
      {viewingMember && (
        <div
          className="modal d-block"
          role="dialog"
          aria-modal="true"
          aria-labelledby="member-details-title"
          onClick={(event) => {
            if (event.target === event.currentTarget && !savingDetails) {
              setViewingMember(null);
            }
          }}
        >
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <div>
                  <h5 className="modal-title fw-bold" id="member-details-title">
                    Member Details
                  </h5>
                  <small className="text-secondary">
                    Complete member and profile information
                  </small>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  disabled={savingDetails}
                  onClick={() => setViewingMember(null)}
                />
              </div>
              <div className="modal-body">
                {detailsLoading && (
                  <div className="text-center py-4">
                    <span className="spinner-border text-success" role="status" />
                    <p className="text-secondary mt-2 mb-0">
                      Loading the latest member details...
                    </p>
                  </div>
                )}
                {detailsError && (
                  <div className="alert alert-danger" role="alert">
                    {detailsError}
                  </div>
                )}
                {detailsForm && !detailsLoading && detailsForm.member_picture && (
                  <img src={detailsForm.member_picture} alt={`${detailsForm.name} profile`} className="user-picture-preview" />
                )}
                {detailsForm && !detailsLoading && (
                  <section className="member-details-section">
                    <h6 className="member-details-heading">
                      <i className="bi bi-person-vcard me-2" />
                      Member information
                    </h6>
                    <dl className="member-details-grid">
                      {memberFields.map(([field, label]) => (
                        <div className="member-detail-item" key={field}>
                          <dt className="member-detail-label">{label}</dt>
                          <dd className="member-detail-value">
                            {detailsForm[field] || "—"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}
                {detailsForm && !detailsLoading && editingDetails && (
                  <>
                    <h6 className="member-details-heading">
                      <i className="bi bi-pencil-square me-2" />
                      Edit member information
                    </h6>
                    <div className="row g-3 mb-4">
                      {editableMemberFields.map(([field, label, type]) => (
                        <div className="col-12 col-md-6" key={field}>
                          <label className="form-label" htmlFor={`details-${field}`}>{label}</label>
                          {type === "select" ? (
                            <select
                              id={`details-${field}`}
                              className="form-select"
                              value={detailsForm[field] || "fakirbari"}
                              onChange={(event) =>
                                setDetailsForm((current) => ({
                                  ...current,
                                  [field]: event.target.value,
                                }))
                              }
                            >
                              <option value="fakirbari">Fakirbari</option>
                              <option value="borobari">Borobari</option>
                              <option value="horinatola">Horinatola</option>
                              <option value="khalishpur">Rosulpur</option>
                              <option value="chanpur">Chanpur</option>
                            </select>
                          ) : (
                            <input
                              id={`details-${field}`}
                              type={type}
                              className="form-control"
                              value={detailsForm[field] || ""}
                              onChange={(event) =>
                                setDetailsForm((current) => ({
                                  ...current,
                                  [field]: event.target.value,
                                }))
                              }
                              required
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {detailsForm && !detailsLoading && <div className="member-details-heading-row">
                  <h6 className="member-details-heading mb-0">
                    <i className="bi bi-card-list me-2" />
                    Member profile information
                  </h6>
                  {canEdit && editingDetails && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success"
                      onClick={() =>
                        setDetailsForm((current) => ({
                          ...current,
                          member_profiles: [
                            ...current.member_profiles,
                            {
                              birth_date: "",
                              gender: "male",
                              status: "active",
                              age_status: "adult",
                              maritus_status: "unmarried",
                            },
                          ],
                        }))
                      }
                    >
                      <i className="bi bi-plus-lg me-2" />Add Profile
                    </button>
                  )}
                </div>}
                {detailsForm && !detailsLoading && (detailsForm.member_profiles?.length ? (
                  detailsForm.member_profiles.map((profile, index) => {
                    const ageYears = editingDetails
                      ? calculateAgeYears(profile.birth_date)
                      : profile.age;

                    return (
                    <div
                      className="member-profile-card"
                      key={profile.id ?? `new-profile-${index}`}
                    >
                      <div className="member-profile-card-heading">
                        <h6 className="fw-semibold mb-0">
                          Profile {index + 1}
                        </h6>
                        <span className="member-profile-id">
                          {profile.id != null ? `Profile ID: ${profile.id}` : "New profile"}
                        </span>
                      </div>
                      <dl className="member-profile-summary">
                        <div className="member-detail-item">
                          <dt className="member-detail-label">Member ID</dt>
                          <dd className="member-detail-value">
                            {profile.member ?? detailsForm.id}
                          </dd>
                        </div>
                        <div className="member-detail-item">
                          <dt className="member-detail-label">Age</dt>
                          <dd className="member-detail-value">
                            {ageYears == null
                              ? "Not available"
                              : `${ageYears} years`}
                          </dd>
                        </div>
                      </dl>
                      <div className="row g-3">
                        {[
                          ["birth_date", "Birth Date", "date"],
                          ["gender", "Gender", "select"],
                          ["status", "Status", "select"],
                          ["age_status", "Age Status", "select"],
                          ["maritus_status", "Marital Status", "select"],
                        ].map(([field, label, type]) => {
                          const choices = {
                            gender: [["male", "Male"], ["female", "Female"], ["other", "Other"]],
                            status: [["active", "Active"], ["inactive", "Inactive"]],
                            age_status: [["adult", "Adult"], ["senior", "Senior"], ["old", "Old"]],
                            maritus_status: [["unmarried", "Unmarried"], ["married", "Married"], ["divorced", "Divorced"], ["widowed", "Widowed"]],
                          };
                          return (
                            <div className="member-detail-item" key={field}>
                              <label className="member-detail-label" htmlFor={`profile-${profile.id ?? `new-${index}`}-${field}`}>{label}</label>
                              {editingDetails && type === "select" ? (
                                <select
                                  id={`profile-${profile.id ?? `new-${index}`}-${field}`}
                                  className="form-select"
                                  value={profile[field] || ""}
                                  onChange={(event) =>
                                    setDetailsForm((current) => ({
                                      ...current,
                                      member_profiles: current.member_profiles.map(
                                        (item, itemIndex) =>
                                          itemIndex === index
                                            ? { ...item, [field]: event.target.value }
                                            : item
                                      ),
                                    }))
                                  }
                                >
                                  {choices[field].map(([value, choiceLabel]) => (
                                    <option key={value} value={value}>{choiceLabel}</option>
                                  ))}
                                </select>
                              ) : editingDetails ? (
                                <input
                                  id={`profile-${profile.id ?? `new-${index}`}-${field}`}
                                  type="date"
                                  className="form-control"
                                  value={profile.birth_date || ""}
                                  onChange={(event) =>
                                    setDetailsForm((current) => ({
                                      ...current,
                                      member_profiles: current.member_profiles.map(
                                        (item, itemIndex) =>
                                          itemIndex === index
                                            ? { ...item, birth_date: event.target.value }
                                            : item
                                      ),
                                    }))
                                  }
                                />
                              ) : (
                                <div className="member-detail-value">
                                  {field === "gender"
                                    ? choices.gender.find(
                                        ([value]) => value === profile.gender
                                      )?.[1] || "—"
                                    : profile[field] || "—"}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })
                ) : (
                  <p className="text-secondary mb-0">
                    No member profile information is available.
                  </p>
                ))}
              </div>
              <div className="modal-footer">
                {canEdit && detailsForm && !detailsLoading && !editingDetails && (
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={() => {
                      setEditingDetails(true);
                      setDetailsError("");
                    }}
                  >
                    <i className="bi bi-pencil-square me-2" />Edit
                  </button>
                )}
                {canEdit && detailsForm && !detailsLoading && editingDetails && (
                  <>
                    <button
                      type="button"
                      className="btn btn-success"
                      disabled={savingDetails}
                      onClick={saveMemberDetails}
                    >
                      {savingDetails ? (
                        <><span className="spinner-border spinner-border-sm me-2" />Saving...</>
                      ) : (
                        <><i className="bi bi-check-lg me-2" />Save Changes</>
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-light border"
                      disabled={savingDetails}
                      onClick={() => {
                        setDetailsForm({
                          ...viewingMember,
                          member_profiles: viewingMember.member_profiles.map(
                            (profile) => ({ ...profile })
                          ),
                        });
                        setEditingDetails(false);
                        setDetailsError("");
                      }}
                    >
                      Cancel
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={savingDetails}
                  onClick={() => setViewingMember(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MemberCountPage({ members, loading, error, onBack }) {
  const [activeVillage, setActiveVillage] = useState(memberCountVillages[0][0]);
  const villageLabel =
    memberCountVillages.find(([value]) => value === activeVillage)?.[1] ||
    activeVillage;
  const visibleMembers =
    activeVillage === "all"
      ? members
      : members.filter((member) => member.village === activeVillage);
  const profiles = visibleMembers
    .flatMap((member) => member.member_profiles || []);
  const villageCounts = memberCountVillages
    .filter(([value]) => value !== "all")
    .map(([value, label]) => ({
      value,
      label,
      count: members
        .filter((member) => member.village === value)
        .reduce(
          (total, member) => total + (member.member_profiles?.length || 0),
          0
        ),
    }));
  const breakdowns = [
    {
      key: "gender",
      title: "Gender",
      options: [
        ["male", "Male"],
        ["female", "Female"],
        ["other", "Other"],
      ],
    },
    {
      key: "age_status",
      title: "Age Status",
      options: [
        ["adult", "Adult"],
        ["senior", "Senior"],
        ["old", "Old"],
      ],
    },
    {
      key: "maritus_status",
      title: "Marital Status",
      options: [
        ["unmarried", "Unmarried"],
        ["married", "Married"],
        ["divorced", "Divorced"],
        ["widowed", "Widowed"],
      ],
    },
  ];
  const unknownLabel = "Not set";
  const profileValue = (profile, field, options) =>
    options.find(([value]) => value === profile[field])?.[1] || unknownLabel;
  const combinedCounts = new Map();

  profiles.forEach((profile) => {
    const combination = breakdowns
      .map(({ key, options }) => profileValue(profile, key, options))
      .join(" / ");
    combinedCounts.set(combination, (combinedCounts.get(combination) || 0) + 1);
  });

  return (
    <>
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold mb-1">MemberCount</h2>
          <p className="text-secondary mb-0">
            Profile counts by village, gender, age status, and marital status.
          </p>
        </div>
        <button type="button" className="btn btn-outline-secondary" onClick={onBack}>
          <i className="bi bi-arrow-left me-2" />Back to Members
        </button>
      </div>

      <div className="content-card">
        <ul className="member-count-villages mb-4" role="tablist" aria-label="Villages">
          {memberCountVillages.map(([value, label]) => (
            <li className="nav-item" role="presentation" key={value}>
              <button
                type="button"
                className={`member-count-village-tab ${activeVillage === value ? "active" : ""}`}
                role="tab"
                aria-selected={activeVillage === value}
                onClick={() => setActiveVillage(value)}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>

        <div className="member-count-village-summary">
            <div>
              <span className="member-count-eyebrow">VILLAGE REPORT</span>
              <h4 className="fw-bold mb-1">{villageLabel}</h4>
              <p className="text-secondary mb-0">
                Each profile is counted separately.
              </p>
            </div>
            <div className="member-count-total">
              <span>Total profiles</span>
              <strong>{profiles.length}</strong>
            </div>
        </div>

        {error ? (
            <div className="alert alert-warning">{error}</div>
        ) : loading ? (
          <div className="text-center py-5">
            <span className="spinner-border text-success" />
            <p className="text-secondary mt-3">Loading member counts...</p>
          </div>
        ) : (
          <>
            {activeVillage === "all" && (
              <section className="member-count-combined mb-4">
                <div className="member-count-combined-heading">
                  <div>
                    <span className="member-count-eyebrow">VILLAGE CATEGORY</span>
                    <h5 className="fw-bold mb-1">Profiles by village</h5>
                    <p className="text-secondary mb-0">
                      Profile totals for every village
                    </p>
                  </div>
                  <span className="member-count-combination-total">
                    {villageCounts.length} villages
                  </span>
                </div>
                <div className="member-count-village-grid">
                  {villageCounts.map(({ value, label, count }) => (
                    <button
                      type="button"
                      className="member-count-village-summary-card"
                      key={value}
                      onClick={() => setActiveVillage(value)}
                    >
                      <span>{label}</span>
                      <strong>{count}</strong>
                      <small>Profiles <i className="bi bi-arrow-right ms-1" /></small>
                    </button>
                  ))}
                </div>
              </section>
            )}
            <div className="member-count-breakdowns">
              {breakdowns.map(({ key, title, options }) => {
                const counts = new Map();
                profiles.forEach((profile) => {
                  const value = profileValue(profile, key, options);
                  counts.set(value, (counts.get(value) || 0) + 1);
                });
                const categories = [
                  ...options.map(([, label]) => label),
                  unknownLabel,
                ];

                return (
                  <section className="member-count-card" key={key}>
                    <div className="member-count-card-heading">
                      <span className={`member-count-icon ${key}`}>
                        <i
                          className={`bi ${
                            key === "gender"
                              ? "bi-gender-ambiguous"
                              : key === "age_status"
                                ? "bi-hourglass-split"
                                : "bi-people"
                          }`}
                          aria-hidden="true"
                        />
                      </span>
                      <div>
                        <h5>{title}</h5>
                        <p>Profile breakdown</p>
                      </div>
                    </div>
                    <div className="member-count-list">
                      {categories.map((category) => (
                        <div className="member-count-row" key={category}>
                          <span>{category}</span>
                          <strong>{counts.get(category) || 0}</strong>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>

            <section className="member-count-combined">
              <div className="member-count-combined-heading">
                <div>
                  <span className="member-count-eyebrow">DETAILED REPORT</span>
                  <h5 className="fw-bold mb-1">Combined profile counts</h5>
                  <p className="text-secondary mb-0">
                    Gender, age status, and marital status together
                  </p>
                </div>
                <span className="member-count-combination-total">
                  {combinedCounts.size} combination{combinedCounts.size === 1 ? "" : "s"}
                </span>
              </div>
              <div className="table-responsive">
                <table className="table member-count-combined-table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Gender</th>
                    <th>Age Status</th>
                    <th>Marital Status</th>
                    <th className="text-end">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {[...combinedCounts.entries()].map(([combination, count]) => {
                    const [gender, ageStatus, maritalStatus] =
                      combination.split(" / ");
                    return (
                      <tr key={combination}>
                        <td>{gender}</td>
                        <td>{ageStatus}</td>
                        <td>{maritalStatus}</td>
                        <td className="text-end">{count}</td>
                      </tr>
                    );
                  })}
                  {combinedCounts.size === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-secondary py-4">
                        No member profiles found for this village.
                      </td>
                    </tr>
                  )}
                </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}

function AddMemberPage({
  form,
  setForm,
  villageOptions,
  editingMember,
  loading,
  message,
  error,
  onSubmit,
  onCancel,
}) {
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <>
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 mb-4">
        <div><h2 className="fw-bold mb-1">{editingMember ? "Edit Member" : "Add Member"}</h2><p className="text-secondary mb-0">Enter the member's information below.</p></div>
        <button type="button" className="btn btn-outline-secondary" onClick={onCancel}><i className="bi bi-arrow-left me-2" />Back to Members</button>
      </div>
      <div className="content-card">
        {message && <div className="alert alert-success">{message}</div>}
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="member-picture">Member Picture</label>
              {editingMember?.member_picture && (
                <img
                  src={editingMember.member_picture}
                  alt={`${editingMember.name} current profile`}
                  className="user-picture-preview"
                />
              )}
              <input
                id="member-picture"
                type="file"
                accept="image/*"
                className="form-control user-picture-input"
                onChange={(e) => update("member_picture", e.target.files?.[0] ?? null)}
              />
              {form.member_picture && (
                <small className="text-secondary d-block mt-2">
                  Selected: {form.member_picture.name}
                </small>
              )}
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Member Name</label>
              <input className="form-control" value={form.name} onChange={(e) => update("name", titleCaseName(e.target.value))} required />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Mobile Number</label>
              <input type="tel" className="form-control" value={form.mobile_no} onChange={(e) => update("mobile_no", e.target.value)} required />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Father's Name</label>
              <input className="form-control" value={form.Father_name} onChange={(e) => update("Father_name", titleCaseName(e.target.value))} required />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="member-village">Village</label>
              <select
                id="member-village"
                className="form-select"
                value={form.village}
                onChange={(e) => update("village", e.target.value)}
                required
              >
                <option value="">Select a village</option>
                {villageOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Member Type</label>
              <select className="form-select" value={form.member_type} onChange={(e) => update("member_type", e.target.value)}>
                <option value="General">General</option><option value="Lifetime">Lifetime</option><option value="Donor">Donor</option>
              </select>
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2 mt-4">
            <button type="submit" className="btn btn-success" disabled={loading}>
              {loading ? <><span className="spinner-border spinner-border-sm me-2" />Saving...</> : <><i className="bi bi-check-lg me-2" />{editingMember ? "Update Member" : "Save Member"}</>}
            </button>
            <button type="button" className="btn btn-light border" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
    </>
  );
}

function GenericManagementPage({
  page,
  token,
  profile,
  canAddUser,
  canEditDonation,
  canManageReceitbook,
}) {
  const config = pageConfig[page];
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [flash, setFlash] = useState("");

  // Add / Edit modal state
  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [editLoadingId, setEditLoadingId] = useState(null);
  const [form, setForm] = useState({});
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState({
    username: "",
    password: "",
    email: "",
    user_role: "member",
    status: true,
    is_staff: true,
  });
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [userFormLoading, setUserFormLoading] = useState(false);
  const [userFormError, setUserFormError] = useState("");
  const [viewingRow, setViewingRow] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState("");
  const [choiceOptions, setChoiceOptions] = useState({});
  const [choicesLoadedFor, setChoicesLoadedFor] = useState("");
  const [choiceError, setChoiceError] = useState("");
  const hasAsyncChoices = ["Donations", "Receitbook"].includes(page);
  const choiceLoading = hasAsyncChoices && choicesLoadedFor !== page;

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (!hasAsyncChoices) return undefined;

    let cancelled = false;
    Promise.all(
      config.formFields
        .filter((field) => field.optionsEndpoint)
        .map(async (field) => {
          const response = await api.get(
            field.optionsEndpoint,
            authConfig(token)
          );
          const options = getList(response.data).map((option) => [
            String(option[field.optionId]),
            field.optionLabelWithId
              ? `${option[field.optionLabel]} (${formatDonationMemberId(option[field.optionId])})`
              : option[field.optionLabel] || `#${option[field.optionId]}`,
          ]);
          return [
            field.key,
            options,
          ];
        })
    )
      .then((options) => {
        if (!cancelled) {
          setChoiceOptions((current) => ({
            ...current,
            ...Object.fromEntries(options),
          }));
          setChoiceError("");
          setChoicesLoadedFor(page);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        const data = error.response?.data;
        setChoiceError(
          data
            ? typeof data === "string"
              ? data
              : JSON.stringify(data)
              : "Could not load form choices. Please try again."
        );
        setChoicesLoadedFor(page);
      });

    return () => {
      cancelled = true;
    };
  }, [config, hasAsyncChoices, page, token]);

  const buildEmptyForm = () => {
    const obj = {};
    config.formFields.forEach((f) => {
      obj[f.key] =
        f.default ??
        (f.type === "checkbox"
          ? true
          : f.type === "multiselect"
            ? []
            : f.type === "file"
              ? null
              : "");
    });
    return obj;
  };

  const loadRows = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get(config.endpoint, authConfig(token));
      setRows(getList(response.data));
    } catch {
      setRows([]);
      setError(
        `Could not load ${page.toLowerCase()}. Confirm that its Django API endpoint has been implemented.`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .get(config.endpoint, authConfig(token))
      .then((response) => {
        if (!cancelled) setRows(getList(response.data));
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setError(
            `Could not load ${page.toLowerCase()}. Confirm that its Django API endpoint has been implemented.`
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [config.endpoint, page, token]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      Object.values(row).some((value) => {
        const normalized =
          value && typeof value === "object"
            ? JSON.stringify(value)
            : String(value ?? "");
        return normalized.toLowerCase().includes(query);
      })
    );
  }, [rows, search]);

  function openAdd() {
    setEditingRow(null);
    setForm(buildEmptyForm());
    setFormError("");
    setChoiceError("");
    setShowForm(true);
  }

  function getEditForm(row) {
    const obj = {};
    config.formFields.forEach((f) => {
      let value = row[f.key];
      if (f.key === "user" && value && typeof value === "object") {
        value = value.id ?? value.username ?? "";
      } else if (f.key === "user" && row.username) {
        value = row.username;
      }
      obj[f.key] =
        f.type === "checkbox"
          ? Boolean(value)
          : f.type === "multiselect"
            ? Array.isArray(value) ? value : []
          : f.type === "file"
            ? null
            : value ?? "";
    });
    return obj;
  }

  async function openEdit(row) {
    const id = row[config.idField];
    setEditingRow(row);
    setForm(getEditForm(row));
    setFormError("");
    setChoiceError("");
    setShowForm(true);

    if (page !== "User Profiles") return;

    setEditLoadingId(id);
    try {
      const response = await api.get(
        `${config.endpoint}${id}/`,
        authConfig(token)
      );
      setEditingRow(response.data);
      setForm(getEditForm(response.data));
    } catch (error) {
      const data = error.response?.data;
      setFormError(
        data
          ? typeof data === "string"
            ? data
            : JSON.stringify(data)
          : "Could not load the latest user profile. Please try again."
      );
    } finally {
      setEditLoadingId(null);
    }
  }

  async function openViewModel(row) {
    setViewingRow(row);
    setViewLoading(true);
    setViewError("");
    try {
      const response = await api.get(
        `${config.endpoint}${row[config.idField]}/`,
        authConfig(token)
      );
      setViewingRow(response.data);
    } catch (err) {
      const data = err.response?.data;
      setViewError(
        data
          ? typeof data === "string"
            ? data
            : JSON.stringify(data)
          : `Could not load ${page === "Donations" ? "donation" : "profile"} details. Please try again.`
      );
    } finally {
      setViewLoading(false);
    }
  }

  async function handleCreateUser(event) {
    event.preventDefault();
    setUserFormError("");
    setUserFormLoading(true);
    try {
      await api.post(
        "accounts/users/",
        userForm,
        authConfig(token)
      );
      setShowUserForm(false);
      setUserForm({
        username: "",
        password: "",
        email: "",
        user_role: "member",
        status: true,
        is_staff: true,
      });
      setFlash("User and profile created successfully.");
      await loadRows();
    } catch (err) {
      const data = err.response?.data;
      setUserFormError(
        data
          ? typeof data === "string"
            ? data
            : JSON.stringify(data)
          : "Could not create the user. Please check the server and try again."
      );
    } finally {
      setUserFormLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      const hasFileField = config.formFields.some(
        (field) => field.type === "file" && form[field.key] instanceof File
      );
      let data = form;
      if (page === "User Profiles") {
        data = { ...form };
        config.formFields
          .filter((field) => field.type === "file")
          .forEach((field) => delete data[field.key]);
      }
      if (hasFileField) {
        data = new FormData();
        config.formFields.forEach((field) => {
          const value = form[field.key];
          if (
            value !== null &&
            value !== undefined &&
            (value !== "" ||
              ["email", "member_profile", "village_selected_id"].includes(
                field.key
              ))
          ) {
            data.append(
              field.key,
              Array.isArray(value) ? JSON.stringify(value) : value
            );
          }
        });
      }

      if (editingRow) {
        const id = editingRow[config.idField];
        await api.patch(`${config.endpoint}${id}/`, data, authConfig(token));
        setFlash("Record updated successfully.");
      } else {
        await api.post(config.endpoint, data, authConfig(token));
        setFlash("Record created successfully.");
      }
      setShowForm(false);
      await loadRows();
    } catch (err) {
      const data = err.response?.data;
      setFormError(data ? JSON.stringify(data) : "Save failed. Please try again.");
    } finally {
      setFormLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const id = deleteTarget[config.idField];
      await api.delete(`${config.endpoint}${id}/`, authConfig(token));
      setFlash("Record deleted successfully.");
      setDeleteTarget(null);
      await loadRows();
    } catch {
      setFormError("Delete failed. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold mb-1">{page}</h2>
          <p className="text-secondary mb-0">
            {page === "Receitbook"
              ? "View, create, and edit receipt books."
              : page === "Donations"
              ? canEditDonation
                ? "Review, add, and update donation records."
                : "Review and add donation records."
              : "Review, add, edit, or delete records."}
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          {page === "User Profiles" && canAddUser && (
            <button
              type="button"
              className="btn btn-outline-success"
              onClick={() => {
                setUserFormError("");
                setShowUserPassword(false);
                setShowUserForm(true);
              }}
            >
              <i className="bi bi-person-plus me-2" />
              +Add User
            </button>
          )}
          {page !== "User Profiles" &&
            (page !== "Receitbook" || canManageReceitbook) && (
            <button type="button" className="btn btn-success" onClick={openAdd}>
              <i className="bi bi-plus-lg me-2" />
              {config.addLabel}
            </button>
            )}
        </div>
      </div>

      {flash && <div className="alert alert-success">{flash}</div>}

      <div className="content-card">
        <div className="d-flex flex-column flex-sm-row justify-content-between gap-3 mb-4">
          <h5 className="fw-bold mb-0 align-self-center">{page} list</h5>
          <input
            className="form-control search-input"
            placeholder={`Search ${page.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {error && <div className="alert alert-warning">{error}</div>}

        {loading ? (
          <div className="text-center py-5">
            <span className="spinner-border text-success" />
            <p className="text-secondary mt-3">Loading records...</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  {config.columns.map(([key, label]) => (
                    <th key={key}>{label}</th>
                  ))}
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr key={row[config.idField] ?? index}>
                    {config.columns.map(([key]) => {
                      const value =
                        key === "user" && row.user && typeof row.user === "object"
                        ? row.user.id ?? JSON.stringify(row.user)
                          : row[key];
                      return (
                        <td key={key}>
                          {key === "status" || key === "is_staff" ? (
                            <span
                              className={`status-pill ${
                                value ? "status-active" : "status-inactive"
                              }`}
                            >
                              {key === "is_staff"
                                ? value
                                  ? "Enabled"
                                  : "Disabled"
                                : value
                                  ? "Active"
                                  : "Inactive"}
                            </span>
                          ) : key === "user_picture" ? (
                            value ? (
                              <img
                                src={value}
                                alt="User profile"
                                className="user-picture-thumbnail"
                              />
                            ) : (
                              <span className="user-picture-placeholder">
                                <i className="bi bi-person-fill" aria-hidden="true" />
                              </span>
                            )
                          ) : key === "donation_amount" ? (
                            value == null ? "—" : Number(value).toFixed(2)
                          ) : key === "village_selected_id" ? (
                            Array.isArray(value) && value.length > 0
                              ? value
                                  .map(
                                    (village) =>
                                      villageSelectionOptions.find(
                                        ([option]) => option === village
                                      )?.[1] || village
                                  )
                                  .join(", ")
                              : "—"
                          ) : (
                            String(value ?? "—")
                          )}
                        </td>
                      );
                    })}
                    <td className="text-end">
                      {(page === "User Profiles" ||
                        page === "Donations" ||
                        page === "Receitbook") && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success me-2"
                          onClick={() => openViewModel(row)}
                          title="ViewModel"
                        >
                          View
                        </button>
                      )}
                      {page !== "Donations" &&
                        page !== "Receitbook" && (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary me-2"
                            onClick={() => openEdit(row)}
                            disabled={editLoadingId === row[config.idField]}
                            title="Edit"
                          >
                            {editLoadingId === row[config.idField] ? (
                              <span className="spinner-border spinner-border-sm" />
                            ) : (
                              <i className="bi bi-pencil-square" />
                            )}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => setDeleteTarget(row)}
                            title="Delete"
                          >
                            <i className="bi bi-trash" />
                          </button>
                        </>
                      )}
                      {page === "Receitbook" && canManageReceitbook && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => openEdit(row)}
                          title="Edit"
                        >
                          <i className="bi bi-pencil-square" />
                        </button>
                      )}
                      {page === "Donations" && canEditDonation && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => openEdit(row)}
                          title="Edit"
                        >
                          <i className="bi bi-pencil-square" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={config.columns.length + 1}
                      className="text-center text-secondary py-5"
                    >
                      No records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <small className="text-secondary">{filteredRows.length} record(s)</small>
      </div>

      {(page === "User Profiles" ||
        page === "Donations" ||
        page === "Receitbook") && viewingRow && (
        <div
          className="modal-backdrop-custom"
          onClick={() => !viewLoading && setViewingRow(null)}
        >
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
              <div>
                <h5 className="fw-bold mb-1">
                  {page === "Donations"
                    ? "Donation Details"
                    : page === "Receitbook"
                      ? "Receitbook Details"
                      : "User Profile Details"}
                </h5>
                <p className="text-secondary mb-0">
                  {page === "Donations"
                    ? "All information for this donation"
                    : page === "Receitbook"
                      ? "Receipt book range, assignment, and status"
                      : "Profile and linked account information"}
                </p>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Close profile details"
                disabled={viewLoading}
                onClick={() => setViewingRow(null)}
              />
            </div>
            {viewLoading ? (
              <div className="text-center py-4">
                <span className="spinner-border text-success" role="status" />
                <p className="text-secondary mt-2 mb-0">
                  {page === "Donations"
                    ? "Loading donation..."
                    : page === "Receitbook"
                      ? "Loading receipt book..."
                      : "Loading profile..."}
                </p>
              </div>
            ) : (
              <>
                {viewError && (
                  <div className="alert alert-danger" role="alert">
                    {viewError}
                  </div>
                )}
                {page === "User Profiles" && viewingRow.user_picture && (
                  <img
                    src={viewingRow.user_picture}
                    alt={`${viewingRow.username || "User"} profile`}
                    className="user-picture-preview"
                  />
                )}
                <dl className="member-details-grid">
                  {(page === "Donations"
                    ? [
                          ["donation_id", "Donation ID"],
                          ["member", "Member ID"], // ✅ এখানে member_id এর জায়গায় শুধু member হবে
                          ["member_name", "Member Name"],
                          ["donation_category", "Category ID"],
                          ["category_name", "Category"],
                          ["donation_amount", "Amount"],
                          ["donation_date", "Donation Date"],
                          ["year_id", "Donation Year ID"],
                          ["year_name", "Donation Year"],
                          ["description", "Description"],
                          ["entry_by", "Entered By"],
                          ["created_at", "Created"],
                          ["updated_at", "Last Updated"],
                        ]
                    : page === "Receitbook"
                      ? [
                          ["receit_id", "Receipt Book ID"],
                          ["for_user_username", "Assigned User"],
                          ["prefix", "Prefix"],
                          ["start_number", "Start Number"],
                          ["end_number", "End Number"],
                          ["receit_status", "Status"],
                          ["description", "Description"],
                          ["entry_by", "Entered By"],
                          ["created_at", "Created"],
                          ["updated_at", "Last Updated"],
                        ]
                      : [
                        ["profile_id", "Profile ID"],
                        ["user", "User ID"],
                        ["username", "Username"],
                        ["email", "Email"],
                        ["user_role", "Role"],
                        ["member_profile", "Member Profile ID"],
                        ["village_selected_id", "Village Access"],
                        ["is_staff", "Django Staff Access"],
                        ["status", "Profile Status"],
                        ["entry_by", "Entered By"],
                        ["created_at", "Created"],
                        ["updated_at", "Last Updated"],
                      ]).map(([key, label]) => {
                    const value = viewingRow[key];
                    return (
                      <div className="member-detail-item" key={key}>
                        <dt className="member-detail-label">{label}</dt>
                        <dd className="member-detail-value">
                          {key === "is_staff"
                            ? value
                              ? "Enabled"
                              : "Disabled"
                            : key === "status"
                              ? value
                                ? "Active"
                                : "Inactive"
                             : key === "donation_amount" && value != null
                                ? `৳ ${Number(value).toFixed(2)}` // ✅ টাকার চিহ্ন যোগ করা হলো
                                : key === "paid_by"
                                  ? String(value || "—").charAt(0).toUpperCase() + String(value || "—").slice(1) // ✅ Cash, Bkash
                                  : key === "member"
                                    ? formatMemberDisplayId(value) // ✅ 01-0002 ফরম্যাট
                                    : (key === "created_at" || key === "updated_at") && value
                                      ? new Date(value).toLocaleString("en-GB", { // ✅ সুন্দর ডেট ফরম্যাট
                                          year: "numeric", month: "short", day: "numeric",
                                          hour: "2-digit", minute: "2-digit"
                                        })
                                : Array.isArray(value)
                                  ? value
                                      .map(
                                        (village) =>
                                          villageSelectionOptions.find(
                                            ([option]) => option === village
                                          )?.[1] || village
                                      )
                                      .join(", ") || "—"
                                  : value || "—"}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                <div className="d-flex justify-content-end mt-4">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setViewingRow(null)}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {page === "User Profiles" && canAddUser && showUserForm && (
        <div
          className="modal-backdrop-custom"
          onClick={() => !userFormLoading && setShowUserForm(false)}
        >
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h5 className="fw-bold mb-1">Add User</h5>
                <p className="text-secondary mb-0">
                  Create a login and its linked profile.
                </p>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Close Add User form"
                onClick={() => setShowUserForm(false)}
                disabled={userFormLoading}
              />
            </div>
            {userFormError && (
              <div className="alert alert-danger" role="alert">
                {userFormError}
              </div>
            )}
            <form onSubmit={handleCreateUser}>
              <div className="mb-3">
                <label className="form-label" htmlFor="new-user-username">
                  Username
                </label>
                <input
                  id="new-user-username"
                  className="form-control"
                  value={userForm.username}
                  onChange={(event) =>
                    setUserForm((current) => ({
                      ...current,
                      username: event.target.value,
                    }))
                  }
                  autoComplete="username"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="new-user-password">
                  Password
                </label>
                <div className="password-input-wrap">
                  <input
                    id="new-user-password"
                    type={showUserPassword ? "text" : "password"}
                    className="form-control"
                    value={userForm.password}
                    onChange={(event) =>
                      setUserForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className="password-visibility-toggle"
                    onClick={() => setShowUserPassword((visible) => !visible)}
                    aria-label={showUserPassword ? "Hide password" : "Show password"}
                    aria-pressed={showUserPassword}
                  >
                    <i
                      className={`bi ${showUserPassword ? "bi-eye-slash" : "bi-eye"}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="new-user-email">
                  Email (optional)
                </label>
                <input
                  id="new-user-email"
                  type="email"
                  className="form-control"
                  value={userForm.email}
                  onChange={(event) =>
                    setUserForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="new-user-role">
                  Role
                </label>
                <select
                  id="new-user-role"
                  className="form-select"
                  value={userForm.user_role}
                  onChange={(event) =>
                    setUserForm((current) => ({
                      ...current,
                      user_role: event.target.value,
                    }))
                  }
                  required
                >
                  {[
                    ["admin", "Admin"],
                    ["manager", "Manager"],
                    ["assistance", "Assistance"],
                    ["member", "Member"],
                    ["viewer", "Viewer"],
                  ].map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="form-check mb-2">
                <input
                  id="new-user-status"
                  type="checkbox"
                  className="form-check-input"
                  checked={userForm.status}
                  onChange={(event) =>
                    setUserForm((current) => ({
                      ...current,
                      status: event.target.checked,
                    }))
                  }
                />
                <label className="form-check-label" htmlFor="new-user-status">
                  Active profile
                </label>
              </div>
              <div className="form-check form-switch mb-3">
                <input
                  id="new-user-staff"
                  type="checkbox"
                  className="form-check-input"
                  checked={userForm.is_staff}
                  onChange={(event) =>
                    setUserForm((current) => ({
                      ...current,
                      is_staff: event.target.checked,
                    }))
                  }
                />
                <label className="form-check-label" htmlFor="new-user-staff">
                  Grant Django admin-site access (is_staff)
                </label>
              </div>
              <div className="d-flex flex-wrap gap-2 mt-4">
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={
                    userFormLoading || choiceLoading || Boolean(choiceError)
                  }
                >
                  {userFormLoading ? (
                    <><span className="spinner-border spinner-border-sm me-2" />Creating...</>
                  ) : (
                    <><i className="bi bi-person-plus me-2" />Create User</>
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-light border"
                  onClick={() => setShowUserForm(false)}
                  disabled={userFormLoading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <div
          className="modal-backdrop-custom"
          onClick={() => !formLoading && editLoadingId === null && setShowForm(false)}
        >
          <div
            className={`modal-card ${page === "Donations" ? "donation-modal-card" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="modal-heading">
                {page === "Donations" && (
                  <span className="donation-heading-icon" aria-hidden="true">
                    <i className="bi bi-cash-coin" />
                  </span>
                )}
                <div>
                  {page === "Donations" && (
                    <small className="donation-heading-eyebrow">
                      {editingRow ? "DONATION RECORD" : "CONTRIBUTION"}
                    </small>
                  )}
                  <h5 className="fw-bold mb-0">
                    {editingRow ? `Edit ${page}` : config.addLabel}
                  </h5>
                </div>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowForm(false)}
                disabled={formLoading || editLoadingId !== null}
              />
            </div>
            {page === "Donations" && !editingRow && (
              <div className="donation-village-banner">
                <span className="donation-village-icon" aria-hidden="true">
                  <i className="bi bi-geo-alt-fill" />
                </span>
                <div>
                  <strong>Your village access</strong>
                  <div className="donation-village-names">
                    {(profile?.village_selected_id || []).length > 0
                      ? profile.village_selected_id
                          .map(
                            (village) =>
                              villageSelectionOptions.find(
                                ([value]) => value === village
                              )?.[1] || village
                          )
                          .join(", ")
                      : "No villages assigned"}
                  </div>
                </div>
              </div>
            )}

            {formError && <div className="alert alert-danger">{formError}</div>}
            {editLoadingId !== null && (
              <div className="text-secondary mb-3">
                <span className="spinner-border spinner-border-sm text-success me-2" />
                Loading the latest profile details...
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {page === "User Profiles" && editingRow && (
                <div className="mb-3">
                  <label className="form-label" htmlFor="profile-user-readonly">
                    User ID or username
                  </label>
                  <input
                    id="profile-user-readonly"
                    className="form-control"
                    value={`${editingRow.user ?? ""} — ${editingRow.username ?? ""}`}
                    readOnly
                  />
                </div>
              )}
              {config.formFields.map((field) => (
                <div className="mb-3" key={field.key}>
                  {field.type === "checkbox" ? (
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id={`field-${field.key}`}
                        checked={Boolean(form[field.key])}
                        onChange={(e) =>
                          setForm((c) => ({ ...c, [field.key]: e.target.checked }))
                        }
                      />
                      <label
                        className="form-check-label"
                        htmlFor={`field-${field.key}`}
                      >
                        {field.label}
                      </label>
                    </div>
                  ) : field.type === "file" ? (
                    <>
                      <label className="form-label" htmlFor={`field-${field.key}`}>
                        {field.label}
                      </label>
                      {editingRow?.[field.key] && (
                        <img
                          src={editingRow[field.key]}
                          alt="Current user profile"
                          className="user-picture-preview"
                        />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="form-control user-picture-input"
                        id={`field-${field.key}`}
                        onChange={(e) =>
                          setForm((c) => ({
                            ...c,
                            [field.key]: e.target.files?.[0] ?? null,
                          }))
                        }
                      />
                      {form[field.key] && (
                        <small className="text-secondary d-block mt-2">
                          Selected: {form[field.key].name}
                        </small>
                      )}
                    </>
                  ) : field.type === "select" ? (
                    <>
                      <label className="form-label" htmlFor={`field-${field.key}`}>
                        {field.label}
                      </label>
                      <select
                        className="form-select"
                        id={`field-${field.key}`}
                        value={form[field.key] ?? ""}
                        onChange={(e) =>
                          setForm((c) => ({
                            ...c,
                            [field.key]: e.target.value,
                          }))
                        }
                        required={field.required}
                      >
                        <option value="">Select {field.label.toLowerCase()}</option>
                        {(field.options || choiceOptions[field.key] || []).map(([value, label]) => (
                          <option value={value} key={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : field.type === "multiselect" ? (
                    <>
                      <label className="form-label">{field.label}</label>
                      <div className="village-selection-list">
                        <label className="form-check village-selection-option village-selection-all">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={
                              field.options.length > 0 &&
                              (form[field.key] || []).length ===
                                field.options.length
                            }
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                [field.key]: event.target.checked
                                  ? field.options.map(([value]) => value)
                                  : [],
                              }))
                            }
                          />
                          <span className="form-check-label">Select all villages</span>
                        </label>
                        {field.options.map(([value, label]) => (
                          <label
                            className="form-check village-selection-option"
                            key={value}
                          >
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={(form[field.key] || []).includes(value)}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  [field.key]: event.target.checked
                                    ? [...(current[field.key] || []), value]
                                    : (current[field.key] || []).filter(
                                        (village) => village !== value
                                      ),
                                }))
                              }
                            />
                            <span className="form-check-label">{label}</span>
                          </label>
                        ))}
                      </div>
                      {page === "User Profiles" && (
                        <small className="form-text text-secondary">
                          Choose one, several, or all villages for this user.
                        </small>
                      )}
                    </>
                  ) : field.type === "textarea" ? (
                    <>
                      <label className="form-label" htmlFor={`field-${field.key}`}>
                        {field.label}
                      </label>
                      <textarea
                        id={`field-${field.key}`}
                        className="form-control"
                        rows={3}
                        value={form[field.key] ?? ""}
                        onChange={(e) =>
                          setForm((c) => ({ ...c, [field.key]: e.target.value }))
                        }
                        required={field.required}
                      />
                    </>
                  ) : (
                    <>
                      <label className="form-label" htmlFor={`field-${field.key}`}>
                        {field.label}
                      </label>
                      <input
                        id={`field-${field.key}`}
                        type={
                          ["email", "number", "date"].includes(field.type)
                            ? field.type
                            : "text"
                        }
                        className="form-control"
                        value={form[field.key] ?? ""}
                        readOnly={
                          page === "User Profiles" &&
                          Boolean(editingRow) &&
                          field.key === "user"
                        }
                        onChange={(e) =>
                          setForm((c) => ({ ...c, [field.key]: e.target.value }))
                        }
                        required={field.required}
                      />
                      {field.helpText && (
                        <small className="form-text text-secondary">
                          {field.helpText}
                        </small>
                      )}
                    </>
                  )}
                </div>
              ))}

              {hasAsyncChoices && choiceLoading && (
                <div className="text-secondary mb-3">
                  {page === "Donations"
                    ? "Loading donation choices..."
                    : "Loading user choices..."}
                </div>
              )}
              {hasAsyncChoices && choiceError && (
                <div className="alert alert-danger" role="alert">{choiceError}</div>
              )}
              <div className="d-flex flex-wrap gap-2 mt-4">
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={
                    formLoading ||
                    editLoadingId !== null ||
                    (hasAsyncChoices &&
                      (choiceLoading || Boolean(choiceError)))
                  }
                >
                  {formLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-lg me-2" />
                      {editingRow ? "Update" : "Save"}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-light border"
                  onClick={() => setShowForm(false)}
                  disabled={formLoading || editLoadingId !== null}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div
          className="modal-backdrop-custom"
          onClick={() => !deleteLoading && setDeleteTarget(null)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h5 className="fw-bold mb-2">Delete record?</h5>
            <p className="text-secondary">
              This action cannot be undone. Are you sure you want to delete this{" "}
              {page.toLowerCase()} record?
            </p>
            <div className="d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Deleting...
                  </>
                ) : (
                  "Yes, Delete"
                )}
              </button>
              <button
                type="button"
                className="btn btn-light border"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}