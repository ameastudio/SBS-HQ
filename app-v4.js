const SUPABASE_URL = "https://soqpxkdbsddatrouudke.supabase.co";
const SUPABASE_KEY = "sb_publishable_O4w_43CQJJXL5sedjwUdeA_J6WbOmO3";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const state = {
  user:null,
  profile:null,
  profiles:[],
  manualClients:[],
  bookings:[],
  payments:[],
  invoices:[],
  shootTypes:[],
  packages:[],
  adjustments:[],
  inspirations:[],
  blockedSlots:[],
  portfolio:[],
  reviews:[],
  siteContent:{},
  bookingFilter:"all",
  paymentFilter:"submitted",
  calendarCursor:new Date(),
  selectedDate:null,
  editingBookingId:null,
  editingShootTypeId:null,
  editingPackageId:null
};

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

function escapeHtml(v=""){
  return String(v)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function money(v){return `J$${Number(v||0).toLocaleString("en-JM",{maximumFractionDigits:2})}`}
function titleCase(v=""){return String(v).replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase())}
function dateText(v){if(!v)return"—";return new Date(`${v}T12:00:00`).toLocaleDateString("en-JM",{month:"short",day:"numeric",year:"numeric"})}
function shortDate(v){if(!v)return"—";return new Date(`${v}T12:00:00`).toLocaleDateString("en-JM",{month:"short",day:"numeric"})}
function timeText(v){if(!v)return"—";const [h,m]=String(v).split(":").map(Number);const d=new Date();d.setHours(h||0,m||0,0,0);return d.toLocaleTimeString("en-JM",{hour:"numeric",minute:"2-digit"})}
function isoToday(){const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function emptyCard(t){return `<div class="empty-card">${escapeHtml(t)}</div>`}
function statusChip(s){return `<span class="status-chip ${escapeHtml(s)}">${escapeHtml(titleCase(s))}</span>`}
function greeting(){const h=new Date().getHours();if(h>=5&&h<12)return"Good morning";if(h<17)return"Good afternoon";if(h<21)return"Good evening";return"Good night"}
function getType(id){return state.shootTypes.find(x=>x.id===id)||null}
function getPackage(id){return state.packages.find(x=>x.id===id)||null}
function getProfile(id){return state.profiles.find(x=>x.id===id)||null}
function getManualClient(id){return state.manualClients.find(x=>x.id===id)||null}
function getClientForBooking(b){
  if(b.client_id){
    const p=getProfile(b.client_id);
    return p?{id:p.id,full_name:p.full_name||"Client",email:p.email||"",phone:p.phone||"",instagram_handle:p.instagram_handle||"",kind:"account"}:null;
  }
  if(b.manual_client_id){
    const m=getManualClient(b.manual_client_id);
    return m?{...m,kind:"manual"}:null;
  }
  return null;
}
function clientName(b){return getClientForBooking(b)?.full_name||"Client"}
function shootName(b){return getType(b.shoot_type_id)?.name||b.custom_shoot_name||"Photography Session"}
function locationText(b){return b.location_type==="On Location"&&b.location_text?b.location_text:(b.location_type||"—")}
function bookingTotal(b){return Number(b.final_total||b.quoted_subtotal||b.package_price||0)}
function bookingBalance(b){return Math.max(0,bookingTotal(b)-Number(b.amount_paid||0))}
function bookingAdjustments(id){return state.adjustments.filter(x=>x.booking_id===id)}
function bookingInspiration(id){return state.inspirations.filter(x=>x.booking_id===id).sort((a,b)=>a.sort_order-b.sort_order)}

function showLogin(message=""){
  $("#appView").classList.add("hidden");
  $("#loginView").classList.remove("hidden");
  $("#loginMessage").textContent=message;
}
function showApp(){
  $("#loginView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  $("#heroGreeting").innerHTML=`${greeting()}, <span>Spaceboi.</span>`;
  $("#todayLabel").textContent=new Date().toLocaleDateString("en-JM",{weekday:"long",month:"long",day:"numeric"});
}
async function verifyAdmin(user){
  const {data,error}=await sb.from("profiles").select("id,full_name,email,role").eq("id",user.id).maybeSingle();
  if(error)throw error;
  if(!data||data.role!=="admin"){await sb.auth.signOut();throw new Error("This account does not have admin access.")}
  return data;
}
async function signIn(email,password){
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error)throw error;
  state.user=data.user;
  state.profile=await verifyAdmin(data.user);
  showApp();
  await refreshAll();
}
async function restoreSession(){
  const {data}=await sb.auth.getSession();
  const user=data.session?.user;
  if(!user)return showLogin();
  try{
    state.user=user;
    state.profile=await verifyAdmin(user);
    showApp();
    await refreshAll();
  }catch(error){showLogin(error.message)}
}

/* ---------- data ---------- */
async function q(table,select="*",opts={}){
  let query=sb.from(table).select(select);
  if(opts.order)query=query.order(opts.order,{ascending:opts.ascending??true});
  const {data,error}=await query;
  if(error)throw error;
  return data||[];
}
async function refreshAll(){
  try{
    const [
      profiles,manualClients,shootTypes,packages,bookings,payments,invoices,
      adjustments,inspirations,blockedSlots,portfolio,reviews,siteRows
    ]=await Promise.all([
      q("profiles","id,full_name,email,phone,instagram_handle,role,created_at",{order:"created_at",ascending:false}),
      q("manual_clients","*",{order:"created_at",ascending:false}),
      q("shoot_types","*",{order:"sort_order"}),
      q("shoot_packages","*",{order:"sort_order"}),
      q("bookings","*",{order:"created_at",ascending:false}),
      q("payments","*",{order:"created_at",ascending:false}),
      q("invoices","*",{order:"created_at",ascending:false}),
      q("booking_adjustments","*",{order:"created_at"}),
      q("booking_inspiration","*",{order:"sort_order"}),
      q("blocked_slots","*",{order:"block_date"}),
      q("portfolio_items","*",{order:"sort_order"}),
      q("reviews","*",{order:"created_at",ascending:false}),
      q("site_content","key,value")
    ]);
    Object.assign(state,{profiles,manualClients,shootTypes,packages,bookings,payments,invoices,adjustments,inspirations,blockedSlots,portfolio,reviews});
    state.siteContent=Object.fromEntries(siteRows.map(r=>[r.key,r.value||{}]));
    renderAll();
  }catch(error){
    console.error(error);
    alert(`SBS HQ could not load studio data: ${error.message}`);
  }
}
function renderAll(){
  renderDashboard();renderBookings();renderPayments();renderClients();renderCalendar();
  renderShootTypes();renderPortfolio();renderReviews();renderContentForm();renderAnalytics();renderInvoices();renderSettings();
}

/* ---------- dashboard/bookings ---------- */
function bookingCard(b,compact=false){
  return `<article class="booking-card">
    <div class="card-top">
      <div>${statusChip(b.status)}<h4>${escapeHtml(shootName(b))}</h4><p class="card-sub">${escapeHtml(clientName(b))} • ${escapeHtml(b.package_name||"Package not set")}</p></div>
      <div class="card-date">${escapeHtml(shortDate(b.preferred_date))}<br>${escapeHtml(timeText(b.preferred_time))}</div>
    </div>
    ${compact?"":`<div class="card-meta">
      <div><span>LOCATION</span><strong>${escapeHtml(locationText(b))}</strong></div>
      <div><span>TOTAL</span><strong>${money(bookingTotal(b))}</strong></div>
      <div><span>PAID</span><strong>${money(b.amount_paid)}</strong></div>
      <div><span>BALANCE</span><strong>${money(bookingBalance(b))}</strong></div>
    </div>`}
    <div class="card-actions">
      <button class="action-secondary" data-open-booking="${b.id}">VIEW / EDIT</button>
      ${b.status==="requested"?`<button class="action-primary" data-quick-confirm="${b.id}">CONFIRM</button>`:""}
    </div>
  </article>`;
}
function renderDashboard(){
  const today=isoToday();
  const requests=state.bookings.filter(b=>b.status==="requested");
  const upcoming=state.bookings.filter(b=>["confirmed","booked"].includes(b.status)&&b.preferred_date>=today)
    .sort((a,b)=>`${a.preferred_date}T${a.preferred_time}`.localeCompare(`${b.preferred_date}T${b.preferred_time}`));
  const review=state.payments.filter(p=>p.status==="submitted");
  const now=new Date();
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1);
  const revenue=state.payments.filter(p=>p.status==="accepted"&&new Date(p.reviewed_at||p.created_at)>=monthStart).reduce((s,p)=>s+Number(p.amount||0),0);
  $("#metricRequests").textContent=requests.length;
  $("#metricUpcoming").textContent=upcoming.length;
  $("#metricPayments").textContent=review.length;
  $("#metricRevenue").textContent=money(revenue);
  $("#homeRequests").innerHTML=requests.length?requests.slice(0,3).map(b=>bookingCard(b,true)).join(""):emptyCard("No new booking requests.");
  $("#homePayments").innerHTML=review.length?review.slice(0,3).map(p=>paymentCard(p,true)).join(""):emptyCard("No payment proofs waiting.");
  $("#homeUpcoming").innerHTML=upcoming.length?upcoming.slice(0,4).map(b=>bookingCard(b,true)).join(""):emptyCard("No upcoming shoots yet.");
}
function renderBookings(){
  const rows=state.bookingFilter==="all"?state.bookings:state.bookings.filter(b=>b.status===state.bookingFilter);
  $("#bookingsList").innerHTML=rows.length?rows.map(b=>bookingCard(b)).join(""):emptyCard("No bookings here.");
}
async function quickConfirm(id){
  if(!confirm("Confirm this booking?"))return;
  const {error}=await sb.from("bookings").update({status:"confirmed",confirmed_at:new Date().toISOString()}).eq("id",id);
  if(error)return alert(error.message);
  await refreshAll();
}

