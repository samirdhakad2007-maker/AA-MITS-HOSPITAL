"use strict";

const modules = {
  patients: { title: "Patients", icon: "♙", fields: [
    ["name", "Full name"], ["age", "Age", "number"], ["gender", "Gender"], ["phone", "Phone"], ["address", "Address"]
  ] },
  doctors: { title: "Doctors", icon: "✚", fields: [
    ["name", "Full name"], ["specialization", "Specialization"], ["phone", "Phone"]
  ] },
  appointments: { title: "Appointments", icon: "▣", fields: [
    ["patientId", "Patient ID", "number"], ["doctorId", "Doctor ID", "number"], ["date", "Date", "date"], ["time", "Time", "time"], ["status", "Status", "select", ["Scheduled", "Completed", "Cancelled"]]
  ] },
  beds: { title: "Rooms & Beds", icon: "▤", fields: [
    ["ward", "Ward"], ["bedNumber", "Bed number"], ["status", "Status", "select", ["Available", "Occupied"]]
  ] },
  bills: { title: "Billing", icon: "＄", fields: [
    ["patientId", "Patient ID", "number"], ["amount", "Amount", "number"], ["description", "Description"], ["status", "Status", "select", ["Pending", "Paid"]]
  ] },
  medicines: { title: "Pharmacy", icon: "⚕", fields: [
    ["name", "Medicine name"], ["category", "Category"], ["quantity", "Quantity", "number"], ["unitPrice", "Unit price", "number"]
  ] },
  records: { title: "Medical Records", icon: "▧", fields: [
    ["patientId", "Patient ID", "number"], ["doctorId", "Doctor ID", "number"], ["diagnosis", "Diagnosis"], ["prescription", "Prescription"], ["date", "Date", "date"]
  ] },
  staff: { title: "Staff", icon: "♧", fields: [
    ["name", "Full name"], ["role", "Role"], ["department", "Department"], ["phone", "Phone"]
  ] }
};

const authRoot = document.getElementById("auth-root");
const appRoot = document.getElementById("app-root");
const data = Object.fromEntries(Object.keys(modules).map(key => [key, []]));
let authMode = "login";
let setupRequired = false;
let currentUser = null;
let activePage = "dashboard";
let toastTimer;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

async function api(url, options = {}) {
  let response;
  try {
    response = await fetch(url, { credentials: "same-origin", ...options });
  } catch {
    throw new Error("Cannot reach the portal server. Start the server and try again.");
  }
  let result = {};
  try {
    result = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }
  if (!response.ok) {
    const error = new Error(result.error || "The request could not be completed.");
    error.status = response.status;
    if (response.status === 401 && currentUser) {
      currentUser = null;
      appRoot.hidden = true;
      authRoot.hidden = false;
      authMode = setupRequired ? "setup" : "login";
      renderAuth("Your session expired. Please sign in again.");
    }
    throw error;
  }
  return result;
}

function renderAuth(message = "") {
  authRoot.hidden = false;
  const isSetup = authMode === "setup";
  const isSignup = authMode === "signup";
  const heading = isSetup ? "Set up administrator" : isSignup ? "Create your account" : "Sign in";
  const description = isSetup
    ? "Create the first administrator account. Use the one-time setup code shown in the server console."
    : isSignup
      ? "Create a personal account and sign in as soon as it is created."
      : "Sign in with your AA.MITS HOSPITAL account.";
  authRoot.innerHTML = `<main class="auth-screen"><section class="auth-card">
    <div class="auth-brand"><span class="brand-mark">+</span><span>AA.MITS HOSPITAL</span></div>
    <h1>${heading}</h1><p class="subtitle">${description}</p>
    <form id="auth-form">
      ${isSetup ? '<label>One-time setup code<input name="setupToken" type="password" autocomplete="off" required></label>' : ""}
      ${isSignup || isSetup ? '<label>Full name<input name="fullName" type="text" maxlength="80" autocomplete="name" required></label>' : ""}
      <label>Username<input name="username" type="text" minlength="3" maxlength="32" pattern="[a-zA-Z0-9._-]{3,32}" autocomplete="username" required></label>
      <label>Password<input name="password" type="password" minlength="12" maxlength="128" autocomplete="${isSignup || isSetup ? "new-password" : "current-password"}" required></label>
      ${isSignup ? '<label>Confirm password<input name="confirmPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></label>' : ""}
      <button class="primary" type="submit">${isSetup ? "Create administrator" : isSignup ? "Create account" : "Sign in"}</button>
    </form>
    <div class="auth-message" id="auth-message" role="status">${escapeHtml(message)}</div>
    ${isSetup ? "" : `<p class="auth-switch">${isSignup ? 'Already have an account?' : "Need an account?"} <button class="text-button" type="button" data-auth-mode="${isSignup ? "login" : "signup"}">${isSignup ? "Sign in" : "Sign up"}</button></p>`}
    ${isSignup ? "" : '<p class="auth-hint">Passwords must be at least 12 characters.</p>'}
  </section></main>`;
}

