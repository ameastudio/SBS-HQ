const SUPABASE_URL = "https://soqpxkdbsddatrouudke.supabase.co";
const SUPABASE_KEY = "sb_publishable_O4w_43CQJJXL5sedjwUdeA_J6WbOmO3";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const state = {
  user: null,
  profile: null,
  bookings: [],
  payments: [],
  clients: [],
  blockedSlots: [],
  bookingFilter: "all",
  paymentFilter: "submitted",
  calendarCursor: new Date(),
  selectedDate: null
};

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function money(value) {
  return `J$${Number(value || 0).toLocaleString("en-JM", {
    maximumFractionDigits: 2
  })}`;
}

function titleCase(value = "") {
  return String(value)
    .replaceAll("_"," ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function dateText(value) {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-JM", {
    month:"short", day:"numeric", year:"numeric"
  });
}

function shortDate(value) {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-JM", {
    month:"short", day:"numeric"
  });
}

function timeText(value) {
  if (!value) return "—";
  const [h,m] = String(value).split(":").map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toLocaleTimeString("en-JM", {hour:"numeric",minute:"2-digit"});
}

function isoToday() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0,10);
}

function emptyCard(text) {
  return `<div class="empty-card">${escapeHtml(text)}</div>`;
}

function statusChip(status) {
  return `<span class="status-chip ${escapeHtml(status)}">${escapeHtml(titleCase(status))}</span>`;
}

function clientNameFromBooking(booking) {
  return booking.profiles?.full_name || booking.client_email || "Client";
}

function shootName(booking) {
  return booking.shoot_types?.name || booking.custom_shoot_name || "Photography Session";
}

function packageName(booking) {
  return booking.package_name || "Photography Package";
}

function locationText(booking) {
  if (booking.location_type === "On Location" && booking.location_text) {
    return booking.location_text;
  }
  return booking.location_type || "—";
}

async function verifyAdmin(user) {
  const { data, error } = await sb
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.role !== "admin") {
    await sb.auth.signOut();
    throw new Error("This account does not have admin access.");
  }

  return data;
}

function showLogin(message = "") {
  $("#appView").classList.add("hidden");
  $("#loginView").classList.remove("hidden");
  $("#loginMessage").textContent = message;
}

function showApp() {
  $("#loginView").classList.add("hidden");
  $("#appView").classList.remove("hidden");

  const name = state.profile?.full_name?.trim() || "Spaceboi";
  const first = name.split(/\s+/)[0] || "Spaceboi";
  $("#ownerName").textContent = first;
  $("#heroOwnerName").textContent = `${first}.`;

  $("#todayLabel").textContent = new Date().toLocaleDateString("en-JM", {
    weekday:"long",
    month:"long",
    day:"numeric"
  });
}

async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;

  state.user = data.user;
  state.profile = await verifyAdmin(data.user);

  showApp();
  await refreshAll();
}

async function restoreSession() {
  const { data } = await sb.auth.getSession();
  const user = data.session?.user;
  if (!user) {
    showLogin();
    return;
  }

  try {
    state.user = user;
    state.profile = await verifyAdmin(user);
    showApp();
    await refreshAll();
  } catch (error) {
    showLogin(error.message);
  }
}

async function refreshAll() {
  await Promise.all([
    loadBookings(),
    loadPayments(),
    loadClients(),
    loadBlockedSlots()
  ]);

  renderDashboard();
  renderBookings();
  renderPayments();
  renderClients();
  renderCalendar();
}

async function loadBookings() {
  const { data, error } = await sb
    .from("bookings")
    .select(`
      id,
      client_id,
      custom_shoot_name,
      package_name,
      package_price,
      status,
      preferred_date,
      preferred_time,
      duration_minutes,
      photos_received,
      edited_photos,
      location_type,
      location_text,
      notes,
      instagram_handle,
      portfolio_permission,
      tag_permission,
      quoted_subtotal,
      travel_fee,
      extras_total,
      discount_type,
      discount_value,
      discount_amount,
      final_total,
      deposit_required,
      amount_paid,
      payment_proof_status,
      reschedule_count,
      download_url,
      created_at,
      profiles(full_name,phone,instagram_handle),
      shoot_types(name,slug)
    `)
    .order("created_at",{ascending:false});

  if (error) throw error;
  state.bookings = data || [];
}

