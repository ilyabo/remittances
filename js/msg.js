var msg = (function() {
  if (!String.prototype.format) {
    String.prototype.format = function() {
      var args = arguments;
      return this.replace(/{(\d+)}/g, function(match, number) {
        return typeof args[number] != 'undefined'
          ? args[number]
          : match
        ;
      });
    };
  }

  var messages = null, lang = null;
  var getter = function(id) {
    if (messages !== null) {
      var m = messages[lang][id];
      if (m !== undefined  &&  arguments.length > 1) {
        return m.format.apply(m, Array.prototype.slice.call(arguments).splice(1));
      }
      return m;
    }
  };

  var update = function() {
    if (messages !== null) {
      $("[data-msg]").each(function() {
        $(this).html(getter($(this).data("msg")));
      });
    }
  };

  getter.load = function(url) {
    $.getJSON(url, function(data) {
      messages = data; update(); });
    return getter;
  };
  getter.update = update;
  getter.lang = function(code) {
    if (code === undefined) {
      return lang;
    } else {
      lang = code; update();
      return getter;
    }
  };

  return getter;
})();

(function() {  // start loading right away
  var language = window.location.search.substr(1,2);
  if (language.length == 0) language = "de";
  msg.lang(language)
    .load("js/messages.json");   // will also update when loaded
})();

$(function() {   // update again when document ready
  msg.update();  // to be sure all the messages within the document are set
});
