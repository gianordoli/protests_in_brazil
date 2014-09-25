var socket = io.connect('http://localhost:9001');

$(document).ready(function(){		//When the document is ready...
	console.log('Called server.');
	socket.emit('load', true);		//...call data from mongoDB via node web sockets			
});

//When data comes in through the port
socket.on('write', function(data) {
	// console.log(data);
	data.sort(sortDate);	//Sort the array by date

	app.init(data);			//Initialize the program
});

var allNews;		//2D array: each line is an array of events with the same date
var maxEvents;		//Maximum number of events in the highest column
var hitsByCompany;	//2D array: each line holds the sum for events by Folha and Globo, by date
var months;

var query = '';
var mouse = new Object();

var selectedLine;
var url;

var nResults;

var chartPos;
var chartSize;

var app = {};

app.init = function (data){

	/* -------------------- LAYOUT -------------------- */
	chartPos = {x: 130,
				y: Math.round($('#title').height() + 40) };
	positionDivs();	
	var frameTop = $('#bottomFrame').css('top');
	frameTop = frameTop.substr(0, frameTop.indexOf('p'));
	chartSize = {x: Math.round(window.innerWidth - (3 * chartPos.x)),
				 y: Math.round(frameTop - chartPos.y - 40) };
	var cellSize = {x: 200,
					y: 100 };
	/* ------------------------------------------------ */

	/* --------------------- DATA --------------------- */
	months = createMonths();					// creating the (string) list of months (jan, feb)
	allNews = reorganizeDataByDay(data);	 	// reorganize data by day
	allNews = reorganizeDataByCompany(allNews);	// reorganize data by company
	console.log(allNews);

	var maxEvents = d3.max(allNews, function(d) {
	    return d.length;
	});
	console.log(maxEvents);				// maximum number of events in a single day
	/* ------------------------------------------------ */

					// categories, not numbers
	var xScale =	d3.scale.ordinal()
					// input domain is gonna be the length
					// .domain(d3.range(allNews.length))
					.domain(d3.range(allNews.length))
					// start, end, % occupied by spacing
					.rangeRoundBands([0, innerWidth], 0, 0);

	var yScale = d3.scale.ordinal()
					.domain(d3.range(maxEvents))
					.rangeRoundBands([chartPos.y + chartSize.y, chartPos.y], 0, 0);

	// Create SVG element
	var svg = d3.select('body')
				.append('svg')
				.attr('width', window.innerWidth)
				.attr('height', window.innerHeight - 10)
				.attr('left', 0)	
				.attr('top', 0)
				.attr('id', 'canvas');

	//Create groups
	var groups = svg.selectAll('g')
					.data(allNews)
					.enter()
					.append('g')
					.attr('transform', function(d, i){
						return 'translate('+ xScale(i) + ', 0)';
					})
					.on('mouseenter', function(d, i) {

						// Enlarge rects from this group
       					d3.select(this).selectAll('rect')
							.transition()
							.duration(500)
							.attr('width', cellSize.x)
							.attr('height', cellSize.y)
							.attr('y', function(d, k) {
								return chartSize.y - cellSize.y * k;
							});

						// Move columns
						svg.selectAll('g')
							.transition()
							.duration(500)
							.attr('transform', function(d, j){
								var offset;
								if(j < i){
									offset = xScale(j) - (cellSize.x/2);	
								}else if(j > i){
									offset = xScale(j) + (cellSize.x/2);	
								}else{
									offset = xScale(j) - (cellSize.x - xScale.rangeBand())/2;
								}
								return 'translate('+ offset + ', 0)';
							});
					})
					.on('mouseleave', function(d, i) {

						// Return rects to original size
       					d3.select(this).selectAll('rect')
							.transition()
							.duration(500)
							.attr('y', function(d, k) {
								return yScale(k);
							})
							.attr('width', xScale.rangeBand())
							.attr('height', yScale.rangeBand());

						// Move columns back to original position
						svg.selectAll('g')
							.transition()
							.duration(500)
							.attr('transform', function(d, j){
								return 'translate('+ xScale(j) + ', 0)';
							});
					});

	// Create bars
	groups.selectAll('rect')
		.data(function(d) { return d; })
		.enter()
		.append('rect')
		.attr('x', 0)
		.attr('y', function(d, i){
			return yScale(i);
		})
		.attr('width', xScale.rangeBand())
		.attr('height', yScale.rangeBand())
		.attr('fill', function(d, i) {
			var color = colorByCompany(d);		
			return color;
		});		


	/*---------- LISTENERS ----------*/
	canvas.addEventListener('mousemove', function(evt){
		getMousePos(evt);
	}, false);

	canvas.addEventListener('mousedown', function(evt){
		isPressed = true;	// Set my 'isPressed' variable to true
		getMousePos(evt);
		if(url != null){
			window.open(url,'_blank');	
		}
		
	}, false);

	/*------------ MENU ------------*/
	$('.sections').on({
	    'click': function(){
	    	search($(this).html());
	    },
	    'mouseenter': function(){
	    	$(this).animate({
	    		// 'background-color': 'hsla(0, 0%, 100%, 0.5)',
	    		'background-color': 'hsla(0, 0%, 90%, 0.5)',
	    	}, 200);
	    },
	    'mouseleave': function(){
	    	$(this).animate({
	    		'background-color': 'transparent',
	    	}, 200);
	    }    
	});

	$('#ok').click(function(){
		search($('#searchBox').val());	
	});	

	function search(word){
		query = word;

		if(word != ''){

			query = query.toLowerCase();

			if(query.search('black bloc') == -1){
				query = ' ' + query;				//Only add space if it's not searching for black blocs,
			}									//because all the news write it between quotes	
			console.log(query);
			countResults();
			highlightResults();
		}else{
			$('#results').html('');
		}
	}	

	function countResults(){

		nResults = 0;

		for(var i = 0; i < allNews.length; i++){
			var line = allNews[i];
			for(var j = 0; j < line.length; j++){
				var obj = line[j];
				var lowerCaseHeadline = obj.headline.toLowerCase();
				if(	query != '' &&
					lowerCaseHeadline.search(query) != -1){
					nResults++
				}
			}	
		}
		$('#results').html(nResults + ' resultados encontrados.');
	}	

	function highlightResults(){
		// Create bars
		groups.selectAll('rect')
			.attr('fill', function(d, i) {
				var color;
				var lowerCaseHeadline = d.headline.toLowerCase();
				if(	query != '' && lowerCaseHeadline.search(query) == -1){
					color = parseHslaColor(0, 0, 80, 1);
				}else{
					color = colorByCompany(d);
				}
				return color;
		});
	}	
}


