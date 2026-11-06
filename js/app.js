(function () {
  "use strict";

  /* ------------------------------------------------------------------
   * 기본 설정
   * ------------------------------------------------------------------ */
  var CONFIG = window.MAP_CONFIG || {};
  var CAMPUS = CONFIG.campus || { name: "한국외국어대학교 서울캠퍼스", lat: 37.597, lng: 127.059 };
  var ALL_DEPT = "전체 재학생";
  var WALK_M_PER_MIN = 75;   // 평균 보행 속도
  var DETOUR = 1.25;         // 직선거리 대비 실제 보행 거리 보정
  var STORE = {
    custom: "hufsmap.custom.v1",
    favs: "hufsmap.favs.v1",
    dept: "hufsmap.dept.v1",
    rings: "hufsmap.rings.v1"
  };

  var ICONS = {
    food: '<path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1.2-3 3.5-3 6.5V13h3"/>',
    cafe: '<path d="M4 9h12v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2.5M12 3.5v2.5M4 21h12"/>',
    pub: '<path d="M6 8h10v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM16 11h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2M6 8a3 3 0 0 1 5-2.2A3 3 0 0 1 16 8M10 12v5M13 12v5"/>',
    life: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1 20 20M8.1 15.9 20 4"/>',
    fun: '<path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-6zM14 5v2M14 11v2M14 17v2"/>',
    study: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5M8 7h8M8 11h6"/>',
    campus: '<path d="M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 9v6"/>',
    station: '<path d="M7 3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM4 10h16M8 21l2-4M16 21l-2-4"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'
  };

  var CATEGORIES = [
    { id: "food", label: "식당", color: "var(--c-food)" },
    { id: "cafe", label: "카페", color: "var(--c-cafe)" },
    { id: "pub", label: "주점", color: "var(--c-pub)" },
    { id: "life", label: "생활·건강", color: "var(--c-life)" },
    { id: "fun", label: "문화·여가", color: "var(--c-fun)" },
    { id: "study", label: "학습·인쇄", color: "var(--c-study)" }
  ];
  var CAT = {};
  CATEGORIES.forEach(function (c) { CAT[c.id] = c; });

  /* ------------------------------------------------------------------
   * 유틸
   * ------------------------------------------------------------------ */
  function $(sel) { return document.querySelector(sel); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function svg(name) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || ICONS.pin) + "</svg>"; }
  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }
  function haversine(a, b) {
    var R = 6371000, toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad, dLng = (b.lng - a.lng) * toRad;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  function walkMin(m) { return Math.max(1, Math.round(m * DETOUR / WALK_M_PER_MIN)); }
  function fmtDist(m) { return m < 1000 ? Math.round(m / 10) * 10 + "m" : (m / 1000).toFixed(1) + "km"; }
  function catOf(p) { return CAT[p.category] || CAT.food; }
  function isMobile() { return window.matchMedia("(max-width: 760px)").matches; }

  var TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
  function daysLeft(until) {
    if (!until) return null;
    var d = new Date(until + "T00:00:00");
    if (isNaN(d)) return null;
    return Math.round((d - TODAY) / 86400000);
  }
  function isExpired(b) { var d = daysLeft(b.until); return d !== null && d < 0; }

  /* ------------------------------------------------------------------
   * 데이터
   * ------------------------------------------------------------------ */
  function normalize(p, i, custom) {
    var benefits = Array.isArray(p.benefits) ? p.benefits : [];
    return {
      id: String(p.id || (custom ? "c" : "p") + Date.now().toString(36) + i),
      name: String(p.name || "이름 없는 업체"),
      category: CAT[p.category] ? p.category : "food",
      lat: Number(p.lat),
      lng: Number(p.lng),
      address: p.address || "",
      hours: p.hours || "",
      phone: p.phone || "",
      link: p.link || "",
      conditions: p.conditions || "",
      sample: !!p.sample,
      custom: !!custom,
      benefits: benefits.map(function (b) {
        return {
          kind: b.kind === "dept" ? "dept" : "student",
          departments: b.kind === "dept" && Array.isArray(b.departments) ? b.departments.slice() : [],
          text: String(b.text || ""),
          until: b.until || ""
        };
      })
    };
  }
  function validPlace(p) { return isFinite(p.lat) && isFinite(p.lng); }

  var basePlaces = (window.PLACES || []).map(function (p, i) { return normalize(p, i, false); }).filter(validPlace);
  var customPlaces = (store(STORE.custom) || []).map(function (p, i) { return normalize(p, i, true); }).filter(validPlace);
  function allPlaces() { return basePlaces.concat(customPlaces); }
  function findPlace(id) { return allPlaces().filter(function (p) { return p.id === id; })[0]; }
  function saveCustom() { store(STORE.custom, customPlaces); }

  var favs = new Set(store(STORE.favs) || []);
  function saveFavs() { store(STORE.favs, Array.from(favs)); }

  /* ------------------------------------------------------------------
   * 상태
   * ------------------------------------------------------------------ */
  var state = {
    q: "",
    dept: store(STORE.dept) || "",
    kind: "all",
    cats: new Set(CATEGORIES.map(function (c) { return c.id; })),
    sort: "distance",
    hideExpired: true,
    activeId: null,
    adding: false,
    rings: store(STORE.rings) !== false
  };

  function deptHit(b, dept) {
    return b.kind === "dept" && !!dept && (b.departments.indexOf(dept) > -1 || b.departments.indexOf(ALL_DEPT) > -1);
  }
  function liveBenefits(p) {
    return state.hideExpired ? p.benefits.filter(function (b) { return !isExpired(b); }) : p.benefits;
  }
  function analyze(p) {
    var bs = liveBenefits(p);
    var hasDept = bs.some(function (b) { return b.kind === "dept"; });
    var hasStudent = bs.some(function (b) { return b.kind === "student"; });
    var mine = bs.some(function (b) { return deptHit(b, state.dept); });
    var dist = haversine(CAMPUS, p);
    return { benefits: bs, hasDept: hasDept, hasStudent: hasStudent, mine: mine, dist: dist,
      dim: !!state.dept && state.kind === "all" && !mine && !hasStudent };
  }
  function matches(p, a) {
    if (!a.benefits.length && p.benefits.length) return false;
    if (!state.cats.has(p.category)) return false;
    if (state.kind === "dept" && !(state.dept ? a.mine : a.hasDept)) return false;
    if (state.kind === "student" && !a.hasStudent) return false;
    if (state.kind === "fav" && !favs.has(p.id)) return false;
    if (state.q) {
      var hay = [p.name, p.address, p.conditions, catOf(p).label].concat(p.benefits.map(function (b) {
        return b.text + " " + b.departments.join(" ") + (b.kind === "dept" ? " 학과 제휴" : " 대학생 할인");
      })).join(" ").toLowerCase();
      var terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
      for (var i = 0; i < terms.length; i++) if (hay.indexOf(terms[i]) === -1) return false;
    }
    return true;
  }

  /* ------------------------------------------------------------------
   * 지도
   * ------------------------------------------------------------------ */
  var map = L.map("map", { zoomControl: true, attributionControl: true })
    .setView([CAMPUS.lat, CAMPUS.lng], CONFIG.zoom || 16);

  var osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 기여자'
  }).addTo(map);
  var carto = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 20, subdomains: "abcd",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  });
  L.control.layers({ "기본 지도": osm, "밝은 지도": carto }, null, { position: "topleft" }).addTo(map);
  L.control.scale({ imperial: false, position: "bottomright" }).addTo(map);

  // 캠퍼스 & 역
  L.marker([CAMPUS.lat, CAMPUS.lng], {
    icon: L.divIcon({ className: "pin-wrap", html: '<div class="pin-campus">' + svg("campus") + "</div>", iconSize: [44, 44], iconAnchor: [22, 22] }),
    zIndexOffset: 1000, keyboard: false
  }).addTo(map).bindTooltip("<b>" + esc(CAMPUS.name) + "</b>" + (CAMPUS.address ? "<br>" + esc(CAMPUS.address) : ""), { direction: "top", offset: [0, -22], className: "name-tip" });

  (CONFIG.landmarks || []).forEach(function (s) {
    L.marker([s.lat, s.lng], {
      icon: L.divIcon({ className: "pin-wrap", html: '<div class="pin-station">' + svg("station") + "</div>", iconSize: [26, 26], iconAnchor: [13, 13] }),
      keyboard: false
    }).addTo(map).bindTooltip("<b>" + esc(s.name) + "</b>" + (s.note ? " · " + esc(s.note) : ""), { direction: "top", offset: [0, -12], className: "name-tip", permanent: false });
  });

  // 도보 반경
  var ringLayer = L.layerGroup();
  [5, 10, 15].forEach(function (min) {
    var r = min * WALK_M_PER_MIN / DETOUR;
    L.circle([CAMPUS.lat, CAMPUS.lng], {
      radius: r, color: "#0e5a57", weight: 1.5, opacity: .55, dashArray: "4 6", fill: min === 5, fillOpacity: .05, interactive: false
    }).addTo(ringLayer);
    L.marker([CAMPUS.lat + r / 111320, CAMPUS.lng], {
      icon: L.divIcon({ className: "ring-label", html: "도보 " + min + "분", iconSize: [60, 14], iconAnchor: [30, 16] }),
      interactive: false, keyboard: false
    }).addTo(ringLayer);
  });
  function applyRings() {
    if (state.rings) ringLayer.addTo(map); else ringLayer.remove();
    $("#ringBtn").setAttribute("aria-pressed", String(state.rings));
  }

  // 업체 마커
  var markers = {};
  var placeLayer = L.layerGroup().addTo(map);

  function pinIcon(p, a) {
    var cls = ["pin"];
    if (a.hasDept) cls.push("has-dept");
    if (a.mine) cls.push("has-mine");
    if (a.dim) cls.push("is-dim");
    if (state.activeId === p.id) cls.push("is-active");
    var deptCount = a.benefits.filter(function (b) { return b.kind === "dept"; }).length;
    var badge = a.mine ? '<span class="badge">내</span>' : (deptCount ? '<span class="badge">' + deptCount + "</span>" : "");
    return L.divIcon({
      className: "pin-wrap",
      html: '<div class="' + cls.join(" ") + '" style="--c:' + catOf(p).color + '" data-id="' + esc(p.id) + '">' + svg(p.category) + badge + "</div>",
      iconSize: [34, 34],
      iconAnchor: [17, 40]
    });
  }

  function syncMarkers(visible) {
    var keep = {};
    visible.forEach(function (row) {
      var p = row.p, a = row.a;
      keep[p.id] = true;
      var m = markers[p.id];
      if (!m) {
        m = L.marker([p.lat, p.lng], { riseOnHover: true, title: p.name });
        m.on("click", function () { select(p.id, { fly: false }); });
        m.on("mouseover", function () { hover(p.id, true); });
        m.on("mouseout", function () { hover(p.id, false); });
        markers[p.id] = m;
      }
      m.setLatLng([p.lat, p.lng]);
      m.setIcon(pinIcon(p, a));
      m.setZIndexOffset(state.activeId === p.id ? 900 : a.mine ? 500 : a.dim ? -100 : 0);
      m.unbindTooltip().bindTooltip(esc(p.name), { direction: "top", offset: [0, -40], className: "name-tip" });
      if (!placeLayer.hasLayer(m)) placeLayer.addLayer(m);
    });
    Object.keys(markers).forEach(function (id) {
      if (!keep[id]) placeLayer.removeLayer(markers[id]);
    });
  }

  function hover(id, on) {
    var li = document.querySelector('.item[data-id="' + CSS.escape(id) + '"]');
    if (li) li.classList.toggle("is-hover", on);
    var m = markers[id];
    var el = m && m.getElement() && m.getElement().querySelector(".pin");
    if (el) el.classList.toggle("is-hover", on);
  }

  /* ------------------------------------------------------------------
   * 목록
   * ------------------------------------------------------------------ */
  function tagsFor(a) {
    var t = [];
    if (a.mine) t.push('<span class="tag tag-mine">내 학과 제휴</span>');
    else if (a.hasDept) t.push('<span class="tag tag-dept">학과 제휴</span>');
    if (a.hasStudent) t.push('<span class="tag tag-student">대학생 할인</span>');
    return t.join("");
  }

  function sortRows(rows) {
    var by = {
      distance: function (x, y) { return x.a.dist - y.a.dist; },
      benefits: function (x, y) { return (y.a.benefits.length - x.a.benefits.length) || (x.a.dist - y.a.dist); },
      name: function (x, y) { return x.p.name.localeCompare(y.p.name, "ko"); }
    }[state.sort];
    return rows.sort(function (x, y) {
      // 내 학과 제휴는 항상 위로
      if (state.dept && x.a.mine !== y.a.mine) return x.a.mine ? -1 : 1;
      if (x.a.dim !== y.a.dim) return x.a.dim ? 1 : -1;
      return by(x, y);
    });
  }

  function headline(p, a) {
    var mine = a.benefits.filter(function (b) { return deptHit(b, state.dept); })[0];
    var b = mine || a.benefits[0];
    return b ? b.text : "등록된 혜택 없음";
  }

  function renderChips(rowsAll) {
    var counts = {};
    rowsAll.forEach(function (r) { counts[r.p.category] = (counts[r.p.category] || 0) + 1; });
    $("#categoryChips").innerHTML = CATEGORIES.map(function (c) {
      return '<button type="button" class="chip" data-cat="' + c.id + '" aria-pressed="' + state.cats.has(c.id) + '" style="--c:' + c.color + '">' +
        svg(c.id) + esc(c.label) + '<span class="count">' + (counts[c.id] || 0) + "</span></button>";
    }).join("");
  }

  function render() {
    var places = allPlaces();
    var rowsAll = places.map(function (p) { return { p: p, a: analyze(p) }; });
    // 칩 숫자는 업종 필터를 제외한 나머지 조건 기준
    var savedCats = state.cats;
    state.cats = new Set(CATEGORIES.map(function (c) { return c.id; }));
    var forChips = rowsAll.filter(function (r) { return matches(r.p, r.a); });
    state.cats = savedCats;
    renderChips(forChips);

    var rows = sortRows(rowsAll.filter(function (r) { return matches(r.p, r.a); }));
    syncMarkers(rows);

    var nDept = rows.filter(function (r) { return r.a.hasDept; }).length;
    var nStu = rows.filter(function (r) { return r.a.hasStudent; }).length;
    var nMine = rows.filter(function (r) { return r.a.mine; }).length;
    $("#resultMeta").textContent = rows.length + "곳 표시 중 · 학과 제휴 " + nDept + " · 대학생 할인 " + nStu +
      (state.dept ? " · " + state.dept + " 해당 " + nMine : "");

    var list = $("#list");
    if (!rows.length) {
      list.innerHTML = '<li class="empty">조건에 맞는 업체가 없어요.<br><button type="button" class="btn" id="resetFilters">필터 초기화</button></li>';
      $("#resetFilters").onclick = resetFilters;
    } else {
      list.innerHTML = rows.map(function (r) {
        var p = r.p, a = r.a, c = catOf(p);
        var cls = "item" + (a.dim ? " is-dim" : "") + (state.activeId === p.id ? " is-active" : "");
        return '<li class="' + cls + '" data-id="' + esc(p.id) + '" tabindex="0">' +
          '<div class="item-icon" style="--c:' + c.color + '">' + svg(p.category) + "</div>" +
          '<div class="item-main">' +
            '<div class="item-name">' + esc(p.name) + (favs.has(p.id) ? '<span class="fav" aria-label="즐겨찾기">★</span>' : "") + "</div>" +
            '<div class="item-sub">' + esc(c.label) + (p.address ? " · " + esc(p.address) : "") + "</div>" +
            '<div class="item-benefit">' + esc(headline(p, a)) + "</div>" +
            '<div class="item-tags">' + tagsFor(a) + (a.benefits.length > 1 ? '<span class="tag tag-custom">혜택 ' + a.benefits.length + "개</span>" : "") +
              (p.custom ? '<span class="tag tag-custom">내가 추가</span>' : "") + "</div>" +
          "</div>" +
          '<div class="item-dist"><b>' + walkMin(a.dist) + "분</b>" + fmtDist(a.dist) + "</div>" +
        "</li>";
      }).join("");
    }

    $("#sampleNotice").hidden = !basePlaces.some(function (p) { return p.sample; });
    if (state.activeId) renderDetail();
  }

  function resetFilters() {
    state.q = ""; $("#searchInput").value = "";
    state.kind = "all";
    state.cats = new Set(CATEGORIES.map(function (c) { return c.id; }));
    state.hideExpired = true; $("#hideExpired").checked = true;
    syncSeg();
    render();
  }

  /* ------------------------------------------------------------------
   * 상세
   * ------------------------------------------------------------------ */
  function benefitHTML(b) {
    var d = daysLeft(b.until);
    var expired = d !== null && d < 0;
    var mine = deptHit(b, state.dept);
    var head = b.kind === "dept"
      ? (mine ? '<span class="tag tag-mine">내 학과 제휴</span>' : '<span class="tag tag-dept">학과 제휴</span>')
      : '<span class="tag tag-student">대학생 할인</span>';
    var when = "";
    if (expired) when = ' <span class="tag tag-expired">' + esc(b.until) + " 종료</span>";
    else if (d !== null && d <= 30) when = ' <span class="tag tag-soon">D-' + d + "</span>";
    var meta = [];
    if (b.kind === "dept" && b.departments.length) meta.push("대상: " + b.departments.map(esc).join(", "));
    meta.push(b.until ? "~ " + esc(b.until) + " 까지" : "상시");
    return '<li class="benefit kind-' + b.kind + (mine ? " is-mine" : "") + (expired ? " is-expired" : "") + '">' +
      head + when +
      '<div class="benefit-text">' + esc(b.text) + "</div>" +
      '<div class="benefit-meta">' + meta.join(" · ") + "</div></li>";
  }

  function renderDetail() {
    var p = findPlace(state.activeId);
    var box = $("#detail");
    if (!p) { closeDetail(); return; }
    var a = analyze(p), c = catOf(p);
    var bs = p.benefits.slice().sort(function (x, y) {
      return (deptHit(y, state.dept) - deptHit(x, state.dept)) || (isExpired(x) - isExpired(y));
    });
    var kakaoTo = "https://map.kakao.com/link/to/" + encodeURIComponent(p.name) + "," + p.lat + "," + p.lng;
    var kakaoMap = "https://map.kakao.com/link/map/" + encodeURIComponent(p.name) + "," + p.lat + "," + p.lng;
    var naver = "https://map.naver.com/p/search/" + encodeURIComponent(p.name);
    var fav = favs.has(p.id);

    box.innerHTML =
      '<div class="detail-top">' +
        '<button type="button" class="btn btn-ghost" id="detailBack">← 목록</button>' +
        '<div style="display:flex;gap:6px">' +
          (p.custom ? '<button type="button" class="btn" id="detailEdit">수정</button>' : "") +
          '<button type="button" class="btn" id="detailFav" aria-pressed="' + fav + '">' + (fav ? "★ 저장됨" : "☆ 즐겨찾기") + "</button>" +
        "</div>" +
      "</div>" +
      '<div class="detail-head">' +
        '<div class="item-icon" style="--c:' + c.color + '">' + svg(p.category) + "</div>" +
        "<div><h2>" + esc(p.name) + '</h2><div class="sub">' + esc(c.label) + (p.sample ? " · 예시 데이터" : "") + (p.custom ? " · 내가 추가" : "") + "</div></div>" +
      "</div>" +
      '<div class="facts">' +
        '<div class="fact"><span>캠퍼스에서</span><b>' + fmtDist(a.dist) + "</b></div>" +
        '<div class="fact"><span>도보</span><b>약 ' + walkMin(a.dist) + "분</b></div>" +
        '<div class="fact"><span>혜택</span><b>' + a.benefits.length + "개</b></div>" +
      "</div>" +
      '<div class="item-tags">' + tagsFor(a) + "</div>" +
      '<p class="section-label">혜택</p>' +
      '<ul class="benefits">' + (bs.length ? bs.map(benefitHTML).join("") : '<li class="muted">등록된 혜택이 없어요.</li>') + "</ul>" +
      '<p class="section-label">정보</p>' +
      '<dl class="info">' +
        (p.conditions ? "<dt>이용 조건</dt><dd>" + esc(p.conditions) + "</dd>" : "") +
        (p.hours ? "<dt>영업시간</dt><dd>" + esc(p.hours) + "</dd>" : "") +
        (p.address ? "<dt>위치</dt><dd>" + esc(p.address) + "</dd>" : "") +
        (p.phone ? "<dt>전화</dt><dd>" + esc(p.phone) + "</dd>" : "") +
        "<dt>좌표</dt><dd><code>" + p.lat.toFixed(5) + ", " + p.lng.toFixed(5) + "</code></dd>" +
      "</dl>" +
      '<div class="links">' +
        '<a class="btn btn-primary" href="' + kakaoTo + '" target="_blank" rel="noopener">카카오맵 길찾기</a>' +
        '<a class="btn" href="' + kakaoMap + '" target="_blank" rel="noopener">카카오맵에서 보기</a>' +
        '<a class="btn" href="' + naver + '" target="_blank" rel="noopener">네이버지도 검색</a>' +
        (p.link ? '<a class="btn" href="' + esc(p.link) + '" target="_blank" rel="noopener">링크</a>' : "") +
      "</div>";

    box.hidden = false;
    $("#detailBack").onclick = closeDetail;
    $("#detailFav").onclick = function () {
      if (favs.has(p.id)) favs.delete(p.id); else favs.add(p.id);
      saveFavs(); render();
    };
    if (p.custom) $("#detailEdit").onclick = function () { openPlaceDialog(p); };
  }

  function select(id, opts) {
    opts = opts || {};
    var p = findPlace(id);
    if (!p) return;
    state.activeId = id;
    render();
    $("#detail").scrollTop = 0;
    if (isMobile()) setSheet("");
    var z = Math.max(map.getZoom(), 17);
    if (opts.fly !== false || !map.getBounds().pad(-0.15).contains([p.lat, p.lng])) {
      focusLatLng([p.lat, p.lng], z);
    }
    try { history.replaceState(null, "", "#" + id); } catch (e) { /* noop */ }
  }

  // 모바일에서는 아래 시트에 가리지 않도록 지점을 위쪽으로 올려서 보여준다
  function focusLatLng(latlng, zoom, instant) {
    var target = L.latLng(latlng);
    if (isMobile()) {
      var sheetH = $("#panel").getBoundingClientRect().height;
      var pt = map.project(target, zoom).add([0, sheetH / 2]);
      target = map.unproject(pt, zoom);
    }
    if (instant) map.setView(target, zoom, { animate: false });
    else map.flyTo(target, zoom, { duration: .6 });
  }

  function closeDetail() {
    state.activeId = null;
    $("#detail").hidden = true;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* noop */ }
    render();
  }

  /* ------------------------------------------------------------------
   * 컨트롤
   * ------------------------------------------------------------------ */
  function initControls() {
    $("#appTitle").textContent = CONFIG.title || "외대 제휴맵";
    if (CONFIG.subtitle) $("#appSubtitle").textContent = CONFIG.subtitle;

    var depts = CONFIG.departments || [];
    $("#deptSelect").innerHTML = '<option value="">선택 안 함 (모든 제휴 보기)</option>' +
      depts.filter(function (d) { return d !== ALL_DEPT; }).map(function (d) {
        return '<option value="' + esc(d) + '">' + esc(d) + "</option>";
      }).join("");
    if (state.dept && depts.indexOf(state.dept) === -1) state.dept = "";
    $("#deptSelect").value = state.dept;

    $("#searchInput").addEventListener("input", function (e) { state.q = e.target.value.trim(); render(); });
    $("#deptSelect").addEventListener("change", function (e) {
      state.dept = e.target.value; store(STORE.dept, state.dept); render();
      if (state.dept) toast(state.dept + " 제휴가 분홍색으로 강조돼요");
    });
    $("#kindSeg").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-kind]");
      if (!b) return;
      state.kind = b.dataset.kind; syncSeg(); render();
    });
    $("#categoryChips").addEventListener("click", function (e) {
      var b = e.target.closest(".chip");
      if (!b) return;
      var id = b.dataset.cat;
      var allOn = state.cats.size === CATEGORIES.length;
      // 전부 켜져 있을 때 누르면 그 업종만 보기, 그 외에는 토글
      if (allOn) state.cats = new Set([id]);
      else if (state.cats.has(id)) state.cats.delete(id);
      else state.cats.add(id);
      if (!state.cats.size) state.cats = new Set(CATEGORIES.map(function (c) { return c.id; }));
      render();
    });
    $("#sortSelect").addEventListener("change", function (e) { state.sort = e.target.value; render(); });
    $("#hideExpired").addEventListener("change", function (e) { state.hideExpired = e.target.checked; render(); });

    var list = $("#list");
    list.addEventListener("click", function (e) {
      var li = e.target.closest(".item");
      if (li) select(li.dataset.id, { fly: true });
    });
    list.addEventListener("keydown", function (e) {
      var li = e.target.closest(".item");
      if (li && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); select(li.dataset.id, { fly: true }); }
    });
    list.addEventListener("mouseover", function (e) {
      var li = e.target.closest(".item");
      if (li) hover(li.dataset.id, true);
    });
    list.addEventListener("mouseout", function (e) {
      var li = e.target.closest(".item");
      if (li && !li.contains(e.relatedTarget)) hover(li.dataset.id, false);
    });

    $("#campusBtn").onclick = function () { focusLatLng([CAMPUS.lat, CAMPUS.lng], CONFIG.zoom || 16); };
    $("#ringBtn").onclick = function () { state.rings = !state.rings; store(STORE.rings, state.rings); applyRings(); };
    $("#locateBtn").onclick = locate;

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (state.adding) stopAdding();
        else if (state.activeId && !document.querySelector("dialog[open]")) closeDetail();
      }
    });
    window.addEventListener("hashchange", fromHash);
  }

  function syncSeg() {
    Array.prototype.forEach.call(document.querySelectorAll("#kindSeg button"), function (b) {
      b.setAttribute("aria-selected", String(b.dataset.kind === state.kind));
    });
  }

  function fromHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (id && findPlace(id) && id !== state.activeId) select(id, { fly: true });
  }

  var meMarker = null;
  function locate() {
    if (!navigator.geolocation) { toast("이 브라우저는 위치 기능을 지원하지 않아요"); return; }
    toast("현재 위치를 찾는 중…");
    navigator.geolocation.getCurrentPosition(function (pos) {
      var ll = [pos.coords.latitude, pos.coords.longitude];
      if (!meMarker) {
        meMarker = L.marker(ll, { icon: L.divIcon({ className: "pin-wrap", html: '<div class="pin-me"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), keyboard: false })
          .addTo(map).bindTooltip("내 위치", { direction: "top", className: "name-tip" });
      } else meMarker.setLatLng(ll);
      focusLatLng(ll, 17);
      toast("내 위치로 이동했어요");
    }, function () {
      toast("위치 권한이 없어 내 위치를 표시할 수 없어요");
    }, { enableHighAccuracy: true, timeout: 8000 });
  }

  var toastTimer;
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2400);
  }

  /* ------------------------------------------------------------------
   * 모바일 시트
   * ------------------------------------------------------------------ */
  function setSheet(mode) {
    var panel = $("#panel");
    panel.classList.toggle("is-open", mode === "open");
    panel.classList.toggle("is-min", mode === "min");
  }
  function sheetMode() {
    var panel = $("#panel");
    return panel.classList.contains("is-open") ? "open" : panel.classList.contains("is-min") ? "min" : "";
  }
  function initSheet() {
    var handle = $("#sheetHandle"), startY = null;
    handle.addEventListener("pointerdown", function (e) { startY = e.clientY; handle.setPointerCapture(e.pointerId); });
    handle.addEventListener("pointerup", function (e) {
      if (startY === null) return;
      var dy = e.clientY - startY; startY = null;
      var m = sheetMode();
      if (Math.abs(dy) < 8) setSheet(m === "open" ? "" : "open");
      else if (dy < 0) setSheet(m === "min" ? "" : "open");
      else setSheet(m === "open" ? "" : "min");
      setTimeout(function () { map.invalidateSize(); }, 280);
    });
    $("#searchInput").addEventListener("focus", function () { if (isMobile()) setSheet("open"); });
  }

  /* ------------------------------------------------------------------
   * 업체 추가 / 수정
   * ------------------------------------------------------------------ */
  var draftMarker = null, editing = null, draftLatLng = null;

  function startAdding() {
    state.adding = true;
    closeDetailSilently();
    $(".map-wrap").classList.add("is-adding");
    $("#addHint").hidden = false;
    if (isMobile()) setSheet("min");
  }
  function stopAdding() {
    state.adding = false;
    $(".map-wrap").classList.remove("is-adding");
    $("#addHint").hidden = true;
    if (draftMarker) { draftMarker.remove(); draftMarker = null; }
  }
  function closeDetailSilently() {
    if (state.activeId) closeDetail();
  }

  map.on("click", function (e) {
    if (!state.adding) return;
    draftLatLng = e.latlng;
    if (draftMarker) draftMarker.setLatLng(e.latlng);
    else draftMarker = L.marker(e.latlng, { icon: L.divIcon({ className: "pin-wrap", html: '<div class="pin-new"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }) }).addTo(map);
    openPlaceDialog(null);
  });

  function benefitRow(b) {
    b = b || { kind: "student", text: "", until: "", departments: [] };
    var row = document.createElement("div");
    row.className = "benefit-row";
    var depts = (CONFIG.departments || []).map(function (d) {
      return '<label><input type="checkbox" value="' + esc(d) + '"' + (b.departments.indexOf(d) > -1 ? " checked" : "") + ">" + esc(d) + "</label>";
    }).join("");
    row.innerHTML =
      '<select class="b-kind" aria-label="혜택 종류"><option value="student">대학생 할인</option><option value="dept">학과 제휴</option></select>' +
      '<input class="b-text" placeholder="예: 전 메뉴 10% 할인" maxlength="60" value="' + esc(b.text) + '">' +
      '<button type="button" class="btn btn-ghost remove" aria-label="혜택 삭제">✕</button>' +
      '<label class="row-full">종료일 (비우면 상시)<input class="b-until" type="date" value="' + esc(b.until) + '"></label>' +
      '<div class="row-full depts"' + (b.kind === "dept" ? "" : " hidden") + ">" + depts + "</div>";
    row.querySelector(".b-kind").value = b.kind;
    row.querySelector(".b-kind").addEventListener("change", function (e) {
      row.querySelector(".depts").hidden = e.target.value !== "dept";
    });
    row.querySelector(".remove").onclick = function () { row.remove(); };
    return row;
  }

  function openPlaceDialog(p) {
    editing = p;
    var dlg = $("#placeDialog");
    $("#placeDialogTitle").textContent = p ? "업체 수정" : "업체 추가";
    $("#fCategory").innerHTML = CATEGORIES.map(function (c) { return '<option value="' + c.id + '">' + esc(c.label) + "</option>"; }).join("");
    $("#fName").value = p ? p.name : "";
    $("#fCategory").value = p ? p.category : "food";
    $("#fHours").value = p ? p.hours : "";
    $("#fAddress").value = p ? p.address : "";
    $("#fConditions").value = p ? p.conditions : "";
    var rows = $("#benefitRows");
    rows.innerHTML = "";
    (p && p.benefits.length ? p.benefits : [null]).forEach(function (b) { rows.appendChild(benefitRow(b)); });
    var ll = p ? { lat: p.lat, lng: p.lng } : draftLatLng;
    $("#fCoords").textContent = ll ? "위치: " + ll.lat.toFixed(5) + ", " + ll.lng.toFixed(5) : "";
    var del = $("#deletePlace");
    del.hidden = !p;
    del.textContent = "삭제";
    delete del.dataset.armed;
    dlg.showModal();
    setTimeout(function () { $("#fName").focus(); }, 30);
  }

  function initDialog() {
    $("#addBtn").onclick = function () { state.adding ? stopAdding() : startAdding(); };
    $("#addCancel").onclick = stopAdding;
    $("#addBenefitRow").onclick = function () { $("#benefitRows").appendChild(benefitRow()); };
    $("#placeCancel").onclick = function () { $("#placeDialog").close(); };
    $("#placeDialog").addEventListener("close", function () {
      if (!editing && draftMarker) { draftMarker.remove(); draftMarker = null; }
    });

    $("#placeForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var benefits = Array.prototype.map.call(document.querySelectorAll("#benefitRows .benefit-row"), function (row) {
        var kind = row.querySelector(".b-kind").value;
        return {
          kind: kind,
          text: row.querySelector(".b-text").value.trim(),
          until: row.querySelector(".b-until").value,
          departments: kind === "dept" ? Array.prototype.map.call(row.querySelectorAll(".depts input:checked"), function (i) { return i.value; }) : []
        };
      }).filter(function (b) { return b.text; });

      var ll = editing ? { lat: editing.lat, lng: editing.lng } : draftLatLng;
      if (!ll) { toast("지도에서 위치를 먼저 클릭하세요"); return; }
      var data = normalize({
        id: editing ? editing.id : "c" + Date.now().toString(36),
        name: $("#fName").value.trim(),
        category: $("#fCategory").value,
        hours: $("#fHours").value.trim(),
        address: $("#fAddress").value.trim(),
        conditions: $("#fConditions").value.trim(),
        lat: ll.lat, lng: ll.lng,
        benefits: benefits
      }, 0, true);

      if (editing) {
        customPlaces = customPlaces.map(function (p) { return p.id === data.id ? data : p; });
      } else {
        customPlaces.push(data);
      }
      saveCustom();
      var wasEditing = !!editing;
      editing = null;
      $("#placeDialog").close();
      stopAdding();
      // 새로 추가한 업체가 필터에 가려지지 않게
      state.cats.add(data.category);
      select(data.id, { fly: false });
      toast(wasEditing ? "수정했어요" : "'" + data.name + "' 을(를) 추가했어요");
    });

    $("#deletePlace").onclick = function () {
      var btn = this;
      if (!btn.dataset.armed) { btn.dataset.armed = "1"; btn.textContent = "한 번 더 누르면 삭제"; return; }
      var id = editing && editing.id;
      customPlaces = customPlaces.filter(function (p) { return p.id !== id; });
      saveCustom();
      if (markers[id]) { placeLayer.removeLayer(markers[id]); delete markers[id]; }
      editing = null;
      $("#placeDialog").close();
      closeDetail();
      toast("삭제했어요");
    };

    // 데이터 관리
    $("#dataBtn").onclick = function () {
      var c = $("#clearCustom");
      c.textContent = "내가 추가한 업체 모두 지우기 (" + customPlaces.length + ")";
      delete c.dataset.armed;
      $("#dataDialog").showModal();
    };
    $("#dataClose").onclick = function () { $("#dataDialog").close(); };
    $("#downloadJs").onclick = function () {
      var blob = new Blob([exportFile()], { type: "text/javascript;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "places.js";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    };
    $("#copyJson").onclick = function () {
      var text = JSON.stringify(exportPlaces(), null, 2);
      var done = function () { toast("JSON을 복사했어요"); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); });
      } else fallbackCopy(text);
    };
    $("#importBtn").onclick = function () {
      var arr;
      try { arr = JSON.parse($("#importText").value); } catch (e) { toast("JSON 형식이 올바르지 않아요"); return; }
      if (!Array.isArray(arr)) arr = [arr];
      var stamp = Date.now().toString(36);
      var added = arr.map(function (p, i) {
        var copy = Object.assign({}, p, { id: "c" + stamp + i });
        return normalize(copy, i, true);
      }).filter(validPlace);
      if (!added.length) { toast("가져올 업체가 없어요 (lat, lng 필요)"); return; }
      customPlaces = customPlaces.concat(added);
      saveCustom();
      $("#importText").value = "";
      $("#dataDialog").close();
      render();
      toast(added.length + "곳을 가져왔어요");
    };
    $("#clearCustom").onclick = function () {
      var btn = this;
      if (!customPlaces.length) { toast("직접 추가한 업체가 없어요"); return; }
      if (!btn.dataset.armed) { btn.dataset.armed = "1"; btn.textContent = "한 번 더 누르면 모두 삭제"; return; }
      customPlaces.forEach(function (p) { if (markers[p.id]) { placeLayer.removeLayer(markers[p.id]); delete markers[p.id]; } });
      customPlaces = [];
      saveCustom();
      $("#dataDialog").close();
      closeDetailSilently();
      render();
      toast("직접 추가한 업체를 지웠어요");
    };
  }

  function fallbackCopy(text) {
    var ta = $("#importText");
    ta.value = text;
    ta.focus();
    ta.select();
    toast("아래 칸에 JSON을 넣었어요. 직접 복사해 주세요");
  }

  function exportPlaces() {
    return allPlaces().map(function (p) {
      var o = { id: p.id, name: p.name, category: p.category, lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) };
      if (p.sample) o.sample = true;
      ["address", "hours", "phone", "link", "conditions"].forEach(function (k) { if (p[k]) o[k] = p[k]; });
      o.benefits = p.benefits.map(function (b) {
        var x = { kind: b.kind };
        if (b.kind === "dept") x.departments = b.departments;
        x.text = b.text;
        if (b.until) x.until = b.until;
        return x;
      });
      return o;
    });
  }
  function exportFile() {
    return "/*\n * 외대 제휴맵 데이터 파일 (지도 화면에서 내보냄: " + new Date().toISOString().slice(0, 10) + ")\n" +
      " * 형식 설명은 README.md 를 참고하세요.\n */\n\n" +
      "window.MAP_CONFIG = " + JSON.stringify(CONFIG, null, 2) + ";\n\n" +
      "window.PLACES = " + JSON.stringify(exportPlaces(), null, 2) + ";\n";
  }

  /* ------------------------------------------------------------------
   * 시작
   * ------------------------------------------------------------------ */
  initControls();
  initSheet();
  initDialog();
  applyRings();
  if (isMobile()) focusLatLng([CAMPUS.lat, CAMPUS.lng], CONFIG.zoom || 16, true);
  render();
  fromHash();
  window.addEventListener("resize", function () { map.invalidateSize(); });
})();
