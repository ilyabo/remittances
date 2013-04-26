// Init Intro/Tour/Guide Slider
$(function() {
	var mySwiper = new Swiper('#guide',{
		//Your options here:
		mode:'horizontal'
	});

  $("#guide .next").click(function() { mySwiper.swipeNext(); })

  var hideGuide = function() {
    $("#guide").fadeOut();
    $("#details").fadeIn();
  };

  $("#guide .skip").click(hideGuide);
  $("#guide .last").click(hideGuide);

  $(document).keyup(function(e) { if (e.keyCode == 27) hideGuide(); });

});

// (function() {




var landColor = d3.rgb("#666666");  //1e2b32 .brighter(2)
var width = $(document).width(),
    height = $(document).height() - 40;


var chart_svg = d3.select("#chart").append("svg")
  .attr("width", width)
  .attr("height", height);

var background = chart_svg.append("rect")
  .attr("width", width)
  .attr("height", height)
  .attr("fill", "#111");

var timelineWidth = Math.min(width - 50, 800),
    timelineHeight = Math.min(300, height * 0.2);

$("#timeline").css("height", timelineHeight);

var migrationsColor =
  // http://tristen.ca/hcl-picker/#/hlc/6/1/052021/54FDE2
  //  d3.scale.quantize()
  //    .range(["#052021", "#124646", "#1F6F6C", "#2F9C94", "#40CBBB", "#54FDE2"]);
  d3.scale.linear()
    .range(["#052021", "#54FDE2"])
    .interpolate(d3.interpolateHcl);

var projection = d3.geo.projection(d3.geo.hammer.raw(1.75, 2))
    .rotate([-10, -45])
    .translate([width/2.3,height/2])
    .scale(180);

//var projection = d3.geo.winkel3();

var path = d3.geo.path()
    .projection(projection);

var rscale = d3.scale.sqrt()
  .range([0, 25]);


var timeline_pad_horiz = 20;
var timeline = d3.select("#timeline")
    //.style("height", timelineHeight)
  .append("svg")
    .attr("width", timelineWidth + timeline_pad_horiz * 2);

var arc = d3.geo.greatArc().precision(3) //3);
var migrationsByOriginCode = {};
var magnitudeFormat = d3.format(",.0f");



var migrationYears = [ 1960, 1970, 1980, 1990, 2000];
var remittanceYears = [
  1970,1971,1972,1973,1974,1975,1976,1977,1978,1979,1980,
  1981,1982,1983,1984,1985,1986,1987,1988,1989,1990,1991,
  1992,1993,1994,1995,1996,1997,1998,1999,2000,2001,2002,
  2003,2004,2005,2006,2007,2008,
  2009,2010,2011,2012
];  // year 2012 is an estimation

var remittanceYearsDomain = [1970, 2012];

var remittanceTotals = null;

var remittancesMagnitudeFormat = d3.format(",.1f");


var year_scale = d3.scale.linear()
  .domain(remittanceYearsDomain);


var remittance_tseries_scale = d3.scale.linear()
  .range([timelineHeight, 2]);

var remittance_tseries_line = d3.svg.line()
  .interpolate("monotone");


var selectedYear = null;
var selectedCountry = null, highlightedCountry = null;


var countryCentroidsByCode = {};
var countryFeaturesByName = {}, countryFeaturesByCode = {};

var countCommas = 0;

function calcRemittanceTotalsByYear(remittances) {
  var totals = [], i, yi, countryData, y, val, max = NaN;

  for (i=0; i<remittances.length; i++) {
    countryData = remittances[i];

    for (yi=0; yi<remittanceYears.length; yi++) {
      y = remittanceYears[yi];
      if (totals[yi] === undefined) totals[yi] = 0;

      if (countryData[y].indexOf(",") >= 0) {
        countCommas++;
      }

      val = +countryData[y];
      if (!isNaN(val)) {
        totals[yi] += val;
      }
    }
  }

  return totals;
}


function updateBubbleSizes(no_animation) {

  var c = d3.selectAll("#chart g.countries circle")
  if (!no_animation)
     c = c.transition()
      .duration(100)

  c.attr("r", function(d) {
    var r = rscale(d[selectedYear]);
    return (isNaN(r) ? 0 : r);
  })
}






