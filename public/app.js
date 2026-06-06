const state = {
  token: localStorage.getItem('eventful_token') || '',
  role: localStorage.getItem('eventful_role') || '',
  userId: localStorage.getItem('eventful_user_id') || '',
};

const els = {
  authChip: document.getElementById('authChip'),
  roleChip: document.getElementById('roleChip'),
  tokenPreview: document.getElementById('tokenPreview'),
  eventsList: document.getElementById('eventsList'),
  myEventsList: document.getElementById('myEventsList'),
  myTicketsList: document.getElementById('myTicketsList'),
  dashboardOutput: document.getElementById('dashboardOutput'),
  toast: document.getElementById('toast'),
};

const apiBase = '';

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2400);
}

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function setSession(token) {
  state.token = token;
  localStorage.setItem('eventful_token', token);
  const decoded = decodeJwt(token);
  state.role = decoded?.role || '';
  state.userId = decoded?.userId || '';
  localStorage.setItem('eventful_role', state.role);
  localStorage.setItem('eventful_user_id', state.userId);
  renderSession();
}

function clearSession() {
  state.token = '';
  state.role = '';
  state.userId = '';
  localStorage.removeItem('eventful_token');
  localStorage.removeItem('eventful_role');
  localStorage.removeItem('eventful_user_id');
  renderSession();
}

function renderSession() {
  els.authChip.textContent = state.token ? `Signed in: ${state.userId || 'unknown'}` : 'Not signed in';
  els.roleChip.textContent = state.role ? state.role : 'No role';
  els.tokenPreview.textContent = state.token ? state.token : 'No token stored';
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (state.token) {
    headers.set('Authorization', `Bearer ${state.token}`);
  }

  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = data?.error || data?.message || response.statusText;
    throw new Error(message);
  }

  return data;
}

function renderCards(container, items, emptyMessage) {
  if (!items.length) {
    container.innerHTML = `<div class="mini-card"><p>${emptyMessage}</p></div>`;
    return;
  }

  container.innerHTML = items
    .map((item) => item)
    .join('');
}

function eventCard(event) {
  const dateText = event.date ? new Date(event.date).toLocaleString() : 'No date';
  return `
    <div class="mini-card">
      <h4>${escapeHtml(event.title || 'Untitled event')}</h4>
      <p>${escapeHtml(event.description || 'No description')}</p>
      <p><strong>Event ID:</strong> ${escapeHtml(event.id)}</p>
      <p><strong>Location:</strong> ${escapeHtml(event.location || 'N/A')}</p>
      <p><strong>Date:</strong> ${escapeHtml(dateText)}</p>
      <p><strong>Price:</strong> NGN ${Number(event.price || 0).toLocaleString()}</p>
      <div class="mini-card-actions">
        <button class="button button-secondary" data-action="buy" data-event-id="${event.id}">Buy</button>
        <button class="button button-secondary" data-action="share" data-event-id="${event.id}">Share</button>
        <button class="button button-secondary" data-action="remind" data-event-id="${event.id}">Reminder</button>
      </div>
    </div>
  `;
}

function myEventCard(event) {
  return `
    <div class="mini-card">
      <h4>${escapeHtml(event.title || 'Untitled event')}</h4>
      <p><strong>ID:</strong> ${escapeHtml(event.id)}</p>
      <p><strong>Tickets:</strong> ${event.availableTickets ?? 'N/A'} available</p>
      <p><strong>Date:</strong> ${escapeHtml(event.date ? new Date(event.date).toLocaleString() : 'N/A')}</p>
    </div>
  `;
}

