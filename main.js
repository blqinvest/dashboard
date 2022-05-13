'use strict';

const fieldIds = {
  'company': 'fldIYYt9CfqrDJGtH',
  'status': 'fldELamP8lmU4aSUs',
  'level': 'fldVLgUc6dLGo31NN',
  'company_name': 'fld7O4qm2eBnTJ2Mu',
  'company_logo': 'fldKln7hK9S8LmQOH'
};
const tableIds = {
  'projects': 'tblQw6TtqI6V92Tyy',
  'companies': 'tblJKDKExLnSJU0S9'
};

let state = {
  airtable_key: '',
  portfolio: {},
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
  Promise.all([companyRecords(), levelProgression()]).then(([company_data, company_levels]) => {
    for (const [id, data] of Object.entries(company_data)) {
      
      state.portfolio[id] = { ...data, levels: company_levels[id] }
    }
    render();
    setTimeout(loadAirtable, 5*60*1000);
  }, (reason) => {
    if (reason == 401) {
      setAirtableKey('');
      render();
    }
  });
}

function render() {
  uglylog('rendering', state)
  if (state.airtable_key === '') {
    document.getElementById('access_form').classList.remove('hidden');
  } else {

    uglylog('1')
    document.getElementById('access_form').classList.add('hidden');

    uglylog('2')
    const levels = document.getElementById('company_levels')

    uglylog('3')
    //const headers = levels.querySelectorAll('.header');
    //levels.replaceChildren(...headers);
    const headers = levels.querySelectorAll('* > *:not(.header)');
    uglylog('4')
    for (const header of headers) {
      uglylog('removing')
      levels.removeChild(header);
    }
    uglylog('children removed')
    for (const [id, company] of Object.entries(state.portfolio)) {

      uglylog('5')
      const logo = document.createElement('img');
      uglylog('6')
      logo.setAttribute('src', company.logo_url);
      uglylog('7')
      const level1 = document.createElement('div');
      uglylog('8')
      level1.textContent = company.levels['1']
      uglylog('9')
      const level2 = document.createElement('div');
      uglylog('10')
      level2.textContent = company.levels['2']
      uglylog('11')
      const level3 = document.createElement('div');
      uglylog('12')
      level3.textContent = company.levels['3']
      uglylog('13')
      uglylog('appending new children', id, company)
      levels.append(logo, level1, level2, level3)
      uglylog('14')
    }
  }
}

document.getElementById('access_form').addEventListener("submit", function (ev) {
  ev.preventDefault();
  setAirtableKey(document.getElementById('airtable_key').value);
  render();
});


function companyRecords (offset = 0, records = []) {
  return airtableRequest(offset,
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
  return airtableRequest(offset,
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

function airtableRequest(offset, tableId, resource) {
  const root = 'https://api.airtable.com/v0';  
  const baseId = 'app9dUa1gS9KZd7Vy';

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