// function draw(){
// 	//Erasing the background
// 	ctx.fillStyle = parseHslaColor(295, 50, 15, 1);
// 	ctx.fillRect(0, 0, canvas.width, canvas.height);

// 	if(!checkChartHover()){
// 		selectedLine = null;
// 	}
	
// 	var currentMonth, lastMonth;
// 	var pos = {x: 0, y: 0};
// 	var size = {x: chartSize.x/allNews.length,
// 				y: chartSize.y/maxEvents};

// 	ctx.save();
// 	ctx.translate(chartPos.x, chartPos.y);

// 	var baseline = chartSize.y;

// 	for(var i = 0; i < allNews.length; i++){

// 		var line = allNews[i];	//Each 'line' of my 'table'
// 		var companyCount = {folha: 0, globo: 0}
				
// 		if(checkColumnHover(pos, size) && checkChartHover()){
// 		// if(checkColumnHover(pos, size)){
// 			selectedLine = i;
// 		}

// 		if(selectedLine == i){

// 			// size.x = (chartSize.x/allNews.length)*40;
// 			// size.y = (chartSize.y/maxEvents)*40;
// 			size.x = 200;
// 			size.y = 100;			

// 			var totalEventsByLine = hitsByCompany[i].folha + hitsByCompany[i].globo;
// 			var totalHeight = size.y * totalEventsByLine;

