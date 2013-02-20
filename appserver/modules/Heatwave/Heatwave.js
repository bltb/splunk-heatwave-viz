Splunk.Module.Heatwave = $.klass(Splunk.Module.DispatchingModule, {

    plot: function(jString){

        if (jString.length === 0){
            return;
        } else if (jString[0].count === 0){
            return;
        }

        const durationTime = 500, size= 10, yoff= 20, xoff= 100, padding= 50, colorOffset=1;

        var HeatMapPlot= this,
            data= this.parseData(jString),
            join= this.heatMap.selectAll("g.col").data(data, HeatMapPlot.getMetaData),
            span= data[0]._span;

        if (span === undefined) {
            console.log("Span is undefined!");
            return;
        }

        var svgW= parseInt(this.svg.style("width")),
            svgH= parseInt(this.svg.style("height")),
            heatMapWidth= svgW-xoff*2,
            xDom= d3.extent(data, HeatMapPlot.getTime);

        if (HeatMapPlot.xScale === undefined){ //special case on first call
            var tmp= HeatMapPlot.calcTimeLowerBound(xDom[0], heatMapWidth, size, span);
            HeatMapPlot.xScale= this.calculateXScale([tmp, xDom[0]], heatMapWidth);
        }

        var timeLowerBound= HeatMapPlot.calcTimeLowerBound(xDom[1], heatMapWidth, size, span),
            xScale= this.calculateXScale([timeLowerBound, xDom[1]], heatMapWidth);

        var newColumns= addColumns(join);

        var xAxis= d3.svg.axis()
            .scale(xScale)
            .orient("bottom")
            .ticks(3)
            .tickSubdivide(10)
            .tickSize(6,3,3);

        var bucketSize= data[0]._bucketSize,
            currentCols= this.heatMap
                .selectAll("g.col")
                .filter(inRange)
                .filter(same),
            allData= currentCols.data(),
            yDom= [d3.min(allData, function (colData) { return HeatMapPlot.getBucket(colData[0])[0]; }), //selectAll rect?
                d3.max(allData, function (colData) { return HeatMapPlot.getBucket(colData[colData.length-1])[1]; })],
            nBuckets= d3.max(allData, function (d) { return d.length; }),
            wishHeigth= (svgH-padding) / nBuckets,
            height= d3.min([d3.max([wishHeigth,2]),10]),
            heatMapHeight= nBuckets * height,
            colorDom= [d3.min(allData, function (d) { return d._extent[0]; }) + colorOffset,
                d3.max(allData, function (d){ return d._extent[1]; }) + colorOffset],
            color= d3.scale.log().domain(colorDom).range(["white","#CC0000"]),
            y= d3.scale.linear().domain(yDom).range([heatMapHeight, 0]);

        var yAxis= d3.svg.axis()
            .scale(y)
            .orient("left")
            .ticks(nBuckets)
            .tickSubdivide(0)
            .tickSize(6,3,3);

        this.heatMap.transition().duration(durationTime).ease("linear")
            .attr("transform", "translate(" + xoff + "," + (svgH - heatMapHeight - padding) + ")");

        this.heatMap.select("g.axis.y").transition().duration(durationTime).ease("linear")
            .call(yAxis);

        this.heatMap.select("g.axis.x").transition().duration(durationTime).ease("linear")
            .attr("transform", "translate(0," + (heatMapHeight + 1) + ")")
            .call(xAxis);

        currentCols.each(updateRects)
            .call(move);

        this.heatMap.selectAll("g.cols")
            .filter(function (d) { return !inRange(d) || !same(d); })
            .transition().duration(durationTime)
            .attr("opacity", 0)
            .remove();

        function addColumns(d3set) {
            return d3set.enter().insert("g","g.axis").attr("class", "col")
                .call(moveIn);
        }

        function updateRects(colData) {
            var rect= d3.select(this).selectAll("rect"),
                join= rect.data(colData, HeatMapPlot.getBucketStr);

            join.enter().insert("rect")
                .on("click", function(d) { console.log(d3.select(this).select("title").text()); } )
                .call(place)
                .call(shape)
                .append("title")
                .call(title, colData);

            join.transition().duration(durationTime).ease("linear")
                .style("fill", toColor)
                .call(place)
                .select("title")
                .call(title, colData);

            join.exit().remove();
        }

        function title(selection, colData) {
            selection
                .text(function(d) {return colData._time + ":" + d;})
        }

        function toColor(d) {
            return color(HeatMapPlot.getValue(d) + colorOffset);
        }

        function inRange(d) {
            return d._time > timeLowerBound && d._time < xDom[1];
        }

        function same(d) {
            return d._span === span && d._bucketSize === bucketSize;
        }

        function move(selection) {
            selection
                .transition().duration(durationTime).ease("linear")
                .attr("transform", function (d) { return "translate(" + xScale(d._time) + ",0)"; })
                .attr("opacity", 1);
        }

        function moveIn(selection) {
            selection
                .attr("opacity", 0)
                .attr("transform", function (d) { return "translate(" + HeatMapPlot.xScale(d._time) + ",0)"; });
        }

        function shape(selection) {
            selection
                .attr("width", size)
                .attr("height", height)
                .style("fill", toColor);
            //.style("stroke", toColor)
            //.style("stroke-width",1)
        }

        function place(selection) {
            selection
                .attr("y", function(d) {
                    return y(HeatMapPlot.getBucket(d)[1]);
                });
        }

        HeatMapPlot.xScale= xScale;
    },

    updateXScale: function(domain, width) {

    },

    calculateXScale: function(domain, width) {
        return d3.time.scale().domain(domain).range([0, width])
    },

    calcTimeLowerBound: function(time, length, size, span) {
        return new Date(time.getTime() - (length / size) * span * 1000)
    },

    getTime: function (d) {
        return d._time;
    },

    getMetaData: function (d) {
        return d._time + "," + d._span;
    },

    getMetaMouseClick: function (d) {
        console.log(d._time, d._span)
        return d._time + "," + d._span;
    },

    toTime: function (t){
        var st= t.indexOf("=");
        return new Date(t.substring(st+1))
    },

    getBucket: function (d){
        var a= d.indexOf("-"),
            b= d.indexOf("=");
        return [parseFloat(d.substring(0,a)), parseFloat(d.substring(a+1,b))];
    },

    getBucketStr: function (d) {
        return d.substring(0,d.indexOf("="))
    },

    getValue: function (d){
        var st= d.indexOf("=");
        return eval(d.substring(st+1));
    },

    parseData: function(jString) {

        var data= [];
        //sort data according to bucket values
        for(var col=0; col<jString.length; col++){
            var tmp= [];
            for(var bucket in jString[col]){
                if(jString[col].hasOwnProperty(bucket) && bucket[0] !== "_"){
                    tmp.push(bucket + "=" + jString[col][bucket]);
                }
            }
            tmp.sort(function(a, b) { return parseFloat(a) - parseFloat(b); });
            tmp._time= new Date(jString[col]._time);
            tmp._span= eval(jString[col]._span);
            tmp._extent= d3.extent(tmp, this.getValue);
            var firstBucket= this.getBucket(tmp[0]);
            tmp._bucketSize= firstBucket[1]-firstBucket[0];
            data.push(tmp);
        }

        //console.log(data)
        return data;
    },

    //############################################################
    // MAIN WAVE RENDERING
    //############################################################

	initialize: function($super, container) {
		//console.log("I GOT TO initialize");
        //console.log($super,container);

        this.svg= d3.select("svg"); // d3.select(this.container).select("svg")
        this.heatMap= this.svg.append("g")
                .attr("class","heatMap");

        this.heatMap.append("g")
            .attr("class", "axis x");

        this.heatMap.append("g")
            .attr("class", "axis y");

		$super(container);

        // if set to 'foo', the drilldown keys coming out of getModifiedContext() will look like "$
        this.drilldownPrefix = this.getParam("drilldownPrefix");

        //Context flow gates
        this.doneUpstream = false;
        this.gettingResults = false;

    },
	
	onBeforeJobDispatched: function(search) {
		search.setMinimumStatusBuckets(1);
		search.setRequiredFields(["*"]);
	},
	
	onJobProgress: function(event) {
		console.log("I GOT TO onJobProgress");
        var context = this.getContext();
        var search = context.get("search");

        //console.log("This is the search url: " + search.getUrl("events"));
		//console.log("This.getResults() " + this.getResults());
		this.getResults();
    	},

    onJobDone: function(){
        this.getResults();
    },

    onContextChange: function() {
        var context = this.getContext();
        if (context.get("search").job.isDone()) {
            this.getResults();
        } else {
            this.doneUpstream = false;
        }
    },

	// override
	getResultURL: function(params) {
		//console.log("I GOT TO getResultsURL");
		var context = this.getContext();
		var search = context.get("search");
		//console.log("Search ID in getResultsURL: " + search.job.getSearchId());
		var searchJobId = search.job.getSearchId(); 
		var uri = Splunk.util.make_url("splunkd/search/jobs/" + searchJobId + "/results_preview?output_mode=json");
		//console.log("This is the uri in getResultURL " + uri);
		return uri;

	},

    getResults: function($super) {
        this.doneUpstream = true;
        this.gettingResults = true;
        return $super();
    },

	getResultParams: function($super) {
		var params = $super(); //Chartjs
        	var context = this.getContext();
        	var search = context.get("search");
        	var sid = search.job.getSearchId();
	
       	 	if (!sid) this.logger.error(this.moduleType, "Assertion Failed.");
		
        	params.sid = sid;
        	return params;
	
	},

    getModifiedContext: function() {
        var context = this.getContext();
        if (this._selection) {
            for (key in this._selection) {
                print(key);
                context.set(this.drilldownPrefix + "." + key, this._selection[key]);
            }

            var searchModified = false;
            var search = context.get("search");

            var searchRange  = plot.contextTime; //search.getTimeRange();
            // if the selection itself has a timeRange (ie this is a timechart or an event click)
            // then we use that.
            if (this._selection.timeRange) {
                search.setTimeRange(this._selection.timeRange);
                searchModified = true;
                // otherwise, if this is a relative or realtime search.
                // then we take the current absolute-time snapshot FROM THE JOB
                // and use that as the drilldown timerange.
            } else if (!searchRange.isAbsolute() && !searchRange.isAllTime()) {
                var job = this.getContext().get("search").job;
                search.setTimeRange(job.getTimeRange());
                searchModified = true;
            }

            // push the modified search back into the context.
            if (searchModified) context.set("search", search);
        }
        return context;
    },

    /**
     * override isReadyForContextPush to stop the pushes downstream
     * when we have no selected state
     */
    isReadyForContextPush: function($super) {
        //Note that here we gate any pushing of context until the main plot has
        //completed its render.
        if (!(this.doneUpstream)) {
            return Splunk.Module.DEFER;
        }
        if (this.gettingResults) {
            return Splunk.Module.DEFER;
        }
        return $super();
    },

	renderResults: function($super, jString) {
		if (!jString) {
		 	return;
		}

        var resultDict;
        if (jString.results === undefined){
			resultsDict = eval(jString);
		}else{			
			resultsDict = jString.results;
		}	

        var that= this;
		$("document").ready(function() {
            that.plot(resultsDict);
        });
	}	
});
