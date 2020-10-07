const selectors = {
  salaryRange: "salary-range-value"
};

const addPlaceholder = () => {
  const infoSections = document.querySelectorAll('[aria-labelledby="jobInfoHeader"]');
  for (const section of infoSections) {
    const items = section.querySelectorAll("dd");
    const salaryRange = items[1].cloneNode(true);
    salaryRange.querySelector("strong").innerText = "Salary";

    const salaryRangePlaceholder = salaryRange.querySelector("span span span");
    if (salaryRangePlaceholder) {
      salaryRangePlaceholder.id = selectors.salaryRange;
      salaryRangePlaceholder.innerText = "Calculating...";
    } else {
      const span = document.createElement("span");
      span.id = selectors.salaryRange;
      span.innerText = "Calculating...";
      span.style.fontSize = "14px";
      salaryRange.appendChild(span);
    }

    items[1].parentNode.insertBefore(salaryRange, items[1].nextSibling);
  }
};

const updatePlaceholder = (text) => {
  // Wait for a max of 2 seconds for career insights to load before adding the placeholder.
  let elapsed = 0;
  const interval = setInterval(() => {
    const insights = document.querySelector("div[data-automation='dynamic-lmis']");
    if (insights || elapsed >= 2000) {
      clearInterval(interval);
      addPlaceholder();

      const elements = document.querySelectorAll(`#${selectors.salaryRange}`);
      for (const element of elements) {
        element.innerText = text;
      }
    }

    elapsed += 100;
  }, 100);
};

chrome.runtime.onMessage.addListener((request) => {
  if (request.message === "update-placeholder") {
    request.result ? updatePlaceholder(request.result) : updatePlaceholder("Error downloading salary.");
  }
});
