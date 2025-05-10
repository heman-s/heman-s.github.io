let isPlaying = false;
let animationInterval;
let currentYearIndex = 0;
let years = [];
let offences = [];
let indicators = [];
let currentDataType = "crime"; 
let updateVisualization;
let crimeDataGlobal, MHDataGlobal;
let currentSelectedArea = null;

async function loadData() {
    const topology = await d3.json("london-topojson.json");
    const boroughs = topojson.feature(topology, topology.objects.london_geo);

    const crimeData = await loadCrimeData();
    const MHData = await loadMHData(boroughs);

    crimeDataGlobal = crimeData;
    MHDataGlobal = MHData;
    
    return { boroughs, crimeData, MHData, topology };
}

async function loadCrimeData() {
    const parseSlashFormat = d3.timeParse("%d/%m/%Y");  
    const parseHyphenFormat = d3.timeParse("%Y-%m-%d"); 
    const yearFormatter = d3.timeFormat("%Y");  

    const csvFiles = [
        "MPSCrime21-25.csv",
        "MPSCrime20-21.csv",
        "MPSCrime19-20.csv",
        "MPSCrime18-19.csv",
        "MPSCrime17-18.csv",
    ];
    
    const allCrimeData = await Promise.all(
        csvFiles.map(file => 
            d3.csv(file, d => {
                if (d.Area_Type !== "Borough") return null;
                
                let parsedDate;
                if (d.Month_Year.includes("/")) {
                    parsedDate = parseSlashFormat(d.Month_Year);
                } else if (d.Month_Year.includes("-")) {
                    parsedDate = parseHyphenFormat(d.Month_Year);
                }
                
                if (!parsedDate) return null;

                return {
                    year: yearFormatter(parsedDate),
                    borough: d.Borough_SNT,
                    offence: d.Offence_Group.trim().toUpperCase(),
                    count: +d.Count
                };
            }).then(data => data.filter(d => d !== null))
        ));
    
    console.log("allCrimeData", allCrimeData.flat());
    return allCrimeData.flat();
}

