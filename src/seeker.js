const selectors = {
  salaryRange: "salary-range-value"
};

const addPlaceholder = () => {
  // Check if placeholder already exists.
  if (document.getElementById(selectors.salaryRange)) {
    return;
  }

  const infoSections = document.querySelectorAll(
    '[aria-labelledby="jobInfoHeader"]'
  );

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

const updatePlaceholder = text => {
  const elements = document.querySelectorAll(`#${selectors.salaryRange}`);
  for (const element of elements) {
    element.innerText = text;
  }
};

addPlaceholder();

chrome.runtime.onMessage.addListener(request => {
  if (request.message === "update-placeholder") {
    request.result
      ? updatePlaceholder(request.result)
      : updatePlaceholder("Error downloading salary.");
  }
});
