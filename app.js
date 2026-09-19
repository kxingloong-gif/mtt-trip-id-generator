import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.MTT_CONFIG;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const REGISTER_FETCH_LIMIT = 500;
const TRIP_SELECT_COLUMNS =
  "id, opportunity_id, current_description, original_description, created_at, status, " +
  "void_reason, voided_at, cancel_reason, cancelled_at, created_by, " +
  "creator:profiles!opportunities_created_by_fkey(full_name), " +
  "voider:profiles!opportunities_voided_by_fkey(full_name), " +
  "canceller:profiles!opportunities_cancelled_by_fkey(full_name)";

// -- DOM references ---------------------------------------------------
const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const loginForm = document.getElementById("login-form");
const loginButton = document.getElementById("login-button");
const loginError = document.getElementById("login-error");

const userName = document.getElementById("user-name");
const userRole = document.getElementById("user-role");
const logoutButton = document.getElementById("logout-button");
const pendingBanner = document.getElementById("pending-banner");

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
const exportRequestsCsvButton = document.getElementById("export-requests-csv-button");

const approvalSection = document.getElementById("approval-section");
const approvalBody = document.getElementById("approval-body");
const approvalStatus = document.getElementById("approval-status");

const searchInput = document.getElementById("search-input");
const registerBody = document.getElementById("register-body");
const registerStatus = document.getElementById("register-status");

const myRequestsBody = document.getElementById("my-requests-body");
const myRequestsStatus = document.getElementById("my-requests-status");

// Admin direct void modal
const voidModal = document.getElementById("void-modal");
const voidModalId = document.getElementById("void-modal-id");
const voidReason = document.getElementById("void-reason");
const voidError = document.getElementById("void-error");
const voidConfirmButton = document.getElementById("void-confirm-button");
const voidCancelButton = document.getElementById("void-cancel-button");

// Request amendment modal
const amendModal = document.getElementById("amend-modal");
const amendModalId = document.getElementById("amend-modal-id");
const amendCurrentDescription = document.getElementById("amend-current-description");
const amendProposed = document.getElementById("amend-proposed");
const amendReason = document.getElementById("amend-reason");
const amendError = document.getElementById("amend-error");
const amendSubmitButton = document.getElementById("amend-submit-button");
const amendCancelButton = document.getElementById("amend-cancel-button");

// Request void modal (consultant / supervisor)
const requestVoidModal = document.getElementById("request-void-modal");
const requestVoidModalId = document.getElementById("request-void-modal-id");
const requestVoidReason = document.getElementById("request-void-reason");
const requestVoidError = document.getElementById("request-void-error");
const requestVoidSubmitButton = document.getElementById("request-void-submit-button");
const requestVoidCancelButton = document.getElementById("request-void-cancel-button");

// Review request modal (supervisor / admin)
const reviewModal = document.getElementById("review-modal");
const reviewModalId = document.getElementById("review-modal-id");
const reviewType = document.getElementById("review-type");
const reviewCurrent = document.getElementById("review-current");
const reviewProposed = document.getElementById("review-proposed");
const reviewReason = document.getElementById("review-reason");
const reviewRequester = document.getElementById("review-requester");
const reviewRejectBox = document.getElementById("review-reject-box");
const reviewRejectionReason = document.getElementById("review-rejection-reason");
const reviewError = document.getElementById("review-error");
const reviewApproveButton = document.getElementById("review-approve-button");
const reviewRejectButton = document.getElementById("review-reject-button");
const reviewCancelButton = document.getElementById("review-cancel-button");

// Cancel trip modal (supervisor / admin)
const cancelModal = document.getElementById("cancel-modal");
const cancelModalId = document.getElementById("cancel-modal-id");
const cancelReason = document.getElementById("cancel-reason");
const cancelError = document.getElementById("cancel-error");
const cancelConfirmButton = document.getElementById("cancel-confirm-button");
const cancelCancelButton = document.getElementById("cancel-cancel-button");

// -- State --------------------------------------------------------------
let currentProfile = null; // { id, full_name, role, active }
let allRecords = []; // last fetched register rows
let voidTargetId = null; // opportunity_id (text) for admin direct void
let amendTargetRow = null; // full trip row for amendment
let requestVoidTargetRow = null; // full trip row for void request
let cancelTargetRow = null; // full trip row for cancellation
let reviewTargetRequest = null; // full request row being reviewed

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