async function loadMHData(boroughs) {
    const parseSlashFormat = d3.timeParse("%d/%m/%Y");  
    const parseHyphenFormat = d3.timeParse("%Y-%m-%d"); 
    const yearFormatter = d3.timeFormat("%Y");  

    const csvFiles = [
        "MHB23-24.csv",
        "MHB22-23.csv",
        "MHB21-22.csv",
        "MHB20-21.csv",
    ];

    const icbToBoroughs = {
        "NHS NORTH CENTRAL LONDON ICB - 93C": ["Barnet", "Camden", "Enfield", "Haringey", "Islington"],
        "NHS NORTH EAST LONDON ICB - A3A8R": ["Barking and Dagenham", "City of London", "Hackney", "Havering", "Newham", "Redbridge", "Tower Hamlets", "Waltham Forest"],
        "NHS NORTH WEST LONDON ICB - W2U3Z": ["Brent", "Ealing", "Harrow", "Hammersmith and Fulham", "Hillingdon", "Hounslow", "Westminster", "Kensington and Chelsea"],
        "NHS SOUTH EAST LONDON ICB - 72Q": ["Bexley", "Bromley", "Greenwich", "Lambeth", "Lewisham", "Southwark"],
        "NHS SOUTH WEST LONDON ICB - 36L": ["Croydon", "Kingston upon Thames", "Merton", "Richmond upon Thames", "Sutton", "Wandsworth"]
    };

    const ccgToBoroughs = {
        "NHS NORTH CENTRAL LONDON CCG": ["Barnet", "Camden", "Enfield", "Haringey", "Islington"],
        "NHS NORTH EAST LONDON CCG": ["Barking and Dagenham", "City of London", "Hackney", "Havering", "Newham", "Redbridge", "Tower Hamlets", "Waltham Forest"],
        "NHS NORTH WEST LONDON CCG": ["Brent", "Ealing", "Harrow", "Hammersmith and Fulham", "Hillingdon", "Hounslow", "Westminster", "Kensington and Chelsea"],
        "NHS SOUTH EAST LONDON CCG": ["Bexley", "Bromley", "Greenwich", "Lambeth", "Lewisham", "Southwark"],
        "NHS SOUTH WEST LONDON CCG": ["Croydon", "Kingston upon Thames", "Merton", "Richmond upon Thames", "Sutton", "Wandsworth"]
    };

    const validGroups = new Set([...Object.keys(icbToBoroughs), ...Object.keys(ccgToBoroughs)]);
    
    const allMHData = await Promise.all(
        csvFiles.map(file => 
            d3.csv(file, d => {
                if (d.METRIC !== "1a" || (d.BREAKDOWN !== "Sub ICB - Registration or Residence; Service or Team Type" && d.BREAKDOWN !== "CCG - Registration or Residence; Service Type Group") || !validGroups.has(d.LEVEL_ONE_DESCRIPTION)) {
                    return null;
                }

                let parsedDate;
                if (d.REPORTING_PERIOD_END.includes("/")) {
                    parsedDate = parseSlashFormat(d.REPORTING_PERIOD_END);
                } else if (d.REPORTING_PERIOD_END.includes("-")) {
                    parsedDate = parseHyphenFormat(d.REPORTING_PERIOD_END);
                }
                
                if (!parsedDate) return null;

                if (d.BREAKDOWN == "Sub ICB - Registration or Residence; Service or Team Type") {
                    boroughGroup = icbToBoroughs[d.LEVEL_ONE_DESCRIPTION];
                }
                else if (d.BREAKDOWN == "CCG - Registration or Residence; Service Type Group") {
                    boroughGroup = ccgToBoroughs[d.LEVEL_ONE_DESCRIPTION];
                }
                
                return {
                    year: yearFormatter(parsedDate),
                    group: d.LEVEL_ONE_DESCRIPTION,
                    boroughs: boroughGroup,
                    indicator: d.LEVEL_TWO_DESCRIPTION,
                    count: +d.METRIC_VALUE
                };
            }).then(data => data.filter(d => d !== null))
        ));

    console.log("allMHData", allMHData.flat());
    return allMHData.flat();
}

function processData(boroughs, crimeData, MHData) {
    const crimeYears = [...new Set(crimeData.map(d => d.year))].filter(d => d).sort();
    const healthYears = [...new Set(MHData.map(d => d.year))].filter(d => d).sort();
    
    const dataYears = {
        crime: crimeYears,
        health: healthYears
    };
    years = [...crimeYears];
    
    offences = [...new Set(crimeData.map(d => d.offence))].filter(d => d).sort();
    indicators = [...new Set(MHData.map(d => d.indicator))].filter(d => d).sort();

    const timeline = d3.select("#timeline")
        .attr("min", 0)
        .attr("max", years.length - 1)
        .attr("value", 0)
        .on("input", function() {
            if (isPlaying) togglePlay();
            currentYearIndex = +this.value;
            updateYearDisplay();
            updateVisualization();
        });

    d3.select("#data-type").on("change", function() {
        currentDataType = this.value;
        currentSelectedArea = null;

        years = currentDataType === "crime" ? [...dataYears.crime] : [...dataYears.health];
        
        currentYearIndex = 0;
        timeline
            .attr("max", years.length - 1)
            .attr("value", 0);
        
        updateYearDisplay();
        
        let offenceLabel = document.getElementById("offence-label");
        if (currentDataType === "crime") {
            offenceLabel.innerHTML = "Crime Type:";
        } else {
            offenceLabel.innerHTML = "Mental Health Service:";
        }

        updateCategoryDropdown();
        updateBarChart();
        updateVisualization();
    });
    
    d3.select("#offence").on("change", function() {
        updateVisualization();
    });

    updateYearDisplay();
    updateCategoryDropdown();
    
    return { offences, dataYears };
}

function updateYearDisplay() {
    d3.select("#year-display").text(years[currentYearIndex]);
}