/* ---------- booking modal ---------- */
async function signedUrl(bucket,path){
  const {data,error}=await sb.storage.from(bucket).createSignedUrl(path,900);
  if(error)throw error;
  return data.signedUrl;
}
async function renderInspirationHtml(b){
  const rows=bookingInspiration(b.id);
  if(!rows.length)return `<p class="info-note">No inspiration photos uploaded.</p>`;
  const html=[];
  for(const row of rows){
    try{
      const url=await signedUrl("booking-inspiration",row.image_url);
      html.push(`<a href="${escapeHtml(url)}" target="_blank" rel="noopener"><img src="${escapeHtml(url)}" alt="Inspiration"></a>`);
    }catch{}
  }
  return html.length?`<div class="image-strip">${html.join("")}</div>`:`<p class="info-note">Inspiration photos could not be loaded.</p>`;
}
function packageOptionsForType(typeId,currentName=""){
  const rows=state.packages.filter(p=>p.shoot_type_id===typeId&&p.active);
  return `<option value="">Keep current / custom</option>`+rows.map(p=>`<option value="${p.id}" ${p.name===currentName?"selected":""}>${escapeHtml(p.name)} — ${escapeHtml(p.price_label||money(p.price))}</option>`).join("");
}
async function openBookingModal(id){
  const b=state.bookings.find(x=>x.id===id);if(!b)return;
  state.editingBookingId=id;
  const c=getClientForBooking(b);
  const inspiration=await renderInspirationHtml(b);
  const extras=bookingAdjustments(id);
  $("#bookingModalTitle").textContent=shootName(b);
  const clientRequest = b.client_request_type ? `
    <section class="modal-section request-alert">
      <h4>Client Request</h4>
      <p class="card-sub">${
        b.client_request_type === "reschedule"
          ? `Reschedule requested for ${escapeHtml(dateText(b.client_requested_date))} at ${escapeHtml(timeText(b.client_requested_time))}.`
          : "Client requested cancellation."
      }</p>
      ${b.client_request_note ? `<p class="card-sub">${escapeHtml(b.client_request_note)}</p>` : ""}
      <div class="card-actions">
        <button class="action-secondary" data-clear-client-request="${b.id}">CLEAR REQUEST</button>
      </div>
    </section>
  ` : "";

  $("#bookingModalContent").innerHTML=`
    ${clientRequest}
    <div class="modal-detail-grid">
      <div class="modal-detail"><span>CLIENT</span><strong>${escapeHtml(c?.full_name||"Client")}</strong></div>
      <div class="modal-detail"><span>EMAIL</span><strong>${escapeHtml(c?.email||"—")}</strong></div>
      <div class="modal-detail"><span>PHONE</span><strong>${escapeHtml(c?.phone||"—")}</strong></div>
      <div class="modal-detail"><span>INSTAGRAM</span><strong>${escapeHtml(c?.instagram_handle||b.instagram_handle||"—")}</strong></div>
      <div class="modal-detail"><span>SOURCE</span><strong>${escapeHtml(titleCase(b.source||"website"))}</strong></div>
      <div class="modal-detail"><span>RESCHEDULES</span><strong>${Number(b.reschedule_count||0)}</strong></div>
    </div>

    <section class="modal-section"><h4>Inspiration</h4>${inspiration}</section>

    <section class="modal-section">
      <h4>Schedule & Booking</h4>
      <form id="bookingEditForm" class="panel-form">
        <div class="form-grid two">
          <label>Status<select id="editStatus" class="status-select">
            ${["requested","confirmed","booked","completed","cancelled","declined"].map(s=>`<option value="${s}" ${b.status===s?"selected":""}>${titleCase(s)}</option>`).join("")}
          </select></label>
          <label>Date<input id="editDate" type="date" value="${b.preferred_date||""}" required></label>
          <label>Time<input id="editTime" type="time" value="${String(b.preferred_time||"").slice(0,5)}" required></label>
          <label>Duration (minutes)<input id="editDuration" type="number" min="1" value="${b.duration_minutes||60}" required></label>
          <label>Location<select id="editLocationType"><option ${b.location_type==="Studio"?"selected":""}>Studio</option><option ${b.location_type==="On Location"?"selected":""}>On Location</option></select></label>
          <label>Location details<input id="editLocationText" type="text" value="${escapeHtml(b.location_text||"")}"></label>
        </div>
        <label>Package<select id="editPackageSelect">${packageOptionsForType(b.shoot_type_id,b.package_name)}</select></label>
        <label>Package name<input id="editPackageName" type="text" value="${escapeHtml(b.package_name||"")}"></label>
        <label>Notes<textarea id="editNotes" rows="4">${escapeHtml(b.notes||"")}</textarea></label>
        <button class="gold-button full" type="submit">SAVE BOOKING DETAILS</button>
        <p id="bookingEditMessage" class="form-message"></p>
      </form>
    </section>

    <section class="modal-section">
      <h4>Financials</h4>
      <form id="financialForm" class="panel-form">
        <div class="form-grid two">
          <label>Package/subtotal<input id="finSubtotal" type="number" min="0" step="0.01" value="${Number(b.quoted_subtotal||b.package_price||0)}"></label>
          <label>Travel/location fee<input id="finTravel" type="number" min="0" step="0.01" value="${Number(b.travel_fee||0)}"></label>
          <label>Discount type<select id="finDiscountType"><option value="" ${!b.discount_type?"selected":""}>None</option><option value="fixed" ${b.discount_type==="fixed"?"selected":""}>Fixed amount</option><option value="percent" ${b.discount_type==="percent"?"selected":""}>Percentage</option></select></label>
          <label>Discount value<input id="finDiscountValue" type="number" min="0" step="0.01" value="${Number(b.discount_value||0)}"></label>
          <label>Deposit required<input id="finDeposit" type="number" min="0" step="0.01" value="${Number(b.deposit_required||0)}"></label>
          <label>Amount paid<input id="finPaid" type="number" min="0" step="0.01" value="${Number(b.amount_paid||0)}"></label>
        </div>
        <div class="summary-total"><span>CURRENT TOTAL</span><strong>${money(bookingTotal(b))}</strong></div>
        <button class="gold-button full" type="submit">SAVE FINANCIALS</button>
        <p id="financialMessage" class="form-message"></p>
      </form>
    </section>

    <section class="modal-section">
      <h4>Extra Charges</h4>
      <div class="adjustment-list">
        ${extras.length?extras.map(x=>`<div class="adjustment-row"><span>${escapeHtml(x.label)}</span><strong>${money(x.amount)}</strong><button data-delete-adjustment="${x.id}">REMOVE</button></div>`).join(""):`<p class="info-note">No extra charges.</p>`}
      </div>
      <form id="adjustmentForm" class="panel-form">
        <div class="form-grid two"><label>Charge name<input id="adjustmentLabel" type="text" placeholder="Extra edit / overtime / prop" required></label><label>Amount<input id="adjustmentAmount" type="number" min="0" step="0.01" required></label></div>
        <button class="gold-button full" type="submit">ADD EXTRA CHARGE</button>
      </form>
    </section>

    <section class="modal-section">
      <h4>Photo Delivery</h4>
      <form id="downloadLinkForm" class="panel-form">
        <label>Private download link<input id="downloadUrl" type="url" placeholder="https://..." value="${escapeHtml(b.download_url||"")}"></label>
        <button class="gold-button full" type="submit">SAVE PHOTO LINK</button>
      </form>
    </section>
  `;
  bindBookingModalForms(b);
  openModal("#bookingModal");
}
function bindBookingModalForms(b){
  $("#editPackageSelect")?.addEventListener("change",e=>{
    const p=getPackage(e.target.value);if(!p)return;
    $("#editPackageName").value=p.name;
    $("#editDuration").value=p.duration_minutes||60;
    $("#finSubtotal").value=Number(p.price||0);
  });
  $("#bookingEditForm")?.addEventListener("submit",async e=>{
    e.preventDefault();
    const newDate=$("#editDate").value,newTime=$("#editTime").value;
    const rescheduled=(newDate!==b.preferred_date||newTime!==String(b.preferred_time||"").slice(0,5));
    const status=$("#editStatus").value;
    const patch={
      status,
      preferred_date:newDate,
      preferred_time:newTime,
      duration_minutes:Number($("#editDuration").value||60),
      location_type:$("#editLocationType").value,
      location_text:$("#editLocationText").value.trim()||null,
      package_name:$("#editPackageName").value.trim()||null,
      notes:$("#editNotes").value.trim()||null,
      reschedule_count:Number(b.reschedule_count||0)+(rescheduled?1:0)
    };
    if(status==="confirmed"&&!b.confirmed_at)patch.confirmed_at=new Date().toISOString();
    if(status==="completed"&&!b.completed_at)patch.completed_at=new Date().toISOString();
    const {error}=await sb.from("bookings").update(patch).eq("id",b.id);
    const m=$("#bookingEditMessage");
    if(error){m.textContent=error.message;m.className="form-message error";return}
    m.textContent="Saved.";m.className="form-message success";
    await refreshAll();closeModals();
  });
  $("#financialForm")?.addEventListener("submit",async e=>{
    e.preventDefault();
    const subtotal=Number($("#finSubtotal").value||0),travel=Number($("#finTravel").value||0);
    const extras=bookingAdjustments(b.id).reduce((s,x)=>s+Number(x.amount||0),0);
    const type=$("#finDiscountType").value||null,value=Number($("#finDiscountValue").value||0);
    const pre=subtotal+travel+extras;
    const discount=type==="percent"?Math.min(pre,pre*(value/100)):(type==="fixed"?Math.min(pre,value):0);
    const total=Math.max(0,pre-discount);
    const patch={quoted_subtotal:subtotal,package_price:subtotal,travel_fee:travel,extras_total:extras,discount_type:type,discount_value:value,discount_amount:discount,final_total:total,deposit_required:Number($("#finDeposit").value||0),amount_paid:Number($("#finPaid").value||0)};
    const {error}=await sb.from("bookings").update(patch).eq("id",b.id);
    const m=$("#financialMessage");
    if(error){m.textContent=error.message;m.className="form-message error";return}
    m.textContent="Financials saved.";m.className="form-message success";
    await refreshAll();closeModals();
  });
  $("#adjustmentForm")?.addEventListener("submit",async e=>{
    e.preventDefault();
    const {error}=await sb.from("booking_adjustments").insert({booking_id:b.id,label:$("#adjustmentLabel").value.trim(),amount:Number($("#adjustmentAmount").value||0),kind:"extra"});
    if(error)return alert(error.message);
    await refreshAll();await openBookingModal(b.id);
  });
  $("#downloadLinkForm")?.addEventListener("submit",async e=>{
    e.preventDefault();
    const {error}=await sb.from("bookings").update({download_url:$("#downloadUrl").value.trim()||null}).eq("id",b.id);
    if(error)return alert(error.message);
    await refreshAll();closeModals();
  });
}