async function loadPayments() {
  const { data, error } = await sb
    .from("payments")
    .select(`
      id,
      booking_id,
      client_id,
      payment_type,
      amount,
      proof_url,
      status,
      admin_note,
      created_at,
      reviewed_at,
      bookings(
        id,
        preferred_date,
        preferred_time,
        package_name,
        status,
        profiles(full_name,phone),
        shoot_types(name)
      )
    `)
    .order("created_at",{ascending:false});

  if (error) throw error;
  state.payments = data || [];
}

async function loadClients() {
  const { data, error } = await sb
    .from("profiles")
    .select("id,full_name,phone,instagram_handle,role,created_at")
    .eq("role","client")
    .order("created_at",{ascending:false});

  if (error) throw error;
  state.clients = data || [];
}

async function loadBlockedSlots() {
  const { data, error } = await sb
    .from("blocked_slots")
    .select("*")
    .order("block_date",{ascending:true});

  if (error) throw error;
  state.blockedSlots = data || [];
}

function bookingCard(booking, compact = false) {
  const client = clientNameFromBooking(booking);

  return `
    <article class="booking-card" data-booking-id="${booking.id}">
      <div class="card-top">
        <div>
          ${statusChip(booking.status)}
          <h4>${escapeHtml(shootName(booking))}</h4>
          <p class="card-sub">${escapeHtml(client)} • ${escapeHtml(packageName(booking))}</p>
        </div>
        <div class="card-date">${escapeHtml(shortDate(booking.preferred_date))}<br>${escapeHtml(timeText(booking.preferred_time))}</div>
      </div>
      ${compact ? "" : `
        <div class="card-meta">
          <div><span>LOCATION</span><strong>${escapeHtml(locationText(booking))}</strong></div>
          <div><span>DURATION</span><strong>${booking.duration_minutes || 60} min</strong></div>
          <div><span>TOTAL</span><strong>${money(booking.final_total || booking.quoted_subtotal || booking.package_price)}</strong></div>
          <div><span>PAID</span><strong>${money(booking.amount_paid)}</strong></div>
        </div>
      `}
      <div class="card-actions">
        <button class="action-secondary" data-open-booking="${booking.id}">VIEW DETAILS</button>
        ${booking.status === "requested" ? `<button class="action-primary" data-confirm-booking="${booking.id}">CONFIRM</button>` : ""}
      </div>
    </article>
  `;
}

function paymentCard(payment, compact = false) {
  const b = payment.bookings || {};
  const client = b.profiles?.full_name || "Client";
  const shoot = b.shoot_types?.name || "Photography Session";

  return `
    <article class="payment-card" data-payment-id="${payment.id}">
      <div class="card-top">
        <div>
          ${statusChip(payment.status)}
          <h4>${escapeHtml(client)}</h4>
          <p class="card-sub">${escapeHtml(shoot)} • ${escapeHtml(titleCase(payment.payment_type))}</p>
        </div>
        <div class="card-date">${escapeHtml(shortDate(b.preferred_date))}</div>
      </div>
      <div class="amount-line">
        <span>AMOUNT SUBMITTED</span>
        <strong>${money(payment.amount)}</strong>
      </div>
      <div class="card-actions">
        <button class="action-secondary" data-open-payment="${payment.id}">VIEW PROOF</button>
        ${payment.status === "submitted" ? `<button class="action-primary" data-accept-payment="${payment.id}">ACCEPT</button>` : ""}
      </div>
    </article>
  `;
}

function renderDashboard() {
  const today = isoToday();

  const requests = state.bookings.filter(b => b.status === "requested");
  const upcoming = state.bookings.filter(b =>
    ["confirmed","booked"].includes(b.status) &&
    b.preferred_date >= today
  ).sort((a,b) =>
    `${a.preferred_date}T${a.preferred_time}`.localeCompare(`${b.preferred_date}T${b.preferred_time}`)
  );

  const paymentReview = state.payments.filter(p => p.status === "submitted");

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthRevenue = state.payments
    .filter(p => p.status === "accepted" && new Date(p.reviewed_at || p.created_at) >= firstDay)
    .reduce((sum,p) => sum + Number(p.amount || 0), 0);

  $("#metricRequests").textContent = requests.length;
  $("#metricUpcoming").textContent = upcoming.length;
  $("#metricPayments").textContent = paymentReview.length;
  $("#metricRevenue").textContent = money(monthRevenue);

  $("#homeRequests").innerHTML = requests.length
    ? requests.slice(0,3).map(b => bookingCard(b,true)).join("")
    : emptyCard("No new booking requests.");

  $("#homePayments").innerHTML = paymentReview.length
    ? paymentReview.slice(0,3).map(p => paymentCard(p,true)).join("")
    : emptyCard("No payment proofs waiting.");

  $("#homeUpcoming").innerHTML = upcoming.length
    ? upcoming.slice(0,4).map(b => bookingCard(b,true)).join("")
    : emptyCard("No upcoming shoots yet.");
}

