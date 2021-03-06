angular.module( "ui.rCalendar.tpls", [ "src/calendar-tpls.html","src/month-day-tpls.html" ] );
//todo: renomear eventos: titleChanged -> monthChanged  | timeSelected -> dateSelected
//todo: aplicar tema material
angular.module( 'ui.rCalendar', [ 'ui.rCalendar.tpls' ] );
angular.module( 'ui.rCalendar' ).directive( 'calendar', function calendarDirective() {
    'use strict';
    return {
        restrict: 'EA',
        replace: true,
        templateUrl: 'src/calendar-tpls.html',
        bindToController: true,
        controllerAs: 'vm',
        scope: {
            rangeChanged: '&',
            eventSelected: '&',
            timeSelected: '&',
            titleChanged: '&'
        },
        require: [ 'calendar', '?^ngModel' ],
        controller: 'ui.rCalendar.CalendarController',
        link: function( scope, element, attrs, ctrls ) {
            var calendarCtrl = ctrls[ 0 ];
            var ngModelCtrl = ctrls[ 1 ];

            if ( ngModelCtrl ) {
                calendarCtrl.init( ngModelCtrl );
            }

            scope.$on( 'changeDate', function( event, direction ) {
                calendarCtrl.slideView( direction );
            } );

            scope.$on( 'eventSourceChanged', function( event, value ) {
                calendarCtrl.onEventSourceChanged( value );
            } );
        }
    };
} );
angular.module( 'ui.rCalendar' ).constant( 'calendarConfig', {
    formatDay: 'dd',
    formatDayHeader: 'EEE',
    formatMonthTitle: 'MMMM yyyy',
    formatHourColumn: 'dd MMMM, HH:mm',
    showEventDetail: true,
    startingDayMonth: 0,
    startingDayWeek: 0,
    allDayLabel: 'O dia todo',
    noEventsLabel: 'Nenhum evento encontrado',
    eventSources: null,
    queryMode: 'local'
} );
angular.module( 'ui.rCalendar' ).controller( 'ui.rCalendar.CalendarController', CalendarController );

CalendarController.$inject = [
    '$scope',
    '$attrs',
    '$parse',
    '$interpolate',
    '$log',
    'dateFilter',
    'calendarConfig',
    '$timeout',
    '$ionicSlideBoxDelegate',
    '$ionicScrollDelegate'
];