/* ---------- manual booking ---------- */
function typeOptions(selected=""){return state.shootTypes.filter(t=>t.active).map(t=>`<option value="${t.id}" ${t.id===selected?"selected":""}>${escapeHtml(t.name)}</option>`).join("")}
function packageOptions(typeId){return state.packages.filter(p=>p.shoot_type_id===typeId&&p.active).map(p=>`<option value="${p.id}">${escapeHtml(p.name)} — ${escapeHtml(p.price_label||money(p.price))}</option>`).join("")}
function openManualBooking(){
  const firstType=state.shootTypes.find(t=>t.active);
  $("#manualBookingForm").innerHTML=`
    <h3>Client</h3>
    <div class="form-grid two">
      <label>Full name<input id="manualName" required></label><label>Email<input id="manualEmail" type="email"></label>
      <label>Phone / WhatsApp<input id="manualPhone"></label><label>Instagram<input id="manualInstagram"></label>
    </div>
    <h3>Shoot</h3>
    <div class="form-grid two">
      <label>Shoot type<select id="manualType">${typeOptions(firstType?.id||"")}</select></label>
      <label>Package<select id="manualPackage">${packageOptions(firstType?.id)}</select></label>
      <label>Date<input id="manualDate" type="date" required></label><label>Time<input id="manualTime" type="time" required></label>
      <label>Duration<input id="manualDuration" type="number" min="1" value="60"></label>
      <label>Status<select id="manualStatus"><option value="confirmed">Confirmed</option><option value="booked">Booked</option><option value="requested">Requested</option></select></label>
      <label>Location<select id="manualLocationType"><option>Studio</option><option>On Location</option></select></label>
      <label>Location details<input id="manualLocationText"></label>
      <label>Price / subtotal<input id="manualSubtotal" type="number" min="0" step=".01" value="0"></label>
      <label>Deposit required<input id="manualDeposit" type="number" min="0" step=".01" value="0"></label>
    </div>
    <label>Notes<textarea id="manualNotes" rows="3"></textarea></label>
    <button class="gold-button full" type="submit">SAVE MANUAL BOOKING</button>
    <p id="manualMessage" class="form-message"></p>`;
  $("#manualType").addEventListener("change",()=>{$("#manualPackage").innerHTML=packageOptions($("#manualType").value);fillManualPackage()});
  $("#manualPackage").addEventListener("change",fillManualPackage);
  fillManualPackage();
  openModal("#manualBookingModal");
}
function fillManualPackage(){
  const p=getPackage($("#manualPackage")?.value);if(!p)return;
  $("#manualDuration").value=p.duration_minutes||60;$("#manualSubtotal").value=Number(p.price||0);
}
async function saveManualBooking(e){
  e.preventDefault();
  const msg=$("#manualMessage");msg.textContent="Saving…";
  const {data:client,error:ce}=await sb.from("manual_clients").insert({
    full_name:$("#manualName").value.trim(),email:$("#manualEmail").value.trim()||null,phone:$("#manualPhone").value.trim()||null,instagram_handle:$("#manualInstagram").value.trim()||null
  }).select().single();
  if(ce){msg.textContent=ce.message;msg.className="form-message error";return}
  const p=getPackage($("#manualPackage").value);
  const subtotal=Number($("#manualSubtotal").value||0);
  const status=$("#manualStatus").value;
  const {error}=await sb.from("bookings").insert({
    client_id:null,manual_client_id:client.id,source:"manual",shoot_type_id:$("#manualType").value||null,
    status,preferred_date:$("#manualDate").value,preferred_time:$("#manualTime").value,duration_minutes:Number($("#manualDuration").value||60),
    package_name:p?.name||null,package_price:subtotal,quoted_subtotal:subtotal,final_total:subtotal,deposit_required:Number($("#manualDeposit").value||0),
    photos_received:p?.photos_received||null,edited_photos:p?.edited_photos||null,
    location_type:$("#manualLocationType").value,location_text:$("#manualLocationText").value.trim()||null,
    notes:$("#manualNotes").value.trim()||null,
    confirmed_at:["confirmed","booked"].includes(status)?new Date().toISOString():null
  });
  if(error){msg.textContent=error.message;msg.className="form-message error";return}
  closeModals();await refreshAll();
}

