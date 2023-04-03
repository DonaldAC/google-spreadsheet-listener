## Google spreadsheet listener
Built with JavaScript, This script use the google spreadsheet API to listen each entry on a specific spreadsheet and save each new entry into an SQL database. To use it you need to create a new app in the Google cloud console, by doing this you will generate the credential file needed to use identify your script when calling the API.
Create a new App by going on this link: 
<p align="center">
  <a href="https://console.cloud.google.com" target="_blank"><strong>www.console.cloud.google.com</strong></a>
  <br>
</p>

After successfully create the App, then you need to activate  the spreadsheet API on the Google cloud console.
<p align="center">
  <a href="https://console.cloud.google.com/apis/api/sheets.googleapis.com" target="_blank"><strong>sheets.googleapis.com</strong></a>
  <br>
</p>

## Installation

```bash
$ yarn
```

## Running the app
Don't forget to add the "Credentials.json" file downloaded from GCP in the App creation step into your root directory.
```bash
# watch mode
$ yarn run start
```


