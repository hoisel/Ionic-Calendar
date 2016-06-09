angular.module( "ui.rCalendar.tpls", [ "templates/rcalendar/calendar.html","templates/rcalendar/month.html" ] );
angular.module( 'ui.rCalendar', [ 'ui.rCalendar.tpls' ] );
angular.module( 'ui.rCalendar' ).constant( 'calendarConfig', {
    formatDay: 'dd',
    formatDayHeader: 'EEE',
    formatDayTitle: 'MMMM dd, yyyy',
    formatWeekTitle: 'MMMM yyyy, Week w',
    formatMonthTitle: 'MMMM yyyy',
    formatWeekViewDayHeader: 'EEE d',
    formatHourColumn: 'ha',
    calendarMode: 'month',
    showEventDetail: true,
    startingDayMonth: 0,
    startingDayWeek: 0,
    allDayLabel: 'all day',
    noEventsLabel: 'No Events',
    eventSource: null,
    queryMode: 'local',
    step: 60
} );

CalendarController.$inject = [
    '$scope',
    '$attrs',
    '$parse',
    '$interpolate',
    '$log',
    'dateFilter',
    'calendarConfig',
    '$timeout',
    '$ionicSlideBoxDelegate'
];

angular.module( 'ui.rCalendar' ).controller( 'ui.rCalendar.CalendarController', CalendarController );