/* ---------- payments ---------- */
function paymentBooking(p){return state.bookings.find(b=>b.id===p.booking_id)||null}
function paymentCard(p,compact=false){
  const b=paymentBooking(p);return `<article class="payment-card">
    <div class="card-top"><div>${statusChip(p.status)}<h4>${escapeHtml(b?clientName(b):"Client")}</h4><p class="card-sub">${escapeHtml(b?shootName(b):"Photography Session")} • ${escapeHtml(titleCase(p.payment_type))}</p></div><div class="card-date">${escapeHtml(shortDate(b?.preferred_date))}</div></div>
    <div class="amount-line"><span>AMOUNT SUBMITTED</span><strong>${money(p.amount)}</strong></div>
    <div class="card-actions"><button class="action-secondary" data-open-payment="${p.id}">VIEW PROOF</button>${p.status==="submitted"?`<button class="action-primary" data-quick-accept="${p.id}">ACCEPT</button>`:""}</div>
  </article>`;
}
function renderPayments(){
  const rows=state.paymentFilter==="all"?state.payments:state.payments.filter(p=>p.status===state.paymentFilter);
  $("#paymentsList").innerHTML=rows.length?rows.map(p=>paymentCard(p)).join(""):emptyCard("No payments here.");
}
async function openPaymentModal(id){
  const p=state.payments.find(x=>x.id===id);if(!p)return;
  const b=paymentBooking(p);$("#paymentModalTitle").textContent=b?clientName(b):"Client";
  let proof=`<div class="pdf-proof">No proof file.</div>`;
  if(p.proof_url){try{const url=await signedUrl("payment-proofs",p.proof_url);proof=/\.pdf$/i.test(p.proof_url)?`<a class="pdf-proof" href="${url}" target="_blank">OPEN PDF ↗</a>`:`<a href="${url}" target="_blank"><img class="proof-preview" src="${url}" alt="Payment proof"></a>`}catch{}}
  $("#paymentModalContent").innerHTML=`
    <div class="modal-detail-grid">
      <div class="modal-detail"><span>CLIENT</span><strong>${escapeHtml(b?clientName(b):"Client")}</strong></div>
      <div class="modal-detail"><span>SHOOT</span><strong>${escapeHtml(b?shootName(b):"—")}</strong></div>
      <div class="modal-detail"><span>TYPE</span><strong>${escapeHtml(titleCase(p.payment_type))}</strong></div>
      <div class="modal-detail"><span>AMOUNT</span><strong>${money(p.amount)}</strong></div>
    </div>
    <section class="modal-section"><h4>Proof</h4>${proof}</section>
    ${p.status==="submitted"?`<section class="modal-section"><textarea id="paymentAdminNote" class="note-input" placeholder="Optional rejection note"></textarea><div class="modal-actions"><button class="gold-button full" data-review-payment="accepted" data-id="${p.id}">ACCEPT PAYMENT</button><button class="action-danger" data-review-payment="rejected" data-id="${p.id}">REJECT PROOF</button></div></section>`:`<p class="info-note">${escapeHtml(p.admin_note||`Payment ${p.status}.`)}</p>`}`;
  openModal("#paymentModal");
}
async function reviewPayment(id,status){
  const note=$("#paymentAdminNote")?.value.trim()||null;
  const {error}=await sb.from("payments").update({status,admin_note:note}).eq("id",id);
  if(error)return alert(error.message);
  closeModals();await refreshAll();
}