function renderBookings() {
  const filtered = state.bookingFilter === "all"
    ? state.bookings
    : state.bookings.filter(b => b.status === state.bookingFilter);

  $("#bookingsList").innerHTML = filtered.length
    ? filtered.map(b => bookingCard(b)).join("")
    : emptyCard(`No ${state.bookingFilter === "all" ? "" : state.bookingFilter + " "}bookings.`);
}

function renderPayments() {
  const filtered = state.paymentFilter === "all"
    ? state.payments
    : state.payments.filter(p => p.status === state.paymentFilter);

  $("#paymentsList").innerHTML = filtered.length
    ? filtered.map(p => paymentCard(p)).join("")
    : emptyCard("No payments in this section.");
}

function renderClients(search = "") {
  const q = search.trim().toLowerCase();
  const clients = state.clients.filter(c => {
    if (!q) return true;
    return [
      c.full_name,
      c.phone,
      c.instagram_handle
    ].some(v => String(v || "").toLowerCase().includes(q));
  });

  $("#clientsList").innerHTML = clients.length ? clients.map(client => {
    const bookings = state.bookings.filter(b => b.client_id === client.id);
    const completed = bookings.filter(b => b.status === "completed").length;

    return `
      <article class="client-card">
        <h4>${escapeHtml(client.full_name || "Client")}</h4>
        <p class="card-sub">${escapeHtml(client.phone || "No phone")} ${client.instagram_handle ? `• ${escapeHtml(client.instagram_handle)}` : ""}</p>
        <div class="card-meta">
          <div><span>BOOKINGS</span><strong>${bookings.length}</strong></div>
          <div><span>COMPLETED</span><strong>${completed}</strong></div>
        </div>
      </article>
    `;
  }).join("") : emptyCard("No clients found.");
}

function renderCalendar() {
  const cursor = state.calendarCursor;
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  $("#calendarMonth").textContent = cursor.toLocaleDateString("en-JM", {
    month:"long",
    year:"numeric"
  });

  const first = new Date(year,month,1);
  const start = new Date(year,month,1 - first.getDay());

  const days = [];
  for (let i=0;i<42;i++) {
    const d = new Date(start);
    d.setDate(start.getDate()+i);
    const iso = [
      d.getFullYear(),
      String(d.getMonth()+1).padStart(2,"0"),
      String(d.getDate()).padStart(2,"0")
    ].join("-");

    const hasShoot = state.bookings.some(b =>
      b.preferred_date === iso && ["confirmed","booked","completed"].includes(b.status)
    );
    const isToday = iso === isoToday();
    const selected = iso === state.selectedDate;
    const outside = d.getMonth() !== month;

    days.push(`
      <button
        class="calendar-day ${outside ? "outside" : ""} ${isToday ? "today" : ""} ${selected ? "selected" : ""} ${hasShoot ? "has-shoot" : ""}"
        data-calendar-date="${iso}"
      >${d.getDate()}</button>
    `);
  }

  $("#calendarGrid").innerHTML = days.join("");

  if (state.selectedDate) {
    renderSelectedDay(state.selectedDate);
  }
}

function renderSelectedDay(date) {
  state.selectedDate = date;
  $("#selectedDayTitle").textContent = dateText(date);

  const shoots = state.bookings
    .filter(b => b.preferred_date === date && !["cancelled","declined"].includes(b.status))
    .sort((a,b) => String(a.preferred_time).localeCompare(String(b.preferred_time)));

  const blocks = state.blockedSlots
    .filter(s => s.block_date === date)
    .sort((a,b) => String(a.start_time).localeCompare(String(b.start_time)));

  const items = [
    ...shoots.map(b => bookingCard(b,true)),
    ...blocks.map(slot => `
      <article class="day-card">
        <div class="card-top">
          <div>
            <span class="status-chip rejected">BLOCKED</span>
            <h4>${escapeHtml(slot.reason || "Unavailable")}</h4>
          </div>
          <div class="card-date">${escapeHtml(timeText(slot.start_time))}<br>to ${escapeHtml(timeText(slot.end_time))}</div>
        </div>
        <div class="card-actions">
          <button class="action-danger" data-delete-block="${slot.id}">REMOVE BLOCK</button>
        </div>
      </article>
    `)
  ];

  $("#selectedDayList").innerHTML = items.length
    ? items.join("")
    : emptyCard("Nothing scheduled for this date.");

  $("#blockDate").value = date;
  renderCalendar();
}