function CalendarController( $scope, $attrs, $parse, $interpolate, $log, dateFilter, calendarConfig, $timeout, $ionicSlideBoxDelegate, $ionicScrollDelegate ) {
    'use strict';
    var vm = this;
    var ngModelCtrl = { $setViewValue: angular.noop }; // nullModelCtrl;
    var ionicScrollHandle = $ionicScrollDelegate.$getByHandle( 'event-detail-container' );

    // Configuration attributes
    angular.forEach( [
        'formatDay',
        'formatDayHeader',
        'formatMonthTitle',
        'formatHourColumn',
        'allDayLabel',
        'noEventsLabel',
        'showEventDetail',
        'eventSources',
        'queryMode',
        'step',
        'startingDayMonth',
        'startingDayWeek'
    ], function( key, index ) {
        vm[ key ] = angular.isDefined( $attrs[ key ] ) ? ( index < 6 ? $interpolate( $attrs[ key ] )( $scope.$parent ) : $scope.$parent.$eval( $attrs[ key ] ) ) : calendarConfig[ key ];
    } );

    vm.mode = {
        step: { months: 1 }
    };

    $scope.$parent.$watchCollection( $attrs.eventSources, function( value ) {
        vm.onEventSourceChanged( value );
    } );

    if ( angular.isDefined( $attrs.initDate ) ) {
        vm.currentCalendarDate = $scope.$parent.$eval( $attrs.initDate );
    }
    if ( !vm.currentCalendarDate ) {
        vm.currentCalendarDate = new Date();
        if ( $attrs.ngModel && !$scope.$parent.$eval( $attrs.ngModel ) ) {
            $parse( $attrs.ngModel ).assign( $scope.$parent, vm.currentCalendarDate );
        }
    }

    vm.init = function( ngModelCtrl_ ) {
        ngModelCtrl = ngModelCtrl_;

        ngModelCtrl.$render = function() {
            vm.render();
        };
    };

    vm.render = function() {
        var date;
        var isValid;

        if ( ngModelCtrl.$modelValue ) {
            date = new Date( ngModelCtrl.$modelValue );
            isValid = !isNaN( date );

            if ( isValid ) {
                vm.currentCalendarDate = date;
            } else {
                $log.error( '"ng-model" value must be a Date object, a number of milliseconds since 01.01.1970 or a string representing an RFC2822 or ISO 8601 date.' );
            }
            ngModelCtrl.$setValidity( 'date', isValid );
        }
        vm.refreshView();
    };

    vm.refreshView = function() {
        if ( vm.mode ) {
            vm.range = getRange( vm.currentCalendarDate );
            if ( vm.titleChanged ) {
                vm.titleChanged( { title: getTitle() } );
            }

            vm.populateAdjacentViews();
            updateCurrentView( vm.range.startTime, vm.views[ vm.currentViewIndex ] );
            rangeChanged();
        }
    };

    vm.split = function( arr, size ) {
        var arrays = [];
        while ( arr.length > 0 ) {
            arrays.push( arr.splice( 0, size ) );
        }
        return arrays;
    };

    vm.onEventSourceChanged = function( value ) {
        vm.eventSources = value;
        if ( onDataLoaded ) {
            onDataLoaded();
        }
    };

    vm.getAdjacentViewStartTime = function( direction ) {
        var adjacentCalendarDate = getAdjacentCalendarDate( vm.currentCalendarDate, direction );
        return getRange( adjacentCalendarDate ).startTime;
    };

    vm.move = function( direction ) {
        vm.direction = direction;
        if ( vm.moveOnSelected ) {
            vm.moveOnSelected = false;
        } else {
            vm.currentCalendarDate = getAdjacentCalendarDate( vm.currentCalendarDate, direction );
        }
        ngModelCtrl.$setViewValue( vm.currentCalendarDate );
        vm.refreshView();
        vm.direction = 0;
    };

    function rangeChanged() {
        if ( vm.queryMode === 'local' ) {
            if ( vm.eventSources && onDataLoaded ) {
                onDataLoaded();
            }
        } else if ( vm.queryMode === 'remote' ) {
            if ( vm.rangeChanged ) {
                vm.rangeChanged( {
                    startTime: vm.range.startTime,
                    endTime: vm.range.endTime
                } );
            }
        }
    }

    vm.registerSlideChanged = function() {
        vm.currentViewIndex = 0;
        vm.slideChanged = function( $index ) {

            var currentViewIndex;
            var direction;

            $timeout( function() {
                currentViewIndex = vm.currentViewIndex;
                direction = 0;
                if ( $index - currentViewIndex === 1 || ( $index === 0 && currentViewIndex === 2 ) ) {
                    direction = 1;
                } else if ( currentViewIndex - $index === 1 || ( $index === 2 && currentViewIndex === 0 ) ) {
                    direction = -1;
                }
                currentViewIndex = $index;
                vm.currentViewIndex = currentViewIndex;
                vm.move( direction );
                $scope.$digest();
            }, 200 );
        };
    };

    vm.populateAdjacentViews = function() {
        var currentViewStartDate;
        var currentViewData;
        var toUpdateViewIndex;
        var currentViewIndex = vm.currentViewIndex;

        if ( vm.direction === 1 ) {
            currentViewStartDate = vm.getAdjacentViewStartTime( 1 );
            toUpdateViewIndex = ( currentViewIndex + 1 ) % 3;
            angular.copy( getViewData( currentViewStartDate ), vm.views[ toUpdateViewIndex ] );
        } else if ( vm.direction === -1 ) {
            currentViewStartDate = vm.getAdjacentViewStartTime( -1 );
            toUpdateViewIndex = ( currentViewIndex + 2 ) % 3;
            angular.copy( getViewData( currentViewStartDate ), vm.views[ toUpdateViewIndex ] );
        } else {
            if ( !vm.views ) {
                currentViewData = [];
                currentViewStartDate = vm.range.startTime;
                currentViewData.push( getViewData( currentViewStartDate ) );
                currentViewStartDate = vm.getAdjacentViewStartTime( 1 );
                currentViewData.push( getViewData( currentViewStartDate ) );
                currentViewStartDate = vm.getAdjacentViewStartTime( -1 );
                currentViewData.push( getViewData( currentViewStartDate ) );
                vm.views = currentViewData;
            } else {
                currentViewStartDate = vm.range.startTime;
                angular.copy( getViewData( currentViewStartDate ), vm.views[ currentViewIndex ] );
                currentViewStartDate = vm.getAdjacentViewStartTime( -1 );
                toUpdateViewIndex = ( currentViewIndex + 2 ) % 3;
                angular.copy( getViewData( currentViewStartDate ), vm.views[ toUpdateViewIndex ] );
                currentViewStartDate = vm.getAdjacentViewStartTime( 1 );
                toUpdateViewIndex = ( currentViewIndex + 1 ) % 3;
                angular.copy( getViewData( currentViewStartDate ), vm.views[ toUpdateViewIndex ] );
            }
        }
    };

    vm.slideView = function( direction ) {
        var slideHandle = $ionicSlideBoxDelegate.$getByHandle( 'monthview-slide' );

        if ( slideHandle ) {
            if ( direction === 1 ) {
                slideHandle.next();
            } else if ( direction === -1 ) {
                slideHandle.previous();
            }
        }
    };

    vm.select = function( selectedDate ) {
        var views = vm.views;
        var dates;
        var r;
        var currentCalendarDate;
        var currentMonth;
        var currentYear;
        var selectedMonth;
        var selectedYear;
        var direction;
        var currentViewStartDate;
        var oneDay;
        var selectedDayDifference;

        if ( views ) {

            dates = views[ vm.currentViewIndex ].dates;
            currentCalendarDate = vm.currentCalendarDate;
            currentMonth = currentCalendarDate.getMonth();
            currentYear = currentCalendarDate.getFullYear();
            selectedMonth = selectedDate.getMonth();
            selectedYear = selectedDate.getFullYear();
            direction = 0;

            if ( currentYear === selectedYear ) {
                if ( currentMonth !== selectedMonth ) {
                    direction = currentMonth < selectedMonth ? 1 : -1;
                }
            } else {
                direction = currentYear < selectedYear ? 1 : -1;
            }

            vm.currentCalendarDate = selectedDate;
            if ( direction === 0 ) {
                vm.currentCalendarDate = selectedDate;
                if ( ngModelCtrl ) {
                    ngModelCtrl.$setViewValue( selectedDate );
                }

                currentViewStartDate = vm.range.startTime;
                oneDay = 86400000;
                selectedDayDifference = Math.floor( ( selectedDate.getTime() - currentViewStartDate.getTime() ) / oneDay );

                for ( r = 0; r < 42; r += 1 ) {
                    dates[ r ].selected = false;
                }

                if ( selectedDayDifference >= 0 && selectedDayDifference < 42 ) {
                    dates[ selectedDayDifference ].selected = true;
                    vm.selectedDate = dates[ selectedDayDifference ];
                    ionicScrollHandle.resize();
                }
            } else {
                vm.moveOnSelected = true;
                vm.slideView( direction );
            }

            if ( vm.timeSelected ) {
                vm.timeSelected( { selectedTime: selectedDate } );
            }
        }
    };

    vm.getHighlightClass = function( date ) {
        var className = '';

        if ( date.hasEvent ) {
            className = 'monthview-has-event';
        }

        if ( date.selected ) {
            if ( className ) {
                className += ' ';
            }
            className += 'monthview-selected';
        }

        if ( date.current ) {
            if ( className ) {
                className += ' ';
            }
            className += 'monthview-current';
        }

        if ( date.secondary ) {
            if ( className ) {
                className += ' ';
            }
            className += 'monthview-secondary';
        }
        return className;
    };

    vm.registerSlideChanged();

    //vm.refreshView();

    ////////////////////////////////////////////////////////////////////////////////////

    function getTitle() {
        var currentViewStartDate = vm.range.startTime;
        var date = currentViewStartDate.getDate();
        var month = ( currentViewStartDate.getMonth() + ( date !== 1 ? 1 : 0 ) ) % 12;
        var year = currentViewStartDate.getFullYear() + ( date !== 1 && month === 0 ? 1 : 0 );
        var headerDate = new Date( year, month, 1 );

        return dateFilter( headerDate, vm.formatMonthTitle );
    }

    function getAdjacentCalendarDate( currentCalendarDate, direction ) {
        var step = vm.mode.step;
        var calculateCalendarDate = new Date( currentCalendarDate );
        var year = calculateCalendarDate.getFullYear();
        var month = calculateCalendarDate.getMonth() + direction * ( step.months || 0 );
        var date = 1; //calculateCalendarDate.getDate(); mantem o dia selecionado
        var firstDayInNextMonth;

        calculateCalendarDate.setFullYear( year, month, date );

        firstDayInNextMonth = new Date( year, month + 1, 1 );
        if ( firstDayInNextMonth.getTime() <= calculateCalendarDate.getTime() ) {
            calculateCalendarDate = new Date( firstDayInNextMonth - 24 * 60 * 60 * 1000 );
        }
        return calculateCalendarDate;
    }

    function getViewData( startTime ) {
        var startDate = startTime;
        var date = startDate.getDate();
        var month = ( startDate.getMonth() + ( date !== 1 ? 1 : 0 ) ) % 12;
        var days = getDates( startDate, 42 );
        var i;

        for ( i = 0; i < 42; i++ ) {
            days[ i ] = angular.extend( createDateObject( days[ i ], vm.formatDay ), {
                secondary: days[ i ].getMonth() !== month
            } );
        }

        return {
            dates: days
        };
    }

    function onDataLoaded() {
        var eventSources = vm.eventSources;
        var eventSource;
        var sourceLength = eventSources ? eventSources.length : 0;
        var eventsLength;
        var startTime = vm.range.startTime;
        var endTime = vm.range.endTime;
        var timeZoneOffset = -new Date().getTimezoneOffset();
        var utcStartTime = new Date( startTime.getTime() + timeZoneOffset * 60 * 1000 );
        var utcEndTime = new Date( endTime.getTime() + timeZoneOffset * 60 * 1000 );
        var currentViewIndex = vm.currentViewIndex;
        var dates = vm.views[ currentViewIndex ].dates;
        var date;
        var oneDay = 86400000;
        var eps = 0.001;
        var r;
        var i;
        var s;
        var event;
        var eventStartTime;
        var eventEndTime;
        var st;
        var et;
        var timeDifferenceStart;
        var timeDifferenceEnd;
        var index;
        var findSelected;

        for ( r = 0; r < 42; r += 1 ) {
            date = dates[ r ];
            if ( date.hasEvent ) {
                date.hasEvent = false;
                date.events = [];
                date.eventSources = {};
            }
        }

        for ( s = 0; s < sourceLength; s += 1 ) {
            eventSource = eventSources[ s ];
            eventsLength = ( eventSource && eventSource.items ) ? eventSource.items.length : 0;

            for ( i = 0; i < eventsLength; i += 1 ) {
                event = eventSource.items[ i ];
                event.allDay = !!event.start.date; // allday event if start.date exists

                if ( event.allDay ) {
                    eventStartTime = new Date( event.start.date );
                    eventEndTime = new Date( event.end.date );
                } else {
                    eventStartTime = new Date( event.start.dateTime );
                    eventEndTime = new Date( event.end.dateTime );
                }

                if ( event.allDay ) {
                    if ( eventEndTime <= utcStartTime || eventStartTime >= utcEndTime ) {
                        continue;
                    } else {
                        st = utcStartTime;
                        et = utcEndTime;
                    }
                } else {
                    if ( eventEndTime <= startTime || eventStartTime >= endTime ) {
                        continue;
                    } else {
                        st = startTime;
                        et = endTime;
                    }
                }

                if ( eventStartTime.getDate() == eventEndTime.getDate() ) {
                    event.formatedStartTime = dateFilter( eventStartTime, 'HH:mm' );
                    event.formatedEndTime = dateFilter( eventEndTime, 'HH:mm' );
                } else {
                    event.formatedStartTime = dateFilter( eventStartTime, vm.formatHourColumn );
                    event.formatedEndTime = dateFilter( eventEndTime, vm.formatHourColumn );
                }

                /*     event.formatedStartTime = dateFilter( eventStartTime, vm.formatHourColumn );
                 event.formatedEndTime = dateFilter( eventEndTime, vm.formatHourColumn );*/

                if ( eventStartTime <= st ) {
                    timeDifferenceStart = 0;
                } else {
                    timeDifferenceStart = ( eventStartTime - st ) / oneDay;
                }

                if ( eventEndTime >= et ) {
                    timeDifferenceEnd = ( et - st ) / oneDay;
                } else {
                    timeDifferenceEnd = ( eventEndTime - st ) / oneDay;
                }

                index = Math.floor( timeDifferenceStart );

                while ( index < timeDifferenceEnd - eps ) {
                    date = dates[ index ];
                    date.hasEvent = true;

                    // add sources
                    date.events = date.events || [];
                    date.events.push( event );

                    // add sources
                    event.source = event.source || eventSource.summary;

                    date.eventSources = date.eventSources || {};
                    date.eventSources[ eventSource.etag ] = date.eventSources[ eventSource.etag ] || {
                        summary: eventSource.summary,
                        color: eventSource.color,
                        etag: eventSource.etag
                    };
                    index += 1;
                }
            }
        }

        for ( r = 0; r < 42; r += 1 ) {
            if ( dates[ r ].hasEvent ) {
                dates[ r ].events.sort( compareEvent );
            }
        }

        findSelected = false;
        for ( r = 0; r < 42; r += 1 ) {
            if ( dates[ r ].selected ) {
                vm.selectedDate = dates[ r ];
                findSelected = true;
                ionicScrollHandle.resize();
                break;
            }
            if ( findSelected ) {
                break;
            }
        }
    }

    function getRange( currentDate ) {
        var year = currentDate.getFullYear();
        var month = currentDate.getMonth();
        var firstDayOfMonth = new Date( year, month, 1 );
        var difference = vm.startingDayMonth - firstDayOfMonth.getDay();
        var numDisplayedFromPreviousMonth = ( difference > 0 ) ? 7 - difference : -difference;
        var startDate = new Date( firstDayOfMonth );
        var endDate;

        if ( numDisplayedFromPreviousMonth > 0 ) {
            startDate.setDate( -numDisplayedFromPreviousMonth + 1 );
        }

        endDate = new Date( startDate );
        endDate.setDate( endDate.getDate() + 42 );

        return {
            startTime: startDate,
            endTime: endDate
        };
    }

    function getDates( startDate, n ) {
        var dates = new Array( n );
        var current = new Date( startDate );
        var i = 0;

        current.setHours( 12 ); // Prevent repeated dates because of timezone bug

        while ( i < n ) {
            dates[ i++ ] = new Date( current );
            current.setDate( current.getDate() + 1 );
        }
        return dates;
    }

    function createDateObject( date, format ) {
        return {
            date: date,
            label: dateFilter( date, format ),
            formatedDayHeader: dateFilter( date, vm.formatDayHeader )
        };
    }

    function updateCurrentView( currentViewStartDate, view ) {
        var currentCalendarDate = vm.currentCalendarDate;
        var today = new Date();
        var oneDay = 86400000;
        var r;
        var selectedDayDifference = Math.floor( ( currentCalendarDate.getTime() - currentViewStartDate.getTime() ) / oneDay );
        var currentDayDifference = Math.floor( ( today.getTime() - currentViewStartDate.getTime() ) / oneDay );

        for ( r = 0; r < 42; r += 1 ) {
            view.dates[ r ].selected = false;
        }

        if ( selectedDayDifference >= 0 && selectedDayDifference < 42 ) {
            view.dates[ selectedDayDifference ].selected = true;
            vm.selectedDate = view.dates[ selectedDayDifference ];
            ionicScrollHandle.resize();
        } else {
            vm.selectedDate = {
                events: []
            };
            ionicScrollHandle.resize();
        }

        if ( currentDayDifference >= 0 && currentDayDifference < 42 ) {
            view.dates[ currentDayDifference ].current = true;
        }
    }

    function compareEvent( event1, event2 ) {
        if ( event1.allDay ) {
            return 1;
        } else if ( event2.allDay ) {
            return -1;
        } else {
            return ( new Date( event1.start.dateTime ).getTime() - new Date( event2.start.dateTime ).getTime() );
        }
    }
}