function CalendarController( $scope, $attrs, $parse, $interpolate, $log, dateFilter, calendarConfig, $timeout, $ionicSlideBoxDelegate ) {
    'use strict';
    var vm = this;
    var ngModelCtrl = { $setViewValue: angular.noop }; // nullModelCtrl;

    // Configuration attributes
    angular.forEach( [
        'formatDay',
        'formatDayHeader',
        'formatDayTitle',
        'formatWeekTitle',
        'formatMonthTitle',
        'formatWeekViewDayHeader',
        'formatHourColumn',
        'allDayLabel',
        'noEventsLabel',
        'showEventDetail',
        'eventSource',
        'queryMode',
        'step',
        'startingDayMonth',
        'startingDayWeek'
    ], function( key, index ) {
        vm[ key ] = angular.isDefined( $attrs[ key ] ) ? ( index < 9 ? $interpolate( $attrs[ key ] )( $scope.$parent ) : $scope.$parent.$eval( $attrs[ key ] ) ) : calendarConfig[ key ];
    } );

    vm.hourParts = 1;
    if ( vm.step === 60 || vm.step === 30 || vm.step === 15 ) {
        vm.hourParts = Math.floor( 60 / vm.step );
    } else {
        throw new Error( 'Invalid step parameter: ' + vm.step );
    }

    $scope.$parent.$watch( $attrs.eventSource, function( value ) {
        vm.onEventSourceChanged( value );
    } );

    vm.calendarMode = vm.calendarMode || calendarConfig.calendarMode;
    if ( angular.isDefined( $attrs.initDate ) ) {
        vm.currentCalendarDate = $scope.$parent.$eval( $attrs.initDate );
    }
    if ( !vm.currentCalendarDate ) {
        vm.currentCalendarDate = new Date();
        if ( $attrs.ngModel && !$scope.$parent.$eval( $attrs.ngModel ) ) {
            $parse( $attrs.ngModel ).assign( $scope.$parent, vm.currentCalendarDate );
        }
    }

    function getAdjacentCalendarDate( currentCalendarDate, direction ) {
        var step = vm.mode.step;
        var calculateCalendarDate = new Date( currentCalendarDate );
        var year = calculateCalendarDate.getFullYear() + direction * ( step.years || 0 );
        var month = calculateCalendarDate.getMonth() + direction * ( step.months || 0 );
        var date = calculateCalendarDate.getDate() + direction * ( step.days || 0 );
        var firstDayInNextMonth;

        calculateCalendarDate.setFullYear( year, month, date );
        if ( vm.calendarMode === 'month' ) {
            firstDayInNextMonth = new Date( year, month + 1, 1 );
            if ( firstDayInNextMonth.getTime() <= calculateCalendarDate.getTime() ) {
                calculateCalendarDate = new Date( firstDayInNextMonth - 24 * 60 * 60 * 1000 );
            }
        }
        return calculateCalendarDate;
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
            vm.range = vm._getRange( vm.currentCalendarDate );
            if ( vm.titleChanged ) {
                vm.titleChanged( { title: vm._getTitle() } );
            }
            vm._refreshView();
            vm.rangeChanged();
        }
    };

    // Split array into smaller arrays
    vm.split = function( arr, size ) {
        var arrays = [];
        while ( arr.length > 0 ) {
            arrays.push( arr.splice( 0, size ) );
        }
        return arrays;
    };

    vm.onEventSourceChanged = function( value ) {
        vm.eventSource = value;
        if ( vm._onDataLoaded ) {
            vm._onDataLoaded();
        }
    };

    vm.getAdjacentViewStartTime = function( direction ) {
        var adjacentCalendarDate = getAdjacentCalendarDate( vm.currentCalendarDate, direction );
        return vm._getRange( adjacentCalendarDate ).startTime;
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

    vm.rangeChanged = function() {
        if ( vm.queryMode === 'local' ) {
            if ( vm.eventSource && vm._onDataLoaded ) {
                vm._onDataLoaded();
            }
        } else if ( vm.queryMode === 'remote' ) {
            if ( vm.rangeChanged ) {
                vm.rangeChanged( {
                    startTime: vm.range.startTime,
                    endTime: vm.range.endTime
                } );
            }
        }
    };

    vm.registerSlideChanged = function( scope ) {
        scope.currentViewIndex = 0;
        scope.slideChanged = function( $index ) {

            var currentViewIndex;
            var direction;

            $timeout( function() {
                currentViewIndex = scope.currentViewIndex;
                direction = 0;
                if ( $index - currentViewIndex === 1 || ( $index === 0 && currentViewIndex === 2 ) ) {
                    direction = 1;
                } else if ( currentViewIndex - $index === 1 || ( $index === 2 && currentViewIndex === 0 ) ) {
                    direction = -1;
                }
                currentViewIndex = $index;
                scope.currentViewIndex = currentViewIndex;
                vm.move( direction );
                scope.$digest();
            }, 200 );
        };
    };

    vm.populateAdjacentViews = function( scope ) {
        var currentViewStartDate;
        var currentViewData;
        var toUpdateViewIndex;
        var currentViewIndex = scope.currentViewIndex;
        var getViewData = vm._getViewData;

        if ( vm.direction === 1 ) {
            currentViewStartDate = vm.getAdjacentViewStartTime( 1 );
            toUpdateViewIndex = ( currentViewIndex + 1 ) % 3;
            angular.copy( getViewData( currentViewStartDate ), scope.views[ toUpdateViewIndex ] );
        } else if ( vm.direction === -1 ) {
            currentViewStartDate = vm.getAdjacentViewStartTime( -1 );
            toUpdateViewIndex = ( currentViewIndex + 2 ) % 3;
            angular.copy( getViewData( currentViewStartDate ), scope.views[ toUpdateViewIndex ] );
        } else {
            if ( !scope.views ) {
                currentViewData = [];
                currentViewStartDate = vm.range.startTime;
                currentViewData.push( getViewData( currentViewStartDate ) );
                currentViewStartDate = vm.getAdjacentViewStartTime( 1 );
                currentViewData.push( getViewData( currentViewStartDate ) );
                currentViewStartDate = vm.getAdjacentViewStartTime( -1 );
                currentViewData.push( getViewData( currentViewStartDate ) );
                scope.views = currentViewData;
            } else {
                currentViewStartDate = vm.range.startTime;
                angular.copy( getViewData( currentViewStartDate ), scope.views[ currentViewIndex ] );
                currentViewStartDate = vm.getAdjacentViewStartTime( -1 );
                toUpdateViewIndex = ( currentViewIndex + 2 ) % 3;
                angular.copy( getViewData( currentViewStartDate ), scope.views[ toUpdateViewIndex ] );
                currentViewStartDate = vm.getAdjacentViewStartTime( 1 );
                toUpdateViewIndex = ( currentViewIndex + 1 ) % 3;
                angular.copy( getViewData( currentViewStartDate ), scope.views[ toUpdateViewIndex ] );
            }
        }
    };

    vm.slideView = function( direction ) {
        var slideHandle = $ionicSlideBoxDelegate.$getByHandle( vm.calendarMode + 'view-slide' );

        if ( slideHandle ) {
            if ( direction === 1 ) {
                slideHandle.next();
            } else if ( direction === -1 ) {
                slideHandle.previous();
            }
        }
    };
}