function showAuthMessage(message) {
  const target = document.getElementById("auth-message");
  if (target) target.textContent = message;
}

async function fetchPortalData() {
  const results = await Promise.all(Object.keys(modules).map(key => api(`/api/${key}`)));
  Object.keys(modules).forEach((key, index) => { data[key] = results[index].records; });
}

async function enterPortal(user) {
  currentUser = user;
  authRoot.hidden = true;
  appRoot.hidden = false;
  const fullName = user.fullName || user.username;
  document.getElementById("profile-name").textContent = `${fullName} (${user.role})`;
  document.getElementById("profile-avatar").textContent = fullName.slice(0, 1).toUpperCase();
  try {
    await fetchPortalData();
    activePage = "dashboard";
    render();
  } catch (error) {
    appRoot.hidden = true;
    authRoot.hidden = false;
    authMode = "login";
    renderAuth(error.message);
  }
}

authRoot.addEventListener("submit", async event => {
  if (event.target.id !== "auth-form") return;
  event.preventDefault();
  const form = event.target;
  const values = Object.fromEntries(new FormData(form));
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  showAuthMessage("");
  try {
    if (authMode === "signup" && values.password !== values.confirmPassword) {
      throw new Error("Passwords do not match.");
    }
    const route = authMode === "setup" ? "/api/setup" : authMode === "signup" ? "/api/signup" : "/api/login";
    const result = await api(route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    if (authMode === "signup") {
      authMode = "login";
      renderAuth(result.message);
      return;
    }
    setupRequired = false;
    await enterPortal(result.user);
  } catch (error) {
    showAuthMessage(error.message);
    button.disabled = false;
  }
});

authRoot.addEventListener("click", event => {
  const switchButton = event.target.closest("[data-auth-mode]");
  if (!switchButton) return;
  authMode = switchButton.dataset.authMode;
  renderAuth();
});

function canManage(moduleKey) {
  return currentUser?.role === "admin" || (currentUser?.role === "user" && ["patients", "appointments"].includes(moduleKey));
}

function renderNavigation() {
  const links = [["dashboard", "⌂", "Dashboard"], ...Object.entries(modules).map(([key, item]) => [key, item.icon, item.title])];
  if (currentUser.role === "admin") links.push(["users", "♧", "User accounts"]);
  document.getElementById("navigation").innerHTML = links.map(([key, icon, title]) =>
    `<button class="nav-item ${key === activePage ? "active" : ""}" data-page="${key}"><span class="nav-icon">${icon}</span><span>${title}</span></button>`
  ).join("");
}

function displayValue(moduleKey, field, value) {
  if (["appointments", "records"].includes(moduleKey) && field === "patientId") {
    return data.patients.find(item => item.id === Number(value))?.name || `#${value}`;
  }
  if (["appointments", "records"].includes(moduleKey) && field === "doctorId") {
    return data.doctors.find(item => item.id === Number(value))?.name || `#${value}`;
  }
  if (moduleKey === "bills" && field === "patientId") {
    return data.patients.find(item => item.id === Number(value))?.name || `#${value}`;
  }
  return value === "" || value == null ? "—" : value;
}

function statusClass(value) {
  const state = String(value).toLowerCase();
  return ["pending", "scheduled", "available", "cancelled", "unavailable", "occupied"].includes(state) ? `status ${state}` : "status";
}

function renderTable(moduleKey, items, compact = false) {
  const module = modules[moduleKey];
  const fields = compact ? module.fields.slice(0, 4) : module.fields;
  const showActions = !compact && canManage(moduleKey);
  if (!items.length) return `<div class="empty">No ${module.title.toLowerCase()} added yet.</div>`;
  return `<div class="table-wrap"><table><thead><tr>${fields.map(field => `<th>${escapeHtml(field[1])}</th>`).join("")}${showActions ? "<th>Actions</th>" : ""}</tr></thead><tbody>${items.map(item =>
    `<tr>${fields.map(field => {
      const value = displayValue(moduleKey, field[0], item[field[0]]);
      return `<td>${field[0] === "status" ? `<span class="${statusClass(value)}">${escapeHtml(value)}</span>` : escapeHtml(value)}</td>`;
    }).join("")}${showActions ? `<td><div class="actions"><button class="mini-button" data-edit="${item.id}" data-module="${moduleKey}">Edit</button><button class="mini-button delete" data-delete="${item.id}" data-module="${moduleKey}">Delete</button></div></td>` : ""}</tr>`
  ).join("")}</tbody></table></div>`;
}

function renderDashboard() {
  const counts = [
    ["patients", "Total patients", "♙"], ["doctors", "Active doctors", "✚"],
    ["appointments", "Appointments", "▣"], ["beds", "Beds", "▤"]
  ];
  const recent = [...data.appointments].slice(-5).reverse();
  const actions = [
    ["patients", "♙", "Register a patient"], ["appointments", "▣", "Schedule appointment"], ["doctors", "✚", "Add a doctor"]
  ].filter(([key]) => canManage(key));
  document.getElementById("content").innerHTML = `
    <section class="welcome-banner"><div class="welcome-content"><span class="welcome-kicker">AA.MITS HOSPITAL</span><h1>Welcome back, ${escapeHtml(currentUser.fullName || currentUser.username)}</h1><p>Better care, a healthier tomorrow.</p>${canManage("patients") ? '<button class="welcome-button" data-add="patients">Register a patient</button>' : ""}</div></section>
    <section class="stats">${counts.map(([key, title, icon]) => `<div class="stat"><div class="stat-top"><span>${title}</span><span class="stat-icon">${icon}</span></div><strong>${data[key].length}</strong></div>`).join("")}</section>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-heading"><h2>Recent appointments</h2><button class="text-button" data-page="appointments">View all</button></div>${renderTable("appointments", recent, true)}</section>
      <section class="panel"><div class="panel-heading"><h2>Quick actions</h2></div><div class="quick-actions">${actions.map(([key, icon, label]) => `<button class="quick-action" data-add="${key}"><span class="quick-icon">${icon}</span>${label}</button>`).join("") || '<div class="empty">No quick actions available for your role.</div>'}</div></section>
    </div>`;
}

function renderModule(moduleKey) {
  const module = modules[moduleKey];
  const query = document.getElementById("module-search")?.value.toLowerCase() || "";
  const items = data[moduleKey].filter(item => JSON.stringify(item).toLowerCase().includes(query));
  document.getElementById("content").innerHTML = `
    <div class="page-heading"><div><h1>${module.title}</h1><p class="subtitle">View hospital ${module.title.toLowerCase()} records.</p></div>${canManage(moduleKey) ? `<button class="primary" data-add="${moduleKey}">＋ Add ${module.title.replace(/s$/, "").toLowerCase()}</button>` : ""}</div>
    <div class="section-toolbar"><input class="search" id="module-search" type="search" placeholder="Search ${module.title.toLowerCase()}..." value="${escapeHtml(query)}"><span class="subtitle">${items.length} record${items.length === 1 ? "" : "s"}</span></div>
    <section class="panel">${renderTable(moduleKey, items)}</section>`;
  document.getElementById("module-search").addEventListener("input", event => {
    const value = event.target.value;
    renderModule(moduleKey);
    const input = document.getElementById("module-search");
    input.focus();
    input.setSelectionRange(value.length, value.length);
  });
}

async function renderUsers() {
  const content = document.getElementById("content");
  content.innerHTML = `<div class="page-heading"><div><h1>User accounts</h1><p class="subtitle">View the accounts registered in the portal.</p></div></div><section class="panel"><div class="empty">Loading accounts…</div></section>`;
  const result = await api("/api/admin/users");
  content.innerHTML = `<div class="page-heading"><div><h1>User accounts</h1><p class="subtitle">View the accounts registered in the portal.</p></div></div>
    <section class="panel"><div class="table-wrap"><table><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Created</th></tr></thead><tbody>${result.users.map(account =>
      `<tr><td>${escapeHtml(account.fullName || account.username)}</td><td>${escapeHtml(account.username)}</td><td>${escapeHtml(account.role)}</td><td>${escapeHtml(account.createdAt)}</td></tr>`
    ).join("") || '<tr><td colspan="4" class="empty">No accounts found.</td></tr>'}</tbody></table></div></section>`;
}

function render() {
  renderNavigation();
  const title = activePage === "dashboard" ? "Dashboard" : activePage === "users" ? "User accounts" : modules[activePage].title;
  document.getElementById("breadcrumb").textContent = title;
  if (activePage === "dashboard") renderDashboard();
  else if (activePage === "users") renderUsers().catch(error => showToast(error.message));
  else renderModule(activePage);
}

function openForm(moduleKey, id) {
  if (!canManage(moduleKey)) return;
  const module = modules[moduleKey];
  const existing = id == null ? null : data[moduleKey].find(item => item.id === id);
  if (id != null && !existing) return showToast("Record not found.");
  const fields = module.fields.map(([key, label, type, options]) => {
    const value = existing?.[key] ?? (key === "status" ? options[0] : "");
    const input = type === "select"
      ? `<select name="${key}" required>${options.map(option => `<option value="${escapeHtml(option)}" ${String(value) === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select>`
      : `<input name="${key}" type="${type || "text"}" value="${escapeHtml(value)}" ${key === "amount" || key === "unitPrice" ? 'min="0" step="0.01"' : type === "number" ? 'min="0" step="1"' : ""} required>`;
    return `<label>${escapeHtml(label)}${input}</label>`;
  }).join("");
  document.getElementById("modal-root").innerHTML = `<div class="overlay" id="overlay"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
    <div class="dialog-head"><h2 id="dialog-title">${existing ? "Edit" : "Add"} ${module.title.replace(/s$/, "")}</h2><button class="close" type="button" aria-label="Close">×</button></div>
    <form class="record-form" id="record-form">${fields}<div id="form-error" class="auth-message" role="status"></div><div class="form-actions"><button class="secondary" type="button" data-close>Cancel</button><button class="primary" type="submit">Save record</button></div></form></section></div>`;
  const overlay = document.getElementById("overlay");
  overlay.addEventListener("click", event => { if (event.target === overlay || event.target.closest("[data-close], .close")) closeForm(); });
  document.getElementById("record-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    const record = {};
    new FormData(form).forEach((value, key) => {
      const definition = module.fields.find(field => field[0] === key);
      record[key] = definition?.[2] === "number" ? Number(value) : String(value).trim();
    });
    try {
      await api(existing ? `/api/${moduleKey}/${id}` : `/api/${moduleKey}`, {
        method: existing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record)
      });
      await fetchPortalData();
      closeForm();
      render();
      showToast(existing ? "Record updated" : "Record added");
    } catch (error) {
      document.getElementById("form-error").textContent = error.message;
      button.disabled = false;
    }
  });
}

function closeForm() { document.getElementById("modal-root").innerHTML = ""; }

function openProfile() {
  document.getElementById("modal-root").innerHTML = `<div class="overlay" id="profile-overlay"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title">
    <div class="dialog-head"><h2 id="profile-title">Your profile</h2><button class="close" type="button" aria-label="Close">×</button></div>
    <form class="record-form" id="profile-form"><label>Full name<input name="fullName" type="text" maxlength="80" value="${escapeHtml(currentUser.fullName || currentUser.username)}" required></label><div id="profile-error" class="auth-message" role="status"></div><div class="form-actions"><button class="secondary" type="button" data-close>Cancel</button><button class="primary" type="submit">Save name</button></div></form>
  </section></div>`;
  const overlay = document.getElementById("profile-overlay");
  overlay.addEventListener("click", event => { if (event.target === overlay || event.target.closest("[data-close], .close")) closeForm(); });
  document.getElementById("profile-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    const fullName = new FormData(form).get("fullName").trim();
    try {
      const result = await api("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName })
      });
      currentUser = result.user;
      closeForm();
      render();
      showToast("Profile name updated");
    } catch (error) {
      document.getElementById("profile-error").textContent = error.message;
      button.disabled = false;
    }
  });
}

function showToast(message) {
  document.querySelector(".toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.remove(), 2500);
}

document.addEventListener("click", async event => {
  const page = event.target.closest("[data-page]");
  if (page) { activePage = page.dataset.page; render(); return; }
  const add = event.target.closest("[data-add]");
  if (add) { openForm(add.dataset.add); return; }
  const edit = event.target.closest("[data-edit]");
  if (edit) { openForm(edit.dataset.module, Number(edit.dataset.edit)); return; }
  const remove = event.target.closest("[data-delete]");
  if (remove) {
    const moduleKey = remove.dataset.module;
    const id = Number(remove.dataset.delete);
    if (!canManage(moduleKey) || !confirm("Delete this record?")) return;
    try {
      await api(`/api/${moduleKey}/${id}`, { method: "DELETE" });
      await fetchPortalData();
      render();
      showToast("Record deleted");
    } catch (error) { showToast(error.message); }
    return;
  }
});

document.getElementById("profile-button").addEventListener("click", openProfile);

document.getElementById("logout-button").addEventListener("click", async () => {
  try { await api("/api/logout", { method: "POST" }); }
  catch (error) { showToast(error.message); }
  currentUser = null;
  appRoot.hidden = true;
  authRoot.hidden = false;
  authMode = "login";
  renderAuth();
});

async function boot() {
  try {
    const status = await api("/api/setup/status");
    setupRequired = status.setupRequired;
    if (setupRequired) {
      authMode = "setup";
      renderAuth();
      return;
    }
    try {
      const result = await api("/api/me");
      await enterPortal(result.user);
    } catch (error) {
      authMode = "login";
      renderAuth(error.status === 401 ? "" : error.message);
    }
  } catch (error) {
    authMode = "login";
    renderAuth(error.message);
  }
}

boot();
