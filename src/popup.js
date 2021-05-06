const tableBody = document.getElementById("table-body");

const jobs = (JSON.parse(localStorage.getItem("jobs")) || [])
  .sort((a, b) => b.created - a.created)
  .slice(0, 8);

if (jobs.length === 0) {
  document.getElementById("no-jobs").style.display = "block";
  document.getElementById("job-table").style.display = "none";
}

// ejohn.org/blog/javascript-pretty-date
const pretty = (timestamp) => {
  const date = new Date(parseInt(timestamp, 10));
  const diff = (((new Date()).getTime() - date.getTime()) / 1000);
  const day_diff = Math.floor(diff / 86400);

  if (isNaN(day_diff) || day_diff < 0 || day_diff >= 31) { return; }

  return day_diff == 0 && (
    diff < 60 && "now" ||
    diff < 120 && "1m ago" ||
    diff < 3600 && Math.floor(diff / 60) + "m ago" ||
    diff < 7200 && "1h ago" ||
    diff < 86400 && Math.floor(diff / 3600) + "h ago") ||
    day_diff == 1 && "1d ago" ||
    day_diff < 7 && day_diff + "d ago" ||
    day_diff < 31 && Math.ceil(day_diff / 7) + "w ago";
}

for (const job of jobs) {
  try {
    if (!job.title) { continue; }

    const row = document.createElement("tr");
    row.className = "mdc-data-table__row";

    const role = document.createElement("td");
    role.className = "mdc-data-table__cell";

    const button = document.createElement("button");
    button.className = "mdc-button";
    button.title = job.company;
    button.onclick = () => window.open(`https://www.seek.com.au/job/${job.id}`, "_blank");

    const label = document.createElement("span");
    label.className = "mdc-button__label";
    label.innerText = job.title;

    button.append(label);
    role.append(button);

    const salary = document.createElement("td");
    salary.className = "mdc-data-table__cell";
    salary.innerText = job.range;

    const viewed = document.createElement("td");
    viewed.className = "mdc-data-table__cell";
    viewed.innerText = pretty(job.created);

    row.append(role);
    row.append(salary);
    row.append(viewed);
    tableBody.append(row);
  } catch (exception) { }
}