// Ordenação e filtro das listas do site. Tudo em cima do DOM já renderizado —
// os dados vêm prontos do gerador, o navegador só reorganiza.

(function () {
  "use strict";

  var COMPARATORS = {
    // Data ISO compara como texto; empate (mesmo instante) cai na ordem da playlist.
    recent: function (a, b) {
      var byDate = (b.dataset.added || "").localeCompare(a.dataset.added || "");
      return byDate || num(b, "pos") - num(a, "pos");
    },
    "plays-desc": function (a, b) { return num(b, "plays") - num(a, "plays") || COMPARATORS.recent(a, b); },
    "plays-asc": function (a, b) { return num(a, "plays") - num(b, "plays") || COMPARATORS.recent(a, b); },
    "tracks-desc": function (a, b) { return num(b, "tracks") - num(a, "tracks"); }
  };

  function num(element, name) {
    return parseInt(element.dataset[name] || "0", 10);
  }

  function normalize(text) {
    return (text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  document.querySelectorAll(".sorts").forEach(function (group) {
    var container = document.querySelector(group.dataset.target);
    if (!container) return;

    group.addEventListener("click", function (event) {
      var button = event.target.closest("button");
      if (!button) return;

      var comparator = COMPARATORS[button.dataset.sort];
      var only = button.dataset.only;
      if (!comparator && !only) return;

      group.querySelectorAll("button").forEach(function (other) {
        other.classList.toggle("active", other === button);
      });

      if (comparator) {
        Array.prototype.slice.call(container.children)
          .sort(comparator)
          .forEach(function (child) { container.appendChild(child); });
        return;
      }

      // "Só os inéditos": esconde o que já esteve numa Anuária anterior.
      Array.prototype.forEach.call(container.children, function (child) {
        child.classList.toggle("is-filtered", only === "new" && child.dataset.earlier === "1");
      });
    });
  });

  document.querySelectorAll("input.filter").forEach(function (input) {
    var container = document.querySelector(input.dataset.target);
    if (!container) return;

    input.addEventListener("input", function () {
      var term = normalize(input.value.trim());
      Array.prototype.forEach.call(container.children, function (child) {
        var haystack = child.dataset.search || normalize(child.textContent);
        child.classList.toggle("is-hidden", term !== "" && haystack.indexOf(term) === -1);
      });
    });
  });
})();

// Botão "Atualizar dados": só funciona quando o site está sendo servido pelo
// serve.py (que sabe rodar o atualizar.sh). Em qualquer outro caso (arquivo
// aberto direto, ou servido por um http.server comum), a chamada falha e o
// botão explica o que fazer no terminal.
(function () {
  "use strict";

  var button = document.getElementById("refresh-button");
  if (!button) return;
  var label = button.querySelector(".refresh-label");
  var defaultLabel = label.textContent;

  function setState(text, extraClass) {
    label.textContent = text;
    button.className = "refresh-button" + (extraClass ? " " + extraClass : "");
  }

  button.addEventListener("click", function () {
    if (button.disabled) return;
    button.disabled = true;
    setState("atualizando...", "is-busy");

    fetch("/api/refresh", { method: "POST" })
      .then(function (response) {
        return response.json().then(function (payload) {
          return { ok: response.ok, payload: payload };
        });
      })
      .then(function (result) {
        if (result.ok && result.payload.ok) {
          setState("atualizado! recarregando...", "is-done");
          setTimeout(function () { window.location.reload(); }, 700);
          return;
        }
        console.error("Falha ao atualizar:", result.payload);
        setState("falhou — veja o console", "is-error");
        button.disabled = false;
      })
      .catch(function (error) {
        console.error(error);
        setState("sem servidor de atualização — rode: python3 serve.py", "is-error");
        button.disabled = false;
      });
  });
})();

// Arrastar/soltar o CSV reexportado direto na página do ano: salva, roda a
// atualização completa (fetch_covers/fetch_spotify/build_site) e recarrega.
// Mesma dependência do botão de atualizar: só funciona via serve.py.
(function () {
  "use strict";

  var section = document.getElementById("upload-playlist");
  if (!section) return;
  var zone = document.getElementById("upload-zone");
  var input = document.getElementById("upload-input");
  var year = section.dataset.year;
  var hint = zone.querySelector(".upload-hint");
  var defaultHint = hint.innerHTML;
  var busy = false;

  function setState(state, message) {
    zone.className = "upload-zone" + (state ? " is-" + state : "");
    if (message) hint.textContent = message;
    else hint.innerHTML = defaultHint;
  }

  function send(file) {
    if (busy || !file) return;
    if (!/\.csv$/i.test(file.name)) {
      setState("error", "isso não parece um .csv — exporte pelo Exportify e tente de novo.");
      return;
    }
    busy = true;
    setState("busy", "enviando...");

    fetch("/api/upload-playlist?year=" + encodeURIComponent(year), { method: "POST", body: file })
      .then(function (response) {
        return response.json().then(function (payload) {
          return { ok: response.ok, payload: payload };
        });
      })
      .then(function (result) {
        if (result.ok && result.payload.ok) {
          setState("done", "pronto! recarregando...");
          setTimeout(function () { window.location.reload(); }, 700);
          return;
        }
        console.error("Falha ao enviar a playlist:", result.payload);
        setState("error", (result.payload && result.payload.error) || "falhou — veja o console");
        busy = false;
      })
      .catch(function (error) {
        console.error(error);
        setState("error", "sem servidor de atualização — rode: python3 serve.py");
        busy = false;
      });
  }

  zone.addEventListener("click", function (event) {
    if (event.target !== input && event.target.tagName !== "LABEL") input.click();
  });
  input.addEventListener("change", function () { send(input.files[0]); input.value = ""; });

  ["dragenter", "dragover"].forEach(function (name) {
    zone.addEventListener(name, function (event) {
      event.preventDefault();
      if (!busy) zone.classList.add("is-dragover");
    });
  });
  ["dragleave", "dragend"].forEach(function (name) {
    zone.addEventListener(name, function () { zone.classList.remove("is-dragover"); });
  });
  zone.addEventListener("drop", function (event) {
    event.preventDefault();
    zone.classList.remove("is-dragover");
    send(event.dataTransfer.files[0]);
  });
})();

// Histórico: troca o período dos rankings e filtra os itens do período visível.
(function () {
  "use strict";

  var section = document.getElementById("rankings");
  if (!section) return;
  var tabs = section.querySelector(".period-tabs");
  var input = section.querySelector(".rank-filter");

  function normalize(text) {
    return (text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function applyFilter() {
    var term = normalize(input.value.trim());
    section.querySelectorAll(".top-list li").forEach(function (item) {
      item.classList.toggle("is-hidden", term !== "" && normalize(item.dataset.search).indexOf(term) === -1);
    });
  }

  tabs.addEventListener("click", function (event) {
    var button = event.target.closest("button");
    if (!button) return;
    tabs.querySelectorAll("button").forEach(function (other) {
      other.classList.toggle("active", other === button);
    });
    section.querySelectorAll(".period-pane").forEach(function (pane) {
      pane.hidden = pane.dataset.period !== button.dataset.period;
    });
  });
  input.addEventListener("input", function () {
    // Filtrando, a busca vale pro top 50 inteiro, não só pros 10 visíveis.
    section.classList.toggle("filtering", input.value.trim() !== "");
    applyFilter();
  });

  var more = section.querySelector(".rank-more");
  if (more) {
    more.addEventListener("click", function () {
      var expanded = section.classList.toggle("expanded");
      more.textContent = expanded ? "mostrar só o top 10" : "ver o top 50";
      if (!expanded) section.scrollIntoView({ block: "start" });
    });
  }

  // Capa que não carrega: some e fica o fundo do quadradinho.
  section.addEventListener("error", function (event) {
    if (event.target.tagName === "IMG") event.target.remove();
  }, true);
})();

// Histórico: um ano do calendário por vez.
(function () {
  "use strict";

  var section = document.getElementById("calendario");
  if (!section) return;
  var tabs = section.querySelector(".year-tabs");
  tabs.addEventListener("click", function (event) {
    var button = event.target.closest("button");
    if (!button) return;
    tabs.querySelectorAll("button").forEach(function (other) {
      other.classList.toggle("active", other === button);
    });
    section.querySelectorAll(".cal-pane").forEach(function (pane) {
      pane.hidden = pane.dataset.year !== button.dataset.year;
    });
    showLatest();
  });

  // No celular o ano rola de lado: começa mostrando o último dia com dado
  // (no ano atual, os meses que ainda não chegaram ficam depois dele).
  function showLatest() {
    section.querySelectorAll(".cal-pane:not([hidden]) .cal-scroll").forEach(function (box) {
      if (box.scrollWidth <= box.clientWidth) return;
      var days = box.querySelectorAll("rect:not(.c-out)");
      var last = days[days.length - 1];
      if (!last) return;
      var right = last.getBoundingClientRect().right - box.getBoundingClientRect().left + box.scrollLeft;
      box.scrollLeft = Math.max(0, right - box.clientWidth + 24);
    });
  }
  showLatest();
})();

// Histórico: marca na barra de seções a que está na tela — a última cujo
// título já passou da barra.
(function () {
  "use strict";

  var nav = document.querySelector(".chapters");
  if (!nav) return;
  var links = Array.prototype.slice.call(nav.querySelectorAll("a"));
  var sections = links.map(function (link) {
    return document.getElementById(link.getAttribute("href").slice(1));
  });
  var current = null;
  var pending = false;

  function update() {
    pending = false;
    var line = nav.getBoundingClientRect().bottom + 80;
    var index = -1;
    sections.forEach(function (section, i) {
      if (section && section.getBoundingClientRect().top <= line) index = i;
    });
    // No fim da página a última seção pode nem chegar lá em cima.
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) index = sections.length - 1;
    var active = index >= 0 ? links[index] : null;
    if (active === current) return;
    current = active;
    links.forEach(function (link) { link.classList.toggle("active", link === active); });
    if (active) nav.scrollTo({ left: active.offsetLeft - 24, behavior: "smooth" });
  }

  window.addEventListener("scroll", function () {
    if (!pending) {
      pending = true;
      window.requestAnimationFrame(update);
    }
  }, { passive: true });
  update();
})();

// "Tocar na Anuária": o Spotify toca a playlist do ano a partir da primeira
// faixa do disco. Vale pra qualquer botão .js-play (página do disco, garimpo);
// o retorno aparece no .play-status mais perto.
//   - No Mac (data-modo="mac"), quem manda tocar é o serve.py, com o login
//     guardado no .env.
//   - Na versão publicada (data-modo="publico"), cada um entra com a própria
//     conta do Spotify, direto do navegador (PKCE: sem segredo nenhum no site).
//     O app do Spotify está em modo de desenvolvimento: só toca pra contas
//     Premium cadastradas no painel; o resto ganha o link pra abrir a Anuária.
(function () {
  "use strict";

  if (location.protocol === "file:") return;
  var root = document.documentElement;
  var PUBLIC = root.dataset.modo === "publico";
  var PLAYLISTS = JSON.parse(root.dataset.playlists || "{}");
  var MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  function playlistLink(year) {
    var id = (PLAYLISTS[year] || "").split(":").pop();
    if (!id) return "";
    // No celular o esquema spotify: abre o app (inclusive de dentro do
    // "app" da tela de início); no computador, o player da web.
    return MOBILE ? "spotify:playlist:" + id : "https://open.spotify.com/playlist/" + id;
  }

  function ui(button) {
    var scope = button.closest(".album-actions, .rec-actions") || button.parentElement;
    var status = scope.querySelector(".play-status");
    var label = button.dataset.label || (button.dataset.label = button.textContent);
    return {
      say: function (text, isError) {
        if (!status) return;
        status.textContent = text || "";
        status.classList.toggle("is-error", !!isError);
      },
      sayHtml: function (markup, isError, onLogin) {
        if (!status) return;
        status.innerHTML = markup;
        status.classList.toggle("is-error", !!isError);
        var link = status.querySelector(".js-spotify-login");
        if (link && onLogin) link.addEventListener("click", function (event) {
          event.preventDefault();
          onLogin();
        });
      },
      busy: function () {
        button.classList.add("is-busy");
        button.textContent = "Tocando…";
      },
      done: function (ok) {
        button.classList.remove("is-busy");
        button.textContent = ok ? "▶ Tocando" : label;
        if (ok) setTimeout(function () { if (!button.classList.contains("is-busy")) button.textContent = label; }, 4000);
      }
    };
  }

  // ------------------------------------------------------------ no Mac --
  function playOnMac(button, view) {
    var url = "/api/tocar?year=" + encodeURIComponent(button.dataset.year) +
      "&track=" + encodeURIComponent(button.dataset.track);
    fetch(url, { method: "POST" })
      .then(function (response) { return response.json(); })
      .then(function (result) {
        view.done(result.ok);
        if (result.ok) view.say(result.opened ? "abri o Spotify neste Mac" : "");
        else view.say(result.error || "não deu pra tocar", true);
      })
      .catch(function () {
        view.done(false);
        view.say("o servidor não respondeu", true);
      });
  }

  // ---------------------------------------------- na versão publicada --
  var CLIENT_ID = root.dataset.spotify || "";
  var REDIRECT = new URL("./", location.href).href;
  var SCOPE = "user-read-playback-state user-modify-playback-state";
  var KEY = "anuarias-spotify";

  function store(name, value) {
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem(KEY + "-" + name) || "null");
      if (value === null) localStorage.removeItem(KEY + "-" + name);
      else localStorage.setItem(KEY + "-" + name, JSON.stringify(value));
    } catch (error) { return null; }
  }

  function randomText(size) {
    var bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    return base64url(bytes);
  }
  function base64url(bytes) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(bytes)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function login(pending) {
    var verifier = randomText(48);
    var state = randomText(12);
    store("login", { verifier: verifier, state: state, back: location.href, pending: pending || null });
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)).then(function (hash) {
      location.href = "https://accounts.spotify.com/authorize?" + new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: "code",
        redirect_uri: REDIRECT,
        scope: SCOPE,
        state: state,
        code_challenge_method: "S256",
        code_challenge: base64url(hash)
      });
    });
  }

  function logout() {
    store("token", null);
    renderSession();
  }

  function requestToken(params) {
    params.client_id = CLIENT_ID;
    return fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params)
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok) throw new Error(payload.error_description || payload.error || "login recusado");
        var old = store("token") || {};
        var token = {
          access: payload.access_token,
          // O Spotify às vezes devolve um refresh token novo; às vezes não.
          refresh: payload.refresh_token || old.refresh,
          expires: Date.now() + (payload.expires_in - 60) * 1000
        };
        store("token", token);
        return token.access;
      });
    });
  }

  function accessToken(force) {
    var token = store("token");
    if (!token) return Promise.resolve(null);
    if (!force && token.expires > Date.now()) return Promise.resolve(token.access);
    return requestToken({ grant_type: "refresh_token", refresh_token: token.refresh })
      .catch(function () { store("token", null); return null; });
  }

  function api(method, path, body, retried) {
    return accessToken(false).then(function (access) {
      if (!access) return { status: 401, data: null };
      return fetch("https://api.spotify.com/v1/me/player" + path, {
        method: method,
        headers: { Authorization: "Bearer " + access, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
      }).then(function (response) {
        if (response.status === 401 && !retried) {
          return accessToken(true).then(function () { return api(method, path, body, true); });
        }
        return response.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (error) { data = null; }
          return { status: response.status, data: data };
        });
      });
    });
  }

  function errorOf(result) {
    var error = (result.data && result.data.error) || {};
    return { reason: error.reason || "", message: (error.message || "").toLowerCase() };
  }

  // Devolve "ok", "no-device", ou lança um Error com a frase pro usuário.
  function startPlayback(year, track, deviceId) {
    var body = { context_uri: PLAYLISTS[year], offset: { uri: track } };
    return api("PUT", "/play" + (deviceId ? "?device_id=" + encodeURIComponent(deviceId) : ""), body)
      .then(function (result) {
        if (result.status >= 200 && result.status < 300) return "ok";
        var error = errorOf(result);
        if (result.status === 404 && !deviceId) {
          // Nada tocando agora: usa algum aparelho com o Spotify aberto.
          return api("GET", "/devices").then(function (list) {
            var devices = ((list.data || {}).devices || []).filter(function (d) { return !d.is_restricted; });
            if (!devices.length) return "no-device";
            devices.sort(function (a, b) { return (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0); });
            return startPlayback(year, track, devices[0].id);
          });
        }
        if (result.status === 404) return "no-device";
        if (result.status === 401) throw denied("login");
        if (error.reason === "PREMIUM_REQUIRED") throw denied("premium");
        if (result.status === 403) throw denied(/registered|developer/.test(error.message) ? "not-listed" : "other");
        throw new Error("o Spotify respondeu " + result.status);
      });
  }

  function denied(kind) {
    var error = new Error(kind);
    error.kind = kind;
    return error;
  }

  function openLink(year, text) {
    var link = playlistLink(year);
    return link ? '<a href="' + link + '" target="_blank" rel="noopener">' + text + "</a>" : "";
  }

  function playPublic(button, view) {
    var year = button.dataset.year;
    var track = button.dataset.track;
    if (!store("token")) {
      view.done(false);
      view.sayHtml(
        (CLIENT_ID && !store("off") ? '<a href="#" class="js-spotify-login">Entre com o Spotify</a> pra tocar aqui · ' : "") +
        openLink(year, "abrir a Anuária " + year + " no Spotify"),
        false, function () { login({ year: year, track: track }); });
      return;
    }
    view.busy();
    view.say("");
    startPlayback(year, track)
      .then(function (outcome) {
        if (outcome === "ok") {
          view.done(true);
          return;
        }
        // Nenhum Spotify aberto: abre o app na Anuária e, quando a pessoa
        // voltar pra cá, tenta de novo (o app já vai estar na lista).
        view.done(false);
        view.sayHtml("abra o Spotify (" + openLink(year, "aqui") + ") e volte pra cá que eu dou o play");
        waitForReturn(button);
        var link = playlistLink(year);
        if (link && MOBILE) location.href = link;
      })
      .catch(function (error) {
        view.done(false);
        if (error.kind === "premium") {
          view.sayHtml("o Spotify só deixa tocar daqui em contas Premium · " + openLink(year, "abrir a Anuária"), true);
        } else if (error.kind === "not-listed") {
          store("token", null);
          store("off", true);
          renderSession();
          view.sayHtml("sua conta do Spotify não está liberada neste site · " + openLink(year, "abrir a Anuária"), true);
        } else if (error.kind === "login") {
          store("token", null);
          renderSession();
          view.sayHtml('o login do Spotify expirou · <a href="#" class="js-spotify-login">entrar de novo</a>', true,
                       function () { login({ year: year, track: track }); });
        } else {
          view.sayHtml("não deu pra tocar (" + error.message + ") · " + openLink(year, "abrir a Anuária"), true);
        }
      });
  }

  var waiting = null;
  function waitForReturn(button) {
    waiting = button;
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible" || !waiting) return;
    var button = waiting;
    waiting = null;
    setTimeout(function () { play(button); }, 400);
  });

  function play(button) {
    if (button.classList.contains("is-busy")) return;
    var view = ui(button);
    if (PUBLIC) {
      playPublic(button, view);
      return;
    }
    view.busy();
    view.say("");
    playOnMac(button, view);
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest(".js-play");
    if (!button) return;
    event.preventDefault();
    play(button);
  });

  if (!PUBLIC) return;

  // Rodapé: quem está conectado, e como sair.
  function renderSession() {
    var footer = document.querySelector(".footer");
    if (!footer) return;
    var line = footer.querySelector(".spotify-session");
    if (!store("token")) {
      if (line) line.remove();
      return;
    }
    if (!line) {
      line = document.createElement("p");
      line.className = "spotify-session";
      footer.appendChild(line);
    }
    line.innerHTML = 'Spotify conectado: o "Tocar" toca na sua conta · <a href="#">sair</a>';
    line.querySelector("a").addEventListener("click", function (event) {
      event.preventDefault();
      logout();
    });
  }

  // Volta do login do Spotify (o redirect cai na página inicial): troca o
  // código pelo token, volta pra página de onde a pessoa saiu e toca o disco.
  var params = new URLSearchParams(location.search);
  var pending = store("login");
  if ((params.get("code") || params.get("error")) && pending && params.get("state") === pending.state) {
    store("login", null);
    history.replaceState(null, "", location.pathname);
    if (params.get("error")) return;
    requestToken({
      grant_type: "authorization_code",
      code: params.get("code"),
      redirect_uri: REDIRECT,
      code_verifier: pending.verifier
    }).then(function () {
      store("off", null);
      if (pending.pending) store("play-next", pending.pending);
      if (pending.back && pending.back.split("?")[0] !== location.href.split("?")[0]) location.replace(pending.back);
      else resume();
    }).catch(function (error) {
      console.error("Login do Spotify:", error);
    });
  } else {
    resume();
  }

  function resume() {
    renderSession();
    var next = store("play-next");
    if (!next) return;
    store("play-next", null);
    // Espera o garimpo.js (que vem depois deste arquivo) desenhar os botões.
    function go() {
      var button = document.querySelector('.js-play[data-year="' + next.year + '"][data-track="' + next.track + '"]');
      if (button) play(button);
      else startPlayback(next.year, next.track).catch(function () {});
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go);
    else go();
  }
})();
