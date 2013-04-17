(function() {

var landColor = d3.rgb("#666666");  //1e2b32 .brighter(2)
var width = $(document).width() - 40,
    height = $(document).height() - 40;


var svg = d3.select("body").append("svg")
  .attr("width", width)
  .attr("height", height);


var projection = d3.geo.projection(d3.geo.hammer.raw(1.75, 2))
    .rotate([-10, -45])
    .translate([width/2.3,height/2])
    .scale(180);

//var projection = d3.geo.winkel3();

var path = d3.geo.path()
    .projection(projection);




var migrationYears = [ /*"1960",*/ "1970", "1980", "1990", "2000"];
var remittanceYears = [
  "1970","1971","1972","1973","1974","1975","1976","1977","1978","1979","1980",
  "1981","1982","1983","1984","1985","1986","1987","1988","1989","1990","1991",
  "1992","1993","1994","1995","1996","1997","1998","1999","2000","2001","2002",
  "2003","2004","2005","2006","2007","2008",
  "2009","2010","2011","2012e"
];


var selectedYear = "2000";







var countryCentroidsByCode = {};


queue()
  .defer(d3.csv, "data/country-centroids.csv")
  .defer(d3.json, "data/world-countries.json")
  .defer(d3.csv, "data/migration-1K-plus.csv")
  .defer(d3.csv, "data/countries-iso2to3.csv")
  .defer(d3.csv, "data/RemittancesData_Inflows_Nov12.csv")
  .await(function(err, countryCentroids, world, migrations, isocodes, remittances) {

    fitProjection(projection, world, [[20,30], [width-40, height-60]], true);


    countryCentroids.forEach(function(d) {
      countryCentroidsByCode[d.Code] = [+d.lon, +d.lat];
    });

    var featuresByName = {}, featuresByCode = {}, f;
    for (var d in world.features) {
      f = world.features[d];

      f.centroid = countryCentroidsByCode[f.id];
      if (f.centroid !== undefined)
        f.centroidp = projection(f.centroid);

      featuresByName[f.properties.name] = f;
      featuresByCode[f.id] = f;
    }




    svg.append("g")
       .attr("class", "map")
      .selectAll("path")
        .data(world.features)
        .enter().append("path")
        .attr("class", "land")
        .attr("fill", landColor)
        .attr("data-code", function(d) { return d.id; })
        .attr("d", path);






     var migrationsColor = d3.scale.log()
       .range(["#221C03", "#E9D35A"])
       .interpolate(d3.interpolateHcl);





    var arc = d3.geo.greatArc().precision(3) //3);
    var arcs = svg.append("g").attr("class", "arcs");
    var minPathWidth = 1, maxPathWidth = 30;

    var migrationsByOriginCode = {};



    var magnitudeFormat = d3.format(",.0f");

    migrations.forEach(function(d) {
      d.max = d3.max(migrationYears.map(function(y) { return +d[y]; } ));
    });

    // migrations = migrations.filter(function(d) { return d.max >= 250000});

    var maxMagnitude = d3.max(migrations, function(d) { return d.max; });

    migrationsColor.domain([1, maxMagnitude]);


    var links = [];


    var flows = migrations.forEach(function(flow) {
      var o = featuresByCode[flow.Origin], co;
      var d = featuresByCode[flow.Dest], cd;

      if (migrationsByOriginCode[flow.Origin] === undefined) {
        migrationsByOriginCode[flow.Origin] = [];
      }
      migrationsByOriginCode[flow.Origin].push(flow);

    });










    var gcountries = svg.append("g")
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
      f = featuresByName[r.Name];
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


    var rscale = d3.scale.sqrt()
      .range([0, 25])
      .domain([0, max])


    var remittancesMagnitudeFormat = d3.format(",.0f");

    circles = gcountries.selectAll("circle")
        .data(remittances.filter(function(d) {
          return (d.centroid !== undefined  && d.centroid[0] !== undefined);
        }))
      .enter().append("svg:circle")
        .attr("class", "country")
        .attr("cx", function(d) { if (d.centroid) return d.centroid[0] })
        .attr("cy", function(d) { if (d.centroid) return d.centroid[1] })
        .attr("opacity", 0)
        .on("mouseover", function(d) {
          var selectedIso3 = getIso3(d);
          if (selectedIso3 !== undefined) {
            var migs = migrationsByOriginCode[selectedIso3];
            if (migs === undefined) {
              console.log("No migrations for " + selectedIso3);
            } else {

              d3.select("#details")
                  .html("Migrants from <b>" + d.Name + "</b><br>" +
                    "sent home US$"  + remittancesMagnitudeFormat(d[selectedYear]) + "M" +
                    "<br> in " + selectedYear );

              migrationsByOriginCode[selectedIso3].forEach(function(m) {
                var land = svg.selectAll("path.land").filter(function(l) { return l.id == m.Dest; });
                land
                 .transition()
                    .duration(200)
                      .attr("fill", function(d) {
                        var val = +m[selectedYear];
                        if (!isNaN(val))
                          return migrationsColor(val);
                        else
                          return landColor.darker(0.5);
                       })
              });

              svg.selectAll("path.land").filter(function(l) { return l.id == selectedIso3; })
                 .transition()
                  .duration(200)
                     .attr("stroke", "red");

              gcountries.selectAll("circle.country")
                 .transition()
                  .duration(200)
                    .attr("opacity", 0);
            }


          }
        })
        .on("mouseout", function(d) {
          d3.select("#details").text("");
          svg.selectAll("path.land")
             .transition()
                .duration(300)
                  .attr("fill",landColor)
                  .attr("stroke", "none");

          gcountries.selectAll("circle.country")
             .transition()
              .duration(300)
                .attr("opacity", 1);
        })
        .append("svg:title")
          .text(function(d) { return d.Name + ": " + remittancesMagnitudeFormat(d[selectedYear]) + "M current US$"});



    function update(start) {
      var c = gcountries.selectAll("circle")
      if (!start)
         c = c.transition()
          .duration(start ? 0 : 100)

      c.attr("r", function(d) {
        var r = rscale(d[selectedYear]);
        return (isNaN(r) ? 0 : r);
      })
    }


    update(true);

     gcountries.selectAll("circle")
      .transition()
        .duration(300)
        .attr("opacity", 1)

    var yearLen = 12;


    var timeline = d3.select("#timeline").append("svg");

    yearsg = timeline.append("g")
      .attr("class", "years")
     .attr("transform", "translate("+((width - remittanceYears.length*yearLen)/2)+","+30+")")





    yearsg.selectAll("text.remy")
        .data(remittanceYears)
        .enter()
        .append("svg:text")
          .attr("class", "remy")
          .classed("migrations", function(d) {
            return (migrationYears.indexOf(d) > 0); })
          .attr("visibility", function(d,i) {
            if ((+d % 5) == 0) //  ||  (+d > 2010))
              return "visible";
           else return "hidden";
          })
          .attr("y", -5)
          .attr("x", function(d, i) { return i*yearLen; })
          .attr("text-anchor", "middle")
          .text(function(d) { return d; })
          .on("mouseover", function(d) {
            selectedYear = d;
            yearsg.selectAll("text.remy").classed("sel", false);
            d3.select(this).classed("sel", true);
            update();
          });

     d3.selectAll("text.remy")
      .filter(function(d) {
        return d == selectedYear; })
      .classed("sel", true);



});



})();