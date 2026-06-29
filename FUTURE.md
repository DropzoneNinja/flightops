COMPLETED: when uploading a gpx/flight dialog get the pilot from a pulldown (similar to the media dialog). Get the site from the gpx file from the lat/long of the takeoff and compare to takeoff sites (anything within 1km will be the match). Get the glider from gpx file: <gpx><metadata><extensions><gaggle:wing>. Get the harness trike from the gpx file: <gpx><metadata><extensions><gaggle:engine>. Get the date of the flight from the gpx file <gpx><metadata><extensions><gaggle:takeoff date>. Allow the user to overide their values on the upload dialog if they would like (except for date). Also take note of the gaggle:distance, gaggle:maxSpeed, gaggle:duration, gaggle:averageSpeed, gaggle:maxAltitude, gaggle:maxClimb, gaggle:maxGForce, gaggle:maxSink, gaggle:fielConsumed, if they exist.  Store them separately to the ones you calculate from the standard gpx data points. For each trackpoint also store the <extensions>,gaggle:speed, gaggle:climbRate, gaggle:agl, gaggle:gForce.


Gaggle: Green comparison line when equal

* Make public.weather_api_logs a summary table instead of detailed logs
* edit function for sites




Logbook
- On the view all missions page, need to change name gaggle to back to media page