/* ---------- clients ---------- */
function combinedClients(){
  const account=state.profiles.filter(p=>p.role==="client"||state.bookings.some(b=>b.client_id===p.id)).map(p=>({...p,kind:"account"}));
  const manual=state.manualClients.map(m=>({...m,kind:"manual"}));
  return [...account,...manual];
}
function renderClients(search=""){
  const qv=search.toLowerCase().trim();
  const rows=combinedClients().filter(c=>!qv||[c.full_name,c.email,c.phone,c.instagram_handle].some(v=>String(v||"").toLowerCase().includes(qv)));
  $("#clientsList").innerHTML=rows.length?rows.map(c=>{
    const bookings=state.bookings.filter(b=>c.kind==="account"?b.client_id===c.id:b.manual_client_id===c.id);
    return `<article class="client-card"><h4>${escapeHtml(c.full_name||"Client")}</h4>
      <p class="client-contact-line">${escapeHtml(c.email||"No email")}</p><p class="client-contact-line">${escapeHtml(c.phone||"No phone")}${c.instagram_handle?` • ${escapeHtml(c.instagram_handle)}`:""}</p>
      <div class="card-meta"><div><span>BOOKINGS</span><strong>${bookings.length}</strong></div><div><span>COMPLETED</span><strong>${bookings.filter(b=>b.status==="completed").length}</strong></div></div></article>`;
  }).join(""):emptyCard("No clients found.");
}

/* ---------- calendar ---------- */
function renderCalendar(){
  const c=state.calendarCursor,y=c.getFullYear(),m=c.getMonth();
  $("#calendarMonth").textContent=c.toLocaleDateString("en-JM",{month:"long",year:"numeric"});
  const first=new Date(y,m,1),start=new Date(y,m,1-first.getDay()),days=[];
  for(let i=0;i<42;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);
    const iso=[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
    const has=state.bookings.some(b=>b.preferred_date===iso&&!["cancelled","declined"].includes(b.status));
    days.push(`<button class="calendar-day ${d.getMonth()!==m?"outside":""} ${iso===isoToday()?"today":""} ${iso===state.selectedDate?"selected":""} ${has?"has-shoot":""}" data-calendar-date="${iso}">${d.getDate()}</button>`);
  }
  $("#calendarGrid").innerHTML=days.join("");
  if(state.selectedDate)renderSelectedDayList(state.selectedDate);
}
function renderSelectedDayList(date){
  state.selectedDate=date;$("#selectedDayTitle").textContent=dateText(date);$("#blockDate").value=date;
  const bs=state.bookings.filter(b=>b.preferred_date===date&&!["cancelled","declined"].includes(b.status)).sort((a,b)=>String(a.preferred_time).localeCompare(String(b.preferred_time)));
  const blocks=state.blockedSlots.filter(s=>s.block_date===date);
  $("#selectedDayList").innerHTML=[...bs.map(b=>bookingCard(b,true)),...blocks.map(s=>`<article class="day-card"><div class="card-top"><div><span class="status-chip rejected">BLOCKED</span><h4>${escapeHtml(s.reason||"Unavailable")}</h4></div><div class="card-date">${timeText(s.start_time)}<br>to ${timeText(s.end_time)}</div></div><div class="card-actions"><button class="action-danger" data-delete-block="${s.id}">REMOVE BLOCK</button></div></article>`)].join("")||emptyCard("Nothing scheduled.");
}
async function blockSlot(e){
  e.preventDefault();
  const {error}=await sb.from("blocked_slots").insert({block_date:$("#blockDate").value,start_time:$("#blockStart").value,end_time:$("#blockEnd").value,reason:$("#blockReason").value.trim()||null});
  const m=$("#blockMessage");if(error){m.textContent=error.message;m.className="form-message error";return}
  m.textContent="Time blocked.";m.className="form-message success";await refreshAll();renderSelectedDayList($("#blockDate").value);
}
async function deleteBlock(id){if(!confirm("Remove this blocked time?"))return;const {error}=await sb.from("blocked_slots").delete().eq("id",id);if(error)return alert(error.message);await refreshAll()}

