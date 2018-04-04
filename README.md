# What

Calculates the balance of your Toggl account.

# Example output

```
$ npm run run

Fetching time entries...
--- Results between 2017-05-08 and 2018-04-03 ---
Worked 1747.2 h
Expected 1770.0 h
Current balance -22.8 h
```

# Installation

1. `npm install`
2. Make a file `.env` to the root of this project with contents like this
```
API_TOKEN=xxxxx
WORKSPACE_ID=12345
FIRST_WORK_DAY=2017-05-08
HOURS_PER_DAY=7.5
```
You can get the api token from https://toggl.com/app/profile and workspace id from the url in one of the workspaces on https://toggl.com/app/workspaces

Adjust first work day to the start of balance calculation.

# Usage

1. `npm run run`

# Limitations

1. Calculates balance of all the time entries of the workspace, no distiction between projects/tags.
1. Does not support change of hours per day.
1. Expects that there's time entry in every work day (monday to friday). If not, then a warning is printed. You should then add a dummy time entry to those days without time entry. This happens for example when there's a public holiday.
    ```
    Fetching time entries...
    --- Results between 2017-05-08 and 2018-04-03 ---
    Worked 1731.7 h
    Expected 1770.0 h
    Current balance -38.3 h
    Dates missing a time entry 2018-03-30, 2018-04-02
    ```
