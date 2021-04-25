const selectors = {
  salaryRange: "salary-range-value",
  legacySalaryRange: "legacy-salary-range-value",
};

const addPlaceholder = (text) => {
  const elements = document.querySelectorAll("span");
  for (const element of elements) {
    if (element.innerText.includes('Posted')) {
      const div = document.createElement("div");
      div.style.marginTop = "10px";

      const span = document.createElement("span");
      span.id = selectors.salaryRange;
      span.innerText = `Salary (estimated): ${text}`;
      span.style.fontSize = "16px";
      span.style.lineHeight = "24px";

      div.append(span);
      element.parentElement.before(div);
    }
  }
};

// Seek seems to be doing a/b testing so try and support both for now
const showSalary = async (value) => {
  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    addPlaceholder(value);
  } catch (exception) { }
  try {
    updateLegacyPlaceholder(value);
  } catch (exception) { }
}

const addLegacyPlaceholder = () => {
  const infoSections = document.querySelectorAll('[aria-labelledby="jobInfoHeader"]');
  for (const section of infoSections) {
    const items = section.querySelectorAll("dd");
    const salaryRange = items[1].cloneNode(true);
    salaryRange.querySelector("strong").innerText = "Salary";

    const salaryRangePlaceholder = salaryRange.querySelector("span span span");
    if (salaryRangePlaceholder) {
      salaryRangePlaceholder.id = selectors.legacySalaryRange;
      salaryRangePlaceholder.innerText = "Calculating...";
    } else {
      const span = document.createElement("span");
      span.id = selectors.legacySalaryRange;
      span.innerText = "Calculating...";
      span.style.fontSize = "14px";
      salaryRange.appendChild(span);
    }

    items[1].parentNode.insertBefore(salaryRange, items[1].nextSibling);
  }
};

const updateLegacyPlaceholder = (text) => {
  // Wait for a max of 2 seconds for career insights to load before adding the placeholder.
  let elapsed = 0;
  const interval = setInterval(() => {
    const insights = document.querySelector("div[data-automation='dynamic-lmis']");
    if (insights || elapsed >= 2000) {
      clearInterval(interval);
      addLegacyPlaceholder();

      const elements = document.querySelectorAll(`#${selectors.legacySalaryRange}`);
      for (const element of elements) {
        element.innerText = text;
      }
    }

    elapsed += 100;
  }, 100);
};

chrome.runtime.onMessage.addListener((request) => {
  if (request.message === "update-placeholder") {
    console.log(`Salary range: ${request.result}`);
    request.result ? showSalary(request.result) : showSalary("Error downloading salary.");
  }
});