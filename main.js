'use strict';

const fieldIds = {
  // in blq box
  'company': 'fldIYYt9CfqrDJGtH',
  'status': 'fldELamP8lmU4aSUs',
  'level': 'fldVLgUc6dLGo31NN',
  'company_name': 'fld7O4qm2eBnTJ2Mu',
  'company_logo': 'fldKln7hK9S8LmQOH',
  // in sourcing
  'screening_date': 'fldcRcIkUcQRXGlnV',
  'firstmeet_date': 'fld6UckMqVoOloV0E'
};
const tableIds = {
  // in blq box
  'projects': 'tblQw6TtqI6V92Tyy',
  'companies': 'tblJKDKExLnSJU0S9',
  // in sourcing
  'deals': 'tblMHayJBPtZjma4b',
};
const baseIds = {
  'sourcing': 'appLAlyKBIAV9daa6',
  'blqbox': 'app9dUa1gS9KZd7Vy',
}
// Starting date for sourcing stats
const startdate = "2021-12-31"

let state = {
  airtable_key: '',
  portfolio: {},
  sourcing_stats: {},
}

function uglylog(...items) {
  let string = []
  for (const item of items) {
    string = string + JSON.stringify(item);
  }
  var node = document.createElement('p')
  node.innerText = string;
  document.getElementById('logs').appendChild(node);
}

function setAirtableKey(key) {
  state.airtable_key = key;
  localStorage.setItem('airtable_key', key);
  if (key !== '') {
    loadAirtable();
  }
}

function loadState() {
  const key = localStorage.getItem('airtable_key');
  if (key && key !== '') {
    setAirtableKey(key)
    render();
  }
}
loadState()

function loadAirtable() {
  const onError = (reason) => {
    if (reason == 401) {
      setAirtableKey('');
      render();
    }
  }
  const portfolio = Promise.all([companyRecords(), levelProgression()]).then(([company_data, company_levels]) => {
    for (const [id, data] of Object.entries(company_data)) {
      state.portfolio[id] = { ...data, levels: company_levels[id] }
    }
    render();
  }, onError);
  const sourcing_stats = sourcingStats().then((stats) => {
    state.sourcing_stats = stats;
    render();
  }, onError);
  Promise.all([portfolio, sourcing_stats]).then((_) => {
    setTimeout(loadAirtable, 5*60*1000);
  })
}

function render() {
  if (state.airtable_key === '') {
    document.getElementById('access_form').classList.remove('hidden');
  } else {
    document.getElementById('access_form').classList.add('hidden');

    if (Object.entries(state.portfolio).length > 0) {
      const levels = document.getElementById('company_levels')

      //const headers = levels.querySelectorAll('.header');
      //levels.replaceChildren(...headers);
      const headers = levels.querySelectorAll('* > *:not(.header)');
      for (const header of headers) {
        levels.removeChild(header);
      }
      for (const [id, company] of Object.entries(state.portfolio)) {
  
        const logo = document.createElement('img');
        logo.setAttribute('src', company.logo_url);
        const level1 = document.createElement('div');
        level1.textContent = company.levels['1']
        const level2 = document.createElement('div');
        level2.textContent = company.levels['2']
        const level3 = document.createElement('div');
        level3.textContent = company.levels['3']
        levels.append(logo, level1, level2, level3)
      }
    } else {
      // maybe add throbber
    }

    if ('screened' in state.sourcing_stats) {
      document.getElementById('sourcing_screened').getElementsByClassName('number')[0].textContent = state.sourcing_stats.screened;
      document.getElementById('sourcing_firstmeets').getElementsByClassName('number')[0].textContent = state.sourcing_stats.firstmeets;
    } else {
      // maybe add throbber
    }
  }
}

document.getElementById('access_form').addEventListener("submit", function (ev) {
  ev.preventDefault();
  setAirtableKey(document.getElementById('airtable_key').value);
  render();
});


