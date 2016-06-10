angular.module( 'calendarDemoApp', [ 'ionic', 'ngAnimate', 'ui.rCalendar' ] );
angular.module( 'calendarDemoApp' ).controller( 'CalendarDemoController', CalendarDemoController );
angular.module( 'calendarDemoApp' ).config( appConfig );
angular.module( 'calendarDemoApp' ).run( appRun );

appRun.$inject = [ '$ionicPlatform', '$animate' ];
appConfig.$inject = [ '$stateProvider', '$urlRouterProvider' ];
CalendarDemoController.$inject = [ '$log' ];

function appRun( $ionicPlatform, $animate ) {
    'use strict';
    $animate.enabled( false );
}

function appConfig( $stateProvider, $urlRouterProvider ) {
    'use strict';

    $stateProvider
        .state( 'tabs', {
            url: '/tab',
            abstract: true,
            templateUrl: 'templates/tabs.html'
        } )
        .state( 'tabs.home', {
            url: '/home',
            views: {
                'home-tab': {
                    templateUrl: 'templates/home.html',
                    controller: 'CalendarDemoController as vm'
                }
            }
        } )
        .state( 'tabs.about', {
            url: '/about',
            views: {
                'about-tab': {
                    templateUrl: 'templates/about.html'
                }
            }
        } )
        .state( 'tabs.contact', {
            url: '/contact',
            views: {
                'contact-tab': {
                    templateUrl: 'templates/contact.html'
                }
            }
        } );
    $urlRouterProvider.otherwise( '/tab/home' );
}

function CalendarDemoController( $log ) {
    'use strict';

    var numberOfEvents;
    var i;
    var vm = this;
    var eventSources;
    var colors = new Array( 100 );

    for ( i = 0; i < colors.length; i += 1 ) {
        colors[ i ] = '#' + ( Math.random() * 0xFFFFFF << 0 ).toString( 16 );
    }

    vm.calendar = {};

    vm.loadEvents = function() {
        numberOfEvents = 0;

        eventSources = [
            { summary: 'SEFAZ' },
            { summary: 'SEGER' },
            { summary: 'SEJUS' },
            { summary: 'PRODEST' },
            { summary: 'SECONT' },
            { summary: 'SECULT' },
            { summary: 'SEDU' },
            { summary: 'SESA' },
            { summary: 'SESP' }
        ];

        eventSources.forEach( function( source ) {
            source.color = colors[ Math.floor( Math.random() * ( ( colors.length - 1 ) - 0 + 1 ) ) ];
            source.items = createRandomEvents( source.summary, Math.floor( Math.random() * 50 ), source.color );
            source.etag = guid();

            numberOfEvents += source.items.length;
        } );

        $log.info( 'numberOfEvents:', numberOfEvents );

        vm.calendar.eventSources = eventSources;

    };

    vm.onEventSelected = function( event ) {
        $log.info( 'Event selected:' + event.startTime + '-' + event.endTime + ',' + event.title );
    };

    vm.onViewTitleChanged = function( title ) {
        vm.viewTitle = title;
    };

    vm.today = function() {
        vm.calendar.currentDate = new Date();
    };

    vm.isToday = function() {
        var today = new Date();
        var currentCalendarDate = new Date( vm.calendar.currentDate );

        today.setHours( 0, 0, 0, 0 );
        currentCalendarDate.setHours( 0, 0, 0, 0 );
        return today.getTime() === currentCalendarDate.getTime();
    };

    vm.onTimeSelected = function( selectedTime ) {
        $log.info( 'Selected time: ' + selectedTime );
    };

    ///////////////////////////////////////////////////////////////////////

    function guid() {
        function s4() {
            return Math.floor( ( 1 + Math.random() ) * 0x10000 )
                       .toString( 16 )
                       .substring( 1 );
        }

        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    }

    function createRandomEvents( source, numOfEvents, color ) {
        var events = [];
        var date;
        var eventType;
        var startDay;
        var endDay;
        var startTime;
        var endTime;
        var i;
        var startMinute;
        var endMinute;

        for ( i = 0; i < numOfEvents; i += 1 ) {
            date = new Date();
            eventType = Math.floor( Math.random() * 2 );
            startDay = Math.floor( Math.random() * 90 ) - 45;
            endDay = Math.floor( Math.random() * 2 ) + startDay;

            if ( eventType === 0 ) {
                startTime = new Date( Date.UTC( date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + startDay ) );
                if ( endDay === startDay ) {
                    endDay += 1;
                }
                endTime = new Date( Date.UTC( date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + endDay ) );
                events.push( {
                    summary: source + ' - Event ' + i,
                    startTime: startTime,
                    endTime: endTime,
                    allDay: true,
                    color: color,
                    etag: guid()
                } );
            } else {
                startMinute = Math.floor( Math.random() * 24 * 60 );
                endMinute = Math.floor( Math.random() * 180 ) + startMinute;
                startTime = new Date( date.getFullYear(), date.getMonth(), date.getDate() + startDay, 0, date.getMinutes() + startMinute );
                endTime = new Date( date.getFullYear(), date.getMonth(), date.getDate() + endDay, 0, date.getMinutes() + endMinute );
                events.push( {
                    id: guid(),
                    etag: guid(),
                    summary: source + ' - Event ' + i,
                    startTime: startTime,
                    endTime: endTime,
                    allDay: false,
                    color: color
                } );
            }
        }
        return events;
    }
}