function isAdmin() {
  return currentProfile?.role === "admin";
}

function isSupervisor() {
  return currentProfile?.role === "supervisor";
}

function isReviewer() {
  return isAdmin() || isSupervisor();
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

  adminExportSection.classList.toggle("hidden", !isAdmin());
  approvalSection.classList.toggle("hidden", !isReviewer());

  resetGenerateForm();
  await refreshAll();
}

async function refreshAll() {
  await loadRegister();
  await Promise.all([markPendingRequests(), loadMyRequests(), loadApprovalQueue()]);
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
    generateError.textContent = "Please enter a Trip Description.";
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
    generateError.textContent = err.message || "Failed to generate Trip ID.";
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
    .select(TRIP_SELECT_COLUMNS)
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

  const filtered = !query
    ? allRecords
    : allRecords.filter((r) => {
        const creatorName = r.creator?.full_name || "";
        return (
          r.opportunity_id.toLowerCase().includes(query) ||
          r.current_description.toLowerCase().includes(query) ||
          creatorName.toLowerCase().includes(query)
        );
      });

  registerBody.innerHTML = "";
  for (const r of filtered) {
    const tr = document.createElement("tr");
    if (r.status === "Void") tr.classList.add("void-row");
    if (r.status === "Cancelled") tr.classList.add("cancelled-row");

    const createdAt = formatDate(r.created_at);

    let statusText = r.status;
    if (r.status === "Void" && r.void_reason) statusText += ` (${r.void_reason})`;
    if (r.status === "Cancelled" && r.cancel_reason) statusText += ` (${r.cancel_reason})`;

    tr.innerHTML = `
      <td>${escapeHtml(r.opportunity_id)}</td>
      <td>${escapeHtml(r.current_description)}</td>
      <td>${escapeHtml(r.creator?.full_name || "")}</td>
      <td>${createdAt}</td>
      <td class="no-strike">${escapeHtml(statusText)}</td>
    `;

    const actionsTd = document.createElement("td");
    actionsTd.classList.add("no-strike");
    actionsTd.appendChild(buildActionButtons(r));
    tr.appendChild(actionsTd);

    registerBody.appendChild(tr);
  }
}

function buildActionButtons(r) {
  const wrap = document.createElement("div");
  wrap.className = "action-buttons";
  const isOwnRecord = currentProfile && r.created_by === currentProfile.id;
  const hasPending = r.pendingRequest === true;

  if (r.status === "Active" && isOwnRecord && !hasPending) {
    wrap.appendChild(makeButton("Request Amendment", () => openAmendModal(r)));
    wrap.appendChild(makeButton("Request Void", () => openRequestVoidModal(r)));
  }

  if (r.status === "Active" && isReviewer()) {
    wrap.appendChild(makeButton("Cancel", () => openCancelModal(r)));
  }

  if (r.status === "Active" && isAdmin()) {
    wrap.appendChild(makeButton("Admin Void", () => openVoidModal(r.opportunity_id)));
  }

  if (hasPending) {
    const note = document.createElement("span");
    note.className = "hint";
    note.textContent = "Request pending";
    wrap.appendChild(note);
  }

  return wrap;
}