function myTicketCard(ticket) {
  return `
    <div class="mini-card">
      <h4>${escapeHtml(ticket.event?.title || 'Ticket')}</h4>
      <p><strong>Ticket ID:</strong> ${escapeHtml(ticket.id)}</p>
      <p><strong>Event ID:</strong> ${escapeHtml(ticket.eventId)}</p>
      <p><strong>Status:</strong> ${ticket.isScanned ? 'SCANNED' : 'ACTIVE'}</p>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function loadEvents() {
  const events = await api('/events');
  els.eventsList.innerHTML = events.map(eventCard).join('');
}

async function loadMyEvents() {
  const data = await api('/events/me');
  const events = data.events || [];
  els.myEventsList.innerHTML = events.length
    ? events.map((entry) => myEventCard(entry.event || entry)).join('')
    : '<div class="mini-card"><p>No personal events loaded yet.</p></div>';
}

async function loadMyTickets() {
  const data = await api('/tickets/me');
  const tickets = data.tickets || [];
  els.myTicketsList.innerHTML = tickets.length
    ? tickets.map(myTicketCard).join('')
    : '<div class="mini-card"><p>No tickets found.</p></div>';
}

async function loadCreatorAnalytics() {
  const data = await api('/analytics/creator/me');
  els.dashboardOutput.textContent = pretty(data);
}

async function loadEventAnalytics(eventId) {
  const data = await api(`/analytics/events/${encodeURIComponent(eventId)}`);
  els.dashboardOutput.textContent = pretty(data);
}

async function loadPayments() {
  const data = await api('/payments/creator/me');
  els.dashboardOutput.textContent = pretty(data);
}

document.getElementById('registerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    setSession(data.token);
    showToast('Account created');
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    setSession(data.token);
    showToast('Signed in');
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  clearSession();
  showToast('Session cleared');
});

document.getElementById('refreshEventsBtn').addEventListener('click', async () => {
  try {
    await loadEvents();
    showToast('Events refreshed');
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById('createEventForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = Object.fromEntries(form.entries());
  if (payload.price !== undefined) payload.price = Number(payload.price);
  if (payload.totalCapacity !== undefined) payload.totalCapacity = Number(payload.totalCapacity);
  if (payload.date) payload.date = new Date(payload.date).toISOString();

  try {
    const data = await api('/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    showToast('Event created');
    await loadEvents();
    await loadMyEvents();
    document.getElementById('purchaseEventId').value = data.id;
    document.getElementById('analyticsEventId').value = data.id;
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById('purchaseForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const eventId = form.get('eventId');
  try {
    const data = await api(`/tickets/events/${encodeURIComponent(eventId)}/purchase`, {
      method: 'POST',
      body: '{}',
    });
    showToast('Ticket started');
    els.dashboardOutput.textContent = pretty(data);
    await loadMyTickets();
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById('scanForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = Object.fromEntries(form.entries());
  try {
    const data = await api('/tickets/scan', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    els.dashboardOutput.textContent = pretty(data);
    showToast('Ticket verified');
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById('reminderForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const eventId = form.get('eventId');
  const sendAt = form.get('sendAt');
  const interval = form.get('interval');
  const payload = {};
  if (sendAt) payload.sendAt = new Date(sendAt).toISOString();
  if (interval) payload.interval = interval;

  try {
    const data = await api(`/events/${encodeURIComponent(eventId)}/reminders`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    els.dashboardOutput.textContent = pretty(data);
    showToast('Reminder scheduled');
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById('loadCreatorAnalyticsBtn').addEventListener('click', async () => {
  try {
    await loadCreatorAnalytics();
    showToast('Creator analytics loaded');
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById('loadEventAnalyticsBtn').addEventListener('click', async () => {
  const eventId = document.getElementById('analyticsEventId').value.trim();
  if (!eventId) {
    showToast('Enter an event id first');
    return;
  }
  try {
    await loadEventAnalytics(eventId);
    showToast('Event analytics loaded');
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById('loadPaymentsBtn').addEventListener('click', async () => {
  try {
    await loadPayments();
    showToast('Payments loaded');
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById('loadMyEventsBtn').addEventListener('click', async () => {
  try {
    await loadMyEvents();
    showToast('My events loaded');
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById('loadMyTicketsBtn').addEventListener('click', async () => {
  try {
    await loadMyTickets();
    showToast('My tickets loaded');
  } catch (error) {
    showToast(error.message);
  }
});

els.eventsList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const eventId = button.getAttribute('data-event-id');
  const action = button.getAttribute('data-action');

  if (action === 'buy') {
    document.getElementById('purchaseEventId').value = eventId;
    document.getElementById('purchaseForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (action === 'remind') {
    document.getElementById('reminderForm').querySelector('input[name="eventId"]').value = eventId;
    document.getElementById('reminderForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (action === 'share') {
    try {
      const data = await api(`/events/${encodeURIComponent(eventId)}/share`);
      els.dashboardOutput.textContent = pretty(data);
      if (navigator.share) {
        navigator.share({ title: data.title, text: data.shareText, url: data.shareUrl }).catch(() => {});
      } else {
        await navigator.clipboard.writeText(data.shareUrl);
        showToast('Share link copied');
      }
    } catch (error) {
      showToast(error.message);
    }
  }
});

async function bootstrap() {
  document.body.classList.add('is-ready');
  renderSession();
  try {
    await loadEvents();
  } catch (error) {
    els.eventsList.innerHTML = `<div class="mini-card"><p>${escapeHtml(error.message)}</p></div>`;
  }

  if (state.token) {
    const decoded = decodeJwt(state.token);
    state.role = decoded?.role || '';
    state.userId = decoded?.userId || '';
    renderSession();
  }
}

bootstrap();