function renderTimeSeries(remittances, remittanceTotals) {

  var timeline = d3.select("#timeline svg");

  var g = timeline.select("g.tseries");
  if (g.empty()) {
    g = timeline.append("g")
      .attr("class", "tseries");

    remittance_tseries_scale.domain([0, d3.max(remittanceTotals)]);

    remittance_tseries_line
      .x(function(d, i) {
        return year_scale(remittanceYears[i]); })
      .y(function(d) { return remittance_tseries_scale(d); });

    g.append("path")
      .attr("class", "remittances")
      .attr("fill", "none");
  }

  g.datum(remittanceTotals)
    .select("path.remittances")
      .attr("d", remittance_tseries_line);

}



function updateDetails() {
  var details = d3.select("#details");

  details.select(".year")
    .text("im Jahr " + selectedYear);

  var totalRemittances = remittanceTotals[remittanceYears.indexOf(selectedYear)];

  details.select(".remittances")
    .text("$" + remittancesMagnitudeFormat(totalRemittances / 1000)+" Milliarden");

  details.select(".country").text(
    highlightedCountry !== null ? countryFeaturesByCode[highlightedCountry].properties.name : "Gesamt"
  );
}



function selectYear(year, no_animation) {
  var r = d3.extent(year_scale.domain());
  if (year < r[0]) year = r[0];
  if (year > r[1]) year = r[1];
  selectedYear = year;
  timeline.select("g.selectorHand")
//        .transition()
//        .duration(4)
      .attr("transform", "translate("+(year_scale(year))+",0)");
  updateBubbleSizes(no_animation);
  updateChoropleth();
  updateDetails();
}

function selectCountry(code) {
  if (selectedCountry === code) {
    selectedCountry = null;
  } else {
    selectedCountry = code;
    chart_svg.selectAll("path.land")
      .sort(function(a, b) {
         if (a.id === code) return 1;
         if (b.id === code) return -1;
        return 0;
      });
  }
  updateChoropleth();
  updateDetails();
}

$(document).keyup(function(e) { if (e.keyCode == 27) selectCountry(null); });
background.on("click", function() { selectCountry(null); });



function highlightCountry(code) {
  highlightedCountry = code;
  updateChoropleth();
  updateDetails();
}


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
       .transition()
        .duration(50)
          .attr("opacity", 1);

  } else {

    var code = ( selectedCountry !== null ? selectedCountry : highlightedCountry);


    var migs = migrationsByOriginCode[code];
    if (migs === undefined) {
      console.log("No migrations for " + code);
    } else {
//
//              d3.select("#description")
//                  .html("In "+selectedYear+ " schickten migranten <br> aus <b>" + d.Name + "</b>" +
//                    " US$"  + remittancesMagnitudeFormat(d[selectedYear]) + "M<br>nach Hause"
//                      );

      var migrantsFromCountry = migrationsByOriginCode[code];
      var max =
        // calc max over time for country
        d3.max(migrantsFromCountry, function(d) {
          return d3.max(migrationYears.map(function(y) { return +d[y]; }));
        });

      migrationsColor.domain([0, max]);


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
          var val = (m !== undefined ? val = +m[selectedYear] : NaN);

          if (!isNaN(val))
            return migrationsColor(val);
          else
            return landColor;   //.darker(0.5);
         })

      gcountries.selectAll("circle.country")
         .transition()
          .duration(50)
            .attr("opacity", 0);
      }

  }
}










