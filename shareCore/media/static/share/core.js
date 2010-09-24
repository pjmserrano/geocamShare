// __BEGIN_LICENSE__
// Copyright (C) 2008-2010 United States Government as represented by
// the Administrator of the National Aeronautics and Space Administration.
// All Rights Reserved.
// __END_LICENSE__

var geocamShare = {};

geocamShare.core = {

    // these variables will be initialized to constant values derived from django settings
    MAP_BACKEND: null,
    SCRIPT_NAME: null,
    SERVER_ROOT_URL: null,
    MEDIA_URL: null,
    DATA_URL: null,

    // globals
    featuresG: [],
    newFeaturesG: null,
    highlightedFeatureG: null,
    visibleFeaturesG: null,
    mapViewChangeTimeoutG: null,
    mapG: null,
    galleryG: null,
    debugObjectG: null,
    widgetManagerG: null,
    viewportG: "",
    viewIndexUuidG: null,
    switcherG: null,
    
    updateFeature: function (feature) {
        // update one feature whose meta-data has changed

        var oldFeature = geocamShare.core.featuresByUuidG[feature.uuid];
        if (oldFeature.visibleIndex != null) {
            feature.visibleIndex = oldFeature.visibleIndex;
            geocamShare.core.visibleFeaturesG[oldFeature.visibleIndex] = feature;
        }
        geocamShare.core.featuresByUuidG[feature.uuid] = feature;

        var diff = {featuresToDelete: [oldFeature],
                    featuresToAdd: [feature]};
        geocamShare.core.widgetManagerG.updateFeatures(geocamShare.core.featuresG, diff);
    },

    reloadFeatures: function (query) {
        var url = geocamShare.core.SCRIPT_NAME + "features.json";
        if (query != null) {
            url += '?q=' + escape(query);
        }
        $.getJSON(url,
	          function (features) {
                      geocamShare.core.newFeaturesG = features;
                      geocamShare.core.setViewIfReady();
                  });

        return false;
    },

    runSearch: function (query) {
        geocamShare.core.queryG = query;
        geocamShare.core.widgetManagerG.notifyLoading();
        geocamShare.core.reloadFeatures(query);
        geocamShare.core.setSessionVars({'q': query});
        return false;
    },
    
    init: function () {
        // fetch JSON features and start map loading in parallel
        var mapFactory;
        if (geocamShare.core.MAP_BACKEND == "earth") {
            mapFactory = geocamShare.core.EarthApiMapViewer.factory;
        } else if (geocamShare.core.MAP_BACKEND == "maps") {
            mapFactory = geocamShare.core.MapsApiMapViewer.factory;
        } else {
            mapFactory = geocamShare.core.StubMapViewer.factory;
        }
        
        geocamShare.core.widgetManagerG = new geocamShare.core.WidgetManager();
        geocamShare.core.widgetManagerG.setWidgetForDomId("mapContainer", mapFactory);
        geocamShare.core.mapG = geocamShare.core.widgetManagerG.activeWidgets["mapContainer"];
        geocamShare.core.widgetManagerG.setWidgetForDomId("galleryContainer", geocamShare.core.SidebarSwitcher.factory);
        
        if (geocamShare.core.queryG != "") {
            var searchBox = $('#searchBox');
            searchBox.val(geocamShare.core.queryG);
            searchBox.css('color', '#000');
        }
        geocamShare.core.setViewIfReady();
        // set up menus
        //$(function() { $('#jd_menu').jdMenu(); });
    },
    
    uuidMap: function (features) {
        var result = {};
        $.each(features,
               function (i, feature) {
                   result[feature.uuid] = feature;
               });
        return result;
    },
    
    diffFeatures: function (oldFeatures, newFeatures) {
        $.each(oldFeatures,
               function (i, feature) {
                   feature.keep = false;
               });
        
        var oldFeaturesByUuid = geocamShare.core.uuidMap(oldFeatures);
        
        var diff = {};
        diff.featuresToAdd = [];
        $.each(newFeatures,
               function (i, feature) {
                   var matchingOldFeature = oldFeaturesByUuid[feature.uuid];
                   if (matchingOldFeature == null || matchingOldFeature.version != feature.version) {
                       diff.featuresToAdd.push(feature);
                   } else {
                       matchingOldFeature.keep = true;
                       if (matchingOldFeature.mapObject != undefined) {
                           feature.mapObject = matchingOldFeature.mapObject;
                       }
                   }
               });
        
        diff.featuresToDelete = [];
        $.each(oldFeatures,
               function (i, feature) {
                   if (!feature.keep) {
                       diff.featuresToDelete.push(feature);
                   }
               });
        
        return diff;
    },
    
    getFeatureThumbnailUrl: function (feature, width) {
        if (feature.type == "Track") {
            // FIX: should have thumbnails generated so we can respect width argument
            return geocamShare.core.MEDIA_URL + "share/gpsTrack.png";
        } else {
            // for images
            return geocamShare.core.getThumbnailUrl(feature, width);
        }
    },
    
    getFeatureThumbSize: function (feature) {
        if (feature.type == "Track") {
            return [160, 120];
        } else {
            return [feature.w, feature.h];
        }
    },
    
    getFeatureDetailImageHtml: function (feature) {
        var w0 = geocamShare.core.DESC_THUMB_SIZE[0];
        var scale = geocamShare.core.DESC_THUMB_SIZE[0] / geocamShare.core.GALLERY_THUMB_SIZE[0];
        var galThumbSize = geocamShare.core.getFeatureThumbSize(feature);
        var tw = galThumbSize[0];
        var th = galThumbSize[1];
        return ''
            + '<a href="' + geocamShare.core.getViewerUrl(feature) + '"\n'
            + '   target="_blank"\n'
            + '   title="View full-res image">\n'
	    + '  <img'
	    + '    src="' + geocamShare.core.getIconGalleryUrl(feature)  + '"'
	    + '    width="32"'
	    + '    height="32"'
	    + '    style="border-width: 0px; position: absolute; z-index: 100;"'
	    + '  />'
            + '  <img\n'
            + '    src="' + geocamShare.core.getFeatureThumbnailUrl(feature, w0) + '"\n'
            + '    width="' + tw*scale + '"\n'
            + '    height="' + th*scale + '"\n'
            + '    border="0"'
            + '  />\n'
            + '</a>\n';
    },

    getFeatureBalloonHtml: function (feature) {
        return ''
            + '<div>\n'
            + '  ' + geocamShare.core.getFeatureDetailImageHtml(feature)
            + '  ' + geocamShare.core.getCaptionHtml(feature)
            + '  <div style="margin-top: 10px;"><a href="' + geocamShare.core.getViewerUrl(feature) + '" target="_blank">\n'
            + '    View full-res image'
            + '  </a></div>\n'
            + '  <div style="margin-top: 10px;"><a id="featureEditLink" href="' + geocamShare.core.getFeatureEditUrl(feature) + '" target="_blank">\n'
            + '    Edit photo information'
            + '  </a></div>\n'
            + '</div>\n';
    },
    
    getIconGalleryUrl: function (feature) {
        return geocamShare.core.MEDIA_URL + 'share/map/' + feature.icon.name + '.png';
    },
    
    getIconMapUrl: function (feature) {
        return geocamShare.core.MEDIA_URL + 'share/map/' + feature.icon.name + 'Point.png';
    },
    
    getIconMapRotUrl: function (feature) {
        return geocamShare.core.MEDIA_URL + 'share/mapr/' + feature.rotatedIcon.name + '.png';
    },
    
    checkFeaturesInMapViewport: function (features) {
        var filteredFeatures = geocamShare.core.mapG.getFilteredFeatures(features);
        var visibleFeatures = filteredFeatures.inViewportOrNoPosition;

        if (geocamShare.core.visibleFeaturesG != null
            && geocamShare.core.featureListsEqual(geocamShare.core.visibleFeaturesG, visibleFeatures)) return;
        
        // renumber visibleIndex values
        $.each(visibleFeatures,
               function (i, feature) {
                   feature.visibleIndex = i;
               });

        var numFeatures = features.length;
        var numInViewport = filteredFeatures.inViewport.length;
        var numNoPosition = filteredFeatures.inViewportOrNoPosition.length - numInViewport;
        var numFeaturesWithPosition = numFeatures - numNoPosition;
        fhtml = numInViewport + ' of '
	    + numFeaturesWithPosition + ' features in map view';
        $('#featuresOutOfView').html(fhtml);
        
        geocamShare.core.widgetManagerG.notifyFeaturesInMapViewport(visibleFeatures);

        geocamShare.core.visibleFeaturesG = visibleFeatures;
    },
    
    getHeadingCardinal: function (yaw) {
        var i = Math.round(yaw / 22.5);
        i = i % 16;
        var directions = ['N', 'NNE', 'NE', 'ENE',
                          'E', 'ESE', 'SE', 'SSE',
                          'S', 'SSW', 'SW', 'WSW',
                          'W', 'WNW', 'NW', 'NNW'];
        return directions[i];
    },

    getGalleryThumbHtml: function (feature) {
        var w0 = geocamShare.core.GALLERY_THUMB_SIZE[0];
        var h0 = geocamShare.core.GALLERY_THUMB_SIZE[1];
        var galThumbSize = geocamShare.core.getFeatureThumbSize(feature);
        var tw = galThumbSize[0];
        var th = galThumbSize[1];
        return "<td"
	    + " id=\"" + feature.uuid + "\""
	    + " style=\""
	    + " vertical-align: top;"
	    + " width: " + (w0+10) + "px;"
	    + " height: " + (h0+10) + "px;"
	    + " margin: 0px 0px 0px 0px;"
	    + " border: 0px 0px 0px 0px;"
	    + " padding: 0px 0px 0px 0px;"
	    + "\">"
	    + "<div"
	    + " style=\""
	    + " width: " + tw + "px;"
	    + " height: " + th + "px;"
	    + " margin: 0px 0px 0px 0px;"
	    + " border: 0px 0px 0px 0px;"
	    + " padding: 5px 5px 5px 5px;"
	    + "\">"
	    + "<img"
	    + " src=\"" + geocamShare.core.getIconGalleryUrl(feature)  + "\""
	    + " width=\"16\""
	    + " height=\"16\""
	    + " style=\"position: absolute; z-index: 100;\""
	    + "/>"
	    + "<img"
	    + " src=\"" + geocamShare.core.getFeatureThumbnailUrl(feature, w0) + "\""
	    + " width=\"" + tw + "\""
	    + " height=\"" + th + "\""
	    + "/>"
	    + "</div>"
	    + "</td>";
    },
    
    getHostUrl: function (noHostUrl) {
        return window.location.protocol + '//' + window.location.host;
    },
    
    getImageKml: function (feature) {
        var iconUrl = geocamShare.core.getHostUrl() + geocamShare.core.getIconMapUrl(feature);
        return ''
	    + '<Placemark id="' + feature.uuid + '">\n'
	    + '  <Style>\n'
	    + '    <IconStyle>\n'
	    + '      <Icon>\n'
	    + '        <href>' + iconUrl + '</href>\n'
	    + '      </Icon>\n'
	    + '      <heading>' + feature.yaw + '</heading>\n'
	    + '    </IconStyle>\n'
	    + '  </Style>\n'
	    + '  <Point>\n'
	    + '    <coordinates>' + feature.longitude + ',' + feature.latitude + '</coordinates>\n'
	    + '  </Point>\n'
	    + '</Placemark>\n';
    },
    
    getTrackLine: function (track) {
        result = ''
            + '    <LineString>\n'
            + '      <coordinates>\n';
        for (var i=0; i < track.length; i++) {
            var pt = track[i];
            result += '        ' + pt[0] + ',' + pt[1] + ',' + pt[2] + '\n'
        }
        result += ''
            + '      </coordinates>\n'
            + '    </LineString>\n';
        return result;
    },
    
    getTrackKml: function (feature) {
        var iconUrl = geocamShare.core.getHostUrl() + geocamShare.core.getIconMapUrl(feature);
        result = ''
	    + '<Placemark id="' + feature.uuid + '">\n'
	    + '  <Style>\n'
	    + '    <IconStyle>\n'
	    + '      <Icon>\n'
	    + '        <href>' + iconUrl + '</href>'
	    + '      </Icon>\n'
	    + '    </IconStyle>\n'
	    + '    <LineStyle>\n'
	    + '      <color>ff0000ff</color>\n'
	    + '      <width>4</width>\n'
	    + '    </LineStyle>\n'
	    + '  </Style>\n'
	    + '  <MultiGeometry>\n';
        var coords = feature.geometry.geometry;
        for (var i=0; i < coords.length; i++) {
            result += geocamShare.core.getTrackLine(coords[i]);
        }
        result += ''
            + '  </MultiGeometry>\n'
	    + '</Placemark>\n';
        
        return result;
    },
    
    getFeatureKml: function (feature) {
        if (geocamShare.core.isImage(feature)) {
            return geocamShare.core.getImageKml(feature);
        } else if (feature.type == "Track") {
            return geocamShare.core.getTrackKml(feature);
        } else {
            return "";
        }
    },
    
    wrapKml: function (text) {
        return '<?xml version="1.0" encoding="UTF-8"?>\n'
	    + '<kml xmlns="http://www.opengis.net/kml/2.2">\n'
            + text
            + '</kml>';
    },
    
    getKmlForFeatures: function (features) {
        var kml = ''
	    + '  <Document id="allFeatures">\n';
        $.each(features,
               function (uuid, feature) {
                   kml += geocamShare.core.getFeatureKml(feature);
               })
            kml += ''
	    + '  </Document>\n';
        return geocamShare.core.wrapKml(kml);
    },
    
    handleMapViewChange0: function () {
        if (geocamShare.core.mapG.boundsAreSet) {
            geocamShare.core.setSessionVars({'v': geocamShare.core.mapG.getViewport()});
        }
	geocamShare.core.checkFeaturesInMapViewport(geocamShare.core.featuresG);
    },

    handleMapViewChange: function () {
        // this is a guarding wrapper around handleMapViewChange0(), which does the real work

        if (geocamShare.core.mapViewChangeTimeoutG != null) {
	    // avoid handling the same move many times -- clear the old timeout first
	    clearTimeout(geocamShare.core.mapViewChangeTimeoutG);
        }
        geocamShare.core.mapViewChangeTimeoutG = setTimeout(function () {
            geocamShare.core.handleMapViewChange0();
	}, 250);
    },
    
    featureListsEqual: function (a, b) {
        // featureLists are defined to be equal if their features have the same uuids.
        // this must be true if they have the same length and the uuids of b
        // are a subset of the uuids of a.
        
        if (a.length != b.length) return false;
        
        var amap = geocamShare.core.uuidMap(a);
        for (var i=0; i < b.length; i++) {
            if (amap[b[i].uuid] == undefined) {
                return false;
            }
        }
        
        return true;
    },
    
    getPagerHtml: function (numPages, pageNum, pageNumToUrl) {
        function pg0(pageNum, text) {
            return '<a href="' + pageNumToUrl(pageNum) + '">' + text + '</a>';
        }
        
        function pg(pageNum) {
            return pg0(pageNum, pageNum);
        }
        
        function disabled(text) {
            return '<span style="color: #999999">' + text + '</span>';
        }
        
        var dotsWidth = 19;
        var numWidth = 15 * Math.ceil(Math.log(numPages)/Math.log(10));
        var divWidth = 2*dotsWidth + 3*numWidth;
        
        if (numPages <= 1) {
            return "&nbsp;";
        }
        
        ret = [];
        if (pageNum > 1) {
	    ret.push(pg0(pageNum-1, '&laquo; previous'));
        } else {
            ret.push(disabled('&laquo; previous'));
        }
        ret.push('<div style="width: ' + divWidth + 'px; text-align: center; display: inline-block;">');
        if (pageNum > 1) {
	    ret.push(pg(1));
        }
        if (pageNum > 2) {
            ret.push('...');
	    /*if (pageNum > 3) {
	      ret.push('...');
	      }
	      ret.push(pg(pageNum-1));*/
        }
        if (numPages > 1) {
            ret.push('<b>' + pageNum + '</b>');
        }
        if (pageNum < numPages-1) {
            ret.push('...');
            /*
	      ret.push(pg(pageNum+1));
	      if (pageNum < numPages-2) {
	      ret.push('...');
              }*/
        }
        if (pageNum < numPages) {
	    ret.push(pg(numPages));
        }
        ret.push('</div>');
        if (pageNum < numPages) {
	    ret.push(pg0(pageNum+1, 'next &raquo;'));
        } else {
	    ret.push(disabled('next &raquo;'));
        }
        return ret.join(' ');
    },
    
    setSessionVars: function (varMap) {
        var url = geocamShare.core.SCRIPT_NAME + 'setVars';
        var sep = '?';
        $.each(varMap,
               function (key, val) {
                   url += sep + key + '=' + escape(val);
                   sep = '&';
               });
        $.get(url);
    },    
    
    setView: function (oldFeatures, newFeatures) {
        var diff = geocamShare.core.diffFeatures(oldFeatures, newFeatures);
        geocamShare.core.widgetManagerG.updateFeatures(newFeatures, diff);
        geocamShare.core.handleMapViewChange();
    },
    
    setViewIfReady: function () {
        if (geocamShare.core.mapG != null && geocamShare.core.mapG.isReady && geocamShare.core.newFeaturesG != null) {
            var oldFeatures = geocamShare.core.featuresG;
            geocamShare.core.featuresG = geocamShare.core.newFeaturesG;
            geocamShare.core.featuresByUuidG = geocamShare.core.uuidMap(geocamShare.core.featuresG);
            geocamShare.core.newFeaturesG = null;
	    geocamShare.core.setView(oldFeatures, geocamShare.core.featuresG);
        }
    }
};
