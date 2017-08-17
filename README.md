# Ionic-Calendar directive

Ionic calendar directive with partial google calendar integration.

## Demo
http://hoisel.github.io/ionic-calendar/www/

## Usage

Jspm Install: `jspm install github:hoisel/ionic-calendar`

Load [Ionic](http://ionicframework.com/) js and css dependent files. At the moment, ionic
itself is not declared as a dependency in calendar package, so you need include it manually:

    <link rel="stylesheet" href="http://code.ionicframework.com/1.3.1/css/ionic.min.css"/>
    <script src="http://code.ionicframework.com/1.3.1/js/ionic.bundle.min.js"></script>

Load application throught [systemjs](https://github.com/systemjs/systemjs) in main html file:

     <script>
       System.import('app/app').catch(console.error.bind(console));
     </script>

Import calendar module and css as a dependency of your application module:

    import calendar from 'hoisel/ionic-calendar';
    import 'hoisel/ionic-calendar/css/calendar.css!';

    var myAppModule = angular.module('MyApp', [calendar])

Add the directive in the html page

    <calendar event-source="eventSource">

## Options

* **formatDay**<br/>
The format of the date displayed in the month view.    
Default value: 'dd'

* **formatDayHeader**<br/>
The format of the header displayed in the month view.    
Default value: 'EEE'

* **formatMonthTitle**<br/>
The format of the title displayed in the month view.    
Default value: 'MMMM yyyy'

* **formatHourColumn**<br/>
The format of the hour column displayed in the week and day view.    
Default value: 'ha'

* **showEventDetail**<br/>
If set to true, when selecting the date in the month view, the events happened on that day will be shown below.    
Default value: true

* **startingDayMonth**<br/>
Control month view starting from which day.    
Default value: 0

* **startingDayWeek**
Control week view starting from which day.    
Default value: 0
* **allDayLabel**<br/>
The text displayed in the allDay column header.    
Default value: ‘all day’

* **noEventsLabel**<br/>
The text displayed when there’s no event on the selected date in month view.    
Default value: ‘No Events’

* **eventSource**<br/>
The data source of the calendar, when the eventSource is set, the view will be updated accordingly.    
Default value: null    
The format of the eventSource is described in the EventSource section

* **queryMode**<br/>
If queryMode is set to 'local', when the range or mode is changed, the calendar will use the already bound eventSource to update the view    
If queryMode is set to 'remote', when the range or mode is changed, the calendar will trigger a callback function rangeChanged.    
Users will need to implement their custom loading data logic in this function, and fill it into the eventSource. The eventSource is watched, so the view will be updated once the eventSource is changed.    
Default value: 'local'

* **step**<br/>
It can be set to 15 or 30, so that the event can be displayed at more accurate position in weekview or dayview.

* **rangeChanged**<br/>
The callback function triggered when the range or mode is changed if the queryMode is set to 'remote'

        $scope.rangeChanged = function (startTime, endTime) {
            Events.query({startTime: startTime, endTime: endTime}, function(events){
                $scope.eventSource=events;
            });
        };

* **eventSelected**<br/>
The callback function triggered when an event is clicked

        <calendar ... event-selected="onEventSelected(event)"></calendar>
    
    
        $scope.onEventSelected = function (event) {
            console.log(event.title);
        };

* **timeSelected**<br/>
The callback function triggered when a date is selected in the monthview

        <calendar ... time-selected="onTimeSelected(selectedTime)"></calendar>
        
        $scope.onTimeSelected = function (selectedTime) {
            console.log(event.selectedTime);
        };

* **titleChanged**<br/>
The callback function triggered when the view title is changed

        <calendar ... title-changed="onViewTitleChanged(title)”></calendar>
        
        $scope.onViewTitleChanged = function (title) {
            $scope.viewTitle = title;
        };

## EventSource model

EventSource is an array of event object which contains at least below fields:

```json
{
  etag: String,
  summary: String,
  items: Array,
  color: String
}
```

* **etag**<br/>
Event source identifier. Must be unique across all events.

* **summary**<br/>
Event source description.

* **items**<br/>
Event source events array.

* **color**<br/>
Event source display color. Must be a hexadecimal string like: '#fff', '#333', etc.



## Event model
```json
{
  id: String,
  summary: String,
  start:{
    dateTime: String,
    date: String
  },
  end:{
    dateTime: String,
    date: String
  },
  color: String
}
```
* **id**<br/>
Event identifier. Must be unique.

* **summary**<br/>
Event description.

* **start.dateTime**<br/>
If allDay is set to true, the startTime has to be as a UTC date which time is set to 0:00 AM, because in an allDay event, only the date is considered, the exact time or timezone doesn't matter.    
For example, if an allDay event starting from 2014-05-09, then startTime is

        var startTime = new Date(Date.UTC(2014, 4, 8));

* **end.dateTime**<br/>
If allDay is set to true, the startTime has to be as a UTC date which time is set to 0:00 AM, because in an allDay event, only the date is considered, the exact time or timezone doesn't matter.    
For example, if an allDay event ending to 2014-05-10, then endTime is

        var endTime = new Date(Date.UTC(2014, 4, 9));
* **color**<br/>
Event display color

**Note**
In the current version, the calendar controller only watches for the eventSource reference as it's the least expensive.
That means only you manually reassign the eventSource value, the controller get notified, and this is usually fit to the scenario when the range is changed, you load a new data set from the backend.
In case you want to manually insert/remove/update the element in the eventSource array, you can call broadcast the 'eventSourceChanged' event to notify the controller manually.

## Events

* changeDate    
When receiving this event, the calendar will move the current view to previous or next range.  
Parameter: direction  
1 - Forward  
-1 - Backward

        $scope.$broadcast('changeDate', 1);

* eventSourceChanged    
This event is only needed when you manually modify the element in the eventSource array.  
Parameter: value  
The whole event source object

        $scope.$broadcast('eventSourceChanged',$scope.eventSource);

## i18n support
When including the angular locale script, the viewTitle and header of the calendar will be translated to local language automatically.

        <script src="http://code.angularjs.org/1.4.3/i18n/angular-locale_xx.js"></script>