// 			if(totalHeight > chartSize.y){
// 				baseline = map(mouse.y,
// 								chartPos.y, chartPos.y + chartSize.y,
// 								totalHeight, chartSize.y);

// 				baseline = constrain(baseline, chartSize.y, totalHeight);
// 			}

// 			highlight(line[0], pos, size, baseline);
// 		}else{
// 			size.x = chartSize.x/allNews.length;
// 			size.y = chartSize.y/maxEvents;
// 			baseline = chartSize.y;
// 		}
		
// 		for(var j = 0; j < line.length; j++){

			
// 			var obj = line[j];
// 			var color;
// 			pos.y = baseline;

// 			if(obj.company == 'O Globo'){
// 				color = parseHslaColor(80, 100, 50, 1);
// 				companyCount.globo++;
// 				pos.y -= hitsByCompany[i].folha * size.y;
// 				pos.y -= companyCount.globo * size.y;
// 			}else{
// 				color = parseHslaColor(180, 100, 50, 1);
// 				companyCount.folha++;
// 				pos.y -= companyCount.folha * size.y;
// 			}
			
// 			//Changing the color according to the query
// 			var lowerCaseHeadline = obj.headline.toLowerCase();
// 			if(	query != ''){
// 				if(lowerCaseHeadline.search(query) == -1){
// 					color = parseHslaColor(0, 0, 100, 0.5);
// 					resultFound = false;
// 				}else{
// 					//Bar that show found results above each column
// 					ctx.fillStyle = parseHslaColor(0, 0, 100, 0.2);
// 					ctx.fillRect(pos.x, baseline, size.x - 1, 10)				
// 				}
// 			}

// 			checkObjHover(obj, pos, size);

// 			ctx.fillStyle = color;
// 			ctx.fillRect(pos.x, pos.y, size.x - 1, size.y - 1);
// 			if(selectedLine == i){
// 				drawText(obj, pos, size);
// 			}
			
// 			pos.y = 0;	//Reset y

// 			currentMonth = new Date(obj.date).getMonth();
			
// 		}

// 		//draw month scale
// 		if(currentMonth != lastMonth){
// 			drawScale(currentMonth, pos);
// 		}		
// 		lastMonth = currentMonth;	

// 		//increase x
// 		pos.x += size.x;	
// 	}
	
// 	ctx.restore();
// 	//selectedLine = null;
// }

/*--------------- DRAW FUNCTIONS ---------------*/
/* --------- Called at every draw loop ---------*/

function drawText(obj, pos, size){
	var textPos = { x: pos.x + 5,
					  y: pos.y + 5 }

	var textWidth = size.x - 10;
	var textLeading = 13;
	var currentDate = new Date(obj.date);
	ctx.fillStyle = parseHslaColor(295, 50, 15, 1);

	var msg = (currentDate.getMonth() + 1) + '/';
	msg += currentDate.getDate();
	css('date');
	ctx.fillText(msg, textPos.x, textPos.y);					//Date

	msg = obj.company + ' | ' + obj.section;
	textPos.y += textLeading;
	css('company');
	ctx.fillText(msg, textPos.x, textPos.y);				//Company | Section

	msg = obj.headline;
	textPos.y += textLeading;
	css('headline');
	textLeading = 16;
	wrapText(ctx, msg, textPos.x, textPos.y, textWidth, textLeading);		//Headline	
}

var checkChartHover = function(){

	var isHover = false;

	//Checking if the mouse is over the chart
	if(chartPos.x < mouse.x && mouse.x < chartPos.x + chartSize.x
	   && 0 < mouse.y && mouse.y < chartPos.y + chartSize.y + 40){
		isHover = true;
	}
	// console.log(isHover);

	return isHover;
}