function makeButton(label, onClick) {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.className = "small";
  btn.addEventListener("click", onClick);
  return btn;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// -- Mark which trips currently have a Pending request (for button state) --
async function markPendingRequests() {
  const { data, error } = await supabase
    .from("opportunity_requests")
    .select("trip_row_id")
    .eq("status", "Pending");

  if (error) return;
  const pendingTripIds = new Set(data.map((r) => r.trip_row_id));
  for (const r of allRecords) {
    r.pendingRequest = pendingTripIds.has(r.id);
  }
  renderRegister();
}

// -- Request Amendment ----------------------------------------------------
function openAmendModal(row) {
  amendTargetRow = row;
  amendModalId.textContent = row.opportunity_id;
  amendCurrentDescription.textContent = row.current_description;
  amendProposed.value = "";
  amendReason.value = "";
  amendError.textContent = "";
  amendModal.classList.remove("hidden");
}

amendCancelButton.addEventListener("click", () => {
  amendModal.classList.add("hidden");
  amendTargetRow = null;
});

amendSubmitButton.addEventListener("click", async () => {
  const proposed = amendProposed.value.trim();
  const reason = amendReason.value.trim();
  if (!proposed) {
    amendError.textContent = "Proposed new description is required.";
    return;
  }
  if (!reason) {
    amendError.textContent = "Amendment reason is required.";
    return;
  }

  amendSubmitButton.disabled = true;
  try {
    const { error } = await supabase.rpc("request_amendment", {
      p_trip_row_id: amendTargetRow.id,
      p_proposed_description: proposed,
      p_reason: reason,
    });
    if (error) throw error;
    amendModal.classList.add("hidden");
    amendTargetRow = null;
    await refreshAll();
  } catch (err) {
    amendError.textContent = err.message || "Failed to submit amendment request.";
  } finally {
    amendSubmitButton.disabled = false;
  }
});

// -- Request Void (consultant / supervisor) --------------------------------
function openRequestVoidModal(row) {
  requestVoidTargetRow = row;
  requestVoidModalId.textContent = row.opportunity_id;
  requestVoidReason.value = "";
  requestVoidError.textContent = "";
  requestVoidModal.classList.remove("hidden");
}

requestVoidCancelButton.addEventListener("click", () => {
  requestVoidModal.classList.add("hidden");
  requestVoidTargetRow = null;
});

requestVoidSubmitButton.addEventListener("click", async () => {
  const reason = requestVoidReason.value.trim();
  if (!reason) {
    requestVoidError.textContent = "Void reason is required.";
    return;
  }

  requestVoidSubmitButton.disabled = true;
  try {
    const { error } = await supabase.rpc("request_void", {
      p_trip_row_id: requestVoidTargetRow.id,
      p_reason: reason,
    });
    if (error) throw error;
    requestVoidModal.classList.add("hidden");
    requestVoidTargetRow = null;
    await refreshAll();
  } catch (err) {
    requestVoidError.textContent = err.message || "Failed to submit void request.";
  } finally {
    requestVoidSubmitButton.disabled = false;
  }
});

// -- Cancel trip (supervisor / admin, direct) ------------------------------
function openCancelModal(row) {
  cancelTargetRow = row;
  cancelModalId.textContent = row.opportunity_id;
  cancelReason.value = "";
  cancelError.textContent = "";
  cancelModal.classList.remove("hidden");
}

cancelCancelButton.addEventListener("click", () => {
  cancelModal.classList.add("hidden");
  cancelTargetRow = null;
});

cancelConfirmButton.addEventListener("click", async () => {
  const reason = cancelReason.value.trim();
  if (!reason) {
    cancelError.textContent = "Cancellation reason is required.";
    return;
  }

  cancelConfirmButton.disabled = true;
  try {
    const { error } = await supabase.rpc("cancel_opportunity", {
      p_trip_row_id: cancelTargetRow.id,
      p_reason: reason,
    });
    if (error) throw error;
    cancelModal.classList.add("hidden");
    cancelTargetRow = null;
    await loadRegister();
  } catch (err) {
    cancelError.textContent = err.message || "Failed to mark Trip ID Cancelled.";
  } finally {
    cancelConfirmButton.disabled = false;
  }
});

// -- Admin direct void ------------------------------------------------------
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

// -- My Requests ------------------------------------------------------------
async function loadMyRequests() {
  myRequestsStatus.textContent = "Loading...";
  const { data, error } = await supabase
    .from("opportunity_requests")
    .select(
      "id, request_type, proposed_description, reason, status, reviewed_at, rejection_reason, " +
        "trip:opportunities!opportunity_requests_trip_row_id_fkey(opportunity_id), " +
        "reviewer:profiles!opportunity_requests_reviewed_by_fkey(full_name)"
    )
    .eq("requested_by", currentProfile.id)
    .order("requested_at", { ascending: false });

  if (error) {
    myRequestsStatus.textContent = "Failed to load your requests: " + error.message;
    return;
  }

  myRequestsStatus.textContent = data.length === 0 ? "No requests submitted yet." : "";
  myRequestsBody.innerHTML = "";
  for (const r of data) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.trip?.opportunity_id || "")}</td>
      <td>${escapeHtml(r.request_type)}</td>
      <td>${escapeHtml(r.proposed_description || "")}</td>
      <td>${escapeHtml(r.reason)}</td>
      <td>${escapeHtml(r.status)}</td>
      <td>${escapeHtml(r.reviewer?.full_name || "")}</td>
      <td>${formatDateTime(r.reviewed_at)}</td>
      <td>${escapeHtml(r.rejection_reason || "")}</td>
    `;
    myRequestsBody.appendChild(tr);
  }
}

// -- Approval queue (supervisor / admin) -------------------------------------
async function loadApprovalQueue() {
  if (!isReviewer()) {
    updatePendingBanner(0);
    approvalSection.classList.add("hidden");
    return;
  }

  approvalStatus.textContent = "Loading...";
  const { data, error } = await supabase
    .from("opportunity_requests")
    .select(
      "id, request_type, current_description_at_request, proposed_description, reason, " +
        "requested_at, requested_by, " +
        "trip:opportunities!opportunity_requests_trip_row_id_fkey(opportunity_id), " +
        "requester:profiles!opportunity_requests_requested_by_fkey(full_name)"
    )
    .eq("status", "Pending")
    .order("requested_at", { ascending: true });

  if (error) {
    approvalStatus.textContent = "Failed to load pending requests: " + error.message;
    return;
  }

  approvalStatus.textContent = data.length === 0 ? "No pending requests." : "";
  approvalBody.innerHTML = "";
  for (const r of data) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.trip?.opportunity_id || "")}</td>
      <td>${escapeHtml(r.request_type)}</td>
      <td>${escapeHtml(r.current_description_at_request)}</td>
      <td>${escapeHtml(r.proposed_description || "")}</td>
      <td>${escapeHtml(r.reason)}</td>
      <td>${escapeHtml(r.requester?.full_name || "")}</td>
      <td>${formatDateTime(r.requested_at)}</td>
    `;
    const reviewTd = document.createElement("td");
    const canReview = r.requested_by !== currentProfile.id;
    if (canReview) {
      reviewTd.appendChild(makeButton("Review", () => openReviewModal(r)));
    } else {
      reviewTd.textContent = "Your own request";
    }
    tr.appendChild(reviewTd);
    approvalBody.appendChild(tr);
  }

  updatePendingBanner(data.length);
}