function updateCategoryDropdown() {
    const offenceSelect = d3.select("#offence");
    offenceSelect.selectAll("option:not(:first-child)").remove();
    
    const categories = currentDataType === "crime" ? offences : indicators;
    
    offenceSelect.selectAll("option.category")
        .data(categories)
        .enter()
        .append("option")
        .attr("class", "category")
        .attr("value", d => d)
        .text(d => d);
}

function togglePlay() {
    if (years.length === 0) return;

    isPlaying = !isPlaying;
    const playButton = d3.select("#playButton");
    
    if (isPlaying) {
        playButton.classed("active", true);
        d3.select("#playIcon").text("❚❚"); 
        
        animationInterval = setInterval(() => {
            currentYearIndex = (currentYearIndex + 1) % years.length;
            d3.select("#timeline").property("value", currentYearIndex);
            updateYearDisplay();
            updateVisualization();
            
            if (currentYearIndex === years.length - 1) {
                togglePlay(); 
            }
        }, 1000); 
    } else {
        playButton.classed("active", false);
        d3.select("#playIcon").html("&#9658;"); 
        clearInterval(animationInterval);
    }
}

function createMap(boroughs, crimeData, mentalHealthData, topology, dataYears) {
    this.topology = topology;
    this.boroughs = boroughs;

    const svg = d3.select("#map");
    let width = parseInt(svg.attr("width"));
    let height = parseInt(svg.attr("height"));
    let tooltip = d3.select(".tooltip");

    this.projection = d3.geoMercator()
        .center([-0.1, 51.5])
        .scale(60000)
        .translate([500, 410]);

    this.path = d3.geoPath().projection(projection);

    const colorScales = {
        crime: d3.scaleQuantile().range(d3.schemeReds[7]),
        health: d3.scaleQuantile().range(d3.schemeBlues[7])
    };    

    updateVisualization = function() {
        const currentYear = years[currentYearIndex];
        const currentCategory = d3.select("#offence").property("value");
        
        if (currentDataType === "crime") {
            updateMapWithCrimeData(currentYear, currentCategory);
        } else {
            updateMapWithHealthData(currentYear, currentCategory);
        }
    };
    updateVisualization();

    function updateMapWithCrimeData(year, offence) {
        svg.select("#mapLayer").selectAll("text").remove();

        const crimeByBorough = {};
        let tooltipTitle = "";

        crimeData.forEach(d => {
            const yearMatch = (year === "All") || (d.year === year);
            const offenceMatch = (offence === "All") || (d.offence === offence);
            
            if (yearMatch && offenceMatch) {
                crimeByBorough[d.borough] = (crimeByBorough[d.borough] || 0) + d.count;
            }
        });

        if (year === "All" && offence === "All") {
            tooltipTitle = "All Crimes (All Years)";
        } else if (year === "All") {
            tooltipTitle = `${offence} (All Years)`;
        } else if (offence === "All") {
            tooltipTitle = `All Crimes (${year})`;
        } else {
            tooltipTitle = `${offence} (${year})`;
        }
        
        const maxCount = d3.max(Object.values(crimeByBorough));
        const minCount = d3.min(Object.values(crimeByBorough));

        if (maxCount && !isNaN(maxCount)) {
            const step = (maxCount - minCount) / 6;
            const domain = Array.from({length: 6}, (_, i) => 
                Math.round(minCount + step * (i + 1))
            ).filter(d => !isNaN(d));
            
            colorScales.crime.domain(domain);
        }
        
        updateMapLayer(crimeByBorough, tooltipTitle, colorScales.crime, "Crimes");
    }

    function updateMapWithHealthData(year, indicator) {    
        const healthByGroup = {};
        let hasValidData = false;

        mentalHealthData.forEach(d => {
            const yearMatch = (year === "All") || (d.year === year);
            const indicatorMatch = (indicator === "All") || (d.indicator === indicator);
            
            if (yearMatch && indicatorMatch && !isNaN(d.count) && d.count > 0) {
                hasValidData = true;
                if (!healthByGroup[d.group]) {
                    healthByGroup[d.group] = {
                        count: 0,
                        boroughs: d.boroughs || []
                    };
                }
                healthByGroup[d.group].count += d.count;
            }
        });

        if (!hasValidData) {
            showBlankMap();
            return;
        }

        if (year === "All" && indicator === "All") {
            tooltipTitle = "All Indicators (All Years)";
        } else if (year === "All") {
            tooltipTitle = `${indicator} (All Years)`;
        } else if (indicator === "All") {
            tooltipTitle = `All Indicators (${year})`;
        } else {
            tooltipTitle = `${indicator} (${year})`;
        }
        
        updateGroupLayer(healthByGroup, tooltipTitle, colorScales.health, "Cases");
    }

    function updateMapLayer(dataByBorough, tooltipTitle, colorScale, unit) {
        const values = Object.values(dataByBorough).filter(v => !isNaN(v));
        const maxValue = d3.max(Object.values(dataByBorough));
        const minValue = d3.min(Object.values(dataByBorough));

        const boroughPaths = svg.select("#mapLayer").selectAll(".borough")
            .data(boroughs.features);
        
        boroughPaths.enter()
            .append("path")
            .attr("class", "borough")
            .merge(boroughPaths)
            .attr("d", path)
            .style("fill", d => {
                const value = dataByBorough[d.id] || 0;
                return maxValue ? colorScale(value) : "#ccc";
            })
            .on("click", function(d) {
                if (currentDataType === "crime") {
                    updateBarChartForBorough(d.id);
                }
            })
            .on("mousemove", function(d) {
                const value = dataByBorough[d.id] || 0;
                
                d3.select(this).style("stroke-width", "1.5px");
                
                tooltip.transition()
                    .duration(200)
                    .style("opacity", 0.9);
                tooltip.html(`${d.id}<br/>${tooltipTitle}</br>${unit}: ${value}`)
                    .style("left", (d3.event.pageX + 10) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).style("stroke-width", "0.5px");
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });
        
        const legendGroup = svg.select(".legend-group");
    
        if (maxValue === null || minValue === null || maxValue === 0) {
            legendGroup.selectAll("*").remove();
            return;
        }
    
        const step = (maxValue - minValue) / 6;
        const domain = Array.from({length: 6}, (_, i) => 
            Math.round(minValue + step * (i + 1))
        ).filter(d => !isNaN(d));
        
        colorScale.domain(domain);
        updateLegend(minValue, maxValue, colorScale, unit);
    }

    function updateGroupLayer(dataByGroup, tooltipTitle, colorScale, unit) {
        const { topology, boroughs, path, projection } = this;
        const svg = d3.select("#map");
    
        svg.select("#mapLayer").selectAll("*").remove();
        svg.select(".legend-group").selectAll("*").remove();
    
        const boroughData = new Map();
        const groupValues = [];
    
        Object.entries(dataByGroup).forEach(([groupName, groupData]) => {
            if (!groupData?.boroughs?.length || groupData.count <= 0) return;
            
            groupValues.push(groupData.count);
            
            groupData.boroughs.forEach(borough => {
                boroughData.set(borough, {
                    groupName: groupName.replace(/ICB - \w+$/, 'ICB'),
                    count: groupData.count
                });
            });
        });
    
        if (boroughData.size === 0) {
            showBlankMap();
            return;
        }
    
        if (groupValues.length > 0) {
            const minValue = d3.min(groupValues);
            const maxValue = d3.max(groupValues);
            colorScale.domain([minValue, maxValue]);
        }
    
        const boroughPaths = svg.select("#mapLayer")
            .selectAll(".borough")
            .data(boroughs.features, d => d.id);
    
        boroughPaths.enter()
            .append("path")
            .attr("class", "borough")
            .attr("d", path)
            .style("fill", d => {
                const data = boroughData.get(d.id);
                return data ? colorScale(data.count) : "#f0f0f0";
            })
            .style("stroke", "#fff")
            .style("stroke-width", "0.5px")
            .on("click", function(event, d) {
                if (currentDataType === "mental-health") {
                    const data = boroughData.get(event.id);
                    if (data) {
                        updateBarChartForGroup(data.groupName);
                    }
                }
            })
            .on("mousemove", function(event) {
                const d = d3.select(this).datum();
                const data = boroughData.get(d.id);
                
                if (!data) return;
                
                d3.select(this).style("stroke-width", "1.5px");

                tooltip.transition()
                    .duration(200)
                    .style("opacity", 0.9);
                tooltip.html(`${d.id}<br/>${data.groupName}<br/>${unit}: ${data.count}`)
                    .style("left", (d3.event.pageX + 10) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).style("stroke-width", "0.5px");
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });
    
        if (groupValues.length > 0) {
            updateLegend(
                d3.min(groupValues),
                d3.max(groupValues),
                colorScale,
                unit
            );
        }
    }

    function showBlankMap() {
        const svg = d3.select("#map");
        
        svg.select("#mapLayer").selectAll("*").remove();
        svg.select(".legend-group").selectAll("*").remove();
        
        svg.select("#mapLayer")
            .selectAll(".borough")
            .data(boroughs.features)
            .enter()
            .append("path")
            .attr("class", "borough")
            .attr("d", path)
            .style("fill", "#f0f0f0")
            .style("stroke", "#ccc")
            .style("stroke-width", "0.5px")
            .on("mouseover", null)
            .on("mouseout", null);
            
        svg.select("#mapLayer")
            .append("text")
            .attr("x", 400)
            .attr("y", 300)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("fill", "#666")
            .text("No data available for this selection");
    }

    function updateLegend(minValue, maxValue, colorScale, unit) {
        const legendGroup = svg.select(".legend-group");
        if (legendGroup.empty()) {
            svg.append("g").attr("class", "legend-group");
        } else {
            legendGroup.selectAll("*").remove();
        }
        
        if (maxValue === undefined || isNaN(maxValue)) return;
    
        const gradientId = `legend-gradient-${Date.now()}`;
        const defs = svg.select("defs");
        if (defs.empty()) {
            svg.append("defs");
        }
        
        defs.selectAll("#" + gradientId).remove();
        const gradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%")
            .attr("x2", "100%");
    
        colorScale.range().forEach((color, i) => {
            gradient.append("stop")
                .attr("offset", `${i * 100 / (colorScale.range().length - 1)}%`)
                .attr("stop-color", color);
        });
    
        const legend = legendGroup
            .attr("transform", "translate(70, 30)")
            .append("g");
    
        legend.append("rect")
            .attr("width", 400)
            .attr("height", 20)
            .style("fill", `url(#${gradientId})`);
    
        legend.append("text")
            .attr("x", 0)
            .attr("y", -5)
            .text(`Number of ${unit}`);
    
        const domain = [minValue, ...colorScale.domain(), maxValue];
        legend.selectAll(".legend-label")
            .data(domain)
            .enter()
            .append("text")
            .attr("class", "legend-label")
            .attr("x", d => {
                const position = 400 * ((d - minValue) / (maxValue - minValue));
                return isNaN(position) ? 0 : Math.max(0, Math.min(400, position));
            })
            .attr("y", 35)
            .text(d => Math.round(d));
    }

    updateVisualization();
}