async function confirmBooking(id) {
  const booking = state.bookings.find(b => b.id === id);
  if (!booking) return;

  const ok = confirm(`Confirm ${clientNameFromBooking(booking)} for ${dateText(booking.preferred_date)} at ${timeText(booking.preferred_time)}?`);
  if (!ok) return;

  const { error } = await sb
    .from("bookings")
    .update({
      status:"confirmed",
      confirmed_at:new Date().toISOString()
    })
    .eq("id",id);

  if (error) {
    alert(error.message);
    return;
  }

  await refreshAll();
}

async function updateBookingStatus(id,status) {
  const values = { status };
  if (status === "confirmed") values.confirmed_at = new Date().toISOString();
  if (status === "completed") values.completed_at = new Date().toISOString();

  const { error } = await sb.from("bookings").update(values).eq("id",id);
  if (error) {
    alert(error.message);
    return;
  }

  closeModals();
  await refreshAll();
}

function openBookingModal(id) {
  const b = state.bookings.find(x => x.id === id);
  if (!b) return;

  $("#modalBookingTitle").textContent = shootName(b);

  $("#bookingModalContent").innerHTML = `
    <div class="modal-detail-grid">
      <div class="modal-detail"><span>CLIENT</span><strong>${escapeHtml(clientNameFromBooking(b))}</strong></div>
      <div class="modal-detail"><span>PHONE</span><strong>${escapeHtml(b.profiles?.phone || "—")}</strong></div>
      <div class="modal-detail"><span>DATE</span><strong>${escapeHtml(dateText(b.preferred_date))}</strong></div>
      <div class="modal-detail"><span>TIME</span><strong>${escapeHtml(timeText(b.preferred_time))}</strong></div>
      <div class="modal-detail"><span>PACKAGE</span><strong>${escapeHtml(packageName(b))}</strong></div>
      <div class="modal-detail"><span>DURATION</span><strong>${b.duration_minutes || 60} min</strong></div>
      <div class="modal-detail"><span>LOCATION</span><strong>${escapeHtml(locationText(b))}</strong></div>
      <div class="modal-detail"><span>STATUS</span><strong>${escapeHtml(titleCase(b.status))}</strong></div>
      <div class="modal-detail"><span>TOTAL</span><strong>${money(b.final_total || b.quoted_subtotal || b.package_price)}</strong></div>
      <div class="modal-detail"><span>PAID</span><strong>${money(b.amount_paid)}</strong></div>
    </div>

    ${b.notes ? `
      <section class="modal-section">
        <h4>Client Notes</h4>
        <p class="card-sub">${escapeHtml(b.notes)}</p>
      </section>
    ` : ""}

    <section class="modal-section">
      <h4>Manage Booking</h4>
      <div class="modal-actions">
        ${b.status === "requested" ? `<button class="gold-button full" data-modal-status="confirmed" data-id="${b.id}">CONFIRM BOOKING</button>` : ""}
        ${b.status === "booked" ? `<button class="gold-button full" data-modal-status="completed" data-id="${b.id}">MARK COMPLETED</button>` : ""}
        ${["requested","confirmed"].includes(b.status) ? `<button class="soft-button full" data-modal-status="declined" data-id="${b.id}">DECLINE</button>` : ""}
        ${!["completed","cancelled","declined"].includes(b.status) ? `<button class="action-danger" data-modal-status="cancelled" data-id="${b.id}">CANCEL BOOKING</button>` : ""}
      </div>
    </section>
  `;

  openModal("#bookingModal");
}

async function getSignedProofUrl(path) {
  if (!path) return null;

  const { data, error } = await sb.storage
    .from("payment-proofs")
    .createSignedUrl(path, 600);

  if (error) throw error;
  return data.signedUrl;
}

