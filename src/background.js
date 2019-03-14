const searchUrl = new URL("https://chalice-search-api.cloud.seek.com.au/search");

const calculateRange = async jobId => {
  const minRange = 30000;
  const maxRange = 200000;

  const jobDetails = await getJobDetails(jobId);
  const job = jobDetails.data.find(x => x.id == jobId);
  if (job) {
    searchUrl.searchParams.delete("jobid");
    searchUrl.searchParams.set("advertiserid", job.advertiser.id);
    searchUrl.searchParams.set("keywords", job.teaser);
    searchUrl.searchParams.set("sourcesystem", "houston");
  
    const maxSalary = await getMaxSalary(jobId, minRange, maxRange);
    const minSalary = await getMinSalary(jobId, minRange, maxSalary);
  
    console.log(`Salary range is $${minSalary} - $${maxSalary}`);
  
    if (minSalary && maxSalary) {
      return `$${minSalary.toLocaleString()} - $${maxSalary.toLocaleString()}`;
    }
  } else {
    sendMessage(`Failed to find job ${jobId} in the response.`);
  }
};

const getMaxSalary = async (jobId, min, max) => {
  let minimum = min;
  let maximum = max;
  let searchValue = getMiddle(minimum, maximum);

  // Limit to 10 requests
  for (let i = 0; i < 10; i++) {
    const job = await getJob(jobId, searchValue, maximum);
    if (job && job.found) {
      minimum = searchValue;
      searchValue = getMiddle(searchValue, maximum);

      // Check percentage change and round up to the nearest 1k to save on requests.
      if (buggerAllChange(minimum, searchValue)) {
        console.log(`Job found: Max range ${minimum}-${searchValue} found after ${i + 1} requests.`);
        return roundUp(searchValue);
      }
    } else {
      maximum = searchValue;
      searchValue = getMiddle(minimum, searchValue);

      // Check percentage change and round up to the nearest 1k to save on requests.
      if (buggerAllChange(searchValue, maximum)) {
        console.log(`Job missing: Max range ${searchValue}-${maximum} found after ${i + 1} requests.`);
        return roundUp(searchValue);
      }
    }
  }

  console.log("Max salary not found after 10 requests.");
  return roundUp(searchValue);
};

const getMinSalary = async (jobId, min, max) => {
  let minimum = min;
  let maximum = max;
  let searchValue = getMiddle(minimum, maximum);

  // Limit to 10 requests
  for (let i = 0; i < 10; i++) {
    const job = await getJob(jobId, minimum, searchValue);
    if (job && job.found) {
      maximum = searchValue;
      searchValue = getMiddle(minimum, searchValue);

      // Check percentage change and round down to the nearest 1k to save on requests.
      if (buggerAllChange(searchValue, maximum)) {
        console.log(`Job found: Min ${searchValue}-${maximum} found after ${i + 1} requests.`);
        return roundDown(searchValue);
      }
    } else {
      minimum = searchValue;
      searchValue = getMiddle(searchValue, maximum);

      // Check percentage change and round down to the nearest 1k to save on requests.
      if (buggerAllChange(minimum, searchValue)) {
        console.log(`Job missing: Min ${minimum}-${searchValue} found after ${i + 1} requests.`);
        return roundDown(searchValue);
      }
    }
  }

  console.log("Min salary not found after 10 requests.");
  return roundDown(searchValue);
};

const getMiddle = (lower, upper) => {
  return Math.round((lower + upper) / 2);
};

const buggerAllChange = (first, second) => {
  return (first / second) * 100 > 96;
};

const roundUp = value => {
  return Math.ceil(value / 1000) * 1000;
};

const roundDown = value => {
  return Math.floor(value / 1000) * 1000;
};

const getJobId = url => {
  try {
    return new URL(url).pathname.split("/")[2];
  } catch {
    return "";
  }
};

const getJobDetails = async (jobId) => {
  searchUrl.searchParams.set("jobid", jobId);
  const response = await fetch(searchUrl.href);
  return response.json();
};

const getJob = async (jobId, min, max) => {
  searchUrl.searchParams.set("salaryrange", `${min}-${max}`);
  const response = await fetch(searchUrl.href);
  
  if (response.status === 200) {
    const result = await response.json();
    if (result && result.data && result.data.find(x => x.id == jobId)) {
      return { found: true };
    } else {
      return { found: false };
    }
  } else {
    sendMessage(`Error: Request failed with ${response.status}`);
    throw new Error(`Unsuccessful response: ${response.status}`);
  }
};

const sendMessage = result => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    chrome.tabs.sendMessage(tabs[0].id, {
      message: "updateSalary",
      result: result
    });
  });
};

const handleScriptInjection = (tabId, url) => {
  chrome.tabs.executeScript(
    tabId,
    {
      code: "var injected = window.seekerInjected; window.seekerInjected = true; injected;"
    },
    async response => {
      // Seeker is already injected.
      if (response[0]) {
        chrome.tabs.executeScript(tabId, {
          code: "addPlaceholder();"
        });
      } else {
        chrome.tabs.executeScript(tabId, {
          file: "seeker.js"
        });
      }

      const jobId = getJobId(url);
      if (jobId) {
        const salary = await calculateRange(jobId);
        sendMessage(salary);
      }
    }
  );
};

const isJobUrl = url => url.includes("/job/");

// Handle job access by site navigation.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "loading" || !changeInfo.url) {
    return;
  }

  if (isJobUrl(changeInfo.url)) {
    handleScriptInjection(tabId, changeInfo.url);
  }
});

// Handle job access by direct URL.
chrome.webNavigation.onCommitted.addListener(details => {
  if (!details.tabId || !details.url) {
    return;
  }

  if (isJobUrl(details.url)) {
    handleScriptInjection(details.tabId, details.url);
  }
});
