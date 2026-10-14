(function(){
  "use strict";

  /* ---------- data ---------- */
  var FLOWERS = [
    { id: 1, name: "Garden Rose", price: 18, petals: 8, color: "var(--rose)", tag: "Bestseller", desc: "Full, ruffled blooms in a soft rose hue — the classic bouquet flower, sold by the bunch of six stems.", stock: "24 bunches available", image: "flowers/garden-rose.png", photoAlt: "Isolated photograph of a pale pink garden rose with layered petals" },
    { id: 2, name: "Tulip", price: 12, petals: 6, color: "#C9707A", tag: "Seasonal", desc: "Clean, cup-shaped blooms just opening, prized for their simple, elegant silhouette.", stock: "40 bunches available", image: "flowers/tulip.png", photoAlt: "Isolated photograph of a red tulip with a smooth cup-shaped bloom" },
    { id: 3, name: "Sunflower", price: 9, petals: 14, color: "#D9A441", tag: "Cheerful", desc: "Bold, sun-facing blooms with a deep centre — an instant lift for any room.", stock: "30 bunches available", image: "flowers/sunflower.png", photoAlt: "Isolated photograph of a sunflower with a textured dark center" },
    { id: 4, name: "Peony", price: 22, petals: 10, color: "#E3AEB4", tag: "Limited", desc: "Lush, layered petals with a soft scent — a favourite for spring arrangements.", stock: "12 bunches available", image: "flowers/peony.png", photoAlt: "Isolated photograph of a full pink peony with overlapping petals" },
    { id: 5, name: "Orchid", price: 28, petals: 5, color: "#9C6FA8", tag: "Exotic", desc: "Elegant, long-lasting blooms with a sculptural, architectural form.", stock: "15 pots available", image: "flowers/orchid.png", photoAlt: "Isolated photograph of purple and white orchid blooms" },
    { id: 6, name: "Lily", price: 16, petals: 6, color: "#F2F0E4", tag: "Fragrant", desc: "Trumpet-shaped blooms with a heady scent — striking in tall arrangements.", stock: "20 bunches available", image: "flowers/lily.png", photoAlt: "Isolated photograph of a white Madonna lily with visible stamens" }
  ];
  // Occasion records reference product IDs so FLOWERS remains the single product source of truth.
  var OCCASIONS = [
    { month: 2, day: 14, name: "Valentine's Day", message: "Flowers for someone special.", recommendedFlowerIds: [1, 2, 4] },
    { month: 12, day: 25, name: "Christmas", message: "Bring a little seasonal color to someone’s home.", recommendedFlowerIds: [3, 5, 6] },
    { month: 1, day: 1, name: "New Year's Day", message: "Start the year with something bright and beautiful.", recommendedFlowerIds: [1, 3, 6] }
  ];
  // Seasonal recommendations use Philippine seasons (matching the Ilocos Sur branch): dry season vs rainy season.
  var SEASONS = [
    { id: "dry", name: "Dry Season", months: [11, 12, 1, 2, 3, 4], message: "Sun-loving blooms that thrive in the dry season.", recommendedFlowerIds: [3, 2, 1] },
    { id: "wet", name: "Rainy Season", months: [5, 6, 7, 8, 9, 10], message: "Lush, long-lasting blooms suited to the rainy season.", recommendedFlowerIds: [5, 6, 4] }
  ];
  function currentSeason(date){
    var month = date.getMonth() + 1;
    return SEASONS.filter(function(season){ return season.months.indexOf(month) !== -1; })[0] || SEASONS[0];
  }
  // Weather has no live data source in this front-end build, so the visitor simulates
  // today's weather with the toggle in the recommendations panel instead of calling a real weather API.
  var WEATHER_PRESETS = [
    { id: "sunny", label: "Sunny", message: "Bright, cheerful blooms for a sunny day.", recommendedFlowerIds: [3, 2, 1] },
    { id: "rainy", label: "Rainy", message: "Bring some color indoors on a rainy day.", recommendedFlowerIds: [5, 6, 4] },
    { id: "cloudy", label: "Cloudy", message: "Soft, gentle tones for an overcast day.", recommendedFlowerIds: [1, 4, 6] }
  ];
  var STEP_LABELS = ["Browse", "Cart", "Account", "Fulfillment", "Payment", "Confirmed"];
  /* ---------- server connection ---------- */
  var STATUS_FLOW = ["Pending", "Preparing", "Ready", "Completed"];
  var SECURITY_QS = ["What was the name of your first pet?", "What is your mother's maiden name?", "What city were you born in?", "What was your childhood nickname?", "What is the name of your elementary school?"];
  var TOKEN = null;
  try { TOKEN = sessionStorage.getItem("ph.token"); } catch(e){}
  var db = { orders: [], users: [] }; // admin view of server data, refreshed from the API
  function api(method, url, body){
    var headers = { "Content-Type": "application/json" };
    if (TOKEN) headers.Authorization = "Bearer " + TOKEN;
    return fetch(url, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined }).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(j){ if (!r.ok) throw new Error(j.error || "Something went wrong."); return j; });
    });
  }
  function flowerById(id){ return FLOWERS.filter(function(x){ return x.id === id; })[0]; }
  function stockQty(f){ var m = String(f.stock).match(/^\s*(\d+)/); return m ? Number(m[1]) : null; }
  function loadProducts(){
    return api("GET", "/api/products").then(function(list){
      var ids = {};
      list.forEach(function(p){
        ids[p.id] = true;
        var f = flowerById(p.id);
        if (!f){ f = { id: p.id, name: p.name, petals: 8, color: "var(--rose)", tag: "New", desc: p.desc || "Fresh flowers from PetalHub.", image: "flowers/placeholder.svg", photoAlt: p.name }; FLOWERS.push(f); }
        f.price = p.price; f.stock = p.stock;
      });
      FLOWERS = FLOWERS.filter(function(f){ return ids[f.id]; });
      state.cart = state.cart.filter(function(l){ return ids[l.id]; });
    });
  }
  function loadAdmin(){
    return Promise.all([api("GET", "/api/admin/orders"), api("GET", "/api/admin/customers")]).then(function(r){ db.orders = r[0]; db.users = r[1]; });
  }
  function applyUser(u){ state.authenticated = true; state.userName = u.name; state.userEmail = u.email; state.isAdmin = u.role === "admin"; }
  function startSession(r){
    TOKEN = r.token; try { sessionStorage.setItem("ph.token", TOKEN); } catch(e){}
    applyUser(r.user);
    return state.isAdmin ? loadAdmin().then(function(){ go("admin"); }) : go("cart");
  }
  function showErr(e){ alert(e.message); }

  /* ---------- state ---------- */
  var state = {
    screen: "home",
    detailId: null,
    qty: 1,
    cart: [],
    authenticated: false,
    userName: "",
    userEmail: "",
    isAdmin: false,
    adminTab: "orders",
    myOrders: [],
    forgotSent: false,
    forgotError: "",
    forgotStep: 1,
    forgotQuestion: "",
    forgotEmail: "",
    registerError: "",
    registerForm: { name: "", email: "", pass: "", pass2: "", question: SECURITY_QS[0], answer: "" },
    loginError: "",
    loginForm: { email: "", pass: "" },
    weatherChoice: null,
    fulfillment: null,
    address: { street: "", city: "", zip: "" },
    payment: null,
    orderCode: null
  };

  function go(screen){ state.screen = screen; window.scrollTo(0,0); render(); }

  function cartCount(){
    return state.cart.reduce(function(s, l){ return s + l.qty; }, 0);
  }
  function cartTotal(){
    return state.cart.reduce(function(s, l){
      var f = FLOWERS.filter(function(x){ return x.id === l.id; })[0];
      return s + (f ? f.price * l.qty : 0);
    }, 0);
  }
  function money(n){ return "$" + n.toFixed(2); }
  // Mother's Day is the second Sunday in May and must be recalculated for each year.
  function secondSundayOfMay(year){
    var firstMayDay = new Date(year, 4, 1).getDay();
    return 1 + ((7 - firstMayDay) % 7) + 7;
  }
  // Parse availability from the existing stock text; unknown stock strings remain available unless explicitly sold out.
  function hasAvailableStock(flower){
    if (/out of stock|sold out/i.test(flower.stock)) return false;
    var quantity = String(flower.stock).match(/^\s*(\d+)/);
    return !quantity || Number(quantity[1]) > 0;
  }
  // Use local calendar fields so occasion dates follow the visitor's local date and repeat every year.
  function occasionForDate(date){
    var month = date.getMonth() + 1;
    var day = date.getDate();
    var year = date.getFullYear();
    if (month === 5 && day === secondSundayOfMay(year)){
      return { name: "Mother's Day", message: "Celebrate someone who makes life bloom.", recommendedFlowerIds: [1, 4, 6] };
    }
    return OCCASIONS.filter(function(occasion){ return occasion.month === month && occasion.day === day; })[0] || null;
  }
  // Build recommendation cards from FLOWERS, retaining their real price, image, and live stock text.
  // Priority: holiday/event occasion (most specific) > simulated weather (if the visitor picked one) >
  // current season (always available) > a generic fallback if the top pick has nothing in stock.
  function screenRecommendations(){
    var occasion = occasionForDate(new Date());
    var weather = state.weatherChoice ? WEATHER_PRESETS.filter(function(w){ return w.id === state.weatherChoice; })[0] : null;
    var season = currentSeason(new Date());

    var source = occasion || weather || season;
    var reasonLabel = occasion ? occasion.name : (weather ? weather.label + " weather" : season.name);
    var heading = occasion ? occasion.name + " Picks" : (weather ? weather.label + " Day Picks" : season.name + " Picks");
    var message = source.message;

    var candidates = source.recommendedFlowerIds.map(function(id){
      return FLOWERS.filter(function(flower){ return flower.id === id; })[0];
    });
    var available = candidates.filter(function(flower){ return flower && hasAvailableStock(flower); });

    var usedFallback = false;
    if (available.length === 0){
      available = FLOWERS.filter(function(flower){ return hasAvailableStock(flower); }).slice(0, 3);
      usedFallback = true;
    }

    var cards = available.map(function(flower){
      return '' +
        '<button class="recommendation-card" onclick="App.openDetail(' + flower.id + ')">' +
          '<span class="recommendation-photo">' + flowerPhoto(flower, "recommendation-image", true, false) + '</span>' +
          '<span class="recommendation-info"><span class="recommendation-name">' + esc(flower.name) + '</span>' +
            '<span class="recommendation-price">' + money(flower.price) + ' / bunch</span>' +
            '<span class="recommendation-stock">' + esc(flower.stock) + '</span>' +
            '<span class="recommendation-reason">' + (usedFallback ? "Fresh pick today" : "Recommended for " + esc(reasonLabel)) + '</span></span>' +
        '</button>';
    }).join("");
    var emptyMessage = available.length === 0 ? '<p class="recommendation-empty">No flowers are currently available. Please check back soon.</p>' : '';

    var weatherToggle = '<div class="weather-toggle" role="group" aria-label="Simulate today\u2019s weather">' +
      '<span class="weather-toggle-label">Simulate weather:</span>' +
      WEATHER_PRESETS.map(function(w){
        var sel = state.weatherChoice === w.id;
        return '<button class="weather-chip' + (sel ? ' selected' : '') + '" onclick="App.setWeather(\'' + w.id + '\')">' + esc(w.label) + '</button>';
      }).join("") +
      (state.weatherChoice ? '<button class="weather-chip weather-chip-clear" onclick="App.setWeather(null)">Clear</button>' : '') +
      '</div>';

    return '<section class="recommendations" aria-labelledby="recommendation-heading">' +
      '<div class="recommendations-heading"><div><p class="eyebrow">Selected for the moment</p><h2 id="recommendation-heading">' + esc(heading) + '</h2><p>' + esc(message) + '</p></div></div>' +
      (occasion ? '' : weatherToggle) +
      (cards ? '<div class="recommendation-grid">' + cards + '</div>' : emptyMessage) +
      '</section>';
  }
  function esc(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c];
    });
  }

  /* ---------- icons ---------- */
  function flowerPhoto(flower, className, decorative, eager){
    return '<img class="' + className + '" src="' + esc(flower.image) + '" alt="' + (decorative ? '' : esc(flower.photoAlt)) + '" loading="' + (eager ? 'eager' : 'lazy') + '" decoding="async">';
  }
  function iconCart(){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="20" r="1.4" fill="currentColor" stroke="none"/><path d="M2.5 3h2l2.2 12.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 7H6"/></svg>';
  }
  function iconBack(){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  }
  function iconStore(){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1.5-5h15L21 9"/><path d="M3 9h18v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9z"/><path d="M9 20v-6h6v6"/></svg>';
  }
  function iconTruck(){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="7" width="13" height="9"/><path d="M14.5 10h4l3.5 3.5V16h-7.5z"/><circle cx="6" cy="18.5" r="1.6"/><circle cx="17.5" cy="18.5" r="1.6"/></svg>';
  }
  function iconCard(){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>';
  }
  function iconWallet(){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3"/><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1h-4a2.5 2.5 0 0 1 0-5h4"/></svg>';
  }
  function iconCash(){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="1.5"/><circle cx="12" cy="12" r="3"/></svg>';
  }
  function iconCheck(){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="var(--sage)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" fill="rgba(124,152,133,0.12)"/><path d="M8 12.5l2.6 2.6L16 9.5"/></svg>';
  }
  function iconEmptyCart(){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.2" fill="currentColor" stroke="none"/><circle cx="18" cy="20" r="1.2" fill="currentColor" stroke="none"/><path d="M2.5 3h2l2.2 12.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 7H6"/></svg>';
  }
  function brandMark(){
    return '<svg class="brand-mark" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
      '<g>' + petalFlowerMini() + '</g></svg>';
  }
  function petalFlowerMini(){
    var cx=12, cy=12, r=8.4, s="";
    for (var i=0;i<6;i++){
      var a = i*60;
      s += '<ellipse cx="'+cx+'" cy="'+(cy-r*0.55)+'" rx="'+(r*0.30)+'" ry="'+(r*0.58)+'" fill="var(--rose-deep)" transform="rotate('+a+' '+cx+' '+cy+')"/>';
    }
    s += '<circle cx="'+cx+'" cy="'+cy+'" r="'+(r*0.24)+'" fill="var(--gold)"/>';
    return s;
  }

  /* ---------- chrome ---------- */
  function stepIndexFor(screen){
    switch(screen){
      case "home": return 0;
      case "detail": return 0;
      case "cart": return 1;
      case "authGate": case "register": case "login": return 2;
      case "fulfillment": case "delivery": return 3;
      case "payment": return 4;
      case "confirm": case "done": return 5;
      default: return 0;
    }
  }
  function renderSteps(){
    var current = stepIndexFor(state.screen);
    var html = '<div class="steps">';
    STEP_LABELS.forEach(function(label, i){
      var cls = "step" + (i === current ? " active" : (i < current ? " done" : ""));
      html += '<div class="' + cls + '"><div class="step-bar"></div><div class="step-label">' + esc(label) + '</div></div>';
    });
    html += '</div>';
    return html;
  }
  function renderTopbar(){
    var count = cartCount();
    var cartClickable = count > 0 || (state.authenticated && !state.isAdmin);
    return '' +
      '<div class="topbar">' +
        '<div class="topbar-inner">' +
          '<button class="brand" onclick="App.go(\'home\')">' + brandMark() + 'PetalHub</button>' +
          '<div class="account-controls">' +
            (state.isAdmin ? '<button class="logout-btn" onclick="App.openAdmin()">Admin</button>' : '') + (state.authenticated ? '<span class="account-name">' + esc(state.userName) + '</span><button class="logout-btn" onclick="App.logout()">Log out</button>' : '<button class="logout-btn" onclick="App.go(\'login\')">Log in</button>') +
            '<button class="cart-pill" ' + (cartClickable ? 'onclick="App.openCart()"' : 'style="opacity:.55;cursor:default"') + '>' +
              iconCart() + '<span>Cart</span><span class="cart-count">' + count + '</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
        (["home", "admin", "forgot", "orders"].indexOf(state.screen) >= 0 ? "" : renderSteps()) +
      '</div>';
  }

  /* ---------- screens ---------- */
  function heroFlower(i){ return FLOWERS.length ? FLOWERS[i % FLOWERS.length] : { image: "flowers/placeholder.svg", photoAlt: "" }; }
  function screenForgot(){
    var head = '<div class="panel" style="max-width:460px;margin:0 auto;"><h2>Forgot password</h2>';
    var err = state.forgotError ? '<div class="error-box" style="margin-bottom:14px;">' + esc(state.forgotError) + '</div>' : '';
    var back = '<div class="switch-mode"><button onclick="App.go(\'login\')">Back to log in</button></div></div>';
    if (state.forgotSent) return head + '<p class="sub">Your password has been changed. You can log in with your new password now.</p>' + back;
    if (state.forgotStep === 2) return head + '<p class="sub">Answer your security question to set a new password.</p>' + err +
      '<form class="stack" onsubmit="return App.submitReset(event)"><div class="field"><label for="fg-a">' + esc(state.forgotQuestion) + '</label><input id="fg-a" type="text" autocomplete="off"></div><div class="field"><label for="fg-p">New password</label><input id="fg-p" type="password" placeholder="At least 6 characters" autocomplete="new-password"></div><button class="btn block" type="submit">Change password</button></form>' + back;
    return head + '<p class="sub">Enter your account email to get your security question.</p>' + err +
      '<form class="stack" onsubmit="return App.submitForgot(event)"><div class="field"><label for="fg-email">Email address</label><input id="fg-email" type="email" placeholder="jamie@email.com"></div><button class="btn block" type="submit">Continue</button></form>' + back;
  }
  function screenOrders(){
    var list = state.myOrders || [];
    var body = list.length ? list.map(function(o){
      var items = o.items.map(function(i){ return esc(i.name) + " \u00d7 " + i.qty; }).join(", ");
      return '<div class="admin-card"><div class="row"><strong>' + esc(o.code) + '</strong><span class="sub">' + esc(new Date(o.date).toLocaleString()) + '</span></div>' +
        '<p>' + items + ' \u2014 <strong>' + money(o.total) + '</strong></p><p class="sub">' + (o.fulfillment === "delivery" ? "Delivery" : "Pickup") + ' \u00b7 ' + esc(o.payment) + '</p></div>';
    }).join("") : '<p class="sub">You have no orders yet.</p>';
    return '<div class="panel"><h2>My orders</h2><p class="sub">Your past orders.</p>' + body + '<div class="admin-actions"><button class="btn" onclick="App.go(\'home\')">Back to shop</button></div></div>';
  }
  function screenHome(){
    var cards = FLOWERS.map(function(f){
      return '' +
        '<button class="flower-card" onclick="App.openDetail(' + f.id + ')">' +
          '<span class="flower-tag">' + esc(f.tag) + '</span>' +
          '<div class="flower-photo-wrap">' + flowerPhoto(f, "flower-photo", false, false) + '</div>' +
          '<div class="flower-name display">' + esc(f.name) + '</div>' +
          '<div class="flower-price">' + money(f.price) + ' / bunch</div>' +
        '</button>';
    }).join("");
    return '' +
      '<section class="hero">' +
        '<div class="hero-copy"><div class="eyebrow">The PetalHub growers’ room</div><h1>Fresh stems, chosen and sent with care.</h1><p>Browse this week\u2019s cuts from our growers\u2019 room, add what catches your eye, and we\u2019ll get it to you \u2014 by pickup or delivery.</p><button class="btn hero-cta" onclick="App.browseCollection()">Explore the collection</button><div class="hero-note">Freshly gathered, arranged for your everyday</div></div>' +
        '<div class="bouquet-scene" aria-label="A floating arrangement of real garden flowers" role="img"><div class="bouquet-glow"></div><div class="bouquet-platform"></div><div class="bouquet">' +
          '<div class="bouquet-bloom bouquet-bloom-a">' + flowerPhoto(heroFlower(0), "bouquet-photo", true, true) + '</div>' +
          '<div class="bouquet-bloom bouquet-bloom-b">' + flowerPhoto(heroFlower(3), "bouquet-photo", true, true) + '</div>' +
          '<div class="bouquet-bloom bouquet-bloom-c">' + flowerPhoto(heroFlower(2), "bouquet-photo", true, true) + '</div>' +
          '<div class="bouquet-bloom bouquet-bloom-d">' + flowerPhoto(heroFlower(1), "bouquet-photo", true, true) + '</div>' +
          '<div class="bouquet-bloom bouquet-bloom-e">' + flowerPhoto(heroFlower(4), "bouquet-photo", true, true) + '</div>' +
          '<div class="bouquet-bloom bouquet-bloom-f">' + flowerPhoto(heroFlower(5), "bouquet-photo", true, true) + '</div>' +
        '</div><div class="bouquet-caption">A little color, gathered fresh</div></div>' +
      '</section>' +
      screenRecommendations() +
      '<div class="collection-head" id="flower-collection"><div><h2>Flowers in season</h2><p>Gathered from this week’s grower selections</p></div></div>' +
      '<div class="grid">' + cards + '</div>';
  }

  function screenDetail(){
    var f = FLOWERS.filter(function(x){ return x.id === state.detailId; })[0];
    if (!f) { go("home"); return ""; }
    return '' +
      '<button class="back-link" onclick="App.go(\'home\')">' + iconBack() + 'Back to browsing</button>' +
      '<div class="detail">' +
        '<div class="detail-visual detail-visual-' + f.id + '">' + flowerPhoto(f, "detail-photo", false, true) + '</div>' +
        '<div class="detail-body">' +
          '<span class="flower-tag">' + esc(f.tag) + '</span>' +
          '<h2 style="margin-top:10px;">' + esc(f.name) + '</h2>' +
          '<div class="detail-price">' + money(f.price) + ' per bunch</div>' +
          '<p class="detail-desc">' + esc(f.desc) + '</p>' +
          '<div class="detail-stock">' + esc(f.stock) + '</div>' +
          '<div class="qty-row">' +
            '<button class="qty-btn" onclick="App.changeQty(-1)" aria-label="Decrease quantity">\u2212</button>' +
            '<span class="qty-val">' + state.qty + '</span>' +
            '<button class="qty-btn" onclick="App.changeQty(1)" aria-label="Increase quantity">+</button>' +
          '</div>' +
          '<button class="btn" onclick="App.addToCart(' + f.id + ')">Add ' + state.qty + ' to cart \u2014 ' + money(f.price * state.qty) + '</button>' +
        '</div>' +
      '</div>';
  }

  function screenAuthGate(){
    return '' +
      '<div class="panel" style="max-width:460px;margin:0 auto;">' +
        '<h2>Have a PetalHub account?</h2>' +
        '<p class="sub">Sign in or create an account so we can confirm your order and track delivery.</p>' +
        '<div class="choice-row" style="margin-top:6px;">' +
          '<button class="tap-card" onclick="App.go(\'login\')"><span class="t">Yes, log in</span><span class="d">I already have an account</span></button>' +
          '<button class="tap-card" onclick="App.go(\'register\')"><span class="t">No, register</span><span class="d">Set up a new account</span></button>' +
        '</div>' +
      '</div>';
  }

  function screenRegister(){
    var f = state.registerForm;
    return '' +
      '<div class="panel" style="max-width:460px;margin:0 auto;">' +
        '<h2>Register a new account</h2>' +
        '<p class="sub">Takes under a minute to get started.</p>' +
        (state.registerError ? '<div class="error-box" style="margin-bottom:14px;">' + esc(state.registerError) + '</div>' : '') +
        '<form class="stack" onsubmit="return App.submitRegister(event)">' +
          '<div class="field"><label for="reg-name">Full name</label><input id="reg-name" type="text" value="' + esc(f.name) + '" placeholder="Jamie Flores" autocomplete="name"></div>' +
          '<div class="field"><label for="reg-email">Email address</label><input id="reg-email" type="email" value="' + esc(f.email) + '" placeholder="jamie@email.com" autocomplete="email"></div>' +
          '<div class="row2">' +
            '<div class="field"><label for="reg-pass">Password</label><input id="reg-pass" type="password" value="' + esc(f.pass) + '" placeholder="At least 6 characters" autocomplete="new-password"></div>' +
            '<div class="field"><label for="reg-pass2">Confirm password</label><input id="reg-pass2" type="password" value="' + esc(f.pass2) + '" placeholder="Repeat password" autocomplete="new-password"></div>' +
          '</div>' +
          '<div class="field"><label for="reg-q">Security question (used if you forget your password)</label><select id="reg-q">' + SECURITY_QS.map(function(q){ return '<option value="' + esc(q) + '"' + (f.question === q ? ' selected' : '') + '>' + esc(q) + '</option>'; }).join("") + '</select></div>' +
          '<div class="field"><label for="reg-a">Your answer</label><input id="reg-a" type="text" value="' + esc(f.answer) + '" placeholder="Only you should know this" autocomplete="off"></div>' +
          '<button class="btn block" type="submit">Create account</button>' +
        '</form>' +
        '<div class="switch-mode">Already registered? <button onclick="App.go(\'login\')">Log in instead</button></div>' +
      '</div>';
  }

  function screenLogin(){
    var f = state.loginForm;
    return '' +
      '<div class="panel" style="max-width:460px;margin:0 auto;">' +
        '<h2>Log in</h2>' +
        '<p class="sub">Welcome back \u2014 log in to continue your order.</p>' +
        (state.loginError ? '<div class="error-box" style="margin-bottom:14px;">' + esc(state.loginError) + '</div>' : '') +
        '<form class="stack" onsubmit="return App.submitLogin(event)">' +
          '<div class="field"><label for="log-email">Email address</label><input id="log-email" type="email" value="' + esc(f.email) + '" placeholder="jamie@email.com" autocomplete="email"></div>' +
          '<div class="field"><label for="log-pass">Password</label><input id="log-pass" type="password" value="' + esc(f.pass) + '" placeholder="Enter your password" autocomplete="current-password"></div>' +
          '<button class="btn block" type="submit">Log in</button>' +
        '</form>' +
        '<div class="switch-mode"><button onclick="App.openForgot()">Forgot password?</button></div>' +
        '<div class="switch-mode">New here? <button onclick="App.go(\'register\')">Register an account</button></div>' +
      '</div>';
  }

  function screenCart(){
    if (state.cart.length === 0){
      return '<div class="empty-state">' + iconEmptyCart() + '<div>Your cart is empty.</div>' +
        '<div style="margin-top:18px;"><button class="btn" onclick="App.go(\'home\')">Browse flowers</button></div></div>';
    }
    var lines = state.cart.map(function(l){
      var f = FLOWERS.filter(function(x){ return x.id === l.id; })[0];
      return '' +
        '<div class="cart-line">' +
          '<div class="cart-line-icon">' + flowerPhoto(f, "", false, false) + '</div>' +
          '<div><div class="cart-line-name">' + esc(f.name) + '</div><div class="cart-line-sub">' + money(f.price) + ' / bunch</div></div>' +
          '<div class="cart-line-controls">' +
            '<button class="qty-btn" onclick="App.lineQty(' + f.id + ',-1)" aria-label="Decrease">\u2212</button>' +
            '<span class="qty-val">' + l.qty + '</span>' +
            '<button class="qty-btn" onclick="App.lineQty(' + f.id + ',1)" aria-label="Increase">+</button>' +
          '</div>' +
          '<div class="cart-line-total">' + money(f.price * l.qty) + '</div>' +
        '</div>';
    }).join("");
    var total = cartTotal();
    return '' +
      '<div class="panel">' +
        '<h2>Your cart</h2>' +
        '<p class="sub">' + (state.authenticated ? "Signed in as " + esc(state.userName) : "Review your stems before checkout") + '</p>' +
        lines +
        '<div class="summary-row total"><span>Subtotal</span><span>' + money(total) + '</span></div>' +
      '</div>' +
      '<div style="display:flex;gap:12px;margin-top:16px;flex-wrap:wrap;">' +
        '<button class="btn secondary" onclick="App.go(\'home\')">Continue shopping</button>' +
        '<button class="btn" onclick="App.go(\'fulfillment\')">Proceed to checkout</button>' +
      '</div>';
  }

  function screenFulfillment(){
    return '' +
      '<div class="panel" style="max-width:520px;margin:0 auto;">' +
        '<h2>Pickup or delivery?</h2>' +
        '<p class="sub">Choose how you\u2019d like to receive your order.</p>' +
        '<div class="choice-row">' +
          '<button class="tap-card" onclick="App.choosePickup()">' + iconStore() + '<span class="t">Pick up at store</span><span class="d">Ready in 2 hours, Ilocos Sur branch</span></button>' +
          '<button class="tap-card" onclick="App.go(\'delivery\')">' + iconTruck() + '<span class="t">Delivery</span><span class="d">Arrives within 1\u20132 days</span></button>' +
        '</div>' +
      '</div>';
  }

  function screenDelivery(){
    var a = state.address;
    return '' +
      '<div class="panel" style="max-width:520px;margin:0 auto;">' +
        '<button class="back-link" onclick="App.go(\'fulfillment\')">' + iconBack() + 'Change fulfillment</button>' +
        '<h2>Delivery address</h2>' +
        '<p class="sub">Where should we send your flowers?</p>' +
        '<form class="stack" onsubmit="return App.submitDelivery(event)">' +
          '<div class="field"><label for="d-street">Street address</label><input id="d-street" type="text" value="' + esc(a.street) + '" placeholder="123 Rizal Street"></div>' +
          '<div class="row2">' +
            '<div class="field"><label for="d-city">City / town</label><input id="d-city" type="text" value="' + esc(a.city) + '" placeholder="Caoayan"></div>' +
            '<div class="field"><label for="d-zip">ZIP / postal code</label><input id="d-zip" type="text" value="' + esc(a.zip) + '" placeholder="2703"></div>' +
          '</div>' +
          '<button class="btn block" type="submit">Continue to payment</button>' +
        '</form>' +
      '</div>';
  }

  function screenPayment(){
    var opts = [
      { id: "card", label: "Credit / debit card", desc: "Visa, Mastercard", icon: iconCard() },
      { id: "wallet", label: "GCash / e-wallet", desc: "Pay from your mobile wallet", icon: iconWallet() },
      { id: "cash", label: state.fulfillment === "delivery" ? "Cash on delivery" : "Cash on pickup", desc: "Pay when you receive your order", icon: iconCash() }
    ];
    var rows = opts.map(function(o){
      var sel = state.payment === o.id;
      return '<button class="pay-opt' + (sel ? ' selected' : '') + '" onclick="App.choosePayment(\'' + o.id + '\')">' +
        o.icon + '<div><div class="t">' + esc(o.label) + '</div><div class="d">' + esc(o.desc) + '</div></div></button>';
    }).join("");
    return '' +
      '<div class="panel" style="max-width:520px;margin:0 auto;">' +
        '<h2>Choose payment method</h2>' +
        '<p class="sub">Fulfillment: ' + (state.fulfillment === "delivery" ? "Delivery to " + esc(state.address.street || "your address") : "Pickup at store") + '</p>' +
        '<div class="payment-list">' + rows + '</div>' +
        '<button class="btn block" ' + (state.payment ? '' : 'disabled') + ' onclick="App.go(\'confirm\')">Review order</button>' +
      '</div>';
  }

  function screenConfirm(){
    var total = cartTotal();
    var payLabel = { card: "Credit / debit card", wallet: "GCash / e-wallet", cash: state.fulfillment === "delivery" ? "Cash on delivery" : "Cash on pickup" }[state.payment] || "\u2014";
    var itemsLine = state.cart.map(function(l){
      var f = FLOWERS.filter(function(x){ return x.id === l.id; })[0];
      return esc(f.name) + " \u00d7" + l.qty;
    }).join(", ");
    return '' +
      '<div class="panel" style="max-width:520px;margin:0 auto;">' +
        '<h2>Confirm your order</h2>' +
        '<p class="sub">Double-check everything before we send it off.</p>' +
        '<div class="confirm-list">' +
          '<div class="confirm-item"><span class="label">Items</span><span>' + itemsLine + '</span></div>' +
          '<div class="confirm-item"><span class="label">Fulfillment</span><span>' + (state.fulfillment === "delivery" ? "Delivery" : "Pickup at store") + '</span></div>' +
          (state.fulfillment === "delivery" ? '<div class="confirm-item"><span class="label">Address</span><span>' + esc([state.address.street, state.address.city, state.address.zip].filter(Boolean).join(", ")) + '</span></div>' : '') +
          '<div class="confirm-item"><span class="label">Payment</span><span>' + esc(payLabel) + '</span></div>' +
          '<div class="confirm-item"><span class="label">Account</span><span>' + esc(state.userName || "Guest") + '</span></div>' +
        '</div>' +
        '<div class="summary-row total"><span>Total</span><span>' + money(total) + '</span></div>' +
        '<button class="btn block" style="margin-top:18px;" onclick="App.confirmOrder()">Confirm order</button>' +
      '</div>';
  }

  function screenDone(){
    return '' +
      '<div class="done-wrap">' +
        '<div class="done-mark">' + iconCheck() + '</div>' +
        '<h2 style="font-size:26px;">Order confirmed</h2>' +
        '<p style="color:var(--text-soft);max-width:360px;margin:10px auto 0;">A confirmation has been sent for your order. Thank you for choosing PetalHub.</p>' +
        '<div class="order-code">' + esc(state.orderCode) + '</div>' +
        '<div class="actions-row">' +
          '<button class="btn" onclick="App.newOrder()">Start a new order</button>' +
          '<button class="logout-btn" onclick="App.openOrders()">View my orders</button>' +
        '</div>' +
      '</div>';
  }

  function screenAdmin(){
    var tab = state.adminTab;
    var help = {
      orders: "Review new orders and move each one forward (Pending \u2192 Preparing \u2192 Ready \u2192 Completed), or cancel it \u2014 cancelling returns the stems to stock.",
      products: "Update the price and available quantity of each flower. Changes show to customers right away.",
      customers: "See registered customers and how many orders each has placed."
    }[tab];
    var nav = '<div class="admin-tabs">' + ["orders", "products", "customers"].map(function(t){
      return '<button class="' + (t === tab ? 'btn' : 'logout-btn') + '" onclick="App.setTab(\'' + t + '\')">' + t.charAt(0).toUpperCase() + t.slice(1) + '</button>';
    }).join("") + '</div>';
    var body = "";
    if (tab === "orders"){
      body = db.orders.length ? db.orders.map(function(o){
        var idx = STATUS_FLOW.indexOf(o.status), next = idx >= 0 ? STATUS_FLOW[idx + 1] : null;
        var items = o.items.map(function(i){ return esc(i.name) + " \u00d7 " + i.qty; }).join(", ");
        return '<div class="admin-card"><div class="row"><strong>' + esc(o.code) + '</strong><span class="admin-status">' + esc(o.status) + '</span></div>' +
          '<p class="sub">' + esc(new Date(o.date).toLocaleString()) + ' \u2014 ' + esc(o.customer) + ' (' + esc(o.email) + ')</p>' +
          '<p>' + items + ' \u2014 <strong>' + money(o.total) + '</strong></p>' +
          '<p class="sub">' + (o.fulfillment === "delivery" ? "Delivery to " + esc([o.address.street, o.address.city, o.address.zip].filter(Boolean).join(", ")) : "Pickup at store") + ' \u00b7 ' + esc(o.payment) + '</p>' +
          (next ? '<div class="admin-actions"><button class="btn" onclick="App.setStatus(\'' + o.code + '\',\'' + next + '\')">Mark ' + next + '</button><button class="logout-btn" onclick="App.cancelOrder(\'' + o.code + '\')">Cancel order</button></div>' : '') + '</div>';
      }).join("") : '<p class="sub">No orders yet.</p>';
    } else if (tab === "products"){
      body = '<div class="admin-card"><strong>Add a flower</strong><div class="admin-actions"><input id="n-name" placeholder="Name" style="width:160px"><label>Price $ <input id="n-price" type="number" min="0" step="0.01"></label><label>Qty <input id="n-qty" type="number" min="0" step="1"></label></div><div class="admin-actions"><input id="n-desc" placeholder="Short description (optional)" style="width:100%"><button class="btn" onclick="App.addProduct()">Add flower</button></div></div>' + FLOWERS.map(function(f){
        return '<div class="admin-card"><div class="row"><strong>' + esc(f.name) + '</strong><span class="sub">' + esc(f.stock) + '</span></div>' +
          '<div class="admin-actions"><label>Price $ <input id="p-price-' + f.id + '" type="number" min="0" step="0.01" value="' + f.price + '"></label>' +
          '<label>Qty <input id="p-qty-' + f.id + '" type="number" min="0" step="1" value="' + (stockQty(f) || 0) + '"></label>' +
          '<button class="btn" onclick="App.saveProduct(' + f.id + ')">Save</button><button class="logout-btn" onclick="App.deleteProduct(' + f.id + ')">Delete</button></div></div>';
      }).join("");
    } else {
      var cs = db.users.filter(function(u){ return u.role !== "admin"; });
      body = cs.length ? cs.map(function(u, ci){
        var n = db.orders.filter(function(o){ return o.email === u.email; }).length;
        return '<div class="admin-card"><div class="row"><strong>' + esc(u.name) + '</strong><span class="sub">' + n + ' order' + (n === 1 ? '' : 's') + '</span></div><p class="sub">' + esc(u.email) + '</p></div>';
      }).join("") : '<p class="sub">No customers have registered yet.</p>';
    }
    return '<div class="panel"><h2>Admin</h2><p class="sub">' + help + '</p>' + nav + body + '</div>';
  }
  function renderMain(){
    switch(state.screen){
      case "home": return screenHome();
      case "detail": return screenDetail();
      case "authGate": return screenAuthGate();
      case "register": return screenRegister();
      case "login": return screenLogin();
      case "cart": return screenCart();
      case "fulfillment": return screenFulfillment();
      case "delivery": return screenDelivery();
      case "payment": return screenPayment();
      case "confirm": return screenConfirm();
      case "done": return screenDone();
      case "admin": return state.isAdmin ? screenAdmin() : screenHome();
      case "forgot": return screenForgot();
      case "orders": return state.authenticated ? screenOrders() : screenHome();
      default: return screenHome();
    }
  }

  function render(){
    document.getElementById("app").innerHTML =
      renderTopbar() +
      "<main>" + renderMain() + "</main>" +
      '<footer>PetalHub \u2014 Order flowers online.' +
        '<details class="photo-credits"><summary>Flower photography credits</summary><div class="photo-credit-list">' +
          '<p><a href="https://commons.wikimedia.org/wiki/File:Pink_rose_bloom_of_a_climbing_rose_at_Boreham,_Essex,_England_1.jpg">Garden rose photo by Acabashi</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a></p>' +
          '<p><a href="https://commons.wikimedia.org/wiki/File:Red-tulip-macro_-_West_Virginia_-_ForestWander.jpg">Tulip photo by ForestWander</a> · <a href="https://creativecommons.org/licenses/by-sa/3.0/us/deed.en">CC BY-SA 3.0 US</a></p>' +
          '<p><a href="https://commons.wikimedia.org/wiki/File:Sunflower_close_up_shot.jpg">Sunflower photo by Aerous</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a></p>' +
          '<p><a href="https://commons.wikimedia.org/wiki/File:Pink_Peony_Flower.jpg">Peony photo by Nathanieljoyce</a> · <a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0</a></p>' +
          '<p><a href="https://commons.wikimedia.org/wiki/File:IMG_8431_close_up_for_Purple_Orchid_Flower_photographed_by_Peak_Hora.jpg">Orchid photo by Peak Hora</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a></p>' +
          '<p><a href="https://commons.wikimedia.org/wiki/File:A_flower_of_Madonna_lily,_black_stamen_pollen.jpg">Madonna lily photo by Bobjgalindo</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></p>' +
        '</div></details></footer>';
    bindDepthInteractions();
  }

  function bindDepthInteractions(){
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.querySelectorAll(".flower-card, .detail-visual").forEach(function(surface){
      surface.addEventListener("pointermove", function(event){
        var bounds = surface.getBoundingClientRect();
        var x = (event.clientX - bounds.left) / bounds.width * 2 - 1;
        var y = (event.clientY - bounds.top) / bounds.height * 2 - 1;
        surface.style.setProperty("--tilt-x", (-y * 3).toFixed(2) + "deg");
        surface.style.setProperty("--tilt-y", (x * 4).toFixed(2) + "deg");
      });
      surface.addEventListener("pointerleave", function(){
        surface.style.removeProperty("--tilt-x");
        surface.style.removeProperty("--tilt-y");
      });
    });
    var bouquetScene = document.querySelector(".bouquet-scene");
    if (!bouquetScene) return;
    bouquetScene.addEventListener("pointermove", function(event){
      var bounds = bouquetScene.getBoundingClientRect();
      var x = (event.clientX - bounds.left) / bounds.width * 2 - 1;
      var y = (event.clientY - bounds.top) / bounds.height * 2 - 1;
      bouquetScene.style.transform = "rotateX(" + (-y * 2).toFixed(2) + "deg) rotateY(" + (x * 3).toFixed(2) + "deg)";
    });
    bouquetScene.addEventListener("pointerleave", function(){ bouquetScene.style.removeProperty("transform"); });
  }

  /* ---------- actions ---------- */
  var App = {
    go: go,
    browseCollection: function(){
      var collection = document.getElementById("flower-collection");
      if (collection) collection.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    },
    openDetail: function(id){ state.detailId = id; state.qty = 1; go("detail"); },
    changeQty: function(d){ state.qty = Math.max(1, state.qty + d); render(); },
    addToCart: function(id){
      var line = state.cart.filter(function(l){ return l.id === id; })[0];
      if (line) line.qty += state.qty; else state.cart.push({ id: id, qty: state.qty });
      if (state.authenticated) go("cart"); else go("authGate");
    },
    openCart: function(){
      if (state.cart.length === 0 && state.authenticated && !state.isAdmin) return window.App.openOrders();
      if (state.authenticated) go("cart"); else go("authGate");
    },
    setWeather: function(id){ state.weatherChoice = id; render(); },
    lineQty: function(id, d){
      var line = state.cart.filter(function(l){ return l.id === id; })[0];
      if (!line) return;
      line.qty += d;
      if (line.qty <= 0) state.cart = state.cart.filter(function(l){ return l.id !== id; });
      render();
    },
    submitRegister: function(ev){
      ev.preventDefault();
      var name = document.getElementById("reg-name").value.trim();
      var email = document.getElementById("reg-email").value.trim();
      var pass = document.getElementById("reg-pass").value;
      var pass2 = document.getElementById("reg-pass2").value;
      var question = document.getElementById("reg-q").value, answer = document.getElementById("reg-a").value.trim();
      state.registerForm = { name: name, email: email, pass: pass, pass2: pass2, question: question, answer: answer };
      if (!name || !email || !pass || !pass2){
        state.registerError = "Please fill in every field to finish registration.";
      } else if (email.indexOf("@") === -1 || email.indexOf(".") === -1){
        state.registerError = "That doesn\u2019t look like a valid email address.";
      } else if (pass.length < 6){
        state.registerError = "Password must be at least 6 characters.";
      } else if (pass !== pass2){
        state.registerError = "Passwords don\u2019t match \u2014 try again.";
      } else if (answer.length < 2){
        state.registerError = "Please answer your security question \u2014 you\u2019ll need it if you forget your password.";
      } else {
        state.registerError = "";
        api("POST", "/api/register", { name: name, email: email, pass: pass, question: question, answer: answer }).then(function(r){
          state.registerForm = { name: "", email: "", pass: "", pass2: "", question: SECURITY_QS[0], answer: "" };
          return startSession(r);
        }).catch(function(e){ state.registerError = e.message; render(); });
        return false;
      }
      render();
      return false;
    },
    submitLogin: function(ev){
      ev.preventDefault();
      var email = document.getElementById("log-email").value.trim();
      var pass = document.getElementById("log-pass").value;
      state.loginForm = { email: email, pass: pass };
      if (!email || !pass){
        state.loginError = "Enter both your email and password.";
      } else {
        state.loginError = "";
        api("POST", "/api/login", { email: email, pass: pass }).then(function(r){
          state.loginForm = { email: "", pass: "" };
          return startSession(r);
        }).catch(function(e){ state.loginError = e.message; render(); });
        return false;
      }
      render();
      return false;
    },
    logout: function(){
      if (TOKEN) api("POST", "/api/logout").catch(function(){});
      TOKEN = null; try { sessionStorage.removeItem("ph.token"); } catch(e){}
      state.authenticated = false;
      state.isAdmin = false;
      state.userEmail = "";
      state.userName = "";
      state.fulfillment = null;
      state.address = { street: "", city: "", zip: "" };
      state.payment = null;
      state.orderCode = null;
      go("home");
    },
    choosePickup: function(){ state.fulfillment = "pickup"; go("payment"); },
    submitDelivery: function(ev){
      ev.preventDefault();
      var street = document.getElementById("d-street").value.trim();
      var city = document.getElementById("d-city").value.trim();
      var zip = document.getElementById("d-zip").value.trim();
      if (!street || !city){
        document.getElementById("d-street").reportValidity && document.getElementById("d-street").focus();
        return false;
      }
      state.fulfillment = "delivery";
      state.address = { street: street, city: city, zip: zip };
      go("payment");
      return false;
    },
    choosePayment: function(id){ state.payment = id; render(); },
    confirmOrder: function(){
      if (state.placing) return;
      state.placing = true;
      api("POST", "/api/orders", {
        items: state.cart.map(function(l){ return { id: l.id, qty: l.qty }; }),
        fulfillment: state.fulfillment, address: state.address, payment: state.payment
      }).then(function(r){
        state.placing = false; state.orderCode = r.code; go("done"); loadProducts().then(render).catch(function(){});
      }).catch(function(e){
        state.placing = false; showErr(e); loadProducts().catch(function(){}).then(function(){ go("cart"); });
      });
    },
    openAdmin: function(){ loadAdmin().then(function(){ go("admin"); }).catch(showErr); },
    openOrders: function(){ api("GET", "/api/orders/mine").then(function(r){ state.myOrders = r; go("orders"); }).catch(showErr); },
    openForgot: function(){ state.forgotSent = false; state.forgotError = ""; state.forgotStep = 1; state.forgotQuestion = ""; state.forgotEmail = ""; go("forgot"); },
    submitForgot: function(e){
      e.preventDefault();
      var email = document.getElementById("fg-email").value.trim();
      if (!email){ state.forgotError = "Enter your email."; render(); return false; }
      api("POST", "/api/forgot", { email: email }).then(function(r){
        if (r.question){ state.forgotError = ""; state.forgotEmail = email; state.forgotQuestion = r.question; state.forgotStep = 2; }
        else state.forgotError = "We couldn\\u2019t find a security question for that email. If you registered before this feature existed, please register a new account.";
        render();
      }).catch(function(err){ state.forgotError = err.message; render(); });
      return false;
    },
    submitReset: function(e){
      e.preventDefault();
      var answer = document.getElementById("fg-a").value.trim(), pw = document.getElementById("fg-p").value;
      if (!answer || pw.length < 6){ state.forgotError = "Enter your answer and a new password of at least 6 characters."; render(); return false; }
      api("POST", "/api/reset-password", { email: state.forgotEmail, answer: answer, password: pw }).then(function(){ state.forgotSent = true; render(); }).catch(function(err){ state.forgotError = err.message; render(); });
      return false;
    },
    addProduct: function(){
      var name = document.getElementById("n-name").value.trim(), price = parseFloat(document.getElementById("n-price").value);
      var qty = parseInt(document.getElementById("n-qty").value, 10), desc = document.getElementById("n-desc").value.trim();
      if (!name || isNaN(price) || price < 0 || isNaN(qty) || qty < 0){ alert("Enter a name, a price and a quantity."); return; }
      api("POST", "/api/admin/products", { name: name, price: price, qty: qty, desc: desc }).then(loadProducts).then(render).catch(showErr);
    },
    deleteProduct: function(id){
      if (!confirm("Remove this flower from the shop? Past orders are kept.")) return;
      api("DELETE", "/api/admin/products/" + id).then(loadProducts).then(render).catch(showErr);
    },
    setTab: function(t){ state.adminTab = t; render(); },
    setStatus: function(code, status){
      api("PATCH", "/api/admin/orders/" + code, { status: status }).then(loadAdmin).then(render).catch(showErr);
    },
    cancelOrder: function(code){
      api("PATCH", "/api/admin/orders/" + code, { status: "Cancelled" }).then(loadAdmin).then(render).catch(showErr);
    },
    saveProduct: function(id){
      var price = parseFloat(document.getElementById("p-price-" + id).value);
      var qty = parseInt(document.getElementById("p-qty-" + id).value, 10);
      if (isNaN(price) || price < 0 || isNaN(qty) || qty < 0) return;
      api("PUT", "/api/admin/products/" + id, { price: price, qty: qty }).then(loadProducts).then(render).catch(showErr);
    },
    newOrder: function(){
      state.cart = [];
      state.fulfillment = null;
      state.address = { street: "", city: "", zip: "" };
      state.payment = null;
      state.orderCode = null;
      go("home");
    }
  };
  window.App = App;

  render();
  loadProducts().catch(function(){}).then(function(){
    if (!TOKEN) return;
    return api("GET", "/api/me").then(function(r){ applyUser(r.user); }).catch(function(){ TOKEN = null; try { sessionStorage.removeItem("ph.token"); } catch(e){} });
  }).then(render);
})();