async function openPaymentModal(id) {
  const p = state.payments.find(x => x.id === id);
  if (!p) return;

  const b = p.bookings || {};
  $("#modalPaymentTitle").textContent = b.profiles?.full_name || "Client";

  let proofHtml = `<div class="pdf-proof">No proof file available.</div>`;

  if (p.proof_url) {
    try {
      const url = await getSignedProofUrl(p.proof_url);
      const isPdf = /\.pdf($|\?)/i.test(p.proof_url);

      proofHtml = isPdf
        ? `<a class="pdf-proof" href="${escapeHtml(url)}" target="_blank" rel="noopener">OPEN PAYMENT PROOF PDF ↗</a>`
        : `<a href="${escapeHtml(url)}" target="_blank" rel="noopener"><img class="proof-preview" src="${escapeHtml(url)}" alt="Payment proof"></a>`;
    } catch (error) {
      proofHtml = `<div class="pdf-proof">Could not load proof: ${escapeHtml(error.message)}</div>`;
    }
  }

  $("#paymentModalContent").innerHTML = `
    <div class="modal-detail-grid">
      <div class="modal-detail"><span>SHOOT</span><strong>${escapeHtml(b.shoot_types?.name || "Photography Session")}</strong></div>
      <div class="modal-detail"><span>DATE</span><strong>${escapeHtml(dateText(b.preferred_date))}</strong></div>
      <div class="modal-detail"><span>PAYMENT TYPE</span><strong>${escapeHtml(titleCase(p.payment_type))}</strong></div>
      <div class="modal-detail"><span>AMOUNT</span><strong>${money(p.amount)}</strong></div>
    </div>

    <section class="modal-section">
      <h4>Payment Proof</h4>
      ${proofHtml}
    </section>

    ${p.status === "submitted" ? `
      <section class="modal-section">
        <h4>Review</h4>
        <textarea id="paymentAdminNote" class="note-input" placeholder="Optional note if rejecting"></textarea>
        <div class="modal-actions">
          <button class="gold-button full" data-review-payment="accepted" data-id="${p.id}">ACCEPT PAYMENT</button>
          <button class="action-danger" data-review-payment="rejected" data-id="${p.id}">REJECT PROOF</button>
        </div>
      </section>
    ` : `
      <section class="modal-section">
        <h4>${escapeHtml(titleCase(p.status))}</h4>
        <p class="card-sub">${escapeHtml(p.admin_note || "This payment has already been reviewed.")}</p>
      </section>
    `}
  `;

  openModal("#paymentModal");
}

async function reviewPayment(id,status) {
  const note = $("#paymentAdminNote")?.value?.trim() || null;

  const { error } = await sb
    .from("payments")
    .update({
      status,
      admin_note: note
    })
    .eq("id",id);

  if (error) {
    alert(error.message);
    return;
  }

  closeModals();
  await refreshAll();
}

async function blockSlot(event) {
  event.preventDefault();

  const date = $("#blockDate").value;
  const start = $("#blockStart").value;
  const end = $("#blockEnd").value;
  const reason = $("#blockReason").value.trim() || null;
  const message = $("#blockMessage");

  if (!date || !start || !end) return;

  message.textContent = "Saving…";
  message.className = "form-message";

  const { error } = await sb.from("blocked_slots").insert({
    block_date:date,
    start_time:start,
    end_time:end,
    reason
  });

  if (error) {
    message.textContent = error.message;
    message.className = "form-message error";
    return;
  }

  message.textContent = "Time blocked.";
  message.className = "form-message success";
  $("#blockStart").value = "";
  $("#blockEnd").value = "";
  $("#blockReason").value = "";

  await loadBlockedSlots();
  renderSelectedDay(date);
}

async function deleteBlock(id) {
  if (!confirm("Remove this blocked time?")) return;

  const { error } = await sb.from("blocked_slots").delete().eq("id",id);
  if (error) {
    alert(error.message);
    return;
  }

  await loadBlockedSlots();
  renderSelectedDay(state.selectedDate);
}

