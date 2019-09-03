/*****
An assortment of convenient geometry functions.
Note that most of these functions are written to accept some arguments as
individual values, or as matrixClass objects.  There are exceptions though.
*****/

// returns the distance between two 2D points
function distance(){
	var x1, y1, x2, y2;
	if(arguments.length == 4){
		x1 = arguments[0];
		y1 = arguments[1];
		x2 = arguments[2];
		y2 = arguments[3];
	}else if(arguments.length == 2){
		try{
			x1 = arguments[0].val(0, 0);
			y1 = arguments[0].val(0, 1);
			x2 = arguments[1].val(0, 0);
			y2 = arguments[1].val(0, 1);
		}catch(e){
			x1 = 0;
			y1 = 0;
			x2 = arguments[0];
			y2 = arguments[1];
		}
	}else if(arguments.length == 1){
		x1 = 0;
		y1 = 0;
		x2 = arguments[0].val(0, 0);
		y2 = arguments[0].val(0, 1);
	}
	return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
}

// returns the counter-clockwise angle between the line defined by any two points and the horizontal.
function rel_ang(/*x1, y1, x2, y2*/){
	var x1, y1, x2, y2;
	if(arguments.length == 4){
		x1 = arguments[0];
		y1 = arguments[1];
		x2 = arguments[2];
		y2 = arguments[3];
	}else if(arguments.length == 2){
		x1 = arguments[0].val(0, 0);
		y1 = arguments[0].val(0, 1);
		x2 = arguments[1].val(0, 0);
		y2 = arguments[1].val(0, 1);
	}

	var hyp, alpha, deltax, deltay;
	deltax = x2 - x1;
	deltay = y2 - y1;
	hyp = Math.sqrt(deltax * deltax + deltay * deltay);
	/********* figure out the value for alpha *********/
	if(x2 == x1){
		alpha = y2 > y1 ? Math.PI : 0;
	}else if(y2 == y1){
		alpha = (x2 < x1 ? 3 : 1) * Math.PI / 2
	}else if(x2 > x1){
		alpha = y2 == y1 ? 0 : Math.PI - Math.acos(deltay / hyp);
	}else if(x2 < x1){
		alpha = y2 == y1 ? 0 : 2 * Math.PI - Math.acos(-deltay / hyp);
	}

	return alpha;
}

// determine which side of a given line a specified point lies on.
function sideOfLine(){
	var x1, y1, x2, y2, px, py;
	if(arguments.length == 6){
		x1 = arguments[0];
		y1 = arguments[1];
		x2 = arguments[2];
		y2 = arguments[3];
		px = arguments[4];
		py = arguments[5];
	}else if(arguments.length == 3){
		x1 = arguments[0].val(0, 0);
		y1 = arguments[0].val(0, 1);
		x2 = arguments[1].val(0, 0);
		y2 = arguments[1].val(0, 1);
		px = arguments[2].val(0, 0);
		py = arguments[2].val(0, 1);
	}else{
		throw "sideOfLine expects either six or three parameters";
	}
	var a = (px - x1) * (y2 - y1);
	var b = (py - y1) * (x2 - x1);
	return a > b ? 1 : (a < b ? -1 : 0);
}

// Get the smallest convex polygon that encompasses a given set of vertices.
// Note that this uses matrixClass objects for handling the data, so it depends
// on matrices.js being included.
function getConvexHull(points) {
	var maxX, minX;
	var maxPt, minPt;
	var maxIdx, minIdx;
	for(var n = 0; n < points.width; n++){
		if (points.val(n, 0) > maxX || !maxX) {
			maxIdx = n;
			maxX = points.val(n, 0);
		}
		if (points.val(n, 0) < minX || !minX) {
			minIdx = n;
			minX = points.val(n, 0);
		}
	}

	minPt = points.subset(minIdx, 0, 1, 2);
	maxPt = points.subset(maxIdx, 0, 1, 2);
	var rval = buildConvexHull(minPt, maxPt, points);
	rval.appendMatrix(buildConvexHull(maxPt, minPt, points), 'x');
	return rval;
}