/* ---------- shoot types/packages ---------- */
function typeGallery(t){const arr=Array.isArray(t.gallery_images)?t.gallery_images:[];return arr}
function renderShootTypes(){
  $("#shootTypesList").innerHTML=state.shootTypes.length?state.shootTypes.map(t=>{
    const packs=state.packages.filter(p=>p.shoot_type_id===t.id).sort((a,b)=>a.sort_order-b.sort_order);
    const img=typeGallery(t)[0]||t.image_url||"";
    return `<article class="type-card"><div class="type-card-top"><div class="type-thumb">${img?`<img src="${escapeHtml(img)}" alt="">`:""}</div><div><h4>${escapeHtml(t.name)}</h4><p>${escapeHtml(t.description||"")}</p><div class="inline-actions"><button class="action-secondary" data-edit-type="${t.id}">EDIT SHOOT</button><button class="action-primary" data-add-package="${t.id}">+ PACKAGE</button></div></div></div>
      <div class="package-mini-list">${packs.length?packs.map(p=>`<div class="package-mini"><div><strong>${escapeHtml(p.name)}</strong><br><span>${escapeHtml(p.price_label||money(p.price))}</span></div><button data-edit-package="${p.id}">EDIT</button></div>`).join(""):`<p class="info-note">No packages yet.</p>`}</div></article>`;
  }).join(""):emptyCard("No shoot types.");
}
function openShootTypeEditor(id){
  const t=getType(id);if(!t)return;state.editingShootTypeId=id;const imgs=typeGallery(t);
  $("#shootTypeModalTitle").textContent=t.name;
  $("#shootTypeForm").innerHTML=`
    <label>Name<input id="typeName" value="${escapeHtml(t.name)}" required></label>
    <label>Description<textarea id="typeDescription" rows="4">${escapeHtml(t.description||"")}</textarea></label>
    <label class="checkbox-line"><input id="typeActive" type="checkbox" ${t.active?"checked":""}> Active on website</label>
    <label>Upload gallery photos<input id="typeImages" type="file" accept="image/*" multiple></label>
    <div class="image-strip">${imgs.map((u,i)=>`<div><img src="${escapeHtml(u)}" alt=""><button class="action-danger" type="button" data-remove-type-image="${i}">REMOVE</button></div>`).join("")}</div>
    <button class="gold-button full" type="submit">SAVE SHOOT TYPE</button>`;
  openModal("#shootTypeModal");
}
async function uploadPublic(file,folder){
  const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"-"),path=`${folder}/${Date.now()}-${safe}`;
  const {error}=await sb.storage.from("site-media").upload(path,file,{upsert:false});
  if(error)throw error;
  return sb.storage.from("site-media").getPublicUrl(path).data.publicUrl;
}
async function saveShootType(e){
  e.preventDefault();const t=getType(state.editingShootTypeId);if(!t)return;
  let imgs=[...typeGallery(t)];
  const files=Array.from($("#typeImages").files||[]).slice(0,3);
  for(const f of files)imgs.push(await uploadPublic(f,`shoot-types/${t.id}`));
  imgs=imgs.slice(0,3);
  const {error}=await sb.from("shoot_types").update({name:$("#typeName").value.trim(),description:$("#typeDescription").value.trim()||null,active:$("#typeActive").checked,gallery_images:imgs,image_url:imgs[0]||t.image_url||null}).eq("id",t.id);
  if(error)return alert(error.message);closeModals();await refreshAll();
}
function openPackageEditor(id,typeId){
  const p=id?getPackage(id):null;state.editingPackageId=id||null;
  const sid=typeId||p?.shoot_type_id;$("#packageModalTitle").textContent=p?"Edit Package":"Add Package";
  $("#packageForm").innerHTML=`
    <input id="packageTypeId" type="hidden" value="${sid||""}">
    <label>Package name<input id="packageName" value="${escapeHtml(p?.name||"")}" required></label>
    <div class="form-grid two">
      <label>Price amount<input id="packagePrice" type="number" min="0" step=".01" value="${Number(p?.price||0)}"></label>
      <label>Display price<input id="packagePriceLabel" value="${escapeHtml(p?.price_label||"")} " placeholder="J$15,000 / $200 / Custom"></label>
      <label>Duration (minutes)<input id="packageDuration" type="number" min="1" value="${p?.duration_minutes||60}"></label>
      <label>Photos received<input id="packagePhotos" type="number" min="0" value="${p?.photos_received??""}"></label>
      <label>Edited photos<input id="packageEdited" type="number" min="0" value="${p?.edited_photos??""}"></label>
      <label>Sort order<input id="packageSort" type="number" value="${p?.sort_order||0}"></label>
    </div>
    <label class="checkbox-line"><input id="packageActive" type="checkbox" ${p?.active===false?"":"checked"}> Active</label>
    <button class="gold-button full" type="submit">${p?"SAVE PACKAGE":"ADD PACKAGE"}</button>
    ${p?`<button class="action-danger full" type="button" data-delete-package="${p.id}">DELETE PACKAGE</button>`:""}`;
  openModal("#packageModal");
}
async function savePackage(e){
  e.preventDefault();
  const payload={shoot_type_id:$("#packageTypeId").value,name:$("#packageName").value.trim(),price:Number($("#packagePrice").value||0),price_label:$("#packagePriceLabel").value.trim()||null,duration_minutes:Number($("#packageDuration").value||60),photos_received:$("#packagePhotos").value?Number($("#packagePhotos").value):null,edited_photos:$("#packageEdited").value?Number($("#packageEdited").value):null,sort_order:Number($("#packageSort").value||0),active:$("#packageActive").checked};
  const query=state.editingPackageId?sb.from("shoot_packages").update(payload).eq("id",state.editingPackageId):sb.from("shoot_packages").insert(payload);
  const {error}=await query;if(error)return alert(error.message);closeModals();await refreshAll();
}

