const constants = {
  maxResults: 50,
  maxRequests: 10,
  maxCacheDays: 45,
  cacheKey: "jobs",
  searchUrl: "https://chalice-search-api.cloud.seek.com.au/search"
};

const rangeUrl = new URL(constants.searchUrl);

const calculateRange = async jobId => {
  const minRange = 30000;
  const maxRange = 200000;

  const jobDetails = await getJobDetails(jobId);
  const job = jobDetails.data.find(x => x.id == jobId);
  if (job) {
    rangeUrl.searchParams.set("advertiserid", job.advertiser.id);
    rangeUrl.searchParams.set("pagesize", constants.maxResults);
    rangeUrl.searchParams.set("sourcesystem", "houston");

    const maxSalary = await getMaxSalary(jobId, minRange, maxRange);
    const minSalary = await getMinSalary(jobId, minRange, maxSalary);

    console.log(`Salary range is $${minSalary} - $${maxSalary}`);

    if (minSalary && maxSalary) {
      const range = `$${minSalary.toLocaleString()} - $${maxSalary.toLocaleString()}`;
      cacheJob(jobId, minSalary, maxSalary, range);
      return range;
    }
  } else {
    throw new Error(`Failed to find job ${jobId}.`);
  }
};

const getMaxSalary = async (jobId, min, max) => {
  let minimum = min;
  let maximum = max;
  let searchValue = getMiddle(minimum, maximum);

  // Limit number of requests
  for (let i = 0; i < constants.maxRequests; i++) {
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

  console.log(`Max salary not found after ${constants.maxRequests} requests.`);
  return roundUp(searchValue);
};

const getMinSalary = async (jobId, min, max) => {
  let minimum = min;
  let maximum = max;
  let searchValue = getMiddle(minimum, maximum);

  // Limit number of requests
  for (let i = 0; i < constants.maxRequests; i++) {
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

  console.log(`Min salary not found after ${constants.maxRequests} requests.`);
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
    throw new Error(`Failed to find jobId for url ${url}.`);
  }
};

const getJobDetails = async jobId => {
  const url = new URL(constants.searchUrl);
  url.searchParams.set("jobid", jobId);

  const response = await fetch(url.href);
  return response.json();
};

const getJob = async (jobId, min, max) => {
  rangeUrl.searchParams.set("salaryrange", `${min}-${max}`);
  const response = await fetch(rangeUrl.href);

  if (response.status === 200) {
    const result = await response.json();
    if (result && result.data && result.data.find(x => x.id == jobId)) {
      return { found: true };
    } else {
      return { found: false };
    }
  } else {
    throw new Error(`Unsuccessful response: ${response.status}`);
  }
};

const cacheJob = (jobId, minimum, maximum, range) => {
  try {
    const currentDate = new Date().getTime();
    const cache = JSON.parse(localStorage.getItem(constants.cacheKey)) || [];
    const job = {
      id: jobId,
      minimum: minimum,
      maxiumum: maximum,
      range: range,
      created: currentDate
    };

    const existingJobIndex = cache.findIndex(x => x.id === jobId);
    if (existingJobIndex !== -1) {
      cache[existingJobIndex] = job;
    } else {
      cache.push(job);
    }

    // Remove old jobs from cache
    const updatedCache = cache.filter(x => getDifferenceInDays(currentDate, x.created) <= constants.maxCacheDays);

    localStorage.setItem(constants.cacheKey, JSON.stringify(updatedCache));
  } catch (exception) {
    console.log(`Failed to cache job ${jobId}`, exception);
  }
};

const getDifferenceInDays = (first, second) => Math.round(Math.abs((first - second) / 86400000));

const sendMessage = (tabId, result) => {
  chrome.tabs.sendMessage(tabId, {
    message: "update-placeholder",
    result: result
  });
};

const handleScriptInjection = (tabId, url) => {
  if (!isSupportedUrl(url)) {
    return;
  }

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

        checkJobType(tabId, url);
      } else {
        chrome.tabs.executeScript(tabId, {
          file: "seeker.js"
        },
        async () => {
          checkJobType(tabId, url);
        });
      }
    }
  );
};

const checkJobType = (tabId, url) => {
  if (isJobUrl(url)) {
    try {
      findSalaryRange(tabId, url);
    } catch (exception) {
      // Load from cache if we fail to calculate the range.
      findCachedJob(tabId, url);
      sendMessage(tabId, `Failed to calculate salary range: ${exception.message}`)
    }
  } else if (isExpiredJobUrl(url)) {
    try {
      findCachedJob(tabId, url);
    } catch (exception) {
      sendMessage(tabId, `Failed to load cached salary range: ${exception.message}`);
    }
  }
};

const findSalaryRange = async (tabId, url) => {
  const jobId = getJobId(url);
  if (jobId) {
    const salary = await calculateRange(jobId);
    sendMessage(tabId, salary);
  }
};

const findCachedJob = (tabId, url) => {
  const jobCache = JSON.parse(localStorage.getItem(constants.cacheKey)) || [];
  const jobId = getJobId(url);
  const job = jobCache.find(x => x.id === jobId);

  sendMessage(tabId, job ? job.range : "No cache exists for this job.");
};

const isJobUrl = url => url.toLowerCase().includes("/job/");

const isExpiredJobUrl = url => url.toLowerCase().includes("/expiredjob/");

const isSupportedUrl = url => isJobUrl(url) || isExpiredJobUrl(url);

// Handle job access by site navigation or new tab.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "loading" || !changeInfo.url) {
    return;
  }

  handleScriptInjection(tabId, changeInfo.url);
});

// Handle job access on page refresh.
chrome.webNavigation.onCommitted.addListener(details => {
  if (!details.tabId || !details.url || details.transitionType !== "reload") {
    return;
  }

  handleScriptInjection(details.tabId, details.url);
});
