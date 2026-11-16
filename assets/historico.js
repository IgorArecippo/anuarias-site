// Página de histórico: os rankings e o calendário são montados aqui, a partir
// dos dados embutidos na página (build_site.py: rankings_section e
// calendar_section). Só o período e o ano abertos viram HTML — prontos de
// antemão eram 15 períodos de 150 itens e 13 anos de quadradinhos.

// Rankings: troca o período e filtra os itens do período visível.
(function () {
  "use strict";

  var section = document.getElementById("rankings");
  var source = document.getElementById("rankings-data");
  if (!section || !source) return;
  var DATA = JSON.parse(source.textContent);
  var tabs = section.querySelector(".period-tabs");
  var input = section.querySelector(".rank-filter");
  var pane = section.querySelector(".period-pane");
  var COLUMNS = [["albums", "Discos"], ["artists", "Artistas"], ["tracks", "Faixas"]];

  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function normalize(text) {
    return (text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  function number(value) { return Number(value || 0).toLocaleString("pt-BR"); }

  // A capa aparece com 36px: pede ao Last.fm a versão pequena, não a de 300.
  function cover(url) {
    if (!url) return '<span class="cover cover-xs"></span>';
    if (url.indexOf("http") !== 0) url = DATA.images + url;
    url = url.replace(/\/i\/u\/[^\/]+\//, "/i/u/64s/");
    return '<span class="cover cover-xs"><img src="' + esc(url) + '" loading="lazy" alt=""></span>';
  }

  // Mini gráfico de linha das execuções por ano.
  function spark(values) {
    if (!values.length) return "";
    var width = 72, height = 20;
    var peak = Math.max.apply(null, values) || 1;
    var step = width / Math.max(1, values.length - 1);
    var points = values.map(function (value, index) {
      return Math.round(index * step) + "," + (height - 2 - (value / peak) * (height - 4)).toFixed(1);
    }).join(" ");
    return '<svg class="spark" viewBox="0 0 ' + width + " " + height + '" aria-hidden="true"><polyline points="' + points + '"/></svg>';
  }

  // item: [título, subtítulo, execuções, capa, página do disco, linha por ano]
  function row(item, kind) {
    var search = kind === "artists" ? item[0] : item[1] + " " + item[0];
    var inner = cover(item[3]) + '<span class="top-text"><strong>' + esc(item[0]) + "</strong><em>" + esc(item[1]) +
      "</em></span>" + spark(item[5]) + "<b>" + number(item[2]) + "</b>";
    var body = item[4] ? '<a href="disco-' + esc(item[4]) + '.html">' + inner + "</a>" : "<div>" + inner + "</div>";
    return '<li data-search="' + esc(normalize(search)) + '">' + body + "</li>";
  }

  function applyFilter() {
    var term = normalize(input.value.trim());
    pane.querySelectorAll(".top-list li").forEach(function (item) {
      item.classList.toggle("is-hidden", term !== "" && item.dataset.search.indexOf(term) === -1);
    });
  }

  function show(period) {
    var data = DATA.periods[period];
    if (!data) return;
    pane.innerHTML = COLUMNS.map(function (column) {
      return '<div class="panel top-col"><h3>' + column[1] + '</h3><ol class="top-list">' +
        data[column[0]].map(function (item) { return row(item, column[0]); }).join("") + "</ol></div>";
    }).join("");
    applyFilter();
  }

  tabs.addEventListener("click", function (event) {
    var button = event.target.closest("button");
    if (!button) return;
    tabs.querySelectorAll("button").forEach(function (other) {
      other.classList.toggle("active", other === button);
    });
    show(button.dataset.period);
  });
  input.addEventListener("input", function () {
    // Filtrando, a busca vale pro top 50 inteiro, não só pros 10 visíveis.
    section.classList.toggle("filtering", input.value.trim() !== "");
    applyFilter();
  });

  var more = section.querySelector(".rank-more");
  more.addEventListener("click", function () {
    var expanded = section.classList.toggle("expanded");
    more.textContent = expanded ? "mostrar só o top 10" : "ver o top 50";
    if (!expanded) section.scrollIntoView({ block: "start" });
  });

  // Capa que não carrega: some e fica o fundo do quadradinho.
  section.addEventListener("error", function (event) {
    if (event.target.tagName === "IMG") event.target.remove();
  }, true);

  show(tabs.querySelector("button.active").dataset.period);
})();

// Calendário: um ano por vez, uma coluna por semana, segunda no topo.
(function () {
  "use strict";

  var section = document.getElementById("calendario");
  var source = document.getElementById("calendario-data");
  if (!section || !source) return;
  var DATA = JSON.parse(source.textContent);
  var tabs = section.querySelector(".year-tabs");
  var box = section.querySelector(".cal-scroll");
  var caption = section.querySelector(".chart-caption");
  var MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  var CELL = 11, GAP = 3;

  function iso(date) { return date.toISOString().slice(0, 10); }

  function draw(year) {
    var counts = DATA.days[year] || [];
    var start = new Date(Date.UTC(year, 0, 1));
    var offset = (start.getUTCDay() + 6) % 7;  // segunda = 0
    var rects = [], labels = [];
    counts.forEach(function (value, index) {
      var day = new Date(Date.UTC(year, 0, 1 + index));
      var slot = index + offset;
      var x = Math.floor(slot / 7) * (CELL + GAP);
      var y = (slot % 7) * (CELL + GAP) + 14;
      var date = iso(day);
      if (day.getUTCDate() === 1) labels.push('<text x="' + x + '" y="9">' + MONTHS[day.getUTCMonth()] + "</text>");
      if (date < DATA.first || date > DATA.last) {
        rects.push('<rect x="' + x + '" y="' + y + '" class="c-out"/>');
        return;
      }
      var level = DATA.levels.filter(function (threshold) { return value >= threshold; }).length;
      rects.push('<rect x="' + x + '" y="' + y + '" class="c' + level + '"><title>' + day.getUTCDate() + " " +
        MONTHS[day.getUTCMonth()] + " " + year + " · " +
        (value ? value.toLocaleString("pt-BR") + " execuções" : "nada") + "</title></rect>");
    });
    var weeks = Math.floor((counts.length - 1) / 7) + 2;
    var width = weeks * (CELL + GAP) - GAP;
    var height = 7 * (CELL + GAP) + 14 - GAP;
    box.innerHTML = '<svg class="cal" viewBox="0 0 ' + width + " " + height + '">' + labels.join("") + rects.join("") + "</svg>";
    caption.innerHTML = DATA.captions[year] || "";
    showLatest();
  }

  // No celular o ano rola de lado: começa mostrando o último dia com dado
  // (no ano atual, os meses que ainda não chegaram ficam depois dele).
  function showLatest() {
    if (box.scrollWidth <= box.clientWidth) return;
    var days = box.querySelectorAll("rect:not(.c-out)");
    var last = days[days.length - 1];
    if (!last) return;
    var right = last.getBoundingClientRect().right - box.getBoundingClientRect().left + box.scrollLeft;
    box.scrollLeft = Math.max(0, right - box.clientWidth + 24);
  }

  tabs.addEventListener("click", function (event) {
    var button = event.target.closest("button");
    if (!button) return;
    tabs.querySelectorAll("button").forEach(function (other) {
      other.classList.toggle("active", other === button);
    });
    draw(button.dataset.year);
  });

  draw(tabs.querySelector("button.active").dataset.year);
})();

// Descobertas: no celular, com mais anos do que cabem, o gráfico rola de
// lado — começa mostrando os mais recentes.
(function () {
  "use strict";
  var box = document.querySelector(".discoveries");
  if (box) box.scrollLeft = box.scrollWidth;
})();
