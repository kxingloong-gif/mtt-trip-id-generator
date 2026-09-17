import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.MTT_CONFIG;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const REGISTER_FETCH_LIMIT = 500;

// -- DOM references ---------------------------------------------------
const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const loginForm = document.getElementById("login-form");
const loginButton = document.getElementById("login-button");
const loginError = document.getElementById("login-error");

const userName = document.getElementById("user-name");
const userRole = document.getElementById("user-role");
const logoutButton = document.getElementById("logout-button");

const descriptionInput = document.getElementById("description");
const generateButton = document.getElementById("generate-button");
const generateError = document.getElementById("generate-error");
const resultBox = document.getElementById("result-box");
const resultId = document.getElementById("result-id");
const resultFull = document.getElementById("result-full");
const copyButton = document.getElementById("copy-button");
const copyConfirm = document.getElementById("copy-confirm");

const adminExportSection = document.getElementById("admin-export-section");
const exportCsvButton = document.getElementById("export-csv-button");
const adminVoidHeader = document.getElementById("admin-void-header");

const searchInput = document.getElementById("search-input");
const registerBody = document.getElementById("register-body");
const registerStatus = document.getElementById("register-status");

const voidModal = document.getElementById("void-modal");
const voidModalId = document.getElementById("void-modal-id");
const voidReason = document.getElementById("void-reason");
const voidError = document.getElementById("void-error");
const voidConfirmButton = document.getElementById("void-confirm-button");
const voidCancelButton = document.getElementById("void-cancel-button");

// -- State --------------------------------------------------------------
let currentProfile = null; // { id, full_name, role, active }
let allRecords = []; // last fetched register rows
let voidTargetId = null;

// -- Auth ---------------------------------------------------------------
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  loginButton.disabled = true;
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  loginButton.disabled = false;
  if (error) {
    loginError.textContent = error.message;
  }
});

logoutButton.addEventListener("click", async () => {
  await supabase.auth.signOut();
});

supabase.auth.onAuthStateChange((_event, session) => {
  if (session) {
    enterApp(session);
  } else {
    showLogin();
  }
});

function showLogin() {
  currentProfile = null;
  loginScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
  loginForm.reset();
}

async function enterApp(session) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", session.user.id)
    .single();

  if (error || !profile || !profile.active) {
    loginError.textContent = "Your account is not active. Contact your administrator.";
    await supabase.auth.signOut();
    return;
  }

  currentProfile = profile;
  loginScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  userName.textContent = profile.full_name;
  userRole.textContent = profile.role;

  const isAdmin = profile.role === "admin";
  adminExportSection.classList.toggle("hidden", !isAdmin);
  adminVoidHeader.classList.toggle("hidden", !isAdmin);

  resetGenerateForm();
  await loadRegister();
}

function resetGenerateForm() {
  descriptionInput.value = "";
  generateError.textContent = "";
  resultBox.classList.add("hidden");
  copyConfirm.classList.add("hidden");
}

// -- Generate ID ----------------------------------------------------------
generateButton.addEventListener("click", async () => {
  generateError.textContent = "";
  const description = descriptionInput.value.trim();
  if (!description) {
    generateError.textContent = "Please enter an Opportunity Description.";
    return;
  }

  generateButton.disabled = true;
  try {
    const { data, error } = await supabase.rpc("generate_opportunity_id", {
      p_description: description,
    });
    if (error) throw error;

    resultId.textContent = data.opportunity_id;
    resultFull.textContent = data.full_odoo_name;
    resultBox.classList.remove("hidden");
    copyConfirm.classList.add("hidden");
    descriptionInput.value = "";

    await loadRegister();
  } catch (err) {
    generateError.textContent = err.message || "Failed to generate Opportunity ID.";
  } finally {
    generateButton.disabled = false;
  }
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(resultFull.textContent);
    copyConfirm.classList.remove("hidden");
  } catch {
    generateError.textContent = "Could not copy to clipboard. Please copy manually.";
  }
});