function updateBarChart() {
    d3.select("#barchart").selectAll("*").remove();
    
    if (currentDataType === "crime") {
        createCrimeBarChart(crimeDataGlobal);
    } else {
        createMHBarChart(MHDataGlobal);
    }
}

function updateBarChartForBorough(boroughName) {
    currentSelectedArea = boroughName;
    if (currentDataType === "crime") {
        const filteredData = crimeDataGlobal.filter(d => d.borough === boroughName);
        clearBarChart();
        createCrimeBarChart(filteredData);
    }
}

function updateBarChartForGroup(groupName) {
    currentSelectedArea = groupName;
    if (currentDataType === "mental-health") {
        const filteredData = MHDataGlobal.filter(d => 
        d.group.includes(groupName.replace(/ICB - \w+$/, 'ICB'))
    );
    clearBarChart();
    createMHBarChart(filteredData);
    }
}

function resetBarChart() {
    currentSelectedArea = null;
    clearBarChart();
    if (currentDataType === "crime") {
        createCrimeBarChart(crimeDataGlobal);
    } else {
        createMHBarChart(MHDataGlobal);
    }
}

function clearBarChart() {
    d3.select("#barchart").selectAll("*").remove();
}

function createCrimeBarChart(crimeData) {
    clearBarChart();

    const cleanCrimeData = crimeData.filter(d => d.offence && d.offence !== "undefined");
    const tooltip = d3.select(".tooltip");

    const nestedData = d3.nest()
        .key(d => d.year)
        .key(d => d.offence)
        .rollup(v => d3.sum(v, d => d.count))
        .entries(cleanCrimeData);

    const yearOffenceCounts = new Map();
    nestedData.forEach(yearEntry => {
        const offenceCounts = new Map();
        yearEntry.values.forEach(offenceEntry => {
            offenceCounts.set(offenceEntry.key, offenceEntry.value);
        });
        yearOffenceCounts.set(yearEntry.key, offenceCounts);
    });

    const offences = Array.from(new Set(crimeData.map(d => d.offence))).sort();
    const years = Array.from(yearOffenceCounts.keys()).sort();

    const stackData = years.map(year => {
        const yearData = { year };
        const offencesForYear = yearOffenceCounts.get(year);
        offences.forEach(offence => {
            yearData[offence] = offencesForYear.get(offence) || 0;
        });
        return yearData;
    });

    const stack = d3.stack()
        .keys(offences.filter(offence => offence))
        .order(d3.stackOrderNone)
        .offset(d3.stackOffsetNone);

    const stackedData = stack(stackData);

    const margin = { top: 40, right: 40, bottom: 60, left: 100 };
    const width = 500 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select("#barchart")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
        .domain(years)
        .range([0, width])
        .padding(0.6);

    const y = d3.scaleLinear()
        .domain([0, d3.max(stackedData, d => d3.max(d, d => d[1]))])
        .nice()
        .range([height, 0]);

    const color = d3.scaleOrdinal()
        .domain(offences)
        .range(d3.schemeCategory10); 

    svg.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(y));

    svg.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 10)
        .style("text-anchor", "middle")
        .text("Year");

    const xText = currentSelectedArea 
        ? `Number of Crimes (${currentSelectedArea})`
        : "Number of Crimes";    

    svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -margin.left + 20)
        .style("text-anchor", "middle")
        .text(xText);

    const barGroups = svg.append("g")
        .selectAll("g")
        .data(stackedData)
        .enter().append("g")
        .attr("class", "bar-group")
        .attr("fill", d => color(d.key));

    barGroups.selectAll("rect")
        .data(d => d)
        .enter().append("rect")
        .attr("x", d => x(d.data.year))
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]))
        .attr("width", x.bandwidth())
        .on("mouseover", function(d) {
            const [y0, y1] = d;
            const offence = d3.select(this.parentNode).datum().key;
            const count = y1 - y0;
            const year = d.data.year;
            
            tooltip.transition()
                .duration(200)
                .style("opacity", 0.9);
                
            tooltip.html(`${offence}<br/>Year: ${year}<br/>Count: ${count}`)
                .style("left", (d3.event.pageX + 10) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
                
            d3.select(this).style("opacity", 0.8);
        })
        .on("mouseout", function() {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
                
            d3.select(this).style("opacity", 1);
        });

    const legend = svg.append("g")
        .attr("transform", `translate(${width}, 0)`);

    offences.forEach((offence, i) => {
        const legendItem = legend.append("g")
            .attr("transform", `translate(0, ${i * 20})`);

        legendItem.append("rect")
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", color(offence));

        legendItem.append("text")
            .attr("x", 20)
            .attr("y", 12)
            .text(offence)
            .style("font-size", "12px");
    });
}