/* ---------- portfolio/reviews/content ---------- */
function renderPortfolio(){
  $("#portfolioList").innerHTML=state.portfolio.length?state.portfolio.map(x=>`<article class="media-card"><img src="${escapeHtml(x.image_url)}" alt=""><div class="media-card-copy"><h4>${escapeHtml(x.category||"Portfolio")}</h4><p>${escapeHtml(x.caption||"")}</p><div class="inline-actions"><button class="action-secondary" data-toggle-portfolio="${x.id}">${x.published?"HIDE":"PUBLISH"}</button><button class="action-danger" data-delete-portfolio="${x.id}">DELETE</button></div></div></article>`).join(""):emptyCard("No portfolio photos yet.");
}
async function addPortfolio(e){
  e.preventDefault();const m=$("#portfolioMessage");m.textContent="Uploading…";
  try{
    const file=$("#portfolioFile").files[0];const url=await uploadPublic(file,"portfolio");
    const {error}=await sb.from("portfolio_items").insert({image_url:url,caption:$("#portfolioCaption").value.trim()||null,category:$("#portfolioCategory").value.trim()||null,published:true,sort_order:state.portfolio.length});
    if(error)throw error;m.textContent="Added.";m.className="form-message success";e.target.reset();await refreshAll();
  }catch(error){m.textContent=error.message;m.className="form-message error"}
}
function renderReviews(){
  $("#reviewsList").innerHTML=state.reviews.length?state.reviews.map(r=>`<article class="booking-card"><div class="card-top"><div>${statusChip(r.approved?"accepted":"submitted")}<h4>${escapeHtml(r.client_name)}</h4><p class="card-sub">${"★".repeat(r.rating)}${"☆".repeat(5-r.rating)}</p></div><div class="card-date">${shortDate(String(r.created_at).slice(0,10))}</div></div><p class="card-sub">${escapeHtml(r.body)}</p><div class="card-actions"><button class="action-primary" data-toggle-review="${r.id}">${r.approved?"HIDE":"APPROVE"}</button><button class="action-danger" data-delete-review="${r.id}">DELETE</button></div></article>`).join(""):emptyCard("No reviews yet.");
}
function renderContentForm(){
  const hero=state.siteContent.hero||{},about=state.siteContent.about||{},contact=state.siteContent.contact||{};
  $("#aboutHeading").value=about.heading||"";$("#aboutBody").value=about.body||"";
  $("#contentEmail").value=contact.email||"";$("#contentWhatsapp").value=contact.whatsapp||"";$("#contentWhatsappLink").value=contact.whatsapp_link||"";$("#contentLocation").value=contact.location||"";$("#contentInstagram").value=contact.instagram||"";$("#contentTiktok").value=contact.tiktok||"";
  $("#heroCurrent").innerHTML=hero.image_url?`<img src="${escapeHtml(hero.image_url)}" alt="Current hero">`:"";
  $("#aboutCurrent").innerHTML=about.image_url?`<img src="${escapeHtml(about.image_url)}" alt="Current about">`:"";
}
async function upsertContent(key,value){const {error}=await sb.from("site_content").upsert({key,value},{onConflict:"key"});if(error)throw error}
async function saveContent(e){
  e.preventDefault();const m=$("#contentMessage");m.textContent="Saving…";
  try{
    const hero={...(state.siteContent.hero||{})},about={...(state.siteContent.about||{})};
    if($("#heroImageFile").files[0])hero.image_url=await uploadPublic($("#heroImageFile").files[0],"site/hero");
    if($("#aboutImageFile").files[0])about.image_url=await uploadPublic($("#aboutImageFile").files[0],"site/about");
    about.heading=$("#aboutHeading").value.trim();about.body=$("#aboutBody").value.trim();
    const contact={email:$("#contentEmail").value.trim(),whatsapp:$("#contentWhatsapp").value.trim(),whatsapp_link:$("#contentWhatsappLink").value.trim(),location:$("#contentLocation").value.trim(),instagram:$("#contentInstagram").value.trim(),tiktok:$("#contentTiktok").value.trim()};
    await Promise.all([upsertContent("hero",hero),upsertContent("about",about),upsertContent("contact",contact)]);
    m.textContent="Website content saved.";m.className="form-message success";await refreshAll();
  }catch(error){m.textContent=error.message;m.className="form-message error"}
}

/* ---------- analytics/invoices/settings ---------- */
function renderAnalytics(){
  const completed=state.bookings.filter(b=>b.status==="completed");
  const revenue=state.payments.filter(p=>p.status==="accepted").reduce((s,p)=>s+Number(p.amount||0),0);
  const outstanding=state.bookings.filter(b=>!["cancelled","declined"].includes(b.status)).reduce((s,b)=>s+bookingBalance(b),0);
  $("#analyticsBookings").textContent=state.bookings.length;$("#analyticsCompleted").textContent=completed.length;$("#analyticsRevenue").textContent=money(revenue);$("#analyticsOutstanding").textContent=money(outstanding);
  const counts=new Map();for(const b of state.bookings){if(["cancelled","declined"].includes(b.status))continue;const n=shootName(b);counts.set(n,(counts.get(n)||0)+1)}
  const top=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
  $("#analyticsTopShoots").innerHTML=top.length?top.map(([n,c])=>`<div class="analytics-row"><strong>${escapeHtml(n)}</strong><span>${c} booking${c===1?"":"s"}</span></div>`).join(""):emptyCard("No booking data yet.");
  const months=[];
  for(let i=5;i>=0;i--){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i);const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;const total=state.payments.filter(p=>p.status==="accepted"&&String(p.reviewed_at||p.created_at).slice(0,7)===key).reduce((s,p)=>s+Number(p.amount||0),0);months.push([d.toLocaleDateString("en-JM",{month:"long",year:"numeric"}),total])}
  $("#analyticsMonths").innerHTML=months.map(([n,v])=>`<div class="analytics-row"><strong>${escapeHtml(n)}</strong><span>${money(v)}</span></div>`).join("");
}
function renderInvoices(){
  $("#invoicesList").innerHTML=state.invoices.length?state.invoices.map(i=>{
    const b=state.bookings.find(x=>x.id===i.booking_id);
    return `<article class="invoice-card"><span class="invoice-number">${escapeHtml(i.invoice_number)}</span><h4>${escapeHtml(b?clientName(b):"Client")}</h4><p class="card-sub">${escapeHtml(b?shootName(b):"Photography Session")} • ${escapeHtml(titleCase(i.invoice_type))}</p><div class="card-meta"><div><span>TOTAL</span><strong>${money(i.total)}</strong></div><div><span>PAID</span><strong>${money(i.amount_paid)}</strong></div><div><span>BALANCE</span><strong>${money(i.balance)}</strong></div><div><span>STATUS</span><strong>${escapeHtml(i.status)}</strong></div></div></article>`;
  }).join(""):emptyCard("No invoices yet.");
}
function renderSettings(){
  const p=state.siteContent.payment_instructions||{};
  $("#paymentHeading").value=p.heading||"Payment Instructions";$("#paymentBank").value=p.bank_name||"";$("#paymentAccountName").value=p.account_name||"";$("#paymentAccountNumber").value=p.account_number||"";$("#paymentBranch").value=p.branch||"";$("#paymentNote").value=p.note||"";
}
async function saveSettings(e){
  e.preventDefault();const m=$("#settingsMessage");
  try{
    await upsertContent("payment_instructions",{heading:$("#paymentHeading").value.trim(),bank_name:$("#paymentBank").value.trim(),account_name:$("#paymentAccountName").value.trim(),account_number:$("#paymentAccountNumber").value.trim(),branch:$("#paymentBranch").value.trim(),note:$("#paymentNote").value.trim()});
    m.textContent="Payment details saved.";m.className="form-message success";await refreshAll();
  }catch(error){m.textContent=error.message;m.className="form-message error"}
}