angular.module( 'ui.rCalendar' ).directive( 'calendar', function calendarDirective() {
    'use strict';
    return {
        restrict: 'EA',
        replace: true,
        templateUrl: 'templates/rcalendar/calendar.html',
        scope: {
            calendarMode: '=',
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

monthviewDirective.$inject = [ 'dateFilter' ];

angular.module( 'ui.rCalendar' ).directive( 'monthview', monthviewDirective );

function monthviewDirective( dateFilter ) {
    'use strict';
    return {
        restrict: 'EA',
        replace: true,
        templateUrl: 'templates/rcalendar/month.html',
        require: [ '^calendar', '?^ngModel' ],
        link: function( scope, element, attrs, ctrls ) {
            var ctrl = ctrls[ 0 ];
            var ngModelCtrl = ctrls[ 1 ];

            scope.showEventDetail = ctrl.showEventDetail;
            scope.formatDayHeader = ctrl.formatDayHeader;

            ctrl.mode = {
                step: { months: 1 }
            };

            scope.noEventsLabel = ctrl.noEventsLabel;

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
                    label: dateFilter( date, format )
                };
            }

            function updateCurrentView( currentViewStartDate, view ) {
                var currentCalendarDate = ctrl.currentCalendarDate;
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
                    scope.selectedDate = view.dates[ selectedDayDifference ];
                } else {
                    scope.selectedDate = {
                        events: []
                    };
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
                    return ( event1.startTime.getTime() - event2.startTime.getTime() );
                }
            }

            scope.select = function( selectedDate ) {
                var views = scope.views;
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

                    dates = views[ scope.currentViewIndex ].dates;
                    currentCalendarDate = ctrl.currentCalendarDate;
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

                    ctrl.currentCalendarDate = selectedDate;
                    if ( direction === 0 ) {
                        ctrl.currentCalendarDate = selectedDate;
                        if ( ngModelCtrl ) {
                            ngModelCtrl.$setViewValue( selectedDate );
                        }

                        currentViewStartDate = ctrl.range.startTime;
                        oneDay = 86400000;
                        selectedDayDifference = Math.floor( ( selectedDate.getTime() - currentViewStartDate.getTime() ) / oneDay );

                        for ( r = 0; r < 42; r += 1 ) {
                            dates[ r ].selected = false;
                        }

                        if ( selectedDayDifference >= 0 && selectedDayDifference < 42 ) {
                            dates[ selectedDayDifference ].selected = true;
                            scope.selectedDate = dates[ selectedDayDifference ];
                        }
                    } else {
                        ctrl.moveOnSelected = true;
                        ctrl.slideView( direction );
                    }

                    if ( scope.timeSelected ) {
                        scope.timeSelected( { selectedTime: selectedDate } );
                    }
                }
            };

            scope.getHighlightClass = function( date ) {
                var className = '';

                if ( date.hasEvent ) {
                    if ( date.secondary ) {
                        className = 'monthview-secondary-with-event';
                    } else {
                        className = 'monthview-primary-with-event';
                    }
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
                    className += 'text-muted';
                }
                return className;
            };

            ctrl._getTitle = function() {
                var currentViewStartDate = ctrl.range.startTime;
                var date = currentViewStartDate.getDate();
                var month = ( currentViewStartDate.getMonth() + ( date !== 1 ? 1 : 0 ) ) % 12;
                var year = currentViewStartDate.getFullYear() + ( date !== 1 && month === 0 ? 1 : 0 );
                var headerDate = new Date( year, month, 1 );

                return dateFilter( headerDate, ctrl.formatMonthTitle );
            };

            ctrl._getViewData = function( startTime ) {
                var startDate = startTime;
                var date = startDate.getDate();
                var month = ( startDate.getMonth() + ( date !== 1 ? 1 : 0 ) ) % 12;
                var days = getDates( startDate, 42 );
                var i;

                for ( i = 0; i < 42; i++ ) {
                    days[ i ] = angular.extend( createDateObject( days[ i ], ctrl.formatDay ), {
                        secondary: days[ i ].getMonth() !== month
                    } );
                }

                return {
                    dates: days
                };
            };

            ctrl._refreshView = function() {
                ctrl.populateAdjacentViews( scope );
                updateCurrentView( ctrl.range.startTime, scope.views[ scope.currentViewIndex ] );
            };

            ctrl._onDataLoaded = function() {
                var eventSource = ctrl.eventSource;
                var len = eventSource ? eventSource.length : 0;
                var startTime = ctrl.range.startTime;
                var endTime = ctrl.range.endTime;
                var timeZoneOffset = -new Date().getTimezoneOffset();
                var utcStartTime = new Date( startTime.getTime() + timeZoneOffset * 60 * 1000 );
                var utcEndTime = new Date( endTime.getTime() + timeZoneOffset * 60 * 1000 );
                var currentViewIndex = scope.currentViewIndex;
                var dates = scope.views[ currentViewIndex ].dates;
                var oneDay = 86400000;
                var eps = 0.001;
                var r;
                var i;
                var event;
                var eventStartTime;
                var eventEndTime;
                var st;
                var et;
                var timeDifferenceStart;
                var timeDifferenceEnd;
                var index;
                var eventSet;
                var findSelected;

                for ( r = 0; r < 42; r += 1 ) {
                    if ( dates[ r ].hasEvent ) {
                        dates[ r ].hasEvent = false;
                        dates[ r ].events = [];
                    }
                }

                for ( i = 0; i < len; i += 1 ) {
                    event = eventSource[ i ];
                    eventStartTime = new Date( event.startTime );
                    eventEndTime = new Date( event.endTime );
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
                        dates[ index ].hasEvent = true;
                        eventSet = dates[ index ].events;
                        if ( eventSet ) {
                            eventSet.push( event );
                        } else {
                            eventSet = [];
                            eventSet.push( event );
                            dates[ index ].events = eventSet;
                        }
                        index += 1;
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
                        scope.selectedDate = dates[ r ];
                        findSelected = true;
                        break;
                    }
                    if ( findSelected ) {
                        break;
                    }
                }
            };

            ctrl._getRange = function getRange( currentDate ) {
                var year = currentDate.getFullYear();
                var month = currentDate.getMonth();
                var firstDayOfMonth = new Date( year, month, 1 );
                var difference = ctrl.startingDayMonth - firstDayOfMonth.getDay();
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
            };

            ctrl.registerSlideChanged( scope );

            ctrl.refreshView();
        }
    };
}

