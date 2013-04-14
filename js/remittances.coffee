landColor = d3.rgb("#1e2b32").brighter(2)
width = 960
height = 600
svg = d3.select("body").append("svg").attr("width", width).attr("height", height)

projection = d3.geo.projection(d3.geo.hammer.raw(1.75, 2))
  .rotate([-10, -45])
  .translate([width / 2.3, height / 2])
  .scale(180)

#var projection = d3.geo.winkel3();


path = d3.geo.path().projection(projection)


migrationYears = ["1970", "1980", "1990", "2000"] #"1960",
remittanceYears =  (i.toString() for i in [1970..2012]).concat("2012e")
selectedYear = "2000"
countryCentroidsByCode = {}


queue()
  .defer(d3.csv, "data/country-centroids.csv")
  .defer(d3.json, "data/world-countries.json")
  .defer(d3.csv, "data/migration-1K-plus.csv")
  .defer(d3.csv, "data/countries-iso2to3.csv")
  .defer(d3.csv, "data/RemittancesData_Inflows_Nov12.csv")
  .await (err, countryCentroids, world, migrations, isocodes, remittances) ->

    # migrations = migrations.filter(function(d) { return d.max >= 250000});
    getIso3 = (remittance) ->
      iso3 = iso2To3[remittance.iso2]
      if iso3 is `undefined`
        iso3 = countryNameToIso3[remittance.Name]
        console.log "Could not find flows for code: " + d.iso2 + ", name: " + d.Name  if iso3 is `undefined`
      iso3
    update = (start) ->
      c = gcountries.selectAll("circle")
      c = c.transition().duration((if start then 0 else 100))  unless start
      c.attr "r", (d) ->
        r = rscale(d[selectedYear])
        (if isNaN(r) then 0 else r)

    countryCentroids.forEach (d) ->
      countryCentroidsByCode[d.Code] = [+d.lon, +d.lat]

    featuresByName = {}
    featuresByCode = {}
    f = undefined
    for d of world.features
      f = world.features[d]
      f.centroid = countryCentroidsByCode[f.id]
      f.centroidp = projection(f.centroid)  if f.centroid isnt `undefined`
      featuresByName[f.properties.name] = f
      featuresByCode[f.id] = f

    svg.append("g")
      .attr("class", "map")
      .selectAll("path")
        .data(world.features)
      .enter()
        .append("path")
        .attr("class", "land")
        .attr("fill", landColor)
        .attr("data-code", (d) -> d.id)
        .attr "d", path

    migrationsColor = d3.scale.log().range(["#221C03", "#E9D35A"]).interpolate(d3.interpolateHcl)
    arcs = svg.append("g").attr("class", "arcs")
    migrationsByOriginCode = {}
    magnitudeFormat = d3.format(",.0f")
    migrations.forEach (d) ->
      d.max = d3.max(migrationYears.map((y) -> +d[y]))

    maxMagnitude = d3.max(migrations, (d) -> d.max)
    migrationsColor.domain [1, maxMagnitude]
    flows = migrations.forEach((flow) ->
      d = featuresByCode[flow.Dest]
      migrationsByOriginCode[flow.Origin] = []  if migrationsByOriginCode[flow.Origin] is `undefined`
      migrationsByOriginCode[flow.Origin].push flow
    )
    gcountries = svg.append("g").attr("class", "countries")
    iso2To3 = {}
    countryNameToIso3 = {}
    isocodes.forEach (d) ->
      iso2To3[d.iso2] = d.iso3
      countryNameToIso3[d.name] = d.iso3

    name = undefined
    r = undefined
    remittances.forEach (r) ->
      f = featuresByName[r.Name]
      r.centroid = f.centroidp  if f
      for i of remittanceYears
        y = remittanceYears[i]
        r[y] = +r[y].replace(",", "")  if r[y] isnt `undefined`

    max = d3.max(remittances, (d) ->
      d3.max remittanceYears.map((y) ->
        +d[y]
      )
    )
    rscale = d3.scale.sqrt().range([0, 25]).domain([0, max])
    remittancesMagnitudeFormat = d3.format(",.0f")


    circles = gcountries
      .selectAll("circle")
        .data(remittances.filter((d) -> d.centroid isnt `undefined` and d.centroid[0] isnt `undefined`
    )).enter()
      .append("svg:circle")
        .attr("class", "country")
        .attr("cx", (d) -> d.centroid[0]  if d.centroid)
        .attr("cy", (d) -> d.centroid[1]  if d.centroid)
        .attr("opacity", 0)
        .on("mouseover", (d) ->
          selectedIso3 = getIso3(d)
          if selectedIso3 isnt `undefined`
            migs = migrationsByOriginCode[selectedIso3]
            if migs is `undefined`
              console.log "No migrations for " + selectedIso3
            else
              d3.select("#details").html "Migrants from <b>" + d.Name + "</b><br>" + "sent home US$" + remittancesMagnitudeFormat(d[selectedYear]) + "M" + "<br> in " + selectedYear
              migrationsByOriginCode[selectedIso3].forEach (m) ->
                land = svg.selectAll("path.land").filter((l) ->
                  l.id is m.Dest
                )
                land.transition().duration(200).attr "fill", (d) ->
                  val = +m[selectedYear]
                  unless isNaN(val)
                    migrationsColor val
                  else
                    landColor.darker 0.5


              svg.selectAll("path.land").filter((l) ->
                l.id is selectedIso3
              ).transition().duration(200).attr "stroke", "red"

              gcountries.selectAll("circle.country")
                .transition()
                .duration(200)
                .attr "opacity", 0
        )
        .on("mouseout", (d) ->
          d3.select("#details").text ""
          svg.selectAll("path.land")
            .transition()
              .duration(300)
              .attr("fill", landColor)
              .attr "stroke", "none"

          gcountries.selectAll("circle.country")
            .transition()
              .duration(300)
              .attr "opacity", 1
        )
        .append("svg:title").text((d) ->
          d.Name + ": " + remittancesMagnitudeFormat(d[selectedYear]) + "M current US$"
        )


    update true
    gcountries.selectAll("circle").transition().duration(300).attr "opacity", 1
    yearLen = 12

    yearsg = svg.append("g")
      .attr("class", "years")
      .attr("transform", "translate(" + ((width - remittanceYears.length * yearLen) / 2) + "," + (height) + ")")



    yearsg.selectAll("text.remy")
      .data(remittanceYears)
        .enter()
      .append("svg:text")
        .attr("class", "remy")
        .classed("migrations", (d) -> migrationYears.indexOf(d) > 0)
        .attr("visibility", (d, i) ->
          if (+d % 5) is 0
            "visible"
          else
            "hidden"
        )
        .attr("y", -5).attr("x", (d, i) ->
          i * yearLen
        )
        .attr("text-anchor", "middle").text((d) ->
          d
        )
        .on "mouseover", (d) ->
          selectedYear = d
          yearsg.selectAll("text.remy").classed "sel", false
          d3.select(this).classed "sel", true
          update()

    d3.selectAll("text.remy").filter((d) ->
      d is selectedYear
    ).classed "sel", true