/* ---------- navigation/modals ---------- */
function goTo(view){
  $$(".view").forEach(v=>v.classList.toggle("active",v.dataset.view===view));
  $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.nav===view));
  window.scrollTo({top:0,behavior:"smooth"});
}
function openModal(sel){$("#modalBackdrop").classList.remove("hidden");$(sel).classList.remove("hidden");document.body.style.overflow="hidden"}
function closeModals(){$("#modalBackdrop").classList.add("hidden");["#bookingModal","#paymentModal","#manualBookingModal","#shootTypeModal","#packageModal"].forEach(s=>$(s).classList.add("hidden"));document.body.style.overflow=""}

/* ---------- events ---------- */
function bindEvents(){
  $("#loginForm").addEventListener("submit",async e=>{e.preventDefault();const m=$("#loginMessage");m.textContent="Signing in…";try{await signIn($("#loginEmail").value.trim(),$("#loginPassword").value);m.textContent=""}catch(error){m.textContent=error.message;m.className="form-message error"}});
  $("#signOutButton").addEventListener("click",async()=>{await sb.auth.signOut();showLogin()});
  $$(".nav-item").forEach(b=>b.addEventListener("click",()=>goTo(b.dataset.nav)));
  $$("[data-go]").forEach(b=>b.addEventListener("click",()=>goTo(b.dataset.go)));
  $$("[data-booking-filter]").forEach(b=>b.addEventListener("click",()=>{state.bookingFilter=b.dataset.bookingFilter;$$("[data-booking-filter]").forEach(x=>x.classList.toggle("active",x===b));renderBookings()}));
  $$("[data-payment-filter]").forEach(b=>b.addEventListener("click",()=>{state.paymentFilter=b.dataset.paymentFilter;$$("[data-payment-filter]").forEach(x=>x.classList.toggle("active",x===b));renderPayments()}));
  $("#clientSearch").addEventListener("input",e=>renderClients(e.target.value));
  $("#prevMonth").addEventListener("click",()=>{state.calendarCursor=new Date(state.calendarCursor.getFullYear(),state.calendarCursor.getMonth()-1,1);renderCalendar()});
  $("#nextMonth").addEventListener("click",()=>{state.calendarCursor=new Date(state.calendarCursor.getFullYear(),state.calendarCursor.getMonth()+1,1);renderCalendar()});
  $("#blockSlotForm").addEventListener("submit",blockSlot);
  $("#newManualBooking").addEventListener("click",openManualBooking);
  $("#manualBookingForm").addEventListener("submit",saveManualBooking);
  $("#shootTypeForm").addEventListener("submit",saveShootType);
  $("#packageForm").addEventListener("submit",savePackage);
  $("#portfolioForm").addEventListener("submit",addPortfolio);
  $("#contentForm").addEventListener("submit",saveContent);
  $("#paymentSettingsForm").addEventListener("submit",saveSettings);

  document.addEventListener("click",async e=>{
    const t=e.target.closest("[data-open-booking]");if(t)return openBookingModal(t.dataset.openBooking);
    const qc=e.target.closest("[data-quick-confirm]");if(qc)return quickConfirm(qc.dataset.quickConfirm);
    const pp=e.target.closest("[data-open-payment]");if(pp)return openPaymentModal(pp.dataset.openPayment);
    const qa=e.target.closest("[data-quick-accept]");if(qa&&confirm("Accept this payment proof?"))return reviewPayment(qa.dataset.quickAccept,"accepted");
    const rp=e.target.closest("[data-review-payment]");if(rp&&confirm(`${titleCase(rp.dataset.reviewPayment)} this payment?`))return reviewPayment(rp.dataset.id,rp.dataset.reviewPayment);
    const cd=e.target.closest("[data-calendar-date]");if(cd){renderSelectedDayList(cd.dataset.calendarDate);return renderCalendar()}
    const db=e.target.closest("[data-delete-block]");if(db)return deleteBlock(db.dataset.deleteBlock);
    const da=e.target.closest("[data-delete-adjustment]");if(da){if(confirm("Remove this extra charge?")){await sb.from("booking_adjustments").delete().eq("id",da.dataset.deleteAdjustment);await refreshAll();if(state.editingBookingId)await openBookingModal(state.editingBookingId)}return}
    const et=e.target.closest("[data-edit-type]");if(et)return openShootTypeEditor(et.dataset.editType);
    const ap=e.target.closest("[data-add-package]");if(ap)return openPackageEditor(null,ap.dataset.addPackage);
    const ep=e.target.closest("[data-edit-package]");if(ep)return openPackageEditor(ep.dataset.editPackage);
    const dp=e.target.closest("[data-delete-package]");if(dp&&confirm("Delete this package?")){const {error}=await sb.from("shoot_packages").delete().eq("id",dp.dataset.deletePackage);if(error)return alert(error.message);closeModals();return refreshAll()}
    const ri=e.target.closest("[data-remove-type-image]");if(ri){const t=getType(state.editingShootTypeId);if(!t)return;const imgs=typeGallery(t).filter((_,i)=>i!==Number(ri.dataset.removeTypeImage));const {error}=await sb.from("shoot_types").update({gallery_images:imgs,image_url:imgs[0]||null}).eq("id",t.id);if(error)return alert(error.message);closeModals();return refreshAll()}
    const tp=e.target.closest("[data-toggle-portfolio]");if(tp){const item=state.portfolio.find(x=>x.id===tp.dataset.togglePortfolio);await sb.from("portfolio_items").update({published:!item.published}).eq("id",item.id);return refreshAll()}
    const dpo=e.target.closest("[data-delete-portfolio]");if(dpo&&confirm("Delete this portfolio item?")){await sb.from("portfolio_items").delete().eq("id",dpo.dataset.deletePortfolio);return refreshAll()}
    const tr=e.target.closest("[data-toggle-review]");if(tr){const r=state.reviews.find(x=>x.id===tr.dataset.toggleReview);await sb.from("reviews").update({approved:!r.approved}).eq("id",r.id);return refreshAll()}
    const dr=e.target.closest("[data-delete-review]");if(dr&&confirm("Delete this review?")){await sb.from("reviews").delete().eq("id",dr.dataset.deleteReview);return refreshAll()}
    const cr=e.target.closest("[data-clear-client-request]");if(cr){const {error}=await sb.from("bookings").update({client_request_type:null,client_requested_date:null,client_requested_time:null,client_request_note:null,client_request_created_at:null}).eq("id",cr.dataset.clearClientRequest);if(error)return alert(error.message);closeModals();return refreshAll()}
    if(e.target.matches("[data-close-modal]")||e.target===$("#modalBackdrop"))return closeModals();
  });
}

if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw-v4.js").catch(console.warn));
bindEvents();
restoreSession();