angular.module("templates/rcalendar/calendar.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("templates/rcalendar/calendar.html",
    "<div class=\"calendar-container\">\n" +
    "    <monthview></monthview>\n" +
    "</div>");
}]);

angular.module("templates/rcalendar/month.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("templates/rcalendar/month.html",
    "<div>\n" +
    "    <ion-slide-box class=\"monthview-slide\" on-slide-changed=\"slideChanged($index)\" does-continue=\"true\"\n" +
    "                   show-pager=\"false\" delegate-handle=\"monthview-slide\">\n" +
    "        <ion-slide ng-repeat=\"view in views track by $index\">\n" +
    "            <table ng-if=\"$index===currentViewIndex\" class=\"table table-bordered table-fixed monthview-datetable\">\n" +
    "                <thead>\n" +
    "                <tr>\n" +
    "                    <th ng-repeat=\"day in view.dates.slice(0,7) track by day.date\">\n" +
    "                        <small>{{::day.date | date: formatDayHeader}}</small>\n" +
    "                    </th>\n" +
    "                </tr>\n" +
    "                </thead>\n" +
    "                <tbody>\n" +
    "                <tr>\n" +
    "                    <td ng-click=\"select(view.dates[0].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[0])\">{{view.dates[0].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[1].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[1])\">{{view.dates[1].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[2].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[2])\">{{view.dates[2].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[3].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[3])\">{{view.dates[3].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[4].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[4])\">{{view.dates[4].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[5].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[5])\">{{view.dates[5].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[6].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[6])\">{{view.dates[6].label}}\n" +
    "                    </td>\n" +
    "                </tr>\n" +
    "                <tr>\n" +
    "                    <td ng-click=\"select(view.dates[7].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[7])\">{{view.dates[7].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[8].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[8])\">{{view.dates[8].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[9].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[9])\">{{view.dates[9].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[10].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[10])\">{{view.dates[10].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[11].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[11])\">{{view.dates[11].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[12].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[12])\">{{view.dates[12].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[13].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[13])\">{{view.dates[13].label}}\n" +
    "                    </td>\n" +
    "                </tr>\n" +
    "                <tr>\n" +
    "                    <td ng-click=\"select(view.dates[14].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[14])\">{{view.dates[14].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[15].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[15])\">{{view.dates[15].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[16].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[16])\">{{view.dates[16].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[17].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[17])\">{{view.dates[17].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[18].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[18])\">{{view.dates[18].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[19].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[19])\">{{view.dates[19].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[20].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[20])\">{{view.dates[20].label}}\n" +
    "                    </td>\n" +
    "                </tr>\n" +
    "                <tr>\n" +
    "                    <td ng-click=\"select(view.dates[21].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[21])\">{{view.dates[21].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[22].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[22])\">{{view.dates[22].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[23].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[23])\">{{view.dates[23].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[24].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[24])\">{{view.dates[24].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[25].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[25])\">{{view.dates[25].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[26].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[26])\">{{view.dates[26].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[27].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[27])\">{{view.dates[27].label}}\n" +
    "                    </td>\n" +
    "                </tr>\n" +
    "                <tr>\n" +
    "                    <td ng-click=\"select(view.dates[28].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[28])\">{{view.dates[28].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[29].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[29])\">{{view.dates[29].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[30].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[30])\">{{view.dates[30].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[31].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[31])\">{{view.dates[31].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[32].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[32])\">{{view.dates[32].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[33].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[33])\">{{view.dates[33].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[34].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[34])\">{{view.dates[34].label}}\n" +
    "                    </td>\n" +
    "                </tr>\n" +
    "                <tr>\n" +
    "                    <td ng-click=\"select(view.dates[35].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[35])\">{{view.dates[35].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[36].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[36])\">{{view.dates[36].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[37].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[37])\">{{view.dates[37].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[38].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[38])\">{{view.dates[38].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[39].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[39])\">{{view.dates[39].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[40].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[40])\">{{view.dates[40].label}}\n" +
    "                    </td>\n" +
    "                    <td ng-click=\"select(view.dates[41].date)\"\n" +
    "                        ng-class=\"getHighlightClass(view.dates[41])\">{{view.dates[41].label}}\n" +
    "                    </td>\n" +
    "                </tr>\n" +
    "                </tbody>\n" +
    "            </table>\n" +
    "            <table ng-if=\"$index!==currentViewIndex\" class=\"table table-bordered table-fixed monthview-datetable\">\n" +
    "                <thead>\n" +
    "                <tr class=\"text-center\">\n" +
    "                    <th ng-repeat=\"day in view.dates.slice(0,7) track by day.date\">\n" +
    "                        <small>{{::day.date | date: formatDayHeader}}</small>\n" +
    "                    </th>\n" +
    "                </tr>\n" +
    "                </thead>\n" +
    "                <tbody>\n" +
    "                <tr>\n" +
    "                    <td>{{view.dates[0].label}}</td>\n" +
    "                    <td>{{view.dates[1].label}}</td>\n" +
    "                    <td>{{view.dates[2].label}}</td>\n" +
    "                    <td>{{view.dates[3].label}}</td>\n" +
    "                    <td>{{view.dates[4].label}}</td>\n" +
    "                    <td>{{view.dates[5].label}}</td>\n" +
    "                    <td>{{view.dates[6].label}}</td>\n" +
    "                </tr>\n" +
    "                <tr>\n" +
    "                    <td>{{view.dates[7].label}}</td>\n" +
    "                    <td>{{view.dates[8].label}}</td>\n" +
    "                    <td>{{view.dates[9].label}}</td>\n" +
    "                    <td>{{view.dates[10].label}}</td>\n" +
    "                    <td>{{view.dates[11].label}}</td>\n" +
    "                    <td>{{view.dates[12].label}}</td>\n" +
    "                    <td>{{view.dates[13].label}}</td>\n" +
    "                </tr>\n" +
    "                <tr>\n" +
    "                    <td>{{view.dates[14].label}}</td>\n" +
    "                    <td>{{view.dates[15].label}}</td>\n" +
    "                    <td>{{view.dates[16].label}}</td>\n" +
    "                    <td>{{view.dates[17].label}}</td>\n" +
    "                    <td>{{view.dates[18].label}}</td>\n" +
    "                    <td>{{view.dates[19].label}}</td>\n" +
    "                    <td>{{view.dates[20].label}}</td>\n" +
    "                </tr>\n" +
    "                <tr>\n" +
    "                    <td>{{view.dates[21].label}}</td>\n" +
    "                    <td>{{view.dates[22].label}}</td>\n" +
    "                    <td>{{view.dates[23].label}}</td>\n" +
    "                    <td>{{view.dates[24].label}}</td>\n" +
    "                    <td>{{view.dates[25].label}}</td>\n" +
    "                    <td>{{view.dates[26].label}}</td>\n" +
    "                    <td>{{view.dates[27].label}}</td>\n" +
    "                </tr>\n" +
    "                <tr>\n" +
    "                    <td>{{view.dates[28].label}}</td>\n" +
    "                    <td>{{view.dates[29].label}}</td>\n" +
    "                    <td>{{view.dates[30].label}}</td>\n" +
    "                    <td>{{view.dates[31].label}}</td>\n" +
    "                    <td>{{view.dates[32].label}}</td>\n" +
    "                    <td>{{view.dates[33].label}}</td>\n" +
    "                    <td>{{view.dates[34].label}}</td>\n" +
    "                </tr>\n" +
    "                <tr>\n" +
    "                    <td>{{view.dates[35].label}}</td>\n" +
    "                    <td>{{view.dates[36].label}}</td>\n" +
    "                    <td>{{view.dates[37].label}}</td>\n" +
    "                    <td>{{view.dates[38].label}}</td>\n" +
    "                    <td>{{view.dates[39].label}}</td>\n" +
    "                    <td>{{view.dates[40].label}}</td>\n" +
    "                    <td>{{view.dates[41].label}}</td>\n" +
    "                </tr>\n" +
    "                </tbody>\n" +
    "            </table>\n" +
    "        </ion-slide>\n" +
    "    </ion-slide-box>\n" +
    "    <ion-content class=\"event-detail-container\" has-bouncing=\"false\" ng-show=\"showEventDetail\" overflow-scroll=\"false\">\n" +
    "        <table class=\"table table-bordered table-striped table-fixed event-detail-table\">\n" +
    "            <tr ng-repeat=\"event in selectedDate.events\" ng-click=\"eventSelected({event:event})\">\n" +
    "                <td ng-if=\"!event.allDay\" class=\"monthview-eventdetail-timecolumn\">{{::event.startTime|date: 'HH:mm'}}\n" +
    "                    -\n" +
    "                    {{::event.endTime|date: 'HH:mm'}}\n" +
    "                </td>\n" +
    "                <td ng-if=\"event.allDay\" class=\"monthview-eventdetail-timecolumn\">All day</td>\n" +
    "                <td class=\"event-detail\">{{::event.title}}</td>\n" +
    "            </tr>\n" +
    "            <tr ng-if=\"!selectedDate.events\">\n" +
    "                <td class=\"no-event-label\" ng-bind=\"::noEventsLabel\"></td>\n" +
    "            </tr>\n" +
    "        </table>\n" +
    "    </ion-content>\n" +
    "</div>\n" +
    "");
}]);
