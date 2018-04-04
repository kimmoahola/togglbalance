// @flow
import 'babel-polyfill';
import request from 'request-promise-native';
import eachDay from 'date-fns/each_day'
import parse from 'date-fns/parse'
import co from 'co';
import chalk from 'chalk';

function validateConfig() {
  const apiToken = process.env.API_TOKEN;
  if (!apiToken) {
    throw new Error('Provide an API token');
  }

  const firstWorkDay = process.env.FIRST_WORK_DAY;
  if (!firstWorkDay) {
    throw new Error('process.env.FIRST_WORK_DAY');
  }

  const workspaceId = process.env.WORKSPACE_ID;
  if (!workspaceId) {
    throw new Error('process.env.WORKSPACE_ID');
  }

  const hoursPerDay = process.env.HOURS_PER_DAY;
  if (!hoursPerDay) {
    throw new Error('process.env.HOURS_PER_DAY');
  }

  return [apiToken, firstWorkDay, workspaceId, Number(hoursPerDay)];
}

const [apiToken, firstWorkDay, workspaceId, hoursPerDay] = validateConfig();

function workdaysInRange(dateRange: Date[]): Date[] {
  const isWorday = d => {
    return !(d.getDay() in [5, 6]);
  };

  return dateRange.filter(isWorday);
}

const untilDate = new Date().toISOString().substring(0, 10);
const expectedHours = workdaysInRange(eachDay(firstWorkDay, untilDate)).length * hoursPerDay;

class TogglClient {
  apiToken: string;
  headers: {};
  collectedDates: Set<string>;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
    this.headers = this._getHeaders(apiToken);
    this.collectedDates = new Set();
  }

  fetchTimeEntries(): Promise<[number, string[]]> {
    const self = this;

    return co(function* () {
      console.log('Fetching time entries...');
      const pastHours = yield self._pastHours();
      const currentHours = yield self._currentHours();
      return [pastHours + currentHours, self._missingDates()];
    });
  }

  _getHeaders(apiToken: string) {
    return {
      'Authorization': 'Basic ' + Buffer.from(apiToken + ':api_token').toString('base64'),
      'Content-Type': 'application/json',
      'Accept': '*/*',
    };
  }

  _missingDates(): string[] {
    const a = workdaysInRange(eachDay(firstWorkDay, untilDate)).map(d => d.toISOString().substring(0, 10));
    const diff = [...a].filter(x => !this.collectedDates.has(x));
    return diff;
  }

  * _currentHours() {
    type TogglCurrentData = {
      data: {
        duration: number,
        start: string,
      },
    };

    const response: TogglCurrentData = yield request({
      url: 'https://www.toggl.com/api/v8/time_entries/current',
      headers: this.headers,
      json: true // Automatically parses the JSON string in the response
    });

    if (response['data'] != null) {
      this.collectedDates.add(parse(response['data']['start']).toISOString().substring(0, 10));
      return ((new Date()).getTime() + response['data']['duration'] * 1000) / (60 * 60 * 1000);
    } else {
      return 0;
    }
  }

  * _pastHours(currentPage = 1, accu = 0) {
    const options = {
      uri: 'https://www.toggl.com/reports/api/v2/details',
      qs: {
        workspace_id: workspaceId,
        since: firstWorkDay,
        until: untilDate,
        page: currentPage,
        user_agent: 'togglbalance',
      },
      headers: this.headers,
      json: true // Automatically parses the JSON string in the response
    };

    type TogglData = {
      dur: number,
      start: string,
      end: string,
    };

    type TogglResponse = {
      per_page: number,
      total_count: number,
      data: TogglData[],
    };

    const response: TogglResponse = yield request(options);
    const perPage = response['per_page'];
    const totalCount = response['total_count'];
    const data = response['data'];
    const hours = data.reduce((previous, current) => previous + current['dur'] / (60 * 60 * 1000), 0);
    const totalHours = accu + hours;

    response['data'].forEach(element => {
      this.collectedDates.add(parse(element['start']).toISOString().substring(0, 10));
      this.collectedDates.add(parse(element['end']).toISOString().substring(0, 10));
    });

    if (currentPage * perPage < totalCount) {
      return yield this._pastHours(currentPage + 1, totalHours);
    } else {
      return totalHours;
    }
  }
}

function printResults(workedHours: number, missingDates: string[]) {
  console.log(`--- Results between ${firstWorkDay} and ${untilDate} ---`);
  console.log(`Worked ${workedHours.toFixed(1)} h`);
  console.log(`Expected ${expectedHours.toFixed(1)} h`);
  const balance = workedHours - expectedHours;

  let balancePrinter = chalk.green;
  if (balance < 0) {
    balancePrinter = chalk.yellow;
  }

  console.log(balancePrinter(`Current balance ${(balance).toFixed(1)} h`));

  if (missingDates.length) {
    console.log(chalk.black.bgWhite(`Dates missing a time entry ${missingDates.join(', ')}`));
  }
}

const client = new TogglClient(apiToken);
client.fetchTimeEntries().then(result => printResults(result[0], result[1]));