function updatePendingBanner(count) {
  if (!isReviewer() || count === 0) {
    pendingBanner.classList.add("hidden");
    pendingBanner.textContent = "";
    return;
  }
  pendingBanner.textContent = `You have ${count} pending amendment/void request(s) awaiting review.`;
  pendingBanner.classList.remove("hidden");
}

// -- Review request (supervisor / admin) -------------------------------------
function openReviewModal(r) {
  reviewTargetRequest = r;
  reviewModalId.textContent = r.trip?.opportunity_id || "";
  reviewType.textContent = r.request_type;
  reviewCurrent.textContent = r.current_description_at_request;
  reviewProposed.textContent = r.proposed_description || "(not applicable - void request)";
  reviewReason.textContent = r.reason;
  reviewRequester.textContent = `${r.requester?.full_name || ""} - ${formatDateTime(r.requested_at)}`;
  reviewRejectBox.classList.add("hidden");
  reviewRejectionReason.value = "";
  reviewError.textContent = "";
  reviewModal.classList.remove("hidden");
}

reviewCancelButton.addEventListener("click", () => {
  reviewModal.classList.add("hidden");
  reviewTargetRequest = null;
});

reviewApproveButton.addEventListener("click", async () => {
  await submitReview("Approve");
});

reviewRejectButton.addEventListener("click", async () => {
  if (reviewRejectBox.classList.contains("hidden")) {
    // First click: reveal the mandatory reason field.
    reviewRejectBox.classList.remove("hidden");
    return;
  }
  await submitReview("Reject");
});

