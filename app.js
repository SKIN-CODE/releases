// alto의 앱 다운로드 페이지 스크립트 (index.html에서 불러옴)
(function () {
  "use strict";

  // 앱 이름과 소개. 태그 앞부분(예: altosmemo-v0.1.0 → altosmemo)으로 찾습니다.
  // 여기 있는 앱은 릴리스가 아직 없으면 「준비 중」으로 나오고, 첫 릴리스가 올라오면 다운로드 단추로 바뀝니다.
  // hidden: true인 앱은 릴리스가 있어도 이 페이지에 보이지 않습니다(릴리스·태그는 그대로 둠).
  // 여기에 없는 새 앱도 태그 규칙만 지키면 태그 앞부분을 이름으로 해서 자동으로 나옵니다.
  // color는 앱 아이콘의 대표색(밝은 화면), dark는 어두운 화면에서 읽히도록 밝힌 같은 계열 색입니다.
  var APPS = [
    { id: "altosmemo",       name: "altosMEMO",       color: "#A61237", dark: "#EE5F80",
      desc: "Windows PC와 Android에서 같은 계정으로 동기화되는 메모 앱입니다. 메모 제목과 유사어를 다른 메모 본문에서 찾아 메모끼리 이어 주는 백링크가 핵심입니다. 인터넷이 끊겨도 기기에 저장해 두었다가 연결되면 올립니다." },
    { id: "altospdf",        name: "altosPDF",        color: "#C60080", dark: "#F45CBF",
      desc: "PDF 보기, 쪽 편집(삭제·순서 바꾸기·추출·병합), 글자·형광펜 수정을 한 프로그램에 담은 Windows용 PDF 도구입니다. 설치 없이 실행 파일 하나로 쓰고, 문서를 외부로 보내지 않으며 원본은 그대로 둔 채 새 파일로 저장합니다. 탐색기에서 고른 이미지를 PDF로 만들 수도 있습니다." },
    { id: "winsnaplayout",   name: "WinSnapLayout",   color: "#0078D4", dark: "#4CA6F0",
      desc: "여러 창의 배치를 9개 슬롯에 저장해 두고 단축키 하나로 다시 불러오는 Windows 트레이 프로그램입니다. 편집기에서 모니터별로 앱을 넣고 빼면 줄과 칸을 고르게 나눠 배치합니다. ZIP을 풀어 바로 실행하며 설치가 필요 없습니다." },
    { id: "altospdf-mobile", hidden: true }   // Play 스토어로 배포하므로 이 페이지에는 싣지 않음
  ];

  var REPO = "SKIN-CODE/releases";
  // 보안: 다운로드 단추는 이 저장소의 릴리스 파일 주소일 때만 만듭니다(다른 주소로 가는 링크는 무시).
  var DL_PREFIX = "https://github.com/" + REPO + "/releases/download/";
  var TAG_RE = /^(.+)-v(\d+)\.(\d+)\.(\d+)$/;  // 앱이름-vX.Y.Z (예비판 꼬리표가 붙은 태그는 제외)
  var box = document.getElementById("apps");

  // 단추로 보여 줄 파일인지와, 한 앱에 파일이 여러 개일 때 구분할 짧은 이름을 정합니다.
  function kindOf(name) {
    var n = name.toLowerCase();
    if (/\.(sig|sha256|json|txt|blockmap)$/.test(n)) return null;      // 검증·정보 파일은 숨김
    if (/\.(nsis|msi)\.zip$/.test(n)) return null;                     // Tauri 자동 업데이트용 묶음은 숨김
    if (n.endsWith(".apk")) return "Android";
    if (n.endsWith(".msi")) return "Windows .msi";
    if (n.endsWith(".exe")) return "Windows";
    if (n.endsWith(".zip")) return "ZIP";
    if (n.endsWith(".dmg")) return "macOS";
    return "파일";
  }

  function usable(a) {
    return kindOf(a.name) && typeof a.browser_download_url === "string" &&
           a.browser_download_url.indexOf(DL_PREFIX) === 0;
  }

  function sizeText(bytes) {
    if (!bytes) return "";
    var mb = bytes / 1048576;
    return mb >= 1 ? mb.toFixed(mb >= 10 ? 0 : 1) + " MB" : Math.max(1, Math.round(bytes / 1024)) + " KB";
  }

  function newer(a, b) {
    for (var i = 0; i < 3; i++) if (a.v[i] !== b.v[i]) return a.v[i] > b.v[i];
    return false;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function fail() {
    box.innerHTML = "";
    var p = el("p", "status", "최신판 목록을 지금 불러오지 못했습니다. 잠시 뒤 다시 열거나 ");
    var a = el("a", null, "GitHub 배포 목록");
    a.href = "https://github.com/" + REPO + "/releases";
    p.appendChild(a);
    p.appendChild(document.createTextNode("에서 직접 받아 주세요."));
    box.appendChild(p);
  }

  async function loadReleases() {
    var all = [];
    for (var page = 1; page <= 10; page++) {
      var res = await fetch("https://api.github.com/repos/" + REPO + "/releases?per_page=100&page=" + page,
                            { headers: { Accept: "application/vnd.github+json" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var list = await res.json();
      all = all.concat(list);
      if (list.length < 100) break;
    }
    return all;
  }

  function render(releases) {
    var latest = {};
    releases.forEach(function (r) {
      if (r.draft || r.prerelease) return;
      var m = TAG_RE.exec(r.tag_name || "");
      if (!m) return;
      var item = { id: m[1], v: [+m[2], +m[3], +m[4]], r: r };
      var files = (r.assets || []).filter(usable);
      if (!files.length) return;
      if (!latest[item.id] || newer(item, latest[item.id])) latest[item.id] = item;
    });

    var known = APPS.map(function (a) { return a.id; });
    var ids = APPS.filter(function (a) { return !a.hidden; }).map(function (a) { return a.id; })
      .concat(Object.keys(latest).filter(function (id) { return known.indexOf(id) < 0; }).sort());

    box.innerHTML = "";
    if (!ids.length) { fail(); return; }

    ids.forEach(function (id) {
      var info = APPS.filter(function (a) { return a.id === id; })[0] || { name: id, desc: "" };
      var it = latest[id];
      var card = el("section", "app");
      var h = el("h2", null, info.name);
      if (info.color) h.style.setProperty("--app-color", info.color);
      if (info.dark) h.style.setProperty("--app-color-dark", info.dark);
      if (it) h.appendChild(el("span", "ver", "v" + it.v.join(".")));
      card.appendChild(h);
      if (info.desc) card.appendChild(el("p", null, info.desc));
      var links = el("div", "links");
      if (!it) {
        links.appendChild(el("span", "soon", "준비 중"));
        card.appendChild(links);
        box.appendChild(card);
        return;
      }
      var msg = el("p", "dl-msg");
      msg.setAttribute("role", "status");
      var files = it.r.assets.filter(usable);
      files.forEach(function (a) {
        // 단추 이름은 「다운로드 (용량)」. 한 앱에 파일이 둘 이상이면 무엇인지(Windows·Android 등)를 앞에 붙입니다.
        var label = (files.length > 1 ? kindOf(a.name) + " " : "") + "다운로드";
        var link = el("a", null, label);
        link.href = a.browser_download_url;
        link.title = a.name;
        link.appendChild(el("small", null, "(" + sizeText(a.size) + ")"));
        // 내려받기는 브라우저가 조용히 시작하므로, 누른 것을 알 수 있게 단추 아래에 안내를 띄웁니다.
        link.addEventListener("click", function () {
          msg.textContent = "";
          msg.appendChild(el("strong", null, a.name + " (" + sizeText(a.size) + ")"));
          msg.appendChild(document.createTextNode(
            " 내려받기를 시작했습니다. 크기에 따라 몇 초에서 몇 분 걸립니다. " +
            "진행 상황은 브라우저의 다운로드 목록에서 볼 수 있습니다(Windows는 Ctrl+J). " +
            "저장할 곳을 직접 고르려면 단추를 마우스 오른쪽으로 눌러 「다른 이름으로 링크 저장」을 고르세요."));
          // 받은 파일이 올린 파일과 같은지 확인할 수 있도록 GitHub가 계산한 SHA-256을 함께 보여 줍니다.
          var m = /^sha256:([0-9a-f]{64})$/.exec(a.digest || "");
          if (m) msg.appendChild(el("span", "hash", "SHA-256: " + m[1]));
          msg.classList.add("show");
        });
        links.appendChild(link);
      });
      card.appendChild(links);
      card.appendChild(msg);
      box.appendChild(card);
    });
  }

  loadReleases().then(render).catch(fail);
})();

(function () {
  "use strict";

  // 요구사항 보내기: 개발자의 Google 설문지 「alto의 App에 의견 보내기」로 바로 보냅니다(서버 없음).
  // 설문지 질문을 바꾸면 entry 번호와 앱 선택지(위 체크박스 value)를 설문지와 똑같이 맞춰야 합니다.
  // 답장 받을 이메일은 설문지에 따로 질문이 없어서, 적은 경우 의견 끝에 붙여 보냅니다.
  var FORM = {
    action: "https://docs.google.com/forms/d/e/1FAIpQLSdb0eD7PL-BMx1nm0_X65dcJrjxanjL27ouYUPXHl91AYl2eg/formResponse",
    view:   "https://docs.google.com/forms/d/e/1FAIpQLSdb0eD7PL-BMx1nm0_X65dcJrjxanjL27ouYUPXHl91AYl2eg/viewform",
    app:  "entry.1654047421",   // 앱을 골라 주세요. (체크박스, 필수)
    body: "entry.1407611722"    // 의견을 자유롭게 적어 주세요. (장문형, 필수)
  };
  if (!FORM.action || !FORM.app || !FORM.body) return;

  var form = document.getElementById("fb-form");
  var result = document.getElementById("fb-result");
  var send = document.getElementById("fb-send");
  document.getElementById("fb-soon").hidden = true;
  form.hidden = false;

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var apps = [].slice.call(form.querySelectorAll('input[name="fb-app"]:checked')).map(function (c) { return c.value; });
    var body = document.getElementById("fb-body").value.trim();
    var email = document.getElementById("fb-email").value.trim();
    if (!apps.length) { result.textContent = "앱을 하나 이상 골라 주세요."; return; }
    if (!body) { result.textContent = "요구사항을 적어 주세요."; return; }
    if (document.getElementById("fb-trap").value) { result.textContent = "보냈습니다. 고맙습니다."; form.reset(); return; }

    var data = new URLSearchParams();
    apps.forEach(function (a) { data.append(FORM.app, a); });
    data.append(FORM.body, email ? body + "\n\n[답장 받을 이메일] " + email : body);

    send.disabled = true;
    result.textContent = "보내는 중입니다…";
    fetch(FORM.action, { method: "POST", mode: "no-cors", body: data })
      .then(function () {
        result.textContent = "보냈습니다. 고맙습니다.";
        form.reset();
      })
      .catch(function () {
        result.textContent = "보내지 못했습니다. 잠시 뒤 다시 시도하거나 위 연락처로 보내 주세요.";
        if (FORM.view) {
          var a = document.createElement("a");
          a.href = FORM.view; a.target = "_blank"; a.rel = "noopener";
          a.textContent = " 설문지에서 직접 보내기";
          result.appendChild(a);
        }
      })
      .then(function () { send.disabled = false; });
  });
})();
