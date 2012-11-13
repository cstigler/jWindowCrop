
/*
 * jWindowCrop v1.0.0
 *
 * Copyright (c) 2012 Tyler Brown
 * Licensed under the MIT license.
 *
 */

(function($){
	function fillContainer(val, targetLength, containerLength) { // ensure that no gaps are between target's edges and container's edges
		if(val + targetLength < containerLength) val = containerLength-targetLength;
		if(val > 0) val = 0;
		return val;
	}

	$.jWindowCrop = function(image, options){
		var base = this;
		base.$image = $(image); // target image jquery element
		base.originalHeight = base.$image.css('height');
		base.originalWidth = base.$image.css('width');
		base.image = image; // target image dom element
		base.$image.data("jWindowCrop", base); // target frame jquery element

		base.namespace = 'jWindowCrop';
		base.originalWidth = 0;
		base.isDragging = false;
		
		base.init = function(){
			base.$image.css({display:'none'}); // hide image until loaded
			base.options = $.extend({},$.jWindowCrop.defaultOptions, options);
			if(base.options.zoomSteps < 2) base.options.zoomSteps = 2;

			base.$image.addClass('jwc_image').wrap('<div class="jwc_frame" />'); // wrap image in frame
			base.$frame = base.$image.parent();
			base.$frame.append($('<span class="jwc_loading_text">').text(base.options.loadingText));
			base.$frame.append('<div class="jwc_controls" style="display:'+(base.options.showControlsOnStart ? 'block' : 'none')+';"><span>click to drag</span><a href="#" class="jwc_zoom_in"></a><a href="#" class="jwc_zoom_out"></a></div>');
			base.$frame.css({'overflow': 'hidden', 'position': 'relative', 'width': base.options.targetWidth, 'height': base.options.targetHeight});
			base.$image.css({'position': 'absolute', 'top': '0px', 'left': '0px'});
			initializeDimensions();

			base.$frame.find('.jwc_zoom_in').on('click.'+base.namespace, base.zoomIn);
			base.$frame.find('.jwc_zoom_out').on('click.'+base.namespace, base.zoomOut);
			base.$frame.on('mouseenter.'+base.namespace, handleMouseEnter);
			base.$frame.on('mouseleave.'+base.namespace, handleMouseLeave);
			base.$image.on('load.'+base.namespace, handleImageLoad);
			base.$image.on('mousedown.'+base.namespace, handleMouseDown);
			$(document).on('mousemove.'+base.namespace, handleMouseMove);
			$(document).on('mouseup.'+base.namespace, handleMouseUp);
		};

		base.setZoom = function(percent) {
			// if(base.minPercent >= 2) {
			// 	percent = base.minPercent;
			// } else if(percent > 2.0) {
			// 	percent = 2;
			// } else if(percent < base.minPercent) {
			// 	percent = base.minPercent;	
			// }

			var newWidth = Math.ceil(base.originalWidth*percent);
			var newHeight = Math.ceil(base.originalHeight*percent);

			if( (newWidth < 20 && newWidth < base.originalWidth) ||
			 	(newHeight < 20 && newHeight < base.originalHeight) ) {
				// minimum width/height for zoom
				return;
			}

			base.$image.width(newWidth);
			base.$image.height(newHeight);
			base.workingPercent = percent;

			var offset = base.$image.offset();
			var left = offset.left;
			var top = offset.top;

			if(left < -newWidth + 10) base.$image.css('left', (-imgWidth + 10) + 'px');
			if(top < -newHeight + 10) base.$image.css('top', (-imgHeight + 10) + 'px');

			updateResult();
		};
		base.zoomIn = function() {
			var zoomIncrement = 5.0 / (base.options.zoomSteps-1);
			base.setZoom(base.workingPercent+zoomIncrement);
			return false;
		};
		base.zoomOut = function() {
			var zoomIncrement = 5.0 / (base.options.zoomSteps-1);
			base.setZoom(base.workingPercent-zoomIncrement);
			return false;
		};
		base.reset = function() {
			base.originalWidth = 0;
			base.originalHeight = 0;
			base.options.cropX = null;
			base.options.cropY = null;
			base.options.cropW = null;
			base.options.cropH = null;
			base.workingPercent = null;
			base.$image.width('');
			base.$frame.css({'width': base.options.targetWidth, 'height': base.options.targetHeight});
			initializeDimensions();
		};
		base.destroy = function() {
			// remove event handlers
			base.$image.off('load.'+base.namespace, handleImageLoad);
			base.$image.off('mousedown.'+base.namespace, handleMouseDown);
			$(document).off('mousemove.'+base.namespace, handleMouseMove);
			$(document).off('mouseup.'+base.namespace, handleMouseUp);
			base.$image.css({display:''}); // re-show image
			// clear out the positioning info we added
			base.$image.css({'position': '', 'top': '', 'left': '', 'width':base.originalWidth, 'height':base.originalHeight});
			// remove the controls
			base.$frame.find('.jwc_controls').remove();
			// remove the "loading" text
			base.$frame.find('.jwc_loading_text').remove();
			// remove the css from the image and then unwrap the frame from the image
			base.$image.removeClass('jwc_image').unwrap(); // unwrap image from the frame
			base.$frame = null;
			base.$image = null;
		};

		function initializeDimensions() {
			if(base.originalWidth == 0) {
				base.originalWidth = base.$image.width();
				base.originalHeight = base.$image.height();
			}
			if(base.originalWidth > 0) {
				// now if they've set initial width and height, calculate the
				// starting zoom percentage. 
				if (base.options.cropW!==null && base.options.cropW!=='' && base.options.cropW !== undefined && base.options.cropH!==null && base.options.cropH!=='' && base.options.cropH !== undefined) {
					widthRatio = base.options.cropW / base.originalWidth;
					heightRatio = base.options.cropH / base.originalHeight;
					var cropPercent = Math.min(widthRatio, heightRatio);
					// if(widthRatio >= heightRatio) {
					// 	var cropPercent = (base.originalWidth < base.options.targetWidth) ? (base.options.targetWidth / base.originalWidth) : widthRatio;
					// } else {
					// 	var cropPercent = (base.originalHeight < base.options.targetHeight) ? (base.options.targetHeight / base.originalHeight) : heightRatio;
					// }
				} else {
					// If they didn't specify anything then fit to target
					widthRatio = base.options.targetWidth / base.originalWidth;
					heightRatio = base.options.targetHeight / base.originalHeight;

					// average of the fit for width and height, but never zoom it in beyond 1
					var cropPercent = Math.min((widthRatio + heightRatio) / 2, 1);
				}

				// for the initial zoom we'll just jump into the center of the image.
				base.focalPoint = {'x': Math.round(base.originalWidth/2), 'y': Math.round(base.originalHeight/2)};
				base.setZoom(cropPercent);

				// now if presets x&y have been passed, then we have to slide over 
				// to the new position after zooming. Why after? because the initial
				// position might not be valid until after we zoom...
				if (base.options.cropX!==null && base.options.cropX!=='' && base.options.cropY!==null && base.options.cropY!=='') {
					base.$image.css({
						'left' : Math.round(parseFloat(base.options.cropX)) + 'px',
						'top' : Math.round(parseFloat(base.options.cropY)) + 'px'
					});
					storeFocalPoint();
					// make sure we notify the onChange function about this...
					updateResult();
				}

				// now that we've loaded and positioned the image, we can display it
				base.$image.fadeIn('fast'); 
			}
		}
		function storeFocalPoint() {
			var x = (parseInt(base.$image.css('left'))*-1 + base.options.targetWidth/2) / base.workingPercent;
			var y = (parseInt(base.$image.css('top'))*-1 + base.options.targetHeight/2) / base.workingPercent;
			base.focalPoint = {'x': Math.round(x), 'y': Math.round(y)};
		}
		function updateResult() {
			base.result = {
				left: Math.round(parseFloat(base.$image.css('left'))),
				top: Math.round(parseFloat(base.$image.css('top'))),
				width: Math.round(base.$image.width()),
				height: Math.round(base.$image.height())
			};
			base.options.onChange.call(base.image, base.result);
		}
		function handleImageLoad() {
			base.$frame.find('.jwc_loading_text').remove();
			initializeDimensions();
		}
		function handleMouseDown(event) {
			event.preventDefault(); //some browsers do image dragging themselves
			base.isDragging = true;
			base.dragMouseCoords = {x: event.pageX, y: event.pageY};
			base.dragImageCoords = {x: parseInt(base.$image.css('left')), y: parseInt(base.$image.css('top'))}
		}
		function handleMouseUp() {
			base.isDragging = false;
		}
		function handleMouseMove(event) {
			if(base.isDragging) {
				// NEW: 
				var xDif = event.pageX - base.dragMouseCoords.x;
				var yDif = event.pageY - base.dragMouseCoords.y;

				var contWidth = base.options.targetWidth;
				var contHeight = base.options.targetHeight;

				var imgWidth = base.$image.width();
				var imgHeight = base.$image.height();

				var newLeft = base.dragImageCoords.x + xDif;
				var newTop = base.dragImageCoords.y + yDif;

				if(newLeft < -imgWidth + 10) newLeft = -imgWidth + 10;
				else if(newLeft > contWidth - 10) newLeft = contWidth - 10;

				if(newTop < -imgHeight + 10) newTop = -imgHeight + 10;
				else if(newTop > contHeight - 36) newTop = contHeight - 36;

				// OLD:
				// var xDif = event.pageX - base.dragMouseCoords.x;
				// var yDif = event.pageY - base.dragMouseCoords.y;
				// var newLeft = base.dragImageCoords.x + xDif;
				// var newTop = base.dragImageCoords.y + yDif;

				base.$image.css({'left' : (newLeft.toString()+'px'), 'top' : (newTop.toString()+'px')});
				storeFocalPoint();
				updateResult();
			}
		}
		function handleMouseEnter() {
			if(base.options.smartControls) base.$frame.find('.jwc_controls').fadeIn('fast');
		}
		function handleMouseLeave() {
			if(base.options.smartControls) base.$frame.find('.jwc_controls').fadeOut('fast');
		}
		
		base.init();
	};
	
	$.jWindowCrop.defaultOptions = {
		targetWidth: 320,
		targetHeight: 180,
		zoomSteps: 40,
		loadingText: 'Loading...',
		smartControls: true,
		showControlsOnStart: true,
		cropX: null,
		cropY: null,
		cropW: null,
		cropH: null,
		onChange: function() {}
	};
	
	$.fn.jWindowCrop = function(options){
		return this.each(function(){
			(new $.jWindowCrop(this, options));
		});
	};
	
	$.fn.getjWindowCrop = function(){
		return this.data("jWindowCrop");
	};
})(jQuery);