var checkColumnHover = function(pos, size){
	
	var isHover = false;

	if(pos.x + chartPos.x < mouse.x &&
	   mouse.x < pos.x + size.x + chartPos.x){
		isHover =  true;
	}
	return isHover;
}

function checkObjHover(obj, pos, size){

	if(checkChartHover()){
		if(pos.x + chartPos.x < mouse.x && mouse.x < pos.x + size.x + chartPos.x){
			if(pos.y + chartPos.y < mouse.y && mouse.y < pos.y + size.y + chartPos.y){	
				url = obj.url;
			}
		}
	}else{
		url = null;
	}
}

//Highlight column
function highlight(obj, pos, size, baseline){
	
	var currentDate = new Date(obj.date);

	var msg = currentDate.getDate();
		css('date');
		ctx.fillStyle = 'white';
		ctx.textBaseline = 'top';
		// ctx.fillText(msg, pos.x, chartSize.y);	   	
		ctx.fillText(msg, pos.x, baseline + 10);
}

function css(style){
	if(style == 'date'){
		ctx.font = '300 10px Raleway';	
	}
	if(style == 'company'){
		ctx.font = '300 10px Raleway';
	}
	if(style == 'headline'){
		ctx.font = '600 13px Raleway';
	}
}

function drawScale(currentMonth, pos){
	//Line
	ctx.strokeStyle = parseHslaColor(0, 0, 100, 0.5);;
	ctx.lineWidth = 0.5;
	ctx.beginPath();
	ctx.moveTo(pos.x - 1, 0);
	ctx.lineTo(pos.x - 1, chartSize.y + 20);
	ctx.stroke();

	//Text
	var txt = months[currentMonth];
		css('date');
		ctx.fillStyle = 'white';
		ctx.textBaseline = 'top';
		ctx.fillText(txt, pos.x - 1, chartSize.y + 20);
}



/*--------------- SETUP FUNCTIONS ---------------*/
/* --- Called just once, at the program start ---*/

//This function will calculate the total hits for Folha and Globo separately, for each day
//I need it to order the hits in each column by company
var getHitsByCompany = function(data){

	var allHits = new Array();

	for(var i = 0; i < allNews.length; i++){

		var line = allNews[i];	//Each 'line' of my 'table'
		var hits = {folha: 0, globo: 0};

		for(var j = 0; j < line.length; j++){
			if(line[j].company == 'O Globo'){	//Globo has only 'O Globo' results
				hits.globo++;
			}else{								//Folha has folha.com, guia da folha etc
				hits.folha++;
			}
		}

		allHits.push(hits);
	}
	return allHits;
}

//Reorganize the whole data in a 2D array:
//each line is an array of events with the same date
var reorganizeDataByDay = function (data){

	var events = new Array();

	//Temporary array; results for ONE date
	var eventsAtDate = new Array();

	var currentDate;
	var lastDate = new Date();

	for(var i = 0; i < data.length; i++){

		currentDate = new Date(data[i].date);

		if(currentDate.getDate() == lastDate.getDate()){
			eventsAtDate.push(data[i]);
		}else{
			//If this is not the first iteration of the loop...
			if(i != 0){
				events.push(eventsAtDate);	//Push the new 'line' of events to the array that holds'em all
				eventsAtDate = new Array();	//Reset the array to start collecting events for the next date				
			}
			eventsAtDate.push(data[i]);
		}

		lastDate = new Date(currentDate);		
	}

	return events;
}