// as above, this function depends on matrixClass
function buildConvexHull(minPoint, maxPoint, points) {
	var hullPoints;
	var n;
	var maxD = 0;
	var maxIdx = null;
	var newPoints = new matrixClass(0, 2);
	for(n = 0; n < points.width; n++) {

		var d = (minPoint.val(0, 1) - maxPoint.val(0, 1)) * (points.val(n, 0) - minPoint.val(0, 0)) +
			(maxPoint.val(0, 0) - minPoint.val(0, 0)) * (points.val(n, 1) - minPoint.val(0, 1));
		if(d <= 0) continue;
		newPoints.appendMatrix(points.subset(n, 0, 1, 2), 'x');

		if ( d > maxD ) {
			maxD = d;
			maxIdx = n;
		}
	}

	if (maxIdx != null) {
		var maxPt = points.subset(maxIdx, 0, 1, 2);
		hullPoints = buildConvexHull(minPoint, maxPt, newPoints);
		hullPoints.appendMatrix(buildConvexHull(maxPt, maxPoint, newPoints), 'x');
		return hullPoints;
	} else {
		return minPoint;
	}
}

// Get the smallest rectangle surrounding a specified set of points.  Points
// can be passed in as an array in the format [x1, y1, x2, y2, ... xn, yn], or
// as a matrix with a width of n and a height of 2 and a width of n, n being
// the number of points.
// If the argument is a matrix, then the return value is a matrix.
// If the argument is an array, then the return value is an array.
function getSurroundingBox(){
	var n, rval;
	var minx, miny, maxx, maxy;
	if(arguments.length != 1){
		throw "getSurroundingBox requires one parameter.";
	}

	if(typeof arguments[0] == 'object'){
		// we can assume that it's a matrix
		rval = new matrixClass(2, 2);
		rval.setVals('X');
		var mat = arguments[0];
		for(n = 0; n < mat.width; n++){
			if(rval.val(0, 0) == 'X' || rval.val(0, 0) > mat.val(n, 0)) rval.setVal(0, 0, mat.val(n, 0));
			if(rval.val(0, 1) == 'X' || rval.val(0, 1) > mat.val(n, 1)) rval.setVal(0, 1, mat.val(n, 1));
			if(rval.val(1, 0) == 'X' || rval.val(1, 0) < mat.val(n, 0)) rval.setVal(1, 0, mat.val(n, 0));
			if(rval.val(1, 1) == 'X' || rval.val(1, 1) < mat.val(n, 1)) rval.setVal(1, 1, mat.val(n, 1));
		}

	}else{
		// we can assume that it's an array of scalars
		for(n = 0; n < arguments[0].length; n+= 2){
			x = arguments[0][n] * 1;
			y = arguments[0][n + 1] * 1;
			if(minx == undefined || x < minx) minx = x;
			if(maxx == undefined || x > maxx) maxx = x;
			if(miny == undefined || y < miny) miny = y;
			if(maxy == undefined || y > maxy) maxy = y;
		}
		rval = [minx, miny, maxx, maxy];
	}
	return rval;
}

// checks to see if the polygon defined by the points in the array "corners"
// contains the point (x, y).  Note that this ~only~ works for convex polygons
// FIXME: this currently works only with an d array of corners.  This needs to
// be fixed to receive matrixClass objects too.
function polyContains(x, y, corners){
	var n, m, tally = 0;
	var numCorners = corners.length;
	var returnval = false;

	for(n = 0; n < numCorners; n++){
		m = (n + 1) % numCorners;
		tally += sideOfLine(
			corners[n][0], corners[n][1],
			corners[m][0], corners[m][1],
			x, y);
	}
	if(Math.abs(tally) == numCorners) returnval = true;
	return returnval;
}

// returns the point on line segment (x1, y1)-(x2, y2) that is closest to point {px, py}
// FIXME: needs to be updated to work with matrixClass
function projectOnSegment(x1, y1, x2, y2, px,py){
	var returnval = undefined;
	var u, dx, dy, hyp, projx, projy;
	dx = x2 - x1;
	dy = y2 - y1;

	// Note that hyp is not actually the hypotenuse length, but it's square
	hyp = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
	if(hyp != 0){
		u = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / hyp;
		projx = x1 + u * dx;
		projy = y1 + u * dy;
		/** now (projx, projy) is the projection of (px, py) onto (x1, y1)-(x2, y2).
		 * The "if" accounts for vertical and horizontal lines.
		 **/

		if(x1 != x2){
			if(Math.sign(projx - x1) != Math.sign(projx - x2)) returnval = {x:projx, y:projy};
			else if(projx > x2) returnval = {x:x2, y:y2};
			else if(projx < x1) returnval = {x:x1, y:y1};
		}else{
			if(Math.sign(projy - y1) != Math.sign(projy - y2)) returnval = {x:projx, y:projy};
			else if(projy > y2) returnval = {x:x2, y:y2};
			else if(projy < y1) returnval = {x:x1, y:y1};
		}
	}
	return returnval;
}