function openModal(selector) {
  $("#modalBackdrop").classList.remove("hidden");
  $(selector).classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModals() {
  $("#modalBackdrop").classList.add("hidden");
  $("#bookingModal").classList.add("hidden");
  $("#paymentModal").classList.add("hidden");
  document.body.style.overflow = "";
}

function goTo(viewName) {
  $$(".view").forEach(v => v.classList.toggle("active",v.dataset.view === viewName));
  $$(".nav-item").forEach(b => b.classList.toggle("active",b.dataset.nav === viewName));
  window.scrollTo({top:0,behavior:"smooth"});
}

function bindEvents() {
  $("#loginForm").addEventListener("submit", async event => {
    event.preventDefault();

    const message = $("#loginMessage");
    message.textContent = "Signing in…";
    message.className = "form-message";

    try {
      await signIn($("#loginEmail").value.trim(), $("#loginPassword").value);
      message.textContent = "";
    } catch (error) {
      message.textContent = error.message;
      message.className = "form-message error";
    }
  });

  $("#signOutButton").addEventListener("click", async () => {
    await sb.auth.signOut();
    state.user = null;
    state.profile = null;
    showLogin();
  });

  $$(".nav-item").forEach(button => {
    button.addEventListener("click",() => goTo(button.dataset.nav));
  });

  $$("[data-go]").forEach(button => {
    button.addEventListener("click",() => goTo(button.dataset.go));
  });

  $$("[data-booking-filter]").forEach(button => {
    button.addEventListener("click",() => {
      state.bookingFilter = button.dataset.bookingFilter;
      $$("[data-booking-filter]").forEach(b => b.classList.toggle("active",b === button));
      renderBookings();
    });
  });

  $$("[data-payment-filter]").forEach(button => {
    button.addEventListener("click",() => {
      state.paymentFilter = button.dataset.paymentFilter;
      $$("[data-payment-filter]").forEach(b => b.classList.toggle("active",b === button));
      renderPayments();
    });
  });

  $("#refreshBookings").addEventListener("click",async () => {
    await loadBookings();
    renderBookings();
    renderDashboard();
  });

  $("#refreshPayments").addEventListener("click",async () => {
    await loadPayments();
    renderPayments();
    renderDashboard();
  });

  $("#clientSearch").addEventListener("input",event => renderClients(event.target.value));

  $("#prevMonth").addEventListener("click",() => {
    state.calendarCursor = new Date(
      state.calendarCursor.getFullYear(),
      state.calendarCursor.getMonth()-1,
      1
    );
    renderCalendar();
  });

  $("#nextMonth").addEventListener("click",() => {
    state.calendarCursor = new Date(
      state.calendarCursor.getFullYear(),
      state.calendarCursor.getMonth()+1,
      1
    );
    renderCalendar();
  });

  $("#blockSlotForm").addEventListener("submit",blockSlot);

  document.addEventListener("click",async event => {
    const bookingOpen = event.target.closest("[data-open-booking]");
    if (bookingOpen) return openBookingModal(bookingOpen.dataset.openBooking);

    const bookingConfirm = event.target.closest("[data-confirm-booking]");
    if (bookingConfirm) return confirmBooking(bookingConfirm.dataset.confirmBooking);

    const paymentOpen = event.target.closest("[data-open-payment]");
    if (paymentOpen) return openPaymentModal(paymentOpen.dataset.openPayment);

    const paymentAccept = event.target.closest("[data-accept-payment]");
    if (paymentAccept) return reviewPayment(paymentAccept.dataset.acceptPayment,"accepted");

    const calendarDate = event.target.closest("[data-calendar-date]");
    if (calendarDate) return renderSelectedDay(calendarDate.dataset.calendarDate);

    const deleteBlockButton = event.target.closest("[data-delete-block]");
    if (deleteBlockButton) return deleteBlock(deleteBlockButton.dataset.deleteBlock);

    const bookingStatus = event.target.closest("[data-modal-status]");
    if (bookingStatus) {
      const status = bookingStatus.dataset.modalStatus;
      const id = bookingStatus.dataset.id;
      const labels = {
        confirmed:"Confirm this booking?",
        completed:"Mark this shoot completed?",
        declined:"Decline this booking request?",
        cancelled:"Cancel this booking?"
      };
      if (confirm(labels[status] || "Update this booking?")) {
        return updateBookingStatus(id,status);
      }
    }

    const paymentReview = event.target.closest("[data-review-payment]");
    if (paymentReview) {
      const status = paymentReview.dataset.reviewPayment;
      const question = status === "accepted"
        ? "Accept this payment proof?"
        : "Reject this payment proof?";
      if (confirm(question)) {
        return reviewPayment(paymentReview.dataset.id,status);
      }
    }

    if (event.target.matches("[data-close-modal]") || event.target === $("#modalBackdrop")) {
      closeModals();
    }
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load",() => {
    navigator.serviceWorker.register("sw.js").catch(console.warn);
  });
}

bindEvents();
restoreSession();
