(function () {
  var script = document.currentScript || (function () {
    var scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  })();

  var merchantId = new URL(script.src).searchParams.get("id");
  if (!merchantId) return;

  var mode = script.getAttribute("data-mode") || "both"; // "banner", "popup", "both"
  var SUPABASE_URL = "https://piuaelsbocjtpdwzykfe.supabase.co";
  var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpdWFlbHNib2NqdHBkd3p5a2ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NjkyMzcsImV4cCI6MjA5MDU0NTIzN30.utJZqywFyX9FUlBcy-pWqlcY6eK_nwgGfiKts1h3nXs";

  function fetchBusiness(id, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", SUPABASE_URL + "/rest/v1/businesses?id=eq." + encodeURIComponent(id) + "&select=id,name,accent_color,primary_color,secondary_color,slug,loyalty_type,max_points_per_card,reward_description&limit=1", true);
    xhr.setRequestHeader("apikey", SUPABASE_KEY);
    xhr.setRequestHeader("Authorization", "Bearer " + SUPABASE_KEY);
    xhr.onload = function () {
      if (xhr.status === 200) {
        var data = JSON.parse(xhr.responseText);
        if (data && data.length > 0) callback(data[0]);
      }
    };
    xhr.send();
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function isValidHexColor(color) {
    return /^#[0-9A-Fa-f]{3,8}$/.test(color);
  }

  function injectStyles(accentColor) {
    var style = document.createElement("style");
    style.textContent = [
      "@keyframes fidelispro-slide-up {",
      "  from { opacity: 0; transform: translateX(-50%) translateY(20px); }",
      "  to { opacity: 1; transform: translateX(-50%) translateY(0); }",
      "}",
      "@keyframes fidelispro-fade-in {",
      "  from { opacity: 0; }",
      "  to { opacity: 1; }",
      "}",
      "@keyframes fidelispro-scale-in {",
      "  from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }",
      "  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }",
      "}",
      "#fidelispro-widget:hover { transform: translateX(-50%) translateY(-2px); transition: transform 0.2s ease; }",
      "#fidelispro-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 100000; animation: fidelispro-fade-in 0.2s ease; }",
      "#fidelispro-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 100001; background: #fff; border-radius: 20px; padding: 28px; max-width: 400px; width: calc(100% - 40px); box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: fidelispro-scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }",
      "#fidelispro-modal input { width: 100%; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 14px; margin-top: 6px; box-sizing: border-box; outline: none; transition: border-color 0.15s; }",
      "#fidelispro-modal input:focus { border-color: " + accentColor + "; box-shadow: 0 0 0 3px " + accentColor + "20; }",
      "#fidelispro-modal label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-top: 14px; }",
      "#fidelispro-modal .fp-btn { width: 100%; padding: 14px; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; color: #fff; cursor: pointer; margin-top: 20px; transition: opacity 0.15s; }",
      "#fidelispro-modal .fp-btn:hover { opacity: 0.9; }",
      "#fidelispro-modal .fp-btn:disabled { opacity: 0.5; cursor: not-allowed; }",
      "#fidelispro-modal .fp-close { position: absolute; top: 14px; right: 14px; background: #f1f5f9; border: none; width: 30px; height: 30px; border-radius: 10px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; color: #64748b; }",
      "#fidelispro-modal .fp-success { text-align: center; padding: 20px 0; }",
      "#fidelispro-modal .fp-success .fp-emoji { font-size: 48px; margin-bottom: 12px; }",
      "#fidelispro-modal .fp-error { color: #ef4444; font-size: 12px; margin-top: 4px; }",
    ].join("\n");
    document.head.appendChild(style);
  }

  function createModal(business) {
    var rawColor = business.accent_color || business.primary_color || "#6B46C1";
    var accentColor = isValidHexColor(rawColor) ? rawColor : "#6B46C1";
    var secondaryColor = isValidHexColor(business.secondary_color) ? business.secondary_color : accentColor;

    injectStyles(accentColor);

    var overlay = document.createElement("div");
    overlay.id = "fidelispro-modal-overlay";
    overlay.addEventListener("click", function () { closeModal(); });

    var modal = document.createElement("div");
    modal.id = "fidelispro-modal";
    modal.addEventListener("click", function (e) { e.stopPropagation(); });

    var closeBtn = document.createElement("button");
    closeBtn.className = "fp-close";
    closeBtn.textContent = "\u2715";
    closeBtn.addEventListener("click", closeModal);
    modal.appendChild(closeBtn);

    // Title
    var title = document.createElement("h2");
    title.style.cssText = "margin:0 0 4px;font-size:22px;font-weight:800;color:#111";
    title.textContent = "Rejoignez " + (business.name || "notre programme");
    modal.appendChild(title);

    var subtitle = document.createElement("p");
    subtitle.style.cssText = "margin:0 0 8px;font-size:13px;color:#6b7280";
    subtitle.textContent = business.reward_description || "Cumulez des points \u00e0 chaque visite !";
    modal.appendChild(subtitle);

    // Form
    var form = document.createElement("form");
    form.addEventListener("submit", function (e) { e.preventDefault(); submitForm(business, form, modal, accentColor, secondaryColor); });

    var fields = [
      { name: "name", label: "Pr\u00e9nom et Nom *", type: "text", placeholder: "Jean Dupont", autocomplete: "name" },
      { name: "email", label: "Email *", type: "email", placeholder: "jean@gmail.com", autocomplete: "email" },
      { name: "phone", label: "T\u00e9l\u00e9phone", type: "tel", placeholder: "06 12 34 56 78", autocomplete: "tel" },
    ];

    fields.forEach(function (f) {
      var label = document.createElement("label");
      label.textContent = f.label;
      label.setAttribute("for", "fp-" + f.name);
      form.appendChild(label);
      var input = document.createElement("input");
      input.id = "fp-" + f.name;
      input.name = f.name;
      input.type = f.type;
      input.placeholder = f.placeholder;
      input.autocomplete = f.autocomplete;
      if (f.name === "name" || f.name === "email") input.required = true;
      form.appendChild(input);
    });

    var btn = document.createElement("button");
    btn.type = "submit";
    btn.className = "fp-btn";
    btn.style.background = "linear-gradient(135deg, " + accentColor + ", " + secondaryColor + ")";
    btn.textContent = "Cr\u00e9er ma carte \uD83C\uDF89";
    form.appendChild(btn);

    modal.appendChild(form);
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
  }

  function closeModal() {
    var overlay = document.getElementById("fidelispro-modal-overlay");
    var modal = document.getElementById("fidelispro-modal");
    if (overlay) overlay.remove();
    if (modal) modal.remove();
  }

  function submitForm(business, form, modal, accentColor, secondaryColor) {
    var nameVal = form.querySelector('[name="name"]').value.trim();
    var emailVal = form.querySelector('[name="email"]').value.trim();
    var phoneVal = form.querySelector('[name="phone"]').value.trim();
    var btn = form.querySelector(".fp-btn");

    // Remove old errors
    var oldErrors = form.querySelectorAll(".fp-error");
    for (var i = 0; i < oldErrors.length; i++) oldErrors[i].remove();

    if (!nameVal || nameVal.length < 2) {
      var err = document.createElement("p");
      err.className = "fp-error";
      err.textContent = "Entrez votre nom (min. 2 caract\u00e8res)";
      form.querySelector('[name="name"]').after(err);
      return;
    }
    if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      var err2 = document.createElement("p");
      err2.className = "fp-error";
      err2.textContent = "Adresse email invalide";
      form.querySelector('[name="email"]').after(err2);
      return;
    }

    btn.disabled = true;
    btn.textContent = "Cr\u00e9ation...";

    var headers = {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
    };

    // Check existing
    fetch(SUPABASE_URL + "/rest/v1/customers?business_id=eq." + business.id + "&email=eq." + encodeURIComponent(emailVal) + "&select=id,full_name,customer_cards(card_code)", {
      headers: headers,
    }).then(function (r) { return r.json(); }).then(function (existing) {
      if (existing && existing.length > 0) {
        var cardCode = existing[0].customer_cards && existing[0].customer_cards[0] ? existing[0].customer_cards[0].card_code : null;
        showSuccess(modal, business, cardCode, accentColor, secondaryColor, true);
        return;
      }

      var customerId = crypto.randomUUID();
      // Create customer
      fetch(SUPABASE_URL + "/rest/v1/customers", {
        method: "POST",
        headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
        body: JSON.stringify({
          id: customerId,
          business_id: business.id,
          full_name: nameVal,
          email: emailVal,
          phone: phoneVal || null,
          registration_source: "widget",
        }),
      }).then(function (r) {
        if (!r.ok) throw new Error("Customer creation failed");
        // Create card
        return fetch(SUPABASE_URL + "/rest/v1/customer_cards", {
          method: "POST",
          headers: Object.assign({}, headers, { "Prefer": "return=representation" }),
          body: JSON.stringify({
            customer_id: customerId,
            business_id: business.id,
            max_points: business.max_points_per_card || 10,
          }),
        });
      }).then(function (r) { return r.json(); }).then(function (cards) {
        var cardCode = cards && cards[0] ? cards[0].card_code : null;
        showSuccess(modal, business, cardCode, accentColor, secondaryColor, false);

        // Dispatch webhook
        fetch(SUPABASE_URL + "/functions/v1/dispatch-webhook", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SUPABASE_KEY },
          body: JSON.stringify({
            business_id: business.id,
            event_type: "customer.registered",
            payload: { customer_id: customerId, customer_name: nameVal, source: "widget" },
          }),
        }).catch(function () {});
      }).catch(function () {
        btn.disabled = false;
        btn.textContent = "Cr\u00e9er ma carte \uD83C\uDF89";
        var errEl = document.createElement("p");
        errEl.className = "fp-error";
        errEl.textContent = "Erreur lors de l'inscription. R\u00e9essayez.";
        form.appendChild(errEl);
      });
    });
  }

  function showSuccess(modal, business, cardCode, accentColor, secondaryColor) {
    modal.innerHTML = "";
    var closeBtn = document.createElement("button");
    closeBtn.className = "fp-close";
    closeBtn.textContent = "\u2715";
    closeBtn.addEventListener("click", closeModal);
    modal.appendChild(closeBtn);

    var div = document.createElement("div");
    div.className = "fp-success";

    var emoji = document.createElement("div");
    emoji.className = "fp-emoji";
    emoji.textContent = "\uD83C\uDF89";
    div.appendChild(emoji);

    var h2 = document.createElement("h2");
    h2.style.cssText = "margin:0 0 8px;font-size:22px;font-weight:800;color:#111";
    h2.textContent = "Votre carte est pr\u00eate !";
    div.appendChild(h2);

    if (cardCode) {
      var codeP = document.createElement("p");
      codeP.style.cssText = "font-family:monospace;font-size:16px;background:#f1f5f9;padding:10px 16px;border-radius:10px;margin:12px 0;color:#374151";
      codeP.textContent = cardCode;
      div.appendChild(codeP);

      // Wallet button
      var walletBtn = document.createElement("a");
      walletBtn.href = SUPABASE_URL + "/functions/v1/generate-pass?card_code=" + encodeURIComponent(cardCode);
      walletBtn.style.cssText = "display:inline-block;padding:12px 24px;border-radius:12px;color:#fff;font-weight:700;font-size:14px;text-decoration:none;margin-top:8px;background:linear-gradient(135deg," + accentColor + "," + secondaryColor + ")";
      walletBtn.textContent = "Ajouter au Wallet";
      div.appendChild(walletBtn);
    }

    var powered = document.createElement("p");
    powered.style.cssText = "font-size:11px;color:#9ca3af;margin-top:16px";
    powered.textContent = "Propuls\u00e9 par Fid\u00e9liPro";
    div.appendChild(powered);

    modal.appendChild(div);
  }

  function injectBanner(business) {
    var rawColor = business.accent_color || "#F59E0B";
    var accentColor = isValidHexColor(rawColor) ? rawColor : "#F59E0B";
    var safeName = escapeHtml(business.name || "");
    var joinUrl = "https://app.fidelispro.fr/b/" + encodeURIComponent(business.id) + "?source=widget";

    var banner = document.createElement("div");
    banner.id = "fidelispro-widget";
    banner.style.cssText = [
      "position: fixed",
      "bottom: 20px",
      "left: 50%",
      "transform: translateX(-50%)",
      "z-index: 99999",
      "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      "max-width: 420px",
      "width: calc(100% - 40px)",
      "animation: fidelispro-slide-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both",
    ].join(";");

    injectStyles(accentColor);

    // Build DOM safely — no innerHTML with user data
    var container = document.createElement("div");
    container.style.cssText = "background:linear-gradient(135deg," + accentColor + "f0," + accentColor + "cc);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-radius:18px;padding:14px 18px;display:flex;align-items:center;gap:14px;box-shadow:0 8px 32px " + accentColor + "40,0 2px 8px rgba(0,0,0,0.15);border:1px solid " + accentColor + "30";

    // Icon
    var iconWrap = document.createElement("div");
    iconWrap.style.cssText = "width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0";
    iconWrap.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>';
    container.appendChild(iconWrap);

    // Text area
    var textDiv = document.createElement("div");
    textDiv.style.cssText = "flex:1;min-width:0";
    var titleP = document.createElement("p");
    titleP.style.cssText = "margin:0;color:#fff;font-weight:700;font-size:13px;line-height:1.3";
    titleP.textContent = "Rejoignez notre programme de fid\u00e9lit\u00e9 \uD83C\uDF81";
    var subtitleP = document.createElement("p");
    subtitleP.style.cssText = "margin:3px 0 0;color:rgba(255,255,255,0.85);font-size:11px";
    subtitleP.textContent = safeName + " \u2014 Cumulez des points \u00e0 chaque visite";
    textDiv.appendChild(titleP);
    textDiv.appendChild(subtitleP);
    container.appendChild(textDiv);

    // Join button — opens modal in "both" or "popup" mode, else navigates
    var joinLink = document.createElement("a");
    if (mode === "banner") {
      joinLink.href = joinUrl;
      joinLink.target = "_blank";
      joinLink.rel = "noopener";
    } else {
      joinLink.href = "#";
      joinLink.addEventListener("click", function (e) {
        e.preventDefault();
        createModal(business);
      });
    }
    joinLink.style.cssText = "flex-shrink:0;background:rgba(255,255,255,0.95);color:" + accentColor + ";font-weight:700;font-size:12px;padding:8px 14px;border-radius:10px;text-decoration:none;white-space:nowrap;transition:all 0.15s";
    joinLink.textContent = "Rejoindre \u2192";
    container.appendChild(joinLink);

    // Close button
    var closeBtn = document.createElement("button");
    closeBtn.style.cssText = "flex-shrink:0;background:rgba(255,255,255,0.2);border:none;color:#fff;width:26px;height:26px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1";
    closeBtn.textContent = "\u2715";
    closeBtn.addEventListener("click", function() {
      var w = document.getElementById("fidelispro-widget");
      if (w) w.remove();
    });
    container.appendChild(closeBtn);

    banner.appendChild(container);
    document.body.appendChild(banner);
  }

  function init(business) {
    if (mode === "popup") {
      // Only popup, no banner — auto-open after 3s
      injectStyles(business.accent_color || business.primary_color || "#6B46C1");
      setTimeout(function () { createModal(business); }, 3000);
    } else {
      // "banner" or "both" — show banner
      injectBanner(business);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      fetchBusiness(merchantId, init);
    });
  } else {
    fetchBusiness(merchantId, init);
  }
})();