function createMHBarChart(MHData) {
    clearBarChart();
    const tooltip = d3.select(".tooltip");

    const nestedData = d3.nest()
        .key(d => d.year)
        .key(d => d.indicator)
        .rollup(v => d3.sum(v, d => d.count))
        .entries(MHData);

    const yearIndicatorCounts = new Map();
    nestedData.forEach(yearEntry => {
        const indicatorCounts = new Map();
        yearEntry.values.forEach(indicatorEntry => {
            indicatorCounts.set(indicatorEntry.key, indicatorEntry.value);
        });
        yearIndicatorCounts.set(yearEntry.key, indicatorCounts);
    });

    const indicators = Array.from(new Set(MHData.map(d => d.indicator))).sort();
    const years = Array.from(yearIndicatorCounts.keys()).sort();

    const stackData = years.map(year => {
        const yearData = { year };
        const indicatorsForYear = yearIndicatorCounts.get(year);
        indicators.forEach(indicator => {
            yearData[indicator] = indicatorsForYear.get(indicator) || 0;
        });
        return yearData;
    });

    const stack = d3.stack()
        .keys(indicators.filter(indicator => indicator))
        .order(d3.stackOrderNone)
        .offset(d3.stackOffsetNone);

    const stackedData = stack(stackData);

    const margin = { top: 40, right: 40, bottom: 60, left: 100 };
    const width = 500 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select("#barchart")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
        .domain(years)
        .range([0, width])
        .padding(0.6);

    const y = d3.scaleLinear()
        .domain([0, d3.max(stackedData, d => d3.max(d, d => d[1]))])
        .nice()
        .range([height, 0]);

    const color = d3.scaleOrdinal()
        .domain(indicators)
        .range(d3.schemeCategory10); 

    svg.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(y));

    svg.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 10)
        .style("text-anchor", "middle")
        .text("Year");

    const xText = currentSelectedArea 
        ? `Number of Crimes (${currentSelectedArea})`
        : "Number of Crimes";  

    svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -margin.left + 20)
        .style("text-anchor", "middle")
        .text(xText);

    const barGroups = svg.append("g")
        .selectAll("g")
        .data(stackedData)
        .enter().append("g")
        .attr("class", "bar-group")
        .attr("fill", d => color(d.key));

    barGroups.selectAll("rect")
        .data(d => d)
        .enter().append("rect")
        .attr("x", d => x(d.data.year))
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]))
        .attr("width", x.bandwidth())
        .on("mouseover", function(d) {
            const [y0, y1] = d;
            const indicator = d3.select(this.parentNode).datum().key;
            const count = y1 - y0;
            const year = d.data.year;
            
            tooltip.transition()
                .duration(200)
                .style("opacity", 0.9);
                
            tooltip.html(`${indicator}<br/>Year: ${year}<br/>Count: ${count}`)
                .style("left", (d3.event.pageX + 10) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
                
            d3.select(this).style("opacity", 0.8);
        })
        .on("mouseout", function() {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
                
            d3.select(this).style("opacity", 1);
        });

    const legend = svg.append("g")
        .attr("transform", `translate(${width}, 0)`);

    indicators.forEach((indicator, i) => {
        const legendItem = legend.append("g")
            .attr("transform", `translate(0, ${i * 20})`);

        legendItem.append("rect")
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", color(indicator));

        legendItem.append("text")
            .attr("x", 20)
            .attr("y", 12)
            .text(indicator)
            .style("font-size", "12px");
    });
}

loadData().then(data => {
    console.log(data);

    const { boroughs, crimeData, MHData, topology } = data;
    const { offences, dataYears } = processData(boroughs, crimeData, MHData);

    createMap(boroughs, crimeData, MHData, topology, dataYears);
    createCrimeBarChart(crimeData);
});