queue()
  .defer(d3.csv, "data/country-centroids.csv")
  .defer(d3.json, "data/world-countries.json")
  .defer(d3.csv, "data/migration-1K-plus.csv")
  .defer(d3.csv, "data/countries-iso2to3.csv")
  .defer(d3.csv, "data/remittances.csv")
  .await(function(err, countryCentroids, world, migrations, isocodes, remittances) {

    remittanceTotals = calcRemittanceTotalsByYear(remittances);




    var leftMargin = Math.max(120, width*0.2);
    fitProjection(projection, world, [[leftMargin, 60], [width - 25, height-120]], true);




    countryCentroids.forEach(function(d) {
      countryCentroidsByCode[d.Code] = [+d.lon, +d.lat];
    });

    var f;
    for (var d in world.features) {
      f = world.features[d];

      f.centroid = countryCentroidsByCode[f.id];
      if (f.centroid !== undefined)
        f.centroidp = projection(f.centroid);

      countryFeaturesByName[f.properties.name] = f;
      countryFeaturesByCode[f.id] = f;
    }



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

    migrations.forEach(function(d) {
      d.max = d3.max(migrationYears.map(function(y) { return +d[y]; } ));
    });

    // migrations = migrations.filter(function(d) { return d.max >= 250000});

    var maxMagnitude = d3.max(migrations, function(d) { return d.max; });

    migrationsColor.domain([1, maxMagnitude]);


    var links = [];


    var flows = migrations.forEach(function(flow) {
      var o = countryFeaturesByCode[flow.Origin], co;
      var d = countryFeaturesByCode[flow.Dest], cd;

      if (migrationsByOriginCode[flow.Origin] === undefined) {
        migrationsByOriginCode[flow.Origin] = [];
      }
      migrationsByOriginCode[flow.Origin].push(flow);

    });










    var gcountries = chart_svg.append("g")
       .attr("class", "countries");

    var iso2To3 = {};
    var countryNameToIso3 = {};


    isocodes.forEach(function(d) {
      iso2To3[d.iso2] = d.iso3;
      countryNameToIso3[d.name] = d.iso3;
    });

    function getIso3(remittance) {
      var iso3 = iso2To3[remittance.iso2];
      if (iso3 === undefined) {

        iso3 = countryNameToIso3[remittance.Name];
        if (iso3 === undefined) {
          console.log("Could not find flows for code: " + d.iso2 + ", name: " + d.Name);
        }
      }

      return iso3;
    }



    var name, r;

    remittances.forEach(function(r) {
      f = countryFeaturesByName[r.Name];
      if (f) {
        r.centroid = f.centroidp;
      }

      for (i in remittanceYears) {
        y = remittanceYears[i];
        if (r[y] !== undefined)
          r[y] = +r[y].replace(",","")
      }
    });


    var max = d3.max(remittances, function(d) {
      return d3.max(remittanceYears.map(function(y) { return +d[y]; } ));
    });


    rscale.domain([0, max]);



    circles = gcountries.selectAll("circle")
        .data(remittances.filter(function(d) {
          return (d.centroid !== undefined  && d.centroid[0] !== undefined);
        }))
      .enter().append("svg:circle")
        .attr("class", "country")
        .attr("cx", function(d) { if (d.centroid) return d.centroid[0] })
        .attr("cy", function(d) { if (d.centroid) return d.centroid[1] })
        .attr("opacity", 0)
        .on("click", function(d) { selectCountry(getIso3(d)); })
        .on("mouseover", function(d) { highlightCountry(getIso3(d)); })
        .on("mouseout", function(d) { highlightCountry(null); })

//        .append("svg:title")
//          .text(function(d) { return d.Name + ": " + remittancesMagnitudeFormat(d[selectedYear]) + "M current US$"});






    year_scale.range ([timeline_pad_horiz, timelineWidth + timeline_pad_horiz]);



    var selector_hand = timeline.append("g")
      .attr("class", "selectorHand")
      .attr("transform", "translate("+(year_scale(selectedYear))+",0)");

    selector_hand.append("line")
      .attr("y1", 7)
      .attr("y2", timelineHeight);

    selector_hand.append("circle")
      .attr("cx", 0)
      .attr("cy", 5)
      .attr("r", 4)


    var year_axis = d3.svg.axis()
      .scale(year_scale)
      .orient("top")
      .ticks(timelineWidth / 70)
      .tickSize(10, 5, timelineHeight)
      .tickSubdivide(4)
      .tickPadding(15)
      .tickFormat(function(d) { return d; });









    selectYear(2000);

    updateBubbleSizes(true);

    gcountries.selectAll("circle")
      .transition()
        .duration(300)
        .attr("opacity", 1)

    renderTimeSeries(remittances, remittanceTotals, null);

    timeline_axis_group = timeline.append("g")
      .attr("class", "timeline_axis")
      .attr("transform", "translate(0,"+timelineHeight+")");

    timeline_axis_group.call(year_axis);

    $("#timeline").mousedown(function(){
      $(this).css("cursor","ew-resize");
      return false;
    });

    var selectYearOnDragOrClick = function(event) {
      if (d3.event.which > 0) {
          // any mouse button pressed (will always be true in firefox :( )
        var c = d3.mouse(this);

        var year = Math.round(year_scale.invert(c[0]));
        selectYear(year, true);
      }
    };
    timeline_axis_group
      .on("mousedown", selectYearOnDragOrClick)
      .on("mousemove", selectYearOnDragOrClick);


});


// })();