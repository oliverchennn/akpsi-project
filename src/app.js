import {
  initialState,
  net,
  isLow,
  stateLabel,
  updateItem,
  refill,
  preset,
  round,
  clamp,
} from "./inventory.js";
let state = initialState();
let selectedId;
let announcedSequence = 0;
const $ = (selector) => document.querySelector(selector);
const views = {
  main: {
    label: "Overview",
    title: "Inventory overview",
    description: "Four bins. One clear view of what’s left.",
  },
  activity: {
    label: "Activity",
    title: "Store activity",
    description: "Follow low-stock alerts, refills, and changes in this session.",
  },
  requests: {
    label: "Demo requests",
    title: "Demo requests",
    description: "Review simulated restocking requests for your store.",
  },
};
let currentView = "main";

function showView({ focus = false } = {}) {
  const requested = window.location.hash.slice(1);
  currentView = Object.hasOwn(views, requested) ? requested : "main";
  const view = views[currentView];
  const overview = currentView === "main";
  $(".stats").hidden = !overview;
  $(".platform-section").hidden = !overview;
  $("#activity").hidden = currentView === "requests";
  $("#requests").hidden = currentView === "activity";
  $(".lower-grid").classList.toggle("single-panel", !overview);
  $(".breadcrumb strong").textContent = view.label;
  const heading = $(".page-heading h1");
  heading.textContent = view.title;
  $(".page-heading > div > p:last-child").textContent = view.description;
  document.querySelectorAll(".nav-item").forEach((link) => {
    const active = link.getAttribute("href") === `#${currentView}`;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  render();
  if (focus) heading.focus({ preventScroll: true });
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}

document.querySelectorAll(".nav-item, .brand, .skip-link").forEach((link) => {
  link.addEventListener("click", (event) => {
    if (
      event.button !== 0 || event.metaKey || event.ctrlKey ||
      event.shiftKey || event.altKey
    ) return;
    event.preventDefault();
    const hash = link.getAttribute("href");
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
    showView({ focus: true });
  });
});
window.addEventListener("popstate", () => showView({ focus: true }));
window.addEventListener("hashchange", () => showView());
const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmt = (value) => Number(value).toFixed(2);
const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  cart: '<path d="M3 3h2l3 13h11l2-9H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
  leaf: '<path d="M20 3C10 1 3 6 5 15c8 5 17-1 15-12Z"/><path d="m3 21 12-12"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 17h.01"/>',
  reset: '<path d="M3 10a9 9 0 1 1 1 8M3 4v6h6"/>',
  scale:
    '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M8 9a7 7 0 0 1 8 0l-4 5Z"/>',
  box: '<path d="m3 7 9-4 9 4v11l-9 4-9-4Zm0 0 9 4 9-4M12 11v11M8 5l9 4"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  trend: '<path d="m3 16 6-6 4 4 8-9M16 5h5v5"/>',
  refill: '<path d="M5 7a8 8 0 1 1-1 9M3 3v5h5M12 8v8M8 12h8"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6ZM9 12l2 2 4-4"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  settings:
    '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--paper)"/><circle cx="15" cy="17" r="3" fill="var(--paper)"/>',
  coffee:
    '<path d="M18 4C9-1 1 12 6 18c6 7 19-6 12-14Z"/><path d="M16 4c-9 1-2 13-10 14"/>',
  rice: '<path d="M12 21V3M12 10C6 11 4 7 5 4c5 0 7 3 7 6Zm0 6c6 0 8-4 7-7-5 0-7 3-7 7Z"/>',
  oats: '<path d="M12 22V2M12 8C7 8 5 5 5 2c4 0 7 3 7 6Zm0 0c5 0 7-3 7-6-4 0-7 3-7 6Zm0 9c-5 0-7-3-7-6 4 0 7 3 7 6Zm0 0c5 0 7-3 7-6-4 0-7 3-7 6Z"/>',
  sugar: '<path d="m4 7 8-4 8 4v10l-8 4-8-4Zm0 0 8 4 8-4M12 11v10"/>',
  alert: '<path d="m12 3 10 18H2ZM12 9v5M12 17h.01"/>',
};
const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.check}</svg>`;
function hydrateIcons() {
  document.querySelectorAll("[data-icon]").forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
    el.removeAttribute("data-icon");
  });
}
const point = (angle, radius = 86) => {
  const a = (angle * Math.PI) / 180;
  return [110 + Math.cos(a) * radius, 110 + Math.sin(a) * radius];
};
const arc = (end = 405) => {
  const start = point(135);
  const finish = point(end);
  return `M ${start.join(" ")} A 86 86 0 ${end - 135 > 180 ? 1 : 0} 1 ${finish.join(" ")}`;
};
function card(item, index) {
  const ticks = Array.from({ length: 37 }, (_, n) => {
    const a = 135 + n * 7.5;
    const p = point(a, 99),
      q = point(a, n % 3 === 0 ? 105 : 102);
    return `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"/>`;
  }).join("");
  return `<article class="platform" id="card-${item.id}" aria-labelledby="name-${item.id}"><div class="platform-content">
    <div class="card-top"><span class="product-symbol ${item.id}">${icon(item.id)}</span><button class="icon-button settings-button" data-id="${item.id}" aria-label="Configure ${escape(item.name)}">${icon("settings")}</button></div>
    <div class="card-label"><h3 id="name-${item.id}">${escape(item.name)}</h3><span class="platform-id">P0${index + 1}</span></div><p class="category">${item.category}</p><span class="stock-badge"></span>
    <div class="dial-wrap"><svg class="dial" data-id="${item.id}" role="slider" tabindex="0" aria-label="${escape(item.name)} gross weight" aria-valuemin="0" aria-valuemax="${item.capacity + item.tare}" aria-valuenow="${item.gross}" aria-describedby="dial-help" viewBox="0 0 220 214">
      <g class="dial-ticks">${ticks}</g><path d="${arc()}" fill="none" stroke="#e7ede0" stroke-width="8" stroke-linecap="round"/><path class="dial-progress" d="${arc()}" pathLength="100" fill="none" stroke-width="8" stroke-linecap="round"/>
      <text class="dial-text dial-caption" x="110" y="83">NET INVENTORY</text><text class="dial-text dial-main" x="110" y="122"></text><text class="dial-text dial-unit" x="110" y="143">kg remaining</text><text class="dial-text dial-zero" x="39" y="191">0</text><text class="dial-text dial-max" x="184" y="191"></text><circle class="dial-handle" r="8" cx="110" cy="24"/>
    </svg></div>
    <label class="gross-label" for="gross-${item.id}">Gross weight <span>bin + contents</span></label><div class="gross-controls"><button class="weight-step" data-id="${item.id}" data-step="-.1" aria-label="Decrease ${escape(item.name)} gross weight">−</button><input class="gross-input" id="gross-${item.id}" data-id="${item.id}" type="number" min="0" max="${item.capacity + item.tare}" step="0.01" value="${fmt(item.gross)}" inputmode="decimal"><span>kg</span><button class="weight-step" data-id="${item.id}" data-step=".1" aria-label="Increase ${escape(item.name)} gross weight">+</button></div>
    <div class="weight-equation"><span class="tare-display"></span><span class="net-display"></span></div>
    <div class="fill-heading"><span>Bin capacity</span><strong class="fill-percent"></strong></div><div class="fill-track" role="img"><span class="fill-amount"></span><span class="threshold-marker"></span></div>
    <dl class="card-details"><div><dt>Low-stock level</dt><dd class="threshold-display"></dd></div><div><dt>Net capacity</dt><dd class="capacity-display"></dd></div><div><dt>Monthly stock</dt><dd class="monthly-display"></dd></div></dl></div>
    <button class="refill-button" data-id="${item.id}">${icon("refill")}Simulate refill</button></article>`;
}
function buildCards() {
  $("#platforms").innerHTML =
    state.items.map(card).join("") +
    '<span id="dial-help" class="sr-only">Drag around the dial to adjust gross weight. Use arrow keys for 0.1 kilograms, Page Up or Down for 1 kilogram, and Home or End for minimum or maximum.</span>';
  document.querySelectorAll(".dial").forEach((dial) => {
    const id = dial.dataset.id;
    let dragging = false;
    const fromPointer = (event) => {
      const box = dial.getBoundingClientRect();
      const cx = box.left + box.width / 2,
        cy = box.top + box.width / 2;
      let angle =
        (Math.atan2(event.clientY - cy, event.clientX - cx) * 180) / Math.PI;
      if (angle < 0) angle += 360;
      let progress;
      if (angle > 45 && angle < 135) progress = angle < 90 ? 1 : 0;
      else progress = ((angle - 135 + 360) % 360) / 270;
      const item = state.items.find((i) => i.id === id);
      updateItem(state, id, {
        gross: round(progress * (item.capacity + item.tare)),
      });
      render();
    };
    dial.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      dragging = true;
      dial.focus();
      dial.setPointerCapture(event.pointerId);
      fromPointer(event);
    });
    dial.addEventListener("pointermove", (event) => {
      if (dragging) fromPointer(event);
    });
    dial.addEventListener("pointerup", () => {
      dragging = false;
    });
    dial.addEventListener("pointercancel", () => {
      dragging = false;
    });
    dial.addEventListener("lostpointercapture", () => {
      dragging = false;
    });
    dial.addEventListener("keydown", (event) => {
      const item = state.items.find((i) => i.id === id);
      const keys = {
        ArrowRight: 0.1,
        ArrowUp: 0.1,
        ArrowLeft: -0.1,
        ArrowDown: -0.1,
        PageUp: 1,
        PageDown: -1,
      };
      if (event.key in keys || event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const gross =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? item.capacity + item.tare
              : round(item.gross + keys[event.key]);
        updateItem(state, id, { gross });
        render();
      }
    });
  });
}
function render() {
  const low = state.items.filter(isLow).length;
  $("#total-net").innerHTML =
    `${fmt(state.items.reduce((sum, item) => sum + net(item), 0))} <small>kg</small>`;
  $("#healthy-count").innerHTML = `0${4 - low} <small>of 4 bins</small>`;
  $("#low-count").innerHTML = `0${low} <small>low-stock bins</small>`;
  $(".stat.attention").classList.toggle("has-low", low > 0);
  for (const item of state.items) {
    const el = $(`#card-${item.id}`),
      remaining = net(item),
      percent = Math.round((remaining / item.capacity) * 100);
    el.classList.toggle("low", isLow(item));
    el.querySelector("h3").textContent = item.name;
    el.querySelector(".settings-button").setAttribute(
      "aria-label",
      `Configure ${item.name}`,
    );
    el.querySelector(".stock-badge").innerHTML =
      `${icon(isLow(item) ? "alert" : "check")}${stateLabel(item)}`;
    const dial = el.querySelector(".dial"),
      maximum = round(item.capacity + item.tare);
    dial.setAttribute("aria-label", `${item.name} gross weight`);
    dial.setAttribute("aria-valuenow", item.gross);
    dial.setAttribute("aria-valuemax", maximum);
    dial.setAttribute(
      "aria-valuetext",
      `${fmt(item.gross)} kilograms gross; ${fmt(remaining)} kilograms net; ${stateLabel(item)}`,
    );
    const progress = item.gross / maximum;
    el.querySelector(".dial-progress").setAttribute(
      "stroke-dasharray",
      `${progress * 100} 100`,
    );
    el.querySelector(".dial-main").textContent = fmt(remaining);
    el.querySelector(".dial-max").textContent = maximum;
    const pos = point(135 + progress * 270);
    el.querySelector(".dial-handle").setAttribute("cx", pos[0]);
    el.querySelector(".dial-handle").setAttribute("cy", pos[1]);
    const input = el.querySelector(".gross-input");
    input.max = maximum;
    if (document.activeElement !== input) input.value = fmt(item.gross);
    el.querySelectorAll(".weight-step").forEach((button) =>
      button.setAttribute(
        "aria-label",
        `${Number(button.dataset.step) > 0 ? "Increase" : "Decrease"} ${item.name} gross weight`,
      ),
    );
    el.querySelector(".tare-display").innerHTML =
      `− <strong>${fmt(item.tare)} kg</strong> tare`;
    el.querySelector(".net-display").innerHTML =
      `= <strong>${fmt(remaining)} kg</strong> net`;
    el.querySelector(".fill-percent").textContent = `${percent}% full`;
    el.querySelector(".fill-track").setAttribute(
      "aria-label",
      `Bin ${percent}% full. Low-stock threshold ${fmt(item.threshold)} kilograms.`,
    );
    el.querySelector(".fill-amount").style.width = `${percent}%`;
    el.querySelector(".threshold-marker").style.left =
      `${(item.threshold / item.capacity) * 100}%`;
    el.querySelector(".threshold-display").textContent =
      `${fmt(item.threshold)} kg`;
    el.querySelector(".capacity-display").textContent =
      `${fmt(item.capacity)} kg`;
    el.querySelector(".monthly-display").textContent =
      `${fmt(item.monthly)} kg`;
  }
  $("#activity-list").innerHTML =
    state.activity
      .slice(0, currentView === "activity" ? state.activity.length : 5)
      .map(
        (entry) =>
          `<div class="activity-row ${entry.type}" data-type="${entry.type}"><span class="activity-symbol">${icon({ alert: "bell", request: "cart", refill: "refill", settings: "settings", start: "scale" }[entry.type] || "check")}</span><div class="activity-copy"><strong>${escape(entry.title)}</strong><p>${escape(entry.detail)}</p></div><time datetime="${new Date(entry.time).toISOString()}">${new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false }).format(entry.time)}</time></div>`,
      )
      .join("") +
    (state.activity.length === 1
      ? '<p class="activity-empty-note"><strong>Make a little change. See it here.</strong><br>Low-stock crossings, refills, and saved settings appear as you explore.</p>'
      : "");
  $("#request-list").innerHTML = state.requests.length
    ? state.requests
        .slice(0, currentView === "requests" ? state.requests.length : 4)
        .map(
          (request) =>
            `<div class="request-row"><div><strong>${escape(request.name)}</strong><p>DEMO #${String(request.id).padStart(3, "0")} · ${fmt(request.amount)} kg top-up</p></div><span class="request-state ${request.status}">${request.status === "pending" ? "Pending demo" : "Refill simulated"}</span></div>`,
        )
        .join("")
    : `<div class="request-empty">${icon("cart")}<span>No demo requests yet. ${state.autoReorder ? "Try the busy afternoon scenario." : "Switch on to explore."}</span></div>`;
  $("#auto-reorder").checked = state.autoReorder;
  if (state.sequence !== announcedSequence) {
    const newEntries = state.activity.filter(
      (entry) => entry.id > announcedSequence,
    );
    $("#announcement").textContent = newEntries
      .map((entry) => `${entry.title}. ${entry.detail}`)
      .join(" ");
    announcedSequence = state.sequence;
  }
}
$("#platforms").addEventListener("click", (event) => {
  const refillButton = event.target.closest(".refill-button"),
    step = event.target.closest(".weight-step"),
    settings = event.target.closest(".settings-button");
  if (refillButton) {
    refill(state, refillButton.dataset.id);
    render();
  }
  if (step) {
    const item = state.items.find((i) => i.id === step.dataset.id);
    updateItem(state, item.id, {
      gross: round(item.gross + Number(step.dataset.step)),
    });
    render();
  }
  if (settings) {
    selectedId = settings.dataset.id;
    const item = state.items.find((i) => i.id === selectedId);
    const form = $("#settings-form");
    ["name", "tare", "capacity", "threshold", "monthly"].forEach((key) => {
      form.elements[key].value = item[key];
    });
    $("#settings-platform").textContent =
      `PLATFORM 0${state.items.indexOf(item) + 1}`;
    $("#form-error").textContent = "";
    $("#settings-dialog").showModal();
  }
});
$("#platforms").addEventListener("input", (event) => {
  if (
    !event.target.matches(".gross-input") ||
    event.target.value === "" ||
    !Number.isFinite(event.target.valueAsNumber)
  )
    return;
  updateItem(state, event.target.dataset.id, {
    gross: event.target.valueAsNumber,
  });
  render();
});
$("#platforms").addEventListener("focusout", (event) => {
  if (!event.target.matches(".gross-input")) return;
  const item = state.items.find((i) => i.id === event.target.dataset.id);
  event.target.value = fmt(item.gross);
  render();
});
$("#platforms").addEventListener("keydown", (event) => {
  if (event.target.matches(".gross-input") && event.key === "Enter")
    event.target.blur();
});
$("#settings-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const patch = Object.fromEntries(
    [...data].map(([key, value]) => [
      key,
      key === "name" ? value.trim() : Number(value),
    ]),
  );
  if (!patch.name) {
    $("#form-error").textContent = "Enter an item name.";
    return;
  }
  if (patch.threshold > patch.capacity - 0.1) {
    $("#form-error").textContent =
      "Keep the low-stock threshold at least 0.10 kg below capacity so a full refill clears it.";
    return;
  }
  updateItem(state, selectedId, patch, "settings");
  $("#settings-dialog").close();
  render();
});
$("#auto-reorder").addEventListener("change", (event) => {
  state.autoReorder = event.target.checked;
  render();
  $("#announcement").textContent =
    `Simulated auto-reorder ${state.autoReorder ? "enabled for future low-stock crossings" : "disabled"}.`;
});
$("#preset-busy").addEventListener("click", () => {
  preset(state, "busy");
  render();
});
$("#refill-all").addEventListener("click", () => {
  preset(state, "stocked");
  render();
});
$("#reset").addEventListener("click", () => {
  state = initialState();
  announcedSequence = 0;
  buildCards();
  render();
  $("#announcement").textContent =
    "Demo reset. All four bins are healthy. Settings, activity and demo requests have been reset.";
});
$("#help").addEventListener("click", () => $("#help-dialog").showModal());
document
  .querySelectorAll(".close-dialog")
  .forEach((button) =>
    button.addEventListener("click", () => button.closest("dialog").close()),
  );
document.querySelectorAll("dialog").forEach((dialog) =>
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    )
      dialog.close();
  }),
);
hydrateIcons();
buildCards();
showView();