async function submitReview(decision) {
  reviewError.textContent = "";
  const rejectionReason = reviewRejectionReason.value.trim();

  if (decision === "Reject" && !rejectionReason) {
    reviewError.textContent = "Rejection reason is required.";
    return;
  }

  reviewApproveButton.disabled = true;
  reviewRejectButton.disabled = true;
  try {
    const { error } = await supabase.rpc("review_request", {
      p_request_id: reviewTargetRequest.id,
      p_decision: decision,
      p_rejection_reason: decision === "Reject" ? rejectionReason : null,
    });
    if (error) throw error;
    reviewModal.classList.add("hidden");
    reviewTargetRequest = null;
    await refreshAll();
  } catch (err) {
    reviewError.textContent = err.message || "Failed to submit review decision.";
  } finally {
    reviewApproveButton.disabled = false;
    reviewRejectButton.disabled = false;
  }
}

// -- CSV export: Trip Register (admin only) ----------------------------------
exportCsvButton.addEventListener("click", async () => {
  exportCsvButton.disabled = true;
  try {
    const { data, error } = await supabase
      .from("opportunities")
      .select(
        "opportunity_id, sequence_year, sequence_number, original_description, " +
          "current_description, full_odoo_name, created_at, status, " +
          "void_reason, voided_at, cancel_reason, cancelled_at, " +
          "creator:profiles!opportunities_created_by_fkey(full_name), " +
          "voider:profiles!opportunities_voided_by_fkey(full_name), " +
          "canceller:profiles!opportunities_cancelled_by_fkey(full_name)"
      )
      .order("created_at", { ascending: true });

    if (error) throw error;

    const headers = [
      "Trip ID", "Sequence Year", "Sequence Number", "Original Description",
      "Current Approved Description", "Full Odoo Opportunity Name", "Created By",
      "Created At", "Status", "Void Reason", "Voided By", "Voided At",
      "Cancel Reason", "Cancelled By", "Cancelled At",
    ];

    const rows = data.map((r) => [
      r.opportunity_id,
      r.sequence_year,
      r.sequence_number,
      r.original_description,
      r.current_description,
      r.full_odoo_name,
      r.creator?.full_name || "",
      r.created_at,
      r.status,
      r.void_reason || "",
      r.voider?.full_name || "",
      r.voided_at || "",
      r.cancel_reason || "",
      r.canceller?.full_name || "",
      r.cancelled_at || "",
    ]);

    downloadCsv(headers, rows, "mtt-trip-register");
  } catch (err) {
    alert("Failed to export Trip Register CSV: " + (err.message || err));
  } finally {
    exportCsvButton.disabled = false;
  }
});

// -- CSV export: Amendment / Void request history (admin only) ---------------
exportRequestsCsvButton.addEventListener("click", async () => {
  exportRequestsCsvButton.disabled = true;
  try {
    const { data, error } = await supabase
      .from("opportunity_requests")
      .select(
        "request_type, current_description_at_request, proposed_description, reason, " +
          "status, requested_at, reviewed_at, rejection_reason, " +
          "trip:opportunities!opportunity_requests_trip_row_id_fkey(opportunity_id), " +
          "requester:profiles!opportunity_requests_requested_by_fkey(full_name), " +
          "reviewer:profiles!opportunity_requests_reviewed_by_fkey(full_name)"
      )
      .order("requested_at", { ascending: true });

    if (error) throw error;

    const headers = [
      "Trip ID", "Request Type", "Old Description", "Proposed Description",
      "Reason", "Status", "Requested By", "Requested At", "Reviewed By",
      "Reviewed At", "Rejection Reason",
    ];

    const rows = data.map((r) => [
      r.trip?.opportunity_id || "",
      r.request_type,
      r.current_description_at_request,
      r.proposed_description || "",
      r.reason,
      r.status,
      r.requester?.full_name || "",
      r.requested_at,
      r.reviewer?.full_name || "",
      r.reviewed_at || "",
      r.rejection_reason || "",
    ]);

    downloadCsv(headers, rows, "mtt-amendment-void-history");
  } catch (err) {
    alert("Failed to export amendment/void history CSV: " + (err.message || err));
  } finally {
    exportRequestsCsvButton.disabled = false;
  }
});

function downloadCsv(headers, rows, filenamePrefix) {
  const csv = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
