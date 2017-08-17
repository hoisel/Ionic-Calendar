angular.module( 'calendarDemoApp', [ 'ionic', 'ngAnimate', 'ui.rCalendar' ] );
angular.module( 'calendarDemoApp' ).controller( 'CalendarDemoController', CalendarDemoController );
angular.module( 'calendarDemoApp' ).config( appConfig );
angular.module( 'calendarDemoApp' ).run( appRun );
angular.module( 'calendarDemoApp' ).service( 'eventsService', eventsService );
angular.module( 'calendarDemoApp' ).service( 'agendasService', agendasService );

agendasService.$inject = [ '$http' ];
eventsService.$inject = [ '$http' ];
appRun.$inject = [ '$ionicPlatform', '$animate' ];
appConfig.$inject = [ '$stateProvider', '$urlRouterProvider' ];
CalendarDemoController.$inject = [
    '$window', '$log', 'eventsService', 'agendasService', '$ionicLoading'
];

function agendasService( $http ) {
    var urlBase = 'https://api.es.gov.br/developers/calendars';

    this.getAll = function() {
        return $http.get( urlBase );
    };
}

function eventsService( $http ) {
    var urlBase = 'https://api.es.gov.br/developers/calendars/events?calendars=INCAPER&calendars=SECULT&calendars=SEAG&calendars=SETUR&orderBy=startTime&singleEvents=true&timeMax=2017-12-31T02:00:00.000Z&timeMin=2017-01-01T02:00:00.000Z&timeZone=America/Sao_Paulo';

    this.getEventsFor = function( agendas, options ) {
        var hoje = new Date();
        var defaults = {
            singleEvents: true,
            orderBy: 'startTime',
            timeMin: new Date( hoje.getFullYear(), 0, 1, 0 ),   // começo do ano corrente
            timeMax: new Date( hoje.getFullYear(), 11, 31, 0 ), // final do ano corrente
            timeZone: 'America/Sao_Paulo' // an option!
        };
        return $http.get( urlBase, { params: angular.extend( { agendas: agendas }, defaults, options || {} ) } );
    };
}

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

function CalendarDemoController( $window, $log, eventsService, agendasService, $ionicLoading ) {
    'use strict';

    var vm = this;
    vm.agendasSelecionadas = [];
    vm.calendar = {};
    vm.loadAgendas = function() {
        $ionicLoading.show( { delay: 300 } );
        return agendasService.getAll()
                             .then( function( response ) {
                                 $ionicLoading.hide();
                                 vm.eventSourcesList = vm.agendasSelecionadas = response.data.map( function( agenda ) {
                                     return agenda.nome;
                                 } );
                             } );
    };

    vm.loadEvents = function() {
        $ionicLoading.show( { delay: 300 } );

        // final do ano corrente
        return eventsService.getEventsFor( vm.agendasSelecionadas )
                            .then( function( response ) {
                                vm.calendar.eventSources = response.data;
                            } )
                            .finally( function() {
                                $ionicLoading.hide();
                            } );

    };

    vm.onEventSelected = function( event ) {
        $window.open( event.htmlLink, '_blank' );
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

    vm.loadAgendas().then( function() {
        vm.loadEvents();
    } );
}
