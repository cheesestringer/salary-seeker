const constants = {
  maxResults: 50,
  maxRequests: 10,
  maxCacheDays: 45,
  cacheKey: "jobs",
  searchUrl: "https://jobsearch-api.cloud.seek.com.au/search",
  seekNewZealand: "seek.co.nz",
  version: chrome.runtime.getManifest().version
};

const rangeUrl = new URL(constants.searchUrl);

const calculateRange = async url => {
  const jobId = getJobId(url);
  if (!jobId) {
    return null;
  }

  const minRange = 30000;
  const maxRange = 999999;

  const jobDetails = await getJobDetails(jobId);
  const job = jobDetails.data.find(x => x.id == jobId);
  if (job) {
    rangeUrl.searchParams.set("advertiserid", job.advertiser.id);
    rangeUrl.searchParams.set("pagesize", constants.maxResults);
    rangeUrl.searchParams.set("sourcesystem", "houston");

    if (url.includes(constants.seekNewZealand)) {
      rangeUrl.searchParams.set("where", "New+Zealand");
    } else {
      rangeUrl.searchParams.delete("where");
    }

    const maxSalary = await getMaxSalary(jobId, minRange, maxRange);
    const minSalary = await getMinSalary(jobId, minRange, maxSalary);

    if (minSalary && maxSalary) {
      const range = `$${minSalary.toLocaleString()} - $${maxSalary.toLocaleString()}`;
      cacheJob(jobId, job.title, job.companyName, minSalary, maxSalary, range);
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
  return (first / second) * 100 > 99.4;
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

const cacheJob = (jobId, title, company, minimum, maximum, range) => {
  try {
    const currentDate = new Date().getTime();
    const cache = JSON.parse(localStorage.getItem(constants.cacheKey)) || [];
    const job = {
      id: jobId,
      title: title,
      company: company,
      minimum: minimum,
      maxiumum: maximum,
      range: range,
      created: currentDate,
      version: constants.version
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
        checkJobType(tabId, url);
      } else {
        chrome.tabs.executeScript(tabId, { file: "seeker.js" }, () => checkJobType(tabId, url));
      }
    }
  );
};

const checkJobType = async (tabId, url) => {
  // Use cache for same day jobs, expired jobs, and exceptions.
  const cachedJob = findCachedJob(url);

  if (isJobUrl(url)) {
    try {
      const isCurrent = cachedJob && cachedJob.version === constants.version; // Use cache for jobs created on same version.
      const createdToday = cachedJob && getDifferenceInDays(new Date().getTime(), cachedJob.created) === 0; // Use cache for jobs viewed on the same day.

      if (isCurrent && createdToday) {
        console.log(`Cached salary range is ${cachedJob.range}`);
        sendMessage(tabId, cachedJob.range);
      } else {
        const range = await calculateRange(url);
        console.log(`Salary range is ${range}`);
        sendMessage(tabId, range);
      }
    } catch (exception) {
      sendMessage(tabId, cachedJob ? cachedJob.range : `Failed to calculate salary range: ${exception.message}`);
    }
  } else if (isExpiredJobUrl(url)) {
    sendMessage(tabId, cachedJob ? cachedJob.range : "Couldn't find a cached salary for this job");
  }
};

const findCachedJob = url => {
  try {
    const jobCache = JSON.parse(localStorage.getItem(constants.cacheKey)) || [];
    const jobId = getJobId(url);
    return jobCache.find(x => x.id === jobId);
  } catch (exception) {
    return null;
  }
};

const isJobUrl = url => url.toLowerCase().includes("/job/");

const isExpiredJobUrl = url => url.toLowerCase().includes("/expiredjob/");

const isSupportedUrl = url => isJobUrl(url) || isExpiredJobUrl(url);

// Handle job access by site navigation, new tab, and page refresh.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    handleScriptInjection(tabId, tab.url);
  }
});
