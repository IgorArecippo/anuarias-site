// Me recomenda um disco (garimpo.html): o disco do dia, o que combina com o
// que anda tocando, e a busca com filtros. Os dados vêm embutidos na página
// (recommend.py); tudo aqui roda no navegador.
(function () {
  "use strict";

  var source = document.getElementById("garimpo-data");
  if (!source) return;
  var DATA = JSON.parse(source.textContent);
  var ALBUMS = DATA.albums;
  var BY_SLUG = {};
  ALBUMS.forEach(function (album) { BY_SLUG[album.s] = album; });
  var FAMILY = {};
  DATA.families.forEach(function (pair) { FAMILY[pair[0]] = pair[1]; });
  var VIBE = {};
  DATA.vibes.forEach(function (pair) { VIBE[pair[0]] = pair[1]; });

  var PAGE_SIZE = 48;
  var MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto",
    "setembro", "outubro", "novembro", "dezembro"];
  var WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

  // ---------------------------------------------------------------- util --
  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function normalize(text) {
    return String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  function number(value) { return Number(value || 0).toLocaleString("pt-BR"); }
  function href(slug) { return "disco-" + slug + ".html"; }
  function accent(year) { return DATA.accents[String(year)] || "#5B4B8A"; }
  function textOn(color) {
    // Mesma regra do build_site.contrast_text: laranja/mostarda pedem texto escuro.
    return color === "#E8622A" || color === "#D6A536" ? "#241A30" : "#F3E9D8";
  }
  function isoToday() {
    var now = new Date();
    return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" +
      String(now.getDate()).padStart(2, "0");
  }
  function daysAgo(iso, base) {
    if (!iso) return Infinity;
    return Math.round((Date.parse(base) - Date.parse(iso)) / 86400000);
  }
  // Número pseudo-aleatório estável a partir de um texto (o dia, por exemplo).
  function seeded(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      return ((h >>> 0) % 100000) / 100000;
    };
  }
  function shuffle(list, random) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    }
    return copy;
  }
  function cover(url, extra) {
    return url ? '<img src="' + esc(url) + '" alt="" loading="lazy"' + (extra || "") + ">" : "";
  }
  function yearChip(year) {
    var color = accent(year);
    return '<a class="dig-year" href="ano-' + year + '.html" style="background:' + color + ";color:" + textOn(color) +
      '">Anuária ' + year + "</a>";
  }
  function playButton(album) {
    if (!album.py || !album.pt) return "";
    return '<a class="btn-play js-play" href="#" data-year="' + album.py + '" data-track="' + esc(album.pt) +
      '" data-album="' + esc(album.u || "") + '" style="background:' + accent(album.py) + ";color:" +
      textOn(accent(album.py)) + '">\u25b6\ufe0e Play</a>';
  }
  function vinyl(album) {
    return '<div class="vinyl" aria-hidden="true"><div class="vinyl-label">' + cover(album.i) + "</div></div>";
  }
  function lastHeard(album) {
    var days = daysAgo(album.l, DATA.today);
    if (!album.l) return "nunca tocou no seu histórico";
    if (days < 1) return "ouvido hoje";
    if (days < 60) return "ouvido há " + days + " dias";
    if (days < 730) return "ouvido há " + Math.round(days / 30) + " meses";
    return "sem ouvir há " + Math.round(days / 365) + " anos";
  }

  // ------------------------------------------------------ disco do dia --
  // Escolhido pela data: o mesmo o dia todo, outro amanhã. Só entre os que
  // têm capa e não tocaram nos últimos 60 dias — recomendação é redescoberta.
  var todayIso = isoToday();
  var pool = ALBUMS.filter(function (album) { return album.i && daysAgo(album.l, DATA.today) > 60; });
  if (pool.length < 20) pool = ALBUMS.filter(function (album) { return album.i; });
  var dayOrder = shuffle(pool, seeded("disco-do-dia " + todayIso));
  var dayIndex = 0;

  function renderToday(animate) {
    var album = dayOrder[dayIndex % dayOrder.length];
    var box = document.getElementById("dig-today");
    var date = new Date(todayIso + "T12:00:00");
    var label = dayIndex === 0
      ? "O disco de hoje · " + WEEKDAYS[date.getDay()] + ", " + date.getDate() + " de " + MONTHS[date.getMonth()]
      : "Outra sugestão pra hoje";
    var tags = album.v.map(function (id) { return '<li>' + esc(VIBE[id]) + "</li>"; }).join("") +
      album.gn.slice(0, 2).map(function (genre) { return '<li class="genre">' + esc(genre) + "</li>"; }).join("");
    box.innerHTML =
      '<div class="today-bg" style="background-image:url(\'' + esc(album.i) + '\')"></div>' +
      '<div class="today-inner' + (animate ? " is-new" : "") + '">' +
      '<a class="sleeve" href="' + href(album.s) + '">' + vinyl(album) +
      '<div class="sleeve-cover">' + cover(album.i) + "</div></a>" +
      '<div class="today-body">' +
      '<p class="eyebrow">' + esc(label) + "</p>" +
      '<h2><a href="' + href(album.s) + '">' + esc(album.a) + "</a></h2>" +
      '<p class="today-artist">' + esc(album.r) + (album.d ? ' <span>· ' + album.d + "</span>" : "") + "</p>" +
      '<div class="today-chips">' + album.y.map(yearChip).join("") + "</div>" +
      (tags ? '<ul class="badges">' + tags + "</ul>" : "") +
      (album.t ? '<blockquote class="today-fact">' + esc(album.t) + "</blockquote>" : "") +
      '<p class="today-stats">' + (album.p ? "<b>" + number(album.p) + "</b> execuções no seu histórico · " : "") +
      esc(lastHeard(album)) + "</p>" +
      '<div class="album-actions">' + playButton(album) +
      '<a class="btn-ghost" href="' + href(album.s) + '">Ver o disco</a>' +
      '<button type="button" class="btn-ghost" id="today-next">Outro ↻</button>' +
      '<span class="play-status" role="status"></span></div>' +
      "</div></div>";
    document.getElementById("today-next").addEventListener("click", function () {
      dayIndex += 1;
      renderToday(true);
    });
  }

  // Caixote do topo: cinco capas do dia, cada uma leva ao disco.
  function renderCrate() {
    var box = document.getElementById("dig-crate");
    if (!box) return;
    box.innerHTML = dayOrder.slice(1, 6).map(function (album, index) {
      return '<a href="' + href(album.s) + '" style="--i:' + index + '" title="' + esc(album.a + " — " + album.r) + '" tabindex="-1">' +
        cover(album.i) + "</a>";
    }).join("");
  }

  // -------------------------------------------- pelo que você tem ouvido --
  function renderRecent() {
    var box = document.getElementById("dig-recent");
    var recent = DATA.recent || {};
    var items = (recent.items || []).filter(function (item) { return BY_SLUG[item.s]; });
    if (!items.length) { box.hidden = true; return; }
    var anchors = (recent.anchors || []).map(function (anchor) {
      return '<a class="anchor" href="' + href(anchor.s) + '" title="' + esc(anchor.a + " — " + anchor.r) + ": " +
        anchor.plays + ' execuções">' + cover(anchor.i) + "</a>";
    }).join("");
    var cards = items.map(function (item, index) {
      var album = BY_SLUG[item.s];
      return '<article class="rec-card" style="--i:' + index + '">' +
        '<a class="rec-cover" href="' + href(album.s) + '">' + cover(album.i) + "</a>" +
        '<div class="rec-body"><p class="rec-because">porque você tem ouvido <b>' + esc(item.because) + "</b></p>" +
        '<h3><a href="' + href(album.s) + '">' + esc(album.a) + "</a></h3>" +
        '<p class="artist">' + esc(album.r) + "</p>" +
        '<p class="rec-meta">' + esc(lastHeard(album)) + "</p>" +
        '<div class="rec-actions">' + playButton(album) + '<span class="play-status" role="status"></span></div>' +
        "</div></article>";
    }).join("");
    box.innerHTML =
      '<div class="block-head"><h2>Pelo que você tem ouvido</h2>' +
      '<div class="anchors"><span>nos últimos 30 dias</span>' + anchors + "</div>" +
      '<p class="lead">Discos das Anuárias que combinam — em gênero e em vibe — com o que mais tocou ' +
      "no último mês, e que você não ouve há um tempo.</p></div>" +
      '<div class="rec-row">' + cards + "</div>";
  }

  // ------------------------------------------------------- garimpar --
  var state = { q: "", ano: [], genero: [], estilo: [], vibe: [], decada: [], escuta: [], ordem: "embaralhado", shown: PAGE_SIZE };
  var showStyles = false;

  // "Mais gêneros": os gêneros em si (shoegaze, tecnobrega...), dos que
  // aparecem em pelo menos 4 discos, do mais comum pro menos.
  var styleCount = {};
  ALBUMS.forEach(function (album) { album.gn.forEach(function (genre) { styleCount[genre] = (styleCount[genre] || 0) + 1; }); });
  var STYLES = Object.keys(styleCount).filter(function (genre) { return styleCount[genre] >= 4; })
    .sort(function (a, b) { return styleCount[b] - styleCount[a] || a.localeCompare(b); })
    .map(function (genre) { return [genre, genre]; });
  var GROUPS = [
    { key: "ano", title: "Anuária", options: DATA.years.slice().reverse().map(function (year) { return [String(year), String(year)]; }) },
    { key: "genero", title: "Gênero", options: DATA.families },
    { key: "estilo", title: "Mais gêneros", options: STYLES, more: true },
    { key: "vibe", title: "Vibe", options: DATA.vibes },
    { key: "decada", title: "Lançamento", options: decades() },
    { key: "escuta", title: "Sua escuta", options: [["esquecidos", "esquecidos há mais de 1 ano"], ["raridades", "pouco ouvidos"],
      ["xodos", "xodós"], ["recentes", "tocando agora"]] }
  ];

  function decades() {
    var found = {};
    ALBUMS.forEach(function (album) { if (album.d) found[Math.floor(album.d / 10) * 10] = true; });
    return Object.keys(found).sort().reverse().map(function (decade) {
      return [decade, decade < 2000 ? "anos " + String(decade).slice(2) : decade + "s"];
    });
  }

  // "Xodós": os 10% mais ouvidos do acervo; "pouco ouvidos": os 15% menos.
  var plays = ALBUMS.map(function (album) { return album.p; }).sort(function (a, b) { return b - a; });
  var XODO_MIN = plays[Math.floor(plays.length / 10)] || 1;
  var RARE_MAX = plays[Math.floor(plays.length * .85)] || 0;

  var SEARCH = {};
  ALBUMS.forEach(function (album) {
    SEARCH[album.s] = normalize([album.a, album.r, album.gn.join(" "), album.y.join(" "), album.d,
      album.g.map(function (id) { return FAMILY[id]; }).join(" "),
      album.v.map(function (id) { return VIBE[id]; }).join(" ")].join(" "));
  });

  function listening(album, kind) {
    var days = daysAgo(album.l, DATA.today);
    if (kind === "esquecidos") return days > 365;
    if (kind === "raridades") return album.p <= RARE_MAX;
    if (kind === "xodos") return album.p >= XODO_MIN;
    if (kind === "recentes") return days <= 30;
    return true;
  }

  // Teste de cada grupo contra uma lista de opções marcadas. Dentro de um
  // grupo vale qualquer uma (2019 ou 2020; brasileira ou pop) — menos na
  // vibe, que refina: "dançante" + "melancólico" é o disco que é as duas.
  var TESTS = {
    ano: function (album, picked) { return album.y.some(function (year) { return picked.indexOf(String(year)) !== -1; }); },
    genero: function (album, picked) { return album.g.some(function (id) { return picked.indexOf(id) !== -1; }); },
    estilo: function (album, picked) { return album.gn.some(function (genre) { return picked.indexOf(genre) !== -1; }); },
    vibe: function (album, picked) { return picked.every(function (id) { return album.v.indexOf(id) !== -1; }); },
    decada: function (album, picked) { return !!album.d && picked.indexOf(String(Math.floor(album.d / 10) * 10)) !== -1; },
    escuta: function (album, picked) { return picked.some(function (kind) { return listening(album, kind); }); }
  };

  function matchesQuery(album) {
    if (!state.q) return true;
    var text = SEARCH[album.s];
    var words = normalize(state.q).split(/\s+/).filter(Boolean);
    for (var i = 0; i < words.length; i++) if (text.indexOf(words[i]) === -1) return false;
    return true;
  }

  // Passa em todos os grupos; "override" troca as opções de um grupo (pra
  // contar quantos discos cada botão daria).
  function matches(album, overrideGroup, overrideList) {
    if (!matchesQuery(album)) return false;
    for (var key in TESTS) {
      var picked = key === overrideGroup ? overrideList : state[key];
      if (picked.length && !TESTS[key](album, picked)) return false;
    }
    return true;
  }

  // A ordem embaralhada é a mesma o dia todo (a página não "pula" a cada
  // visita); o botão "embaralhar" sorteia outra na hora.
  var mixes = 0;
  var shuffled = shuffle(ALBUMS, seeded("garimpo " + todayIso));
  var ORDERS = {
    embaralhado: null,
    mais: function (a, b) { return b.p - a.p; },
    menos: function (a, b) { return a.p - b.p; },
    novos: function (a, b) { return (b.d || 0) - (a.d || 0); },
    velhos: function (a, b) { return (a.d || 9999) - (b.d || 9999); },
    saudade: function (a, b) { return (a.l || "9") < (b.l || "9") ? -1 : (a.l || "9") > (b.l || "9") ? 1 : 0; },
    anuaria: function (a, b) { return Math.max.apply(null, b.y) - Math.max.apply(null, a.y); }
  };

  // Com busca e ordem "embaralhado", vem primeiro o que bate no título,
  // depois no artista, depois o resto (gênero, vibe, ano).
  function relevance(album) {
    var q = normalize(state.q);
    var title = normalize(album.a), artist = normalize(album.r);
    if (title === q || title.indexOf(q) === 0) return 0;
    if (title.indexOf(q) !== -1) return 1;
    if (artist === q || artist.indexOf(q) === 0) return 2;
    if (artist.indexOf(q) !== -1) return 3;
    return 4;
  }

  function results() {
    var list = shuffled.filter(function (album) { return matches(album); });
    var order = ORDERS[state.ordem];
    if (order) return list.slice().sort(order);
    if (state.q) return list.slice().sort(function (a, b) { return relevance(a) - relevance(b); });
    return list;
  }

  // Quantos discos o botão daria, com o resto dos filtros como está.
  function countFor(key, value) {
    var current = state[key];
    var next = current.indexOf(value) !== -1 ? current : current.concat([value]);
    if (key !== "vibe" && current.length && current.indexOf(value) === -1) next = [value];
    var total = 0;
    for (var i = 0; i < ALBUMS.length; i++) if (matches(ALBUMS[i], key, next)) total++;
    return total;
  }

  function card(album, index) {
    var vibes = album.v.slice(0, 2).map(function (id) { return "<li>" + esc(VIBE[id]) + "</li>"; }).join("");
    var main = album.y[album.y.length - 1];
    return '<article class="dig-card" style="--year-accent:' + accent(main) + ";--year-ink:" + textOn(accent(main)) + ";--i:" + (index % PAGE_SIZE) + '" data-slug="' + esc(album.s) + '">' +
      '<a class="dig-card-link" href="' + href(album.s) + '">' +
      '<div class="dig-cover">' + cover(album.i) + '<span class="dig-tag">' + main + "</span></div>" +
      "<h3>" + esc(album.a) + "</h3><p>" + esc(album.r) + (album.d ? " · " + album.d : "") + "</p>" +
      (vibes ? '<ul class="dig-vibes">' + vibes + "</ul>" : "") +
      '<span class="dig-plays">' + (album.p ? number(album.p) + " execuções" : "sem execuções") + "</span></a></article>";
  }

  function chips() {
    var open = showStyles || state.estilo.length;
    return GROUPS.map(function (group) {
      if (group.more && !open) return "";
      var hint = group.key === "vibe" && state.vibe.length ? '<small>todas juntas</small>' : "";
      var toggle = group.key === "genero"
        ? '<button type="button" class="dig-more-toggle" aria-expanded="' + !!open + '">' +
          (open ? "menos gêneros ▴" : "mais gêneros (" + STYLES.length + ") ▾") + "</button>"
        : "";
      return '<div class="dig-group' + (group.more ? " dig-group-more" : "") + '"><span class="dig-group-title">' + group.title + hint + "</span>" +
        group.options.map(function (option) {
          var on = state[group.key].indexOf(option[0]) !== -1;
          var count = countFor(group.key, option[0]);
          var style = group.key === "ano" ? ' style="--chip:' + accent(option[0]) + '"' : "";
          return '<button type="button" class="chip' + (on ? " active" : "") + (!on && !count ? " is-empty" : "") +
            '" data-group="' + group.key + '" data-value="' + esc(option[0]) + '"' + style + ' aria-pressed="' + on + '"' +
            (!on && !count ? " disabled" : "") + ">" + esc(option[1]) + '<span class="chip-count">' + count + "</span></button>";
        }).join("") + toggle + "</div>";
    }).join("");
  }

  function activeCount() {
    return (state.q ? 1 : 0) + state.ano.length + state.genero.length + state.estilo.length + state.vibe.length + state.decada.length + state.escuta.length;
  }

  function render() {
    document.getElementById("dig-filters").innerHTML = chips();
    var list = results();
    var grid = document.getElementById("dig-grid");
    grid.innerHTML = list.length
      ? list.slice(0, state.shown).map(card).join("")
      : '<p class="dig-empty">Nada com essa combinação. Tente tirar um filtro — ou <button type="button" id="dig-empty-dice">deixe o acaso escolher</button>.</p>';
    document.getElementById("dig-count").innerHTML = "<b>" + number(list.length) + "</b> " +
      (list.length === 1 ? "disco" : "discos") + (activeCount() ? " com esses filtros" : " nas Anuárias");
    document.getElementById("dig-clear").hidden = !activeCount();
    var more = document.getElementById("dig-more");
    more.hidden = list.length <= state.shown;
    more.textContent = "mostrar mais (" + number(list.length - state.shown) + ")";
    var empty = document.getElementById("dig-empty-dice");
    if (empty) empty.addEventListener("click", function () { clearFilters(); surprise(); });
    saveUrl();
  }

  // Filtros na URL: dá pra salvar ou mandar o link de uma busca.
  function saveUrl() {
    var params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    ["ano", "genero", "estilo", "vibe", "decada", "escuta"].forEach(function (key) {
      if (state[key].length) params.set(key, state[key].join(","));
    });
    if (state.ordem !== "embaralhado") params.set("ordem", state.ordem);
    var query = params.toString();
    history.replaceState(null, "", location.pathname + (query ? "?" + query : "") + location.hash);
  }
  function loadUrl() {
    var params = new URLSearchParams(location.search);
    state.q = params.get("q") || "";
    ["ano", "genero", "estilo", "vibe", "decada", "escuta"].forEach(function (key) {
      state[key] = (params.get(key) || "").split(",").filter(Boolean);
    });
    state.ordem = ORDERS.hasOwnProperty(params.get("ordem")) ? params.get("ordem") : "embaralhado";
    document.getElementById("dig-q").value = state.q;
    document.getElementById("dig-order").value = state.ordem;
  }
  function clearFilters() {
    state.q = ""; state.ano = []; state.genero = []; state.estilo = []; state.vibe = []; state.decada = []; state.escuta = [];
    state.shown = PAGE_SIZE;
    document.getElementById("dig-q").value = "";
    render();
  }

  // -------------------------------------------------- surpreenda-me --
  // Sorteia entre os resultados dos filtros atuais (ou o acervo todo).
  function surprise() {
    var list = results();
    if (!list.length) list = ALBUMS;
    var album = list[Math.floor(Math.random() * list.length)];
    var box = document.getElementById("dig-spotlight");
    box.innerHTML =
      '<div class="spot-card" role="dialog" aria-modal="true" aria-label="Sugestão">' +
      '<button type="button" class="spot-close" aria-label="Fechar">×</button>' +
      '<div class="spot-disc">' + vinyl(album) + '<div class="sleeve-cover">' + cover(album.i) + "</div></div>" +
      '<p class="eyebrow">' + (activeCount() ? "Entre os " + number(list.length) + " do seu filtro" : "Do acervo inteiro") + "</p>" +
      "<h2>" + esc(album.a) + "</h2>" +
      '<p class="today-artist">' + esc(album.r) + (album.d ? " <span>· " + album.d + "</span>" : "") + "</p>" +
      '<div class="today-chips">' + album.y.map(yearChip).join("") + "</div>" +
      '<p class="today-stats">' + esc(lastHeard(album)) + "</p>" +
      '<div class="album-actions">' + playButton(album) + '<a class="btn-ghost" href="' + href(album.s) + '">Ver o disco</a>' +
      '<button type="button" class="btn-ghost spot-again">De novo ↻</button><span class="play-status" role="status"></span></div>' +
      "</div>";
    box.hidden = false;
    document.body.classList.add("has-spotlight");
    box.querySelector(".spot-again").addEventListener("click", surprise);
    box.querySelector(".spot-close").focus();
  }
  function closeSpotlight() {
    var box = document.getElementById("dig-spotlight");
    box.hidden = true;
    box.innerHTML = "";
    document.body.classList.remove("has-spotlight");
  }

  // ------------------------------------------------------------ eventos --
  var typing;
  document.getElementById("dig-q").addEventListener("input", function (event) {
    clearTimeout(typing);
    typing = setTimeout(function () {
      state.q = event.target.value.trim();
      state.shown = PAGE_SIZE;
      render();
    }, 120);
  });
  document.getElementById("dig-q").addEventListener("keydown", function (event) {
    if (event.key === "Enter") document.getElementById("garimpar").scrollIntoView({ behavior: "smooth" });
  });
  document.getElementById("dig-order").addEventListener("change", function (event) {
    state.ordem = event.target.value;
    render();
  });
  document.getElementById("dig-reshuffle").addEventListener("click", function () {
    mixes += 1;
    shuffled = shuffle(ALBUMS, seeded("garimpo " + todayIso + " " + mixes + " " + Math.random()));
    state.ordem = "embaralhado";
    document.getElementById("dig-order").value = "embaralhado";
    state.shown = PAGE_SIZE;
    render();
  });
  document.getElementById("dig-filters").addEventListener("click", function (event) {
    if (event.target.closest(".dig-more-toggle")) {
      showStyles = !(showStyles || state.estilo.length);
      if (!showStyles) state.estilo = [];
      render();
      return;
    }
    var chip = event.target.closest(".chip");
    if (!chip) return;
    var list = state[chip.dataset.group];
    var at = list.indexOf(chip.dataset.value);
    if (at === -1) list.push(chip.dataset.value); else list.splice(at, 1);
    state.shown = PAGE_SIZE;
    render();
  });
  document.getElementById("dig-clear").addEventListener("click", clearFilters);
  document.getElementById("dig-more").addEventListener("click", function () {
    state.shown += PAGE_SIZE;
    render();
  });
  document.getElementById("dig-surprise").addEventListener("click", surprise);
  document.querySelector(".dig-quick").addEventListener("click", function (event) {
    var link = event.target.closest("a[data-quick]");
    if (!link) return;
    event.preventDefault();
    clearFilters();
    var pair = link.dataset.quick.split("=");
    state[pair[0]] = [pair[1]];
    render();
    document.getElementById("garimpar").scrollIntoView({ behavior: "smooth" });
  });
  document.getElementById("dig-spotlight").addEventListener("click", function (event) {
    if (event.target.id === "dig-spotlight" || event.target.closest(".spot-close")) closeSpotlight();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !document.getElementById("dig-spotlight").hidden) closeSpotlight();
    if (event.key === "/" && document.activeElement.tagName !== "INPUT") {
      event.preventDefault();
      document.getElementById("dig-q").focus();
    }
  });
  // Capa que não carrega some e fica o fundo.
  document.querySelector(".garimpo").addEventListener("error", function (event) {
    if (event.target.tagName === "IMG") event.target.remove();
  }, true);

  loadUrl();
  renderToday(false);
  renderCrate();
  renderRecent();
  render();
})();
