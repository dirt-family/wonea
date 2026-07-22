/**
 * Wonea embed-widget. Site-eigenaar plaatst op de eigen pagina:
 *
 *   <script src="https://wonea.nl/widget.js" data-wonea></script>
 *
 * Het script voegt direct na de script-tag een iframe toe naar
 * {origin}/widget?bron={hostname-van-de-hostpagina}. Stateless: het iframe
 * gebruikt geen cookies. De hoogte volgt de inhoud via postMessage
 * ("wonea:resize") vanuit het iframe; de herkomst wordt gecontroleerd.
 * Kleuren hieronder zijn de bestaande Wonea-tokens (lijn, achtergrond).
 */
(function () {
  "use strict";

  function init(script) {
    if (script.getAttribute("data-wonea-init") === "1") return;
    script.setAttribute("data-wonea-init", "1");

    var src = script.getAttribute("src");
    if (!src || !script.parentNode) return;

    var origin;
    try {
      origin = new URL(src, document.baseURI).origin;
    } catch (e) {
      return;
    }

    var bron = window.location.hostname || "onbekend";

    var iframe = document.createElement("iframe");
    iframe.src = origin + "/widget?bron=" + encodeURIComponent(bron);
    iframe.title = "Wonea: wat is dit huis waard?";
    iframe.setAttribute("loading", "lazy");
    iframe.style.display = "block";
    iframe.style.width = "100%";
    iframe.style.maxWidth = "420px";
    iframe.style.height = "460px"; /* startwaarde; daarna volgt de inhoud */
    iframe.style.border = "1px solid #e5e1da";
    iframe.style.borderRadius = "14px";
    iframe.style.background = "#faf9f7";

    window.addEventListener("message", function (event) {
      if (event.origin !== origin) return;
      if (event.source !== iframe.contentWindow) return;
      var data = event.data;
      if (!data || data.type !== "wonea:resize") return;
      var hoogte = Number(data.height);
      if (!isFinite(hoogte) || hoogte < 120 || hoogte > 4000) return;
      iframe.style.height = Math.ceil(hoogte) + "px";
    });

    script.parentNode.insertBefore(iframe, script.nextSibling);
  }

  // document.currentScript dekt de normale plaatsing; de querySelectorAll-pas
  // dekt meerdere widgets op een pagina en dynamisch ingevoegde tags.
  if (document.currentScript && document.currentScript.hasAttribute("data-wonea")) {
    init(document.currentScript);
  }
  var alle = document.querySelectorAll("script[data-wonea]");
  for (var i = 0; i < alle.length; i++) init(alle[i]);
})();