angular.module( 'ui.rCalendar' ).directive( 'day', function monthDayDirective() {
    'use strict';
    return {
        restrict: 'A',
        replace: true,
        templateUrl: 'src/month-day-tpls.html',
        scope: {
            day: '=',
            onSelect: '&',
            getClasses: '&'
        }
    };
} );


angular.module("src/calendar-tpls.html", []).run(["$templateCache", function ($templateCache) {
  $templateCache.put("src/calendar-tpls.html",
    "<div class=\"calendar-container\">\n" +
    "\n" +
    "	<ion-slide-box on-slide-changed=\"vm.slideChanged($index)\"\n" +
    "				   does-continue=\"true\"\n" +
    "				   show-pager=\"false\"\n" +
    "				   delegate-handle=\"monthview-slide\">\n" +
    "		<ion-slide ng-repeat=\"view in vm.views track by $index\">\n" +
    "			<table ng-if=\"$index===vm.currentViewIndex\" class=\"table table-bordered table-fixed monthview-datetable\">\n" +
    "				<thead>\n" +
    "				<tr>\n" +
    "					<th ng-repeat=\"day in view.dates.slice(0,7) track by day.date\">\n" +
    "						<small>{{::day.formatedDayHeader}}</small>\n" +
    "					</th>\n" +
    "				</tr>\n" +
    "				</thead>\n" +
    "				<tbody>\n" +
    "				<tr>\n" +
    "					<td day=\"view.dates[0]\"\n" +
    "						on-select=\"vm.select(view.dates[0].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[0])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[1]\"\n" +
    "						on-select=\"vm.select(view.dates[1].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[1])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[2]\"\n" +
    "						on-select=\"vm.select(view.dates[2].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[2])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[3]\"\n" +
    "						on-select=\"vm.select(view.dates[3].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[3])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[4]\"\n" +
    "						on-select=\"vm.select(view.dates[4].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[4])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[5]\"\n" +
    "						on-select=\"vm.select(view.dates[5].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[5])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[6]\"\n" +
    "						on-select=\"vm.select(view.dates[6].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[6])\">\n" +
    "					</td>\n" +
    "				</tr>\n" +
    "				<tr>\n" +
    "					<td day=\"view.dates[7]\"\n" +
    "						on-select=\"vm.select(view.dates[7].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[7])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[8]\"\n" +
    "						on-select=\"vm.select(view.dates[8].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[8])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[9]\"\n" +
    "						on-select=\"vm.select(view.dates[9].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[9])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[10]\"\n" +
    "						on-select=\"vm.select(view.dates[10].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[10])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[11]\"\n" +
    "						on-select=\"vm.select(view.dates[11].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[11])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[12]\"\n" +
    "						on-select=\"vm.select(view.dates[12].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[12])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[13]\"\n" +
    "						on-select=\"vm.select(view.dates[13].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[13])\">\n" +
    "					</td>\n" +
    "				</tr>\n" +
    "				<tr>\n" +
    "					<td day=\"view.dates[14]\"\n" +
    "						on-select=\"vm.select(view.dates[14].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[14])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[15]\"\n" +
    "						on-select=\"vm.select(view.dates[15].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[15])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[16]\"\n" +
    "						on-select=\"vm.select(view.dates[16].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[16])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[17]\"\n" +
    "						on-select=\"vm.select(view.dates[17].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[17])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[18]\"\n" +
    "						on-select=\"vm.select(view.dates[18].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[18])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[19]\"\n" +
    "						on-select=\"vm.select(view.dates[19].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[19])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[20]\"\n" +
    "						on-select=\"vm.select(view.dates[20].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[20])\">\n" +
    "					</td>\n" +
    "				</tr>\n" +
    "				<tr>\n" +
    "					<td day=\"view.dates[21]\"\n" +
    "						on-select=\"vm.select(view.dates[21].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[21])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[22]\"\n" +
    "						on-select=\"vm.select(view.dates[22].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[22])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[23]\"\n" +
    "						on-select=\"vm.select(view.dates[23].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[23])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[24]\"\n" +
    "						on-select=\"vm.select(view.dates[24].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[24])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[25]\"\n" +
    "						on-select=\"vm.select(view.dates[25].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[25])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[26]\"\n" +
    "						on-select=\"vm.select(view.dates[26].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[26])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[27]\"\n" +
    "						on-select=\"vm.select(view.dates[27].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[27])\">\n" +
    "					</td>\n" +
    "				</tr>\n" +
    "				<tr>\n" +
    "					<td day=\"view.dates[28]\"\n" +
    "						on-select=\"vm.select(view.dates[28].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[28])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[29]\"\n" +
    "						on-select=\"vm.select(view.dates[29].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[29])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[30]\"\n" +
    "						on-select=\"vm.select(view.dates[30].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[30])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[31]\"\n" +
    "						on-select=\"vm.select(view.dates[31].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[31])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[32]\"\n" +
    "						on-select=\"vm.select(view.dates[32].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[32])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[33]\"\n" +
    "						on-select=\"vm.select(view.dates[33].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[33])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[34]\"\n" +
    "						on-select=\"vm.select(view.dates[34].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[34])\">\n" +
    "					</td>\n" +
    "				</tr>\n" +
    "				<tr>\n" +
    "					<td day=\"view.dates[35]\"\n" +
    "						on-select=\"vm.select(view.dates[35].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[35])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[36]\"\n" +
    "						on-select=\"vm.select(view.dates[36].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[36])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[37]\"\n" +
    "						on-select=\"vm.select(view.dates[37].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[37])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[38]\"\n" +
    "						on-select=\"vm.select(view.dates[38].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[38])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[39]\"\n" +
    "						on-select=\"vm.select(view.dates[39].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[39])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[40]\"\n" +
    "						on-select=\"vm.select(view.dates[40].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[40])\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[41]\"\n" +
    "						on-select=\"vm.select(view.dates[41].date)\"\n" +
    "						get-classes=\"vm.getHighlightClass(view.dates[41])\">\n" +
    "					</td>\n" +
    "				</tr>\n" +
    "				</tbody>\n" +
    "			</table>\n" +
    "			<table ng-if=\"$index!==vm.currentViewIndex\" class=\"table table-bordered table-fixed monthview-datetable\">\n" +
    "				<thead>\n" +
    "				<tr class=\"text-center\">\n" +
    "					<th ng-repeat=\"day in view.dates.slice(0,7) track by day.date\">\n" +
    "						<small>{{::day.formatedDayHeader}}</small>\n" +
    "					</th>\n" +
    "				</tr>\n" +
    "				</thead>\n" +
    "				<tbody>\n" +
    "				<tr>\n" +
    "					<td day=\"view.dates[0]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[1]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[2]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[3]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[4]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[5]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[6]\">\n" +
    "					</td>\n" +
    "				</tr>\n" +
    "				<tr>\n" +
    "					<td day=\"view.dates[7]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[8]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[9]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[10]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[11]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[12]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[13]\">\n" +
    "					</td>\n" +
    "				</tr>\n" +
    "				<tr>\n" +
    "					<td day=\"view.dates[14]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[15]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[16]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[17]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[18]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[19]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[20]\">\n" +
    "					</td>\n" +
    "				</tr>\n" +
    "				<tr>\n" +
    "					<td day=\"view.dates[21]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[22]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[23]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[24]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[25]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[26]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[27]\">\n" +
    "					</td>\n" +
    "				</tr>\n" +
    "				<tr>\n" +
    "					<td day=\"view.dates[28]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[29]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[30]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[31]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[32]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[33]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[34]\">\n" +
    "					</td>\n" +
    "				</tr>\n" +
    "				<tr>\n" +
    "					<td day=\"view.dates[35]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[36]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[37]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[38]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[39]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[40]\">\n" +
    "					</td>\n" +
    "					<td day=\"view.dates[41]\">\n" +
    "					</td>\n" +
    "				</tr>\n" +
    "				</tbody>\n" +
    "			</table>\n" +
    "		</ion-slide>\n" +
    "	</ion-slide-box>\n" +
    "\n" +
    "	<ion-content has-bouncing=\"false\"\n" +
    "				 ng-show=\"vm.showEventDetail\"\n" +
    "				 overflow-scroll=\"false\"\n" +
    "				 class=\"event-detail-container\"\n" +
    "				 delegate-handle=\"event-detail-container\">\n" +
    "		<!--<h3>{{vm.selectedDate.events.length}}</h3>-->\n" +
    "\n" +
    "		<table class=\"table table-fixed event-detail-table\">\n" +
    "			<tr ng-repeat=\"event in vm.selectedDate.events track by event.id\"\n" +
    "				ng-click=\"vm.eventSelected({event:event})\">\n" +
    "				<td ng-if=\"event.allDay\">\n" +
    "					<div class=\"event-detail\"\n" +
    "						 ng-style=\"{'background-color': event.color }\">\n" +
    "						<div>{{::event.source}} - {{::event.summary}}</div>\n" +
    "						<div>O dia todo</div>\n" +
    "					</div>\n" +
    "				</td>\n" +
    "				<td ng-if=\"!event.allDay\">\n" +
    "					<div class=\"event-detail\"\n" +
    "						 ng-style=\"{'background-color': event.color }\">\n" +
    "						<div>{{::event.source}} - {{::event.summary}}</div>\n" +
    "						<div>\n" +
    "							{{::event.formatedStartTime}}\n" +
    "							-\n" +
    "							{{::event.formatedEndTime}}\n" +
    "						</div>\n" +
    "					</div>\n" +
    "				</td>\n" +
    "			</tr>\n" +
    "\n" +
    "			<tr ng-if=\"!vm.selectedDate.events\">\n" +
    "				<td class=\"no-event-label\">\n" +
    "					<div ng-bind=\"::vm.noEventsLabel\"></div>\n" +
    "				</td>\n" +
    "			</tr>\n" +
    "		</table>\n" +
    "	</ion-content>\n" +
    "</div>");
}]);

angular.module("src/month-day-tpls.html", []).run(["$templateCache", function ($templateCache) {
  $templateCache.put("src/month-day-tpls.html",
    "<td ng-click=\"onSelect()\"\n" +
    "	ng-class=\"getClasses()\">\n" +
    "	<span class=\"date-label\">{{day.label}}</span>\n" +
    "	<div class=\"pins\">\n" +
    "		<span class=\"pin\"\n" +
    "			  ng-style=\"{'background-color': source.color }\"\n" +
    "			  ng-repeat=\"source in day.eventSources track by source.etag\">\n" +
    "		</span>\n" +
    "	</div>\n" +
    "</td>");
}]);
