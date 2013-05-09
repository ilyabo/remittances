

$(function() {






var landColor = d3.rgb("#666666");  //1e2b32 .brighter(2)
var width = $(document).width(),
    height = $(document).height() - 40;


//$("#guide aside").css("padding-top", (height * 0.15) + "px");

var chart_svg = d3.select("#chart").append("svg")
  .attr("width", width)
  .attr("height", height);

var background = chart_svg.append("rect")
  .attr("width", width)
  .attr("height", height)
  .attr("fill", "#111");

var migrationsColor =
  // http://tristen.ca/hcl-picker/#/hlc/6/1/052021/54FDE2
  // http://tristen.ca/hcl-picker/#/hlc/6/1/052021/2F9D96
//  d3.scale.quantize()
//    .range(["#052021", "#124646", "#1F6F6C", "#2F9C94", "#40CBBB", "#54FDE2"])
  d3.scale.log()
    .range(["#2F9D96", "#052021"])
    .interpolate(d3.interpolateHcl);

var projection = d3.geo.projection(d3.geo.hammer.raw(1.75, 2))
    .rotate([-10, -45])
    .translate([width/2.3,height/2])
    .scale(180);

//var projection = d3.geo.winkel3();

var path = d3.geo.path()
    .projection(projection);

var rscale = d3.scale.sqrt()
  .range([0, height/45]);


var timelineMargins = {left:40,top:10,bottom:5,right:80};

//var timelineWidth = Math.min(width - 250, 800),
//    timelineHeight = Math.min(260, height * 0.3);
var timelineWidth = 600,
    timelineHeight = 180;


var timelineSvg = d3.select("#timeline").append("svg")
    .attr("width", timelineWidth + timelineMargins.left + timelineMargins.right);

var timeline = timelineSvg.append("g")
    .attr("class", "chart")
    .attr("transform","translate("+timelineMargins.left+","+timelineMargins.top+")");

$("#timeline svg").attr("height", (timelineHeight + timelineMargins.top + timelineMargins.bottom));


var arc = d3.geo.greatArc().precision(3) //3);
var migrationsByOriginCode = {};

var isPlural = function(v, exp) {
  var v = Math.abs(Math.round(v/exp));
  return v > 1;
}

var numberFormat = (function() {
  var fmt = d3.format(",.0f");
  return function(v) {
    if (v == null  ||  isNaN(v)) return msg("amount.not-available");
    if (isPlural(v, 1e9)) return msg("amount.billions",  fmt(v / 1e9));
    if (v >= 0.5e9) return msg("amount.billions.singular",  fmt(v / 1e9));
    if (isPlural(v, 1e6)) return msg("amount.millions",  fmt(v / 1e6));
    if (v >= 0.5e6) return msg("amount.millions.singular",  fmt(v / 1e6));
//    if (v >= 1e3) return msg("amount.thousands", fmt(v / 1e3));
    return fmt(v);
  };
})();

var moneyFormat = function(v) {
  if (v == null  ||  isNaN(v)) return msg("amount.not-available");
  return msg("money", numberFormat(v));
};

var moneyMillionsFormat = function(v) { return moneyFormat(1e6 * v); };


function str2num(str) {
  // empty string gives 0 when using + to convert
  if (str === null || str === undefined || str.length == 0) return NaN;
  return +str;
}


var migrationYears = [ 1960, 1970, 1980, 1990, 2000, 2010 ];
var remittanceYears = [
  1970,1971,1972,1973,1974,1975,1976,1977,1978,1979,1980,
  1981,1982,1983,1984,1985,1986,1987,1988,1989,1990,1991,
  1992,1993,1994,1995,1996,1997,1998,1999,2000,2001,2002,
  2003,2004,2005,2006,2007,2008,
  2009,2010,2011,2012
];  // year 2012 is an estimation

var remittanceYearsDomain = [1970, 2012];

var remittanceTotals, remittanceTotalsByMigrantsOrigin,
    remittanceTotalsPerMigrant, remittanceTotalsPerMigrantByMigrantsOrigin,
    maxRemittanceValue, maxRemittancePerMigrantValue,
    migrationTotals, migrationTotalsByOrigin,
    aidTotals, aidTotalsByRecipient;




var yearScale = d3.scale.linear()
  .domain(remittanceYearsDomain);


var tseriesScale = d3.scale.linear()
  .range([timelineHeight, 2]);

var tseriesLine = d3.svg.line()
  .interpolate("monotone")
  .defined(function(d) {
    return !isNaN(d.value)});

var yearAxis = d3.svg.axis()
  .scale(yearScale)
  .orient("top")
  .ticks(timelineWidth / 70)
  .tickSize(10, 5, timelineHeight)
  .tickSubdivide(4)
  .tickPadding(5)
  .tickFormat(function(d) { return d; });


var magnitudeAxis = d3.svg.axis()
  .scale(tseriesScale)
  .orient("right")
  .ticks(timelineHeight / 40)
  .tickSize(5, 0, 0)
  .tickPadding(2)
  .tickFormat(moneyMillionsFormat);


var selectedYear = null;
var selectedCountry = null, highlightedCountry = null;
var perMigrant = false;


var countryFeaturesByCode = {}, countryNamesByCode = {};




var yearAnimation = (function() {
  var anim = {};
  var timerId = null;
  var interval = 300;
  var playing = false;
  var yearInterval = null;

  var stop = function() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  };
  var start = function() {
    if (timerId === null) {
      timerId = setInterval(next, interval);
    }
  };
  var restart = function() {
    if (playing) start();
  }
  var years = function() {
    if (yearInterval !== null) return yearInterval;
    return remittanceYears;
  }
  var rewind = function() {
    selectYear(years()[0], interval);
    setTimeout(restart, interval * 2);
  };
  var next = function() {
    if (yearInterval !== null  &&  years().indexOf(year) < 0) {
      year = years()[0];
    }
    var year = selectedYear + 1;
    if (year > years()[years().length - 1]) {
      stop();
      setTimeout(rewind, interval * 4);
    } else {
      selectYear(year, interval);
    }
  };
  anim.years = function(years) {
    yearInterval = (years != null ? years.splice(0) : null);
    return anim;
  }
  anim.restart = function() {
    playing = true;
    rewind();
    return anim;
  }
  anim.isPlaying = function() {
    return playing;
  };
  anim.start = function() {
    playing = true;
    start();
    return anim;
  }
  anim.stop = function() {
    playing = false;
    stop();
    return anim;
  }

  anim.interval = function(msec) {
    if (arguments.length === 0) return interval;
    interval = msec;
    return anim;
  }

  return anim;
})();



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



var language = window.location.search.substr(1,3);
if (language.length == 0) language = "de";
msg.lang(language).load("js/messages.json");
var countryNameKey = "name"+(msg.lang() == "en" ? "" : "_"+msg.lang())


$(function() {
  msg.update();  // just to be sure the messages are set after the document is ready
});



var mySwiper = new Swiper('#guide',{
  //Your options here:
  mode:'horizontal'
});


function showGuide() {
  $("#guide").fadeIn();
  $("#countrySelect").fadeOut();
  $("#timeline .play").css("visibility", "hidden");
//  $("#per-capita").fadeOut();
  yearAnimation.stop();
  slideSelected();
};

$("#show-intro").click(showGuide);

function hideGuide() {
  $("#guide").fadeOut();
  $("#countrySelect").fadeIn();
  $("#color-legend").fadeIn();
//  $("#per-capita").fadeIn();
  $("#timeline .play").css("visibility", "visible");
  setPerMigrant(false);
  yearAnimation.stop();
  showAid();
};

function hideAid() {
  d3.selectAll("#timeline g.tseries .aid")
    .transition()
    .duration(300)
      .attr("opacity", "0");
}

function showAid() {
  d3.selectAll("#timeline g.tseries .aid")
    .transition()
    .duration(300)
      .attr("opacity", "1.0");
}


function slideSelected() {
  yearAnimation.stop();
  $("#guide .anim")
    .removeClass("playing")
    .text(msg("intro.animation.play"));

  switch (mySwiper.activeSlide) {
    case 0: // Massiver Anstieg in den letzten zehn Jahren
      $("#color-legend").fadeOut();
      setPerMigrant(false);
      selectCountry(null);
      selectYear(2012);
      hideAid();
    break;

    case 1: // Viermal mehr als Entwicklungshilfe
      $("#color-legend").fadeOut();
      setPerMigrant(false);
      selectCountry(null);
      selectYear(2011);
      showAid();
    break;

    case 2:  // Pro Kopf
      $("#color-legend").fadeOut();
      setPerMigrant(true);
      selectCountry(null);
      selectYear(2012);
      hideAid();
    break;

    case 3: //  Indien und China weit vorneweg
      $("#color-legend").fadeIn();
      setPerMigrant(false);
      selectCountry("IND", true);
      selectYear(2012);
      showAid();
    break;

    case 4: // Weniger Geld für Griechenland und die Türkei
      $("#color-legend").fadeIn();
      setPerMigrant(false);
      selectCountry("TUR", true);
      selectYear(2000);
      showAid();
    break;

    case 5: // Krise? Welche Krise?
      $("#color-legend").fadeOut();
      setPerMigrant(false);
      selectCountry(null);
      selectYear(2008);
      showAid();
    break;

    case 6: //  Erkunden Sie die Daten selber!
      $("#color-legend").fadeIn();
      setPerMigrant(false);
      selectCountry(null);
      selectYear(2010);
      showAid();
    break;
  }

};
var next = function() {
  mySwiper.swipeNext();
  slideSelected();
};
var prev = function() {
  mySwiper.swipePrev();
  slideSelected();
};


$("#guide .next").click(next);
$("#guide .prev").click(prev);
$("#guide .anim").click(function() {
  if ($(this).hasClass("playing")) {
    $("#guide .anim")
      .removeClass("playing")
      .text(msg("intro.animation.play"));
    yearAnimation.stop();
  } else {
    var years = $(this).data("years");
    if (years != null) years = years.split(",").map(str2num);
    $("#guide .anim")
      .addClass("playing")
      .text(msg("intro.animation.stop"));

    if ($(this).data("clicked")) {
      yearAnimation.years(years).start();
    } else {
      yearAnimation.years(years).restart();
      $(this).data("clicked", true);
    }
  }
});

$("#timeline .play").click(function() {
  if ($(this).hasClass("playing")) {
    $("#timeline .play")
      .removeClass("playing")
      .text(msg("intro.animation.play"));
    yearAnimation.stop();
  } else {
    $("#timeline .play")
      .addClass("playing")
      .text(msg("intro.animation.stop"));
    if ($(this).data("clicked")) {
      yearAnimation.start();
    } else {
      yearAnimation.restart();
      $(this).data("clicked", true);
    }
  }
});


$("body").keydown(function(e) {
  if ($("#guide").is(":visible")) {
    if (e.keyCode == 37) prev();
    else if (e.keyCode == 39) next();
  }
});


$("#guide .skip").click(hideGuide);
$("#guide .last").click(hideGuide);

$(document).keyup(function(e) { if (e.keyCode == 27) hideGuide(); });




/* @param values is an array in which the indices correspond to the
                 indices in the remittenceYears array */
function calcTotalsByYear(values) {
  var totals = {}, i, yi, countryData, y, val, max = NaN;

  for (i=0; i<values.length; i++) {
    countryData = values[i];

    for (yi=0; yi<remittanceYears.length; yi++) {
      y = remittanceYears[yi];
//      if (totals[y] === undefined) totals[y] = NaN;

      val = str2num(countryData[y]);
      if (!isNaN(val)) {
//        if (isNaN(totals[y])) totals[y] = 0;
        if (totals[y] === undefined) totals[y] = 0;
        totals[y] += val;
      }
    }
  }


//  return remittanceYears.map(function(d,i) { return { year:d, value: totals[i] } });

  return totals;
}








function initTimeSeries(name) {
  var tseries = timeline.select("g.tseries");

  if (tseries.empty()) {
    tseries = timeline.append("g")
      .attr("class", "tseries");
  }

  var path = tseries.select("path." + name);
  if (path.empty) {
    tseriesLine
      .x(function(d) { return yearScale(d.year); })
      .y(function(d) { return tseriesScale(d.value); });

    tseries.append("path")
      .attr("class", name)
      .attr("fill", "none");
  }

  if (tseries.select("g.legend").empty()) {
    var legend = tseries.append("g")
      .attr("class", "legend")
      .attr("transform",
//        "translate("+ Math.round(timelineWidth * 0.8 - 200)+ ", "+Math.round(timelineHeight*0.4) +")"
        "translate(120,10)"
      );

    var gg = legend.append("g")
       .attr("class", "remittances")
       .attr("transform", "translate(0, 10)");

    gg.append("circle")
      .attr("cx", 5)
      .attr("r", 5);
    gg.append("text")
      .attr("x", 15)
      .text(msg("details.tseries.legend.remittances"));

    gg = legend.append("g")
       .attr("class", "aid")
       .attr("transform", "translate(0, 30)");

    gg.append("circle")
      .attr("cx", 5)
      .attr("r", 5);
    gg.append("text")
      .attr("x", 15)
      .text(msg("details.tseries.legend.aid"));

  }
}

function renderTimeSeries(name, data) {
  var tseries = timeline.select("g.tseries");
  var path = tseries.select("path." + name);

  if (data == null) data = {};
  var years = remittanceYears; // d3.keys(data).sort();



  tseries.datum(years.map(function(y) { return { year:y,  value: data[y] }; }), years)
    .select("path." + name)
      .attr("d", function(d) {
        var line = tseriesLine(d);
        if (line == null) line = "M0,0";
        return line;
      });

}


/* @param originCode  If null, total is returned */
function calcPerMigrantValue(value, year, originCode) {
  var m, v = str2num(value);
  if (!isNaN(v)) {
    m = calcTotalMigrants(year, originCode);
    if (!isNaN(m)) {
      return (v / m);
    }
  }
  return NaN;
}

/* @param data        An object year -> value
 *        originCode  If null, total is returned */
function calcPerMigrantValues(data, originCode) {
  var byMigrant = {}, yi, y, m, v;
  for (yi = 0; yi < remittanceYears.length; yi++) {
    y = remittanceYears[yi];
    byMigrant[y] = calcPerMigrantValue(data[y], y, originCode);
  }
  return byMigrant;
}


function updateTimeSeries() {

  var remittances, aid;

  var country = (selectedCountry || highlightedCountry);

  if (perMigrant) {
    aid = [];
    if (country == null) {
      remittances = remittanceTotalsPerMigrant;
    } else {
      remittances = remittanceTotalsPerMigrantByMigrantsOrigin[country];
    }
    d3.select("#timeline g.tseries .legend .remittances text")
      .text(msg("details.tseries.legend.remittances.per-capita"));
  } else {
    if (country == null) {
      remittances = remittanceTotals;
      aid = aidTotals;
    } else {
      remittances = remittanceTotalsByMigrantsOrigin[country];
      aid = aidTotalsByRecipient[country];
    }
    d3.select("#timeline g.tseries .legend .remittances text")
      .text(msg("details.tseries.legend.remittances"));
  }

//  if (country == null) {
//    remittances = remittanceTotals;
//    aid = aidTotals;
//  } else {
//    remittances = remittanceTotalsByMigrantsOrigin[country];
//    aid = aidTotalsByRecipient[country];
//  }
//
//  if (perMigrant) {
//    remittances = calcPerMigrantValues(remittances, country);
//    aid = calcPerMigrantValues(aid, country);
//
//    d3.select("#timeline g.tseries .legend .remittances text")
//      .text(msg("details.tseries.legend.remittances.per-capita"));
//
//    d3.select("#timeline g.tseries .legend .aid text")
//      .text(msg("details.tseries.legend.aid.per-capita"));
//  } else {
//    d3.select("#timeline g.tseries .legend .remittances text")
//      .text(msg("details.tseries.legend.remittances"));
//
//    d3.select("#timeline g.tseries .legend .aid text")
//      .text(msg("details.tseries.legend.aid"));
//  }

  var rmax = d3.max(d3.values(remittances));
  var dmax = d3.max(d3.values(aid));

  var max;
  if (isNaN(rmax)) max = dmax;
  else if (isNaN(dmax)) max = rmax;
  else max = Math.max(rmax, dmax);

  max *= 1.15;

  tseriesScale.domain([0, max]);
  if (perMigrant) {
    d3.selectAll("#timeline g.tseries .aid")
      .attr("visibility", "hidden");
  } else {
    d3.selectAll("#timeline g.tseries .aid")
      .attr("visibility", "visible");
    renderTimeSeries("aid", aid);
  }
  renderTimeSeries("remittances", remittances);

  timeline.select("g.magnitudeAxis").call(magnitudeAxis);
}




function updateDetails() {
  var details = d3.select("#details");

  details.select(".year")
    .text(msg("details.remittances.year", selectedYear));

  var countryName, totalRemittances, numMigrants;

  if (highlightedCountry != null  ||  selectedCountry != null) {
    var iso3 = (selectedCountry || highlightedCountry);
    countryName = countryNamesByCode[iso3];

    var countryRem = remittanceTotalsByMigrantsOrigin[iso3];
    totalRemittances = (countryRem != null ? str2num(countryRem[selectedYear]) : NaN);

    numMigrants = calcTotalMigrants(selectedYear, iso3);

    var countryAid = aidTotalsByRecipient[iso3];
    totalAid = (countryAid != null ? str2num(countryAid[selectedYear]) : NaN);

    details.select(".aid .title").text(msg("details.aid.title.selected-country"));
    details.select(".migrants .title").text(msg("details.migrants.title.selected-country"));
    details.select(".remittances .title").text(msg("details.remittances.title.selected-country"));
  } else {
    countryName = msg("details.remittances.total");

    numMigrants = calcTotalMigrants(selectedYear);
    totalRemittances = remittanceTotals[selectedYear];
    totalAid = aidTotals[selectedYear];

    details.select(".aid .title").text(msg("details.aid.title.total"));
    details.select(".migrants .title").text(msg("details.migrants.title.total"));
    details.select(".remittances .title").text(msg("details.remittances.title.total"));
  }

  details.select(".migrants .value").text(numberFormat(numMigrants));
  details.select(".remittances .value").text(moneyMillionsFormat(totalRemittances));
  details.select(".aid .value").text(moneyMillionsFormat(totalAid));
  details.select(".remittancesPerCapita .value").text(moneyMillionsFormat(totalRemittances / numMigrants));
  details.select(".country").text(countryName);
}


function setPerMigrant(val) {
  perMigrant = val;
  $("#per-capita-chk").prop("checked", val);
  updateBubbleSizes();
  updateTimeSeries();
  updateCircleLegend();
}

function selectYear(year, duration) {
  var r = d3.extent(yearScale.domain());
  if (year < r[0]) year = r[0];
  if (year > r[1]) year = r[1];
  selectedYear = year;

  var t = d3.select("#visualisation")
    .transition()
      .ease("linear")
      .duration(duration);

  t.select("#timeline g.selectorHand")
    .attr("transform", "translate("+(yearScale(year))+",0)");

  updateBubbleSizes(t);
//  if (selectedCountry !== null)
  updateChoropleth();
  updateDetails();
}

function updateBubbleSizes(t) {
  if (t == undefined) {
    t = d3.select("#visualisation")
      .transition()
        .duration(300);
  }
  if (perMigrant) {
    rscale.domain([0, maxRemittancePerMigrantValue]);
  } else {
    rscale.domain([0, maxRemittanceValue]);
  }

  t.selectAll("#chart g.countries circle")
//    .attr("opacity", 1)
      .attr("r", function(d) {
        var v = d[selectedYear], r;
        if (perMigrant) {
          v = calcPerMigrantValue(v, selectedYear, d.iso3);
        }
        r = rscale(v);

        return (isNaN(r) ? 0 : r);
      });
}

function selectCountry(code, dontUnselect) {


  if (selectedCountry === code) {
    if (dontUnselect) return;
    selectedCountry = null;
  } else {
    selectedCountry = code;
  }

  $('#countrySelect input.typeahead').val(countryNamesByCode[selectedCountry]);

  updateChoropleth();
  updateDetails();
  updateTimeSeries();
}

$(document).keyup(function(e) { if (e.keyCode == 27) selectCountry(null); });
background.on("click", function() { selectCountry(null); });



function highlightCountry(code) {
  highlightedCountry = code;
  chart_svg.selectAll("path.land")
    .sort(function(a, b) {
       if (a.id === selectedCountry) return 1;
       if (b.id === selectedCountry) return -1;
       if (a.id === code) return 1;
       if (b.id === code) return -1;
      return 0;
    });
  updateChoropleth();
  updateDetails();
  updateTimeSeries();
}



/* t must be in the range [0,1] */
function interpolate(t, a, b) { return a + (b - a) * t; }


function updateChoropleth() {

  var gcountries = chart_svg.select("g.countries");

  if (selectedCountry === null  &&  highlightedCountry == null) {
    d3.select("#description").text("");
    chart_svg.selectAll("path.land")
       .classed("highlighted", false)
       .classed("selected", false)
       .transition()
          .duration(50)
            .attr("fill",landColor)
            .attr("stroke", "none");

    gcountries.selectAll("circle.country")
//       .transition()
//        .duration(50)
          .attr("opacity", 1);

  } else {

    var code = ( selectedCountry !== null ? selectedCountry : highlightedCountry);


    var migrantsFromCountry = migrationsByOriginCode[code];
    if (migrantsFromCountry === undefined) {
      console.warn("No migrations for " + code);
      migrantsFromCountry = [];
    }

    var max =
      // calc max over time for country
      d3.max(migrantsFromCountry, function(d) {
        return d3.max(migrationYears.map(function(y) { return +d[y]; }));
      });

    migrationsColor.domain([1, max]);


    var migrantsByDest = d3.nest()
      .key(function(d) { return d.Dest; })
      .rollup(function(d) { return d[0]; })
      .map(migrantsFromCountry);


    chart_svg.selectAll("path.land")
      .classed("highlighted", function(d) { return d.id === highlightedCountry; })
      .classed("selected", function(d) { return d.id === selectedCountry; })
       .transition()
        .duration(50)
      .attr("fill", function(d) {

        var m = migrantsByDest[d.id];
        if (m !== undefined) {
          var val = interpolateNumOfMigrants(m, selectedYear);
          if (!isNaN(val) /*&& (val > 0)*/) return migrationsColor(val + 1 /* for log scale to work*/);
        }

        return landColor;   //.darker(0.5);
       })

    gcountries.selectAll("circle.country")
//         .transition()
//          .duration(50)
          .attr("opacity", function(d) {
            if (d.iso3 === selectedCountry  ||
               (selectedCountry == null && d.iso3 == highlightedCountry))
              return 1;
            else
              return 0;
          });

  }

//  updateColorLegend();
}


/* @param values is a map year=>value */
function interpolateNumOfMigrants(values, year) {
  if (values == null) return NaN;
  var val = str2num(values[year]);

  if (isNaN(val)) {
    if (year >= 2011) {
	    val = str2num(values[2010]);
    }
    else if ((year % 10) !== 0) {
      // assuming we have data only for each 10th year (which ends with 0)
      var l = Math.floor(year/10)*10, r = Math.ceil(year/10)*10;
      var t = (year - l) / (r - l);
      val = interpolate(t, str2num(values[l]), str2num(values[r]));
    }
  }

  return val;
}


function getInterpolatedNumberOfMigrants(from, to, year) {
  var migs, vals;
  migs = migrationsByOriginCode[from];
  if (migs != undefined) {
    vals = migs.filter(function(d) { return d.Dest === to; })[0];
    if (vals != undefined) {
      return interpolateNumOfMigrants(vals, year);
    }
  }
  return NaN;
}


function calcTotalMigrants(year, origin) {
  if (origin != undefined)
    return interpolateNumOfMigrants(migrationTotalsByOrigin[origin], year);

  return d3.keys(migrationTotalsByOrigin).reduce(function(sum, origin) {
    var val = interpolateNumOfMigrants(migrationTotalsByOrigin[origin], year);
    if (!isNaN(val)) {
      if (isNaN(sum)) sum = 0;
      sum += val;
    }
    return sum;
  }, NaN);

}


function nestBy(uniqueProperty, data, rollup) {
  return d3.nest()
      .key(function(d) { return d[uniqueProperty]; })
      .rollup(function(arr) { return arr[0]; })
      .map(data);
}


function initCountriesTypeahead() {

  var countryNames = d3.keys(countryNamesByCode).map(function(iso3) {
    return { iso3:iso3, name:countryNamesByCode[iso3] };
  });
  var typeaheadSelect = function(event, d) {
    selectCountry(d.iso3, true);
  };

  $("#countrySelect .typeahead")
    .attr("placeholder", msg("search.country"))
    .typeahead({
      valueKey: "name",
      name: 'countries',
      local: countryNames,
      limit: 10,
    })
    .on("typeahead:selected", typeaheadSelect)
    .on("typeahead:autocompleted", typeaheadSelect);

}

function initCountryNames(remittances) {
  remittances.forEach(function(r) {
    r.centroid = projection([+r.lon, +r.lat]);
    countryNamesByCode[r.iso3] = r[countryNameKey];
  });
  countryNamesByCode.GBR = "Grossbritannien";
  countryNamesByCode.ARG = "Argentinien";
}


function calcRemittanceTotalsPerMigrantByMigrantsOrigin() {
  var result = {}, c, ci, countries = d3.keys(remittanceTotalsByMigrantsOrigin);
  for (ci = 0; ci < countries.length; ci++) {
    c = countries[ci];
    result[c] = calcPerMigrantValues(remittanceTotalsByMigrantsOrigin[c], c);
  }
  return result;
}

function showTooltip(e, html) {
  var tt = $("#tooltip"), x = (e.pageX + 10), y = (e.pageY + 10);
  tt.html(html);
  if (y -10 + tt.height() > $(window).height()) {
    y = $(window).height() - tt.height() - 20;
  }
  if (x -10 + tt.width() > $(window).width()) {
    x = $(window).width() - tt.width() - 20;
  }
  tt.css("left", x + "px")
    .css("top", y + "px")
    .css("display", "block");
}

function hideTooltip() {
  $("#tooltip")
    .text("")
    .css("display", "none");
}



function updateCircleLegend() {
  var container = d3.select("#circle-legend");
  var margin = {left:20, top:20, right:20, bottom:20};
  var maxr = rscale.range()[1];
  var w = 150 - margin.left - margin.right,
      h = maxr * 2;

  var svg, defs, g = container.select("g.circle-legend"), itemEnter;

  var entries;

  if (perMigrant) {
    entries = [0, 5000/1e6, 20000/1e6, 41000/1e6];
  } else {
    entries = [0, 10000, 30000, 71000];
  }


  if (g.empty()) {
    svg = container.append("svg")
      .attr("width", w + margin.left + margin.right)
      .attr("height", h + margin.top + margin.bottom);

    g = svg.append("g")
        .attr("class", "circle-legend")
        .attr("transform", "translate("+margin.left+","+margin.top+")");
  }


  itemEnter = g.selectAll("g.item")
    .data(entries)
   .enter()
    .append("g")
      .attr("class", "item");

  itemEnter.append("rect")
    .attr("x", maxr)
    .attr("width", 50)
    .attr("height", 1)

  itemEnter.append("circle")
    .attr("cx", maxr)
    .attr("fill", "none");

  itemEnter.append("text")
    .attr("x", maxr + 50 + 5);


  // update
  var items = g.selectAll("g.item")
    .attr("transform", function(d) { return "translate(0,"+(maxr * 2 -  2*rscale(d))+")"; });

  items.select("circle"); // propagate data update from parent
  items.selectAll("circle")
    .attr("cy",  function(d) { return rscale(d); })
    .attr("r", function(d) { return rscale(d); })

  items.select("text");  // propagate data update from parent
  items.selectAll("text")
    .text(function(d) { return moneyMillionsFormat(d)});


}



function updateColorLegend() {
  var container = d3.select("#color-legend");
  var margin = {left:40, top:30, right:20, bottom:20};
  var w = 150 - margin.left - margin.right,
      h = 60 - margin.top - margin.bottom;

  var rect, gradient;
  var svg, defs, g = container.select("g.color-legend");

  if (g.empty()) {
    svg = container.append("svg")
      .attr("width", w + margin.left + margin.right)
      .attr("height", h + margin.top + margin.bottom);
    gradient = svg.append("defs")
      .append("linearGradient")
        .attr({ id : "migrants-scale-gradient", x1 :"0%", y1 :"0%", x2 : "100%", y2:"0%" });
    gradient.append("stop")
      .attr({ offset:"0%", "stop-color": migrationsColor.range()[0] });
    gradient.append("stop")
      .attr({ offset:"100%", "stop-color": migrationsColor.range()[1] });

    g = svg.append("g")
        .attr("class", "color-legend")
        .attr("transform", "translate("+margin.left+","+margin.top+")");

    rect = g.append("rect")
      .attr({
        "class": "gradient",
        stroke : "#aaa",
        "stroke-width" : "0.3",
        width: w, height: h,
        fill: "url(#migrants-scale-gradient)"
      })


    g.append("text")
      .attr({ "class":"title", x : w/2, y : -7, "text-anchor":"middle" })
      .text(msg("legend.migrants.number"));

    g.append("text")
      .attr({ "class":"axis", x : 0, y : h + 3, "text-anchor":"middle" })
      .text(msg("legend.migrants.low"));

    g.append("text")
      .attr({ "class":"axis", x : w, y : h + 3, "text-anchor":"middle" })
      .text(msg("legend.migrants.high"));
  }

  rect = g.select("rect.gradient");
}



queue()
  .defer(d3.json, "data/world-countries.json")
  .defer(d3.csv, "data/remittances.csv")
  .defer(d3.json, "data/oecd-aid.json")  // NOTE: there are is TOTAL
  .defer(d3.csv, "data/migrations.csv") // filtered by > 100
  .defer(d3.csv, "data/migration-totals.csv") // we need to load it separately, not calculate
                                              // because migrations are filtered
  .await(function(err, world, remittances, aid, migrations, migrationTotals) {

    migrationTotals = migrationTotals.filter(function(m) {
      return ["FRO", "MNE", "NCL", "PYF", "BMU", "NGA"]
        .indexOf(m.origin) < 0;  // remove outliers, probably wrong data
    })

    $("#loading").hide();
//    yearAnimation.start();


    remittanceTotalsByMigrantsOrigin = //nestBy("iso3", remittances);
      d3.nest()
      .key(function(d) { return d.iso3; })
      .rollup(function(arr) {
          var d = arr[0], byYear = {};
          remittanceYears.forEach(function(y) {
            var v = str2num(d[y]);
            if (!isNaN(v)) byYear[y] = v;
          });
          return byYear;
       })
      .map(remittances);

    remittanceTotals = calcTotalsByYear(remittances);

    aidTotalsByRecipient = aid["by-recipient"];
    aidTotals = aid["TOTAL"];
//    aidTotals2 = calcTotalsByYear(
//      // remove TOTAL
//      d3.keys(aid).filter(function(d) { return  d!== "TOTAL"}).map(function(d) { return aid[d]; })
//    );

    migrationTotalsByOrigin = nestBy("origin", migrationTotals);

    remittanceTotalsPerMigrant = calcPerMigrantValues(remittanceTotals);
    remittanceTotalsPerMigrantByMigrantsOrigin = calcRemittanceTotalsPerMigrantByMigrantsOrigin();


//    aid = calcPerMigrantValues(aid, country);



    var leftMargin = 350; // Math.max(100, width*0.4);
    fitProjection(projection, world, [[leftMargin, 60], [width - 20, height-120]], true);




    initCountryNames(remittances);
    world.features.forEach(function(f) {
      countryFeaturesByCode[f.id] = f;
    });
    initCountriesTypeahead(remittances);





    chart_svg.append("g")
       .attr("class", "map")
      .selectAll("path")
        .data(world.features)
        .enter().append("path")
        .attr("class", "land")
        .attr("fill", landColor)
        .attr("data-code", function(d) { return d.id; })
        .attr("d", path)
        .on("click", function(d) { selectCountry(d.id); })
        .on("mouseover", function(d) { highlightCountry(d.id); })
        .on("mouseout", function(d) { highlightCountry(null); });









    var arcs = chart_svg.append("g").attr("class", "arcs");

//    migrations.forEach(function(d) {
//      d.max = d3.max(migrationYears.map(function(y) { return +d[y]; } ));
//    });
//
//    // migrations = migrations.filter(function(d) { return d.max >= 250000});
//
//    var maxMagnitude = d3.max(migrations, function(d) { return d.max; });
//
//    migrationsColor.domain([1, maxMagnitude]);


    var flows = migrations.forEach(function(flow) {
      if (migrationsByOriginCode[flow.Origin] === undefined) {
        migrationsByOriginCode[flow.Origin] = [];
      }
      migrationsByOriginCode[flow.Origin].push(flow);

    });










    var gcountries = chart_svg.append("g")
       .attr("class", "countries");






    maxRemittanceValue = d3.max(remittances, function(d) {
      return d3.max(remittanceYears.map(function(y) { return +d[y]; } ));
    });

    maxRemittancePerMigrantValue = d3.max(remittances, function(r) {
      return d3.max(remittanceYears.map(function(y) {
        return +remittanceTotalsPerMigrantByMigrantsOrigin[r.iso3][y];
      } ));
    })

    rscale.domain([0, maxRemittanceValue]);



    circles = gcountries.selectAll("circle")
        .data(remittances.filter(function(d) {
          return (d.centroid !== undefined  && d.centroid[0] !== undefined);
        }))
      .enter().append("svg:circle")
        .attr("class", "country")
        .attr("r", "0")
        .attr("cx", function(d) { if (d.centroid) return d.centroid[0] })
        .attr("cy", function(d) { if (d.centroid) return d.centroid[1] })
        .attr("opacity", 1.0)
        .on("click", function(d) { selectCountry(d.iso3); })
        .on("mouseover", function(d) { highlightCountry(d.iso3); })
        .on("mouseout", function(d) { highlightCountry(null); })

//        .append("svg:title")
//          .text(function(d) { return d.Name + ": " + moneyMillionsFormat(d[selectedYear]) + "M current US$"});






    yearScale.range([0, timelineWidth]);








//    updateBubbleSizes(0);
//    updateDetails();

//    gcountries.selectAll("circle")
//      .transition()
//        .duration(300)
//        .attr("opacity", 1)

    selectYear(2010);


    initTimeSeries("aid");
    initTimeSeries("remittances");


    var timelineAxisGroup = timeline.append("g")
      .attr("class", "timeAxis")
      .attr("transform", "translate(0,"+timelineHeight+")");

    var timelineRightAxisGroup = timeline.append("g")
      .attr("class", "magnitudeAxis")
      .attr("transform", "translate("+(timelineWidth)+",0)");

    timelineAxisGroup.call(yearAxis);
//    timelineRightAxisGroup.call(magnitudeAxis);

    updateTimeSeries();
    updateColorLegend();
    updateCircleLegend();





    var selectorHandHeight = Math.max(timelineHeight - 30, 60);

    var selectorHand = timeline.append("g")
      .attr("class", "selectorHand")
      .attr("transform", "translate("+(yearScale(selectedYear))+",0)");

    selectorHand.append("line")
      .attr("y1", timelineHeight - selectorHandHeight)
      .attr("y2", timelineHeight);


    var haloGradient = timelineSvg.append("defs")
      .append("radialGradient")
        .attr({
          id : "selectorHandHalo",
          cx : "50%", cy : "50%", r : "50%", fx : "50%", fy : "50%"
        });

    haloGradient.append("stop")
      .attr({ offset: "0%", "stop-color": "#fff", "stop-opacity": "0.0" });

    haloGradient.append("stop")
      .attr({ offset: "35%", "stop-color": "#fff", "stop-opacity": "0.05" });

    haloGradient.append("stop")
      .attr({ offset: "80%",  "stop-color": "#fff", "stop-opacity": "0.23" });

    haloGradient.append("stop")
      .attr({ offset: "100%",  "stop-color": "#fff", "stop-opacity": "0.25" });


    selectorHand.append("circle")
      .attr("class", "center")
      .attr("cx", 0)
      .attr("cy", timelineHeight - selectorHandHeight)
      .attr("r", 4);

    selectorHand.append("circle")
      .attr("class", "halo")
      .attr("opacity", "0.4")
      .attr("fill", "url(#selectorHandHalo)")
      .attr("cx", 0)
      .attr("cy", timelineHeight - selectorHandHeight)
      .attr("r", 30);








    var selectorHandDrag = d3.behavior.drag()
        .origin(Object)
        .on("drag", dragSelectorHand);

    d3.select("#timeline .selectorHand")
      .on("mouseover", function(){
         d3.select(this).select("circle.halo")
           .transition()
             .duration(250)
             .attr("opacity", "1.0");
      })
      .on("mouseout", function(){
         d3.select(this).select("circle.halo")
           .transition()
             .duration(250)
             .attr("opacity", "0.5");
      })
      .call(selectorHandDrag);


    d3.select("#timeline g.chart")
      .on("click", function() {
        var c = d3.mouse(this);
        selectYearForPosition(c[0]);
      })

    function dragSelectorHand(d) {
      var c = d3.mouse(this.parentNode);   // get mouse position relative to its container
      selectYearForPosition(c[0]);
    }

    function selectYearForPosition(cx) {
      var year = Math.round(yearScale.invert(cx));
      selectYear(year, true);
    }




    $("#per-capita-chk").click(function(d) {
      setPerMigrant($(this).is(":checked"));
    })

    slideSelected();



    $("#chart g.map path.land")
      .add("#chart g.countries circle")
      .on("mousemove", function(e) {
        var d = e.target.__data__;
        var iso3 = (d.id  ||  d.iso3);
        var vals, val, text = null;

        if (selectedCountry != null) {
          if (selectedCountry !== iso3) {
            val = getInterpolatedNumberOfMigrants(selectedCountry, iso3, selectedYear);
            text = "<b>"+countryNamesByCode[iso3]+"</b>" + (!isNaN(val) ? ": <br>" +
              msg("tooltip.migrants.number.from-a",
                numberFormat(val),
                countryNamesByCode[selectedCountry]) :
                ": " + numberFormat(val));
          }
        }

        if (text === null) {
          if (highlightedCountry != null) {
            vals = remittanceTotalsByMigrantsOrigin[highlightedCountry];
            if (vals != null) {
              val = vals[selectedYear];
              text = "<b>"+countryNamesByCode[iso3]+"</b>" +
                (!isNaN(val) ? ": <br>" +
                  msg("tooltip.remittances.amount", moneyMillionsFormat(val)) :
                  ": " + numberFormat(val));
            }
          }
        }

        if (text !== null) showTooltip(e, text);
      })
      .on("mouseout", hideTooltip)
  });


  $("#sources .info")
    .on("mouseover", function(e) {
      showTooltip(e, msg($(this).data("info")));
    })
    .on("mouseout", hideTooltip);



  $("#details").fadeIn();
  $("#circle-legend").fadeIn();
});