var reorganizeDataByCompany = function (data){

	var newData = new Array();	// All news
		

	for(var i = 0; i < data.length; i++){
		
		var eventsAtDate = data[i];
		var newEventsAtDate = new Array();

		// Loop through THIS date and select all Folha
		for(var j = 0; j < eventsAtDate.length; j++){
			if(eventsAtDate[j].company == 'Folha de S.Paulo'){
				newEventsAtDate.push(eventsAtDate[j]);
			}
		}
		// Loop through THIS date and select all Globo
		for(var j = 0; j < eventsAtDate.length; j++){
			if(eventsAtDate[j].company == 'O Globo'){
				newEventsAtDate.push(eventsAtDate[j]);
			}
		}

		// Push the new date array to the main one
		newData.push(newEventsAtDate);
		// newEventsAtDate = new Array();		
	}
	return newData;
}

/*---------- AUXILIAR FUNCTIONS ----------*/
//Sort JSON array by date
function sortDate(a, b) {
	//getTime provides an equal value for h,min,s: the current time
    return new Date(a.date).getTime() - new Date(b.date).getTime();
}

var map = function(value, aMin, aMax, bMin, bMax){
  	var srcMax = aMax - aMin,
    	dstMax = bMax - bMin,
    	adjValue = value - aMin;
  	return (adjValue * dstMax / srcMax) + bMin;
}

var constrain = function(value, min, max){
	if(value < min){
		value = min;
	}
	if(value > max){
		value = max;
	}
	return value;
}

function wrapText(context, text, x, y, maxWidth, textLeading) {
	var words = text.split(' ');
	var line = '';

	for(var n = 0; n < words.length; n++) {
	  var testLine = line + words[n] + ' ';
	  var metrics = context.measureText(testLine);
	  var testWidth = metrics.width;
	  if (testWidth > maxWidth && n > 0) {
	    context.fillText(line, x, y);
	    line = words[n] + ' ';
	    y += textLeading;
	  }
	  else {
	    line = testLine;
	  }
	}
	context.fillText(line, x, y);
}

var parseHslaColor = function(h, s, l, a){
	var myHslColor = 'hsla(' + h + ', ' + s + '%, ' + l + '%, ' + a +')';
	//console.log('called calculateAngle function');
	return myHslColor;
}

var colorByCompany = function(d){
	var thisColor;
	if(d.company == 'O Globo'){
		thisColor = parseHslaColor(80, 100, 40, 1);
	}else{
		thisColor = parseHslaColor(220, 100, 50, 1);
	}	
	return thisColor;
}

function getMousePos(evt){
	// mouse.x = evt.clientX - canvasPosition.left;
	// mouse.y = evt.clientY - canvasPosition.top;
	//You have to use evt.clientX! evt..x doesn't work with Firefox!

	// console.log(mouse);
}	

var positionDivs = function(){
	screenHeight = window.innerHeight;
	screenWidth = window.innerWidth;
	var divPos = {x: 0, y: 0};
	var divSize = screenWidth;

	divPos.y = $('#title').height();
	$('#upperFrame').css({
		'left': divPos.x,
		'top': divPos.y,
		'width': divSize,
		'position': 'absolute'
	});

	divPos.y = screenHeight - $('#menu').height() - 20;
	$('#bottomFrame').css({
		'left': divPos.x,
		'top': divPos.y,
		'width': divSize,
		'position': 'absolute'
	});

	divPos.x = chartPos.x;
	divPos.y =  screenHeight - $('#menu').height();
	divSize = screenWidth - (2 * chartPos.x);

	$('#title').css({
		'left': divPos.x,
		'width': divSize,
	});

	$('#menu').css({
		// 'left': divPos.x,
		'top': divPos.y,
		// 'width': divSize,
		// 'background-color': 'black'
	});

	divPos.y = chartPos.y;
	$('#selected').css({
		'left': divPos.x,
		'top': divPos.y
	});	
}

var createMonths = function(){
	month = new Array();
	month[0]='Jan';
	month[1]='Fev';
	month[2]='Mar';
	month[3]='Abr';
	month[4]='Mai';
	month[5]='Jun';
	month[6]='Jul';
	month[7]='Ago';
	month[8]='Set';
	month[9]='Out';
	month[10]='Nov';
	month[11]='Dez';
	return month;
}	