// -- Register / search ------------------------------------------------
async function loadRegister() {
  registerStatus.textContent = "Loading...";
  const { data, error } = await supabase
    .from("opportunities")
    .select("opportunity_id, original_description, created_at, status, void_reason, voided_at, creator:profiles!opportunities_created_by_fkey(full_name), voider:profiles!opportunities_voided_by_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(REGISTER_FETCH_LIMIT);

  if (error) {
    registerStatus.textContent = "Failed to load records: " + error.message;
    return;
  }

  allRecords = data;
  registerStatus.textContent = `Showing latest ${data.length} record(s).`;
  renderRegister();
}

searchInput.addEventListener("input", renderRegister);

function renderRegister() {
  const query = searchInput.value.trim().toLowerCase();
  const isAdmin = currentProfile && currentProfile.role === "admin";

  const filtered = !query
    ? allRecords
    : allRecords.filter((r) => {
        const creatorName = r.creator?.full_name || "";
        return (
          r.opportunity_id.toLowerCase().includes(query) ||
          r.original_description.toLowerCase().includes(query) ||
          creatorName.toLowerCase().includes(query)
        );
      });

  registerBody.innerHTML = "";
  for (const r of filtered) {
    const tr = document.createElement("tr");
    if (r.status === "Void") tr.classList.add("void-row");

    const createdAt = new Date(r.created_at).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    tr.innerHTML = `
      <td>${escapeHtml(r.opportunity_id)}</td>
      <td>${escapeHtml(r.original_description)}</td>
      <td>${escapeHtml(r.creator?.full_name || "")}</td>
      <td>${createdAt}</td>
      <td class="no-strike">${r.status}${r.status === "Void" && r.void_reason ? ` (${escapeHtml(r.void_reason)})` : ""}</td>
    `;

    if (isAdmin) {
      const voidTd = document.createElement("td");
      voidTd.classList.add("no-strike");
      if (r.status === "Active") {
        const btn = document.createElement("button");
        btn.textContent = "Void";
        btn.className = "small";
        btn.addEventListener("click", () => openVoidModal(r.opportunity_id));
        voidTd.appendChild(btn);
      }
      tr.appendChild(voidTd);
    }

    registerBody.appendChild(tr);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// -- Void ---------------------------------------------------------------
function openVoidModal(opportunityId) {
  voidTargetId = opportunityId;
  voidModalId.textContent = opportunityId;
  voidReason.value = "";
  voidError.textContent = "";
  voidModal.classList.remove("hidden");
}

voidCancelButton.addEventListener("click", () => {
  voidModal.classList.add("hidden");
  voidTargetId = null;
});

voidConfirmButton.addEventListener("click", async () => {
  const reason = voidReason.value.trim();
  if (!reason) {
    voidError.textContent = "Void reason is required.";
    return;
  }
  voidConfirmButton.disabled = true;
  try {
    const { error } = await supabase.rpc("void_opportunity", {
      p_opportunity_id: voidTargetId,
      p_reason: reason,
    });
    if (error) throw error;
    voidModal.classList.add("hidden");
    voidTargetId = null;
    await loadRegister();
  } catch (err) {
    voidError.textContent = err.message || "Failed to void record.";
  } finally {
    voidConfirmButton.disabled = false;
  }
});

// -- CSV export (admin only) ---------------------------------------------
exportCsvButton.addEventListener("click", async () => {
  exportCsvButton.disabled = true;
  try {
    const { data, error } = await supabase
      .from("opportunities")
      .select("opportunity_id, sequence_year, sequence_number, original_description, full_odoo_name, created_at, status, void_reason, voided_at, creator:profiles!opportunities_created_by_fkey(full_name), voider:profiles!opportunities_voided_by_fkey(full_name)")
      .order("created_at", { ascending: true });

    if (error) throw error;

    const headers = [
      "Opportunity ID", "Sequence Year", "Sequence Number", "Original Description",
      "Full Odoo Opportunity Name", "Created By", "Created At", "Status",
      "Void Reason", "Voided By", "Voided At",
    ];

    const rows = data.map((r) => [
      r.opportunity_id,
      r.sequence_year,
      r.sequence_number,
      r.original_description,
      r.full_odoo_name,
      r.creator?.full_name || "",
      r.created_at,
      r.status,
      r.void_reason || "",
      r.voider?.full_name || "",
      r.voided_at || "",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mtt-opportunity-register-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert("Failed to export CSV: " + (err.message || err));
  } finally {
    exportCsvButton.disabled = false;
  }
});

function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