function companyRecords (offset = 0, records = []) {
  return airtableRequest(baseIds['blqbox'],
    tableIds['companies'],
    '?' +
    'returnFieldsByFieldId=true' + '&' +
    'offset=' + offset.toString() + '&' +
    'fields%5B%5D=' + fieldIds['company_name'] + '&' +
    'fields%5B%5D=' + fieldIds['company_logo'] + '&'
  ).then((data) => {
    records.push(...data.records)
    if ('offset' in data) {
      offset = data.offset;
      return airtableRecords(data.offset, records)
    }
    return records;
  }).then((companies) => {
    let companies_neat = {}
    for (const company of companies) {
      companies_neat[company.id] = {
        name: company.fields[fieldIds['company_name']],
        logo_url: company.fields[fieldIds['company_logo']][0].url
      }
    }
    return companies_neat;
  })
}

function levelProgression () {
  return projectStatuses().then((statuses) => {
    let progression = {}
    for (const [company, levels] of Object.entries(statuses)) {
      progression[company] = {}
      for (const [level, statuses] of Object.entries(levels)) {
        let done = 0
        let total = 0
        for (const [status, count] of Object.entries(statuses)) {
          if (!status.startsWith('N/A')) {
            total += count;
          }
          if (status.startsWith('Done')) {
            done += count;
          }
        }
        if (total == 0) {
          done = 1
          total = 1
        }
        progression[company][level] = (100*done/total).toFixed(0).toString() + '%';
      }
    }
    return (progression)
  })
}

function projectStatuses () {
  return projectRecords().then((records) => {
    let companies = {}; // company, level, status
    for (const record of records) {
      const company = record.fields[fieldIds['company']][0];
      const level = record.fields[fieldIds['level']][0];
      const status = record.fields[fieldIds['status']]
      if (!(company in companies)) {
        companies[company] = {};
      }
      if (!(level in companies[company])) {
        companies[company][level] = {};
      }
      if (!(status in companies[company][level])) {
        companies[company][level][status] = 0;
      }
      companies[company][level][status] += 1;
    }
    return (companies)
  })
}

function projectRecords (offset = 0, records = []) {
  return airtableRequest(baseIds['blqbox'],
    tableIds['projects'],
    '?' +
    'returnFieldsByFieldId=true' + '&' +
    'offset=' + offset.toString() + '&' +
    'fields%5B%5D=' + fieldIds['company'] + '&' + // Company
    'fields%5B%5D=' + fieldIds['status'] + '&' + // Status
    'fields%5B%5D=' + fieldIds['level'] + '&' // Level
  ).then((data) => {
    records.push(...data.records)
    if ('offset' in data) {
      offset = data.offset;
      return projectRecords(data.offset, records)
    }
    return records;
  })
}

function sourcingStats(offset = 0, result = {screened: 0, firstmeets: 0}) {
  const today = new Date().toISOString().slice(0,10);
  return airtableRequest(baseIds['sourcing'],
    tableIds['deals'],
    '?' +
    'returnFieldsByFieldId=true' + '&' +
    'filterByFormula=OR(IS_AFTER(%7BScreening+date%7D%2C+%22' + startdate + '%22)%2C+IS_AFTER(%7BFirst+Meeting+date%7D%2C+%22' + startdate + '%22))' + '&' +
    'offset=' + offset.toString() + '&' +
    'fields%5B%5D=' + fieldIds['screening_date'] + '&' +
    'fields%5B%5D=' + fieldIds['firstmeet_date']
  ).then((data) => {
    for (const record of data.records) {
      const screening_date = record.fields[fieldIds['screening_date']];
      const firstmeet_date = record.fields[fieldIds['firstmeet_date']];
      if ((startdate < screening_date) && (screening_date <= today)) {
        result.screened += 1;
      }
      if ((startdate < firstmeet_date) && (firstmeet_date <= today)) {
        result.firstmeets += 1; 
      }
    }
    if ('offset' in data) {
      return sourcingStats(data.offset, result)
    }
    return result;
  })
}

function airtableRequest(baseId, tableId, resource) {
  const root = 'https://api.airtable.com/v0';

  return fetch(
    root + '/' +
    baseId + '/' +
    tableId + resource,
    {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + state.airtable_key,
      }
    }
  ).then((response) => {
    if (response.status == 401) {
      return Promise.reject(401);
    }
    return response.json();
  })
}